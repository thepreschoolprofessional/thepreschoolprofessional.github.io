<?php
/* THE HIVE — Owner Reports API, built 11/13/26. OWNER PIN ONLY.
Private home for the owner-only PDFs (Daily Operations Reports, Owner Weekly Operations Report,
Monthly Staff Reports, Friday director sheets copy). Directors and staff can never reach these:
files live OUTSIDE public_html (hive-owner-reports), and every action checks the owner PIN live
against Airtable Portal Access (role "owner"). Nothing here touches Airtable data or the vault. */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $__d){
  if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE' && file_exists($__d.'/hive-token.php')){ include $__d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $__t = HIVE_TOKEN; }
}
header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['error'=>$m]); exit; }
function ok($v){ header('Content-Type: application/json; charset=utf-8'); echo json_encode($v); exit; }
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);

$KINDS = ['daily'=>'Daily Operations Reports', 'weekly'=>'Owner Weekly Operations Reports', 'friday'=>'Friday Director Meeting Sheets', 'monthly'=>'Monthly Staff Reports', 'other'=>'Other Owner Files'];

/* Input: JSON body (list / get / delete) or multipart form (upload). */
$in = $_POST ?: (json_decode(file_get_contents('php://input'), true) ?: []);
$pin = strtoupper(trim($in['pin'] ?? ''));
$action = $in['action'] ?? 'list';

function is_owner($pin, $tok){
  if (!$pin) return false;
  $o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer $tok\r\n",'ignore_errors'=>true,'timeout'=>20]];
  $res = json_decode(@file_get_contents('https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.rawurlencode('Portal Access').'?maxRecords=20', false, stream_context_create($o)), true);
  foreach (($res['records'] ?? []) as $r){
    if (strtolower(trim($r['fields']['Role'] ?? '')) === 'owner' && strtoupper(trim($r['fields']['PIN'] ?? '')) === $pin) return true;
  }
  return false;
}
if (!is_owner($pin, $__t)){ usleep(400000); fail('That is not the owner PIN.', 401); }

function root(){
  foreach ([dirname(__DIR__, 2).'/hive-owner-reports', dirname(__DIR__).'/hive-owner-reports'] as $c){
    if (!is_dir($c)) @mkdir($c, 0750, true);
    if (is_dir($c) && is_writable($c)) return $c;
  }
  return null;
}
function clean_name($n){ $n = preg_replace('/[^A-Za-z0-9 ._()&,\'-]/', '', $n); $n = trim(preg_replace('/\.{2,}/', '.', $n)); return substr($n, 0, 140); }
$R = root(); if (!$R) fail('Storage is not available on the server.', 500);
$kind = $in['kind'] ?? 'other'; if (!isset($KINDS[$kind])) $kind = 'other';

if ($action === 'list'){
  $out = [];
  foreach ($KINDS as $k => $label){
    $d = $R.'/'.$k; $files = [];
    foreach ((is_dir($d) ? (glob($d.'/*') ?: []) : []) as $f){ if (is_file($f)) $files[] = ['name'=>basename($f), 'size'=>filesize($f), 'at'=>date('c', filemtime($f))]; }
    usort($files, function($a, $b){ return strcmp($b['at'], $a['at']) ?: strcmp($b['name'], $a['name']); });
    $out[] = ['kind'=>$k, 'label'=>$label, 'files'=>$files];
  }
  ok(['kinds'=>$out]);
}

if ($action === 'upload'){
  if (empty($_FILES['files'])) fail('No file was attached.');
  $d = $R.'/'.$kind; if (!is_dir($d)) @mkdir($d, 0750, true);
  $F = $_FILES['files']; $names = (array)$F['name']; $tmp = (array)$F['tmp_name']; $err = (array)$F['error']; $saved = [];
  foreach ($names as $i => $nm){
    if (($err[$i] ?? 1) !== UPLOAD_ERR_OK) fail('Upload failed for '.$nm.' (error '.($err[$i] ?? '?').').');
    $n = clean_name($nm); $ext = strtolower(pathinfo($n, PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf','docx','xlsx','png','jpg'], true)) fail('Only PDF, Word, Excel or image files.');
    $dest = $d.'/'.$n;
    if (is_file($dest)){ $b = pathinfo($n, PATHINFO_FILENAME); $dest = $d.'/'.$b.' (v'.date('mdHi').').'.$ext; }
    if (!move_uploaded_file($tmp[$i], $dest)) fail('Could not save '.$nm.'.', 500);
    $saved[] = basename($dest);
  }
  ok(['saved'=>$saved, 'kind'=>$kind]);
}

$name = clean_name($in['name'] ?? ''); $f = $R.'/'.$kind.'/'.$name;
if (!$name || !is_file($f)) fail('File not found.', 404);

if ($action === 'get'){
  $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
  $mime = ['pdf'=>'application/pdf','docx'=>'application/vnd.openxmlformats-officedocument.wordprocessingml.document','xlsx'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','png'=>'image/png','jpg'=>'image/jpeg'][$ext] ?? 'application/octet-stream';
  header('Content-Type: '.$mime); header('Content-Length: '.filesize($f)); readfile($f); exit;
}
if ($action === 'delete'){ @unlink($f); ok(['deleted'=>$name]); }
fail('Unknown action.');
