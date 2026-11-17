<?php
/* THE HIVE — Owner Messages API, built 11/17/26. OWNER PIN ONLY.
Step 1 of moving off Slack: shows Charles's alerts and run reports (and the other owner channels)
from Airtable "Bear Tracks Posts" (Audience = Owner) on the Owner Portal. Slack keeps its copy;
nothing here reads or writes Slack. Every action checks the owner PIN live against Portal Access. */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $__d){
  if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE' && file_exists($__d.'/hive-token.php')){ include $__d.'/hive-token.php'; if (defined('HIVE_TOKEN')) $__t = HIVE_TOKEN; }
}
header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['error'=>$m]); exit; }
function ok($v){ header('Content-Type: application/json; charset=utf-8'); echo json_encode($v); exit; }
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);

$in = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$pin = strtoupper(trim($in['pin'] ?? ''));
$action = $in['action'] ?? 'list';

function at($method, $path, $query = '', $body = null){
  global $__t;
  $h = "Authorization: Bearer $__t\r\n"; if ($body !== null) $h .= "Content-Type: application/json\r\n";
  $o = ['http'=>['method'=>$method,'header'=>$h,'ignore_errors'=>true,'timeout'=>25]];
  if ($body !== null) $o['http']['content'] = json_encode($body);
  $url = 'https://api.airtable.com/v0/app2HNkUSJqx9IkYZ/'.$path.($query ? '?'.$query : '');
  return json_decode(@file_get_contents($url, false, stream_context_create($o)), true) ?: [];
}
function is_owner($pin){
  if (!$pin) return false;
  $res = at('GET', rawurlencode('Portal Access'), 'maxRecords=20');
  foreach (($res['records'] ?? []) as $r){
    if (strtolower(trim($r['fields']['Role'] ?? '')) === 'owner' && strtoupper(trim($r['fields']['PIN'] ?? '')) === $pin) return true;
  }
  return false;
}
if (!is_owner($pin)){ usleep(400000); fail('That is not the owner PIN.', 401); }

$T = 'tblpDn8JClt1dPpF8'; /* Bear Tracks Posts */
$FIELDS = ['Title','Message','Channel','School','Priority','Posted By','Posted At','Drive Link','Drive Label','Pinned','Needs Action','Done By','Done At','Reply To'];
function rid($s){ return preg_match('/^rec[A-Za-z0-9]{14}$/', $s ?? '') ? $s : ''; }
function shape($r){ $f = $r['fields'] ?? []; $out = ['id'=>$r['id']]; foreach ($GLOBALS['FIELDS'] as $k) $out[$k] = $f[$k] ?? null; return $out; }

if ($action === 'list'){
  $q = 'filterByFormula='.rawurlencode("{Audience}='Owner'").'&sort%5B0%5D%5Bfield%5D='.rawurlencode('Posted At').'&sort%5B0%5D%5Bdirection%5D=desc&pageSize=100';
  foreach ($FIELDS as $k) $q .= '&fields%5B%5D='.rawurlencode($k);
  $rows = []; $off = '';
  for ($p = 0; $p < 3; $p++){
    $res = at('GET', $T, $q.($off ? '&offset='.rawurlencode($off) : ''));
    if (isset($res['error'])) fail('Could not read messages right now.', 502);
    foreach (($res['records'] ?? []) as $r) $rows[] = shape($r);
    $off = $res['offset'] ?? ''; if (!$off) break;
  }
  ok(['posts'=>$rows]);
}

$id = rid($in['id'] ?? '');
if ($action === 'done'){
  if (!$id) fail('Missing message.');
  $undo = !empty($in['undo']);
  $res = at('PATCH', $T.'/'.$id, '', ['fields'=>['Done By'=>$undo ? '' : 'Mrs. Bear', 'Done At'=>$undo ? null : gmdate('c')], 'typecast'=>true]);
  if (isset($res['error'])) fail('Could not save that.', 502);
  ok(['post'=>shape($res)]);
}
if ($action === 'pin'){
  if (!$id) fail('Missing message.');
  $res = at('PATCH', $T.'/'.$id, '', ['fields'=>['Pinned'=>!empty($in['on'])]]);
  if (isset($res['error'])) fail('Could not save that.', 502);
  ok(['post'=>shape($res)]);
}
if ($action === 'note'){
  /* A private note from the owner on a message (owner-only; nobody else sees this card). */
  $text = trim((string)($in['text'] ?? ''));
  if (!$id || $text === '') fail('Write something first.');
  if (mb_strlen($text) > 4000) fail('That note is too long.');
  $parent = at('GET', $T.'/'.$id);
  if (empty($parent['fields'])) fail('Message not found.', 404);
  $res = at('POST', $T, '', ['records'=>[['fields'=>[
    'Title'=>'Note from Mrs. Bear', 'Message'=>$text, 'Channel'=>$parent['fields']['Channel'] ?? 'Owner To-Do',
    'Audience'=>'Owner', 'School'=>$parent['fields']['School'] ?? 'Both', 'Priority'=>'Normal',
    'Posted By'=>'Mrs. Bear', 'Posted At'=>gmdate('c'), 'Reply To'=>$id, 'Source'=>'owner-messages']]], 'typecast'=>true]);
  if (isset($res['error'])) fail('Could not save the note.', 502);
  ok(['post'=>shape($res['records'][0])]);
}
fail('Unknown action.');
