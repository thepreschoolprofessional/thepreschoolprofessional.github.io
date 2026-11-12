<?php
/* THE HIVE — Staff Contacts API, built 11/12/26.
Directors (and the owner through a director door) see and edit their OWN school only. Teachers and parents get nothing.
Names/roles come from the Staff Roster in Airtable; phones, emails and notes live OUTSIDE public_html in
hive-vault/<school>/staff-contacts.json (never in GitHub). Separate from every other API on purpose. */
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
if (!isset($ROLE_SCHOOL[$role])) fail('Staff contacts are only available to directors and the owner.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';
if ($action === 'whoami'){ echo json_encode(['role'=>'director','school'=>$school]); exit; }
$root = vault_root(); if (!$root) fail('The private vault is not available.', 500);
$d = $root . '/' . preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($d)) @mkdir($d, 0750, true);
$file = $d . '/staff-contacts.json';
$store = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
$people = $store['people'] ?? [];
function clean($s, $n){ return mb_substr(trim(strip_tags((string)$s)), 0, $n); }
if ($action === 'sc_save'){
  $name = clean($input['name'] ?? '', 80); if (!$name) fail('Missing name.');
  $key = strtolower($name);
  $rec = ['name'=>$name, 'role'=>clean($input['role'] ?? '', 40), 'phone'=>clean($input['phone'] ?? '', 40),
          'email'=>clean($input['email'] ?? '', 120), 'notes'=>clean($input['notes'] ?? '', 300)];
  if (!empty($input['remove'])) { unset($people[$key]); $rec = null; } else { $people[$key] = $rec; }
  $ok = file_put_contents($file, json_encode(['updated'=>date('m/d/Y'), 'people'=>$people]), LOCK_EX);
  if (!$ok) fail('Could not save.', 500);
  echo json_encode(['ok'=>true]); exit;
}
if ($action === 'sc_import'){
  $list = $input['people'] ?? null; if (!is_array($list) || count($list) > 300) fail('That does not look like a staff list.');
  foreach ($list as $p){
    if (!is_array($p) || empty($p['name'])) continue;
    $name = clean($p['name'], 80); $key = strtolower($name); $old = $people[$key] ?? [];
    $people[$key] = ['name'=>$name, 'role'=>clean($p['role'] ?? ($old['role'] ?? ''), 40),
      'phone'=>clean($p['phone'] ?? ($old['phone'] ?? ''), 40), 'email'=>clean($p['email'] ?? ($old['email'] ?? ''), 120), 'notes'=>clean($p['notes'] ?? ($old['notes'] ?? ''), 300)];
  }
  file_put_contents($file, json_encode(['updated'=>date('m/d/Y'), 'people'=>$people]), LOCK_EX);
  echo json_encode(['ok'=>true, 'count'=>count($people)]); exit;
}
if ($action !== 'sc_get') fail('Unknown action');
$sc = str_replace("'", "", $school);
$q = ['maxRecords'=>200, 'filterByFormula'=>"{School}='$sc'"]; $roster = [];
$r = at_get('Staff Roster', $q);
foreach (($r['records'] ?? []) as $x){
  $f = $x['fields']; if (array_key_exists('Active', $f) === false) continue;
  if (empty($f['Active'])) continue;
  $n = trim($f['Name'] ?? ''); if (!$n) continue;
  $roster[strtolower($n)] = ['name'=>$n, 'role'=>$f['Role'] ?? ''];
}
$out = [];
foreach ($roster as $k => $p){ $s = $people[$k] ?? []; $out[] = ['name'=>$p['name'], 'role'=>$s['role'] ?? $p['role'], 'phone'=>$s['phone'] ?? '', 'email'=>$s['email'] ?? '', 'notes'=>$s['notes'] ?? '']; }
foreach ($people as $k => $s){ if (!isset($roster[$k])) $out[] = ['name'=>$s['name'], 'role'=>$s['role'] ?? '', 'phone'=>$s['phone'] ?? '', 'email'=>$s['email'] ?? '', 'notes'=>$s['notes'] ?? '']; }
usort($out, function($a, $b){ $ra = $a['role']==='Director' ? 0 : 1; $rb = $b['role']==='Director' ? 0 : 1; return $ra <=> $rb ?: strcasecmp($a['name'], $b['name']); });
echo json_encode(['school'=>$school, 'updated'=>$store['updated'] ?? '', 'staff'=>$out]);
