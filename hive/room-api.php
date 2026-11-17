<?php
/* THE HIVE — Classroom QR page API (11/16/26). PUBLIC (location-locked), no PIN. Shows non-sensitive posted items + this room's sign-in/out list (first name + last initial) for ONE school + room:
   cleaning chart history (last 62 days, staff first names only) and approved teacher bios. No child names, no attendance, no allergies. */
$__t = '';
foreach ([dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'] as $__f){
  if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN')){ $__t = HIVE_TOKEN; break; } }
}
header('Content-Type: application/json; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
if ($__t === '') fail('Not connected yet.', 503);
$SCHOOLS = ['deland'=>'DeLand 2', 'sanford'=>'Sanford'];
/* page room key => label + the Facility Submissions room names that belong to it */
$ROOMS = [
 'deland'=>[
  'honeybees'=>['Honey Bees (Toddlers, Front)', ['Ones','Twos','Honey Bees - Tod. Front']],
  'honeycombs'=>['Honey Combs', ['Threes','Fours / VPK','School Age',"Four's - Honey Combs",'Honey Combs']],
  'infant'=>['Infant / Toddler Room', ['Infant Room','Infant/Toddler']],
 ],
 'sanford'=>[
  'honeybees'=>['Honeybees (Toddler / Infant)', ['Honeybees - Tod./Inf.','Ones']],
  'vpk'=>['VPK / Pre-School (Pollen-Jocks)', ['VPK/Pre-School (Pollen-Jocks)','Fours / VPK']],
  'schoolagers'=>['Schoolagers (Worker Bees)', ['Schoolagers (Worker Bees)','School Age']],
 ]
];
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) fail('Bad request');
$sk = (string)($in['s'] ?? ''); $rk = (string)($in['r'] ?? '');
if (!isset($SCHOOLS[$sk]) || !isset($ROOMS[$sk][$rk])) fail('This room page was not found.', 404);
$school = $SCHOOLS[$sk]; list($label, $rooms) = $ROOMS[$sk][$rk];
/* LOCATION LOCK (11/17/26): the page only shows after the phone proves it is at THIS school. The phone sends its location; we ask the school's Bear Line door check
   (the same location the front sign-in tablet uses, key kept in the private Airtable table 'Door Keys', never sent to the page) and hand back a 20-minute pass. */
$SECRET = hash('sha256', 'roomloc|'.$__t);
function mkpass($sk){ global $SECRET; $e = time() + 1200; return $e.'.'.hash_hmac('sha256', $sk.'|'.$e, $SECRET); }
function okpass($sk, $p){ global $SECRET; $x = explode('.', (string)$p); if (count($x) !== 2 || !ctype_digit($x[0]) || (int)$x[0] < time()) return false; return hash_equals(hash_hmac('sha256', $sk.'|'.$x[0], $SECRET), $x[1]); }
if (($in['act'] ?? '') === 'loc'){
  $bl = ($sk === 'deland') ? 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php' : 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php';
  $o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer $__t\r\n",'ignore_errors'=>true,'timeout'=>20]];
  $kd = json_decode(@file_get_contents('https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.rawurlencode('Door Keys').'?'.http_build_query(['maxRecords'=>10]), false, stream_context_create($o)) ?: '', true);
  $key = '';
  foreach (($kd['records'] ?? []) as $r){ if (strtolower(trim($r['fields']['School'] ?? '')) === $sk) $key = trim($r['fields']['Door Key'] ?? ''); }
  if ($key === '') fail('not_set', 503);
  if (!isset($in['lat']) || !isset($in['lng']) || $in['lat'] === null || $in['lng'] === null) fail('no_location', 400);
  $ctx0 = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode(['action'=>'door_check','key'=>$key,'lat'=>(float)$in['lat'],'lng'=>(float)$in['lng'],'acc'=>(float)($in['acc'] ?? 0)]),'timeout'=>20,'ignore_errors'=>true]]);
  $dc = json_decode(@file_get_contents($bl, false, $ctx0) ?: '', true);
  if (is_array($dc) && !empty($dc['ok'])){ echo json_encode(['ok'=>true,'pass'=>mkpass($sk)]); exit; }
  $er = is_array($dc) ? (string)($dc['error'] ?? '') : '';
  http_response_code(403); echo json_encode(['error'=>in_array($er, ['too_far','slow_down','no_location'], true) ? $er : 'check_failed']); exit;
}
if (!okpass($sk, $in['pass'] ?? '')) fail('need_location', 403);
/* CLASSROOM SIGN-IN / OUT (11/17/26): children of THIS room only, first name + last initial, written to the same Room Attendance board the Rooms page and Bear Line use. */
if (in_array(($in['act'] ?? ''), ['kids','sign'], true)){
  date_default_timezone_set('America/New_York');
  $BOARD = [
   'deland'=>['honeybees'=>['Honey Bees - Tod. Front'], 'honeycombs'=>["Three's - Honey Combs","Four's - Honey Combs"], 'infant'=>['Infant/Toddler']],
   'sanford'=>['honeybees'=>['Honeybees - Tod./Inf.'], 'vpk'=>['VPK/Pre-School (Pollen-Jocks)'], 'schoolagers'=>['Schoolagers (Worker Bees)']],
  ];
  $brooms = $BOARD[$sk][$rk] ?? [];
  $today = date('Y-m-d'); $hm = date('H:i');
  $atx = function($m, $path, $q = null, $b = null){ global $__t;
    $u = 'https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.$path.($q ? '?'.http_build_query($q) : '');
    $o = ['http'=>['method'=>$m,'header'=>"Authorization: Bearer $__t\r\nContent-Type: application/json\r\n",'ignore_errors'=>true,'timeout'=>25]]; if ($b !== null) $o['http']['content'] = json_encode($b);
    return json_decode(@file_get_contents($u, false, stream_context_create($o)) ?: '', true); };
  $q1 = function($v){ return str_replace("'", "\\'", $v); };
  $roomOrB = 'OR('.implode(',', array_map(function($r) use ($q1){ return "{Room}='".$q1($r)."'"; }, $brooms)).')';
  $kids = []; $off = null; $pg = 0;
  do { $q = ['pageSize'=>100, 'filterByFormula'=>"AND({School}='$school',{Status}='Active',$roomOrB)"]; if ($off) $q['offset'] = $off;
    $d = $atx('GET', rawurlencode('Room Children'), $q);
    foreach (($d['records'] ?? []) as $r){ $n = trim((string)($r['fields']['Child'] ?? '')); if ($n !== '') $kids[$n] = ['name'=>$n, 'order'=>(int)($r['fields']['Order'] ?? 99)]; }
    $off = $d['offset'] ?? null; $pg++; } while ($off && $pg < 4);
  $att = []; $curOr = 'OR('.implode(',', array_map(function($r) use ($q1){ return "{Current Room}='".$q1($r)."'"; }, $brooms)).')';
  $da = $atx('GET', rawurlencode('Room Attendance'), ['pageSize'=>100, 'filterByFormula'=>"AND({School}='$school',IS_SAME({Date},'$today','day'))"]);
  foreach (($da['records'] ?? []) as $r){ $f = $r['fields']; $n = trim((string)($f['Child'] ?? '')); if ($n === '') continue; $att[$n] = ['id'=>$r['id'], 'f'=>$f];
    $cr = (string)($f['Current Room'] ?? ''); if ($cr !== '' && in_array($cr, $brooms, true) && !isset($kids[$n])) $kids[$n] = ['name'=>$n, 'order'=>200, 'visiting'=>true]; }
  /* a child moved to another room today is not on this room's list */
  foreach ($kids as $n => $k){ $cr = (string)($att[$n]['f']['Current Room'] ?? ''); if ($cr !== '' && !in_array($cr, $brooms, true)) unset($kids[$n]); }
  if (($in['act'] ?? '') === 'sign'){
    $child = (string)($in['child'] ?? ''); $dir = (string)($in['dir'] ?? ''); $by = trim(preg_replace('/\s+/', ' ', (string)($in['by'] ?? ''))); $by = mb_substr($by, 0, 60);
    if (!isset($kids[$child])) fail('That child is not in this classroom today.', 404);
    if ($by === '') fail('Type your name first.', 400);
    if (!in_array($dir, ['in','out','undoin','undoout'], true)) fail('Bad request');
    $rec = $att[$child] ?? null; $f = $rec['f'] ?? [];
    $set = [];
    if ($dir === 'in'){ if (empty($f['Arrival'])){ $set['Arrival'] = $hm; $set['Arrival By'] = 'Classroom QR: '.$by; } else { $set['Departure'] = ''; } }
    if ($dir === 'out'){ if (empty($f['Arrival'])) fail('Sign this child in first.', 400); $set['Departure'] = $hm; $set['Departure By'] = 'Classroom QR: '.$by; }
    if ($dir === 'undoin'){ $set['Arrival'] = ''; $set['Arrival By'] = ''; $set['Departure'] = ''; $set['Departure By'] = ''; }
    if ($dir === 'undoout'){ $set['Departure'] = ''; $set['Departure By'] = ''; }
    if ($rec){ $res = $atx('PATCH', rawurlencode('Room Attendance').'/'.$rec['id'], null, ['fields'=>$set, 'typecast'=>true]); $ok = !empty($res['id']); }
    else { $hr = ''; foreach ($brooms as $br){ $hr = $br; break; }
      $home = $hr; $res = $atx('POST', rawurlencode('Room Attendance'), null, ['records'=>[['fields'=>array_merge(['Key'=>$school.'|'.$today.'|'.$child, 'Date'=>$today, 'School'=>$school, 'Child'=>$child, 'Home Room'=>$home, 'Current Room'=>$home], $set)]], 'typecast'=>true]); $ok = !empty($res['records'][0]['id']); }
    if (!$ok) fail('Did not save. Try again.', 502);
    $att[$child] = ['id'=>$rec['id'] ?? '', 'f'=>array_merge($f, $set)];
  }
  $out = [];
  foreach ($kids as $n => $k){ $f = $att[$n]['f'] ?? []; $out[] = ['name'=>$n, 'in'=>(string)($f['Arrival'] ?? ''), 'out'=>(string)($f['Departure'] ?? ''), 'order'=>$k['order'], 'visiting'=>!empty($k['visiting'])]; }
  usort($out, function($a, $b){ return [$a['order'], $a['name']] <=> [$b['order'], $b['name']]; });
  echo json_encode(['ok'=>true, 'kids'=>$out, 'now'=>$hm]); exit;
}
function at($path, $query){
  global $__t;
  $o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer $__t\r\n",'ignore_errors'=>true,'timeout'=>25]];
  return json_decode(@file_get_contents('https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.$path.'?'.http_build_query($query), false, stream_context_create($o)) ?: '', true);
}
date_default_timezone_set('America/New_York');
$roomOr = 'OR('.implode(',', array_map(function($r){ return "{Room / Classroom}='".str_replace("'", "\\'", $r)."'"; }, $rooms)).')';
$forms = ['🧹 Classroom Cleaning'=>'classroom', '🚽 Bathroom Cleaning'=>'bathroom', '🏠 Indoor Inspection'=>'indoor'];
$formOr = 'OR('.implode(',', array_map(function($f){ return "{Form Type}='".$f."'"; }, array_keys($forms))).')';
$formula = "AND({School}='$school',$roomOr,$formOr,IS_AFTER({Date},DATEADD(TODAY(),-63,'days')))";
$charts = ['classroom'=>[], 'bathroom'=>[], 'indoor'=>[]]; $offset = null; $pages = 0;
do {
  $q = ['pageSize'=>100, 'filterByFormula'=>$formula, 'sort[0][field]'=>'Date', 'sort[0][direction]'=>'desc'];
  if ($offset) $q['offset'] = $offset;
  $d = at(rawurlencode('Facility Submissions'), $q);
  foreach (($d['records'] ?? []) as $r){
    $f = $r['fields']; $k = $forms[$f['Form Type'] ?? ''] ?? null; if (!$k) continue;
    $st = $f['Overall Status'] ?? ''; $items = [];
    foreach (explode("\n", (string)($f['Items'] ?? '')) as $ln){ $ln = trim($ln); if ($ln === '') continue; $ok = (strpos($ln, '⚠') === false); $items[] = ['ok'=>$ok, 't'=>trim(preg_replace('/^(✅|⚠️|⚠)\s*/u', '', $ln))]; }
    $by = trim((string)($f['Staff Name'] ?? '')); $by = preg_split('/\s+/', $by)[0] ?? '';
    $charts[$k][] = ['date'=>$f['Date'] ?? '', 'at'=>$f['Submitted At'] ?? '', 'by'=>$by, 'room'=>$f['Room / Classroom'] ?? '', 'status'=>(strpos($st, '⚠') !== false) ? 'flag' : 'ok', 'items'=>$items];
  }
  $offset = $d['offset'] ?? null; $pages++;
} while ($offset && $pages < 6);
/* approved teacher bios: files-api.php 'bios_public' needs a parent door; use this school's parent portal code from Portal Access (never sent to the page) */
$bios = [];
$pa = at(rawurlencode('Portal Access'), ['maxRecords'=>20]); $pp = '';
foreach (($pa['records'] ?? []) as $r){ if (strtolower(trim($r['fields']['Role'] ?? '')) === 'parent-'.$sk) $pp = trim($r['fields']['PIN'] ?? ''); }
if ($pp !== ''){
  $ctx = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode(['pin'=>$pp,'action'=>'bios_public']),'timeout'=>25,'ignore_errors'=>true]]);
  $b = json_decode(@file_get_contents('https://thepreschoolprofessional.net/hive/files-api.php', false, $ctx) ?: '', true);
  foreach (($b['staff'] ?? []) as $p) $bios[] = ['name'=>$p['name'], 'role'=>$p['role'], 'bio'=>$p['bio'], 'photo'=>$p['photo'], 'a'=>($p['a'] ?? new stdClass)];
}
/* classroom daily schedules (SOP): saved edits only; the page merges them over the built-in defaults */
$sop = new stdClass;
if ($pp !== ''){
  $ctx2 = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode(['pin'=>$pp,'action'=>'sop_public']),'timeout'=>25,'ignore_errors'=>true]]);
  $sj = json_decode(@file_get_contents('https://thepreschoolprofessional.net/hive/files-api.php', false, $ctx2) ?: '', true);
  if (is_array($sj) && !empty($sj['rooms'])) $sop = $sj['rooms'];
}
$signin = ($sk === 'deland') ? 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline.html' : 'https://bearphonicsacademy.com/elc-94f077be04/bearline.html';
echo json_encode(['signin'=>$signin, 'school'=>$school, 'room'=>$label, 'today'=>date('Y-m-d'), 'charts'=>$charts, 'bios'=>$bios, 'sop'=>$sop]);
