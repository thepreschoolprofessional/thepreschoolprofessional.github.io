<?php
// ELC sign-in -> Airtable connector. Receives entries from the Bear Phonics Academy tablet pages.
// Uses the existing Hive Airtable token (kept outside public_html). Writes ONLY to the ELC Sign-Ins table.
header('Content-Type: application/json'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
function out($a,$c=200){ http_response_code($c); echo json_encode($a); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['ok'=>false,'error'=>'post_only'],405);
$dirs=[dirname(__DIR__,2), dirname(__DIR__), __DIR__];
$tok=''; $code='';
foreach ($dirs as $d){
  if (!$tok && file_exists($d.'/hive-token.php')){ include $d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $tok=HIVE_TOKEN; }
  if (!$code && file_exists($d.'/elc-sync-code.php')){ include $d.'/elc-sync-code.php'; if (defined('ELC_SYNC_CODE')) $code=ELC_SYNC_CODE; }
}
if (!$tok || !$code) out(['ok'=>false,'error'=>'not_configured'],503);
if (!hash_equals($code, (string)($_POST['code'] ?? ''))) out(['ok'=>false,'error'=>'denied'],403);
const BASE='app2HNkUSJqx9IkYZ'; const TBL='tblrJqXAnNeFZLfDj';
function at($method,$path,$body=null){
  global $tok;
  $o=['http'=>['method'=>$method,'header'=>"Authorization: Bearer $tok\r\nContent-Type: application/json\r\n",'ignore_errors'=>true,'timeout'=>12]];
  if ($body!==null) $o['http']['content']=json_encode($body);
  $r=@file_get_contents('https://api.airtable.com/v0/'.BASE.'/'.$path,false,stream_context_create($o));
  $j=json_decode($r?:'',true);
  return is_array($j)?$j:['error'=>'bad_response'];
}
$op=$_POST['op'] ?? '';
$id=$_POST['id'] ?? '';
if (!preg_match('/^(sanford|deland)__(\d{4}-\d{2})__([A-Za-z0-9_\-]{1,60})__(\d{2})$/',$id,$m)) out(['ok'=>false,'error'=>'bad_id'],400);
$q='filterByFormula='.rawurlencode("{Entry ID}='".$id."'").'&maxRecords=1&fields%5B%5D=Entry%20ID';
$f=at('GET',TBL.'?'.$q);
if (isset($f['error'])) out(['ok'=>false,'error'=>'lookup_failed'],502);
$rec=$f['records'][0]['id'] ?? null;
if ($op==='delete'){
  if ($rec){ $r=at('DELETE',TBL.'/'.$rec); if (isset($r['error'])) out(['ok'=>false,'error'=>'delete_failed'],502); }
  out(['ok'=>true]);
}
if ($op!=='upsert') out(['ok'=>false,'error'=>'bad_op'],400);
$d=json_decode($_POST['data'] ?? '',true); if (!is_array($d)) out(['ok'=>false,'error'=>'bad_data'],400);
$s=function($k) use ($d){ return isset($d[$k]) ? mb_substr((string)$d[$k],0,20000) : ''; };
$fields=[
 'Entry ID'=>$id,
 'School'=>($m[1]==='sanford'?'Sanford':'DeLand 2'),
 'Month'=>$m[2],
 'Child'=>$s('child'),
 'Sign In Time'=>$s('inT'),
 'Sign Out Time'=>$s('outT'),
 'Note'=>$s('note'),
 'Note Signature'=>$s('noteS'),
 'Sign In Signature'=>$s('inS'),
 'Sign Out Signature'=>$s('outS'),
 'Updated'=>$s('updated'),
];
$date=$m[2].'-'.$m[4]; if (preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)) $fields['Date']=$date;
$r = $rec ? at('PATCH',TBL.'/'.$rec,['fields'=>$fields]) : at('POST',TBL,['fields'=>$fields]);
if (isset($r['error'])) out(['ok'=>false,'error'=>'write_failed','detail'=>is_array($r['error'])?($r['error']['type']??''):$r['error']],502);
out(['ok'=>true]);
