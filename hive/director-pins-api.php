<?php
/* THE HIVE — Director PIN card API, built 11/12/26. DIRECTOR (own school) or OWNER PIN. Shows the director every Hive portal PIN for THEIR school only
   (Director, Teacher, Parent). Never the Owner PIN, never the other school. Nothing is stored; PINs are read live from Airtable Portal Access. */
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
$rows = []; $mine = '';
foreach (($res['records'] ?? []) as $r){
  $role = strtolower(trim($r['fields']['Role'] ?? '')); $p = strtoupper(trim($r['fields']['PIN'] ?? ''));
  if ($role && $p){ $rows[$role] = $p; if (($role === 'director-sanford' || $role === 'director-deland') && $p === $pin) $mine = $role; }
}
if (!$pin || $mine === ''){ usleep(400000); fail('Only a director can open this page.', 401); }
$sc = ($mine === 'director-sanford') ? 'sanford' : 'deland'; $name = ($sc === 'sanford') ? 'Sanford' : 'DeLand 2';
$out = [];
foreach (['director'=>'Director Portal (you and the other director)', 'teacher'=>'Teacher Portal (all teachers at '.$name.')', 'parent'=>'Parent Portal (all '.$name.' families)'] as $k=>$lbl){
  $v = $rows[$k.'-'.$sc] ?? ''; if ($v !== '') $out[] = ['label'=>$lbl, 'pin'=>$v];
}
/* The director's own Bear Line PIN(s): only people with a Director role at THEIR school (never Owner PINs). */
$mine_bl = [];
$dir = ($sc === 'sanford') ? 'elc-94f077be04' : 'elc-1ce53ee46c';
if ($__code){
  $ch = curl_init("https://bearphonicsacademy.com/$dir/bearline-owner-pins.php");
  curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>http_build_query(['code'=>$__code]), CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>15]);
  $j = json_decode((string)curl_exec($ch), true); curl_close($ch);
  if ($j && !empty($j['ok'])) foreach (($j['staff'] ?? []) as $s){ if (preg_match('/director/i', $s['role'] ?? '') && !preg_match('/owner/i', $s['role'] ?? '')) $mine_bl[] = ['name'=>$s['name'], 'role'=>$s['role'], 'pin'=>$s['pin']]; }
}
echo json_encode(['school'=>$name, 'hive'=>$out, 'bearline'=>$mine_bl]);
