<?php
/* THE HIVE: Bear Line staff punches -> Sign-In Log (built 11/18/26).
Staff clock in on the Bear Line, so ProCare no longer has staff punches. This copies the Bear Line time clock
(clock in, lunch out, lunch in, clock out) for both schools into the Airtable Sign-In Log, one row per staff per day,
so the Buzz Board, the Director Portal sign-in list and the staff-hours checks can read it.
It also ticks the Buzz Board clock dots (teacher and director boards) for staff who punched. It only ticks, never unticks.
Times only. Never pay. Anyone may call it (it only refreshes), at most once every 5 minutes per school and day.
Call: /hive/bearline-staff-sync.php            -> today, both schools
      /hive/bearline-staff-sync.php?date=YYYY-MM-DD -> that day (up to 21 days back), both schools
Answer: counts only, never names or times. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
date_default_timezone_set('America/New_York');
function out($a, $c = 200){ http_response_code($c); echo json_encode($a); exit; }

$tok = ''; $code = '';
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d){
  if (!$tok && file_exists($d.'/hive-token.php')){ include_once $d.'/hive-token.php'; if (defined('HIVE_TOKEN') && HIVE_TOKEN !== 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') $tok = HIVE_TOKEN; }
  if (!$code && file_exists($d.'/elc-sync-code.php')){ include_once $d.'/elc-sync-code.php'; if (defined('ELC_SYNC_CODE')) $code = ELC_SYNC_CODE; }
}
if (!$tok || !$code) out(['ok'=>false, 'error'=>'not_configured'], 503);

$BASE = 'app2HNkUSJqx9IkYZ';
$LOG = 'tbltkKmph5KOE2t31';      // Sign-In Log
$ROSTER = 'tblvlUwVFpfjYCYne';   // Staff Roster
$BL = ['Sanford' => 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php',
       'DeLand 2' => 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php'];

$today = date('Y-m-d');
$date = (string)($_GET['date'] ?? $_POST['date'] ?? $today);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today || $date < date('Y-m-d', strtotime('-21 days'))) out(['ok'=>false, 'error'=>'bad_date'], 400);
$monday = date('Y-m-d', strtotime($date.' -'.(date('N', strtotime($date)) - 1).' days'));

function at($method, $path, $body = null){
  global $tok, $BASE;
  $ch = curl_init('https://api.airtable.com/v0/'.$BASE.'/'.$path);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CUSTOMREQUEST=>$method, CURLOPT_TIMEOUT=>20,
    CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$tok, 'Content-Type: application/json']]);
  if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
  $r = curl_exec($ch); $c = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return [$c, json_decode((string)$r, true)];
}
function q($s){ return str_replace(["\\", "'"], ["\\\\", "\\'"], (string)$s); }
function first_name($s){
  $s = strtolower(preg_replace('/\([^)]*\)/', '', (string)$s));
  $s = preg_replace('/\b(ms|mrs|mr|miss|dr)\b\.?/', ' ', $s);
  if (!preg_match_all("/[a-z']+/", $s, $m)) return '';
  $k = str_replace("'", '', $m[0][0] ?? ''); $al = ['honey'=>'madhumita', 'sheena'=>'sanchita']; return $al[$k] ?? $k;
}
function mins($s){ return preg_match('/^(\d{1,2}):(\d{2})/', (string)$s, $m) ? ((int)$m[1] * 60 + (int)$m[2]) : null; }
function ampm($s){ $m = mins($s); if ($m === null) return ''; $h = intdiv($m, 60); $i = $m % 60; return sprintf('%d:%02d %s', ($h % 12) ?: 12, $i, $h < 12 ? 'AM' : 'PM'); }
/* One day's punches -> what the Sign-In Log shows. Staff can punch the same button more than once
   (back from an errand, a second shift, a mis-tap), so punches are put in time order and worked as segments:
   in / lunch in start time on the floor, lunch out / out end it. Hours = sum of closed segments (never negative).
   Clock In = first in. Lunch Out / Lunch In = first lunch out after it and the lunch in after that.
   Clock Out = last out, shown only when the day ends on an out (otherwise she is still on, or the punch is stuck). */
function parse_day($punches){
  $ps = [];
  foreach ((array)$punches as $x){ if (!is_array($x)) continue; $m = mins($x['at'] ?? ''); $t = (string)($x['type'] ?? '');
    if ($m === null || !in_array($t, ['in','lunchOut','lunchIn','out'], true)) continue; $ps[] = [$m, $t, (string)$x['at']]; }
  usort($ps, function($a, $b){ return $a[0] <=> $b[0]; });
  $r = ['in'=>'', 'lo'=>'', 'li'=>'', 'out'=>'', 'hours'=>null, 'last'=>'', 'n'=>count($ps)];
  $start = null; $tot = 0; $closed = false;
  foreach ($ps as $p){ list($m, $t, $at) = $p;
    if ($t === 'in' && $r['in'] === '') $r['in'] = $at;
    if ($t === 'lunchOut' && $r['in'] !== '' && $r['lo'] === '') $r['lo'] = $at;
    if ($t === 'lunchIn' && $r['lo'] !== '' && $r['li'] === '') $r['li'] = $at;
    if ($t === 'in' || $t === 'lunchIn'){ if ($start === null) $start = $m; }
    else { if ($start !== null){ $tot += max(0, $m - $start); $closed = true; } $start = null; }
    $r['last'] = $t;
  }
  if ($r['last'] === 'out'){ for ($i = count($ps) - 1; $i >= 0; $i--){ if ($ps[$i][1] === 'out'){ $r['out'] = $ps[$i][2]; break; } } }
  if ($closed) $r['hours'] = round($tot / 60, 2);
  return $r;
}
function roster($school){
  global $ROSTER; $list = []; $off = null; $g = 0;
  do {
    $p = $ROSTER.'?pageSize=100&filterByFormula='.rawurlencode("AND({School}='".q($school)."',{Active})").($off ? '&offset='.rawurlencode($off) : '');
    list($c, $r) = at('GET', $p); if ($c !== 200) break;
    foreach (($r['records'] ?? []) as $x){ $n = trim((string)($x['fields']['Name'] ?? '')); if ($n !== '') $list[] = $n; }
    $off = $r['offset'] ?? null;
  } while ($off && ++$g < 5);
  return $list;
}

$result = ['ok'=>true, 'date'=>$date, 'schools'=>[]];
foreach ($BL as $school => $url){
  $s = ['created'=>0, 'updated'=>0, 'unchanged'=>0, 'errors'=>0];
  $lock = sys_get_temp_dir().'/hive_bl_staff_'.md5($school.$date);
  if (file_exists($lock) && time() - filemtime($lock) < 300){ $s['skipped'] = 'synced_recently'; $result['schools'][$school] = $s; continue; }
  touch($lock);

  $ctx = stream_context_create(['http'=>['method'=>'POST', 'header'=>"Content-Type: application/json\r\n",
    'content'=>json_encode(['action'=>'hive_pay_weeks', 'code'=>$code, 'weeks'=>[$monday]]), 'timeout'=>25, 'ignore_errors'=>true]]);
  $j = json_decode((string)@file_get_contents($url, false, $ctx), true);
  if (!is_array($j) || empty($j['ok'])){ @unlink($lock); $s['error'] = 'bearline_unreachable'; $result['ok'] = false; $result['schools'][$school] = $s; continue; }

  $W = (array)($j['weeks'][$monday] ?? []);
  $days = (array)($W['days'] ?? []); $log = (array)($W['log'] ?? []);
  $blNames = []; foreach ((array)($j['staff'] ?? []) as $x){ if (is_array($x) && ($x[0] ?? '') !== '') $blNames[] = (string)$x[0]; }
  $ros = roster($school); $byFirst = [];
  foreach ($ros as $n){ $f = first_name($n); $byFirst[$f] = isset($byFirst[$f]) ? false : $n; }

  // today's Buzz Board rows for this school (teacher + director), matched later by first name
  $boards = [];
  foreach (['tblf8m2qk4BO8gZnI'=>'Staff', 'tblV4Zd56fy8CNLpI'=>'Director'] as $tb => $nf){
    list($cb, $rb) = at('GET', $tb.'?pageSize=100&filterByFormula='.rawurlencode("AND({School}='".q($school)."',DATESTR({Date})='".$date."')"));
    if ($cb !== 200) continue;
    foreach (($rb['records'] ?? []) as $x){ $boards[] = ['tb'=>$tb, 'id'=>$x['id'], 'first'=>first_name($x['fields'][$nf] ?? ''), 'f'=>$x['fields']]; }
  }
  $s['board_ticked'] = 0;

  foreach ($log as $sid => $byDay){
    $d = $byDay[$date] ?? null; if (!is_array($d) || empty($d['punches'])) continue;
    $P = parse_day($d['punches']);
    $in = $P['in']; $lo = $P['lo']; $li = $P['li']; $ot = $P['out'];
    // staff name: roster full name when the first name is unique at this school, else the Bear Line name
    $f = first_name($sid); $nm = '';
    foreach ($blNames as $n){ if (first_name($n) === $f){ $nm = $n; break; } }
    if (!empty($byFirst[$f])) $nm = $byFirst[$f];
    if ($nm === '') $nm = ucwords((string)$sid);
    // hours this week up to and including this day
    $week = 0.0;
    foreach ($days as $k){ if ($k > $date) continue;
      $h = parse_day($byDay[$k]['punches'] ?? [])['hours']; if ($h !== null) $week += $h; }
    $hToday = $P['hours'];
    if ($in === '') $flag = '🚨 No clock-in';
    elseif ($ot !== '') $flag = '🏁 Done for the day';
    elseif ($date < $today) $flag = '⚠️ Stuck punch';
    else $flag = '✅ On the floor';
    $fields = ['Staff'=>$nm, 'School'=>$school, 'Date'=>$date,
      'Clock In'=>ampm($in), 'Lunch Out'=>ampm($lo), 'Lunch In'=>ampm($li), 'Clock Out'=>ampm($ot),
      'Hours This Week'=>round($week, 2), 'Flag'=>$flag, 'As Of'=>'Bear Line sync '.date('g:i A')];
    $fields['Hours Today'] = $hToday;   // null clears an old wrong number

    $flt = "AND({Staff}='".q($nm)."',{School}='".q($school)."',DATESTR({Date})='".$date."')";
    list($c, $r) = at('GET', $LOG.'?maxRecords=1&filterByFormula='.rawurlencode($flt));
    if ($c !== 200){ $s['errors']++; continue; }
    $rec = $r['records'][0] ?? null;
    if ($rec){
      $cur = $rec['fields']; $same = true;
      foreach (['Clock In','Lunch Out','Lunch In','Clock Out','Flag'] as $k){ $cv = $cur[$k] ?? ''; if (is_array($cv)) $cv = $cv['name'] ?? ''; if ((string)$cv !== (string)$fields[$k]) $same = false; }
      $ch = $cur['Hours Today'] ?? null; if (($ch === null) !== ($hToday === null) || ($ch !== null && abs((float)$ch - (float)$hToday) > 0.005)) $same = false;
      if ($same){ $s['unchanged']++; }
      else {
        unset($fields['Staff'], $fields['School'], $fields['Date']);
        list($c2,) = at('PATCH', $LOG.'/'.$rec['id'], ['fields'=>$fields, 'typecast'=>true]);
        if ($c2 === 200) $s['updated']++; else $s['errors']++;
      }
    } else {
      list($c3,) = at('POST', $LOG, ['fields'=>$fields, 'typecast'=>true]);
      if ($c3 === 200) $s['created']++; else $s['errors']++;
    }
    // Buzz Board dots
    $f1 = first_name($nm);
    foreach ($boards as $b){
      if ($b['first'] !== $f1 && $b['first'] !== $f) continue;
      $want = [];
      if ($b['tb'] === 'tblf8m2qk4BO8gZnI'){
        if ($in !== '') $want['Clock In'] = true;
        if ($lo !== '') $want['Lunch Out'] = true;
        if ($li !== '') $want['Lunch In'] = true;
        if ($ot !== '') $want['Clock Out'] = true;
        if ($in !== '' && $ot !== '' && $lo === '' && $li === '' && $hToday !== null && $hToday < 6) $want['No Lunch'] = true;
      } else {
        if ($in !== '') $want['Clock In'] = true;
        if ($ot !== '') $want['Clock Out'] = true;
      }
      foreach ($want as $k => $v){ if (!empty($b['f'][$k])) unset($want[$k]); }
      if (!$want) continue;
      list($c4,) = at('PATCH', $b['tb'].'/'.$b['id'], ['fields'=>$want]);
      if ($c4 === 200) $s['board_ticked']++; else $s['errors']++;
    }
  }
  if ($s['errors']) $result['ok'] = false;
  $result['schools'][$school] = $s;
}
out($result);
