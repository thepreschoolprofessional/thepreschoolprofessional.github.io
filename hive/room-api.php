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
 'sanford'=>[]
];
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) fail('Bad request');
$sk = (string)($in['s'] ?? ''); $rk = (string)($in['r'] ?? '');
if (!isset($SCHOOLS[$sk]) || !isset($ROOMS[$sk][$rk])) fail('This room page was not found.', 404);
$school = $SCHOOLS[$sk]; list($label, $rooms) = $ROOMS[$sk][$rk];
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
