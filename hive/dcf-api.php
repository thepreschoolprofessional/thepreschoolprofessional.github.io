<?php
/* ============================================================
THE HIVE — DCF Binder API, built 11/2/26.
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
if ($query) $url .= '?' . http_build_query($query);
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

function valid_date($d){ return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) !== false; }

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');

$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear — PINs change every couple of months.', 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('The DCF Binder is only available with a director PIN.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';
$table  = $input['table'] ?? '';

if ($action === 'whoami'){ echo json_encode(['role' => 'director', 'school' => $school]); exit; }

if ($action === 'list'){
if (!in_array($table, $READ)) fail('Not allowed', 403);
$formulas = ["{School}='" . $school . "'"];
if (isset($DATE_FIELD[$table])){
$from = $input['from'] ?? ''; $to = $input['to'] ?? '';
if (!valid_date($from) || !valid_date($to)) fail('Bad date range');
if ((strtotime($to) - strtotime($from)) > 62 * 86400) fail('Date range too long (62 days max)');
$f = $DATE_FIELD[$table];
$formulas[] = "IS_AFTER({" . $f . "},'" . date('Y-m-d', strtotime($from . ' -1 day')) . "')";
$formulas[] = "IS_BEFORE({" . $f . "},'" . date('Y-m-d', strtotime($to . ' +1 day')) . "')";
}
if ($table === 'Room Children') $formulas[] = "{Status}='Active'";
if ($table === 'Monthly Forms'){ $m = $input['month'] ?? ''; if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Bad month'); $formulas[] = "{Month}='" . $m . "'"; }
if ($table === 'Staff Roster') $formulas[] = "{Active}=TRUE()";
$q = ['pageSize' => 100, 'filterByFormula' => 'AND(' . implode(',', $formulas) . ')'];
$out = at_request('GET', [$table], $q);
$all = $out['records'] ?? [];
$pages = 0;
while (isset($out['offset']) && $pages < 12){
$q['offset'] = $out['offset'];
$out = at_request('GET', [$table], $q);
$all = array_merge($all, $out['records'] ?? []);
$pages++;
}
echo json_encode(['records' => $all, 'truncated' => isset($out['offset'])]); exit;
}

if ($action === 'create'){
if (!in_array($table, $CREATE)) fail('Not allowed', 403);
$f = array_intersect_key($input['fields'] ?? [], array_flip($CREATE_FIELDS));
if ($table === 'Monthly Forms'){
if (empty($f['Form']) || empty($f['Month']) || !preg_match('/^\d{4}-\d{2}$/', $f['Month'])) fail('Missing form or month');
} elseif (!$f || empty($f['Form Type']) || empty($f['Date']) || !valid_date($f['Date'])) fail('Missing form type or date');
$f['School'] = $school;
$out = at_request('POST', [$table], null, ['records' => [['fields' => $f]], 'typecast' => true]);
echo json_encode($out); exit;
}

if ($action === 'update'){
if (!isset($UPDATE[$table])) fail('Not allowed', 403);
$fields = array_intersect_key($input['fields'] ?? [], array_flip($UPDATE[$table]));
$recId = $input['recordId'] ?? '';
if (!$fields || !preg_match('/^rec[A-Za-z0-9]{14}$/', $recId)) fail('Bad update');
$chk = at_request('GET', [$table, $recId]);
$recSchool = $chk['fields']['School']['name'] ?? $chk['fields']['School'] ?? '';
if ($recSchool !== $school) fail('Not your school\'s record', 403);
$out = at_request('PATCH', [$table, $recId], null, ['fields' => $fields, 'typecast' => true]);
echo json_encode($out); exit;
}

fail('Unknown action');
