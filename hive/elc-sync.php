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
/* ---------- Director / owner PIN check + ELC roster changes (added 11/10/26) ---------- */
const TBL_LOG='tblMEC46j5q0kW0hL'; const TBL_KIDS='tblpEsTQ8EKbe63FA';
function who_by_pin($pin,$school){
  $r=at('GET','Portal%20Access?maxRecords=50&fields%5B%5D=Role&fields%5B%5D=PIN');
  if (!isset($r['records'])) return null;
  $pin=strtoupper(trim((string)$pin)); if ($pin==='') return false;
  foreach ($r['records'] as $rec){
    $role=strtolower(trim($rec['fields']['Role'] ?? '')); $p=strtoupper(trim($rec['fields']['PIN'] ?? ''));
    if ($p!=='' && hash_equals($p,$pin)){ if ($role==='owner') return 'Owner'; if ($role==='director-'.$school) return 'Director'; }
  }
  return false;
}
if ($op==='pincheck' || $op==='roster'){
  $school=$_POST['school'] ?? ''; if (!in_array($school,['sanford','deland'],true)) out(['ok'=>false,'error'=>'bad_school'],400);
  $who=who_by_pin($_POST['pin'] ?? '',$school);
  if ($who===null) out(['ok'=>false,'error'=>'cannot_verify'],502);
  if ($who===false) out(['ok'=>false,'error'=>'bad_pin'],403);
  if ($op==='pincheck') out(['ok'=>true,'who'=>$who]);
  $act=$_POST['action'] ?? ''; $first=trim($_POST['first'] ?? ''); $ini=strtoupper(trim($_POST['ini'] ?? '')); $room=trim($_POST['room'] ?? '');
  if (!in_array($act,['add','remove'],true) || $first==='' || mb_strlen($first)>20 || !preg_match('/^[A-Z]$/',$ini) || !in_array($room,['','INF','TOD','2YR','PR3','PR4','PR5','SCH'],true)) out(['ok'=>false,'error'=>'bad_data'],400);
  $sname=$school==='sanford'?'Sanford':'DeLand 2';
  $child=$first.' '.$ini.'.';
  $esc=function($t){ return str_replace("'","\\'",$t); };
  $q='filterByFormula='.rawurlencode("AND({School}='".$sname."',LOWER({Child})='".$esc(mb_strtolower($child))."')").'&maxRecords=5';
  $f=at('GET',TBL_KIDS.'?'.$q);
  $board='not_checked';
  if (isset($f['records'])){
    $rec=$f['records'][0] ?? null;
    if ($act==='add'){
      if ($rec){
        $st=$rec['fields']['Status']['name'] ?? ($rec['fields']['Status'] ?? '');
        $r=at('PATCH',TBL_KIDS.'/'.$rec['id'],['fields'=>['SR (ELC)'=>true]]);
        $board=isset($r['error'])?'board_update_failed':($st==='Withdrawn'?'on_board_but_withdrawn':'board_marked_elc');
      } else {
        $map=[
          'sanford'=>['INF'=>'Honeybees - Tod./Inf.','TOD'=>'Honeybees - Tod./Inf.','2YR'=>'Honeybees - Tod./Inf.','PR3'=>'VPK/Pre-School (Pollen-Jocks)','PR4'=>'VPK/Pre-School (Pollen-Jocks)','PR5'=>'VPK/Pre-School (Pollen-Jocks)','SCH'=>'Schoolagers (Worker Bees)','' =>'Schoolagers (Worker Bees)'],
          'deland'=>['INF'=>'Infant/Toddler','TOD'=>'Honey Bees - Tod. Front','2YR'=>"Three's - Honey Combs",'PR3'=>"Three's - Honey Combs",'PR4'=>"Four's - Honey Combs",'PR5'=>"Four's - Honey Combs",'SCH'=>"Four's - Honey Combs",''=>"Four's - Honey Combs"]];
        $r=at('POST',TBL_KIDS,['fields'=>['Child'=>$child,'School'=>$sname,'Room'=>$map[$school][$room],'Status'=>'Active','SR (ELC)'=>true,'Order'=>99,'Verify'=>'Added from the ELC tablet by '.$who.' '.date('n/j/y').' - confirm room, birth date and KidKare/ProCare on the Rooms board']]);
        $board=isset($r['error'])?'board_create_failed':'board_created_verify';
      }
    } else {
      if ($rec){
        $r=at('PATCH',TBL_KIDS.'/'.$rec['id'],['fields'=>['SR (ELC)'=>false,'At Risk (ELC)'=>false]]);
        $board=isset($r['error'])?'board_update_failed':'board_unmarked_elc';
      } else $board='not_on_board';
    }
  } else $board='board_lookup_failed';
  $now=new DateTime('now',new DateTimeZone('America/New_York'));
  at('POST',TBL_LOG,['fields'=>['Entry'=>($act==='add'?'Added ':'Removed ').$child.' - '.$sname.' - '.$now->format('Y-m-d'),'School'=>$sname,'Action'=>$act==='add'?'Added':'Removed','Child'=>$child,'Room Code'=>$room,'Done By'=>$who,'When'=>$now->format('c'),'Rooms Board'=>$board]]);
  $catch=null;
  if ($act==='add'){
    $ctx=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode(['action'=>'elc_catchup','code'=>$code,'school'=>$school,'first'=>$first,'ini'=>$ini]),'timeout'=>25,'ignore_errors'=>true]]);
    $cr=@file_get_contents('https://thepreschoolprofessional.net/hive/files-api.php',false,$ctx);
    $cj=json_decode($cr?:'',true); if (is_array($cj) && isset($cj['found'])) $catch=$cj;
  }
  out(['ok'=>true,'who'=>$who,'board'=>$board,'catchup'=>$catch]);
}
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
 'Excuse Form'=>$s('exJ'),
 'Updated'=>$s('updated'),
];
$date=$m[2].'-'.$m[4]; if (preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)) $fields['Date']=$date;
$r = $rec ? at('PATCH',TBL.'/'.$rec,['fields'=>$fields]) : at('POST',TBL,['fields'=>$fields]);
if (isset($r['error'])) out(['ok'=>false,'error'=>'write_failed','detail'=>is_array($r['error'])?($r['error']['type']??''):$r['error']],502);
out(['ok'=>true]);
