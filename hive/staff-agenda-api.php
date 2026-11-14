<?php
/* THE HIVE — Monthly Staff Meeting Agenda API, built 11/13/26. READ-ONLY.
Teachers and directors see ONLY their own school's staff meeting agendas (teacher-sanford / teacher-deland /
director-sanford / director-deland). The owner PIN can read both. Agendas are uploaded by the monthly
staff-report tasks through the owner-only Owner Reports page (kinds agenda-sanford / agenda-deland).
Files live OUTSIDE public_html in hive-owner-reports/agenda-<school>/. No other folder can be read here. */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $__d){
  if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE' && file_exists($__d.'/hive-token.php')){ include $__d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $__t = HIVE_TOKEN; }
}
header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['error'=>$m]); exit; }
function ok($v){ header('Content-Type: application/json; charset=utf-8'); echo json_encode($v); exit; }
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$pin = strtoupper(trim($in['pin'] ?? ''));
if (!$pin){ usleep(300000); fail('Please open this from your Hive portal.', 401); }

$o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer $__t\r\n",'ignore_errors'=>true,'timeout'=>20]];
$res = json_decode(@file_get_contents('https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.rawurlencode('Portal Access').'?maxRecords=20', false, stream_context_create($o)), true);
$role = '';
foreach (($res['records'] ?? []) as $r){ if (strtoupper(trim($r['fields']['PIN'] ?? '')) === $pin){ $role = strtolower(trim($r['fields']['Role'] ?? '')); break; } }
$MAP = ['teacher-sanford'=>'Sanford', 'director-sanford'=>'Sanford', 'teacher-deland'=>'DeLand 2', 'director-deland'=>'DeLand 2'];
if ($role === 'owner'){ $school = (($in['school'] ?? '') === 'DeLand 2') ? 'DeLand 2' : 'Sanford'; }
elseif (isset($MAP[$role])){ $school = $MAP[$role]; }
else { usleep(300000); fail('This page is for Sanford and DeLand 2 staff. Please open it from your Teacher or Director Portal.', 401); }

$slug = ($school === 'DeLand 2') ? 'agenda-deland' : 'agenda-sanford';
$d = null;
foreach ([dirname(__DIR__, 2).'/hive-owner-reports/'.$slug, dirname(__DIR__).'/hive-owner-reports/'.$slug] as $c){ if (is_dir($c)){ $d = $c; break; } }
$action = $in['action'] ?? 'list';

if ($action === 'list'){
  $files = [];
  foreach (($d ? (glob($d.'/*.pdf') ?: []) : []) as $f){ if (is_file($f)) $files[] = ['name'=>basename($f), 'size'=>filesize($f), 'at'=>date('c', filemtime($f))]; }
  usort($files, function($a, $b){ return strcmp($b['at'], $a['at']) ?: strcmp($b['name'], $a['name']); });
  ok(['school'=>$school, 'files'=>array_slice($files, 0, 24)]);
}
if ($action === 'get'){
  $n = preg_replace('/[^A-Za-z0-9 ._()&,\'-]/', '', $in['name'] ?? ''); $n = trim(preg_replace('/\.{2,}/', '.', $n));
  $f = $d ? $d.'/'.$n : '';
  if (!$n || !$d || !is_file($f) || strtolower(pathinfo($f, PATHINFO_EXTENSION)) !== 'pdf') fail('File not found.', 404);
  header('Content-Type: application/pdf'); header('Content-Length: '.filesize($f)); readfile($f); exit;
}
fail('Unknown action.');
