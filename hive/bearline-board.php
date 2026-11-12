<?php
// Bear Line -> Rooms board connector. Receives today's parent/staff sign-in times from the Bear Line server
// (authorised by the private ELC sync code) and writes Arrival / Departure on the Room Attendance board.
// Earliest arrival wins (ProCare or Bear Line); latest departure wins. Never touches meals or notes.
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
if (!hash_equals($code,(string)($_POST['code'] ?? ''))) out(['ok'=>false,'error'=>'denied'],403);
$data=json_decode((string)($_POST['data'] ?? ''),true);
if (!is_array($data)) out(['ok'=>false,'error'=>'bad_data'],400);
$school=(string)($data['school'] ?? ''); $date=(string)($data['date'] ?? '');
if (!in_array($school,['Sanford','DeLand 2'],true) || !preg_match('/^\d{4}-\d\d-\d\d$/',$date)) out(['ok'=>false,'error'=>'bad_school_or_date'],400);
$items=array_slice(is_array($data['items'] ?? null)?$data['items']:[],0,150);
$BASE='app2HNkUSJqx9IkYZ'; $TBL='tblSLrxba6bU0IeHj';
function at($method,$url,$body=null){
  global $tok;
  $ch=curl_init($url);
  $h=['Authorization: Bearer '.$tok,'Content-Type: application/json'];
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$h,CURLOPT_TIMEOUT=>20]);
  if ($body!==null) curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body));
  $r=curl_exec($ch); $c=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
  return [$c,json_decode((string)$r,true)];
}
function hm($s){ return preg_match('/^(\d{1,2}):(\d\d)/',(string)$s,$m)? sprintf('%02d:%s',(int)$m[1],$m[2]) : ''; }
$made=0;$changed=0;$same=0;$errs=0;
foreach ($items as $it){
  $child=trim((string)($it['child'] ?? '')); if ($child==='') continue;
  $in=hm($it['in'] ?? ''); $outT=hm($it['out'] ?? '');
  if ($in==='' && $outT==='') continue;
  $inBy='Bear Line: '.substr((string)($it['inBy'] ?? ''),0,60);
  $outBy='Bear Line: '.substr((string)($it['outBy'] ?? ''),0,60);
  $key=$school.'|'.$date.'|'.$child;
  $f="{Key}='".str_replace("'","\\'",$key)."'";
  list($c,$r)=at('GET',"https://api.airtable.com/v0/$BASE/$TBL?maxRecords=1&filterByFormula=".rawurlencode($f));
  if ($c!==200){ $errs++; continue; }
  $rec=$r['records'][0] ?? null;
  if ($rec){
    $cur=$rec['fields']; $upd=[];
    $ca=hm($cur['Arrival'] ?? ''); $cd=hm($cur['Departure'] ?? '');
    if ($in!=='' && ($ca==='' || $in<$ca)){ $upd['Arrival']=$in; $upd['Arrival By']=$inBy; }
    if ($outT!=='' && ($cd==='' || $outT>$cd)){ $upd['Departure']=$outT; $upd['Departure By']=$outBy; }
    if (!$upd){ $same++; continue; }
    list($c2,)=at('PATCH',"https://api.airtable.com/v0/$BASE/$TBL/".$rec['id'],['fields'=>$upd,'typecast'=>true]);
    if ($c2===200) $changed++; else $errs++;
  } else {
    // find this child's board room from an earlier day so the new row lands in the right classroom
    $room='';
    $f2="AND({Child}='".str_replace("'","\\'",$child)."',{School}='".$school."')";
    list($c3,$r3)=at('GET',"https://api.airtable.com/v0/$BASE/$TBL?maxRecords=1&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc&filterByFormula=".rawurlencode($f2));
    if ($c3===200 && !empty($r3['records'][0]['fields']['Home Room'])) $room=$r3['records'][0]['fields']['Home Room'];
    if ($room==='') $room=(string)($it['room'] ?? '');
    $f=['Key'=>$key,'School'=>$school,'Date'=>$date,'Child'=>$child,'Home Room'=>$room];
    if ($in!==''){ $f['Arrival']=$in; $f['Arrival By']=$inBy; }
    if ($outT!==''){ $f['Departure']=$outT; $f['Departure By']=$outBy; }
    list($c4,)=at('POST',"https://api.airtable.com/v0/$BASE/$TBL",['fields'=>$f,'typecast'=>true]);
    if ($c4===200) $made++; else $errs++;
  }
}
out(['ok'=>$errs===0,'created'=>$made,'updated'=>$changed,'unchanged'=>$same,'errors'=>$errs]);
