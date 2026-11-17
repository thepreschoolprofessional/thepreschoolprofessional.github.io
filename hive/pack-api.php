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
fail('Unknown action');
