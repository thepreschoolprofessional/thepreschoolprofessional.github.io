<?php
/* ============================================================
   THE HIVE v2 — Airtable messenger (server-side proxy)
   Per-school director roles: each PIN only reaches its own school.
   Per-school PARENT roles too: each family only sees their school.
   Mrs. Bear: keep your Airtable token between the quotes below.
   ============================================================ */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
// Token lives OUTSIDE public_html (in the account home folder) so Git redeploys can never wipe it.
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

$SCHOOL_BY_ROLE = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2', 'parent-sanford' => 'Sanford', 'parent-deland' => 'DeLand 2'];

// Tables that carry a School field (server injects the school filter for directors)
$SCHOOL_TABLES = ['Briefing Checklist','Ratio Snapshots','FTE & Occupancy','Task Board','ProCare Message Requests','Staff Time Corrections','Onboarding Tracker','Staff Roster','Staff Hours Snapshot','Food Program Log','Email Automation Requests','Tab Notes','Sign-In Log','Weekly Schedule','Teacher Questions','Resource Links','Inventory','Parent Messages','Facility Checklists'];

$DIRECTOR_PERMS = [
  'read'  => ['Lesson Plan Index','Forms Library','Briefing Checklist','Ratio Snapshots','FTE & Occupancy','Task Board','ProCare Message Requests','Staff Time Corrections','Onboarding Tracker','Staff Roster','Staff Hours Snapshot','Food Program Log','Email Automation Requests','Tab Notes','Sign-In Log','Weekly Schedule','Teacher Questions','Resource Links','Parent Messages','Inventory','Facility Checklists'],
  'create'=> ['ProCare Message Requests','Staff Time Corrections','Onboarding Tracker','Email Automation Requests','Tab Notes','Inventory'],
  'update'=> ['Briefing Checklist' => ['Done','Director Notes'], 'Onboarding Tracker' => ['Current Step','Status','Notes'], 'Parent Messages' => ['Status'], 'Inventory' => ['On-Hand Qty','Par / Reorder Level','Notes','Last Updated'], 'Facility Checklists' => ['Checked','Checked By','Time','Notes','Status','Room / Classroom']]
];
$PARENT_PERMS = ['read' => ['Resource Links'], 'create'=>['Parent Messages'], 'update'=>[]];
$PERMS = [
  'teacher' => ['read' => ['Lesson Plan Index','Resource Links','Facility Checklists'], 'create'=>['Teacher Questions'], 'update'=>['Facility Checklists' => ['Checked','Checked By','Time','Notes','Status','Room / Classroom']]],
  'parent' => $PARENT_PERMS,
  'parent-sanford' => $PARENT_PERMS,
  'parent-deland'  => $PARENT_PERMS,
  'director-sanford' => $DIRECTOR_PERMS,
  'director-deland'  => $DIRECTOR_PERMS
];

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
    $pin  = strtoupper(trim($r['fields']['PIN'] ?? ''));
    if ($role && $pin) $pins[$pin] = $role;
  }
  if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
  return $pins;
}

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet. Mrs. Bear needs to paste it into api.php.', 503);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');

$pin  = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear — PINs change every couple of months.', 401);
$role   = $pins[$pin];
if (!isset($PERMS[$role])) fail('Role not configured', 403);
$perm   = $PERMS[$role];
$school = $SCHOOL_BY_ROLE[$role] ?? null;
$action = $input['action'] ?? '';
$table  = $input['table'] ?? '';

if ($action === 'whoami'){
  echo json_encode(['role' => (strpos($role,'director')===0 ? 'director' : (strpos($role,'parent')===0 ? 'parent' : $role)), 'school' => $school]); exit;
}

if ($action === 'list'){
  if (!in_array($table, $perm['read'])) fail('Not allowed', 403);
  $q = ['maxRecords' => min(intval($input['maxRecords'] ?? 200), 500)];
  $formulas = [];
  if (!empty($input['filterByFormula'])) $formulas[] = '(' . $input['filterByFormula'] . ')';
  if ($school && in_array($table, $SCHOOL_TABLES)) $formulas[] = "OR({School}='" . $school . "',{School}='Both')";
  if ($role === 'teacher' && $table === 'Resource Links') $formulas[] = "{Audience}='Everyone'"; // teachers never see director-only links
  if (strpos($role,'parent')===0 && $table === 'Resource Links') $formulas[] = "{Audience}='Parents'"; // parents only see parent-facing links
  if ($role === 'teacher' && $table === 'Facility Checklists') $formulas[] = "{Portal Visibility}='Both'";
  if ($formulas) $q['filterByFormula'] = count($formulas) > 1 ? 'AND(' . implode(',', $formulas) . ')' : $formulas[0];
  if (!empty($input['sortField'])) { $q['sort[0][field]'] = $input['sortField']; $q['sort[0][direction]'] = ($input['sortDir'] ?? 'asc') === 'desc' ? 'desc' : 'asc'; }
  $out = at_request('GET', [$table], $q);
  if (isset($out['offset']) && count($out['records'] ?? []) < 500){
    $q['offset'] = $out['offset'];
    $more = at_request('GET', [$table], $q);
    $out['records'] = array_merge($out['records'], $more['records'] ?? []);
  }
  echo json_encode($out); exit;
}

if ($action === 'create'){
  if (!in_array($table, $perm['create'])) fail('Not allowed', 403);
  $fields = $input['fields'] ?? [];
  if (!$fields) fail('No fields');
  if ($school && in_array($table, $SCHOOL_TABLES)) $fields['School'] = $school; // directors + school parents can only file for their own school
  $out = at_request('POST', [$table], null, ['records' => [['fields' => $fields]], 'typecast' => true]);
  echo json_encode($out); exit;
}

if ($action === 'update'){
  if (!isset($perm['update'][$table])) fail('Not allowed', 403);
  $allowed = $perm['update'][$table];
  $fields = array_intersect_key($input['fields'] ?? [], array_flip($allowed));
  $recId = $input['recordId'] ?? '';
  if (!$fields || !preg_match('/^rec[A-Za-z0-9]{14}$/', $recId)) fail('Bad update');
  if ($school && in_array($table, $SCHOOL_TABLES)){
    // verify the record belongs to this school (or Both) before writing
    $chk = at_request('GET', [$table, $recId]);
    $recSchool = $chk['fields']['School']['name'] ?? $chk['fields']['School'] ?? '';
    if ($recSchool !== $school && $recSchool !== 'Both') fail('Not your school\'s record', 403);
  }
  $out = at_request('PATCH', [$table, $recId], null, ['fields' => $fields, 'typecast' => true]);
  echo json_encode($out); exit;
}

fail('Unknown action');
