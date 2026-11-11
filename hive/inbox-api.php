<?php
/* ============================================================
THE HIVE — Parent Inbox API, built 11/10/26.
Directors (and the owner through a director door) see their OWN school only. Teachers and parents get nothing.
Lists parent messages (replies to the weekly emails + ProCare Office Chat, and the Parent Portal contact form) for the director's OWN school, and lets the director mark one Answered.
Never sends mail itself: Reply opens Gmail from the school office address in the browser.
Separate from rooms-api.php and files-api.php on purpose: nothing here can affect them.
============================================================ */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){
$__candidates = [dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'];
foreach ($__candidates as $__f){
if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN') && HIVE_TOKEN !== 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){ $__t = HIVE_TOKEN; break; } }
}
}
define('AIRTABLE_TOKEN', $__t);
define('BASE_ID', 'app2HNkUSJqx9IkYZ');
define('PIN_TABLE', 'Portal Access');
define('INBOX_TABLE', 'Parent Inbox');
define('FORM_TABLE', 'Parent Messages');
define('PIN_CACHE', sys_get_temp_dir() . '/hive_pins_cache.json');
define('PIN_CACHE_TTL', 300);
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];
function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }
function at_get($table, $q){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($table) . '?' . http_build_query($q);
$opts = ['http' => ['method' => 'GET', 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\n", 'ignore_errors' => true, 'timeout' => 20]];
return json_decode(file_get_contents($url, false, stream_context_create($opts)), true);
}
function at_all($table, $formula){
$q = ['maxRecords' => 500, 'filterByFormula' => $formula]; $all = [];
for ($i = 0; $i < 5; $i++){
$r = at_get($table, $q); foreach (($r['records'] ?? []) as $x) $all[] = $x;
if (empty($r['offset'])) break; $q['offset'] = $r['offset'];
}
return $all;
}
function get_pins(){
if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL){ return json_decode(file_get_contents(PIN_CACHE), true); }
$res = at_get(PIN_TABLE, ['maxRecords' => 10]); $pins = [];
foreach (($res['records'] ?? []) as $r){
$role = strtolower(trim($r['fields']['Role'] ?? '')); $pin = strtoupper(trim($r['fields']['PIN'] ?? ''));
if ($role && $pin) $pins[$pin] = $role;
}
if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
return $pins;
}
function vault_root(){
$cands = [dirname(__DIR__, 2).'/hive-vault', dirname(__DIR__).'/hive-vault'];
foreach ($cands as $c){ if (!is_dir($c)) @mkdir($c, 0750, true); if (is_dir($c) && is_writable($c)) return $c; }
return null;
}


function at_rec($table, $id){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($table) . '/' . $id;
$opts = ['http' => ['method' => 'GET', 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\n", 'ignore_errors' => true, 'timeout' => 20]];
return json_decode(file_get_contents($url, false, stream_context_create($opts)), true);
}
function at_patch($table, $id, $fields){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($table) . '/' . $id;
$opts = ['http' => ['method' => 'PATCH', 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n", 'content' => json_encode(['fields' => $fields]), 'ignore_errors' => true, 'timeout' => 20]];
return json_decode(file_get_contents($url, false, stream_context_create($opts)), true);
}
if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail("That PIN isn't right.", 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('Parent messages are only available to directors and the owner.', 403);
$school = $ROLE_SCHOOL[$role];
$sc = str_replace("'", "", $school);
$action = $input['action'] ?? '';
if ($action === 'pi_list'){
$out = [];
foreach (at_all(INBOX_TABLE, "{School}='$sc'") as $x){ $f = $x['fields'];
$out[] = ['id' => $x['id'], 'kind' => 'inbox', 'message' => $f['Message'] ?? '', 'parent' => $f['Parent'] ?? '', 'child' => $f['Child'] ?? '',
'email' => $f['Parent Email'] ?? '', 'subject' => $f['Subject'] ?? '', 'source' => $f['Source'] ?? '', 'type' => $f['Type'] ?? 'Other',
'received' => $f['Received'] ?? '', 'status' => $f['Status'] ?? 'New', 'by' => $f['Answered By'] ?? '', 'on' => $f['Answered On'] ?? '', 'created' => $x['createdTime'] ?? ''];
}
/* Parent Portal contact-form entries for this school (read only; "Routed" means the office already got the email) */
foreach (at_all(FORM_TABLE, "{School}='$sc'") as $x){ $f = $x['fields'];
$st = $f['Status'] ?? ''; $sub = $f['Submitted'] ?? $x['createdTime'];
if (strtotime($sub) < time() - 60*86400) continue;
$out[] = ['id' => $x['id'], 'kind' => 'form', 'message' => $f['Details'] ?? '', 'parent' => $f['Name'] ?? '', 'child' => '',
'email' => $f['Email'] ?? '', 'subject' => $f['Type'] ?? 'Parent Portal message', 'source' => 'Parent Portal form', 'type' => 'Other',
'received' => date('n/j g:ia', strtotime($sub)), 'status' => (stripos($st, 'answer') !== false) ? 'Answered' : 'New', 'by' => '', 'on' => '', 'created' => $sub];
}
usort($out, function($a, $b){ return strcmp($b['created'], $a['created']); });
echo json_encode(['school' => $school, 'messages' => array_slice($out, 0, 300)]); exit;
}
if ($action === 'pi_answer'){
$id = preg_replace('/[^A-Za-z0-9]/', '', $input['id'] ?? '');
if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad message id');
$r = at_rec(INBOX_TABLE, $id);
if (empty($r['fields']) || ($r['fields']['School'] ?? '') !== $school) fail('That message is not in your school.', 403);
$undo = !empty($input['undo']);
$f = $undo ? ['Status' => 'New', 'Answered By' => '', 'Answered On' => ''] : ['Status' => 'Answered', 'Answered By' => $role === 'director-sanford' ? 'Sanford director' : 'DeLand 2 director', 'Answered On' => date('n/j/Y g:ia')];
$u = at_patch(INBOX_TABLE, $id, $f);
if (empty($u['id'])) fail('Could not save. Try again.', 500);
echo json_encode(['ok' => true]); exit;
}
fail('Unknown action');
