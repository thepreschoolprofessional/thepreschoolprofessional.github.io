<?php
/* THE HIVE — Cleaning chart pass API (11/13/26). NO staff PIN: a 30-minute pass minted by Bear Line (signed, school-locked) opens ONLY the cleaning/inspection forms.
Can do exactly three things: list checklist items for one allowed form, save a Facility Submission for the pass's own school, list today's submissions for that school.
Nothing else in the Hive is reachable from here. Incident reports are NOT included (those stay behind the teacher PIN). */
$__t = '';
foreach ([dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'] as $__f){
  if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN')){ $__t = HIVE_TOKEN; break; } }
}
define('AT_TOKEN', $__t);
define('BASE_ID', 'app2HNkUSJqx9IkYZ');
header('Content-Type: application/json; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
function at($method, $table, $query = null, $body = null){
  $url = 'https://api.airtable.com/v0/'.BASE_ID.'/'.rawurlencode($table).($query ? '?'.http_build_query($query) : '');
  $o = ['http'=>['method'=>$method, 'header'=>"Authorization: Bearer ".AT_TOKEN."\r\nContent-Type: application/json\r\n", 'ignore_errors'=>true, 'timeout'=>25]];
  if ($body !== null) $o['http']['content'] = json_encode($body);
  return json_decode(@file_get_contents($url, false, stream_context_create($o)) ?: '', true);
}
$ROOMS = ['Infant Room','Ones','Twos','Threes','Fours / VPK','School Age','Kitchen','Playground','Whole Building / Common Areas'];
$FORMS = ['🚽 Bathroom Cleaning','🧹 Classroom Cleaning','🏠 Indoor Inspection','🛝 Outdoor / Playground Inspection','🧼 Sanitation & Safety','🌙 End of Day Building Sweep'];
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) fail('Bad request');
$pass = (string)($in['pass'] ?? ''); $action = (string)($in['action'] ?? '');
// Which school's Bear Line signed this pass? (read the payload, then let THAT Bear Line check the signature)
$pp = explode('.', $pass, 2); $pl = json_decode(base64_decode(strtr($pp[0] ?? '', '-_', '+/')), true);
$school = (is_array($pl) && in_array($pl['school'] ?? '', ['Sanford','DeLand 2'], true)) ? $pl['school'] : '';
if ($school === '') fail('This link is not valid. Go back to the Bear Line clock screen and tap the cleaning chart button again.', 403);
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
if (!defined('ELC_SYNC_CODE') || AT_TOKEN === '') fail('Not connected yet.', 503);
$bl = $school === 'Sanford' ? 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php' : 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php';
$ctx = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode(['action'=>'clean_verify','code'=>ELC_SYNC_CODE,'pass'=>$pass]),'timeout'=>20,'ignore_errors'=>true]]);
$v = json_decode(@file_get_contents($bl, false, $ctx) ?: '', true);
if (!is_array($v) || empty($v['ok'])) fail('This link has timed out (they last 30 minutes). Go back to the Bear Line clock screen and tap the cleaning chart button again.', 403);

if ($action === 'whoami'){ echo json_encode(['ok'=>true,'name'=>$v['name'],'school'=>$school,'rooms'=>$ROOMS,'forms'=>$FORMS]); exit; }

if ($action === 'items'){
  $form = (string)($in['form'] ?? ''); if (!in_array($form, $FORMS, true)) fail('Unknown form');
  $d = at('GET', 'Facility Checklists', ['maxRecords'=>500, 'filterByFormula'=>"AND({Chart}='".str_replace("'", "\\'", $form)."',{Portal Visibility}='Both')"]);
  $seen = []; $items = [];
  foreach (($d['records'] ?? []) as $r){ $f = $r['fields']; $it = $f['Item'] ?? ''; if ($it !== '' && !isset($seen[$it])){ $seen[$it] = 1; $items[] = ['item'=>$it, 'order'=>$f['Order'] ?? 0]; } }
  usort($items, function($a, $b){ return $a['order'] <=> $b['order']; });
  echo json_encode(['ok'=>true,'items'=>$items]); exit;
}

if ($action === 'submit'){
  $form = (string)($in['form'] ?? ''); $room = (string)($in['room'] ?? ''); $name = trim((string)($in['name'] ?? ''));
  if (!in_array($form, $FORMS, true) || !in_array($room, $ROOMS, true)) fail('Pick a room and a form.');
  if ($name === '') $name = (string)$v['name'];
  $name = mb_substr($name, 0, 80);
  $lines = []; $flags = [];
  foreach ((array)($in['rows'] ?? []) as $r){
    $it = mb_substr(trim((string)($r['item'] ?? '')), 0, 200); if ($it === '') continue;
    $ok = !empty($r['ok']); $note = mb_substr(trim((string)($r['note'] ?? '')), 0, 300);
    $lines[] = ($ok ? '✅ ' : '⚠️ ').$it.($note !== '' ? ' — '.$note : '');
    if (!$ok) $flags[] = $it.($note !== '' ? ' ('.$note.')' : '');
  }
  if (!$lines) fail('Nothing to save.');
  date_default_timezone_set('America/New_York'); $now = new DateTime('now');
  $fields = ['School'=>$school,'Room / Classroom'=>$room,'Form Type'=>$form,'Staff Name'=>$name,'Date'=>$now->format('Y-m-d'),'Submitted At'=>gmdate('c'),
    'Items'=>implode("\n", $lines),'Overall Status'=>$flags ? '⚠️ Issues Flagged' : '✅ All OK','Status'=>'🟡 Pending',
    'Submission'=>$school.' · '.$room.' · '.preg_replace('/^\S+ /', '', $form).' · '.$now->format('n/j g:i A')];
  if ($flags) $fields['Details'] = "Needs attention:\n- ".implode("\n- ", $flags);
  $res = at('POST', 'Facility Submissions', null, ['records'=>[['fields'=>$fields]], 'typecast'=>true]);
  if (empty($res['records'][0]['id'])) fail('Did not save — try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}

if ($action === 'today'){
  $d = at('GET', 'Facility Submissions', ['maxRecords'=>200, 'filterByFormula'=>"AND(IS_SAME({Date},TODAY(),'day'),{School}='".$school."',{Form Type}!='🚨 Incident Report')"]);
  $o = [];
  foreach (($d['records'] ?? []) as $r){ $f = $r['fields']; $o[] = ['form'=>$f['Form Type'] ?? '','room'=>$f['Room / Classroom'] ?? '','by'=>$f['Staff Name'] ?? '','at'=>$f['Submitted At'] ?? '','status'=>$f['Overall Status'] ?? '']; }
  usort($o, function($a, $b){ return strcmp($b['at'], $a['at']); });
  echo json_encode(['ok'=>true,'list'=>$o]); exit;
}
fail('Unknown action');
