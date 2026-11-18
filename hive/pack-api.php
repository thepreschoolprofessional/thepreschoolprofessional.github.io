<?php
/* THE HIVE: front-office / kitchen / visitor QR packs API (11/17/26). No PIN, but EVERY call (except the location check) needs a 20-minute pass that is only issued when the
   phone is at THIS school (same location circle the front sign-in tablet uses, via the school's Bear Line door_check; door keys are in the private Airtable table Door Keys).
   Can only: read today's status, save the fixed list of daily forms for the pass's school, log a drill, log an illness / early pick-up, add a PENDING allergy, sign visitors in/out. */
$__t = '';
foreach ([dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'] as $__f){
  if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN')){ $__t = HIVE_TOKEN; break; } }
}
header('Content-Type: application/json; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
if ($__t === '') fail('Not connected yet.', 503);
date_default_timezone_set('America/New_York');
$SCHOOLS = ['deland'=>'DeLand 2', 'sanford'=>'Sanford'];
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) fail('Bad request');
$sk = (string)($in['s'] ?? ''); if (!isset($SCHOOLS[$sk])) fail('This page was not found.', 404);
$school = $SCHOOLS[$sk]; $act = (string)($in['act'] ?? '');
function at($method, $table, $query = null, $body = null){
  global $__t;
  $url = 'https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.rawurlencode($table).($query ? '?'.http_build_query($query) : '');
  $o = ['http'=>['method'=>$method, 'header'=>"Authorization: Bearer $__t\r\nContent-Type: application/json\r\n", 'ignore_errors'=>true, 'timeout'=>25]];
  if ($body !== null) $o['http']['content'] = json_encode($body);
  return json_decode(@file_get_contents($url, false, stream_context_create($o)) ?: '', true);
}
function esc_q($s){ return str_replace("'", "\\'", $s); }
/* ---- location pass (same scheme as room-api.php so one scan at the school covers both) ---- */
$SECRET = hash('sha256', 'roomloc|'.$__t);
function mkpass($sk){ global $SECRET; $e = time() + 1200; return $e.'.'.hash_hmac('sha256', $sk.'|'.$e, $SECRET); }
function okpass($sk, $p){ global $SECRET; $x = explode('.', (string)$p); if (count($x) !== 2 || !ctype_digit($x[0]) || (int)$x[0] < time()) return false; return hash_equals(hash_hmac('sha256', $sk.'|'.$x[0], $SECRET), $x[1]); }
/* ---- director login: the school's director code (or the owner's) opens everything for 4 hours, from anywhere ---- */
function mkdtok($sk, $e){ global $SECRET; return hash_hmac('sha256', 'dir|'.$sk.'|'.$e, $SECRET); }
function okdtok($sk, $t){ $x = explode('.', (string)$t); if (count($x) !== 2 || !ctype_digit($x[0]) || (int)$x[0] < time()) return false; return hash_equals(mkdtok($sk, $x[0]), $x[1]); }
if ($act === 'dirlogin'){
  $pin = (string)($in['pin'] ?? ''); if ($pin === '' || strlen($pin) > 40) fail('Type your director code.');
  $lk = sys_get_temp_dir().'/packdir_'.md5($_SERVER['REMOTE_ADDR'] ?? 'x'); $n = (int)@file_get_contents($lk); if ($n >= 12 && @filemtime($lk) > time() - 900) fail('Too many tries. Wait a few minutes.', 429);
  $pr = at('GET', 'Portal Access', ['maxRecords'=>20]); $ok = false; $want = 'director-'.$sk; $pu = strtoupper(trim($pin));
  foreach (($pr['records'] ?? []) as $x){ $role = strtolower(trim($x['fields']['Role'] ?? '')); $pp = strtoupper(trim($x['fields']['PIN'] ?? '')); if ($pp !== '' && hash_equals($pp, $pu) && ($role === 'owner' || $role === $want)) { $ok = true; break; } }
  if (!$ok){ @file_put_contents($lk, (string)($n + 1)); fail('That code did not work.', 403); }
  $e = time() + 14400; $x = $e.'.'.hash_hmac('sha256', $sk.'|'.$e, $SECRET);
  echo json_encode(['ok'=>true, 'pass'=>$x, 'dtok'=>$e.'.'.mkdtok($sk, $e), 'exp'=>$e]); exit;
}
if ($act === 'loc'){
  $bl = ($sk === 'deland') ? 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php' : 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php';
  $kd = at('GET', 'Door Keys', ['maxRecords'=>10]); $key = '';
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

/* ---- fixed forms (match the Director Portal official forms) ---- */
$BLDG = 'Whole Building / Common Areas';
$OUTDOOR = ['Surfacing is free from broken glass, nails, trash, and animal excrement, and check for compressed/packed areas, prior to allowing children to enter the play area.','There are no visible cracks, bending or warping, rusting or breakage of any equipment.','Toys are clean and in good repair.','There are no worn swing hangers or chains.','There are no missing, damaged, or loose swing seats.','There are no broken supports or anchors.','There are no cement support footings that are exposed, cracked, or loose in the ground.','There are no accessible sharp edges or points.','There are no protruding bolt ends that have lost caps or covers.','There are no loose bolts, nuts, and so forth that require tightening.','There are no nails that have become loose.','There are no splintered, cracked or otherwise deteriorating wood.','There is no chipped or peeling paint.','Trees/shade covering maintained and in good repair.','Play areas free of foreign objects that may injure children.','Unsafe equipment.','Ground cover adequate in play areas.','Ground free from debris/litter/rusted equipment.','Area free of any insect nest or infestation.','Equipment age appropriate and accessible.'];
$san = ['Diapering/restroom sanitation','Nap-mat/cot sanitized','Outdoor trash/dumpster removed','Sensory/water table sanitized'];
$SANX = ['First-aid kit + go-bag checked','Pest/sanitation walkthrough','Vehicle safety check (if transporting)'];
$FORMS = [
 'eod'  => ['type'=>'🌙 End of Day Building Sweep','room'=>$BLDG,'items'=>['End-of-day visual sweep of entire building & all playgrounds completed by 2 closing staff.'],'two'=>true],
 'san'  => ['type'=>'🧼 Sanitation & Safety','room'=>$BLDG,'items'=>$san,'monx'=>$SANX],
 'sec'  => ['type'=>'🔒 Security & Attendance','room'=>$BLDG,'items'=>['Doors locked & secured','Sign-in/out verified']],
 'play' => ['type'=>'🛝 Outdoor / Playground Inspection','room'=>'Playground','items'=>$OUTDOOR],
 'bath' => ['type'=>'🚽 Bathroom Cleaning','room'=>$BLDG,'items'=>['8:00 AM cleaning','10:00 AM cleaning','12:00 PM cleaning','2:00 PM cleaning','4:00 PM cleaning','6:00 PM cleaning'],'slots'=>true],
 'ksan' => ['type'=>'🧼 Sanitation & Safety','room'=>'Kitchen','items'=>$san,'monx'=>$SANX],
 'tmp'  => ['type'=>'🌡️ Temp & Safety Logs','room'=>'Kitchen','items'=>['Refrigerator temp','Freezer temp','Water temperature at sinks'],'temps'=>true],
];
$DTYPES = ['Fire','Alternate route','Nap-time','Lockdown','Inclement weather','Other emergency'];
function nm($s, $n = 80){ return mb_substr(trim(preg_replace('/\s+/', ' ', (string)$s)), 0, $n); }
function child_fl($s){ $p = preg_split('/\s+/', trim((string)$s)); if (!$p || $p[0] === '') return ''; $f = mb_convert_case(mb_substr($p[0], 0, 30), MB_CASE_TITLE); return count($p) > 1 ? $f.' '.mb_strtoupper(mb_substr(end($p), 0, 1)).'.' : $f; }
function fl_name($s){ return child_fl($s); }
$now = new DateTime('now'); $today = $now->format('Y-m-d'); $nowt = $now->format('g:i A');

/* auto sign-out: still In from an earlier day, or still In after 5:30 PM, becomes signed out at 5:30 PM */
if (in_array($act, ['info','visitor_in','visitor_out'], true)){
  $hm = $now->format('H:i'); $sv = at('GET', 'Visitor Log', ['maxRecords'=>100, 'filterByFormula'=>"AND({School}='".$school."',{Status}='In')"]);
  foreach (($sv['records'] ?? []) as $r){ $dv = $r['fields']['Date'] ?? ''; if ($dv !== '' && ($dv < $today || ($dv === $today && $hm >= '17:30'))) at('PATCH', 'Visitor Log/'.$r['id'], null, ['fields'=>['Time Out'=>'5:30 PM (auto)','Status'=>'Out'], 'typecast'=>true]); }
}
if ($act === 'info'){
  $pack = (string)($in['p'] ?? '');
  $out = ['school'=>$school, 'today'=>$today, 'forms'=>[], 'done'=>[], 'drills'=>[], 'dtypes'=>$DTYPES];
  foreach ($FORMS as $k => $F) $out['forms'][$k] = ['type'=>$F['type'],'room'=>$F['room'],'monx'=>$F['monx'] ?? [],'items'=>$F['items'], 'slots'=>!empty($F['slots']), 'temps'=>!empty($F['temps']), 'two'=>!empty($F['two'])];
  $d = at('GET', 'Facility Submissions', ['maxRecords'=>200, 'filterByFormula'=>"AND(IS_SAME({Date},'$today','day'),{School}='".$school."',{Form Type}!='🚨 Incident Report')", 'fields'=>['Form Type','Room / Classroom','Staff Name','Submitted At']]);
  $out['days'] = []; $d62 = date('Y-m-d', strtotime('-62 days'));
  $dd = at('GET', 'Facility Submissions', ['maxRecords'=>1000, 'filterByFormula'=>"AND({School}='".$school."',IS_AFTER({Date},'$d62'),{Form Type}!='🚨 Incident Report')", 'fields'=>['Form Type','Room / Classroom','Date','Overall Status']]);
  foreach (($dd['records'] ?? []) as $r){ $f = $r['fields']; $out['days'][] = ['t'=>$f['Form Type'] ?? '', 'r'=>$f['Room / Classroom'] ?? '', 'd'=>$f['Date'] ?? '', 's'=>(strpos((string)($f['Overall Status'] ?? ''), '⚠') !== false) ? 'flag' : 'ok']; }
  foreach (($d['records'] ?? []) as $r){ $f = $r['fields']; $out['done'][] = ['type'=>$f['Form Type'] ?? '', 'room'=>$f['Room / Classroom'] ?? '', 'by'=>nm(explode(' ', (string)($f['Staff Name'] ?? ''))[0], 30), 'at'=>$f['Submitted At'] ?? '']; }
  $dr = at('GET', 'Facility Submissions', ['maxRecords'=>40, 'filterByFormula'=>"AND({School}='".$school."',{Form Type}='🧯 Drills & Emergency')", 'sort[0][field]'=>'Date', 'sort[0][direction]'=>'desc']);
  foreach (($dr['records'] ?? []) as $r){ $f = $r['fields']; $o = []; $dt = (string)($f['Details'] ?? ''); $i = strpos($dt, 'DRILL:'); if ($i !== false){ $o = json_decode(explode("\n", substr($dt, $i + 6))[0], true) ?: []; } $out['drills'][] = ['date'=>$f['Date'] ?? '', 'type'=>$o['type'] ?? 'Fire', 'time'=>$o['time'] ?? '', 'kids'=>$o['kids'] ?? '', 'clear'=>$o['clear'] ?? '']; }
  if ($pack === 'kitchen' || $pack === 'office'){
    $al = at('GET', 'Child Allergies', ['maxRecords'=>300, 'filterByFormula'=>"AND({School}='".$school."',{Status}='Approved')"]);
    $out['allergies'] = [];
    foreach (($al['records'] ?? []) as $r){ $f = $r['fields']; $out['allergies'][] = ['child'=>$f['Child'] ?? '', 'allergy'=>$f['Allergy'] ?? '', 'plan'=>$f['Reaction / Plan'] ?? '']; }
    usort($out['allergies'], function($a, $b){ return strcasecmp($a['child'], $b['child']); });
  }
  if ($pack === 'visitor' || $pack === 'director'){
    $v = at('GET', 'Visitor Log', ['maxRecords'=>200, 'filterByFormula'=>"AND({School}='".$school."',IS_SAME({Date},'$today','day'),{Status}='In')"]);
    $out['visitors'] = [];
    foreach (($v['records'] ?? []) as $r){ $f = $r['fields']; $out['visitors'][] = ['id'=>$r['id'], 'name'=>fl_name($f['Visitor'] ?? ''), 'from'=>$f['From (Company / Reason)'] ?? '', 'in'=>$f['Time In'] ?? '']; }
  }
  echo json_encode($out); exit;
}

/* ---- rooms, roster, allergies, food program form data ---- */
$ROOMMAP = ['sanford'=>['honeybees'=>['Honeybees - Tod./Inf.'],'vpk'=>['VPK/Pre-School (Pollen-Jocks)'],'schoolagers'=>['Schoolagers (Worker Bees)']],
            'deland'=>['honeybees'=>['Honey Bees - Tod. Front'],'honeycombs'=>["Three's - Honey Combs","Four's - Honey Combs"],'infant'=>['Infant/Toddler']]];
function room_names($slug){ global $ROOMMAP, $sk; $m = $ROOMMAP[$sk]; if ($slug !== '' && isset($m[$slug])) return $m[$slug]; $o = []; foreach ($m as $v) foreach ($v as $n) $o[] = $n; return $o; }
function room_filter($names){ return 'OR('.implode(',', array_map(function($n){ return "{Room}='".esc_q($n)."'"; }, $names)).')'; }
function roster($names){ global $school;
  $r = at('GET', 'Room Children', ['maxRecords'=>200, 'filterByFormula'=>"AND({School}='".$school."',{Status}='Active',".room_filter($names).")"]); $o = [];
  foreach (($r['records'] ?? []) as $x){ $f = $x['fields']; if (!empty($f['Child'])) $o[] = ['n'=>trim($f['Child']), 'dob'=>$f['DOB'] ?? '', 'room'=>$f['Room'] ?? '', 'o'=>$f['Order'] ?? 0]; }
  usort($o, function($a, $b){ return strcasecmp($a['n'], $b['n']); }); return $o; }
function age_str($dob, $asof){ if (!$dob) return ''; $a = explode('-', $dob); $b = explode('-', $asof); if (count($a) < 3) return ''; $m = ((int)$b[0] - (int)$a[0]) * 12 + ((int)$b[1] - (int)$a[1]); if ((int)$b[2] < (int)$a[2]) $m--; if ($m < 0) return ''; return floor($m / 12).'y '.($m % 12).'m'; }
if ($act === 'rooms'){ $o = []; foreach ($ROOMMAP[$sk] as $slug => $ns) foreach ($ns as $n) $o[] = ['slug'=>$slug, 'name'=>$n]; echo json_encode(['ok'=>true,'rooms'=>$o]); exit; }
if ($act === 'kids'){ $ns = room_names((string)($in['r'] ?? '')); $o = []; foreach (roster($ns) as $k) $o[] = ['n'=>child_fl($k['n']), 'room'=>$k['room']]; echo json_encode(['ok'=>true,'kids'=>$o]); exit; }
if ($act === 'allergies'){
  $slug = (string)($in['r'] ?? ''); $keep = null; if ($slug !== ''){ $keep = []; foreach (roster(room_names($slug)) as $k) $keep[strtolower(child_fl($k['n']))] = 1; }
  $al = at('GET', 'Child Allergies', ['maxRecords'=>300, 'filterByFormula'=>"AND({School}='".$school."',OR({Status}='Approved',{Status}='Pending'))"]); $o = [];
  foreach (($al['records'] ?? []) as $r){ $f = $r['fields']; $c = $f['Child'] ?? ''; if ($keep !== null && !isset($keep[strtolower(child_fl($c))])) continue;
    $st = is_array($f['Status'] ?? null) ? ($f['Status']['name'] ?? '') : ($f['Status'] ?? ''); $o[] = ['id'=>$r['id'], 'child'=>$c, 'allergy'=>$f['Allergy'] ?? '', 'plan'=>$f['Reaction / Plan'] ?? '', 'status'=>$st, 'by'=>$f['Entered By'] ?? '']; }
  usort($o, function($a, $b){ return strcasecmp($a['child'], $b['child']); }); echo json_encode(['ok'=>true,'list'=>$o]); exit;
}
if ($act === 'allergy_decide'){
  if (!okdtok($sk, $in['dtok'] ?? '')) fail('Directors only. Sign in with your director code.', 403);
  $id = (string)($in['id'] ?? ''); $d = (string)($in['decision'] ?? ''); if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id) || !in_array($d, ['Approved','Removed'], true)) fail('Bad request');
  $r = at('GET', 'Child Allergies/'.$id); if (($r['fields']['School'] ?? '') !== $school) fail('Not found', 404);
  $u = at('PATCH', 'Child Allergies/'.$id, null, ['fields'=>['Status'=>$d,'Approved By'=>nm($in['by'] ?? 'Director', 60)], 'typecast'=>true]);
  if (empty($u['id'])) fail('Did not save.', 502); echo json_encode(['ok'=>true]); exit;
}
if ($act === 'food'){
  $rn = (string)($in['room'] ?? ''); $okn = room_names(''); if (!in_array($rn, $okn, true)) fail('Pick a room.');
  $mon = (string)($in['mon'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $mon) || (int)date('N', strtotime($mon)) !== 1 || $mon > $today || $mon < date('Y-m-d', strtotime('-69 days'))) fail('Pick a week from the last 2 months.');
  $days = []; for ($i = 0; $i < 5; $i++) $days[] = date('Y-m-d', strtotime($mon.' +'.$i.' days'));
  $dm = []; $al = at('GET', 'Child Allergies', ['maxRecords'=>300, 'filterByFormula'=>"AND({School}='".$school."',{Status}='Approved')"]);
  foreach (($al['records'] ?? []) as $r){ $f = $r['fields']; $c = strtolower(child_fl($f['Child'] ?? '')); if ($c === '') continue; $a = nm($f['Allergy'] ?? '', 60); if ($a === '') continue; $dm[$c] = isset($dm[$c]) ? $dm[$c].', '.$a : $a; }
  $kids = []; $seen = []; foreach (roster([$rn]) as $k){ $kids[] = ['n'=>$k['n'], 'age'=>age_str($k['dob'], $mon), 'diet'=>$dm[strtolower(child_fl($k['n']))] ?? '']; $seen[strtolower($k['n'])] = 1; }
  $rows = [];
  foreach ($days as $d){
    $ar = at('GET', 'Room Attendance', ['maxRecords'=>400, 'filterByFormula'=>"AND({School}='".$school."',IS_SAME({Date},'$d','day'),OR({Home Room}='".esc_q($rn)."',{Current Room}='".esc_q($rn)."'))"]); $m = [];
    foreach (($ar['records'] ?? []) as $x){ $f = $x['fields']; $c = trim($f['Child'] ?? ''); if ($c === '') continue; $kk = strtolower($c);
      if (!isset($m[$kk])) $m[$kk] = ['att'=>!empty($f['Arrival']), 'b'=>!empty($f['B']), 'l'=>!empty($f['L']), 'p'=>!empty($f['P'])];
      if (!isset($seen[$kk])){ $seen[$kk] = 1; $kids[] = ['n'=>$c, 'age'=>'', 'diet'=>$dm[strtolower(child_fl($c))] ?? '']; } }
    $rows[$d] = $m; }
  usort($kids, function($a, $b){ return strcasecmp($a['n'], $b['n']); });
  echo json_encode(['ok'=>true,'school'=>$school,'room'=>$rn,'mon'=>$mon,'kids'=>$kids,'rows'=>$rows]); exit;
}
if ($act === 'subs'){
  $from = (string)($in['from'] ?? ''); $to = (string)($in['to'] ?? $today); $min = date('Y-m-d', strtotime('-62 days'));
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) || $from < $min || $from > $to) fail('Pick dates inside the last 2 months.');
  if ($to > $today) $to = $today;
  $d = at('GET', 'Facility Submissions', ['maxRecords'=>1000, 'filterByFormula'=>"AND({School}='".$school."',NOT(IS_BEFORE({Date},'$from')),NOT(IS_AFTER({Date},'$to')),{Form Type}!='🚨 Incident Report')", 'fields'=>['Form Type','Room / Classroom','Date','Staff Name','Items']]);
  $o = []; foreach (($d['records'] ?? []) as $r){ $f = $r['fields']; $o[] = ['t'=>$f['Form Type'] ?? '', 'r'=>$f['Room / Classroom'] ?? '', 'd'=>$f['Date'] ?? '', 'by'=>$f['Staff Name'] ?? '', 'items'=>$f['Items'] ?? '']; }
  echo json_encode(['ok'=>true,'subs'=>$o,'school'=>$school]); exit;
}

if ($act === 'submit'){
  $k = (string)($in['form'] ?? ''); if (!isset($FORMS[$k])) fail('Unknown form'); $F = $FORMS[$k];
  $dt = $today; $dq = (string)($in['date'] ?? ''); if ($dq !== ''){ if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dq) || $dq > $today || $dq < date('Y-m-d', strtotime('-62 days'))) fail('Pick a day from the last 2 months.'); $dt = $dq; }
  if (!empty($F['monx']) && (int)date('N', strtotime($dt)) === 1) $F['items'] = array_merge($F['items'], $F['monx']);
  $who = nm($in['name'] ?? ''); if ($who === '') fail('Type your name first.');
  if (!empty($F['two'])){ $w2 = nm($in['name2'] ?? ''); if ($w2 === '') fail('This sweep needs two closing staff. Type both names.'); $who .= ' & '.$w2; }
  $lines = []; $flags = []; $rows = (array)($in['rows'] ?? []);
  foreach ($rows as $r){
    $i = (int)($r['i'] ?? -1); if ($i < 0 || $i >= count($F['items'])) continue; $it = $F['items'][$i];
    $note = nm($r['note'] ?? '', 300); $ok = !empty($r['ok']);
    if (!empty($F['temps'])){ $v = nm($r['val'] ?? '', 12); if ($v === '') continue; $okt = true; $n = (float)$v;
      if ($i === 0 && ($n > 41)) $okt = false; if ($i === 1 && ($n > 0)) $okt = false;
      $lines[] = ($okt ? '✅ ' : '⚠️ ').$it.': '.$v.'°F'.($note !== '' ? ' — '.$note : ''); if (!$okt) $flags[] = $it.' '.$v.'°F'.($note !== '' ? ' ('.$note.')' : ''); continue; }
    if (!empty($F['slots'])){ if (!$ok) continue; $lines[] = '✅ '.$it; continue; }
    $lines[] = ($ok ? '✅ ' : '⚠️ ').$it.($note !== '' ? ' — '.$note : ''); if (!$ok) $flags[] = $it.($note !== '' ? ' ('.$note.')' : '');
  }
  if (!$lines) fail('Nothing to save. Check at least one item.');
  if (empty($F['slots']) && empty($F['temps']) && count($lines) < count($F['items'])) fail('Answer every line (OK or Needs attention).');
  $fields = ['School'=>$school,'Room / Classroom'=>$F['room'],'Form Type'=>$F['type'],'Staff Name'=>$who,'Date'=>$dt,'Submitted At'=>gmdate('c'),'Items'=>implode("\n", $lines),'Overall Status'=>$flags ? '⚠️ Issues Flagged' : '✅ All OK','Status'=>'🟡 Pending',
    'Submission'=>$school.' · '.$F['room'].' · '.preg_replace('/^\S+ /', '', $F['type']).' · '.substr($dt,5,2).'/'.substr($dt,8,2).($dq!==''?' (filled in late)':' '.$now->format('g:i A'))];
  if ($flags) $fields['Details'] = "Needs attention:\n- ".implode("\n- ", $flags);
  $res = at('POST', 'Facility Submissions', null, ['records'=>[['fields'=>$fields]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}

if ($act === 'drill'){
  $who = nm($in['name'] ?? ''); if ($who === '') fail('Type your name first.');
  $type = (string)($in['type'] ?? ''); if (!in_array($type, $DTYPES, true)) fail('Pick the type of drill.');
  $date = (string)($in['date'] ?? $today); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today || $date < date('Y-m-d', strtotime('-400 days'))) fail('Pick a real date (today or earlier).');
  $j = ['type'=>$type,'time'=>nm($in['time'] ?? '', 20),'adults'=>nm($in['adults'] ?? '', 6),'kids'=>nm($in['kids'] ?? '', 6),'clear'=>nm($in['clear'] ?? '', 30),'route'=>nm($in['route'] ?? '', 60),'ext'=>nm($in['ext'] ?? '', 20),'note'=>nm($in['note'] ?? '', 300),'init'=>nm($in['init'] ?? '', 6)];
  $items = '✅ '.$type.' drill conducted & logged'.($j['time'] ? ' at '.$j['time'] : '').($j['kids'] ? ' · '.$j['kids'].' children, '.($j['adults'] ?: '?').' adults' : '').($j['clear'] ? ' · cleared in '.$j['clear'] : '');
  $fields = ['Submission'=>$school.' · Drill · '.$type.' · '.substr($date, 5, 2).'/'.substr($date, 8, 2),'School'=>$school,'Room / Classroom'=>$BLDG,'Form Type'=>'🧯 Drills & Emergency','Staff Name'=>$who,'Date'=>$date,'Submitted At'=>gmdate('c'),'Items'=>$items,'Overall Status'=>'✅ All OK','Details'=>'DRILL:'.json_encode($j),'Status'=>'🟡 Pending'];
  $res = at('POST', 'Facility Submissions', null, ['records'=>[['fields'=>$fields]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}

if ($act === 'illness'){
  $who = nm($in['name'] ?? ''); $child = child_fl($in['child'] ?? ''); if ($who === '' || $child === '') fail('Type your name and the child\'s first name and last initial.');
  $sym = array_slice(array_map(function($x){ return nm($x, 40); }, (array)($in['symptoms'] ?? [])), 0, 12);
  $room = nm($in['room'] ?? '', 60); $lines = ['🤒 '.$child.' — '.($sym ? implode(', ', $sym) : 'not feeling well')];
  foreach ([['Temperature','temp'],['Time noticed','noticed'],['Parent called at','called'],['Director told','director'],['Picked up by','pickup_by'],['Picked up at','pickup_at'],['Notes','notes']] as $p){ $v = nm($in[$p[1]] ?? '', 300); if ($v !== '') $lines[] = $p[0].': '.$v; }
  $fields = ['Submission'=>$school.' · Illness / Early pick-up · '.$child.' · '.$now->format('n/j g:i A'),'School'=>$school,'Room / Classroom'=>$room !== '' ? $room : $BLDG,'Form Type'=>'🤒 Illness / Early Pick-Up','Staff Name'=>$who,'Date'=>$today,'Submitted At'=>gmdate('c'),'Items'=>implode("\n", $lines),'Overall Status'=>'⚠️ Issues Flagged','Status'=>'🟡 Pending','Details'=>'Illness / early pick-up: '.$child.' ('.$room.')'];
  $res = at('POST', 'Facility Submissions', null, ['records'=>[['fields'=>$fields]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}

if ($act === 'allergy_add'){
  $who = nm($in['name'] ?? ''); $child = child_fl($in['child'] ?? ''); $al = nm($in['allergy'] ?? '', 300);
  if ($who === '' || $child === '' || $al === '') fail('Type your name, the child (first name and last initial) and the allergy.');
  $okc = false; foreach (roster(room_names((string)($in['r'] ?? ''))) as $k){ if (strtolower(child_fl($k['n'])) === strtolower($child)) { $okc = true; break; } } if (!$okc) fail('Pick the child from the list.');
  $fields = ['Child'=>$child,'School'=>$school,'Allergy'=>$al,'Reaction / Plan'=>nm($in['plan'] ?? '', 400),'Status'=>'Pending','Source'=>nm($in['src'] ?? 'Front office / kitchen QR', 40),'Entered By'=>$who,'Date Added'=>$today];
  $res = at('POST', 'Child Allergies', null, ['records'=>[['fields'=>$fields]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}

if ($act === 'visitor_in'){
  $name = nm($in['visitor'] ?? '', 80); $from = nm($in['from'] ?? '', 120); $visiting = nm($in['visiting'] ?? '', 80); $sig = (string)($in['sig'] ?? '');
  if ($name === '' || $from === '') fail('Type your name and where you are from.');
  if (strpos($sig, 'data:image/png;base64,') !== 0 || strlen($sig) < 600 || strlen($sig) > 60000) fail('Please sign in the box.');
  $fields = ['Visitor'=>$name,'School'=>$school,'Date'=>$today,'From (Company / Reason)'=>$from,'Visiting'=>$visiting,'Time In'=>$nowt,'Signature In'=>$sig,'Status'=>'In','Source'=>'Visitor QR','Type'=>'Business / Visitor'];
  $res = at('POST', 'Visitor Log', null, ['records'=>[['fields'=>$fields]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true, 'id'=>$res['records'][0]['id'], 'time'=>$nowt]); exit;
}
if ($act === 'visitor_out'){
  $id = (string)($in['id'] ?? ''); if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad request');
  $sig = (string)($in['sig'] ?? ''); if (strpos($sig, 'data:image/png;base64,') !== 0 || strlen($sig) < 600 || strlen($sig) > 60000) fail('Please sign in the box to sign out.');
  $r = at('GET', 'Visitor Log/'.$id);
  $f = $r['fields'] ?? null; if (!$f || ($f['School'] ?? '') !== $school) fail('That visitor was not found.', 404);
  if (($f['Status'] ?? '') === 'Out') { echo json_encode(['ok'=>true, 'time'=>($f['Time Out'] ?? $nowt), 'already'=>true]); exit; }
  $res = at('PATCH', 'Visitor Log/'.$id, null, ['fields'=>['Time Out'=>$nowt,'Signature Out'=>$sig,'Status'=>'Out'], 'typecast'=>true]);
  if (empty($res['id']) || ($res['fields']['Status'] ?? '') !== 'Out') fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true, 'time'=>$nowt]); exit;
}
/* ---- INCIDENT / ACCIDENT REPORTS (11/17/26): one record per child; two-child incidents share a Group ID but never name the other child ---- */
$INC_T = 'Incident Reports';
function sigok($s){ return strpos((string)$s, 'data:image/png;base64,') === 0 && strlen((string)$s) >= 600 && strlen((string)$s) <= 60000; }
function first_tok($c){ $p = preg_split('/[\s.\(\)]+/', trim((string)$c)); return mb_strtolower($p[0] ?? ''); }
function mentions($text, $firsts){ foreach ($firsts as $f){ if (mb_strlen($f) >= 2 && preg_match('/\b'.preg_quote($f, '/').'\b/iu', (string)$text)) return $f; } return ''; }
function age_gender($dob, $g){ $a = age_str($dob, date('Y-m-d')); $ag = ''; if ($a !== ''){ preg_match('/^(\d+)y (\d+)m$/', $a, $m); $ag = ((int)$m[1] > 0) ? ((int)$m[1].' yrs') : ((int)$m[2].' mos'); } $g = in_array($g, ['F','M'], true) ? $g : ''; return trim($ag.($g !== '' ? ' / '.$g : '')); }
function inc_row($r, $full = false){ $f = $r['fields'] ?? [];
  $o = ['id'=>$r['id'], 'rid'=>$f['Report ID'] ?? '', 'group'=>$f['Group ID'] ?? '', 'child'=>$f['Child'] ?? '', 'room'=>$f['Room'] ?? '', 'teacher'=>$f['Teacher'] ?? '', 'age'=>$f['Age / Gender'] ?? '', 'date'=>$f['Incident Date'] ?? '', 'time'=>$f['Incident Time'] ?? '', 'desc'=>$f['Description'] ?? '', 'body'=>$f['Body Parts'] ?? '', 'loc'=>$f['Location'] ?? '', 'nature'=>$f['Nature of Injury'] ?? '', 'treat'=>$f['Medical Treatment'] ?? '', 'action'=>$f['Action Taken'] ?? '', 'contacted'=>$f['Parent Contacted'] ?? '', 'ctime'=>$f['Contact Time'] ?? '', 'chow'=>$f['Contact How'] ?? '', 'status'=>$f['Status'] ?? '', 'by'=>$f['Entered By'] ?? '', 'staffAt'=>$f['Staff Signed At'] ?? '', 'dirName'=>$f['Director Name'] ?? '', 'dirAt'=>$f['Director Signed At'] ?? '', 'parentName'=>$f['Parent Name'] ?? '', 'parentAt'=>$f['Parent Signed At'] ?? '', 'finalName'=>$f['Director Final Name'] ?? '', 'finalAt'=>$f['Director Final Signed At'] ?? '', 'emailAddr'=>$f['Email Address'] ?? '', 'emailReq'=>!empty($f['Email Copy Requested']), 'emailAddr'=>$f['Email Address'] ?? '', 'emailSent'=>$f['Email Sent'] ?? '', 'notes'=>$f['Director Notes'] ?? ''];
  if ($full){ $o['staffSig'] = $f['Staff Signature'] ?? ''; $o['dirSig'] = $f['Director Signature'] ?? ''; $o['parentSig'] = $f['Parent Signature'] ?? ''; $o['finalSig'] = $f['Director Final Signature'] ?? ''; }
  return $o; }
if ($act === 'inc_kids'){ $all = !empty($in['all']); $pres = [];
  if (!$all){ $ar = at('GET', 'Room Attendance', ['maxRecords'=>500, 'filterByFormula'=>"AND({School}='".$school."',IS_SAME({Date},'$today','day'))"]); foreach (($ar['records'] ?? []) as $x){ $f = $x['fields']; if (!empty($f['Arrival'])) $pres[strtolower(child_fl($f['Child'] ?? ''))] = 1; } }
  $o = []; foreach (roster(room_names((string)($in['r'] ?? ''))) as $k){ if (!$all && !isset($pres[strtolower(child_fl($k['n']))])) continue; $o[] = ['n'=>child_fl($k['n']), 'age'=>age_gender($k['dob'], ''), 'room'=>$k['room']]; }
  echo json_encode(['ok'=>true,'kids'=>$o,'present'=>!$all]); exit; }
if ($act === 'inc_add'){
  $who = nm($in['name'] ?? '', 60); $teacher = nm($in['teacher'] ?? '', 60); if ($who === '' || $teacher === '') fail('Type your name and the teacher who was with the children.');
  $date = (string)($in['date'] ?? $today); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today || $date < date('Y-m-d', strtotime('-30 days'))) fail('Pick today or a recent date.');
  $tm = nm($in['time'] ?? '', 20); $loc = nm($in['loc'] ?? '', 100); $desc = nm($in['desc'] ?? '', 340); $sig = (string)($in['sig'] ?? '');
  if ($tm === '' || $loc === '') fail('Type the time and where it happened.'); if ($desc === '') fail('Describe what happened.'); if (!sigok($sig)) fail('Please sign in the box.');
  $kids = array_values((array)($in['kids'] ?? [])); if (count($kids) < 1 || count($kids) > 2) fail('Pick one or two children.');
  $ok = []; foreach (roster(room_names((string)($in['r'] ?? ''))) as $k) $ok[strtolower(child_fl($k['n']))] = $k;
  $use = []; $firsts = [];
  foreach ($kids as $kd){ $c = child_fl($kd['child'] ?? ''); $key = strtolower($c); if ($c === '' || !isset($ok[$key])) fail('Pick each child from the list.'); if (isset($use[$key])) fail('Pick two different children.'); $use[$key] = [$c, $kd, $ok[$key]]; $firsts[] = first_tok($c); }
  $bad = mentions($desc, $firsts); if ($bad !== '') fail('Please do not type a child\'s name in what happened. Write "the child", "a friend" or "another child".');
  $gid = 'G'.date('ymdHis').rand(10, 99); $recs = []; $kn = 0;
  foreach ($use as $key => $u){ $kn++; list($c, $kd, $rk) = $u;
    $per = ['body'=>nm($kd['body'] ?? '', 100), 'nature'=>nm($kd['nature'] ?? '', 160), 'treat'=>nm($kd['treat'] ?? '', 160), 'action'=>nm($kd['action'] ?? '', 160), 'ctime'=>nm($kd['ctime'] ?? '', 20), 'chow'=>nm($kd['chow'] ?? '', 80)];
    foreach ($per as $v) if (mentions($v, $firsts) !== '') fail('Please do not type any child\'s name in the boxes. Write "another child" or "a friend".');
    $ct = ($kd['contacted'] ?? '') === 'Yes' ? 'Yes' : 'No';
    $recs[] = ['fields'=>['Report ID'=>strtoupper(substr($sk, 0, 1)).'-'.str_replace('-', '', $date).'-'.$kn.'-'.preg_replace('/[^A-Za-z]/', '', explode(' ', $c)[0]), 'School'=>$school, 'Group ID'=>$gid, 'Child'=>$c, 'Room'=>$rk['room'], 'Teacher'=>$teacher, 'Age / Gender'=>age_gender($rk['dob'], $kd['gender'] ?? ''), 'Incident Date'=>$date, 'Incident Time'=>$tm, 'Description'=>$desc, 'Body Parts'=>$per['body'], 'Location'=>$loc, 'Nature of Injury'=>$per['nature'], 'Medical Treatment'=>$per['treat'] !== '' ? $per['treat'] : 'None reported', 'Action Taken'=>$per['action'], 'Parent Contacted'=>$ct, 'Contact Time'=>$per['ctime'], 'Contact How'=>$per['chow'], 'Status'=>'Needs Director', 'Entered By'=>$who, 'Staff Signature'=>$sig, 'Staff Signed At'=>$now->format('n/j/Y g:i A')]];
  }
  $res = at('POST', $INC_T, null, ['records'=>$recs, 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true, 'n'=>count($res['records'])]); exit;
}
if ($act === 'inc_list'){
  $dir = okdtok($sk, $in['dtok'] ?? ''); $since = date('Y-m-d', strtotime($dir ? '-401 days' : '-63 days'));
  $keep = null; $slug = (string)($in['r'] ?? ''); if (!$dir){ $keep = []; foreach (roster(room_names($slug)) as $k) $keep[strtolower(child_fl($k['n']))] = 1; }
  $q = at('GET', $INC_T, ['maxRecords'=>300, 'filterByFormula'=>"AND({School}='".$school."',IS_AFTER({Incident Date},'$since'))", 'sort[0][field]'=>'Incident Date', 'sort[0][direction]'=>'desc']); $o = [];
  foreach (($q['records'] ?? []) as $r){ if ($keep !== null && !isset($keep[strtolower(child_fl($r['fields']['Child'] ?? ''))])) continue; $o[] = inc_row($r); }
  echo json_encode(['ok'=>true, 'list'=>$o, 'dir'=>$dir]); exit;
}
if (in_array($act, ['inc_get','inc_dir_sign','inc_dir_final','inc_update','inc_emailed','inc_email'], true)){
  if (!okdtok($sk, $in['dtok'] ?? '')) fail('Directors only. Sign in with your director code.', 403);
  $id = (string)($in['id'] ?? ''); if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad request');
  $r = at('GET', $INC_T.'/'.$id); if (($r['fields']['School'] ?? '') !== $school) fail('Not found', 404); $f = $r['fields'];
  if ($act === 'inc_get'){
    $all = [inc_row($r, true)]; $g = $f['Group ID'] ?? ''; /* print needs both halves of a two-child incident, each only with its own child */
    if (!empty($in['group']) && $g !== ''){ $all = []; $q = at('GET', $INC_T, ['maxRecords'=>4, 'filterByFormula'=>"AND({School}='".$school."',{Group ID}='".esc_q($g)."')"]); foreach (($q['records'] ?? []) as $x) $all[] = inc_row($x, true); }
    echo json_encode(['ok'=>true, 'rows'=>$all]); exit;
  }
  if ($act === 'inc_dir_sign'){
    if (($f['Parent Signed At'] ?? '') !== '') fail('The parent already signed this report.');
    $sig = (string)($in['sig'] ?? ''); $nmx = nm($in['name'] ?? '', 60); if ($nmx === '' || !sigok($sig)) fail('Type your name and sign in the box.');
    $u = at('PATCH', $INC_T.'/'.$id, null, ['fields'=>['Director Name'=>$nmx, 'Director Signature'=>$sig, 'Director Signed At'=>$now->format('n/j/Y g:i A'), 'Status'=>'Needs Parent'], 'typecast'=>true]);
    if (empty($u['id'])) fail('Did not save.', 502); echo json_encode(['ok'=>true, 'status'=>'Needs Parent']); exit;
  }
  if ($act === 'inc_dir_final'){
    if (($f['Parent Signed At'] ?? '') === '') fail('The parent has not signed yet.');
    $sig = (string)($in['sig'] ?? ''); $nmx = nm($in['name'] ?? '', 60); if ($nmx === '' || !sigok($sig)) fail('Type your name and sign in the box.');
    $u = at('PATCH', $INC_T.'/'.$id, null, ['fields'=>['Director Final Name'=>$nmx, 'Director Final Signature'=>$sig, 'Director Final Signed At'=>$now->format('n/j/Y g:i A'), 'Status'=>'Complete'], 'typecast'=>true]);
    if (empty($u['id'])) fail('Did not save.', 502); echo json_encode(['ok'=>true, 'status'=>'Complete']); exit;
  }
  if ($act === 'inc_email'){
    $to = trim((string)($in['to'] ?? '')); if (!filter_var($to, FILTER_VALIDATE_EMAIL) || strlen($to) > 120) fail('Type the parent email address.');
    if (($f['Director Signed At'] ?? '') === '') fail('Sign and approve the report before emailing it.');
    $b64 = (string)($in['pdf'] ?? ''); $pdf = base64_decode($b64, true); if ($pdf === false || strlen($pdf) < 500 || strlen($pdf) > 3000000 || substr($pdf, 0, 4) !== '%PDF') fail('Could not make the PDF. Try again.');
    $sn = ($school === 'Sanford') ? 'Kid City USA Sanford' : 'Kid City USA DeLand 2'; $bd = 'b'.md5(uniqid('', true)); $fn = 'Accident-Incident-Report.pdf';
    $hdr = "From: ".$sn." <noreply@thepreschoolprofessional.net>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$bd\"";
    $txt = "Hello,\r\n\r\nAttached is the Accident/Incident Report for your child from ".$sn.". Please keep it for your records. If you have any questions, call the school.\r\n\r\nThank you,\r\n".$sn."\r\n";
    $body = "--$bd\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n".$txt."\r\n--$bd\r\nContent-Type: application/pdf; name=\"$fn\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$fn\"\r\n\r\n".chunk_split(base64_encode($pdf))."\r\n--$bd--";
    if (!@mail($to, 'Accident/Incident Report - '.$sn, $body, $hdr)) fail('The email could not be sent. Try again.', 502);
    at('PATCH', $INC_T.'/'.$id, null, ['fields'=>['Email Address'=>$to, 'Email Sent'=>$now->format('n/j/Y g:i A')], 'typecast'=>true]);
    echo json_encode(['ok'=>true]); exit;
  }
  if ($act === 'inc_update'){
    if (($f['Parent Signed At'] ?? '') !== '') fail('The parent already signed this report, so it can no longer be changed.');
    $map = ['desc'=>['Description', 340], 'body'=>['Body Parts', 100], 'loc'=>['Location', 100], 'nature'=>['Nature of Injury', 160], 'treat'=>['Medical Treatment', 160], 'action'=>['Action Taken', 160], 'contacted'=>['Parent Contacted', 3], 'ctime'=>['Contact Time', 20], 'chow'=>['Contact How', 80], 'time'=>['Incident Time', 20], 'notes'=>['Director Notes', 600]];
    $set = []; foreach ($map as $k => $m) if (array_key_exists($k, (array)($in['set'] ?? []))) $set[$m[0]] = nm($in['set'][$k], $m[1]);
    if (!$set) fail('Nothing to change.');
    /* an edit means the staff and director signatures no longer cover the new words */
    if (count(array_diff(array_keys($set), ['Director Notes']))) { $set['Director Signature'] = ''; $set['Director Signed At'] = ''; $set['Director Name'] = ''; $set['Status'] = 'Needs Director'; }
    $u = at('PATCH', $INC_T.'/'.$id, null, ['fields'=>$set, 'typecast'=>true]); if (empty($u['id'])) fail('Did not save.', 502); echo json_encode(['ok'=>true]); exit;
  }
  if ($act === 'inc_emailed'){
    $u = at('PATCH', $INC_T.'/'.$id, null, ['fields'=>['Email Sent'=>$now->format('n/j/Y g:i A')], 'typecast'=>true]); if (empty($u['id'])) fail('Did not save.', 502); echo json_encode(['ok'=>true]); exit;
  }
}

/* ---- Child photo and allergy card sent from a phone or tablet (11/17/26). Goes to the same private holding area as parent uploads (hive-vault/<school>/uploads/);
   a director checks it and files it in the child's Student File from Parent Uploads. Nothing is filed by staff. ---- */
$PH_T = ['face'=>'Child photo (face picture for the file)', 'allg'=>'Allergy / special needs care plan', 'medauth'=>'Medication authorization'];
if ($act === 'ph_kids'){ $o = []; foreach (roster(room_names((string)($in['r'] ?? ''))) as $k) $o[] = ['n'=>child_fl($k['n']), 'room'=>$k['room']]; echo json_encode(['ok'=>true,'kids'=>$o]); exit; }
if ($act === 'ph_send'){
  $who = nm($in['name'] ?? '', 60); if ($who === '') fail('Type your name.');
  $kind = (string)($in['kind'] ?? ''); if (!isset($PH_T[$kind])) fail('Pick what you are sending.');
  $c = child_fl($in['child'] ?? ''); $ok = []; foreach (roster(room_names((string)($in['r'] ?? ''))) as $k) $ok[strtolower(child_fl($k['n']))] = 1;
  if ($c === '' || !isset($ok[strtolower($c)])) fail('Pick the child from the list.');
  $raw = base64_decode((string)($in['b64'] ?? ''), true); if ($raw === false || strlen($raw) < 500) fail('Take the picture first.');
  if (strlen($raw) > 6 * 1024 * 1024) fail('That picture is too large. Take it again.');
  if (substr($raw, 0, 3) !== "\xFF\xD8\xFF") fail('The picture must be a JPG. Try taking it again.');
  $root = null; foreach ([dirname(__DIR__, 2).'/hive-vault', dirname(__DIR__).'/hive-vault'] as $cd){ if (!is_dir($cd)) @mkdir($cd, 0750, true); if (is_dir($cd) && is_writable($cd)){ $root = $cd; break; } }
  if (!$root) fail('The server could not save this. Tell the office.', 500);
  $sd = $root.'/'.preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($sd)) @mkdir($sd, 0750, true); $ud = $sd.'/uploads'; if (!is_dir($ud)) @mkdir($ud, 0750, true);
  if (!is_dir($ud) || !is_writable($ud)) fail('The server could not save this. Tell the office.', 500);
  $recent = 0; foreach (glob($ud.'/up*.json') ?: [] as $jf){ $x = json_decode(@file_get_contents($jf), true); if (is_array($x) && ($x['via'] ?? '') === 'staff' && strtotime((string)($x['at'] ?? '')) > time() - 3600) $recent++; }
  if ($recent >= 60) fail('That is a lot of pictures at once. Please wait a little while.', 429);
  $id = 'up'.substr(md5(uniqid('', true)), 0, 10);
  if (file_put_contents($ud.'/'.$id.'.jpg', $raw) === false) fail('Could not save the picture', 500);
  file_put_contents($ud.'/'.$id.'.json', json_encode(['id'=>$id, 'at'=>gmdate('c'), 'parent'=>'Staff: '.$who, 'child'=>$c, 'doc'=>$kind, 'other'=>'', 'file'=>$id.'.jpg', 'ext'=>'jpg', 'size'=>strlen($raw), 'orig'=>'phone-photo.jpg', 'status'=>'new', 'ip'=>md5(($_SERVER['REMOTE_ADDR'] ?? '').'hive'), 'via'=>'staff']), LOCK_EX);
  echo json_encode(['ok'=>true]); exit;
}

/* ---- Medication orders and doses (11/17/26). Office or director enters an order from the parent's signed form; a director approves it; the classroom records each dose and signs;
   the parent signs the day's doses at the Bear Line before sign-out; everything stays in Airtable (12 months or more). ---- */
$MO_T = 'Medication Orders'; $MD_T = 'Medication Doses';
function mo_row($r){ $f = $r['fields'] ?? []; return ['id'=>$r['id'], 'child'=>$f['Child'] ?? '', 'room'=>$f['Room'] ?? '', 'med'=>$f['Medication'] ?? '', 'dose'=>$f['Dose'] ?? '', 'how'=>$f['How Given'] ?? '', 'times'=>$f['Times'] ?? '', 'reason'=>$f['Reason'] ?? '', 'notes'=>$f['Notes'] ?? '', 'start'=>$f['Start Date'] ?? '', 'end'=>$f['End Date'] ?? '', 'auth'=>$f['Parent Authorized By'] ?? '', 'status'=>$f['Status'] ?? '', 'by'=>$f['Entered By'] ?? '', 'appBy'=>$f['Approved By'] ?? '', 'appAt'=>$f['Approved At'] ?? '']; }
function md_row($r, $full = false){ $f = $r['fields'] ?? []; $o = ['id'=>$r['id'], 'order'=>$f['Order'] ?? '', 'child'=>$f['Child'] ?? '', 'room'=>$f['Room'] ?? '', 'med'=>$f['Medication'] ?? '', 'dose'=>$f['Dose Given'] ?? '', 'date'=>$f['Date'] ?? '', 'time'=>$f['Time'] ?? '', 'by'=>$f['Given By'] ?? '', 'note'=>$f['Note'] ?? '', 'status'=>$f['Status'] ?? '', 'parent'=>$f['Parent Name'] ?? '', 'parentAt'=>$f['Parent Signed At'] ?? '']; if ($full){ $o['staffSig'] = $f['Staff Signature'] ?? ''; $o['parentSig'] = $f['Parent Signature'] ?? ''; } return $o; }
if ($act === 'med_list'){
  $dir = okdtok($sk, $in['dtok'] ?? ''); $slug = (string)($in['r'] ?? '');
  $keep = null; if ($slug !== ''){ $keep = []; foreach (roster(room_names($slug)) as $k) $keep[strtolower(child_fl($k['n']))] = 1; }
  $q = at('GET', $MO_T, ['maxRecords'=>300, 'filterByFormula'=>"AND({School}='".$school."',{Status}!='Stopped')"]); $os = [];
  foreach (($q['records'] ?? []) as $r){ $c = strtolower(child_fl($r['fields']['Child'] ?? '')); if ($keep !== null && !isset($keep[$c])) continue; $o = mo_row($r); if ($keep !== null && $o['status'] !== 'Active') continue; if ($keep !== null && (($o['start'] && $o['start'] > $today) || ($o['end'] && $o['end'] < $today))) continue; $os[] = $o; }
  $d = at('GET', $MD_T, ['maxRecords'=>400, 'filterByFormula'=>"AND({School}='".$school."',IS_SAME({Date},'$today','day'))"]); $ds = [];
  foreach (($d['records'] ?? []) as $r){ $c = strtolower(child_fl($r['fields']['Child'] ?? '')); if ($keep !== null && !isset($keep[$c])) continue; $ds[] = md_row($r); }
  echo json_encode(['ok'=>true, 'orders'=>$os, 'doses'=>$ds, 'dir'=>$dir]); exit;
}
if ($act === 'med_order_add'){
  $dir = okdtok($sk, $in['dtok'] ?? ''); $who = nm($in['name'] ?? '', 60); if ($who === '') fail('Type your name.');
  $c = child_fl($in['child'] ?? ''); $rk = null; foreach (roster(room_names('')) as $k){ if (strtolower(child_fl($k['n'])) === strtolower($c)) $rk = $k; }
  if ($c === '' || !$rk) fail('Pick the child from the list.');
  $med = nm($in['med'] ?? '', 100); $dose = nm($in['dose'] ?? '', 80); $how = nm($in['how'] ?? '', 80); $times = nm($in['times'] ?? '', 120); $reason = nm($in['reason'] ?? '', 120); $notes = nm($in['notes'] ?? '', 400); $auth = nm($in['auth'] ?? '', 80);
  if ($med === '' || $dose === '' || $times === '') fail('Type the medicine, the dose and when it is given.');
  if ($auth === '' || empty($in['form'])) fail('The parent must sign the medication form first. Type who signed it and tick that the form is on file.');
  $sd = (string)($in['start'] ?? $today); $ed = (string)($in['end'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $sd) || ($ed !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $ed))) fail('Check the dates.');
  $f = ['Order ID'=>strtoupper(substr($sk, 0, 1)).'-MED-'.date('ymdHis').rand(10, 99), 'School'=>$school, 'Child'=>$c, 'Room'=>$rk['room'], 'Medication'=>$med, 'Dose'=>$dose, 'How Given'=>$how, 'Times'=>$times, 'Reason'=>$reason, 'Notes'=>$notes, 'Start Date'=>$sd, 'Parent Authorized By'=>$auth, 'Form On File'=>true, 'Status'=>$dir ? 'Active' : 'Needs Director', 'Entered By'=>$who];
  if ($ed !== '') $f['End Date'] = $ed; if ($dir){ $f['Approved By'] = $who; $f['Approved At'] = $now->format('n/j/Y g:i A'); }
  $res = at('POST', $MO_T, null, ['records'=>[['fields'=>$f]], 'typecast'=>true]); if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502);
  echo json_encode(['ok'=>true, 'status'=>$f['Status']]); exit;
}
if ($act === 'med_order_decide'){
  if (!okdtok($sk, $in['dtok'] ?? '')) fail('Directors only. Sign in with your director code.', 403);
  $id = (string)($in['id'] ?? ''); if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad request');
  $r = at('GET', $MO_T.'/'.$id); if (($r['fields']['School'] ?? '') !== $school) fail('Not found', 404);
  $d = ($in['decision'] ?? '') === 'stop' ? 'Stopped' : 'Active'; $by = nm($in['name'] ?? 'Director', 60);
  $f = ['Status'=>$d]; if ($d === 'Active'){ $f['Approved By'] = $by; $f['Approved At'] = $now->format('n/j/Y g:i A'); }
  $u = at('PATCH', $MO_T.'/'.$id, null, ['fields'=>$f, 'typecast'=>true]); if (empty($u['id'])) fail('Did not save.', 502); echo json_encode(['ok'=>true]); exit;
}
if ($act === 'med_give'){
  $id = (string)($in['id'] ?? ''); if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad request');
  $who = nm($in['name'] ?? '', 60); $tm = nm($in['time'] ?? '', 20); $dose = nm($in['dose'] ?? '', 80); $note = nm($in['note'] ?? '', 160); $sig = (string)($in['sig'] ?? '');
  if ($who === '' || $tm === '' || $dose === '') fail('Type your name, the time and the dose given.'); if (!sigok($sig)) fail('Please sign in the box.');
  $r = at('GET', $MO_T.'/'.$id); $f = $r['fields'] ?? []; if (($f['School'] ?? '') !== $school || ($f['Status'] ?? '') !== 'Active') fail('That medicine is not active.');
  if (!empty($f['Start Date']) && $f['Start Date'] > $today) fail('This medicine has not started yet.'); if (!empty($f['End Date']) && $f['End Date'] < $today) fail('This medicine order has ended.');
  $ok = []; foreach (roster(room_names((string)($in['r'] ?? ''))) as $k) $ok[strtolower(child_fl($k['n']))] = $k; $c = child_fl($f['Child'] ?? ''); if (!isset($ok[strtolower($c)])) fail('This child is not in this room.');
  $res = at('POST', $MD_T, null, ['records'=>[['fields'=>['Dose ID'=>strtoupper(substr($sk, 0, 1)).'-DOSE-'.date('ymdHis').rand(10, 99), 'School'=>$school, 'Order'=>$f['Order ID'] ?? '', 'Child'=>$c, 'Room'=>$f['Room'] ?? '', 'Medication'=>$f['Medication'] ?? '', 'Dose Given'=>$dose, 'Date'=>$today, 'Time'=>$tm, 'Given By'=>$who, 'Staff Signature'=>$sig, 'Note'=>$note, 'Status'=>'Needs Parent']]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502); echo json_encode(['ok'=>true]); exit;
}
if ($act === 'med_history'){
  if (!okdtok($sk, $in['dtok'] ?? '')) fail('Directors only. Sign in with your director code.', 403);
  $c = child_fl($in['child'] ?? ''); if ($c === '') fail('Pick the child.');
  $since = date('Y-m-d', strtotime('-366 days'));
  $d = at('GET', $MD_T, ['maxRecords'=>400, 'filterByFormula'=>"AND({School}='".$school."',{Child}='".esc_q($c)."',IS_AFTER({Date},'$since'))", 'sort[0][field]'=>'Date', 'sort[0][direction]'=>'asc']); $ds = [];
  foreach (($d['records'] ?? []) as $r) $ds[] = md_row($r, true);
  echo json_encode(['ok'=>true, 'doses'=>$ds]); exit;
}

/* ---- Sanitizer log and monthly menu chart (11/17/26) ---- */
$SZ_T = 'Sanitizer Log'; $MN_T = 'Menu Chart';
$SZ_RANGE = ['Quat (quaternary ammonium)'=>[200, 400], 'Chlorine (bleach)'=>[50, 100]];
if ($act === 'san_add'){
  $who = nm($in['name'] ?? '', 60); $area = nm($in['area'] ?? '', 100); $type = (string)($in['type'] ?? ''); $tm = nm($in['time'] ?? '', 20);
  if ($who === '' || $area === '' || $tm === '') fail('Type your name, the time and where you tested.');
  if (!isset($SZ_RANGE[$type]) && $type !== 'Other') fail('Pick the sanitizer.');
  if (!isset($in['ppm']) || !is_numeric($in['ppm']) || $in['ppm'] < 0 || $in['ppm'] > 5000) fail('Type the number from the test strip.');
  $ppm = (int)$in['ppm']; $act2 = nm($in['action'] ?? '', 160); $rng = ''; $okr = true;
  if (isset($SZ_RANGE[$type])){ $rng = $SZ_RANGE[$type][0].' to '.$SZ_RANGE[$type][1].' ppm'; $okr = $ppm >= $SZ_RANGE[$type][0] && $ppm <= $SZ_RANGE[$type][1]; }
  else { $rng = nm($in['range'] ?? '', 40); $okr = !empty($in['inrange']); }
  if (!$okr && $act2 === '') fail('The reading is outside the safe range. Write what you did (remix, remake, test again).');
  $res = at('POST', $SZ_T, null, ['records'=>[['fields'=>['Log ID'=>strtoupper(substr($sk, 0, 1)).'-SAN-'.date('ymdHis').rand(10, 99), 'School'=>$school, 'Date'=>$today, 'Time'=>$tm, 'Area'=>$area, 'Sanitizer'=>$type, 'Reading ppm'=>$ppm, 'Target Range'=>$rng, 'In Range'=>$okr, 'Action Taken'=>$act2, 'Logged By'=>$who]]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502); echo json_encode(['ok'=>true, 'inrange'=>$okr]); exit;
}
if ($act === 'san_list'){
  $since = date('Y-m-d', strtotime('-32 days'));
  $q = at('GET', $SZ_T, ['maxRecords'=>300, 'filterByFormula'=>"AND({School}='".$school."',IS_AFTER({Date},'$since'))", 'sort[0][field]'=>'Date', 'sort[0][direction]'=>'desc']); $o = [];
  foreach (($q['records'] ?? []) as $r){ $f = $r['fields']; $o[] = ['date'=>$f['Date'] ?? '', 'time'=>$f['Time'] ?? '', 'area'=>$f['Area'] ?? '', 'type'=>$f['Sanitizer'] ?? '', 'ppm'=>$f['Reading ppm'] ?? '', 'range'=>$f['Target Range'] ?? '', 'ok'=>!empty($f['In Range']), 'action'=>$f['Action Taken'] ?? '', 'by'=>$f['Logged By'] ?? '']; }
  echo json_encode(['ok'=>true, 'list'=>$o, 'ranges'=>$SZ_RANGE]); exit;
}
if ($act === 'menu_get'){
  $m = (string)($in['month'] ?? $now->format('Y-m')); if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Bad month');
  $a = date('Y-m-d', strtotime($m.'-01 -1 day')); $b = date('Y-m-d', strtotime($m.'-01 +1 month'));
  $q = at('GET', $MN_T, ['maxRecords'=>100, 'filterByFormula'=>"AND({School}='".$school."',IS_AFTER({Date},'$a'),IS_BEFORE({Date},'$b'))"]); $o = [];
  foreach (($q['records'] ?? []) as $r){ $f = $r['fields']; $o[$f['Date'] ?? ''] = ['b'=>$f['Breakfast'] ?? '', 'l'=>$f['Lunch'] ?? '', 's'=>$f['Snack'] ?? '', 'served'=>!empty($f['Served As Planned']), 'chg'=>$f['Changes'] ?? '', 'by'=>$f['Entered By'] ?? '']; }
  echo json_encode(['ok'=>true, 'month'=>$m, 'days'=>(object)$o]); exit;
}
if ($act === 'menu_save'){
  $m = (string)($in['month'] ?? ''); if (!preg_match('/^\d{4}-\d{2}$/', $m)) fail('Bad month'); $who = nm($in['name'] ?? '', 60); if ($who === '') fail('Type your name.');
  $recs = []; foreach ((array)($in['days'] ?? []) as $d){ $dt = (string)($d['date'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dt) || substr($dt, 0, 7) !== $m) continue;
    $b = nm($d['b'] ?? '', 120); $l = nm($d['l'] ?? '', 160); $s = nm($d['s'] ?? '', 120); $chg = nm($d['chg'] ?? '', 160); $sv = !empty($d['served']);
    if ($b === '' && $l === '' && $s === '' && !$sv && $chg === '') continue;
    $recs[] = ['fields'=>['Key'=>$school.'|'.$dt, 'School'=>$school, 'Date'=>$dt, 'Breakfast'=>$b, 'Lunch'=>$l, 'Snack'=>$s, 'Served As Planned'=>$sv, 'Changes'=>$chg, 'Entered By'=>$who]]; }
  if (!$recs) fail('Nothing to save yet.'); if (count($recs) > 40) fail('Too many days.');
  foreach (array_chunk($recs, 10) as $ch){ $u = at('PATCH', $MN_T, null, ['performUpsert'=>['fieldsToMergeOn'=>['Key']], 'records'=>$ch, 'typecast'=>true]); if (empty($u['records'])) fail('Did not save. Try again.', 502); }
  echo json_encode(['ok'=>true, 'n'=>count($recs)]); exit;
}

/* ---- Child observations (11/17/26) ---- */
if ($act === 'obs_add'){
  $who = nm($in['name'] ?? '', 60); $kid = nm($in['child'] ?? '', 80); $dom = nm($in['domain'] ?? '', 40); $ob = nm($in['obs'] ?? '', 600); $nx = nm($in['next'] ?? '', 200); $room = nm($in['room'] ?? '', 60);
  if ($who === '' || $kid === '') fail('Type your name and pick the child.'); if ($ob === '') fail('Write what you saw.');
  $res = at('POST', 'Child Observations', null, ['records'=>[['fields'=>['Obs ID'=>strtoupper(substr($sk, 0, 1)).'-OBS-'.date('ymdHis').rand(10, 99), 'School'=>$school, 'Date'=>$today, 'Room'=>$room, 'Child'=>$kid, 'Domain'=>$dom, 'Observation'=>$ob, 'Next Step'=>$nx, 'Observed By'=>$who]]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save. Try again.', 502); echo json_encode(['ok'=>true]); exit;
}
if ($act === 'obs_list'){
  $kid = nm($in['child'] ?? '', 80); $since = date('Y-m-d', strtotime('-120 days'));
  $f = "AND({School}='".$school."',IS_AFTER({Date},'$since')"; if ($kid !== '') $f .= ",{Child}='".str_replace("'", "\\'", $kid)."'"; $f .= ')';
  $q = at('GET', 'Child Observations', ['maxRecords'=>200, 'filterByFormula'=>$f, 'sort[0][field]'=>'Date', 'sort[0][direction]'=>'desc']); $o = [];
  foreach (($q['records'] ?? []) as $r){ $x = $r['fields']; $o[] = ['date'=>$x['Date'] ?? '', 'child'=>$x['Child'] ?? '', 'domain'=>$x['Domain'] ?? '', 'obs'=>$x['Observation'] ?? '', 'next'=>$x['Next Step'] ?? '', 'by'=>$x['Observed By'] ?? '']; }
  echo json_encode(['ok'=>true, 'list'=>$o]); exit;
}

fail('Unknown action');
