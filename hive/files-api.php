<?php
/* ============================================================
THE HIVE — Staff Files & Student Files API, built 11/5/26.
Directors (and the owner, who enters through the same director door) work on their OWN school only.
Teachers may only (1) list their school's staff names and (2) submit a training certificate for the file. They can never sign, edit, view or remove anything.
Files live OUTSIDE public_html in hive-vault/<school>/people/<staff|student>/<airtable record id>/ and never in GitHub.
Remove only moves a file to _removed (kept for the audit record), never erases it.
Separate from api.php, rooms-api.php and reporting-api.php on purpose: nothing here can affect the live portal pages.
============================================================ */
$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
if ($__t === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){
$__candidates = [dirname(__DIR__, 2).'/hive-token.php', dirname(__DIR__).'/hive-token.php', __DIR__.'/hive-token.php'];
foreach ($__candidates as $__f){
if (file_exists($__f)){ include $__f; if (defined('HIVE_TOKEN') && HIVE_TOKEN !== 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){ $__t = HIVE_TOKEN; break; } }
}
}
define('AIRTABLE_TOKEN', $__t);
define('BASE_ID', 'app2HNkUSJqx9IkYZ');
define('PIN_TABLE', 'Portal Access');
define('PIN_CACHE', sys_get_temp_dir() . '/hive_pins_cache.json');
define('PIN_CACHE_TTL', 300);
date_default_timezone_set('America/New_York');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];
$SCHOOLS = ['Sanford', 'DeLand 2'];
$KINDS = ['staff', 'student'];
/* What each file needs. [label, needs an expiration date?, required?] — change here and re-upload this one file to change the checklist. */
$DEFS = [
/* [label, has an expiration/renewal date?, required?, hint]. Built from Mrs. Bear's own SOP-14 Employee and Student File Checklists (the Airtable Onboarding & Compliance bases) plus the Florida DCF personnel-file list. */
'staff' => [
 'app'   => ['Application for Employment', false, true, ''],
 'appcc' => ['Application for Child Care Applicant', false, true, ''],
 'ref'   => ['Employment history / reference check (5-year)', false, true, ''],
 'gm'    => ['Affidavit of Good Moral Character', true, true, 'Renew every year'],
 'ack'   => ['Annual Acknowledgment Form', true, true, 'Renew every year'],
 'bg'    => ['Background screening (Clearinghouse, DCF Child Care Eligible)', true, true, 'Enter the 5-year rescreen date'],
 'sop'   => ['Sexual predator / offender search', true, true, 'Enter the next re-check date'],
 'dl'    => ['Driver\'s license copy', true, true, 'Enter the license expiration'],
 'priv'  => ['Privacy policy signed', false, true, ''],
 'jd'    => ['Job description signed', false, true, ''],
 'tax'   => ['Direct deposit / W-4 / I-9', false, true, ''],
 'edu'   => ['Education credentials', false, true, ''],
 'dcf'   => ['DCF training transcript (40-hour / 10-hour)', false, true, 'Within 90 days of hire; finish within 12 months'],
 'cred'  => ['Staff / Director credential (CDA, etc.)', true, false, 'Only if they hold one'],
 'orient'=> ['Orientation certificate', false, true, ''],
 'fire'  => ['Fire extinguisher training', true, true, 'Within 30 days of hire, then renew'],
 'usp'   => ['Universal safety precautions training', true, true, 'Renew every year'],
 'cpr'   => ['Infant & child CPR certificate', true, true, ''],
 'fa'    => ['First Aid certificate', true, true, ''],
 'tb'    => ['TB / health screening', true, true, 'Enter the screening date'],
 'ss'    => ['Safe Sleep certificate', false, true, 'Within 30 days of hire if children under 1'],
 'inf'   => ['Approved infant training', false, false, 'Only if caring for infants (within 90 days)'],
 'lit'   => ['Early Literacy training (5 hours)', false, true, 'Within 1 year of hire'],
 'fare'  => ['FARE training', false, true, ''],
 'med'   => ['Medication administration training', false, false, 'Only if they give medication'],
 'trans' => ['Transportation training', false, false, 'Drivers only, before transporting children'],
 'dphys' => ['Driver physical exam', true, false, 'Drivers only, yearly'],
 'cah'   => ['Central Abuse Hotline records search', false, false, 'Directors and owners'],
 'can'   => ['Child abuse / neglect reporting', true, true, 'Renew every year'],
 'conf'  => ['Confidentiality agreement', false, true, ''],
 'coc'   => ['Employee code of conduct', false, true, ''],
 'hns'   => ['Health / nutrition / safety policy', false, true, ''],
 'emg'   => ['Emergency procedures acknowledgment', false, true, ''],
 'pdp'   => ['Professional development plan', false, true, ''],
 'rev'   => ['90-day and performance reviews', false, false, ''],
 'inserv'=> ['In-service training record (CF-FSP 5268), 10 hours each July-June', true, true, 'Enter the date this fiscal year (June 30) is complete'],
 'disab' => ['Disabilities training (operators/directors)', true, false, 'Operators: within 5 years. Enter the next due date'],
 'civ'   => ['Civil Rights training (Food Program)', true, false, 'Staff who serve or record meals. Renew every year'],
 'srori' => ['School Readiness orientation / health & safety training', false, false, 'Only staff who care for School Readiness (ELC) children'],
 'f5131' => ['Personnel file form CF-FSP 5131 (Background Screening and Personnel File Requirements)', false, true, ''],
 'oos'   => ['Out-of-state registry searches (lived outside Florida in last 5 years)', false, false, 'Only if they did'],
 'vol'   => ['Volunteer acknowledgment CF-FSP 5217', false, false, 'Volunteers only, before they start'],
 'ce'    => ['Other training certificates (outside classes)', false, false, 'Hive lesson certificates are added automatically below'],
],
'student' => [
 'reg'   => ['Registration form / enrollment packet', false, true, ''],
 'med'   => ['Medical treatment authorization', false, true, ''],
 'em'    => ['Emergency contacts & authorized pickup', false, true, ''],
 'imm'   => ['Immunization record (Florida DH 680 / 681)', true, true, 'Enter the expiration shown on the form'],
 'phys'  => ['Physical exam (DH 3040)', true, true, 'Enter the expiration date'],
 'special'=> ['What makes my child special', false, true, ''],
 'allg'  => ['Allergy / special needs care plan', false, false, 'Only if the child has one'],
 'nut'   => ['Nutrition & physical activity policy', false, true, ''],
 'photo' => ['Photo / video release', false, true, ''],
 'foodp' => ['Food and activity permission', false, true, ''],
 'pid'   => ['Parent ID copy', false, true, ''],
 'fin'   => ['Financial agreement', false, true, ''],
 'hb'    => ['Handbook receipt', false, true, ''],
 'dd'    => ['Distracted driver information', true, true, 'Every year (Apr / Sep). Enter the next due date'],
 'flu'   => ['Influenza information', true, true, 'Every year (Aug / Sep). Enter the next due date'],
 'fr'    => ['Free & reduced meal application', true, true, 'Renew every year'],
 'disc'  => ['Discipline & expulsion policy receipt (signed)', false, true, ''],
 'cacfp' => ['Food Program enrollment (days, hours, meals)', false, true, 'Child Participation form'],
 'infant'=> ['Infant feeding form', false, false, 'Infants only'],
 'dmed'  => ['Medical statement / dietary request (meal changes)', false, false, 'Only if the child needs a meal substitution'],
 'tcons' => ['Emergency medical consent for transport', false, false, 'Only if the child rides the vehicle or goes on trips'],
 'sleep' => ['Physician authorization (sleep position / feeding device)', false, false, 'Only if a doctor requires one'],
 'broch' => ['Know Your Child Care Facility brochure receipt (CF/PI 175-24)', false, true, 'Signed by parent'],
 'medauth'=> ['Medication authorization (signed, dated, dose and time)', false, false, 'Only if we give any medication. Keep 12 months after the last dose'],
 'elcpay'=> ['ELC / School Readiness payment certificate (eligibility)', true, true, 'School Readiness children only. Enter the date the certificate EXPIRES so the red alert comes before it runs out'],
 'elc'   => ['Other ELC / 4C paperwork', false, false, 'Only if the family has any'],
 'cust'  => ['Custody / court papers', false, false, 'Only if any'],
],
];
$CE_GOAL = 24; // yearly in-service hours goal shown on each staff file

function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }

function at_request($method, $path, $query = null, $body = null){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($path[0]) . (isset($path[1]) ? '/'.$path[1] : '');
if ($query) $url .= '?' . (is_string($query) ? $query : http_build_query($query));
$opts = ['http' => ['method' => $method, 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n", 'ignore_errors' => true, 'timeout' => 25]];
if ($body !== null) $opts['http']['content'] = json_encode($body);
$res = file_get_contents($url, false, stream_context_create($opts));
return json_decode($res, true);
}
function get_pins(){
if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL){ return json_decode(file_get_contents(PIN_CACHE), true); }
$res = at_request('GET', [PIN_TABLE], ['maxRecords' => 10]);
$pins = [];
foreach (($res['records'] ?? []) as $r){
$role = strtolower(trim($r['fields']['Role'] ?? '')); $pin = strtoupper(trim($r['fields']['PIN'] ?? ''));
if ($role && $pin) $pins[$pin] = $role;
}
if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
return $pins;
}
function vault_root(){
$cands = [dirname(__DIR__, 2).'/hive-vault', dirname(__DIR__).'/hive-vault'];
foreach ($cands as $c){ if (!is_dir($c)) @mkdir($c, 0750, true); if (is_dir($c) && is_writable($c)) return $c; }
return null;
}
function school_dir($school){ $r = vault_root(); if (!$r) return null; $d = $r.'/'.preg_replace('/[^a-z0-9]+/', '-', strtolower($school)); if (!is_dir($d)) @mkdir($d, 0750, true); return (is_dir($d) && is_writable($d)) ? $d : null; }
function clean_name($n){ $n = preg_replace('/[^A-Za-z0-9 ._()&,\'-]/', '', $n); $n = trim(preg_replace('/\.{2,}/', '.', $n)); return substr($n, 0, 100); }
function jread($f, $def){ return is_file($f) ? (json_decode(file_get_contents($f), true) ?: $def) : $def; }
function jwrite($f, $v){ file_put_contents($f, json_encode($v), LOCK_EX); }

/* Roster comes from Airtable (Staff Roster / Room Children); the files themselves never touch Airtable. */
function roster_cache_clear($school){ foreach (glob(sys_get_temp_dir().'/hive_people_'.preg_replace('/[^a-z0-9]/', '', strtolower($school)).'_*.json') ?: [] as $f) @unlink($f); }
function roster($school, $kind, $inactive = false){
$cache = sys_get_temp_dir().'/hive_people_'.preg_replace('/[^a-z0-9]/', '', strtolower($school)).'_'.$kind.($inactive ? '_former' : '').'.json';
if (file_exists($cache) && time() - filemtime($cache) < 60){ $c = json_decode(file_get_contents($cache), true); if (is_array($c)) return $c; }
$sc = str_replace("'", "", $school);
$table = $kind === 'staff' ? 'Staff Roster' : 'Room Children';
if ($inactive) $formula = $kind === 'staff' ? "AND({School}='".$sc."',NOT({Active}))" : "AND({School}='".$sc."',{Status}='Withdrawn')";
else $formula = $kind === 'staff' ? "AND({School}='".$sc."',{Active})" : "AND({School}='".$sc."',{Status}='Active')";
$out = []; $offset = null; $guard = 0;
do {
$q = ['filterByFormula'=>$formula, 'pageSize'=>100]; if ($offset) $q['offset'] = $offset;
$res = at_request('GET', [$table], http_build_query($q));
if (isset($res['error'])) return null;
foreach (($res['records'] ?? []) as $r){
$f = $r['fields'];
if ($kind === 'staff'){ $nm = trim($f['Name'] ?? ''); $sub = $f['Role'] ?? ''; }
else { $nm = trim($f['Child'] ?? ''); $sub = $f['Room'] ?? ''; if (is_array($sub)) $sub = $sub['name'] ?? ''; }
if ($nm === '') continue;
$out[] = ['id'=>$r['id'], 'name'=>$nm, 'sub'=>(string)$sub, 'dob'=>$f['DOB'] ?? '', 'former'=>$inactive, 'sr'=>!empty($f['SR (ELC)']), 'atrisk'=>!empty($f['At Risk (ELC)']), 'since'=>substr($r['createdTime'] ?? '', 0, 10)];
}
$offset = $res['offset'] ?? null;
} while ($offset && ++$guard < 10);
if (!$inactive) // practice person (not in Airtable, never counted on the card badges) so directors can try everything safely
$out[] = $kind === 'staff' ? ['id'=>'recTESTSTAFF00001', 'name'=>'Test Teacher (practice)', 'sub'=>'Practice only', 'dob'=>''] : ['id'=>'recTESTSTUDENT001', 'name'=>'Test Student (practice)', 'sub'=>'Practice only', 'dob'=>'2022-01-15'];
usort($out, function($a, $b){ return strcasecmp($a['name'], $b['name']); });
file_put_contents($cache, json_encode($out));
return $out;
}
function find_person($school, $kind, $id){ foreach ([false, true] as $inact){ $r = roster($school, $kind, $inact); if ($r === null) fail('Could not read the roster right now. Try again in a minute.', 502); foreach ($r as $p){ if ($p['id'] === $id) return $p; } } return null; }
function pdir($school, $kind, $id){
$b = school_dir($school); if (!$b) fail('The server could not open the vault. Tell Mrs. Bear.', 500);
if (!preg_match('/^rec[A-Za-z0-9]{10,20}$/', $id)) fail('Bad person');
$d = $b.'/people/'.$kind.'/'.$id; if (!is_dir($d) && !@mkdir($d, 0750, true)) fail('Could not create the folder', 500);
return $d;
}
function status_for($def, $files, $exp, $today, $done = false){
// returns [status, label]. red: missing / expired. amber: expires soon / date needed. ok / optional.
$label = $def[0]; $needsExp = $def[1]; $req = $def[2];
if (!$files && !$done) return $req ? 'missing' : 'optional';
if ($needsExp){
if (!$exp) return 'ok';
if ($exp < $today) return 'expired';
if ($exp <= date('Y-m-d', strtotime($today.' +30 days'))) return 'soon';
}
return 'ok';
}

/* Drive fallback: one private Drive folder per person (table "File Drive Links"). Doc Links JSON = {docKey:{url,label,verified}} */
function drive_links($school){
static $mem = [];
if (isset($mem[$school])) return $mem[$school];
$cache = sys_get_temp_dir().'/hive_drive_'.preg_replace('/[^a-z0-9]/', '', strtolower($school)).'.json';
if (is_file($cache) && time() - filemtime($cache) < 60){ $mem[$school] = json_decode(file_get_contents($cache), true) ?: []; return $mem[$school]; }
$out = []; $off = null;
do {
$q = ['filterByFormula'=>"{School}='".str_replace("'", "", $school)."'", 'pageSize'=>100]; if ($off) $q['offset'] = $off;
$res = at_request('GET', ['File Drive Links'], http_build_query($q));
if (!is_array($res) || isset($res['error'])) { $mem[$school] = []; return []; }
foreach (($res['records'] ?? []) as $r){
$f = $r['fields'] ?? []; $k = $f['Key'] ?? ''; if ($k === '') continue;
$dl = json_decode($f['Doc Links'] ?? '', true); if (!is_array($dl)) $dl = [];
$out[$k] = ['rid'=>$r['id'], 'folder'=>($f['Folder URL'] ?? ''), 'docs'=>$dl, 'sort'=>!empty($f['Needs Sorting'])];
}
$off = $res['offset'] ?? null;
} while ($off);
@file_put_contents($cache, json_encode($out));
$mem[$school] = $out; return $out;
}
function drive_cache_clear($school){ @unlink(sys_get_temp_dir().'/hive_drive_'.preg_replace('/[^a-z0-9]/', '', strtolower($school)).'.json'); }
function person_view($school, $kind, $id, $p){
global $DEFS, $CE_GOAL;
$d = pdir($school, $kind, $id); $meta = jread($d.'/meta.json', ['docs'=>new stdClass, 'files'=>[]]);
$today = date('Y-m-d'); $docs = []; $red = 0; $amber = 0;
$mdocs = (array)($meta['docs'] ?? []);
$dv = drive_links($school)[$kind.':'.$id] ?? null;
foreach ($DEFS[$kind] as $k => $def){
if ($kind === 'student' && $k === 'elcpay' && empty($p['sr'])) continue; // only School Readiness children
$fl = []; foreach (($meta['files'] ?? []) as $f){ if (($f['doc'] ?? '') === $k) $fl[] = $f; }
$exp = $mdocs[$k]['exp'] ?? '';
$dn = !empty($mdocs[$k]['done']);
$dl = $dv['docs'][$k] ?? null; $dok = ($dl && !empty($dl['url']) && !empty($dl['verified']));
$st = status_for($def, $fl, $exp, $today, $dn || $dok);
if ($k === 'elcpay' && ($fl || $dn || $dok)){ if (!$exp) $st = 'needdate'; elseif ($st === 'ok' && $exp <= date('Y-m-d', strtotime($today.' +45 days'))) $st = 'soon'; }
if ($st === 'missing' || $st === 'expired') $red++; elseif ($st === 'soon' || $st === 'needdate') $amber++;
$docs[] = ['key'=>$k, 'label'=>$def[0], 'needsExp'=>$def[1], 'req'=>$def[2], 'hint'=>($def[3] ?? ''), 'status'=>$st, 'exp'=>$exp, 'files'=>$fl, 'marked'=>($dn && !$fl && !$dok), 'nodate'=>($def[1] && !$exp && ($fl || $dn || $dok)), 'drive'=>(($dl && !empty($dl['url'])) ? ['url'=>$dl['url'], 'label'=>($dl['label'] ?? 'Page in Drive'), 'verified'=>$dok] : null)];
}
$out = ['id'=>$id, 'name'=>$p['name'], 'sub'=>$p['sub'], 'dob'=>$p['dob'], 'red'=>$red, 'amber'=>$amber, 'docs'=>$docs, 'former'=>!empty($p['former']), 'left'=>($meta['left'] ?? null), 'practice'=>(strpos($id, 'recTEST') === 0), 'sr'=>!empty($p['sr']), 'atrisk'=>!empty($p['atrisk']), 'driveFolder'=>($dv['folder'] ?? ''), 'driveSort'=>!empty($dv['sort'])];
$po = false; foreach ($docs as $dd0){ if ($dd0['key'] === 'photo' && (!empty($dd0['files']) || !empty($dd0['marked']) || !empty($dd0['drive']))) $po = true; }
$out['face'] = is_file($d.'/face.jpg'); $out['photoOk'] = $po;
if ($kind === 'staff'){
$certs = jread($d.'/certs.json', []); $sign = 0; $hrs = [];
foreach ($certs as &$c){ if (empty($c['signedAt'])) $sign++; $y = $c['year'] ?? substr($c['date'] ?? '', 0, 4); $hrs[$y] = round(($hrs[$y] ?? 0) + (float)($c['hrs'] ?? 0), 2); } unset($c);
$out['certs'] = $certs; $out['sign'] = $sign; $out['hours'] = $hrs; $out['goal'] = $CE_GOAL;
}
return $out;
}

if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token has not been added yet.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear.', 401);
$role = $pins[$pin];
$action = $input['action'] ?? '';
$TEACHER_SCHOOL = ['teacher-sanford' => 'Sanford', 'teacher-deland' => 'DeLand 2'];
$isDir = isset($ROLE_SCHOOL[$role]);
$isTeacher = (strpos($role, 'teacher') === 0);
$isParent = (strpos($role, 'parent') === 0);
if ($isParent && ($input['action'] ?? '') !== 'bios_public') fail('Files are only available with a director PIN.', 403);
if (!$isDir && !$isTeacher && !$isParent) fail('Files are only available with a director PIN.', 403);
$PARENT_SCHOOL = ['parent-sanford' => 'Sanford', 'parent-deland' => 'DeLand 2'];
$school = $isDir ? $ROLE_SCHOOL[$role] : (isset($TEACHER_SCHOOL[$role]) ? $TEACHER_SCHOOL[$role] : (isset($PARENT_SCHOOL[$role]) ? $PARENT_SCHOOL[$role] : trim($input['school'] ?? '')));
if (!in_array($school, $SCHOOLS, true)) fail('Pick your school first.');

if ($action === 'whoami'){ echo json_encode(['role'=>$isDir ? 'director' : 'teacher', 'school'=>$school]); exit; }

/* ---- Teacher-allowed actions (names list + submit a certificate). Nothing else. ---- */
if ($action === 'training_status'){
if (!$isDir) fail('Directors only.', 403);
$yr = date('Y'); $r = roster($school, 'staff'); if ($r === null) fail('Could not read the staff list right now.', 502);
$out = []; foreach ($r as $p){ if (strpos($p['id'], 'recTEST') === 0) continue; $cs = [];
foreach (jread(pdir($school, 'staff', $p['id']).'/certs.json', []) as $c){ if (($c['year'] ?? '') === $yr) $cs[] = ['lesson'=>$c['lesson'],'title'=>$c['title'] ?? '','hrs'=>$c['hrs'] ?? 0,'date'=>$c['date'] ?? '','signed'=>!empty($c['signedAt'])]; }
$out[] = ['id'=>$p['id'],'name'=>$p['name'],'role'=>$p['sub'] ?? '','certs'=>$cs]; }
$pf = pend_f($school); $pd = $pf ? jread($pf, []) : []; $pn = [];
foreach ($pd as $q){ $cs = []; foreach (($q['certs'] ?? []) as $c){ $cs[] = ['lesson'=>$c['lesson'],'title'=>$c['title'],'hrs'=>$c['hrs'],'date'=>$c['date'],'signed'=>false]; } $pn[] = ['id'=>$q['pid'],'name'=>$q['name'],'certs'=>$cs]; }
echo json_encode(['school'=>$school,'year'=>$yr,'staff'=>$out,'pending'=>$pn]); exit;
}
if ($action === 'cert_status'){
$id = (string)($input['id'] ?? ''); $out = []; $nm = ''; $yr = date('Y');
if (strpos($id, 'pend_') === 0){ $f = pend_f($school); $pd = $f ? jread($f, []) : []; foreach ($pd as $q){ if (($q['pid'] ?? '') === $id){ $nm = $q['name']; foreach ($q['certs'] as $c){ if (($c['year'] ?? '') === $yr) $out[] = ['lesson'=>$c['lesson'],'title'=>$c['title'],'hrs'=>$c['hrs'],'date'=>$c['date'],'signed'=>!empty($c['signedAt'])]; } } } }
else { $p = find_person($school, 'staff', $id); if (!$p) fail('That name is not on this school\'s staff list.'); $nm = $p['name']; foreach (jread(pdir($school, 'staff', $id).'/certs.json', []) as $c){ if (($c['year'] ?? '') === $yr) $out[] = ['lesson'=>$c['lesson'],'title'=>$c['title'] ?? '','hrs'=>$c['hrs'] ?? 0,'date'=>$c['date'] ?? '','signed'=>!empty($c['signedAt'])]; } }
echo json_encode(['name'=>$nm,'school'=>$school,'certs'=>$out]); exit;
}
if ($action === 'staff_names'){
$r = roster($school, 'staff'); if ($r === null) fail('Could not read the staff list right now.', 502);
echo json_encode(['staff'=>array_map(function($p){ return ['id'=>$p['id'], 'name'=>$p['name']]; }, $r)]); exit;
}
function pend_f($school){ $d = school_dir($school); return $d ? $d.'/_pending_staff.json' : null; }
if ($action === 'staff_add_pending'){
$nm = trim(preg_replace('/\s+/', ' ', preg_replace('/[^A-Za-z .\'-]/', '', $input['name'] ?? ''))); if (strlen($nm) < 3 || strlen($nm) > 50) fail('Type your first name and last name.');
$r = roster($school, 'staff'); if ($r === null) fail('Could not read the staff list right now.', 502);
foreach ($r as $p){ if (strcasecmp($p['name'], $nm) === 0) { echo json_encode(['id'=>$p['id'], 'name'=>$p['name'], 'exists'=>true]); exit; } }
$f = pend_f($school); if (!$f) fail('Could not save right now.', 500); $pd = jread($f, []);
foreach ($pd as $q){ if (strcasecmp($q['name'], $nm) === 0) { echo json_encode(['id'=>$q['pid'], 'name'=>$q['name'], 'pending'=>true]); exit; } }
$pid = 'pend_'.substr(md5(uniqid('', true)), 0, 10); $pd[] = ['pid'=>$pid, 'name'=>$nm, 'at'=>gmdate('c'), 'certs'=>[]]; jwrite($f, $pd);
echo json_encode(['id'=>$pid, 'name'=>$nm, 'pending'=>true]); exit;
}
if ($action === 'cert_submit'){
$id = $input['id'] ?? ''; $lesson = preg_replace('/[^A-Za-z0-9]/', '', $input['lesson'] ?? '');
$title = substr(preg_replace('/[<>]/', '', strip_tags($input['title'] ?? '')), 0, 120);
$hrs = round((float)($input['hrs'] ?? 0), 2);
if ($lesson === '' || $title === '' || $hrs <= 0 || $hrs > 8) fail('Missing lesson details');
if (strpos($id, 'pend_') === 0){
$f = pend_f($school); $pd = $f ? jread($f, []) : []; $hit = false;
foreach ($pd as &$q){ if (($q['pid'] ?? '') === $id){ $hit = true; foreach ($q['certs'] as $c0){ if (($c0['lesson'] ?? '') === $lesson && ($c0['year'] ?? '') === date('Y')) fail('This lesson is already recorded for '.date('Y').'.'); }
$c = ['cid'=>'c'.date('ymdHis').substr(md5(uniqid('', true)), 0, 4), 'lesson'=>$lesson, 'title'=>$title, 'hrs'=>$hrs, 'date'=>date('Y-m-d'), 'year'=>date('Y'), 'at'=>gmdate('c'), 'by'=>'self', 'signedAt'=>'', 'signer'=>'', 'sig'=>''];
$q['certs'][] = $c; $nmq = $q['name']; } } unset($q);
if (!$hit) fail('That name was not found. Add it again.'); jwrite($f, $pd);
echo json_encode(['ok'=>true, 'cert'=>array_merge($c, ['name'=>$nmq, 'school'=>$school])]); exit;
}
$p = find_person($school, 'staff', $id); if (!$p) fail('That name is not on this school\'s staff list.');
$d = pdir($school, 'staff', $id); $f = $d.'/certs.json'; $certs = jread($f, []);
$year = date('Y');
foreach ($certs as $c){ if (($c['lesson'] ?? '') === $lesson && ($c['year'] ?? '') === $year) fail('This lesson is already in the file for '.$year.'. Ask your director to open it.'); }
$c = ['cid'=>'c'.date('ymdHis').substr(md5(uniqid('', true)), 0, 4), 'lesson'=>$lesson, 'title'=>$title, 'hrs'=>$hrs, 'date'=>date('Y-m-d'), 'year'=>$year, 'at'=>gmdate('c'), 'by'=>'self', 'signedAt'=>'', 'signer'=>'', 'sig'=>''];
$certs[] = $c; jwrite($f, $certs);
echo json_encode(['ok'=>true, 'cert'=>array_merge($c, ['name'=>$p['name'], 'school'=>$school])]); exit;
}
/* ---- Staff bio cards: teachers submit their own answers; directors approve; families see approved ones ---- */
function bio_clean($v, $n = 700){ $v = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$v))); return mb_substr($v, 0, $n); }
$BIO_KEYS = ['why', 'edu', 'edufield', 'h45', 'years', 'hobbies', 'fav', 'fun'];
function bio_public_row($school, $p){
$d = pdir($school, 'staff', $p['id']); $b = jread($d.'/bio.json', []);
if (empty($b['approved']) || empty($b['bio'])) return null;
$row = ['id'=>$p['id'], 'name'=>$p['name'], 'role'=>$p['sub'], 'bio'=>$b['bio'], 'a'=>($b['answers'] ?? new stdClass), 'photo'=>''];
$fp = $d.'/face.jpg'; if (is_file($fp)) $row['photo'] = base64_encode(file_get_contents($fp));
return $row;
}
if ($action === 'bios_public'){
$r = roster($school, 'staff'); if ($r === null) fail('Could not read the staff list right now.', 502);
$out = []; foreach ($r as $p){ if (strpos($p['id'], 'recTEST') === 0) continue; $row = bio_public_row($school, $p); if ($row) $out[] = $row; }
echo json_encode(['school'=>$school, 'staff'=>$out]); exit;
}
/* ---- Standard Operating Procedures: everyone at the school can read; changing times needs a director PIN ---- */
function sop_file($school){ $d = school_dir($school); return $d ? $d.'/sop.json' : null; }
function sop_dir_ok($school, $isDir, $pins, $dp){
if ($isDir) return true;
$dp = strtoupper(trim((string)$dp)); if ($dp === '') return false;
$dr = $pins[$dp] ?? ''; $want = ($school === 'Sanford') ? 'director-sanford' : 'director-deland';
return ($dr === $want || $dr === 'owner');
}
if ($action === 'sop_get'){
$f = sop_file($school); $d = ($f && is_file($f)) ? jread($f, []) : [];
echo json_encode(['school'=>$school, 'data'=>(empty($d) ? new stdClass : $d), 'canEdit'=>$isDir]); exit;
}
if ($action === 'sop_auth'){
echo json_encode(['ok'=>sop_dir_ok($school, $isDir, $pins, $input['dirpin'] ?? '')]); exit;
}
if ($action === 'sop_save'){
if (!sop_dir_ok($school, $isDir, $pins, $input['dirpin'] ?? '')) fail('A director has to enter their PIN to change the schedule.', 403);
$data = $input['data'] ?? null; if (!is_array($data)) fail('Nothing to save.');
$keep = []; foreach (['rooms', 'staff', 'timeline', 'days'] as $k){ if (array_key_exists($k, $data)) $keep[$k] = $data[$k]; }
$json = json_encode($keep); if ($json === false || strlen($json) > 400000) fail('That is too much to save.');
$f = sop_file($school); if (!$f) fail('Could not save right now.', 500);
jwrite($f, $keep);
$lf = dirname($f).'/sop_log.json'; $lg = jread($lf, []); $lg[] = ['at'=>gmdate('c'), 'by'=>($isDir ? 'director' : 'director PIN entered on a teacher login'), 'what'=>mb_substr((string)($input['what'] ?? ''), 0, 120)];
if (count($lg) > 300) $lg = array_slice($lg, -300); jwrite($lf, $lg);
echo json_encode(['ok'=>true]); exit;
}

function to_file($school){ $d = school_dir($school); return $d ? $d.'/timeoff.json' : null; }
function to_ymd($v){ $v=(string)$v; return preg_match('/^\d{4}-\d{2}-\d{2}$/',$v) ? $v : ''; }
if ($action === 'to_submit'){
$name = mb_substr(trim((string)($input['name'] ?? '')), 0, 60); if ($name === '') fail('Pick your name.');
$type = (string)($input['type'] ?? ''); if (!in_array($type, ['Vacation','Personal time','Bereavement','Unpaid time off','Other'], true)) fail('Pick the kind of time off.');
$from = to_ymd($input['from'] ?? ''); $to = to_ymd($input['to'] ?? ''); if (!$from || !$to || $to < $from) fail('Check the dates.');
$tz = new DateTimeZone('America/New_York'); $today = new DateTime('now', $tz); $today->setTime(0,0);
$fd = DateTime::createFromFormat('Y-m-d', $from, $tz); if (!$fd) fail('Check the dates.'); $fd->setTime(0,0);
$notice = (int)$today->diff($fd)->format('%r%a');
$f = to_file($school); if (!$f) fail('Could not save right now.', 500);
$all = jread($f, []); if (count($all) > 600) fail('Too many requests on file. Ask your director.');
$id = 'to_'.bin2hex(random_bytes(5));
$all[] = ['id'=>$id,'name'=>$name,'type'=>$type,'from'=>$from,'to'=>$to,'hours'=>mb_substr(trim((string)($input['hours'] ?? '')),0,40),'reason'=>mb_substr(trim((string)($input['reason'] ?? '')),0,400),'covered'=>mb_substr(trim((string)($input['covered'] ?? '')),0,200),'at'=>gmdate('c'),'notice'=>$notice,'short'=>($notice < 14),'status'=>'pending','note'=>''];
jwrite($f, $all);
echo json_encode(['ok'=>true,'short'=>($notice < 14),'notice'=>$notice]); exit;
}
if ($action === 'to_count'){
if (!$isDir){ echo json_encode(['count'=>0,'short'=>0]); exit; }
$f = to_file($school); $all = ($f && is_file($f)) ? jread($f, []) : []; $n = 0; $sh = 0;
foreach ($all as $r){ if (($r['status'] ?? '') === 'pending'){ $n++; if (!empty($r['short'])) $sh++; } }
$cw = 0; $sr = roster($school, 'staff');
if ($sr){ foreach ($sr as $p0){ if (strpos($p0['id'], 'recTEST') === 0) continue; foreach (jread(pdir($school, 'staff', $p0['id']).'/certs.json', []) as $c0){ if (empty($c0['signedAt'])) $cw++; } } }
$pf0 = pend_f($school); $pd0 = $pf0 ? jread($pf0, []) : []; $pn = 0; foreach ($pd0 as $q0){ $cw += count($q0['certs'] ?? []); $pn++; }
echo json_encode(['count'=>$n,'short'=>$sh,'certs'=>$cw,'newnames'=>$pn]); exit;
}
if ($action === 'to_approved'){
$f = to_file($school); $all = ($f && is_file($f)) ? jread($f, []) : []; $out = [];
foreach ($all as $r){ if (($r['status'] ?? '') === 'approved') $out[] = ['name'=>$r['name'],'from'=>$r['from'],'to'=>$r['to']]; }
echo json_encode(['approved'=>$out]); exit;
}
if ($action === 'to_list'){
if (!sop_dir_ok($school, $isDir, $pins, $input['dirpin'] ?? '')) fail('Directors only.', 403);
$f = to_file($school); $all = ($f && is_file($f)) ? jread($f, []) : [];
echo json_encode(['requests'=>array_reverse($all)]); exit;
}
if ($action === 'to_decide'){
if (!sop_dir_ok($school, $isDir, $pins, $input['dirpin'] ?? '')) fail('Directors only.', 403);
$id = (string)($input['id'] ?? ''); $st = (string)($input['status'] ?? ''); if (!in_array($st, ['approved','denied','pending'], true)) fail('Bad choice.');
$f = to_file($school); $all = ($f && is_file($f)) ? jread($f, []) : []; $hit = null;
foreach ($all as $i => $r){ if (($r['id'] ?? '') === $id){ $all[$i]['status'] = $st; $all[$i]['note'] = mb_substr(trim((string)($input['note'] ?? '')),0,300); $all[$i]['decidedAt'] = gmdate('c'); $sg = (string)($input['sig'] ?? ''); if ($sg !== '' && strpos($sg, 'data:image/png;base64,') === 0 && strlen($sg) < 120000) $all[$i]['sig'] = $sg; $all[$i]['signer'] = mb_substr(trim((string)($input['signer'] ?? '')),0,60); $hit = $all[$i]; } }
if (!$hit) fail('Request not found.', 404);
jwrite($f, $all);
/* approved time off goes onto the schedule as OUT days (weekdays only) */
$sf = sop_file($school); $sd = ($sf && is_file($sf)) ? jread($sf, []) : [];
if (!isset($sd['days']) || !is_array($sd['days'])) $sd['days'] = [];
$tag = 'Approved time off ['.$id.']';
foreach ($sd['days'] as $dk => $dv){ if (isset($dv['staff']) && is_array($dv['staff'])){ $sd['days'][$dk]['staff'] = array_values(array_filter($dv['staff'], function($o) use ($tag){ return ($o['note'] ?? '') !== $tag; })); } }
if ($st === 'approved'){
 $d = new DateTime($hit['from']); $e = new DateTime($hit['to']); $n = 0;
 while ($d <= $e && $n < 120){ if ((int)$d->format('N') <= 5){ $k = $d->format('Y-m-d'); if (!isset($sd['days'][$k]) || !is_array($sd['days'][$k])) $sd['days'][$k] = []; if (!isset($sd['days'][$k]['staff']) || !is_array($sd['days'][$k]['staff'])) $sd['days'][$k]['staff'] = []; $sd['days'][$k]['staff'][] = ['name'=>$hit['name'],'off'=>true,'note'=>$tag]; } $d->modify('+1 day'); $n++; }
}
if ($sf) jwrite($sf, $sd);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'bio_submit'){
$id = $input['id'] ?? ''; if (strpos($id, 'pend_') === 0) fail('Your name is waiting for your director to add you to the staff list. Ask them, then come back.');
$p = find_person($school, 'staff', $id); if (!$p || !empty($p['former'])) fail('Pick your name from the list.');
$d = pdir($school, 'staff', $id); $bf = $d.'/bio.json'; $old = jread($bf, []);
if (!empty($old['approved']) && !$isDir) fail('Your bio is already posted. Ask your director if you want to change it.');
$ans = []; foreach ($BIO_KEYS as $k){ $ans[$k] = bio_clean($input['a'][$k] ?? '', $k === 'years' ? 4 : 700); }
$bio = bio_clean($input['bio'] ?? '', 1500);
if ($ans['why'] === '' || $bio === '') fail('Please answer at least the first question.');
if (!empty($input['b64'])){
$raw = base64_decode($input['b64'], true);
if ($raw === false || strlen($raw) < 200 || strlen($raw) > 2 * 1024 * 1024) fail('That picture is missing or too large.');
if (substr($raw, 0, 3) !== "\xFF\xD8\xFF") fail('Please use a JPG photo.');
file_put_contents($d.'/face.jpg', $raw);
}
$new = ['answers'=>$ans, 'bio'=>$bio, 'approved'=>false, 'submittedAt'=>gmdate('c'), 'by'=>($isDir ? 'director' : 'staff')];
jwrite($bf, $new);
echo json_encode(['ok'=>true, 'name'=>$p['name']]); exit;
}
if (!$isDir) fail('Files are only available with a director PIN.', 403);

/* ---- Director actions (own school only) ---- */
$kind = $input['kind'] ?? 'staff';
if (!in_array($kind, $KINDS, true)) fail('Bad file type');

if ($action === 'attention'){
$items = [];
$pf = pend_f($school); $pd = $pf ? jread($pf, []) : []; $keep = [];
if ($pd){ $sr = roster($school, 'staff');
foreach ($pd as $q){ $m = null; if ($sr) foreach ($sr as $p0){ if (strcasecmp($p0['name'], $q['name']) === 0) $m = $p0; }
if ($m){ $cf = pdir($school, 'staff', $m['id']).'/certs.json'; $ex = jread($cf, []); foreach ($q['certs'] as $c){ $dup = false; foreach ($ex as $e){ if (($e['lesson'] ?? '') === $c['lesson'] && ($e['year'] ?? '') === $c['year']) $dup = true; } if (!$dup) $ex[] = $c; } jwrite($cf, $ex); }
else { $keep[] = $q; $items[] = ['kind'=>'staff', 'id'=>'', 'name'=>$q['name'], 'sub'=>'Not on staff list yet', 'doc'=>'addname', 'label'=>'Add '.$q['name'].' to the staff list ('.count($q['certs']).' training certificate'.(count($q['certs']) === 1 ? '' : 's').' waiting)', 'status'=>'missing', 'red'=>true]; } }
if (count($keep) !== count($pd)) jwrite($pf, $keep); }
foreach ($KINDS as $k){
$r = roster($school, $k); if ($r === null) continue;
foreach ($r as $p){ if (strpos($p['id'], 'recTEST') === 0) continue; $v = person_view($school, $k, $p['id'], $p);
foreach (($v['docs'] ?? []) as $d){
$st = $d['status'] ?? ''; if ($st !== 'missing' && $st !== 'expired' && $st !== 'soon' && $st !== 'needdate') continue;
if ($st === 'missing' && empty($d['req'])) continue;
$lbl = $d['label'];
if ($k === 'student' && $st === 'missing' && in_array($d['key'], ['imm', 'phys'], true) && !empty($p['since']) && strtotime($p['since']) < time() - 30 * 86400) $lbl = 'OVER 30 DAYS, child may not stay without it: '.$lbl;
$items[] = ['kind'=>$k, 'id'=>$p['id'], 'name'=>$p['name'], 'sub'=>$p['sub'], 'doc'=>$d['key'], 'label'=>$lbl, 'status'=>$st, 'red'=>($st === 'missing' || $st === 'expired')];
}
if ($k === 'staff'){ foreach ((jread(pdir($school, 'staff', $p['id']).'/certs.json', [])) as $c){ if (empty($c['signedAt'])) $items[] = ['kind'=>'staff', 'id'=>$p['id'], 'name'=>$p['name'], 'sub'=>$p['sub'], 'doc'=>'cert', 'label'=>'Training certificate to sign: '.($c['title'] ?? ''), 'status'=>'sign', 'red'=>true]; } }
}
}

/* ---- School-level alerts: drills, license / inspections, alerts posted by the scheduled tasks (ELC absence watch etc.) ---- */
$today0 = date('Y-m-d'); $sc0 = str_replace("'", "", $school);
$dr = at_request('GET', ['Facility Submissions'], http_build_query(['filterByFormula'=>"AND({School}='".$sc0."',FIND('DRILL:',{Details})>0)", 'pageSize'=>100]));
if (is_array($dr) && !isset($dr['error'])){
$drills = []; foreach (($dr['records'] ?? []) as $r0){ $f0 = $r0['fields'] ?? []; $dj = json_decode(substr($f0['Details'] ?? '', 6), true); $dd0 = $f0['Date'] ?? ''; if ($dd0 === '' || !is_array($dj)) continue; $drills[] = ['date'=>$dd0, 'type'=>($dj['type'] ?? 'Fire')]; }
$sch = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School'];
if (!$drills){ $items[] = array_merge($sch, ['doc'=>'drill', 'href'=>'dcf.html?tab=drill', 'label'=>'No fire drill log on file. Enter your drills or upload the paper fire drill log', 'status'=>'missing', 'red'=>true]); }
else {
$mk = date('Y-m'); $fire = 0; foreach ($drills as $d0){ if ($d0['type'] === 'Fire' && substr($d0['date'], 0, 7) === $mk) $fire++; }
if (!$fire){ $late = (int)date('j') >= 20; $items[] = array_merge($sch, ['doc'=>'drill', 'href'=>'dcf.html?tab=drill', 'label'=>'Fire drill for '.date('F').' not logged yet'.($late ? ' (month ends soon)' : ''), 'status'=>'missing', 'red'=>$late]); }
$since = date('Y-m-d', strtotime('-365 days')); $yr = ['Alternate route', 'Nap-time', 'Lockdown', 'Inclement weather'];
foreach ($yr as $ty){ $have = false; foreach ($drills as $d0){ if ($d0['type'] === $ty && $d0['date'] >= $since) $have = true; } if (!$have) $items[] = array_merge($sch, ['doc'=>'drill', 'href'=>'dcf.html?tab=drill', 'label'=>'Yearly '.strtolower($ty).' drill not logged in the last 12 months', 'status'=>'soon', 'red'=>false]); }
}
}
$sd = jread(school_dir($school).'/_school_dates.json', []);
foreach (['license'=>'DCF child care license renewal', 'fireinsp'=>'Fire marshal inspection', 'healthinsp'=>'Health department inspection'] as $k0 => $lb0){
$dt0 = $sd[$k0] ?? '';
if ($dt0 === ''){ $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'dates', 'href'=>'director.html#schooldates', 'label'=>'Enter the date: '.$lb0, 'status'=>'needdate', 'red'=>false]; continue; }
$days = (int)floor((strtotime($dt0) - strtotime($today0)) / 86400);
if ($days < 0) $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'dates', 'href'=>'director.html#schooldates', 'label'=>$lb0.' was due '.$dt0, 'status'=>'expired', 'red'=>true];
elseif ($days <= 60) $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'dates', 'href'=>'director.html#schooldates', 'label'=>$lb0.' due '.$dt0.' ('.$days.' days)', 'status'=>'soon', 'red'=>($days <= 14)];
}
$pa = at_request('GET', ['Portal Alerts'], http_build_query(['filterByFormula'=>"AND({School}='".$sc0."',{Status}='Open')", 'pageSize'=>100]));
if (is_array($pa) && !isset($pa['error'])){ foreach (($pa['records'] ?? []) as $r0){ $f0 = $r0['fields'] ?? []; $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'alert', 'href'=>(($f0['Link'] ?? '') ?: ''), 'label'=>($f0['Alert'] ?? 'Needs attention'), 'status'=>'alert', 'red'=>!empty($f0['Red']), 'alertId'=>$r0['id']]; } }
echo json_encode(['school'=>$school, 'items'=>$items]); exit;
}

if ($action === 'school_dates_get'){
echo json_encode(['dates'=>jread(school_dir($school).'/_school_dates.json', new stdClass)]); exit;
}
if ($action === 'school_dates_set'){
$sd = jread(school_dir($school).'/_school_dates.json', []); if (!is_array($sd)) $sd = [];
foreach (['license', 'fireinsp', 'healthinsp'] as $k0){ if (array_key_exists($k0, $input)){ $v0 = $input[$k0]; if ($v0 !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v0)) fail('That date is not a real date'); $sd[$k0] = $v0; } }
jwrite(school_dir($school).'/_school_dates.json', $sd); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'alert_close'){
$aid = preg_replace('/[^A-Za-z0-9]/', '', $input['alertId'] ?? ''); if (strpos($aid, 'rec') !== 0) fail('Bad alert');
$res = at_request('PATCH', ['Portal Alerts', $aid], null, ['fields'=>['Status'=>'Resolved']]);
if (!isset($res['id'])) fail('Could not close it right now.', 502); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'summary'){
$out = [];
foreach ($KINDS as $k){
$r = roster($school, $k); if ($r === null) fail('Could not read the roster right now.', 502);
$red = 0; $amber = 0; $sign = 0; $people = 0;
foreach ($r as $p){ if (strpos($p['id'], 'recTEST') === 0) continue; $v = person_view($school, $k, $p['id'], $p); if ($v['red']) $people++; $red += $v['red']; $amber += $v['amber']; if ($k === 'staff') $sign += $v['sign']; }
$out[$k] = ['people'=>count($r), 'peopleMissing'=>$people, 'missing'=>$red, 'soon'=>$amber, 'sign'=>$sign];
}
echo json_encode(['school'=>$school, 'summary'=>$out]); exit;
}
if ($action === 'roster'){
$inact = !empty($input['former']);
$r = roster($school, $kind, $inact); if ($r === null) fail('Could not read the roster right now.', 502);
$list = [];
foreach ($r as $p){ $v = person_view($school, $kind, $p['id'], $p); $list[] = ['id'=>$p['id'], 'name'=>$p['name'], 'sub'=>$p['sub'], 'red'=>$v['red'], 'amber'=>$v['amber'], 'sign'=>$v['sign'] ?? 0, 'left'=>$v['left'], 'driveSort'=>$v['driveSort']]; }
echo json_encode(['school'=>$school, 'kind'=>$kind, 'people'=>$list]); exit;
}

if ($action === 'rooms'){
$res = at_request('GET', ['Rooms'], http_build_query(['filterByFormula'=>"AND({School}='".str_replace("'", "", $school)."',{Active})", 'pageSize'=>50]));
if (isset($res['error'])) fail('Could not read the rooms right now.', 502);
$rows = []; foreach (($res['records'] ?? []) as $r){ $rows[] = [(float)($r['fields']['Order'] ?? 99), (string)($r['fields']['Room'] ?? '')]; }
usort($rows, function($a, $b){ return $a[0] <=> $b[0]; });
echo json_encode(['rooms'=>array_values(array_filter(array_map(function($x){ return $x[1]; }, $rows)))]); exit;
}
if ($action === 'add_person'){
$sc = str_replace("'", "", $school);
if ($kind === 'staff'){
$name = trim(preg_replace('/\s+/', ' ', preg_replace('/[^A-Za-z0-9 .\'-]/', '', $input['name'] ?? '')));
$rl = $input['role'] ?? 'Teacher'; if (!in_array($rl, ['Teacher', 'Director', 'Support'], true)) fail('Pick a role');
if (strlen($name) < 3 || strpos($name, ' ') === false) fail('Enter the first AND last name.');
foreach (roster($school, 'staff') ?: [] as $p){ if (strcasecmp($p['name'], $name) === 0) fail($name.' is already on the staff list.'); }
$res = at_request('POST', ['Staff Roster'], null, ['fields'=>['Name'=>$name, 'School'=>$school, 'Role'=>$rl, 'Active'=>true]]);
} else {
$fn = trim(preg_replace('/[^A-Za-z\'-]/', '', $input['first'] ?? '')); $ln = trim(preg_replace('/[^A-Za-z]/', '', $input['last'] ?? ''));
$dob = $input['dob'] ?? ''; $room = trim($input['room'] ?? '');
if ($fn === '' || $ln === '') fail('Enter the child\'s first name and last name.');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) fail('Enter the date of birth.');
if ($room === '') fail('Pick the room.');
$name = ucfirst($fn).' '.strtoupper(substr($ln, 0, 1)).'.';
foreach (roster($school, 'student') ?: [] as $p){ if (strcasecmp($p['name'], $name) === 0) fail($name.' is already on the roster. Use a different last initial or letter.'); }
$res = at_request('POST', ['Room Children'], null, ['fields'=>['Child'=>$name, 'School'=>$school, 'Room'=>$room, 'DOB'=>$dob, 'Status'=>'Active', 'Order'=>99, 'SR (ELC)'=>(!empty($input['sr']) || !empty($input['atrisk'])), 'At Risk (ELC)'=>!empty($input['atrisk'])]]);
}
if (!isset($res['id'])) fail('Could not add them: '.($res['error']['message'] ?? 'the roster did not accept it').'.', 502);
roster_cache_clear($school);
echo json_encode(['ok'=>true, 'id'=>$res['id'], 'name'=>$name]); exit;
}

if ($action === 'faces'){
if ($kind !== 'student') fail('Cubby labels are for children.');
$r = roster($school, 'student', false); if ($r === null) fail('Could not read the roster right now.', 502);
$list = []; $nophoto = 0; $norelease = 0;
foreach ($r as $p0){
if (strpos($p0['id'], 'recTEST') === 0) continue;
$v = person_view($school, 'student', $p0['id'], $p0);
$fp = pdir($school, 'student', $p0['id']).'/face.jpg';
if (!$v['photoOk']){ $norelease++; continue; }
if (!is_file($fp)){ $nophoto++; continue; }
$list[] = ['id'=>$p0['id'], 'name'=>$p0['name'], 'room'=>$p0['sub'], 'b64'=>base64_encode(file_get_contents($fp))];
}
echo json_encode(['school'=>$school, 'kids'=>$list, 'noPhoto'=>$nophoto, 'noRelease'=>$norelease]); exit;
}

$id = $input['id'] ?? '';
$p = find_person($school, $kind, $id);
if (!$p && !in_array($action, ['getfile'], true)) fail('That person is not on this school\'s roster.', 404);

if ($action === 'person'){ echo json_encode(person_view($school, $kind, $id, $p)); exit; }


if ($action === 'setflag'){
if ($kind !== 'student') fail('Bad request');
if (strpos($id, 'recTEST') === 0) fail('The practice child cannot be flagged.');
$f = [];
if (array_key_exists('sr', $input)) $f['SR (ELC)'] = !empty($input['sr']);
if (array_key_exists('atrisk', $input)) $f['At Risk (ELC)'] = !empty($input['atrisk']);
if (isset($f['SR (ELC)']) && !$f['SR (ELC)']) $f['At Risk (ELC)'] = false;
if (!empty($f['At Risk (ELC)'])) $f['SR (ELC)'] = true;
if (!$f) fail('Nothing to change');
$res = at_request('PATCH', ['Room Children', $id], null, ['fields'=>$f]);
if (!isset($res['id'])) fail('Could not save: '.($res['error']['message'] ?? 'not accepted').'.', 502);
roster_cache_clear($school); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'drive_sort'){
$dv = drive_links($school)[$kind.':'.$id] ?? null;
if (!$dv) fail('This person does not have a Drive folder yet. Ask Mrs. Bear to add one.', 404);
$on = !empty($input['on']);
$res = at_request('PATCH', ['File Drive Links', $dv['rid']], null, ['fields'=>['Needs Sorting'=>$on]]);
if (!isset($res['id'])) fail('Could not save that right now.', 502);
drive_cache_clear($school);
echo json_encode(['ok'=>true, 'on'=>$on]); exit;
}

if ($action === 'upload'){
$doc = $input['doc'] ?? ''; if (!isset($DEFS[$kind][$doc])) fail('Pick which document this is');
$raw = base64_decode($input['b64'] ?? '', true);
if ($raw === false || strlen($raw) < 100) fail('Missing file');
if (strlen($raw) > 10 * 1024 * 1024) fail('File too large (10 MB max). Take the picture again or use a smaller PDF.');
if (substr($raw, 0, 4) === "%PDF") $ext = 'pdf'; elseif (substr($raw, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg'; elseif (substr($raw, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png';
else fail('Only photos (JPG/PNG) and PDF files can be filed. If this is an iPhone HEIC photo, take it with the Take photo button instead.');
$exp = $input['exp'] ?? ''; if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That expiration date is not a real date');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
$pg = 1; foreach ($meta['files'] as $f){ if (($f['doc'] ?? '') === $doc) $pg++; }
$base = clean_name(preg_replace('/\.[A-Za-z0-9]+$/', '', $input['name'] ?? 'page'));
$fname = date('Ymd-His').'_'.$doc.'_p'.$pg.'_'.($base !== '' ? $base : 'page').'.'.$ext;
if (file_put_contents($d.'/'.$fname, $raw) === false) fail('Could not save the file', 500);
$meta['files'][] = ['doc'=>$doc, 'name'=>$fname, 'at'=>gmdate('c'), 'size'=>strlen($raw)];
if (!is_array($meta['docs'])) $meta['docs'] = [];
if ($exp !== '') $meta['docs'][$doc] = array_merge((array)($meta['docs'][$doc] ?? []), ['exp'=>$exp]);
jwrite($mf, $meta);
echo json_encode(['ok'=>true, 'name'=>$fname]); exit;
}
if ($action === 'mark'){
$doc = $input['doc'] ?? ''; if (!isset($DEFS[$kind][$doc])) fail('Bad document');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
if (!is_array($meta['docs'])) $meta['docs'] = [];
$cur = (array)($meta['docs'][$doc] ?? []);
if (!empty($input['on'])){ $cur['done'] = true; $cur['doneAt'] = gmdate('c'); } else { unset($cur['done'], $cur['doneAt']); }
$exp = $input['exp'] ?? null; if ($exp !== null && $exp !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) $cur['exp'] = $exp;
$meta['docs'][$doc] = $cur; jwrite($mf, $meta);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'setexp'){
$doc = $input['doc'] ?? ''; if (!isset($DEFS[$kind][$doc])) fail('Bad document');
$exp = $input['exp'] ?? ''; if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That expiration date is not a real date');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
if (!is_array($meta['docs'])) $meta['docs'] = [];
$meta['docs'][$doc] = array_merge((array)($meta['docs'][$doc] ?? []), ['exp'=>$exp]); jwrite($mf, $meta);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'bio_get'){
$d = pdir($school, 'staff', $id); $b = jread($d.'/bio.json', []); $fp = $d.'/face.jpg';
echo json_encode(['bio'=>$b, 'photo'=>(is_file($fp) ? base64_encode(file_get_contents($fp)) : '')]); exit;
}
if ($action === 'bio_save'){
$d = pdir($school, 'staff', $id); $bf = $d.'/bio.json'; $b = jread($bf, []);
if (isset($input['a']) && is_array($input['a'])){ $ans = []; foreach ($BIO_KEYS as $k){ $ans[$k] = bio_clean($input['a'][$k] ?? '', $k === 'years' ? 4 : 700); } $b['answers'] = $ans; }
if (isset($input['bio'])) $b['bio'] = bio_clean($input['bio'], 1500);
$b['approved'] = !empty($input['approved']) && !empty($b['bio']) && is_file($d.'/face.jpg');
if (!empty($input['approved']) && !$b['approved']) fail('Add a photo and a bio before posting it to families.');
$b['updatedAt'] = gmdate('c'); jwrite($bf, $b);
echo json_encode(['ok'=>true, 'approved'=>$b['approved']]); exit;
}
if ($action === 'face_set'){
if ($kind === 'student'){ $v0 = person_view($school, $kind, $id, $p); if (!$v0['photoOk']) fail('There is no photo release on file for this child yet. Add the Photo / video release first (or tap Mark on file), then add the cubby photo.'); }
$raw = base64_decode($input['b64'] ?? '', true);
if ($raw === false || strlen($raw) < 200 || strlen($raw) > 2 * 1024 * 1024) fail('That picture is missing or too large.');
if (substr($raw, 0, 3) !== "\xFF\xD8\xFF") fail('Please use a JPG photo (the Take photo button makes one).');
$d = pdir($school, $kind, $id);
if (file_put_contents($d.'/face.jpg', $raw) === false) fail('Could not save the picture', 500);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'face_get'){
$f = pdir($school, $kind, $id).'/face.jpg';
if (!is_file($f)) fail('No picture yet', 404);
echo json_encode(['b64'=>base64_encode(file_get_contents($f))]); exit;
}
if ($action === 'face_remove'){
$f = pdir($school, $kind, $id).'/face.jpg';
if (is_file($f)){ $rd = pdir($school, $kind, $id).'/_removed'; if (!is_dir($rd)) @mkdir($rd, 0750, true); @rename($f, $rd.'/'.date('Ymd-His').'_face.jpg'); }
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'getfile'){
$name = basename($input['name'] ?? ''); if (!preg_match('/^[A-Za-z0-9._() &,\'-]+$/', $name)) fail('Bad file');
$d = pdir($school, $kind, $id); $path = $d.'/'.$name;
if (!is_file($path) || $name === 'meta.json' || $name === 'certs.json') fail('File not found', 404);
echo json_encode(['b64'=>base64_encode(file_get_contents($path)), 'name'=>$name]); exit;
}
if ($action === 'remove'){
$name = basename($input['name'] ?? '');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
$keep = []; $hit = false; foreach ($meta['files'] as $f){ if (($f['name'] ?? '') === $name){ $hit = true; } else $keep[] = $f; }
if (!$hit || !is_file($d.'/'.$name)) fail('File not found', 404);
$tr = school_dir($school).'/_removed'; if (!is_dir($tr) && !@mkdir($tr, 0750, true)) fail('Could not remove', 500);
if (!@rename($d.'/'.$name, $tr.'/'.date('Ymd-His').'_'.$kind.'_'.$id.'_'.$name)) fail('Could not remove the file', 500);
$meta['files'] = $keep; jwrite($mf, $meta);
echo json_encode(['ok'=>true]); exit;
}

if ($action === 'remove_person' || $action === 'reinstate_person'){
if (strpos($id, 'recTEST') === 0) fail('The practice person cannot be removed. They are only for trying things out.');
$d = pdir($school, $kind, $id); $mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
if ($action === 'remove_person'){
$why = substr(preg_replace('/[^A-Za-z0-9 \/.,\'-]/', '', $input['reason'] ?? ''), 0, 60); $dt = $input['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dt)) $dt = date('Y-m-d');
if ($kind === 'staff') $f = ['Active'=>false];
else $f = ['Status'=>'Withdrawn', 'Withdrawn Date'=>$dt, 'Withdrawn From Room'=>$p['sub'], 'Withdraw Reason'=>$why, 'KidKare Action'=>'Needs Remove'];
$meta['left'] = ['date'=>$dt, 'reason'=>$why, 'at'=>gmdate('c')];
} else {
if ($kind === 'staff') $f = ['Active'=>true];
else $f = ['Status'=>'Active', 'Withdrawn Date'=>null, 'Withdrawn From Room'=>'', 'Withdraw Reason'=>'', 'KidKare Action'=>null];
unset($meta['left']);
}
$res = at_request('PATCH', [$kind === 'staff' ? 'Staff Roster' : 'Room Children', $id], null, ['fields'=>$f]);
if (!isset($res['id'])) fail('Could not update the roster: '.($res['error']['message'] ?? 'not accepted').'.', 502);
jwrite($mf, $meta); roster_cache_clear($school);
echo json_encode(['ok'=>true]); exit;
}
if ($action === 'cert_sign'){
if ($kind !== 'staff') fail('Bad request');
$cid = preg_replace('/[^A-Za-z0-9]/', '', $input['cid'] ?? '');
$signer = substr(preg_replace('/[^A-Za-z0-9 .\'-]/', '', $input['signer'] ?? ''), 0, 60);
$sig = $input['sig'] ?? '';
if ($signer === '' || strpos($sig, 'data:image/png;base64,') !== 0 || strlen($sig) > 150000) fail('Please sign on the screen and type your name.');
$png = base64_decode(substr($sig, 22), true); if ($png === false || substr($png, 0, 8) !== "\x89PNG\r\n\x1a\n") fail('That signature did not save. Sign again.');
$d = pdir($school, 'staff', $id); $f = $d.'/certs.json'; $certs = jread($f, []); $hit = false;
foreach ($certs as &$c){ if (($c['cid'] ?? '') === $cid){ if (!empty($c['signedAt'])) fail('This certificate is already signed and cannot be changed.'); $c['sig'] = $sig; $c['signer'] = $signer; $c['signedAt'] = gmdate('c'); $hit = true; } } unset($c);
if (!$hit) fail('Certificate not found', 404);
jwrite($f, $certs);
echo json_encode(['ok'=>true]); exit;
}

fail('Unknown action');
