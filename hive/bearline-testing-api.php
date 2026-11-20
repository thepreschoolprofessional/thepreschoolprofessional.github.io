<?php
/* THE HIVE — Bear Line Software Testing API, built 11/19/26.
Directors (and the owner through a director door) report problems they find while testing the Bear Line and see the status of their own school's reports.
Reports are rows in the Airtable table 'Bear Line Software Testing'. Claude checks each one, Mrs. Bear approves, then it is fixed.
Directors never see Claude's internal notes. Teachers and parents get nothing. Separate from every other API on purpose. */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){
  $__c = [dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'];
  foreach ($__c as $__f){ if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN') && HIVE_TOKEN !== 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){ $__t = HIVE_TOKEN; break; } } }
}
define('AIRTABLE_TOKEN', $__t);
define('BASE_ID', 'app2HNkUSJqx9IkYZ');
define('PIN_TABLE', 'Portal Access');
define('PIN_CACHE', sys_get_temp_dir() . '/hive_pins_cache.json');
define('PIN_CACHE_TTL', 300);
define('BT_TABLE', 'tbldgpHhz84YKpHcF');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
function at_get($table, $q){
  $url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($table) . '?' . http_build_query($q);
  $o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer ".AIRTABLE_TOKEN."\r\n",'ignore_errors'=>true,'timeout'=>20]];
  return json_decode(file_get_contents($url, false, stream_context_create($o)), true);
}
function get_pins(){
  if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL) return json_decode(file_get_contents(PIN_CACHE), true);
  $res = at_get(PIN_TABLE, ['maxRecords'=>10]); $pins = [];
  foreach (($res['records'] ?? []) as $r){
    $role = strtolower(trim($r['fields']['Role'] ?? '')); $pin = strtoupper(trim($r['fields']['PIN'] ?? ''));
    if ($role && $pin) $pins[$pin] = $role;
  }
  if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
  return $pins;
}
function vault_root(){
  foreach ([dirname(__DIR__, 2).'/hive-vault', dirname(__DIR__).'/hive-vault'] as $c){
    if (!is_dir($c)) @mkdir($c, 0750, true);
    if (is_dir($c) && is_writable($c)) return $c;
  }
  return null;
}
if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail("That PIN isn't right.", 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('This card is only for directors.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';
function clean($s, $n){ return mb_substr(trim(strip_tags((string)$s)), 0, $n); }
function at_post($table, $body){
  $url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($table);
  $o = ['http'=>['method'=>'POST','header'=>"Authorization: Bearer ".AIRTABLE_TOKEN."\r\nContent-Type: application/json\r\n",'content'=>json_encode($body),'ignore_errors'=>true,'timeout'=>20]];
  return json_decode(file_get_contents($url, false, stream_context_create($o)), true);
}
if ($action === 'whoami'){ echo json_encode(['school'=>$school]); exit; }
if ($action === 'bt_add'){
  $issue = clean($input['issue'] ?? '', 2000); if (mb_strlen($issue) < 5) fail('Please describe what you saw.');
  $name = clean($input['name'] ?? '', 60); if ($name === '') fail('Please type your name.');
  $where = clean($input['where'] ?? '', 120);
  $r = at_post(BT_TABLE, ['typecast'=>true, 'records'=>[['fields'=>['Issue'=>$issue, 'School'=>$school, 'Reported By'=>$name, 'Where'=>$where, 'Status'=>'New', 'Reported At'=>gmdate('c')]]]]);
  if (empty($r['records'][0]['id'])) fail('Could not save that right now. Please try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}
if ($action === 'bt_list'){
  $sc = str_replace("'", "", $school);
  $res = at_get(BT_TABLE, ['maxRecords'=>100, 'filterByFormula'=>"{School}='$sc'", 'sort[0][field]'=>'Reported At', 'sort[0][direction]'=>'desc']);
  $out = [];
  foreach (($res['records'] ?? []) as $x){ $f = $x['fields'];
    $st = $f['Status'] ?? 'New'; if (is_array($st)) $st = $st['name'] ?? 'New';
    $out[] = ['issue'=>$f['Issue'] ?? '', 'by'=>$f['Reported By'] ?? '', 'where'=>$f['Where'] ?? '', 'status'=>$st, 'reply'=>$f['Message For Director'] ?? '', 'at'=>$f['Reported At'] ?? ($x['createdTime'] ?? '')]; }
  echo json_encode(['school'=>$school, 'items'=>$out]); exit;
}
fail('Unknown action');
