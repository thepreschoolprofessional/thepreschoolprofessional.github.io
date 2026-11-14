<?php
/* THE HIVE — Weekly time sheets and bi-weekly staff pay API, built 11/12/26.
FILING (from the Bear Line, code protected): after staff confirm+sign and the director signs off the week, the Bear Line sends each staff
member's signed sheet (PNG) plus the week's numbers. The PNG is filed in that person's Staff File (doc "pay") and the numbers are stored
for the payroll report. REPORT (directors, own school only): pay_list / pay_anchor. Everything is stored OUTSIDE public_html in hive-vault. */
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
date_default_timezone_set('America/New_York');
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
function jread($f, $def){ return is_file($f) ? (json_decode(file_get_contents($f), true) ?: $def) : $def; }
function jwrite($f, $v){ return file_put_contents($f, json_encode($v), LOCK_EX); }
function school_dir($school){ $r = vault_root(); if (!$r) fail('The private vault is not available.', 500); $d = $r.'/'.preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($d)) @mkdir($d, 0750, true); return $d; }
function name_first($s){
  $s = strtolower(preg_replace('/\([^)]*\)/', '', (string)$s));
  $s = preg_replace('/\b(ms|mrs|mr|miss|dr)\b\.?/', ' ', $s);
  if (!preg_match_all("/[a-z']+/", $s, $m)) return '';
  return str_replace("'", '', $m[0][0] ?? '');
}
function roster_staff($school){
  $sc = str_replace("'", '', $school); $out = []; $off = null; $g = 0;
  do {
    $q = ['filterByFormula'=>"AND({School}='$sc',{Active})", 'pageSize'=>100]; if ($off) $q['offset'] = $off;
    $r = at_get('Staff Roster', $q);
    foreach (($r['records'] ?? []) as $x){ $f = $x['fields']; $n = trim($f['Name'] ?? ''); if ($n === '') continue;
      $out[] = ['id'=>$x['id'], 'name'=>$n, 'role'=>$f['Role'] ?? '', 'hrs'=>isset($f['Weekly Scheduled Hours']) ? (float)$f['Weekly Scheduled Hours'] : null]; }
    $off = $r['offset'] ?? null;
  } while ($off && ++$g < 5);
  return $out;
}
function match_staff($school, $name){
  $f = name_first($name); if ($f === '') return null; $hit = null;
  foreach (roster_staff($school) as $p){ if (name_first($p['name']) === $f){ if ($hit) return null; $hit = $p; } }
  return $hit;
}
if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) fail('Bad request');
$action = $input['action'] ?? '';

/* ---- Filing from the Bear Line (server to server, protected by the shared ELC sync code) ---- */
if ($action === 'ts_file'){
  foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
  if (!defined('ELC_SYNC_CODE') || !hash_equals(ELC_SYNC_CODE, (string)($input['code'] ?? ''))) fail('Not allowed.', 403);
  $school = (($input['school'] ?? '') === 'sanford') ? 'Sanford' : ((($input['school'] ?? '') === 'deland') ? 'DeLand 2' : '');
  if ($school === '') fail('Bad school.');
  $week = (string)($input['week'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $week) || date('N', strtotime($week)) != 1) fail('Bad week.');
  $sid = preg_replace('/[^a-z0-9]/', '', strtolower((string)($input['sid'] ?? ''))); if ($sid === '') fail('Bad staff.');
  $name = trim(strip_tags((string)($input['name'] ?? ''))); $name = mb_substr($name, 0, 80);
  $png = base64_decode((string)($input['png'] ?? ''), true);
  if ($png === false || substr($png, 0, 8) !== "\x89PNG\r\n\x1a\n" || strlen($png) > 3 * 1024 * 1024) fail('Bad picture.');
  $r = $input['rec'] ?? null; if (!is_array($r) || !isset($r['days']) || !is_array($r['days'])) fail('Bad record.');
  $days = [];
  foreach (array_slice($r['days'], 0, 7) as $x){
    if (!is_array($x) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($x['k'] ?? ''))) continue;
    $t = function($v){ $v = (string)$v; return preg_match('/^\d{2}:\d{2}$/', $v) ? $v : ''; };
    $days[] = ['k'=>$x['k'], 'in'=>$t($x['in'] ?? ''), 'lo'=>$t($x['lo'] ?? ''), 'li'=>$t($x['li'] ?? ''), 'out'=>$t($x['out'] ?? ''), 'off'=>mb_substr(trim(strip_tags((string)($x['off'] ?? ''))), 0, 20), 'oh'=>round(max(0, min(24, (float)($x['oh'] ?? 0))), 2), 'h'=>isset($x['h']) && $x['h'] !== null ? round((float)$x['h'], 2) : null];
  }
  $row = ['name'=>$name, 'days'=>$days, 'total'=>round((float)($r['total'] ?? 0), 2), 'staffAt'=>mb_substr((string)($r['staffAt'] ?? ''), 0, 40), 'waived'=>!empty($r['waived']),
          'dirName'=>mb_substr(trim(strip_tags((string)($r['dirName'] ?? ''))), 0, 60), 'dirAt'=>mb_substr((string)($r['dirAt'] ?? ''), 0, 40), 'filedAt'=>gmdate('c')];
  $sd = school_dir($school); $pd = $sd.'/payroll'; if (!is_dir($pd)) @mkdir($pd, 0750, true);
  $pf = $pd.'/'.$week.'.json'; $P = jread($pf, ['week'=>$week, 'staff'=>new stdClass]); if (!is_array($P['staff'])) $P['staff'] = [];
  $P['staff'][$sid] = $row; if (!jwrite($pf, $P)) fail('Could not save the payroll record.', 500);
  $filed = null;
  $p = match_staff($school, $name);
  if ($p){
    $d = $sd.'/people/staff/'.$p['id']; if (!is_dir($d) && !@mkdir($d, 0750, true)) fail('Could not open the staff file.', 500);
    $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]); if (!isset($meta['files']) || !is_array($meta['files'])) $meta['files'] = [];
    $keep = [];
    foreach ($meta['files'] as $f){ if (($f['doc'] ?? '') === 'pay' && ($f['week'] ?? '') === $week){ @unlink($d.'/'.basename((string)$f['name'])); } else $keep[] = $f; }
    $fname = date('Ymd-His').'_pay_p1_Timesheet-'.$week.'.png';
    if (file_put_contents($d.'/'.$fname, $png) === false) fail('Could not file the sheet.', 500);
    $keep[] = ['doc'=>'pay', 'name'=>$fname, 'at'=>gmdate('c'), 'size'=>strlen($png), 'week'=>$week];
    $meta['files'] = $keep; jwrite($mf, $meta); $filed = $p['name'];
  }
  echo json_encode(['ok'=>true, 'filedTo'=>$filed, 'matched'=>$filed !== null]); exit;
}

/* ---- Director report ---- */
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail("That PIN isn't right.", 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('Staff pay is only available to directors and the owner.', 403);
$school = $ROLE_SCHOOL[$role];
if ($action === 'whoami'){ echo json_encode(['school'=>$school]); exit; }
$sd = school_dir($school); $pd = $sd.'/payroll'; if (!is_dir($pd)) @mkdir($pd, 0750, true);
$setf = $pd.'/_settings.json'; $set = jread($setf, ['anchor'=>'2026-11-02']);
if ($action === 'pay_anchor'){
  $a = (string)($input['anchor'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $a) || date('N', strtotime($a)) != 1) fail('Pick a Monday.');
  $set['anchor'] = $a; jwrite($setf, $set); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'pay_live'){
  $wk = []; foreach ((array)($input['weeks'] ?? []) as $w){ if (is_string($w) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $w) && date('N', strtotime($w)) == 1) $wk[] = $w; }
  $wk = array_slice(array_values(array_unique($wk)), 0, 4);
  foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
  if (!defined('ELC_SYNC_CODE')) fail('Bear Line is not connected from here yet.', 503);
  $bl = ($school === 'Sanford') ? 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php' : 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php';
  $ctx = stream_context_create(['http'=>['method'=>'POST', 'header'=>"Content-Type: application/json\r\n", 'content'=>json_encode(['action'=>'hive_pay_weeks', 'code'=>ELC_SYNC_CODE, 'weeks'=>$wk]), 'timeout'=>25, 'ignore_errors'=>true]]);
  $j = json_decode((string)@file_get_contents($bl, false, $ctx), true);
  if (!is_array($j) || empty($j['ok'])) fail('Could not read the Bear Line time clock right now.', 502);
  $today = date('Y-m-d');
  $hm = function($s){ return preg_match('/^(\d{1,2}):(\d{2})$/', (string)$s, $m) ? ((int)$m[1] * 60 + (int)$m[2]) : null; };
  $names = []; foreach ((array)($j['staff'] ?? []) as $s){ if (is_array($s) && ($s[0] ?? '') !== '') $names[] = (string)$s[0]; }
  $out = [];
  foreach ((array)($j['weeks'] ?? []) as $w => $W){
    $days = (array)($W['days'] ?? []); $log = (array)($W['log'] ?? []); $ts = (array)($W['ts'] ?? []);
    $sids = array_unique(array_merge(array_keys($log), array_keys($ts))); $staff = [];
    foreach ($sids as $sid){
      $snap = []; $total = 0; $pto = 0; $offs = []; $probs = []; $has = false;
      foreach ($days as $k){
        $d = $log[$sid][$k] ?? null; $m = [];
        foreach ((array)($d['punches'] ?? []) as $p){ $m[$p['type'] ?? ''] = $p['at'] ?? ''; }
        $in = $m['in'] ?? ''; $lo = $m['lunchOut'] ?? ''; $li = $m['lunchIn'] ?? ''; $ot = $m['out'] ?? '';
        $offT = (string)($d['off']['type'] ?? ''); $oh = ($offT !== '' && $offT !== 'Day off' && (float)($d['off']['hrs'] ?? 0) > 0) ? (float)$d['off']['hrs'] : 0;
        $dh = null; if ($in !== '' && $ot !== '' && $hm($in) !== null && $hm($ot) !== null){ $t = $hm($ot) - $hm($in); if ($lo !== '' && $li !== '' && $hm($lo) !== null && $hm($li) !== null) $t -= ($hm($li) - $hm($lo)); $dh = $t / 60; }
        $h = ($dh === null && !$oh) ? null : (($dh ?? 0) + $oh);
        if ($h !== null) $total += $h; $pto += $oh;
        if ($offT !== ''){ $offs[$offT] = ($offs[$offT] ?? 0) + 1; $has = true; }
        $np = count((array)($d['punches'] ?? []));
        if ($np){ $has = true; $dl = date('D n/j', strtotime($k));
          if ($in === '') $probs[] = $dl.': no clock-in';
          if ($lo !== '' && $li === '') $probs[] = $dl.": didn't clock back in from lunch";
          if ($li !== '' && $lo === '') $probs[] = $dl.': no lunch clock-out';
          if ($ot === '') $probs[] = $dl.($k < $today ? ': no clock-out' : ': still clocked in'); }
        $snap[] = implode('~', [$k, $in, $lo, $li, $ot, $offT, (string)(0 + $oh)]);
      }
      $r = $ts[$sid] ?? null;
      if (!$has && !$r) continue;
      $status = 'none'; if ($r){ $status = ($r['fp'] ?? '') === implode('^', $snap) ? (!empty($r['waived']) ? 'waived' : 'signed') : 'changed'; }
      $nm = ''; foreach ($names as $n){ if (name_first($n) === name_first($sid)){ $nm = $n; break; } }
      if ($nm === '') $nm = ($r && ($r['name'] ?? '') !== '') ? $r['name'] : ucfirst($sid);
      $staff[$sid] = ['name'=>$nm, 'total'=>round($total, 2), 'pto'=>round($pto, 2), 'offs'=>$offs, 'status'=>$status, 'signedAt'=>$r['at'] ?? '', 'probs'=>$probs];
    }
    $out[$w] = ['signoff'=>$W['signoff'] ?? null, 'staff'=>(object)$staff];
  }
  echo json_encode(['school'=>$school, 'today'=>$today, 'weeks'=>(object)$out]); exit;
}
if ($action !== 'pay_list') fail('Unknown action');
$weeks = [];
foreach (glob($pd.'/20??-??-??.json') ?: [] as $f){ $x = json_decode(file_get_contents($f), true); if (is_array($x) && !empty($x['week'])) $weeks[$x['week']] = $x['staff']; }
krsort($weeks); $weeks = array_slice($weeks, 0, 30, true);
$rs = roster_staff($school); $ros = []; $byFirst = [];
foreach ($rs as $p){ $ros[] = ['name'=>$p['name'], 'role'=>$p['role'], 'hrs'=>$p['hrs']]; $f = name_first($p['name']); $byFirst[$f] = isset($byFirst[$f]) ? false : $p['name']; }
foreach ($weeks as $wk => $rows){ foreach ($rows as $sid => $row){ $f = name_first($row['name'] ?? ''); $weeks[$wk][$sid]['full'] = (!empty($byFirst[$f])) ? $byFirst[$f] : ($row['name'] ?? ''); } }
echo json_encode(['school'=>$school, 'anchor'=>$set['anchor'], 'weeks'=>(object)$weeks, 'roster'=>$ros]);
