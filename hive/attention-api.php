<?php
/* THE HIVE — Owner "Needs Attention" API, built 11/15/26. OWNER PIN ONLY.
Reads the Portal Alerts table (the same red items directors see in their Daily Briefing)
for BOTH schools, and lets the owner mark an item done. Directors never use this file. */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $__d){
  if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE' && file_exists($__d.'/hive-token.php')){ include $__d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $__t = HIVE_TOKEN; }
}
header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
define('BASE', 'https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/');
function at($method, $path, $body = null){
  global $__t;
  $h = "Authorization: Bearer $__t\r\nContent-Type: application/json\r\n";
  $o = ['http'=>['method'=>$method,'header'=>$h,'ignore_errors'=>true,'timeout'=>20]];
  if ($body !== null) $o['http']['content'] = json_encode($body);
  return json_decode(@file_get_contents(BASE.$path, false, stream_context_create($o)), true);
}
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$pin = strtoupper(trim($in['pin'] ?? ''));
if (!$pin){ usleep(300000); fail('Please open this from the Owner Portal.', 401); }
$res = at('GET', rawurlencode('Portal Access').'?maxRecords=20');
$role = '';
foreach (($res['records'] ?? []) as $r){ if (strtoupper(trim($r['fields']['PIN'] ?? '')) === $pin){ $role = strtolower(trim($r['fields']['Role'] ?? '')); break; } }
if ($role !== 'owner'){ usleep(300000); fail('This page is for the owners only.', 403); }

$T = 'tblwz1GxdimyzOz2Q';
$action = $in['action'] ?? 'list';
if ($action === 'list'){
  $since = date('Y-m-d', strtotime('-14 days'));
  $f = "OR({Status}='Open',IS_AFTER({Created},'".$since."'))";
  $out = []; $off = null; $g = 0;
  do {
    $q = ['filterByFormula'=>$f, 'pageSize'=>100];
    if ($off) $q['offset'] = $off;
    $j = at('GET', $T.'?'.http_build_query($q));
    if (!is_array($j) || isset($j['error'])) fail('Could not read the alerts right now.', 502);
    foreach (($j['records'] ?? []) as $r){
      $x = $r['fields'];
      $out[] = ['id'=>$r['id'], 'alert'=>(string)($x['Alert'] ?? ''), 'school'=>(string)($x['School'] ?? ''),
        'status'=>(string)($x['Status'] ?? ''), 'source'=>(string)($x['Source'] ?? ''), 'red'=>!empty($x['Red']),
        'created'=>(string)($x['Created'] ?? ''), 'link'=>(string)($x['Link'] ?? '')];
    }
    $off = $j['offset'] ?? null;
  } while ($off && ++$g < 5);
  echo json_encode(['alerts'=>$out, 'today'=>date('Y-m-d')]); exit;
}
if ($action === 'close'){
  $id = (string)($in['id'] ?? '');
  if (!preg_match('/^rec[A-Za-z0-9]{14}$/', $id)) fail('Bad item.');
  $j = at('PATCH', $T.'/'.$id, ['fields'=>['Status'=>'Resolved']]);
  if (!is_array($j) || isset($j['error'])) fail('Could not mark it done. Please try again.', 502);
  echo json_encode(['ok'=>true]); exit;
}
fail('Unknown action.');
