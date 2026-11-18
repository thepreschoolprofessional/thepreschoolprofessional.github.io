<?php
/* ============================================================
THE HIVE — Social Media Photos API, built 11/18/26. DIRECTOR PIN ONLY (the owner enters through a director door).
A director uploads a photo from social.html. This file saves it as a NEW row in the
Main Social table (base appuTE2viBMO6dSuP) with the photo in Image and the caption (Post) BLANK,
and Status BLANK, so nothing ever posts by itself. The 6 PM photo scanner finds rows that have a
photo but no caption, writes the caption, and leaves Status for Mrs. Bear to approve.
Separate from api.php on purpose: nothing here can affect the other portal pages.
If uploads say "no access to the social base": in Airtable, open the Hive token's settings and add
the base that holds "Social media Airtable Main Automation" to it.
============================================================ */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){
$__candidates = [dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'];
foreach ($__candidates as $__f){
if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN') && HIVE_TOKEN !== 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){ $__t = HIVE_TOKEN; break; } }
}
}
define('AIRTABLE_TOKEN', $__t);
define('HIVE_BASE', 'app2HNkUSJqx9IkYZ');
define('SOCIAL_BASE', 'appuTE2viBMO6dSuP');
define('MAIN_SOCIAL', 'tblXKPRWFCLw5pVSt');
define('F_LABEL', 'flds4wV9C3cTmDHcg');   // Month (primary, free text label)
define('F_POST', 'fldOCOGJTqS9oNI1o');    // Post (the caption) — left blank on purpose
define('F_STATUS', 'fldO9Tp3PD1wAermC');  // Status — left blank on purpose
define('F_IMAGE', 'fldAhXqtdjft5GCRz');   // Image (attachments)
define('LABEL_TAG', 'Portal photo');
define('PIN_CACHE', sys_get_temp_dir() . '/hive_pins_cache.json');
define('PIN_CACHE_TTL', 300);
date_default_timezone_set('America/New_York');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];

function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }
function at_call($method, $url, $body = null){
$opts = ['http' => ['method' => $method, 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n", 'ignore_errors' => true, 'timeout' => 45]];
if ($body !== null) $opts['http']['content'] = json_encode($body);
$res = @file_get_contents($url, false, stream_context_create($opts));
$j = json_decode((string)$res, true);
return is_array($j) ? $j : ['error' => ['type' => 'NO_RESPONSE']];
}
function get_pins(){
if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL){ return json_decode(file_get_contents(PIN_CACHE), true); }
$res = at_call('GET', 'https://api.airtable.com/v0/'.HIVE_BASE.'/'.rawurlencode('Portal Access').'?maxRecords=10');
$pins = [];
foreach (($res['records'] ?? []) as $r){
$role = strtolower(trim($r['fields']['Role'] ?? '')); $pin = strtoupper(trim($r['fields']['PIN'] ?? ''));
if ($role && $pin) $pins[$pin] = $role;
}
if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
return $pins;
}
function at_err($j){
$t = is_array($j['error'] ?? null) ? ($j['error']['type'] ?? '') : (string)($j['error'] ?? '');
if (in_array($t, ['INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND', 'NOT_FOUND', 'INVALID_PERMISSIONS', 'AUTHENTICATION_REQUIRED'], true))
  return 'The Hive has no access to the social media base yet. Mrs. Bear: in Airtable, add that base to the Hive token, then try again.';
return 'Airtable did not take it just now. Please try again in a minute.';
}

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])){ usleep(300000); fail('That PIN isn\'t right. Please open this from the Director Portal.', 401); }
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('Social media photos are for directors and the owner.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';

/* Recent photos this school sent from the portal (newest first), with whether the caption is written yet. */
if ($action === 'recent'){
$f = "AND(FIND('".LABEL_TAG." · ".str_replace("'", "", $school)." ·',{Month})>0,{Image}!='')";
$q = http_build_query(['filterByFormula'=>$f, 'pageSize'=>12, 'sort[0][field]'=>'Last Modified By', 'sort[0][direction]'=>'desc']);
$j = at_call('GET', 'https://api.airtable.com/v0/'.SOCIAL_BASE.'/'.MAIN_SOCIAL.'?'.$q);
if (isset($j['error'])) fail(at_err($j), 502);
$out = [];
foreach (($j['records'] ?? []) as $r){
  $x = $r['fields'] ?? []; $img = $x['Image'][0] ?? [];
  $out[] = ['label'=>(string)($x['Month'] ?? ''), 'thumb'=>(string)($img['thumbnails']['large']['url'] ?? ($img['url'] ?? '')),
    'captioned'=>trim((string)($x['Post'] ?? '')) !== '', 'status'=>(string)($x['Status'] ?? '')];
}
echo json_encode(['school'=>$school, 'photos'=>$out]); exit;
}

/* One photo per call: make the row, then attach the photo to it. */
if ($action === 'upload'){
if (empty($input['permission'])) fail('Please confirm every child in the photo has photo permission.');
$b64 = (string)($input['photo'] ?? '');
if (preg_match('/^data:image\/(jpeg|png);base64,/', $b64, $m)){ $b64 = substr($b64, strpos($b64, ',') + 1); $type = 'image/'.$m[1]; } else { $type = 'image/jpeg'; }
$raw = base64_decode($b64, true);
if ($raw === false || strlen($raw) < 1000) fail('That photo did not come through. Please pick it again.');
if (strlen($raw) > 4800000) fail('That photo is too large. Please pick a smaller one.');
$info = @getimagesizefromstring($raw);
if (!$info || !in_array($info['mime'] ?? '', ['image/jpeg', 'image/png'], true)) fail('Only photos (JPG or PNG) can be sent here.');
$note = trim(preg_replace('/\s+/', ' ', (string)($input['note'] ?? '')));
if (function_exists('mb_substr')) $note = mb_substr($note, 0, 140); else $note = substr($note, 0, 140);
$label = LABEL_TAG.' · '.$school.' · '.date('n/j/y g:i A').($note !== '' ? ' · '.$note : '');
$c = at_call('POST', 'https://api.airtable.com/v0/'.SOCIAL_BASE.'/'.MAIN_SOCIAL, ['fields'=>[F_LABEL=>$label], 'typecast'=>false]);
if (isset($c['error']) || empty($c['id'])) fail(at_err($c), 502);
$rid = $c['id'];
$fn = 'portal-'.strtolower(str_replace(' ', '', $school)).'-'.date('Ymd-His').($type === 'image/png' ? '.png' : '.jpg');
$u = at_call('POST', 'https://content.airtable.com/v0/'.SOCIAL_BASE.'/'.$rid.'/'.F_IMAGE.'/uploadAttachment', ['contentType'=>$type, 'file'=>base64_encode($raw), 'filename'=>$fn]);
if (isset($u['error'])){
  at_call('DELETE', 'https://api.airtable.com/v0/'.SOCIAL_BASE.'/'.MAIN_SOCIAL.'/'.$rid); // no empty rows left behind
  fail(at_err($u), 502);
}
echo json_encode(['ok'=>true]); exit;
}
fail('Unknown action.');
