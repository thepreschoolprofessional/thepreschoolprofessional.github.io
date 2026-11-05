<?php
/* ============================================================
THE HIVE — Staff Files & Student Files API, built 11/5/26.
Directors (and the owner, who enters through the same director door) work on their OWN school only.
Teachers may only (1) list their school's staff names and (2) submit a training certificate for the file. They can never sign, edit, view or remove anything.
Files live OUTSIDE public_html in hive-vault/<school>/people/<staff|student>/<airtable record id>/ and never in GitHub.
Remove only moves a file to _removed (kept for the audit record), never erases it.
Separate from api.php, rooms-api.php and reporting-api.php on purpose: nothing here can affect the live portal pages.
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
define('PIN_CACHE', sys_get_temp_dir() . '/hive_pins_cache.json');
define('PIN_CACHE_TTL', 300);
date_default_timezone_set('America/New_York');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];
$SCHOOLS = ['Sanford', 'DeLand 2'];
$KINDS = ['staff', 'student'];
/* What each file needs. [label, needs an expiration date?, required?] — change here and re-upload this one file to change the checklist. */
$DEFS = [
'staff' => [
 'app'  => ['Employment application & resume', false, true],
 'id'   => ['Photo ID (driver license)', true, true],
 'bg'   => ['Background screening / fingerprint clearance', true, true],
 'intro'=> ['DCF Introductory Child Care Training (40-hour) or equivalency', false, true],
 'cred' => ['Staff credential / CDA / training transcript', false, false],
 'cpr'  => ['CPR & First Aid certificate', true, true],
 'phys' => ['Health statement / physical (TB)', true, true],
 'i9'   => ['I-9 and W-4 hiring forms', false, true],
 'hb'   => ['Signed handbook & policy acknowledgments', false, true],
 'ce'   => ['Other training certificates (outside classes)', false, false],
],
'student' => [
 'reg'  => ['Registration packet', false, true],
 'imm'  => ['Immunization record (Florida DH 680)', true, true],
 'phys' => ['Physical exam (DH 3040)', true, true],
 'bc'   => ['Birth certificate or proof of age', false, true],
 'em'   => ['Emergency contacts & authorized pickup', false, true],
 'rel'  => ['Photo release & policy acknowledgments', false, true],
 'fr'   => ['Free & reduced meal application (yearly)', true, true],
 'med'  => ['Allergy / medical plan (only if needed)', false, false],
 'cust' => ['Custody / court papers (only if any)', false, false],
 'sub'  => ['ELC / subsidy paperwork (only if any)', false, false],
],
];
$CE_GOAL = 10; // yearly in-service hours goal shown on each staff file

function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }

function at_request($method, $path, $query = null, $body = null){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($path[0]) . (isset($path[1]) ? '/'.$path[1] : '');
if ($query) $url .= '?' . (is_string($query) ? $query : http_build_query($query));
$opts = ['http' => ['method' => $method, 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n", 'ignore_errors' => true, 'timeout' => 25]];
if ($body !== null) $opts['http']['content'] = json_encode($body);
$res = file_get_contents($url, false, stream_context_create($opts));
return json_decode($res, true);
}
function get_pins(){
if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL){ return json_decode(file_get_contents(PIN_CACHE), true); }
$res = at_request('GET', [PIN_TABLE], ['maxRecords' => 10]);
$pins = [];
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
function school_dir($school){ $r = vault_root(); if (!$r) return null; $d = $r.'/'.preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($d)) @mkdir($d, 0750, true); return (is_dir($d) && is_writable($d)) ? $d : null; }
function clean_name($n){ $n = preg_replace('/[^A-Za-z0-9 ._()&,\'-]/', '', $n); $n = trim(preg_replace('/\.{2,}/', '.', $n)); return substr($n, 0, 100); }
function jread($f, $def){ return is_file($f) ? (json_decode(file_get_contents($f), true) ?: $def) : $def; }
function jwrite($f, $v){ file_put_contents($f, json_encode($v), LOCK_EX); }

/* Roster comes from Airtable (Staff Roster / Room Children); the files themselves never touch Airtable. */
function roster($school, $kind){
$cache = sys_get_temp_dir().'/hive_people_'.preg_replace('/[^a-z0-9]/', '', strtolower($school)).'_'.$kind.'.json';
if (file_exists($cache) && time() - filemtime($cache) < 60){ $c = json_decode(file_get_contents($cache), true); if (is_array($c)) return $c; }
$sc = str_replace("'", "", $school);
$table = $kind === 'staff' ? 'Staff Roster' : 'Room Children';
$formula = $kind === 'staff' ? "AND({School}='".$sc."',{Active})" : "AND({School}='".$sc."',{Status}='Active')";
$out = []; $offset = null; $guard = 0;
do {
$q = ['filterByFormula'=>$formula, 'pageSize'=>100]; if ($offset) $q['offset'] = $offset;
$res = at_request('GET', [$table], http_build_query($q));
if (isset($res['error'])) return null;
foreach (($res['records'] ?? []) as $r){
$f = $r['fields'];
if ($kind === 'staff'){ $nm = trim($f['Name'] ?? ''); $sub = $f['Role'] ?? ''; }
else { $nm = trim($f['Child'] ?? ''); $sub = $f['Room'] ?? ''; if (is_array($sub)) $sub = $sub['name'] ?? ''; }
if ($nm === '') continue;
$out[] = ['id'=>$r['id'], 'name'=>$nm, 'sub'=>(string)$sub, 'dob'=>$f['DOB'] ?? ''];
}
$offset = $res['offset'] ?? null;
} while ($offset && ++$guard < 10);
// practice person (not in Airtable, never counted on the card badges) so directors can try everything safely
$out[] = $kind === 'staff' ? ['id'=>'recTESTSTAFF00001', 'name'=>'Test Teacher (practice)', 'sub'=>'Practice only', 'dob'=>''] : ['id'=>'recTESTSTUDENT001', 'name'=>'Test Student (practice)', 'sub'=>'Practice only', 'dob'=>'2022-01-15'];
usort($out, function($a, $b){ return strcasecmp($a['name'], $b['name']); });
file_put_contents($cache, json_encode($out));
return $out;
}
function find_person($school, $kind, $id){ $r = roster($school, $kind); if ($r === null) fail('Could not read the roster right now. Try again in a minute.', 502); foreach ($r as $p){ if ($p['id'] === $id) return $p; } return null; }
function pdir($school, $kind, $id){
$b = school_dir($school); if (!$b) fail('The server could not open the vault. Tell Mrs. Bear.', 500);
if (!preg_match('/^rec[A-Za-z0-9]{10,20}$/', $id)) fail('Bad person');
$d = $b.'/people/'.$kind.'/'.$id; if (!is_dir($d) && !@mkdir($d, 0750, true)) fail('Could not create the folder', 500);
return $d;
}
function status_for($def, $files, $exp, $today){
// returns [status, label]. red: missing / expired. amber: expires soon / date needed. ok / optional.
list($label, $needsExp, $req) = $def;
if (!$files) return $req ? 'missing' : 'optional';
if ($needsExp){
if (!$exp) return 'needdate';
if ($exp < $today) return 'expired';
if ($exp <= date('Y-m-d', strtotime($today.' +30 days'))) return 'soon';
}
return 'ok';
}
function person_view($school, $kind, $id, $p){
global $DEFS, $CE_GOAL;
$d = pdir($school, $kind, $id); $meta = jread($d.'/meta.json', ['docs'=>new stdClass, 'files'=>[]]);
$today = date('Y-m-d'); $docs = []; $red = 0; $amber = 0;
$mdocs = (array)($meta['docs'] ?? []);
foreach ($DEFS[$kind] as $k => $def){
$fl = []; foreach (($meta['files'] ?? []) as $f){ if (($f['doc'] ?? '') === $k) $fl[] = $f; }
$exp = $mdocs[$k]['exp'] ?? '';
$st = status_for($def, $fl, $exp, $today);
if ($st === 'missing' || $st === 'expired') $red++; elseif ($st === 'soon' || $st === 'needdate') $amber++;
$docs[] = ['key'=>$k, 'label'=>$def[0], 'needsExp'=>$def[1], 'req'=>$def[2], 'status'=>$st, 'exp'=>$exp, 'files'=>$fl];
}
$out = ['id'=>$id, 'name'=>$p['name'], 'sub'=>$p['sub'], 'dob'=>$p['dob'], 'red'=>$red, 'amber'=>$amber, 'docs'=>$docs];
if ($kind === 'staff'){
$certs = jread($d.'/certs.json', []); $sign = 0; $hrs = [];
foreach ($certs as &$c){ if (empty($c['signedAt'])) $sign++; $y = $c['year'] ?? substr($c['date'] ?? '', 0, 4); $hrs[$y] = round(($hrs[$y] ?? 0) + (float)($c['hrs'] ?? 0), 2); } unset($c);
$out['certs'] = $certs; $out['sign'] = $sign; $out['hours'] = $hrs; $out['goal'] = $CE_GOAL;
}
return $out;
}

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear.', 401);
$role = $pins[$pin];
$action = $input['action'] ?? '';
$isDir = isset($ROLE_SCHOOL[$role]);
$isTeacher = ($role === 'teacher');
if (!$isDir && !$isTeacher) fail('Files are only available with a director PIN.', 403);
$school = $isDir ? $ROLE_SCHOOL[$role] : trim($input['school'] ?? '');
if (!in_array($school, $SCHOOLS, true)) fail('Pick your school first.');

if ($action === 'whoami'){ echo json_encode(['role'=>$isDir ? 'director' : 'teacher', 'school'=>$school]); exit; }

/* ---- Teacher-allowed actions (names list + submit a certificate). Nothing else. ---- */
if ($action === 'staff_names'){
$r = roster($school, 'staff'); if ($r === null) fail('Could not read the staff list right now.', 502);
echo json_encode(['staff'=>array_map(function($p){ return ['id'=>$p['id'], 'name'=>$p['name']]; }, $r)]); exit;
}
if ($action === 'cert_submit'){
$id = $input['id'] ?? ''; $lesson = preg_replace('/[^A-Za-z0-9]/', '', $input['lesson'] ?? '');
$title = substr(preg_replace('/[<>]/', '', strip_tags($input['title'] ?? '')), 0, 120);
$hrs = round((float)($input['hrs'] ?? 0), 2);
if ($lesson === '' || $title === '' || $hrs <= 0 || $hrs > 8) fail('Missing lesson details');
$p = find_person($school, 'staff', $id); if (!$p) fail('That name is not on this school\'s staff list.');
$d = pdir($school, 'staff', $id); $f = $d.'/certs.json'; $certs = jread($f, []);
$year = date('Y');
foreach ($certs as $c){ if (($c['lesson'] ?? '') === $lesson && ($c['year'] ?? '') === $year) fail('This lesson is already in the file for '.$year.'. Ask your director to open it.'); }
$c = ['cid'=>'c'.date('ymdHis').substr(md5(uniqid('', true)), 0, 4), 'lesson'=>$lesson, 'title'=>$title, 'hrs'=>$hrs, 'date'=>date('Y-m-d'), 'year'=>$year, 'at'=>gmdate('c'), 'by'=>'self', 'signedAt'=>'', 'signer'=>'', 'sig'=>''];
$certs[] = $c; jwrite($f, $certs);
echo json_encode(['ok'=>true, 'cert'=>array_merge($c, ['name'=>$p['name'], 'school'=>$school])]); exit;
}
if (!$isDir) fail('Files are only available with a director PIN.', 403);

/* ---- Director actions (own school only) ---- */
$kind = $input['kind'] ?? 'staff';
if (!in_array($kind, $KINDS, true)) fail('Bad file type');

if ($action === 'summary'){
$out = [];
foreach ($KINDS as $k){
$r = roster($school, $k); if ($r === null) fail('Could not read the roster right now.', 502);
$red = 0; $amber = 0; $sign = 0; $people = 0;
foreach ($r as $p){ if (strpos($p['id'], 'recTEST') === 0) continue; $v = person_view($school, $k, $p['id'], $p); if ($v['red']) $people++; $red += $v['red']; $amber += $v['amber']; if ($k === 'staff') $sign += $v['sign']; }
$out[$k] = ['people'=>count($r), 'peopleMissing'=>$people, 'missing'=>$red, 'soon'=>$amber, 'sign'=>$sign];
}
echo json_encode(['school'=>$school, 'summary'=>$out]); exit;
}
if ($action === 'roster'){
$r = roster($school, $kind); if ($r === null) fail('Could not read the roster right now.', 502);
$list = [];
foreach ($r as $p){ $v = person_view($school, $kind, $p['id'], $p); $list[] = ['id'=>$p['id'], 'name'=>$p['name'], 'sub'=>$p['sub'], 'red'=>$v['red'], 'amber'=>$v['amber'], 'sign'=>$v['sign'] ?? 0]; }
echo json_encode(['school'=>$school, 'kind'=>$kind, 'people'=>$list]); exit;
}

$id = $input['id'] ?? '';
$p = find_person($school, $kind, $id);
if (!$p && !in_array($action, ['getfile'], true)) fail('That person is not on this school\'s roster.', 404);

if ($action === 'person'){ echo json_encode(person_view($school, $kind, $id, $p)); exit; }

if ($action === 'upload'){
$doc = $input['doc'] ?? ''; if (!isset($DEFS[$kind][$doc])) fail('Pick which document this is');
$raw = base64_decode($input['b64'] ?? '', true);
if ($raw === false || strlen($raw) < 100) fail('Missing file');
if (strlen($raw) > 10 * 1024 * 1024) fail('File too large (10 MB max). Take the picture again or use a smaller PDF.');
if (substr($raw, 0, 4) === "%PDF") $ext = 'pdf'; elseif (substr($raw, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg'; elseif (substr($raw, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png';
else fail('Only photos (JPG/PNG) and PDF files can be filed. If this is an iPhone HEIC photo, take it with the Take photo button instead.');
$exp = $input['exp'] ?? ''; if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That expiration date is not a real date');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
$pg = 1; foreach ($meta['files'] as $f){ if (($f['doc'] ?? '') === $doc) $pg++; }
$base = clean_name(preg_replace('/\.[A-Za-z0-9]+$/', '', $input['name'] ?? 'page'));
$fname = date('Ymd-His').'_'.$doc.'_p'.$pg.'_'.($base !== '' ? $base : 'page').'.'.$ext;
if (file_put_contents($d.'/'.$fname, $raw) === false) fail('Could not save the file', 500);
$meta['files'][] = ['doc'=>$doc, 'name'=>$fname, 'at'=>gmdate('c'), 'size'=>strlen($raw)];
if (!is_array($meta['docs'])) $meta['docs'] = [];
if ($exp !== '') $meta['docs'][$doc] = ['exp'=>$exp];
jwrite($mf, $meta);
echo json_encode(['ok'=>true, 'name'=>$fname]); exit;
}
if ($action === 'setexp'){
$doc = $input['doc'] ?? ''; if (!isset($DEFS[$kind][$doc])) fail('Bad document');
$exp = $input['exp'] ?? ''; if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That expiration date is not a real date');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
if (!is_array($meta['docs'])) $meta['docs'] = [];
$meta['docs'][$doc] = ['exp'=>$exp]; jwrite($mf, $meta);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'getfile'){
$name = basename($input['name'] ?? ''); if (!preg_match('/^[A-Za-z0-9._() &,\'-]+$/', $name)) fail('Bad file');
$d = pdir($school, $kind, $id); $path = $d.'/'.$name;
if (!is_file($path) || $name === 'meta.json' || $name === 'certs.json') fail('File not found', 404);
echo json_encode(['b64'=>base64_encode(file_get_contents($path)), 'name'=>$name]); exit;
}
if ($action === 'remove'){
$name = basename($input['name'] ?? '');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
$keep = []; $hit = false; foreach ($meta['files'] as $f){ if (($f['name'] ?? '') === $name){ $hit = true; } else $keep[] = $f; }
if (!$hit || !is_file($d.'/'.$name)) fail('File not found', 404);
$tr = school_dir($school).'/_removed'; if (!is_dir($tr) && !@mkdir($tr, 0750, true)) fail('Could not remove', 500);
if (!@rename($d.'/'.$name, $tr.'/'.date('Ymd-His').'_'.$kind.'_'.$id.'_'.$name)) fail('Could not remove the file', 500);
$meta['files'] = $keep; jwrite($mf, $meta);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'cert_sign'){
if ($kind !== 'staff') fail('Bad request');
$cid = preg_replace('/[^A-Za-z0-9]/', '', $input['cid'] ?? '');
$signer = substr(preg_replace('/[^A-Za-z0-9 .\'-]/', '', $input['signer'] ?? ''), 0, 60);
$sig = $input['sig'] ?? '';
if ($signer === '' || strpos($sig, 'data:image/png;base64,') !== 0 || strlen($sig) > 150000) fail('Please sign on the screen and type your name.');
$png = base64_decode(substr($sig, 22), true); if ($png === false || substr($png, 0, 8) !== "\x89PNG\r\n\x1a\n") fail('That signature did not save. Sign again.');
$d = pdir($school, 'staff', $id); $f = $d.'/certs.json'; $certs = jread($f, []); $hit = false;
foreach ($certs as &$c){ if (($c['cid'] ?? '') === $cid){ if (!empty($c['signedAt'])) fail('This certificate is already signed and cannot be changed.'); $c['sig'] = $sig; $c['signer'] = $signer; $c['signedAt'] = gmdate('c'); $hit = true; } } unset($c);
if (!$hit) fail('Certificate not found', 404);
jwrite($f, $certs);
echo json_encode(['ok'=>true]); exit;
}

fail('Unknown action');
