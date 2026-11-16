<?php
/* THE HIVE — Bear Line hand-off (11/16/26). A staff member who is already signed in on the Bear Line taps a link and lands straight on the Hive page
(no teacher PIN typed). Bear Line signs a 30-minute pass (same pass as the cleaning chart); this file asks THAT school's Bear Line to verify it, then hands back
only that school's teacher sign-in so the page opens signed in. Pages are limited to the allow-list in go.html. */
$__t = '';
foreach ([dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'] as $__f){
  if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN')){ $__t = HIVE_TOKEN; break; } }
}
define('AT_TOKEN', $__t);
define('BASE_ID', 'app2HNkUSJqx9IkYZ');
header('Content-Type: application/json; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow'); header('Cache-Control: no-store');
function fail($m, $c = 400){ http_response_code($c); echo json_encode(['error'=>$m]); exit; }
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) fail('Bad request');
$pass = (string)($in['pass'] ?? '');
$pp = explode('.', $pass, 2); $pl = json_decode(base64_decode(strtr($pp[0] ?? '', '-_', '+/')), true);
$school = (is_array($pl) && in_array($pl['school'] ?? '', ['Sanford','DeLand 2'], true)) ? $pl['school'] : '';
if ($school === '') fail('This link is not valid. Go back to the Bear Line and tap it again.', 403);
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
if (!defined('ELC_SYNC_CODE') || AT_TOKEN === '') fail('Not connected yet.', 503);
$bl = $school === 'Sanford' ? 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php' : 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php';
$ctx = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode(['action'=>'clean_verify','code'=>ELC_SYNC_CODE,'pass'=>$pass]),'timeout'=>20,'ignore_errors'=>true]]);
$v = json_decode(@file_get_contents($bl, false, $ctx) ?: '', true);
if (!is_array($v) || empty($v['ok'])) fail('This link has timed out (they last 30 minutes). Go back to the Bear Line and tap it again.', 403);
$want = $school === 'Sanford' ? 'teacher-sanford' : 'teacher-deland';
$url = 'https://api.airtable.com/v0/'.BASE_ID.'/'.rawurlencode('Portal Access').'?maxRecords=50&fields%5B%5D=Role&fields%5B%5D=PIN';
$o = ['http'=>['method'=>'GET','header'=>"Authorization: Bearer ".AT_TOKEN."\r\n",'ignore_errors'=>true,'timeout'=>20]];
$d = json_decode(@file_get_contents($url, false, stream_context_create($o)) ?: '', true);
$pin = '';
foreach (($d['records'] ?? []) as $r){ if (strtolower(trim($r['fields']['Role'] ?? '')) === $want){ $pin = trim($r['fields']['PIN'] ?? ''); break; } }
if ($pin === '') fail('The teacher sign-in is not set up for this school yet. Tell your director.', 404);
echo json_encode(['ok'=>true,'pin'=>$pin,'role'=>'teacher','school'=>$school,'name'=>(string)($v['name'] ?? '')]);
