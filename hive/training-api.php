<?php
/* THE HIVE - Director Training feedback API (11/4/26). Directors only. Writes/reads only the Training Feedback table. No token in this file. */
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
if (!isset($ROLE_SCHOOL[$role])) fail('Training feedback is for directors only.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';
$T = 'Training Feedback';
function clean($s, $n){ return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)$s)), 0, $n); }

if ($action === 'whoami'){ echo json_encode(['school'=>$school]); exit; }

if ($action === 'submit'){
  $mod = clean($input['module'] ?? '', 80);
  $ver = ($input['verdict'] ?? '') === 'ok' ? 'All steps correct' : 'Missing or wrong step';
  $txt = clean($input['text'] ?? '', 4000);
  $nm  = clean($input['name'] ?? '', 60);
  if ($mod === '' || $nm === '') fail('Please type your name.');
  if ($ver !== 'All steps correct' && $txt === '') fail('Please tell us what step is missing or wrong.');
  $f = ['Entry'=>$school.' - '.$mod.' - '.date('Y-m-d H:i'), 'School'=>$school, 'Module'=>$mod, 'Verdict'=>$ver, 'Missing Steps'=>$txt, 'Director Name'=>$nm, 'Submitted At'=>gmdate('c'), 'Status'=>'New'];
  $r = at_request('POST', [$T], null, ['fields'=>$f, 'typecast'=>true]);
  if (empty($r['id'])) fail('Could not save. Tell Mrs. Bear.', 500);
  echo json_encode(['ok'=>true]); exit;
}

if ($action === 'mine'){
  $q = ['filterByFormula'=>"{School}='".$school."'", 'pageSize'=>100, 'sort[0][field]'=>'Submitted At', 'sort[0][direction]'=>'desc'];
  $r = at_request('GET', [$T], $q);
  $out = [];
  foreach (($r['records'] ?? []) as $x){ $g = $x['fields'];
    $out[] = ['module'=>$g['Module']??'', 'verdict'=>$g['Verdict']??'', 'text'=>$g['Missing Steps']??'', 'name'=>$g['Director Name']??'', 'at'=>$g['Submitted At']??'', 'status'=>$g['Status']??'']; }
  echo json_encode(['school'=>$school, 'items'=>$out]); exit;
}
fail('Unknown action');
