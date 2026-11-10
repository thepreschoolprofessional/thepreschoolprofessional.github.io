<?php
/* ============================================================
THE HIVE — Emergency Contacts API, built 11/10/26.
Directors (and the owner through a director door) see their OWN school only. Teachers and parents get nothing.
Read only. Contacts live OUTSIDE public_html in hive-vault/<school>/contacts.json (never in GitHub), copied from ProCare.
Rooms and children come from the same Airtable tables as the Rooms board, so the order is identical.
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

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail("That PIN isn't right.", 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('Emergency contacts are only available to directors and the owner.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';
if ($action === 'whoami'){ echo json_encode(['role' => 'director', 'school' => $school]); exit; }
if ($action === 'cx_save'){
$c = $input['contacts'] ?? null;
if (!is_array($c) || !$c || strlen(json_encode($c)) > 1500000) fail('That file does not look like a contact list.');
foreach ($c as $k => $v){ if (!is_string($k) || !is_array($v) || !isset($v['people'])) fail('That file does not look like a contact list.'); }
$root = vault_root(); if (!$root) fail('The private vault is not available.', 500);
$d = $root . '/' . preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($d)) @mkdir($d, 0750, true);
$ok = file_put_contents($d . '/contacts.json', json_encode(['updated' => date('m/d/Y'), 'contacts' => $c]), LOCK_EX);
if (!$ok) fail('Could not save.', 500);
echo json_encode(['ok' => true, 'count' => count($c)]); exit;
}
if ($action !== 'cx_get') fail('Unknown action');

$sc = str_replace("'", "", $school);
$rooms = []; foreach (at_all('Rooms', "{School}='$sc'") as $x){ $f = $x['fields'];
if (empty($f['Active'])) continue;
$rooms[] = ['name' => $f['Room'] ?? '', 'teachers' => $f['Teachers'] ?? '', 'order' => $f['Order'] ?? 99];
}
usort($rooms, function($a, $b){ return $a['order'] <=> $b['order']; });
$kids = []; foreach (at_all('Room Children', "AND({School}='$sc',{Status}='Active')") as $x){ $f = $x['fields'];
$kids[] = ['name' => $f['Child'] ?? '', 'room' => $f['Room'] ?? '', 'order' => $f['Order'] ?? 99];
}
usort($kids, function($a, $b){ return $a['order'] <=> $b['order']; });
$contacts = new stdClass(); $updated = '';
$root = vault_root();
if ($root){
$f = $root . '/' . preg_replace('/[^a-z0-9]+/', '-', strtolower($school)) . '/contacts.json';
if (is_file($f)){ $j = json_decode(file_get_contents($f), true); if (is_array($j)){ $contacts = $j['contacts'] ?? $contacts; $updated = $j['updated'] ?? ''; } }
}
echo json_encode(['school' => $school, 'rooms' => $rooms, 'kids' => $kids, 'contacts' => $contacts, 'updated' => $updated]);
