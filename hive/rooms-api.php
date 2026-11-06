<?php
/* ============================================================
THE HIVE — Rooms API (Room Sign-In board), built 11/2/26.
Separate from api.php on purpose: nothing here can affect the live portal pages.
Same Airtable token (kept OUTSIDE public_html) + same Portal Access PINs.
Roles: teacher (PIN, picks school in the UI) · director-sanford · director-deland.
Directors ONLY can: add a child, withdraw a child, edit the roster, write Management initials.
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

$SCHOOLS = ['DeLand 2', 'Sanford'];
$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2', 'teacher-sanford' => 'Sanford', 'teacher-deland' => 'DeLand 2'];
$STAFF_ROLES = ['teacher', 'teacher-sanford', 'teacher-deland', 'director-sanford', 'director-deland'];
$READ   = ['Rooms', 'Room Children', 'Room Attendance', 'Room Day'];
$CREATE_STAFF = ['Room Attendance', 'Room Day'];
$CREATE_DIR   = ['Room Children'];
$UPDATE = [
 'Room Attendance' => ['Current Room','Arrival','Departure','Arrival By','Departure By','B','L','P','WC','IR','AR','Director Flag','Director Answer','Lunch Note'],
 'Room Day'        => ['Staff','Transitions','Counts','Mgmt','Notes'],
 'Room Children'   => ['Child','Room','DOB','Status','Withdrawn Date','Withdrawn From Room','Withdraw Reason','ProCare Removed','KidKare Action','KidKare Intake']
];
$DIRECTOR_ONLY_UPDATE = ['Room Children'];          // whole table
$DIRECTOR_ONLY_FIELDS = ['Room Day' => ['Mgmt']];  // single fields

function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }

function at_request($method, $path, $query = null, $body = null){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($path[0]) . (isset($path[1]) ? '/'.$path[1] : '');
if ($query) $url .= '?' . http_build_query($query);
$opts = ['http' => [
'method' => $method,
'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n",
'ignore_errors' => true, 'timeout' => 20
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
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear — PINs change every couple of months.', 401);
$role = $pins[$pin];
if (!in_array($role, $STAFF_ROLES)) fail('This PIN does not open the Rooms board.', 403);
$isDirector = strpos($role, 'director') === 0;
$action = $input['action'] ?? '';
$table  = $input['table'] ?? '';

// effective school: directors are locked to theirs; teachers pick (validated)
$school = $ROLE_SCHOOL[$role] ?? null;
if (!$school){
$s = $input['school'] ?? '';
if (in_array($s, $SCHOOLS)) $school = $s;
}

if ($action === 'whoami'){
echo json_encode(['role' => $isDirector ? 'director' : 'teacher', 'school' => $ROLE_SCHOOL[$role] ?? null]); exit;
}

if (!$school) fail('Pick a school first.');

if ($action === 'list'){
if (!in_array($table, $READ)) fail('Not allowed', 403);
$formulas = ["{School}='" . $school . "'"];
if (!empty($input['date'])){
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['date'])) fail('Bad date');
$formulas[] = "IS_SAME({Date},'" . $input['date'] . "','day')";
}
if (!$isDirector && $table === 'Room Children') $formulas[] = "{Status}='Active'";
$q = ['maxRecords' => 500, 'filterByFormula' => count($formulas) > 1 ? 'AND(' . implode(',', $formulas) . ')' : $formulas[0]];
$out = at_request('GET', [$table], $q);
$pages = 0;
while (isset($out['offset']) && $pages < 3){
$q['offset'] = $out['offset'];
$more = at_request('GET', [$table], $q);
$out['records'] = array_merge($out['records'] ?? [], $more['records'] ?? []);
if (isset($more['offset'])) $out['offset'] = $more['offset']; else unset($out['offset']);
$pages++;
}
echo json_encode($out); exit;
}

if ($action === 'listFlags'){
if (!$isDirector) fail('Only a director can see these.', 403);
$q = ['maxRecords' => 200, 'filterByFormula' => "AND({School}='" . $school . "',{Director Flag}!='',{Director Answer}='')"];
$out = at_request('GET', ['Room Attendance'], $q);
echo json_encode($out); exit;
}

if ($action === 'create' || $action === 'createMany'){
$allowed = in_array($table, $CREATE_STAFF) || ($isDirector && in_array($table, $CREATE_DIR));
if (!$allowed) fail($isDirector ? 'Not allowed' : 'Only a director can do that.', 403);
$list = $action === 'create' ? [($input['fields'] ?? [])] : ($input['records'] ?? []);
if (!$list || count($list) > 10) fail('1 to 10 records at a time');
$recs = [];
foreach ($list as $f){
if (!is_array($f) || !$f) fail('No fields');
$f['School'] = $school;
$recs[] = ['fields' => $f];
}
$out = at_request('POST', [$table], null, ['records' => $recs, 'typecast' => true]);
echo json_encode($out); exit;
}

if ($action === 'update'){
if (!isset($UPDATE[$table])) fail('Not allowed', 403);
if (in_array($table, $DIRECTOR_ONLY_UPDATE) && !$isDirector) fail('Only a director can do that — enter the director PIN.', 403);
$allowed = $UPDATE[$table];
if (!$isDirector && isset($DIRECTOR_ONLY_FIELDS[$table])) $allowed = array_diff($allowed, $DIRECTOR_ONLY_FIELDS[$table]);
$fields = array_intersect_key($input['fields'] ?? [], array_flip($allowed));
$recId = $input['recordId'] ?? '';
if (!$fields || !preg_match('/^rec[A-Za-z0-9]{14}$/', $recId)) fail('Bad update');
$chk = at_request('GET', [$table, $recId]);
$recSchool = $chk['fields']['School']['name'] ?? $chk['fields']['School'] ?? '';
if ($recSchool !== $school) fail('Not your school\'s record', 403);
$out = at_request('PATCH', [$table, $recId], null, ['fields' => $fields, 'typecast' => true]);
echo json_encode($out); exit;
}

if ($action === 'updateMany'){
if (!isset($UPDATE[$table])) fail('Not allowed', 403);
if (in_array($table, $DIRECTOR_ONLY_UPDATE) && !$isDirector) fail('Only a director can do that — enter the director PIN.', 403);
$allowed = $UPDATE[$table];
if (!$isDirector && isset($DIRECTOR_ONLY_FIELDS[$table])) $allowed = array_diff($allowed, $DIRECTOR_ONLY_FIELDS[$table]);
$list = $input['records'] ?? [];
if (!$list || count($list) > 10) fail('1 to 10 records at a time');
$ids = []; $recs = [];
foreach ($list as $r){
$id = $r['id'] ?? '';
$f = array_intersect_key($r['fields'] ?? [], array_flip($allowed));
if (!$f || !preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad update');
$ids[] = $id; $recs[] = ['id' => $id, 'fields' => $f];
}
$or = 'OR(' . implode(',', array_map(function($i){ return "RECORD_ID()='" . $i . "'"; }, $ids)) . ')';
$chk = at_request('GET', [$table], ['maxRecords' => 10, 'filterByFormula' => "AND({School}='" . $school . "'," . $or . ")", 'fields' => ['School']]);
if (count($chk['records'] ?? []) !== count(array_unique($ids))) fail('Not your school\'s record', 403);
$out = at_request('PATCH', [$table], null, ['records' => $recs, 'typecast' => true]);
echo json_encode($out); exit;
}

fail('Unknown action');
