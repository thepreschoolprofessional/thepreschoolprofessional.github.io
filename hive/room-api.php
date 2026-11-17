<?php
/* THE HIVE — Classroom QR page API (11/16/26). PUBLIC, no PIN, read-only. Shows only non-sensitive posted items for ONE school + room:
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
  foreach (($b['staff'] ?? []) as $p) $bios[] = ['name'=>$p['name'], 'role'=>$p['role'], 'bio'=>$p['bio'], 'photo'=>$p['photo']];
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
