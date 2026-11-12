<?php
/* THE HIVE — Owner PIN card API, built 11/12/26. OWNER PIN ONLY. Shows the owner every Hive PIN and the Bear Line owner/director/test PINs.
Nothing is stored; PINs are read live from Airtable Portal Access and from each school's Bear Line server. */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'; $__code = '';
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $__d){
  if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE' && file_exists($__d.'/hive-token.php')){ include $__d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $__t = HIVE_TOKEN; }
  if (!$__code && file_exists($__d.'/elc-sync-code.php')){ include $__d.'/elc-sync-code.php'; if (defined('ELC_SYNC_CODE')) $__code = ELC_SYNC_CODE; }
}
header('Content-Type: application/json; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$in = json_decode(file_get_contents('php://input'), true); if (!$in) fail('Bad request');
$pin = strtoupper(trim($in['pin'] ?? ''));
$o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer $__t\r\n",'ignore_errors'=>true,'timeout'=>20]];
$res = json_decode(file_get_contents('https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.rawurlencode('Portal Access').'?maxRecords=20', false, stream_context_create($o)), true);
$rows = []; $isOwner = false;
foreach (($res['records'] ?? []) as $r){
  $role = strtolower(trim($r['fields']['Role'] ?? '')); $p = strtoupper(trim($r['fields']['PIN'] ?? ''));
  if ($role && $p){ $rows[] = ['role'=>$role, 'pin'=>$p]; if ($role === 'owner' && $p === $pin) $isOwner = true; }
}
if (!$pin || !$isOwner){ usleep(400000); fail('That is not the owner PIN.', 401); }
$names = ['owner'=>'Owner Portal','director-sanford'=>'Sanford Director Portal','director-deland'=>'DeLand 2 Director Portal','teacher-sanford'=>'Sanford Teacher Portal','teacher-deland'=>'DeLand 2 Teacher Portal','parent-sanford'=>'Sanford Parent Portal','parent-deland'=>'DeLand 2 Parent Portal'];
$hive = []; foreach ($rows as $r) $hive[] = ['label'=>$names[$r['role']] ?? $r['role'], 'pin'=>$r['pin']];
$bl = [];
foreach (['Sanford'=>'elc-94f077be04','DeLand 2'=>'elc-1ce53ee46c'] as $sch=>$dir){
  $ch = curl_init("https://bearphonicsacademy.com/$dir/bearline-owner-pins.php");
  curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>http_build_query(['code'=>$__code]), CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>15]);
  $j = json_decode((string)curl_exec($ch), true); curl_close($ch);
  $bl[] = ($j && !empty($j['ok'])) ? ['school'=>$sch,'staff'=>$j['staff'],'test'=>$j['test']] : ['school'=>$sch,'error'=>'Could not reach this school\'s Bear Line right now.'];
}
echo json_encode(['hive'=>$hive, 'bearline'=>$bl]);
