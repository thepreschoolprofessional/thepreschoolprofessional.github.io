<?php
/* THE HIVE: visitor / authorised pick-up + drop-off log, called ONLY by the Bear Line sign-in tablet server (server to server, private ELC sync code).
   Writes the Visitor Log; for a child pick-up / drop-off it also stamps the child's Room Attendance row (their room) so the board shows it. 11/17/26 */
header('Content-Type: application/json'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
function out($a,$c=200){ http_response_code($c); echo json_encode($a); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['ok'=>false,'error'=>'post_only'],405);
$tok=''; $code='';
foreach ([dirname(__DIR__,2), dirname(__DIR__), __DIR__] as $d){
  if (!$tok && file_exists($d.'/hive-token.php')){ include $d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $tok=HIVE_TOKEN; }
  if (!$code && file_exists($d.'/elc-sync-code.php')){ include $d.'/elc-sync-code.php'; if (defined('ELC_SYNC_CODE')) $code=ELC_SYNC_CODE; }
}
if (!$tok || !$code) out(['ok'=>false,'error'=>'not_configured'],503);
$in=json_decode(file_get_contents('php://input'),true); if(!is_array($in)) out(['ok'=>false,'error'=>'bad'],400);
if (!hash_equals($code,(string)($in['code'] ?? ''))) out(['ok'=>false,'error'=>'denied'],403);
date_default_timezone_set('America/New_York');
$SC=['sanford'=>'Sanford','deland'=>'DeLand 2']; $sk=(string)($in['school'] ?? ''); if(!isset($SC[$sk])) out(['ok'=>false,'error'=>'bad_school'],400); $school=$SC[$sk];
function at($m,$t,$q=null,$b=null){ global $tok;
  $u='https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.rawurlencode($t).($q?'?'.http_build_query($q):'');
  $o=['http'=>['method'=>$m,'header'=>"Authorization: Bearer $tok\r\nContent-Type: application/json\r\n",'ignore_errors'=>true,'timeout'=>20]]; if($b!==null)$o['http']['content']=json_encode($b);
  return json_decode(@file_get_contents($u,false,stream_context_create($o))?:'',true); }
function nm($s,$n=80){ return mb_substr(trim(preg_replace('/\s+/',' ',(string)$s)),0,$n); }
function child_fl($s){ $p=preg_split('/\s+/',trim((string)$s)); if(!$p||$p[0]==='') return ''; $f=mb_convert_case(mb_substr($p[0],0,30),MB_CASE_TITLE); return count($p)>1 ? $f.' '.mb_strtoupper(mb_substr(end($p),0,1)).'.' : $f; }
function sigok($s){ return strpos($s,'data:image/png;base64,')===0 && strlen($s)>=600 && strlen($s)<=60000; }
$now=new DateTime('now'); $today=$now->format('Y-m-d'); $nowt=$now->format('g:i A'); $hm=$now->format('H:i'); $op=(string)($in['op'] ?? '');

if ($op==='list'){ /* who is still here (business visitors only), first name + last initial */
  $r=at('GET','Visitor Log',['maxRecords'=>200,'filterByFormula'=>"AND({School}='$school',IS_SAME({Date},'$today','day'),{Status}='In')"]); $o=[];
  foreach(($r['records'] ?? []) as $x){ $f=$x['fields']; $p=preg_split('/\s+/',trim($f['Visitor'] ?? '')); $n=($p[0] ?? '').(count($p)>1?' '.mb_strtoupper(mb_substr(end($p),0,1)).'.':''); $o[]=['id'=>$x['id'],'name'=>$n,'from'=>$f['From (Company / Reason)'] ?? '','in'=>$f['Time In'] ?? '']; }
  out(['ok'=>true,'visitors'=>$o]);
}
if ($op==='in'){
  $kind=(string)($in['kind'] ?? ''); $name=nm($in['name'] ?? ''); $sig=(string)($in['sig'] ?? '');
  if(!in_array($kind,['business','pickup','dropoff'],true)) out(['ok'=>false,'error'=>'bad_kind'],400);
  if($name==='') out(['ok'=>false,'error'=>'need_name'],400);
  if(!sigok($sig)) out(['ok'=>false,'error'=>'need_sig'],400);
  if($kind==='business'){
    $from=nm($in['from'] ?? '',120); if($from==='') out(['ok'=>false,'error'=>'need_from'],400);
    $f=['Visitor'=>$name,'School'=>$school,'Date'=>$today,'From (Company / Reason)'=>$from,'Visiting'=>nm($in['visiting'] ?? ''),'Time In'=>$nowt,'Signature In'=>$sig,'Status'=>'In','Source'=>'Front tablet (0000)','Type'=>'Business / Visitor'];
    $r=at('POST','Visitor Log',null,['records'=>[['fields'=>$f]],'typecast'=>true]);
    if(empty($r['records'][0]['id'])) out(['ok'=>false,'error'=>'save_failed'],502);
    out(['ok'=>true,'id'=>$r['records'][0]['id'],'time'=>$nowt]);
  }
  $child=child_fl($in['child'] ?? ''); if($child==='') out(['ok'=>false,'error'=>'need_child'],400);
  $rel=nm($in['from'] ?? '',120); /* relationship / who they are */
  $lab=($kind==='pickup')?'Pick-up':'Drop-off';
  $f=['Visitor'=>$name,'School'=>$school,'Date'=>$today,'From (Company / Reason)'=>'Authorised by parent'.($rel!==''?' · '.$rel:''),'Visiting'=>$child,'Time In'=>$nowt,'Time Out'=>$nowt,'Signature In'=>$sig,'Status'=>'Out','Source'=>'Front tablet (0000)','Type'=>$lab,'Child'=>$child];
  $r=at('POST','Visitor Log',null,['records'=>[['fields'=>$f]],'typecast'=>true]);
  if(empty($r['records'][0]['id'])) out(['ok'=>false,'error'=>'save_failed'],502);
  /* stamp the child's room attendance */
  $key=$school.'|'.$today.'|'.$child; $room=''; $found=false;
  $a=at('GET','Room Attendance',['maxRecords'=>1,'filterByFormula'=>"{Key}='".str_replace("'","\\'",$key)."'"]);
  $rec=$a['records'][0] ?? null;
  if($rec){ $found=true; $room=$rec['fields']['Current Room'] ?? ($rec['fields']['Home Room'] ?? ''); $ff=$rec['fields'];
    $upd=[]; if($kind==='pickup' && empty($ff['Departure'])){ $upd['Departure']=$hm; $upd['Departure By']='Authorised: '.$name; }
             if($kind==='dropoff' && empty($ff['Arrival'])){ $upd['Arrival']=$hm; $upd['Arrival By']='Authorised: '.$name; }
    if($upd) at('PATCH','Room Attendance/'.$rec['id'],null,['fields'=>$upd,'typecast'=>true]); }
  elseif($kind==='dropoff'){
    $rc=at('GET','Room Children',['maxRecords'=>1,'filterByFormula'=>"AND({Child}='".str_replace("'","\\'",$child)."',{School}='$school',{Status}='Active')"]);
    $room=$rc['records'][0]['fields']['Room'] ?? '';
    if($room!==''){ $found=true; at('POST','Room Attendance',null,['records'=>[['fields'=>['Key'=>$key,'Date'=>$today,'School'=>$school,'Child'=>$child,'Home Room'=>$room,'Current Room'=>$room,'Arrival'=>$hm,'Arrival By'=>'Authorised: '.$name]]],'typecast'=>true]); }
  }
  out(['ok'=>true,'time'=>$nowt,'room'=>$room,'stamped'=>$found]);
}
if ($op==='out'){
  $id=(string)($in['id'] ?? ''); $sig=(string)($in['sig'] ?? ''); if(!preg_match('/^rec[A-Za-z0-9]{14}$/',$id)) out(['ok'=>false,'error'=>'bad'],400); if(!sigok($sig)) out(['ok'=>false,'error'=>'need_sig'],400);
  $r=at('GET','Visitor Log/'.$id); $f=$r['fields'] ?? null;
  if(!$f || ($f['School'] ?? '')!==$school || ($f['Date'] ?? '')!==$today || ($f['Status'] ?? '')!=='In') out(['ok'=>false,'error'=>'not_in'],404);
  $u=at('PATCH','Visitor Log/'.$id,null,['fields'=>['Time Out'=>$nowt,'Signature Out'=>$sig,'Status'=>'Out'],'typecast'=>true]);
  if(empty($u['id'])) out(['ok'=>false,'error'=>'save_failed'],502);
  out(['ok'=>true,'time'=>$nowt]);
}
out(['ok'=>false,'error'=>'bad_op'],400);
