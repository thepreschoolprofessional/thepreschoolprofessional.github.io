<?php
/* ============================================================
THE HIVE — Reporting & Audit Vault API, built 11/3/26. Directors only, own school only. Files live OUTSIDE public_html (hive-vault), never in GitHub. No delete action on purpose (5-year audit retention).
Separate from api.php and rooms-api.php on purpose: nothing here can affect the live portal pages.
Same Airtable token (kept OUTSIDE public_html) + same Portal Access PINs.
DIRECTOR PIN ONLY (director-sanford / director-deland). Each director is locked to their own school.
Read: Facility Submissions, Transportation Trips, Daily Meal Counts, Room Attendance, Room Day, Rooms, Room Children.
Write (directors only, any date): create / update Facility Submissions (the shared record the teacher portal,
Friday PDFs and weekly emails already use), plus Transportation Trips update.
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

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];
$READ = ['Facility Submissions', 'Transportation Trips', 'Daily Meal Counts', 'Room Attendance', 'Room Day', 'Rooms', 'Room Children', 'Monthly Forms', 'Staff Roster'];
$CREATE = ['Facility Submissions', 'Monthly Forms'];
$UPDATE = [
 'Facility Submissions' => ['Staff Name','Items','Overall Status','Details','Submitted At','Status'],
 'Monthly Forms' => ['Data','Updated By','Updated At','Employee'],
 'Transportation Trips' => ['Departure Location','Departure Time','Arrival Time','Riders In','Riders Out','Driver Name','Driver Date','Second Staff Name','Second Staff Date','Sweep Confirmed','Notes']
];
$CREATE_FIELDS = ['Entry','Month','Form','Employee','Data','Updated By','Updated At','Submission','Room / Classroom','Form Type','Staff Name','Date','Submitted At','Items','Overall Status','Details','Status'];
$DATE_FIELD = ['Facility Submissions'=>'Date','Transportation Trips'=>'Date','Daily Meal Counts'=>'Date','Room Attendance'=>'Date','Room Day'=>'Date'];

function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }

function at_request($method, $path, $query = null, $body = null){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($path[0]) . (isset($path[1]) ? '/'.$path[1] : '');
if ($query) $url .= '?' . (is_string($query) ? $query : http_build_query($query));
$opts = ['http' => [
'method' => $method,
'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n",
'ignore_errors' => true, 'timeout' => 25
]];
if ($body !== null) $opts['http']['content'] = json_encode($body);
$res = file_get_contents($url, false, stream_context_create($opts));
return json_decode($res, true);
}

function get_pins(){
if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL){
return json_decode(file_get_contents(PIN_CACHE), true);
}
$res = at_request('GET', [PIN_TABLE], ['maxRecords' => 10]);
$pins = [];
foreach (($res['records'] ?? []) as $r){
$role = strtolower(trim($r['fields']['Role'] ?? ''));
$pin = strtoupper(trim($r['fields']['PIN'] ?? ''));
if ($role && $pin) $pins[$pin] = $role;
}
if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
return $pins;
}

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear.', 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('Reporting is only available with a director PIN.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';
$CATS = ['elc','food','dcf','other'];

function vault_root(){
$cands = [dirname(__DIR__, 2).'/hive-vault', dirname(__DIR__).'/hive-vault'];
foreach ($cands as $c){ if (!is_dir($c)) @mkdir($c, 0750, true); if (is_dir($c) && is_writable($c)) return $c; }
return null;
}
function school_dir($school){ $r = vault_root(); if (!$r) return null; $d = $r.'/'.preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($d)) @mkdir($d, 0750, true); return (is_dir($d) && is_writable($d)) ? $d : null; }
function clean_name($n){ $n = preg_replace('/[^A-Za-z0-9 ._()&,\'-]/', '', $n); $n = trim(preg_replace('/\.{2,}/', '.', $n)); return substr($n, 0, 120); }

if ($action === 'whoami'){ echo json_encode(['role'=>'director','school'=>$school]); exit; }
$base = school_dir($school);
if (!$base) fail('The server could not open the vault. Tell Mrs. Bear.', 500);

if ($action === 'list'){
$out = [];
foreach (glob($base.'/????-??', GLOB_ONLYDIR) as $md){
$m = basename($md); $files = [];
foreach ($GLOBALS['CATS'] as $c){
foreach (glob($md.'/'.$c.'/*') as $f){ if (is_file($f)) $files[] = ['cat'=>$c, 'name'=>basename($f), 'size'=>filesize($f), 'at'=>gmdate('c', filemtime($f))]; }
}
$ck = is_file($md.'/checklist.json') ? json_decode(file_get_contents($md.'/checklist.json'), true) : new stdClass;
$out[$m] = ['files'=>$files, 'checklist'=>$ck ?: new stdClass];
}
ksort($out);
echo json_encode(['school'=>$school, 'months'=>$out]); exit;
}

if ($action === 'upload'){
$m = $input['month'] ?? ''; $cat = $input['cat'] ?? '';
$name = clean_name($input['name'] ?? '');
$raw = base64_decode($input['b64'] ?? '', true);
if (!preg_match('/^\d{4}-\d{2}$/', $m) || !in_array($cat, $CATS) || $name === '' || $raw === false || strlen($raw) < 100) fail('Missing month, section or file');
if (strlen($raw) > 12 * 1024 * 1024) fail('File too large (12 MB max)');
if (substr($raw, 0, 4) === "%PDF") $ext = 'pdf'; elseif (substr($raw, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg'; elseif (substr($raw, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png';
elseif (substr($raw, 0, 4) === "PK\x03\x04") $ext = (substr($name, -5) === '.xlsx') ? 'xlsx' : 'docx';
else fail('Only PDF, photo (JPG/PNG), Word or Excel files can be filed');
$name = preg_replace('/\.(pdf|jpe?g|png|docx|xlsx)$/i', '', $name) . '.' . $ext;
$dir = $base.'/'.$m.'/'.$cat;
if (!is_dir($dir) && !@mkdir($dir, 0750, true)) fail('Could not create the folder', 500);
$p = $dir.'/'.$name;
if (is_file($p)){ $name = preg_replace('/\.'.$ext.'$/', '', $name).' (v'.date('mdHi').').'.$ext; $p = $dir.'/'.$name; }
if (file_put_contents($p, $raw) === false) fail('Could not save the file', 500);
echo json_encode(['ok'=>true, 'name'=>$name]); exit;
}

if ($action === 'getfile'){
$m = $input['month'] ?? ''; $cat = $input['cat'] ?? ''; $name = basename($input['name'] ?? '');
if (!preg_match('/^\d{4}-\d{2}$/', $m) || !in_array($cat, $CATS) || $name === '') fail('Bad file');
$p = $base.'/'.$m.'/'.$cat.'/'.$name;
if (!is_file($p)) fail('File not found', 404);
echo json_encode(['b64'=>base64_encode(file_get_contents($p)), 'name'=>$name]); exit;
}

if ($action === 'check'){
$m = $input['month'] ?? ''; $key = $input['key'] ?? '';
if (!preg_match('/^\d{4}-\d{2}$/', $m) || !preg_match('/^[a-z0-9_]{1,40}$/', $key)) fail('Bad checklist item');
$dir = $base.'/'.$m; if (!is_dir($dir) && !@mkdir($dir, 0750, true)) fail('Could not create the folder', 500);
$f = $dir.'/checklist.json'; $ck = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
if (!empty($input['done'])) $ck[$key] = ['by'=>substr(preg_replace('/[^A-Za-z0-9 .\'-]/','',$input['by'] ?? ''),0,40), 'at'=>gmdate('c')]; else unset($ck[$key]);
file_put_contents($f, json_encode($ck), LOCK_EX);
echo json_encode(['ok'=>true, 'checklist'=>$ck ?: new stdClass]); exit;
}
if ($action === 'facility'){
// READ-ONLY: completed facility checklists (cleaning, bathroom, inspections, drills, incident) for this school + month, from Facility Submissions.
$m = $input['month'] ?? '';
if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Bad month');
$formula = "AND({School}='".str_replace("'", "", $school)."', DATETIME_FORMAT({Date},'YYYY-MM')='".$m."')";
$rows = []; $offset = null; $guard = 0;
do {
$q = ['filterByFormula'=>$formula, 'pageSize'=>100, 'fields'=>['Form Type','Room / Classroom','Staff Name','Date','Submitted At','Drive Link','Overall Status','Items','Details'], 'sort'=>[['field'=>'Date','direction'=>'asc']]];
if ($offset) $q['offset'] = $offset;
$qs = preg_replace('/fields%5B\d+%5D/', 'fields%5B%5D', http_build_query($q));
$res = at_request('GET', ['Facility Submissions'], $qs);
if (isset($res['error'])) fail('Could not read the facility checklists right now.', 502);
foreach (($res['records'] ?? []) as $r){
$f = $r['fields'];
$rows[] = ['type'=>$f['Form Type'] ?? 'Other', 'room'=>$f['Room / Classroom'] ?? '', 'staff'=>$f['Staff Name'] ?? '', 'date'=>$f['Date'] ?? '', 'link'=>$f['Drive Link'] ?? '', 'overall'=>$f['Overall Status'] ?? '', 'at'=>$f['Submitted At'] ?? '', 'items'=>substr($f['Items'] ?? '', 0, 4000), 'details'=>substr($f['Details'] ?? '', 0, 4000)];
}
$offset = $res['offset'] ?? null;
} while ($offset && ++$guard < 20);
echo json_encode(['month'=>$m, 'school'=>$school, 'rows'=>$rows]); exit;
}

if ($action === 'weeks'){
// READ-ONLY: this school's facility checklists grouped by Mon-Fri week (last 6 weeks), plus whether each week has been signed off in the vault.
date_default_timezone_set('America/New_York');
$today = new DateTime('today'); $dow = (int)$today->format('N');
$mon = (clone $today)->modify('-'.($dow-1).' days');
$mondays = [];
for ($i = ($dow >= 5 ? 0 : 1); $i <= 6; $i++){ $mondays[] = (clone $mon)->modify('-'.(7*$i).' days')->format('Y-m-d'); }
$earliest = end($mondays); $latest = $mondays[0];
$from = (new DateTime($earliest))->modify('-1 day')->format('Y-m-d');
$to = (new DateTime($latest))->modify('+5 days')->format('Y-m-d');
$formula = "AND({School}='".str_replace("'", "", $school)."', IS_AFTER({Date},'".$from."'), IS_BEFORE({Date},'".$to."'))";
$byWeek = []; foreach ($mondays as $m) $byWeek[$m] = [];
$offset = null; $guard = 0;
do {
$q = ['filterByFormula'=>$formula, 'pageSize'=>100, 'fields'=>['Form Type','Room / Classroom','Staff Name','Date','Overall Status']];
if ($offset) $q['offset'] = $offset;
$qs = preg_replace('/fields%5B\d+%5D/', 'fields%5B%5D', http_build_query($q));
$res = at_request('GET', ['Facility Submissions'], $qs);
if (isset($res['error'])) fail('Could not read the facility checklists right now.', 502);
foreach (($res['records'] ?? []) as $r){
$f = $r['fields']; $d = $f['Date'] ?? ''; if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) continue;
$m = date('Y-m-d', strtotime('monday this week', strtotime($d.' 12:00:00')));
if ((int)date('N', strtotime($d.' 12:00:00')) === 7) $m = date('Y-m-d', strtotime($m.' -7 days'));
if (!isset($byWeek[$m])) continue;
$byWeek[$m][] = ['type'=>$f['Form Type'] ?? 'Other', 'room'=>$f['Room / Classroom'] ?? '', 'staff'=>$f['Staff Name'] ?? '', 'date'=>$d, 'overall'=>$f['Overall Status'] ?? ''];
}
$offset = $res['offset'] ?? null;
} while ($offset && ++$guard < 30);
// Expected daily charts = any form+room that was filled on 3+ different days in at least one of these weeks (excludes incident reports).
$expected = [];
foreach ($byWeek as $m => $rs){ $days = [];
foreach ($rs as $r){ if (strpos($r['type'], 'Incident') !== false) continue; $days[$r['type'].'|'.$r['room']][$r['date']] = 1; }
foreach ($days as $k => $d){ if (count($d) >= 3) $expected[$k] = 1; } }
$todayStr = $today->format('Y-m-d');
$weeks = [];
foreach ($mondays as $m){
$fri = (new DateTime($m))->modify('+4 days')->format('Y-m-d');
$signed = count(glob($base.'/'.substr($m,0,7).'/dcf/SIGNED - Weekly Sign-off - Week of '.$m.'*')) > 0;
$have = []; foreach ($byWeek[$m] as $r) $have[$r['type'].'|'.$r['room'].'|'.$r['date']] = 1;
$missing = [];
for ($d = 0; $d < 5; $d++){ $ds = (new DateTime($m))->modify('+'.$d.' days')->format('Y-m-d'); if ($ds > $todayStr) continue;
foreach ($expected as $k => $_){ if (!isset($have[$k.'|'.$ds])){ list($t, $rm) = explode('|', $k, 2); $missing[] = ['type'=>$t, 'room'=>$rm, 'date'=>$ds]; } } }
$weeks[] = ['monday'=>$m, 'friday'=>$fri, 'rows'=>$byWeek[$m], 'signed'=>$signed, 'missing'=>$missing];
}
echo json_encode(['school'=>$school, 'weeks'=>$weeks]); exit;
}

fail('Unknown action');
