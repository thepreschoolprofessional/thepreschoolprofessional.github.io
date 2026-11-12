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
 'por'   => ['Parent orientation completed (signed)', false, false, 'Marked automatically when the parent finishes orientation'],
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
/* ---- Notifications: plain emails to the school's own office inbox (first name + last initial only, no private details). Failure is silent; the red Needs Attention banner is the main alert. ---- */
function hive_notify($school, $subject, $lines){
$to = ($school === 'Sanford') ? 'sanfordoffice.1320@gmail.com' : 'delandoffice.238@gmail.com';
$body = implode("\n", (array)$lines)."\n\nOpen the director portal to review: https://thepreschoolprofessional.net/hive/\n(This is an automatic note from the Hive. Names are shortened on purpose.)";
$hdr = "From: The Hive <noreply@thepreschoolprofessional.net>\r\nContent-Type: text/plain; charset=utf-8";
$ok = function_exists('mail') ? @mail($to, '=?UTF-8?B?'.base64_encode('[Hive] '.$subject).'?=', $body, $hdr) : false;
$d = school_dir($school); if ($d){ $lf = $d.'/notify-log.json'; $lg = jread($lf, []); $lg[] = ['at'=>gmdate('c'), 'subject'=>$subject, 'sent'=>(bool)$ok]; if (count($lg) > 60) $lg = array_slice($lg, -60); jwrite($lf, $lg); }
return (bool)$ok; }
function short_child($full){ $p = preg_split('/\s+/', trim(preg_replace('/[^A-Za-z\' -]/', ' ', (string)$full))); if (count($p) < 2) return trim((string)$full); return ucfirst(strtolower($p[0])).' '.strtoupper(substr(end($p), 0, 1)).'.'; }
function strip_private($D){ foreach (array_keys($D) as $k){ if (preg_match('/ssn|social|sec(urity)?num/i', (string)$k)) unset($D[$k]); } return $D; }
/* ---- Parent orientation: who is taking it, progress, and filing in the child's folder ---- */
function ori_clean($input){ $t = function($v, $n){ return mb_substr(trim(strip_tags((string)$v)), 0, $n); };
return ['parent'=>$t($input['parent'] ?? '', 60), 'child'=>$t($input['child'] ?? '', 60), 'phone'=>$t($input['phone'] ?? '', 30), 'email'=>$t($input['email'] ?? '', 80), 'rel'=>$t($input['rel'] ?? '', 30)]; }
function ori_upsert($pd, $w, $done, $total, $signed, $isNew){
$o = jread($pd.'/orientation.json', []); $key = strtolower($w['parent'].'|'.$w['child']); $hit = -1;
foreach ($o as $i => $x){ if (strtolower(($x['parent'] ?? '').'|'.($x['child'] ?? '')) === $key && empty($x['signed']) && !$signed) { $hit = $i; break; } if (strtolower(($x['parent'] ?? '').'|'.($x['child'] ?? '')) === $key && empty($x['signed']) && $signed) { $hit = $i; break; } }
if ($hit < 0){ $o[] = ['parent'=>$w['parent'], 'child'=>$w['child'], 'at'=>gmdate('c'), 'date'=>date('Y-m-d'), 'started'=>date('Y-m-d')]; $hit = count($o) - 1; }
$o[$hit] = array_merge($o[$hit], ['phone'=>$w['phone'], 'email'=>$w['email'], 'rel'=>$w['rel'], 'done'=>max((int)($o[$hit]['done'] ?? 0), (int)$done), 'total'=>(int)$total, 'updated'=>gmdate('c')]);
if ($isNew) $o[$hit]['new'] = true;
if ($signed){ $o[$hit]['signed'] = true; $o[$hit]['date'] = date('Y-m-d'); $o[$hit]['at'] = gmdate('c'); if (!isset($o[$hit]['filed'])) $o[$hit]['filed'] = false; }
jwrite($pd.'/orientation.json', $o); return $hit; }
function ori_refile($school){ $pd = pp_dir($school); if (!$pd) return []; $o = jread($pd.'/orientation.json', []); $un = []; $ch = false;
foreach ($o as $i => $x){ if (empty($x['signed']) || !empty($x['filed'])) continue; $id = ori_file($school, ['child'=>$x['child'] ?? '', 'parent'=>$x['parent'] ?? '']); if ($id !== ''){ $o[$i]['filed'] = true; $ch = true; } else $un[] = $x; }
if ($ch) jwrite($pd.'/orientation.json', $o); return $un; }
function ori_file($school, $w){
$parts = preg_split('/\s+/', trim(preg_replace('/[^A-Za-z\' -]/', ' ', $w['child']))); if (count($parts) < 2) return '';
$name = strtolower($parts[0].' '.substr(end($parts), 0, 1).'.'); $m = [];
foreach (roster($school, 'student') ?: [] as $p){ if (strtolower($p['name']) === $name) $m[] = $p; }
if (count($m) !== 1) return ''; $d = pdir($school, 'student', $m[0]['id']); if (!$d) return '';
$mf = $d.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]); if (!is_array($meta['docs'])) $meta['docs'] = [];
$cur = (array)($meta['docs']['por'] ?? []); $cur['done'] = true; $cur['doneAt'] = gmdate('c'); $cur['by'] = $w['parent']; $meta['docs']['por'] = $cur; jwrite($mf, $meta); return $m[0]['id']; }
/* ---- New hires: helpers ---- */
$NH_KEYS = ['a0','a1','a2','a3','a4','b0','b1','c0','c1','c2','c3','c4','c5','c6','c7','d0','d1','d2','d3','d4','d5','d6','d7'];
$NH_TRAIN = ['a0','a1','a2','a3','a4','b0','b1','c0','c1','c2','c3','c4','c5','c6','c7'];
function nh_dir($school){ $d = school_dir($school); if (!$d) return null; $p = $d.'/hires'; if (!is_dir($p)) @mkdir($p, 0750, true); return is_dir($p) ? $p : null; }
function nh_list_all($school){ $d = nh_dir($school); $o = []; if (!$d) return $o; foreach (glob($d.'/nh*.json') ?: [] as $f){ $x = json_decode(file_get_contents($f), true); if (is_array($x)) $o[] = $x; } usort($o, function($a, $b){ return strcmp($b['at'] ?? '', $a['at'] ?? ''); }); return $o; }
function nh_train_done($h){ global $NH_TRAIN; $n = 0; foreach ($NH_TRAIN as $k){ if (!empty($h['steps'][$k])) $n++; } return $n; }
/* ---- PUBLIC: new-hire onboarding (no PIN). Only nh_start, nh_save, nh_packet work without a PIN. ---- */
if (in_array((string)($input['action'] ?? ''), ['nh_start', 'nh_save', 'nh_packet'], true)){
$na = $input['action']; $ns = trim((string)($input['school'] ?? ''));
if (!in_array($ns, $SCHOOLS, true)) fail('Pick a school.');
$rf = sys_get_temp_dir().'/hive_nh_'.md5(($_SERVER['REMOTE_ADDR'] ?? 'x').date('YmdH').$na); $cnt = is_file($rf) ? (int)file_get_contents($rf) : 0;
$lim = ($na === 'nh_save') ? 200 : 15; if ($cnt >= $lim) fail('Too many tries. Please call the school office.', 429); file_put_contents($rf, $cnt + 1);
$nd = nh_dir($ns); if (!$nd) fail('Could not open storage.', 500);
$t = function($v, $n = 300){ return mb_substr(trim(strip_tags((string)$v)), 0, $n); };
if ($na === 'nh_start'){
$nm = $t($input['name'] ?? '', 60); $rl = (string)($input['role'] ?? ''); $cell = $t($input['cell'] ?? '', 30); $em = $t($input['email'] ?? '', 80); $st = $t($input['start'] ?? '', 12);
if (strlen($nm) < 4 || strpos($nm, ' ') === false) fail('Please type your first and last name.');
if (!in_array($rl, ['New hire', 'Intern', 'Volunteer'], true)) fail('Pick New hire, Intern or Volunteer.');
if (strlen(preg_replace('/\D/', '', $cell)) < 7) fail('Please enter your cell phone.');
if (strpos($em, '@') === false) fail('Please enter your email.');
$id = 'nh'.date('ymdHis').substr(md5(uniqid('', true)), 0, 5); $tok = bin2hex(random_bytes(12));
jwrite($nd.'/'.$id.'.json', ['id'=>$id, 'token'=>$tok, 'school'=>$ns, 'name'=>$nm, 'role'=>$rl, 'cell'=>$cell, 'email'=>$em, 'start'=>$st, 'at'=>gmdate('c'), 'updated'=>gmdate('c'), 'status'=>'new', 'steps'=>(object)[], 'packet'=>null]);
hive_notify($ns, 'New hire signed up: '.$nm.' ('.$rl.')', [$nm.' signed up on the new-staff page as '.$rl.'.', 'You can watch their progress in New Hires.']);
echo json_encode(['ok'=>true, 'id'=>$id, 'token'=>$tok]); exit;
}
$id = preg_replace('/[^a-z0-9]/', '', strtolower((string)($input['id'] ?? ''))); $hf = $nd.'/'.$id.'.json';
if (strpos($id, 'nh') !== 0 || !is_file($hf)) fail('We could not find your sign-up. Please sign up again.', 404);
$h = jread($hf, []); if (!hash_equals((string)($h['token'] ?? ''), (string)($input['token'] ?? ''))) fail('That sign-up link is not valid.', 403);
if ($na === 'nh_save'){
$stp = is_array($input['steps'] ?? null) ? $input['steps'] : []; $cur = is_array($h['steps'] ?? null) ? $h['steps'] : [];
foreach ($NH_KEYS as $k){ if (array_key_exists($k, $stp)) $cur[$k] = !empty($stp[$k]); }
$h['steps'] = $cur; $h['updated'] = gmdate('c');
if (nh_train_done($h) >= count($NH_TRAIN) && empty($h['notifiedTrain'])){ $h['notifiedTrain'] = true; hive_notify($ns, 'New hire finished all training steps: '.($h['name'] ?? ''), [($h['name'] ?? '').' ('.($h['role'] ?? '').') ticked every training step. Please check their certificates.']); }
jwrite($hf, $h); echo json_encode(['ok'=>true]); exit;
}
if ($na === 'nh_packet'){
$raw0 = is_array($input['data'] ?? null) ? $input['data'] : []; $D = [];
foreach ($raw0 as $k => $v0){ if (!preg_match('/^[A-Za-z0-9_]{1,30}$/', (string)$k) || is_array($v0)) continue; $D[$k] = $t($v0); if (count($D) >= 400) break; } $D = strip_private($D);
$sp = array_values(array_unique(array_map('intval', (array)($input['sigPages'] ?? [])))); if (count($sp) < 3) fail('Please sign the pages first.');
$pdf = base64_decode((string)($input['pdf'] ?? ''), true); if ($pdf === false || substr($pdf, 0, 4) !== '%PDF' || strlen($pdf) < 20000) fail('The signed packet did not come through. Please try again.');
if (strlen($pdf) > 14 * 1024 * 1024) fail('The packet is too large.');
file_put_contents($nd.'/'.$id.'-packet.pdf', $pdf);
$sg = []; foreach ((is_array($input['sigs'] ?? null) ? $input['sigs'] : []) as $pg => $png){ $pg = (int)$pg; if ($pg < 1 || $pg > 60 || !is_string($png) || strpos($png, 'data:image/png;base64,') !== 0 || strlen($png) > 160000) continue; $sg[$pg] = $png; if (count($sg) >= 30) break; }
jwrite($nd.'/'.$id.'-sigs.json', $sg); @unlink($nd.'/'.$id.'-final.pdf'); unset($h['final']);
$h['packet'] = ['at'=>gmdate('c'), 'pages'=>$sp, 'signer'=>$t($input['signer'] ?? '', 60), 'data'=>$D, 'bytes'=>strlen($pdf)]; $h['updated'] = gmdate('c'); if (($h['status'] ?? '') === 'reviewed') $h['status'] = 'new';
jwrite($hf, $h); hive_notify($ns, 'New hire signed their employee packet: '.($h['name'] ?? ''), [($h['name'] ?? '').' ('.($h['role'] ?? '').') filled in and signed the Employee Packet. It is waiting for your signature in New Hires.']); echo json_encode(['ok'=>true]); exit;
}
fail('Unknown request.');
}
/* ---- PUBLIC: Welcome portal for new / inquiring families (no PIN). Only these wl_ actions work without a PIN. ---- */
if (strpos((string)($input['action'] ?? ''), 'wl_') === 0){
$wa = $input['action']; $ws = trim((string)($input['school'] ?? ''));
if (!in_array($ws, $SCHOOLS, true)) fail('Pick a school.');
if ($wa === 'wl_bios'){
$r = roster($ws, 'staff'); if ($r === null) fail('Could not read the staff list right now.', 502);
$out = []; foreach ($r as $p){ if (strpos($p['id'], 'recTEST') === 0) continue; $row = bio_public_row($ws, $p); if ($row) $out[] = $row; }
echo json_encode(['school'=>$ws, 'staff'=>$out]); exit;
}
/* simple abuse guard: 12 public writes per hour per address */
$rf = sys_get_temp_dir().'/hive_wl_'.md5(($_SERVER['REMOTE_ADDR'] ?? 'x').date('YmdH')); $cnt = is_file($rf) ? (int)file_get_contents($rf) : 0;
if ($cnt >= ($wa === 'wl_orient_start' ? 80 : ($wa === 'wl_orient_sign' ? 40 : 12))) fail('Too many tries. Please call the school office.', 429); file_put_contents($rf, $cnt + 1);
$wd = school_dir($ws); if (!$wd) fail('Could not open storage.', 500);
if ($wa === 'wl_orient_start' || $wa === 'wl_orient_sign'){
$w = ori_clean($input); $signed = ($wa === 'wl_orient_sign');
if (strlen($w['parent']) < 3 || strlen($w['child']) < 2) fail('Please type your full name and your child\'s name.');
if (strlen(preg_replace('/\D/', '', $w['phone'])) < 7 || strpos($w['email'], '@') === false) fail('Please add your phone number and email.');
$pd = pp_dir($ws); if (!$pd) fail('Could not open storage.', 500);
ori_upsert($pd, $w, (int)($input['done'] ?? 0), (int)($input['total'] ?? 9), $signed, true);
$filed = ''; if ($signed){ $filed = ori_file($ws, $w); if ($filed !== ''){ $o2 = jread($pd.'/orientation.json', []); foreach ($o2 as $i2 => $x2){ if (strtolower(($x2['parent'] ?? '').'|'.($x2['child'] ?? '')) === strtolower($w['parent'].'|'.$w['child']) && !empty($x2['signed'])) $o2[$i2]['filed'] = true; } jwrite($pd.'/orientation.json', $o2); } hive_notify($ws, 'Parent orientation signed: '.short_child($w['child']), ['A parent finished and signed Parent Orientation for '.short_child($w['child']).'.', $filed !== '' ? 'It was filed in the Student File automatically.' : 'The child is not on the roster yet (or the name did not match), so it will be filed when the child is added.']); }
echo json_encode(['ok'=>true, 'filed'=>($filed !== '')]); exit;
}
if ($wa === 'wl_register'){
$ed = $wd.'/enroll'; if (!is_dir($ed)) @mkdir($ed, 0750, true); if (!is_dir($ed)) fail('Could not open storage.', 500);
$t = function($v, $n = 300){ return mb_substr(trim(strip_tags((string)$v)), 0, $n); };
$raw0 = is_array($input['data'] ?? null) ? $input['data'] : []; $D = [];
foreach ($raw0 as $k => $v0){ if (!preg_match('/^[A-Za-z0-9_]{1,30}$/', (string)$k) || is_array($v0)) continue; $D[$k] = $t($v0); } $D = strip_private($D);
$cn = trim(preg_replace('/\s+/', ' ', $D['cname'] ?? '')); $parts = explode(' ', $cn);
if ($cn === '' || count($parts) < 2) fail('Please enter your child\'s first and last name.');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $D['dobISO'] ?? '')) fail('Please enter your child\'s date of birth.');
if (($D['p1name'] ?? '') === '' || strlen($D['p1cell'] ?? '') < 7 || strpos($D['p1email'] ?? '', '@') === false) fail('Please enter a parent name, cell phone and email.');
$sp = array_values(array_unique(array_map('intval', (array)($input['sigPages'] ?? [])))); foreach ([1, 2, 5, 10, 11] as $rq) if (!in_array($rq, $sp, true)) fail('Please sign every page that needs a signature.');
$pdf = base64_decode((string)($input['pdf'] ?? ''), true); if ($pdf === false || substr($pdf, 0, 4) !== '%PDF' || strlen($pdf) < 20000) fail('The signed packet did not come through. Please try again.');
if (strlen($pdf) > 14 * 1024 * 1024) fail('The packet is too large. Try without the photos.');
$asv = $input['assist'] ?? []; $as = ['elc'=>(in_array($asv['elc'] ?? '', ['yes', 'no', 'unsure'], true) ? $asv['elc'] : 'unsure'), 'note'=>$t($asv['note'] ?? '', 300)];
$pl = $input['plan'] ?? []; $plan = ['start'=>$t($pl['start'] ?? '', 10), 'schedule'=>$t($pl['schedule'] ?? '', 40)];
$id = 'en'.date('ymdHis').substr(md5(uniqid('', true)), 0, 5);
file_put_contents($ed.'/'.$id.'-packet.pdf', $pdf);
$ph = [];
foreach (['child', 'family'] as $pk0){ $b = $input['photos'][$pk0] ?? ''; if ($b === '') continue; $rw = base64_decode($b, true);
if ($rw === false || strlen($rw) < 200 || strlen($rw) > 2 * 1024 * 1024 || substr($rw, 0, 3) !== "\xFF\xD8\xFF") continue; file_put_contents($ed.'/'.$id.'-'.$pk0.'.jpg', $rw); $ph[$pk0] = true; }
$pk_ = ['id'=>$id, 'school'=>$ws, 'at'=>gmdate('c'), 'status'=>'new', 'child'=>['first'=>$parts[0], 'last'=>end($parts), 'dob'=>$D['dobISO']], 'parents'=>[['name'=>$D['p1name'], 'phone'=>$D['p1cell'], 'email'=>$D['p1email']]], 'data'=>$D, 'assist'=>$as, 'plan'=>$plan, 'sigPages'=>$sp, 'signer'=>$t($input['signer'] ?? '', 60), 'photos'=>$ph, 'photoRelease'=>(($D['photo'] ?? '') === 'yes' || ($D['photo'] ?? '') === 'class'), 'pdf'=>true];
jwrite($ed.'/'.$id.'.json', $pk_);
hive_notify($ws, 'New enrollment packet: '.short_child($cn), ['A family finished and signed the registration packet for '.short_child($cn).'.', 'Review it under New Enrollments and approve it to add the child to the roster.']);
echo json_encode(['ok'=>true, 'id'=>$id]); exit;
}
fail('Unknown request.');
}
/* ---- Server-to-server only (from elc-sync.php, authorised by the private ELC sync code): what a child added on the ELC tablet still needs ---- */
if (($input['action'] ?? '') === 'elc_catchup'){
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
if (!defined('ELC_SYNC_CODE') || !hash_equals(ELC_SYNC_CODE, (string)($input['code'] ?? ''))) fail('Not allowed.', 403);
$cs = (($input['school'] ?? '') === 'sanford') ? 'Sanford' : 'DeLand 2';
$cf = strtolower(preg_replace('/[^A-Za-z]/', '', (string)($input['first'] ?? ''))); $ci = strtolower(preg_replace('/[^A-Za-z]/', '', (string)($input['ini'] ?? '')));
if ($cf === '' || $ci === '') fail('Bad child.');
roster_cache_clear($cs);
$rs = roster($cs, 'student'); if ($rs === null) fail('Could not read the roster.', 502);
$hit = null;
foreach ($rs as $p0){ if (strpos($p0['id'], 'recTEST') === 0) continue; $w = preg_split('/\s+/', trim($p0['name'])); $f0 = strtolower(preg_replace('/[^A-Za-z]/', '', $w[0] ?? '')); $l0 = strtolower(preg_replace('/[^A-Za-z]/', '', end($w) ?: '')); if ($f0 === $cf && substr($l0, 0, 1) === $ci){ $hit = $p0; break; } }
$out = ['found'=>false, 'missing'=>[], 'amber'=>[], 'enroll'=>[], 'sr'=>false];
foreach (en_list_all($cs) as $x){ $fx = strtolower(preg_replace('/[^A-Za-z]/', '', (string)($x['child']['first'] ?? ''))); $lx = strtolower(preg_replace('/[^A-Za-z]/', '', (string)($x['child']['last'] ?? ''))); if ($fx === $cf && substr($lx, 0, 1) === $ci) $out['enroll'][] = ['status'=>($x['status'] ?? 'new'), 'at'=>substr((string)($x['at'] ?? ''), 0, 10)]; }
if ($hit){
$v = person_view($cs, 'student', $hit['id'], $hit); $out['found'] = true; $out['sr'] = !empty($v['sr']);
foreach ($v['docs'] as $dd){
if ($dd['status'] === 'missing' || $dd['status'] === 'expired') $out['missing'][] = ($dd['status'] === 'expired' ? 'EXPIRED: ' : '').$dd['label'];
elseif ($dd['status'] === 'soon' || $dd['status'] === 'needdate') $out['amber'][] = $dd['label'].($dd['status'] === 'needdate' ? ' (enter the date)' : ' (expires soon)');
}
}
$nm = ucfirst($cf).' '.strtoupper($ci).'.';
$ln = [$nm.' was just added to the ELC list on the tablet by a director or the owner.'];
if (!$out['found']) $ln[] = 'They are not on the Rooms board yet. Add them there first (room, birth date) so Student Files can track them.';
else { $ln[] = count($out['missing']).' required item(s) are missing or expired in Student Files.'; foreach (array_slice($out['missing'], 0, 25) as $m0) $ln[] = ' - '.$m0; }
if ($out['enroll']) $ln[] = 'An online enrollment packet is on file (status: '.$out['enroll'][0]['status'].').'; else $ln[] = 'No online enrollment packet found for this child.';
$ln[] = 'Also: add them in ProCare and KidKare, and get their Free & Reduced application and Food Program enrollment.';
$out['mailed'] = hive_notify($cs, 'ELC child added: '.$nm.' - paperwork to catch up', $ln);
echo json_encode($out); exit;
}
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right. Double-check with Mrs. Bear.', 401);
$role = $pins[$pin];
$action = $input['action'] ?? '';
$TEACHER_SCHOOL = ['teacher-sanford' => 'Sanford', 'teacher-deland' => 'DeLand 2'];
$isDir = isset($ROLE_SCHOOL[$role]);
$isTeacher = (strpos($role, 'teacher') === 0);
$isParent = (strpos($role, 'parent') === 0);
if ($isParent && !in_array(($input['action'] ?? ''), ['bios_public', 'pp_list', 'pp_get', 'pp_orient_sign', 'pp_orient_start', 'pp_auto', 'pp_ev_list', 'pp_ev_claim', 'pp_doc_send'], true)) fail('Files are only available with a director PIN.', 403);
if (!$isDir && !$isTeacher && !$isParent) fail('Files are only available with a director PIN.', 403);
$PARENT_SCHOOL = ['parent-sanford' => 'Sanford', 'parent-deland' => 'DeLand 2'];
$school = $isDir ? $ROLE_SCHOOL[$role] : (isset($TEACHER_SCHOOL[$role]) ? $TEACHER_SCHOOL[$role] : (isset($PARENT_SCHOOL[$role]) ? $PARENT_SCHOOL[$role] : trim($input['school'] ?? '')));
if (!in_array($school, $SCHOOLS, true)) fail('Pick your school first.');

if ($action === 'whoami'){ echo json_encode(['role'=>$isDir ? 'director' : 'teacher', 'school'=>$school]); exit; }
/* ---- Parent document uploads (built 11/11/26). Parents send a document from the Parent Portal; it waits in a private holding area
   (hive-vault/<school>/uploads/) until a director checks it and files it in the child's Student File (or keeps it under Pending Enrollment). Never public. ---- */
$UP_TYPES = ['imm'=>'Immunization record (DH 680 / 681)', 'phys'=>'Physical exam (DH 3040)', 'pid'=>'Parent ID copy', 'allg'=>'Allergy / special needs care plan', 'dmed'=>'Medical statement / dietary request', 'medauth'=>'Medication authorization', 'elcpay'=>'ELC / School Readiness payment certificate', 'elc'=>'Other ELC / 4C paperwork', 'fr'=>'Free & reduced meal application', 'cust'=>'Custody / court papers', 'other'=>'Something else'];
function up_dir($school){ $d = school_dir($school); if (!$d) return null; $p = $d.'/uploads'; if (!is_dir($p)) @mkdir($p, 0750, true); return is_dir($p) ? $p : null; }
function up_all($school){ $d = up_dir($school); $o = []; if (!$d) return $o; foreach (glob($d.'/up*.json') ?: [] as $f){ $x = json_decode(file_get_contents($f), true); if (is_array($x) && !empty($x['id'])) $o[] = $x; } usort($o, function($a, $b){ return strcmp((string)$b['at'], (string)$a['at']); }); return $o; }
function up_find($school, $id){ $id = preg_replace('/[^a-z0-9]/', '', strtolower((string)$id)); if ($id === '') return [null, null]; $d = up_dir($school); if (!$d) return [null, null]; $f = $d.'/'.$id.'.json'; if (!is_file($f)) return [null, null]; $x = json_decode(file_get_contents($f), true); return is_array($x) ? [$x, $f] : [null, null]; }
function up_path($school, $x){ $d = up_dir($school); if (!empty($x['pend'])) return $d.'/pending/'.preg_replace('/[^a-z0-9-]/', '', (string)$x['pend']).'/'.basename((string)$x['file']); return $d.'/'.basename((string)$x['file']); }
function up_sniff($raw){ if (substr($raw, 0, 4) === "%PDF") return 'pdf'; if (substr($raw, 0, 3) === "\xFF\xD8\xFF") return 'jpg'; if (substr($raw, 0, 8) === "\x89PNG\r\n\x1a\n") return 'png'; return ''; }
if ($action === 'pp_doc_send'){
if (!$isParent) fail('Only families can send documents here.', 403);
$parent = pp_txt($input['parent'] ?? '', 80); $child = pp_txt($input['child'] ?? '', 80); $key = (string)($input['doc'] ?? ''); $other = pp_txt($input['other'] ?? '', 80);
if ($parent === '') fail('Please type your name.'); if ($child === '') fail("Please type your child's name."); if (!isset($UP_TYPES[$key])) fail('Pick which document you are sending.');
if ($key === 'other' && $other === '') fail('Please type what the document is.');
$raw = base64_decode($input['b64'] ?? '', true); if ($raw === false || strlen($raw) < 100) fail('Please choose a file or take a photo first.');
if (strlen($raw) > 10 * 1024 * 1024) fail('That file is too large (10 MB max). Take the picture again or send a smaller PDF.');
$ext = up_sniff($raw); if ($ext === '') fail('Please send a photo (JPG or PNG) or a PDF.');
$d = up_dir($school); if (!$d) fail('The server could not save this. Please tell the office.', 500);
$ip = md5(($_SERVER['REMOTE_ADDR'] ?? '').'hive'); $recent = 0; foreach (up_all($school) as $q){ if (($q['ip'] ?? '') === $ip && ($q['status'] ?? '') === 'new' && strtotime((string)$q['at']) > time() - 3600) $recent++; }
if ($recent >= 15) fail('That is a lot of files at once. Please wait a little while and try again, or bring them to the office.', 429);
$id = 'up'.substr(md5(uniqid('', true)), 0, 10);
if (file_put_contents($d.'/'.$id.'.'.$ext, $raw) === false) fail('Could not save the file', 500);
$rec = ['id'=>$id, 'at'=>gmdate('c'), 'parent'=>$parent, 'child'=>$child, 'doc'=>$key, 'other'=>($key === 'other' ? $other : ''), 'file'=>$id.'.'.$ext, 'ext'=>$ext, 'size'=>strlen($raw), 'orig'=>clean_name($input['name'] ?? ''), 'status'=>'new', 'ip'=>$ip];
jwrite($d.'/'.$id.'.json', $rec);
hive_notify($school, 'Parent document waiting: '.short_child($child), ['A parent sent a document through the Parent Portal: '.$UP_TYPES[$key].($key === 'other' ? ' ('.$other.')' : '').' for '.short_child($child).'.', 'Open Parent Uploads in the director portal to check it and file it.']);
echo json_encode(['ok'=>true]); exit;
}
if (strpos($action, 'up_') === 0){
if (!$isDir) fail('Only a director can review uploads.', 403);
if ($action === 'up_list'){
$o = []; foreach (up_all($school) as $x){ $o[] = ['id'=>$x['id'], 'at'=>$x['at'], 'parent'=>$x['parent'], 'child'=>$x['child'], 'doc'=>$x['doc'], 'label'=>($x['doc'] === 'other' ? ($x['other'] ?: 'Something else') : ($UP_TYPES[$x['doc']] ?? $x['doc'])), 'ext'=>$x['ext'], 'status'=>$x['status'], 'note'=>$x['note'] ?? '', 'filedTo'=>$x['filedTo'] ?? '', 'filedDoc'=>$x['filedDoc'] ?? '', 'pendName'=>$x['pendName'] ?? '', 'by'=>$x['by'] ?? '', 'on'=>$x['on'] ?? '']; }
echo json_encode(['school'=>$school, 'items'=>$o]); exit;
}
if ($action === 'up_children'){
$r = roster($school, 'student'); if ($r === null) fail('Could not read the roster right now. Try again in a minute.', 502);
$kids = []; foreach ($r as $p){ $kids[] = ['id'=>$p['id'], 'name'=>$p['name'], 'sub'=>$p['sub']]; }
$docs = []; foreach ($DEFS['student'] as $k => $df){ $docs[] = ['key'=>$k, 'label'=>$df[0], 'exp'=>$df[1]]; }
echo json_encode(['kids'=>$kids, 'docs'=>$docs]); exit;
}
list($x, $xf) = up_find($school, $input['id'] ?? '');
if (!$x) fail('That upload was not found.', 404);
if ($action === 'up_file'){ $f = up_path($school, $x); if (!is_file($f)) fail('The file is missing.', 404); echo json_encode(['b64'=>base64_encode(file_get_contents($f)), 'ext'=>$x['ext']]); exit; }
if ($action === 'up_approve'){
if (!in_array($x['status'], ['new', 'pending'], true)) fail('That upload was already handled.');
$src = up_path($school, $x); if (!is_file($src)) fail('The file is missing.', 404);
$mode = (string)($input['mode'] ?? 'child');
if ($mode === 'pending'){
$nm = pp_txt($input['name'] ?? '', 80); if ($nm === '') fail("Type the child's name for the Pending Enrollment folder.");
$slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($nm)), '-'); if ($slug === '') fail('That name does not work as a folder name.');
$dest = up_dir($school).'/pending/'.$slug; if (!is_dir($dest) && !@mkdir($dest, 0750, true)) fail('Could not create the folder', 500);
if ($x['status'] === 'new'){ if (!@rename($src, $dest.'/'.basename($x['file']))) fail('Could not move the file', 500); }
elseif (($x['pend'] ?? '') !== $slug){ if (!@rename($src, $dest.'/'.basename($x['file']))) fail('Could not move the file', 500); }
$x['status'] = 'pending'; $x['pend'] = $slug; $x['pendName'] = $nm; $x['by'] = 'Director'; $x['on'] = gmdate('c'); jwrite($xf, $x);
echo json_encode(['ok'=>true]); exit;
}
$cid = (string)($input['childId'] ?? ''); $dk = (string)($input['docKey'] ?? '');
if (!isset($DEFS['student'][$dk])) fail('Pick which document this is.');
$p = find_person($school, 'student', $cid); if (!$p) fail('Pick the child from the list.');
$exp = (string)($input['exp'] ?? ''); if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That expiration date is not a real date');
$raw = file_get_contents($src); $ext = up_sniff($raw); if ($ext === '') fail('This file type cannot be filed.');
$pd = pdir($school, 'student', $cid); $mf = $pd.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]);
$pg = 1; foreach ($meta['files'] as $f0){ if (($f0['doc'] ?? '') === $dk) $pg++; }
$fname = date('Ymd-His').'_'.$dk.'_p'.$pg.'_parent-upload.'.$ext;
if (file_put_contents($pd.'/'.$fname, $raw) === false) fail('Could not save the file', 500);
$meta['files'][] = ['doc'=>$dk, 'name'=>$fname, 'at'=>gmdate('c'), 'size'=>strlen($raw)];
if (!is_array($meta['docs'])) $meta['docs'] = [];
if ($exp !== '') $meta['docs'][$dk] = array_merge((array)($meta['docs'][$dk] ?? []), ['exp'=>$exp]);
jwrite($mf, $meta); drive_cache_clear($school);
@unlink($src);
$x['status'] = 'filed'; $x['filedTo'] = $p['name']; $x['filedDoc'] = $DEFS['student'][$dk][0]; $x['by'] = 'Director'; $x['on'] = gmdate('c'); unset($x['pend']); jwrite($xf, $x);
echo json_encode(['ok'=>true, 'filedTo'=>$p['name']]); exit;
}
if ($action === 'up_reject'){
if (!in_array($x['status'], ['new', 'pending'], true)) fail('That upload was already handled.');
$src = up_path($school, $x); $rd = up_dir($school).'/_removed'; if (!is_dir($rd)) @mkdir($rd, 0750, true);
if (is_file($src)) @rename($src, $rd.'/'.basename($x['file']));
$x['status'] = 'rejected'; $x['note'] = pp_txt($input['note'] ?? '', 300); $x['by'] = 'Director'; $x['on'] = gmdate('c'); unset($x['pend']); jwrite($xf, $x);
echo json_encode(['ok'=>true]); exit;
}
fail('Unknown action.');
}
/* ---- Parent portal content: menu, newsletter, lesson plans, flyers, message board.
   Parents, teachers and directors can READ. Only directors (and the owner through a director door) can change anything. ---- */
function pp_dir($school){ $d = school_dir($school); if (!$d) return null; $p = $d.'/parent'; if (!is_dir($p)) @mkdir($p, 0750, true); return is_dir($p) ? $p : null; }
function pp_txt($v, $max){ $v = strip_tags((string)$v); $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v); return mb_substr(trim($v), 0, $max); }
function pp_status_list($school){
$d = pp_dir($school); $it = $d ? jread($d.'/items.json', []) : []; $out = [];
$months = [date('Y-m')]; if ((int)date('j') >= 25) $months[] = date('Y-m', strtotime('first day of next month'));
foreach ([['menu', 'menu'], ['newsletter', 'newsletter']] as $k){
foreach ($months as $m){ $have = false; foreach ($it as $x){ if (($x['kind'] ?? '') === $k[0] && ($x['month'] ?? '') === $m) $have = true; }
$out[] = ['kind'=>$k[0], 'label'=>$k[1], 'month'=>$m, 'monthName'=>date('F', strtotime($m.'-01')), 'ok'=>$have]; }
}
return $out;
}
if ($action === 'rn_list' || $action === 'rn_set'){
$d = school_dir($school); if (!$d) fail('Could not open storage.', 500); $nf = $d.'/room-notes.json'; $n = jread($nf, []);
if ($action === 'rn_set'){
if (!$isDir) fail('Only an owner or director can post staff notes.', 403);
$room = trim((string)($input['room'] ?? 'ALL')); if ($room === '' || strlen($room) > 60) fail('Pick a room');
$txt = mb_substr(trim(strip_tags((string)($input['text'] ?? ''))), 0, 300); $until = $input['until'] ?? '';
if ($until !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $until)) fail('That date is not a real date');
if ($txt === '') unset($n[$room]); else $n[$room] = ['text'=>$txt, 'by'=>mb_substr(trim(strip_tags((string)($input['by'] ?? 'Director'))), 0, 40), 'at'=>gmdate('c'), 'until'=>$until];
jwrite($nf, $n);
}
$today = date('Y-m-d'); foreach ($n as $k => $v){ if (!empty($v['until']) && $v['until'] < $today) unset($n[$k]); }
echo json_encode(['notes'=>(object)$n]); exit;
}
/* ---- System check (directors): is every connection working? ---- */
if ($action === 'sys_check' || $action === 'sys_test_mail'){
if (!$isDir) fail('Directors only.', 403);
if ($action === 'sys_test_mail'){ $ok = hive_notify($school, 'Test notification', ['This is a test from the System Check page. If you can read this, Hive email alerts reach this inbox.']); echo json_encode(['sent'=>$ok, 'to'=>($school === 'Sanford' ? 'sanfordoffice.1320@gmail.com' : 'delandoffice.238@gmail.com')]); exit; }
$sd = school_dir($school); $out = [];
$out[] = ['k'=>'Private vault (where signed packets are kept)', 'ok'=>(bool)($sd && is_writable($sd)), 'note'=>($sd ? 'Writable' : 'Cannot write')];
$pins = get_pins(); $out[] = ['k'=>'PIN list (Airtable Portal Access)', 'ok'=>count($pins) > 0, 'note'=>count($pins).' PINs loaded'];
$rs = roster($school, 'staff'); $rc = roster($school, 'student');
$out[] = ['k'=>'Staff list (Airtable Staff Roster)', 'ok'=>$rs !== null, 'note'=>($rs !== null ? count($rs).' active staff' : 'Could not read')];
$out[] = ['k'=>'Child roster (Airtable Room Children)', 'ok'=>$rc !== null, 'note'=>($rc !== null ? count($rc).' active children' : 'Could not read')];
$en = en_list_all($school); $nhs = nh_list_all($school); $pdx = pp_dir($school); $oo = $pdx ? jread($pdx.'/orientation.json', []) : [];
$out[] = ['k'=>'New enrollments waiting', 'ok'=>true, 'note'=>count(array_filter($en, function($x){ return ($x['status'] ?? '') === 'new'; })).' waiting, '.count($en).' total'];
$out[] = ['k'=>'New hires', 'ok'=>true, 'note'=>count(array_filter($nhs, function($x){ return ($x['status'] ?? 'new') === 'new'; })).' active, '.count($nhs).' total'];
$out[] = ['k'=>'Parent orientation', 'ok'=>true, 'note'=>count(array_filter($oo, function($x){ return !empty($x['signed']); })).' signed, '.count(array_filter($oo, function($x){ return empty($x['signed']); })).' in progress'];
$lg = $sd ? jread($sd.'/notify-log.json', []) : []; $last = $lg ? end($lg) : null;
$out[] = ['k'=>'Email alerts to the school office', 'ok'=>function_exists('mail') && (!$last || !empty($last['sent'])), 'note'=>($last ? 'Last: '.$last['subject'].' ('.($last['sent'] ? 'sent' : 'FAILED').' '.substr($last['at'], 0, 10).')' : 'None sent yet. Use the test button.')];
echo json_encode(['school'=>$school, 'checks'=>$out]); exit;
}
/* ---- New hires (directors only) ---- */
if (strpos($action, 'nh_') === 0){
if (!$isDir) fail('Only a director can see New Hires.', 403);
$nd = nh_dir($school); if (!$nd) fail('Could not open storage.', 500);
if ($action === 'nh_list'){ $o = []; foreach (nh_list_all($school) as $h){ $o[] = ['id'=>$h['id'], 'name'=>$h['name'], 'role'=>$h['role'], 'status'=>$h['status'] ?? 'new', 'at'=>$h['at'], 'updated'=>$h['updated'] ?? $h['at'], 'start'=>$h['start'] ?? '', 'train'=>nh_train_done($h), 'trainTotal'=>count($NH_TRAIN), 'final'=>!empty($h['final']), 'packet'=>!empty($h['packet']), 'packetAt'=>$h['packet']['at'] ?? '']; } echo json_encode(['items'=>$o]); exit; }
$id = preg_replace('/[^a-z0-9]/', '', strtolower((string)($input['id'] ?? ''))); $hf = $nd.'/'.$id.'.json';
if (strpos($id, 'nh') !== 0 || !is_file($hf)) fail('That new hire was not found.', 404);
$h = jread($hf, []);
if ($action === 'nh_get'){ unset($h['token']); echo json_encode(['hire'=>$h]); exit; }
if ($action === 'nh_sigs'){ echo json_encode(['sigs'=>(object)jread($nd.'/'.$id.'-sigs.json', [])]); exit; }
if ($action === 'nh_final'){
$pdf = base64_decode((string)($input['pdf'] ?? ''), true); if ($pdf === false || substr($pdf, 0, 4) !== '%PDF' || strlen($pdf) < 20000) fail('The signed packet did not come through. Please try again.');
if (strlen($pdf) > 14 * 1024 * 1024) fail('The packet is too large.');
file_put_contents($nd.'/'.$id.'-final.pdf', $pdf); $h['final'] = ['at'=>gmdate('c'), 'by'=>mb_substr(trim(strip_tags((string)($input['by'] ?? 'Director'))), 0, 60)]; if (($h['status'] ?? '') === 'new') $h['status'] = 'reviewed'; jwrite($hf, $h); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'nh_pdf'){ $f = $nd.'/'.$id.'-packet.pdf'; if (!empty($input['final']) && is_file($nd.'/'.$id.'-final.pdf')) $f = $nd.'/'.$id.'-final.pdf'; if (!is_file($f)) fail('No packet PDF yet.', 404); echo json_encode(['b64'=>base64_encode(file_get_contents($f))]); exit; }
if ($action === 'nh_archive'){ $h['status'] = !empty($input['undo']) ? 'new' : 'archived'; jwrite($hf, $h); echo json_encode(['ok'=>true]); exit; }
if ($action === 'nh_reviewed'){ $h['status'] = 'reviewed'; jwrite($hf, $h); echo json_encode(['ok'=>true]); exit; }
if ($action === 'nh_add'){
if (!empty($h['staffRec'])) fail('Already added to Staff Files.');
$rl = $input['role'] ?? 'Teacher'; if (!in_array($rl, ['Teacher', 'Director', 'Support'], true)) fail('Pick a role');
$name = trim(preg_replace('/\s+/', ' ', preg_replace('/[^A-Za-z0-9 .\'-]/', '', $h['name'])));
if (strlen($name) < 3 || strpos($name, ' ') === false) fail('The name needs a first and last name.');
foreach (roster($school, 'staff') ?: [] as $p){ if (strcasecmp($p['name'], $name) === 0) fail($name.' is already on the staff list.'); }
$res = at_request('POST', ['Staff Roster'], null, ['fields'=>['Name'=>$name, 'School'=>$school, 'Role'=>$rl, 'Active'=>true]]);
if (!isset($res['id'])) fail('Could not add them: '.($res['error']['message'] ?? 'the roster did not accept it').'.', 502);
roster_cache_clear($school); $pd = pdir($school, 'staff', $res['id']); $pf2 = $nd.'/'.$id.'-packet.pdf'; if (is_file($nd.'/'.$id.'-final.pdf')) $pf2 = $nd.'/'.$id.'-final.pdf'; $filed = false;
if (is_file($pf2) && $pd){ $fn2 = date('Ymd-His').'_new-hire-packet_'.$id.'.pdf'; if (@copy($pf2, $pd.'/'.$fn2)){ $mf = $pd.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]); if (!is_array($meta['files'])) $meta['files'] = [];
$keys = ['app', 'priv', 'can', 'coc', 'emg', 'hns']; if (($h['role'] ?? '') === 'New hire') $keys[] = 'ref';
foreach ($keys as $dk){ $meta['files'][] = ['doc'=>$dk, 'name'=>$fn2, 'at'=>gmdate('c'), 'size'=>filesize($pf2)]; } jwrite($mf, $meta); $filed = true; } }
$h['status'] = 'added'; $h['staffRec'] = $res['id']; $h['addedAt'] = gmdate('c'); jwrite($hf, $h); echo json_encode(['ok'=>true, 'name'=>$name, 'filed'=>$filed]); exit;
}
fail('Unknown request.');
}
/* ---- Enrollment inbox (directors only): packets from the Welcome portal ---- */
function en_dir($school){ $d = school_dir($school); if (!$d) return null; $p = $d.'/enroll'; if (!is_dir($p)) @mkdir($p, 0750, true); return is_dir($p) ? $p : null; }
function en_list_all($school){ $d = en_dir($school); $o = []; if (!$d) return $o; foreach (glob($d.'/en*.json') ?: [] as $f){ $x = json_decode(file_get_contents($f), true); if (is_array($x)) $o[] = $x; } usort($o, function($a, $b){ return strcmp($b['at'] ?? '', $a['at'] ?? ''); }); return $o; }
if (strpos($action, 'en_') === 0){
if (!$isDir) fail('Only a director can use Enrollment.', 403);
$d = en_dir($school); if (!$d) fail('Could not open the enrollment storage.', 500);
if ($action === 'en_list'){ $o = []; foreach (en_list_all($school) as $x){ $o[] = ['id'=>$x['id'], 'at'=>$x['at'], 'status'=>$x['status'], 'name'=>($x['child']['first'] ?? '').' '.($x['child']['last'] ?? ''), 'dob'=>$x['child']['dob'] ?? '', 'parent'=>$x['parents'][0]['name'] ?? '', 'elc'=>($x['assist']['elc'] ?? ''), 'start'=>$x['plan']['start'] ?? '']; } echo json_encode(['items'=>$o]); exit; }
$id = preg_replace('/[^a-z0-9]/', '', strtolower($input['id'] ?? '')); $pf = $d.'/'.$id.'.json';
if ($id === '' || !is_file($pf)) fail('That packet was not found.', 404);
$pk = jread($pf, []);
if ($action === 'en_get'){
$files = []; foreach (glob($d.'/'.$id.'-*') ?: [] as $f){ if (substr($f, -4) === '.pdf') continue; $files[basename($f)] = base64_encode(file_get_contents($f)); }
$ori = ['state'=>'none']; $pdo = pp_dir($school); $fn0 = strtolower($pk['child']['first'] ?? '');
foreach (($pdo ? jread($pdo.'/orientation.json', []) : []) as $ox){ $cf = strtolower(preg_split('/\s+/', trim($ox['child'] ?? ''))[0] ?? ''); if ($cf !== '' && $cf === $fn0){ if (!empty($ox['signed'])){ $ori = ['state'=>'signed', 'date'=>$ox['date'] ?? '', 'parent'=>$ox['parent'] ?? '']; break; } $ori = ['state'=>'started', 'done'=>(int)($ox['done'] ?? 0), 'total'=>(int)($ox['total'] ?? 9), 'parent'=>$ox['parent'] ?? '']; } }
echo json_encode(['packet'=>$pk, 'files'=>(object)$files, 'orient'=>$ori]); exit;
}
if ($action === 'en_pdf'){ $f = $d.'/'.$id.'-packet.pdf'; if (!is_file($f)) fail('No packet PDF.', 404); echo json_encode(['b64'=>base64_encode(file_get_contents($f))]); exit; }
if ($action === 'en_approve'){
if (($pk['status'] ?? '') === 'approved') fail('Already approved.');
$room = trim((string)($input['room'] ?? '')); if ($room === '') fail('Pick the room first.');
$c = $pk['child']; $fn = trim(preg_replace('/[^A-Za-z\'-]/', '', $c['first'])); $ln = trim(preg_replace('/[^A-Za-z]/', '', $c['last']));
if ($fn === '' || $ln === '') fail('The child name needs letters. Edit it on paper and add them in Rooms.');
$name = ucfirst($fn).' '.strtoupper(substr($ln, 0, 1)).'.';
foreach (roster($school, 'student') ?: [] as $p){ if (strcasecmp($p['name'], $name) === 0) fail($name.' is already on the roster. Add a different letter in Rooms or decline this packet.'); }
$sr = (($pk['assist']['elc'] ?? '') === 'yes');
$res = at_request('POST', ['Room Children'], null, ['fields'=>['Child'=>$name, 'School'=>$school, 'Room'=>$room, 'DOB'=>$c['dob'], 'Status'=>'Active', 'Order'=>99, 'SR (ELC)'=>$sr]]);
if (!isset($res['id'])) fail('Could not add the child: '.($res['error']['message'] ?? 'the roster did not accept it').'.', 502);
roster_cache_clear($school);
$pd = pdir($school, 'student', $res['id']);
if (!empty($pk['photos']['child']) && is_file($d.'/'.$id.'-child.jpg') && !empty($pk['photoRelease'])) @copy($d.'/'.$id.'-child.jpg', $pd.'/face.jpg');
$pf2 = $d.'/'.$id.'-packet.pdf';
if (is_file($pf2)){ $fn2 = date('Ymd-His').'_registration-packet_'.$id.'.pdf'; if (@copy($pf2, $pd.'/'.$fn2)){ $mf = $pd.'/meta.json'; $meta = jread($mf, ['docs'=>[], 'files'=>[]]); if (!is_array($meta['files'])) $meta['files'] = [];
foreach (['reg', 'med', 'em', 'special', 'nut', 'photo', 'foodp', 'fin', 'hb'] as $dk){ if ($dk === 'photo' && empty($pk['photoRelease']) && ($pk['data']['photo'] ?? '') !== 'no') continue; $meta['files'][] = ['doc'=>$dk, 'name'=>$fn2, 'at'=>gmdate('c'), 'size'=>filesize($pf2)]; }
jwrite($mf, $meta); $pk['filed'] = true; } }
$pk['status'] = 'approved'; $pk['approvedAt'] = gmdate('c'); $pk['approvedRoom'] = $room; $pk['childRec'] = $res['id']; $pk['childName'] = $name;
jwrite($pf, $pk); ori_refile($school); echo json_encode(['ok'=>true, 'name'=>$name, 'recId'=>$res['id'], 'sr'=>$sr]); exit;
}
if ($action === 'en_decline'){ $pk['status'] = 'declined'; $pk['note'] = mb_substr(trim(strip_tags((string)($input['note'] ?? ''))), 0, 300); jwrite($pf, $pk); echo json_encode(['ok'=>true]); exit; }
if ($action === 'en_done'){ $k = preg_replace('/[^a-z]/', '', (string)($input['step'] ?? '')); if (!in_array($k, ['food', 'procare', 'welcome', 'cert', 'notary', 'id'], true)) fail('Unknown step'); $pk['steps'][$k] = !empty($input['on']); jwrite($pf, $pk); echo json_encode(['ok'=>true]); exit; }
fail('Unknown request.');
}
if ($action === 'pp_orient_sign' || $action === 'pp_orient_start'){
if (!$isParent) fail('Only a parent signs the orientation.', 403);
$d = pp_dir($school); if (!$d) fail('Could not open the parent portal storage.', 500);
$w = ori_clean($input); $signed = ($action === 'pp_orient_sign');
if (strlen($w['parent']) < 3 || strlen($w['child']) < 2) fail('Please type your full name and your child\'s name.');
if (strlen(preg_replace('/\D/', '', $w['phone'])) < 7 || strpos($w['email'], '@') === false) fail('Please add your phone number and email.');
ori_upsert($d, $w, (int)($input['done'] ?? 0), (int)($input['total'] ?? 9), $signed, false);
$filed = ''; if ($signed){ $filed = ori_file($school, $w); if ($filed !== ''){ $o2 = jread($d.'/orientation.json', []); foreach ($o2 as $i2 => $x2){ if (strtolower(($x2['parent'] ?? '').'|'.($x2['child'] ?? '')) === strtolower($w['parent'].'|'.$w['child']) && !empty($x2['signed'])) $o2[$i2]['filed'] = true; } jwrite($d.'/orientation.json', $o2); } hive_notify($school, 'Parent orientation signed: '.short_child($w['child']), ['A parent finished and signed Parent Orientation for '.short_child($w['child']).'.', $filed !== '' ? 'It was filed in the Student File automatically.' : 'The child did not match a roster name yet, so it will be filed when the child is added.']); }
echo json_encode(['ok'=>true, 'filed'=>($filed !== '')]); exit;
}
if ($action === 'pp_orient_list'){
if (!$isDir) fail('Directors only.', 403);
$d = pp_dir($school); if (!$d) fail('Could not open the parent portal storage.', 500);
echo json_encode(['items'=>array_reverse(jread($d.'/orientation.json', []))]); exit;
}
if ($action === 'pp_list'){
$d = pp_dir($school); if (!$d) fail('Could not open the parent portal storage.', 500);
$it = jread($d.'/items.json', []); $bd = jread($d.'/board.json', []); $today = date('Y-m-d');
$bd = array_values(array_filter($bd, function($b) use ($today){ return empty($b['expires']) || $b['expires'] >= $today; }));
usort($bd, function($a, $b){ $pa = !empty($a['pinned']) ? 1 : 0; $pb = !empty($b['pinned']) ? 1 : 0; if ($pa !== $pb) return $pb - $pa; return strcmp($b['at'] ?? '', $a['at'] ?? ''); });
$it = array_values(array_filter($it, function($x) use ($today){ return empty($x['expires']) || $x['expires'] >= $today; }));
echo json_encode(['school'=>$school, 'month'=>date('Y-m'), 'items'=>$it, 'board'=>$bd]); exit;
}
if ($action === 'pp_ev_list' || $action === 'pp_ev_claim'){
/* Parent Portal events: read and claim through the Bear Line saver (same list the directors see in Staff > Events). */
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
if (!defined('ELC_SYNC_CODE')) fail('Events are not connected yet.', 503);
$bl = ($school === 'Sanford') ? 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php' : (($school === 'DeLand 2') ? 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php' : '');
if ($bl === '') fail('Pick your school first.');
$pl = ['code'=>ELC_SYNC_CODE, 'action'=>($action === 'pp_ev_list' ? 'ev_list' : 'ev_claim')];
if ($action === 'pp_ev_claim'){ $pl['event'] = (string)($input['event'] ?? ''); $pl['items'] = array_slice((array)($input['items'] ?? []), 0, 30); $pl['other'] = (string)($input['other'] ?? ''); $pl['family'] = (string)($input['family'] ?? ''); $pl['kids'] = (string)($input['kids'] ?? ''); }
$ctx = stream_context_create(['http'=>['method'=>'POST', 'header'=>"Content-Type: application/json\r\n", 'content'=>json_encode($pl), 'timeout'=>15, 'ignore_errors'=>true]]);
$r = @file_get_contents($bl, false, $ctx); $j = json_decode($r ?: '', true);
if (!is_array($j)) fail('Could not reach the events list right now. Please try again in a minute.', 502);
if ($action === 'pp_ev_claim' && !empty($j['ok']) && !empty($j['claimed'])){ hive_notify($school, 'Parent Portal event sign-up', ['A parent signed up for an event in the Parent Portal.', 'Family: '.trim((string)($input['family'] ?? '')).' ('.trim((string)($input['kids'] ?? '')).')', 'Bringing: '.implode(', ', $j['claimed']), 'See it in Bear Line > Staff > Events.']); }
echo json_encode($j); exit;
}
if ($action === 'pp_auto'){
/* Automatic parent content: lesson plans (from the teacher Lesson Plan Index), food program forms, and a prebuilt monthly newsletter. */
function pp_at_all($tbl, $q = []){ $out = []; $off = null; for ($i = 0; $i < 6; $i++){ $qq = $q; if ($off) $qq['offset'] = $off; $r = at_request('GET', [$tbl], $qq); foreach (($r['records'] ?? []) as $x) $out[] = $x['fields']; $off = $r['offset'] ?? null; if (!$off) break; } return $out; }
$cf = sys_get_temp_dir().'/hive_ppauto_'.preg_replace('/[^a-z0-9]/', '', strtolower($school)).'_'.date('YmdH').intdiv((int)date('i'), 10).'.json';
if (is_file($cf)){ echo file_get_contents($cf); exit; }
$mk = date('Y-m'); if ((int)date('j') >= 25) $mk = date('Y-m', strtotime('first day of next month'));
$mt = strtotime($mk.'-01'); $mname = date('F', $mt);
$L = pp_at_all('tblSVP23UQnBu0YFo'); $lessons = [];
foreach ($L as $f){ $mo = $f['Month'] ?? ''; $lk = $f['File Link'] ?? ''; if ($mo === '' || $lk === '') continue; $lessons[] = ['month'=>$mo, 'age'=>$f['Age Group'] ?? '', 'plan'=>$f['Plan'] ?? ($mo.' '.($f['Age Group'] ?? '')), 'link'=>$lk]; }
$cur = []; foreach ($lessons as $x){ if (stripos($x['month'], $mname) === 0) $cur[] = $x; }
$F = pp_at_all('tblffsVYZDodfNiCV'); $forms = [];
foreach ($F as $f){ $cat = $f['Category'] ?? ''; $doc = $f['Document'] ?? ''; $sc = $f['School'] ?? ''; $lk = $f['File Link'] ?? '';
if ($lk === '' || ($sc !== 'Both' && $sc !== $school)) continue;
$ok = ($cat === 'Dietary & Infant Forms') || (stripos($doc, 'Free & Reduced') !== false);
if ($ok) $forms[] = ['doc'=>$doc, 'cat'=>$cat, 'link'=>$lk]; }
usort($forms, function($a, $b){ return strcmp($a['cat'].$a['doc'], $b['cat'].$b['doc']); });
/* closures (copy of sop-data.js) */
$CLA = ['2026-11-11'=>'Veterans Day','2026-11-26'=>'Thanksgiving','2026-11-27'=>'Day after Thanksgiving','2026-12-23'=>'Christmas Break','2026-12-24'=>'Christmas Break','2026-12-25'=>'Christmas Day','2027-01-01'=>"New Year's Day",'2027-01-18'=>'Martin Luther King Jr. Day','2027-03-26'=>'Good Friday','2027-05-31'=>'Memorial Day','2027-06-18'=>'Juneteenth'];
$CLP = ['2026-11-23'=>'Thanksgiving Break','2026-11-24'=>'Thanksgiving Break','2026-11-25'=>'Thanksgiving Break','2026-12-21'=>'Winter Break','2026-12-22'=>'Winter Break','2026-12-28'=>'Winter Break','2026-12-29'=>'Winter Break','2026-12-30'=>'Winter Break','2026-12-31'=>"New Year's Eve (we close early at 5 PM)",'2027-01-04'=>'District holiday','2027-01-05'=>'District holiday','2027-02-15'=>"Presidents' Day",'2027-03-15'=>'Spring Break','2027-03-16'=>'Spring Break','2027-03-17'=>'Spring Break','2027-03-18'=>'Spring Break','2027-03-19'=>'Spring Break','2027-03-22'=>'District holiday'];
$dates = []; $dim = (int)date('t', $mt);
for ($d = 1; $d <= $dim; $d++){ $ymd = $mk.'-'.sprintf('%02d', $d); $lab = date('D, M j', strtotime($ymd));
if (isset($CLA[$ymd])) $dates[] = [$lab, 'CLOSED: '.$CLA[$ymd].(in_array($ymd, ['2026-11-26','2026-11-27'], true) ? ' (preschool closed, VPK closed all week)' : '')];
elseif (isset($CLP[$ymd]) && !($ymd === '2027-01-05' && $school === 'DeLand 2')) $dates[] = [$lab, ($ymd === '2026-12-31' ? $CLP[$ymd] : (strpos($CLP[$ymd], 'Thanksgiving') !== false ? (in_array($ymd, ['2026-11-23','2026-11-24','2026-11-25'], true) ? 'Preschool is open. VPK is closed all week. Holiday Break Camp is open for VPK and school-age: sign up at the front desk.' : 'Thanksgiving Break') : 'Partial closure: '.$CLP[$ymd]))]; }
/* birthdays: children (first name + last initial + day only) and staff (director-kept list) */
$bd = []; $RC = pp_at_all('tblpEsTQ8EKbe63FA');
foreach ($RC as $f){ if (($f['School'] ?? '') !== $school) continue; $st = strtolower($f['Status'] ?? 'active'); if ($st !== '' && $st !== 'active' && $st !== 'enrolled') continue;
$dob = $f['DOB'] ?? ''; if (!preg_match('/^\d{4}-(\d{2})-(\d{2})/', $dob, $m) || $m[1] !== date('m', $mt)) continue;
$nm = trim($f['Child'] ?? ''); if ($nm === '') continue; $p = preg_split('/\s+/', $nm); $short = $p[0].(count($p) > 1 ? ' '.mb_substr(end($p), 0, 1).'.' : '');
$bd[] = [(int)$m[2], $short]; }
$sd = school_dir($school); $sb = $sd ? jread($sd.'/staff-birthdays.json', []) : [];
foreach ($sb as $s){ if (preg_match('/^(\d{2})-(\d{2})$/', $s['md'] ?? '', $m) && $m[1] === date('m', $mt)) $bd[] = [(int)$m[2], trim($s['name'] ?? '').' (teacher)']; }
usort($bd, function($a, $b){ return $a[0] - $b[0]; });
$bt = implode("\n", array_map(function($x) use ($mname){ return $mname.' '.$x[0].': '.$x[1]; }, $bd));
$weekly = []; $td = date('Y-m-d');
foreach (pp_at_all('tbl88lfmyoO6ImePK') as $f){ $sc = $f['School'] ?? 'Both'; if ($sc !== 'Both' && $sc !== $school) continue; $fr = $f['Show From'] ?? ''; $un = $f['Show Until'] ?? ''; if (($fr !== '' && $fr > $td) || ($un !== '' && $un < $td)) continue; $weekly[] = ['title'=>$f['Title'] ?? '', 'kind'=>$f['Kind'] ?? 'Update', 'body'=>$f['Body'] ?? '']; }
$QS = ['Children learn more from what you are than what you teach. - W.E.B. Du Bois', 'Play is the highest form of research. - Albert Einstein', 'It is easier to build strong children than to repair broken men. - Frederick Douglass', 'Every child is a different kind of flower, and all together make this world a beautiful garden.', 'Tell me and I forget. Teach me and I remember. Involve me and I learn. - Benjamin Franklin', 'A child who is loved and encouraged can do anything.', 'The more that you read, the more things you will know. - Dr. Seuss'];
$quote = $QS[(int)date('z') % count($QS)];
$rem = ['Please bring 160 wipes and 1 box of tissues each month. If we have not received them, a $5 supply fee is added.', 'Uniform shirts are $18. Ask the office if your child needs a new one.', 'Send a labeled change of clothes: 3 sets for infants and toddlers, 2 for preschoolers.', 'Please sign your child in and out on the tablet every day.'];
$out = ['school'=>$school, 'month'=>$mk, 'monthName'=>$mname, 'weekly'=>$weekly, 'lessons'=>$cur, 'allLessons'=>$lessons, 'forms'=>$forms,
'newsletter'=>['title'=>$mname.' at Kid City USA '.$school, 'month'=>$mk, 'auto'=>true, 'form'=>['welcome'=>'Welcome to '.$mname.' at Kid City USA '.$school.'! Here is everything you need to know this month.', 'dates'=>$dates, 'reminders'=>$rem, 'news'=>[], 'weekly'=>$weekly, 'quote'=>$quote, 'birthdays'=>$bt, 'thanks'=>'Thank you for trusting us with your little ones. We love being part of your family!', 'lessonsMonth'=>count($cur) > 0]]];
$j = json_encode($out); @file_put_contents($cf, $j); echo $j; exit;
}
if ($action === 'pp_get'){
$d = pp_dir($school); $name = basename($input['name'] ?? ''); if (!$d || !preg_match('/^[a-z0-9._-]+$/', $name) || $name === 'items.json' || $name === 'board.json') fail('File not found', 404);
$path = $d.'/'.$name; if (!is_file($path)) fail('File not found', 404);
echo json_encode(['b64'=>base64_encode(file_get_contents($path)), 'name'=>$name]); exit;
}
if (strpos($action, 'pp_') === 0){
if (!$isDir) fail('Only a director can change the parent portal.', 403);
$d = pp_dir($school); if (!$d) fail('Could not open the parent portal storage.', 500);
$KINDS_PP = ['menu', 'newsletter', 'lessons', 'flyer'];
if ($action === 'pp_status'){ echo json_encode(['school'=>$school, 'status'=>pp_status_list($school)]); exit; }
if ($action === 'pp_upload' || $action === 'pp_form_save'){
$kind = $input['kind'] ?? ''; if (!in_array($kind, $KINDS_PP, true)) fail('Pick what you are posting');
$month = $input['month'] ?? ''; if ($kind !== 'flyer' && !preg_match('/^\d{4}-\d{2}$/', $month)) fail('Pick the month this is for');
$exp = $input['expires'] ?? ''; if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That expiration date is not a real date');
$title = pp_txt($input['title'] ?? '', 80); if ($title === '') fail('Add a title');
$item = ['id'=>substr(md5(uniqid('', true)), 0, 10), 'kind'=>$kind, 'title'=>$title, 'month'=>($kind === 'flyer' ? '' : $month), 'at'=>gmdate('c'), 'by'=>pp_txt($input['by'] ?? 'Director', 40)];
if ($exp !== '') $item['expires'] = $exp;
if ($action === 'pp_upload'){
$raw = base64_decode($input['b64'] ?? '', true); if ($raw === false || strlen($raw) < 100) fail('Missing file');
if (strlen($raw) > 10 * 1024 * 1024) fail('File too large (10 MB max).');
if (substr($raw, 0, 4) === "%PDF") $ext = 'pdf'; elseif (substr($raw, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg'; elseif (substr($raw, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png'; else fail('Only PDF, JPG or PNG files can be posted.');
$item['file'] = $kind.'-'.($month !== '' ? $month : 'x').'-'.$item['id'].'.'.$ext; $item['ext'] = $ext;
if (file_put_contents($d.'/'.$item['file'], $raw) === false) fail('Could not save the file', 500);
} else {
$f = $input['form'] ?? []; if (!is_array($f)) fail('Missing newsletter');
$clean = ['welcome'=>pp_txt($f['welcome'] ?? '', 1500), 'thanks'=>pp_txt($f['thanks'] ?? '', 600), 'birthdays'=>pp_txt($f['birthdays'] ?? '', 600), 'dates'=>[], 'reminders'=>[], 'news'=>[]];
foreach (array_slice((array)($f['dates'] ?? []), 0, 20) as $r){ $t = pp_txt($r[1] ?? '', 160); if ($t !== '') $clean['dates'][] = [pp_txt($r[0] ?? '', 30), $t]; }
foreach (array_slice((array)($f['reminders'] ?? []), 0, 12) as $r){ $t = pp_txt($r, 240); if ($t !== '') $clean['reminders'][] = $t; }
foreach (array_slice((array)($f['news'] ?? []), 0, 10) as $r){ $t = pp_txt($r[1] ?? '', 600); if ($t !== '') $clean['news'][] = [pp_txt($r[0] ?? '', 60), $t]; }
$item['form'] = $clean;
}
$all = jread($d.'/items.json', []); $keep = [];
foreach ($all as $x){ if ($kind !== 'flyer' && ($x['kind'] ?? '') === $kind && ($x['month'] ?? '') === $month){ if (!empty($x['file'])) @unlink($d.'/'.basename($x['file'])); continue; } $keep[] = $x; }
$keep[] = $item; jwrite($d.'/items.json', $keep);
echo json_encode(['ok'=>true, 'item'=>$item]); exit;
}
if ($action === 'pp_remove'){
$id = preg_replace('/[^a-f0-9]/', '', $input['id'] ?? ''); $all = jread($d.'/items.json', []); $keep = [];
foreach ($all as $x){ if (($x['id'] ?? '') === $id){ if (!empty($x['file'])) @unlink($d.'/'.basename($x['file'])); continue; } $keep[] = $x; }
jwrite($d.'/items.json', $keep); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'pp_board_post'){
$t = pp_txt($input['title'] ?? '', 80); $m = pp_txt($input['message'] ?? '', 1500); if ($t === '' || $m === '') fail('Add a title and a message');
$exp = $input['expires'] ?? ''; if ($exp !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp)) fail('That date is not a real date');
$bd = jread($d.'/board.json', []); $row = ['id'=>substr(md5(uniqid('', true)), 0, 10), 'title'=>$t, 'message'=>$m, 'pinned'=>!empty($input['pinned']), 'at'=>gmdate('c'), 'by'=>pp_txt($input['by'] ?? 'Director', 40)]; if ($exp !== '') $row['expires'] = $exp;
$bd[] = $row; jwrite($d.'/board.json', $bd); echo json_encode(['ok'=>true]); exit;
}
if ($action === 'pp_board_remove'){
$id = preg_replace('/[^a-f0-9]/', '', $input['id'] ?? ''); $bd = array_values(array_filter(jread($d.'/board.json', []), function($b) use ($id){ return ($b['id'] ?? '') !== $id; }));
jwrite($d.'/board.json', $bd); echo json_encode(['ok'=>true]); exit;
}
fail('Unknown parent portal action');
}


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
/* ---- Weekly FTE report (replaces the corporate Google Form). Directors only.
   Each school has its own sheet of up to 20 weeks in hive-vault/<school>/fte/current.json. When a sheet is full and the next week is saved,
   the full sheet is filed in hive-vault/<school>/fte/archive/ and a new sheet starts. ---- */
function fte_dir($school){ $d = school_dir($school); if (!$d) return null; $p = $d.'/fte'; if (!is_dir($p)) @mkdir($p, 0750, true); if (!is_dir($p.'/archive')) @mkdir($p.'/archive', 0750, true); return is_dir($p) ? $p : null; }
function fte_monday($date){ $t = strtotime($date.' 12:00:00'); $n = (int)date('N', $t); return date('Y-m-d', $t - ($n - 1) * 86400); }
function fte_target_week(){ $n = (int)date('N'); $mon = fte_monday(date('Y-m-d')); return $n >= 5 ? date('Y-m-d', strtotime($mon.' +7 days')) : $mon; }
function fte_have_week($school, $wk){ $d = fte_dir($school); if (!$d) return true; $c = jread($d.'/current.json', ['rows'=>[], 'carry'=>null]); foreach ($c['rows'] as $r){ if (($r['week'] ?? '') === $wk) return true; } foreach (glob($d.'/archive/*.json') ?: [] as $f){ $a = jread($f, ['rows'=>[]]); foreach ($a['rows'] as $r){ if (($r['week'] ?? '') === $wk) return true; } } return false; }
if (strpos($action, 'fte_') === 0){
if (!$isDir) fail('Only a director can use the FTE report.', 403);
$d = fte_dir($school); if (!$d) fail('Could not open the FTE storage.', 500);
$cf = $d.'/current.json';
if ($action === 'fte_list'){
$c = jread($cf, ['rows'=>[], 'carry'=>null]); $arch = [];
foreach (glob($d.'/archive/*.json') ?: [] as $f){ $a = jread($f, null); if (!$a || empty($a['rows'])) continue; $arch[] = ['file'=>basename($f), 'first'=>$a['rows'][0]['week'], 'last'=>$a['rows'][count($a['rows']) - 1]['week'], 'count'=>count($a['rows']), 'filed'=>$a['filed'] ?? '']; }
usort($arch, function($x, $y){ return strcmp($y['first'], $x['first']); });
echo json_encode(['school'=>$school, 'rows'=>$c['rows'], 'carry'=>$c['carry'] ?? null, 'archives'=>$arch, 'targetWeek'=>fte_target_week(), 'max'=>20]); exit;
}
if ($action === 'fte_archive_get'){
$name = basename($input['file'] ?? ''); if (!preg_match('/^[A-Za-z0-9._-]+\.json$/', $name)) fail('Bad file'); $p = $d.'/archive/'.$name; if (!is_file($p)) fail('Not found', 404);
echo json_encode(jread($p, ['rows'=>[]])); exit;
}
if ($action === 'fte_save'){
$in = $input['row'] ?? []; if (!is_array($in)) fail('Missing report');
$wk = $in['week'] ?? ''; if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $wk) || !strtotime($wk)) fail('Pick the week this report is for');
$wk = fte_monday($wk);
$num = function($k, $money = false) use ($in){ $v = $in[$k] ?? ''; if ($v === '' || $v === null) fail('Fill in every number (use 0 if none): '.$k); if (!is_numeric($v) || $v < 0) fail('Numbers cannot be negative: '.$k); return $money ? round((float)$v, 2) : round((float)$v, 2); };
$row = ['week'=>$wk, 'ar'=>$num('ar', true), 'selfpay'=>$num('selfpay', true), 'subsidy'=>$num('subsidy', true), 'fte'=>$num('fte'), 'capacity'=>$num('capacity'), 'enrolled'=>$num('enrolled'), 'payroll'=>$num('payroll', true), 'phone'=>$num('phone'), 'internet'=>$num('internet'), 'newstarts'=>$num('newstarts'), 'unenrolled'=>$num('unenrolled'), 'special'=>$num('special'), 'staff'=>$num('staff'), 'prereg'=>$num('prereg')];
if ($row['capacity'] <= 0) fail('License capacity must be more than 0');
$row['total'] = round($row['selfpay'] + $row['subsidy'], 2); $row['occupancy'] = round($row['fte'] / $row['capacity'] * 100, 2);
$row['by'] = mb_substr(trim(strip_tags((string)($in['by'] ?? ''))), 0, 40); $row['note'] = mb_substr(trim(strip_tags((string)($in['note'] ?? ''))), 0, 300); $row['savedAt'] = gmdate('c');
foreach (glob($d.'/archive/*.json') ?: [] as $f){ $a = jread($f, ['rows'=>[]]); foreach ($a['rows'] as $r0){ if (($r0['week'] ?? '') === $wk) fail('That week is already filed in a full sheet in the vault. Pick a different week.'); } }
$c = jread($cf, ['rows'=>[], 'carry'=>null]); $found = false;
foreach ($c['rows'] as $i => $r0){ if (($r0['week'] ?? '') === $wk){ $c['rows'][$i] = $row; $found = true; } }
if (!$found){
if (count($c['rows']) >= 20){ // the sheet is full: file it in the vault and start a new sheet
$first = $c['rows'][0]['week']; $last = $c['rows'][count($c['rows']) - 1]['week'];
jwrite($d.'/archive/FTE-sheet-'.$first.'-to-'.$last.'.json', ['school'=>$school, 'rows'=>$c['rows'], 'filed'=>gmdate('c')]);
$c = ['rows'=>[], 'carry'=>$c['rows'][count($c['rows']) - 1]];
}
$c['rows'][] = $row;
}
usort($c['rows'], function($a, $b){ return strcmp($a['week'], $b['week']); });
jwrite($cf, $c); echo json_encode(['ok'=>true, 'rows'=>$c['rows'], 'carry'=>$c['carry'] ?? null]); exit;
}
if ($action === 'fte_delete'){
$wk = $input['week'] ?? ''; $c = jread($cf, ['rows'=>[], 'carry'=>null]); $c['rows'] = array_values(array_filter($c['rows'], function($r) use ($wk){ return ($r['week'] ?? '') !== $wk; })); jwrite($cf, $c); echo json_encode(['ok'=>true, 'rows'=>$c['rows']]); exit;
}
if ($action === 'fte_file_sheet'){
$c = jread($cf, ['rows'=>[], 'carry'=>null]); if (!$c['rows']) fail('The sheet is empty.');
$first = $c['rows'][0]['week']; $last = $c['rows'][count($c['rows']) - 1]['week'];
jwrite($d.'/archive/FTE-sheet-'.$first.'-to-'.$last.'.json', ['school'=>$school, 'rows'=>$c['rows'], 'filed'=>gmdate('c')]);
jwrite($cf, ['rows'=>[], 'carry'=>$c['rows'][count($c['rows']) - 1]]); echo json_encode(['ok'=>true]); exit;
}
fail('Unknown FTE action');
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
$esig = (string)($input['esig'] ?? ''); if ($esig !== '' && !(strpos($esig, 'data:image/png;base64,') === 0 && strlen($esig) < 120000)) $esig = '';
$f = to_file($school); if (!$f) fail('Could not save right now.', 500);
$all = jread($f, []); if (count($all) > 600) fail('Too many requests on file. Ask your director.');
$id = 'to_'.bin2hex(random_bytes(5));
$all[] = ['id'=>$id,'name'=>$name,'type'=>$type,'from'=>$from,'to'=>$to,'hours'=>mb_substr(trim((string)($input['hours'] ?? '')),0,40),'reason'=>mb_substr(trim((string)($input['reason'] ?? '')),0,400),'covered'=>mb_substr(trim((string)($input['covered'] ?? '')),0,200),'at'=>gmdate('c'),'notice'=>$notice,'short'=>($notice < 14),'status'=>'pending','note'=>'','esig'=>$esig];
jwrite($f, $all);
hive_notify($school, 'Time off request: '.preg_replace('/\s+\S+$/', '', $name).($notice < 14 ? ' (UNDER 2 WEEKS)' : ''), [$name.' sent an Employee Vacation Request for '.$from.($to !== $from ? ' to '.$to : '').'.', ($notice < 14 ? 'It is under the two-week requirement ('.$notice.' days ahead).' : 'It meets the two-week requirement.'), 'It is waiting for your signature in the Standard Operating Procedures card, Time Off tab.']);
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
foreach ($all as $i => $r){ if (($r['id'] ?? '') === $id){ $all[$i]['status'] = $st; $all[$i]['note'] = mb_substr(trim((string)($input['note'] ?? '')),0,300); $all[$i]['decidedAt'] = gmdate('c'); $sg = (string)($input['sig'] ?? ''); if ($sg !== '' && strpos($sg, 'data:image/png;base64,') === 0 && strlen($sg) < 120000) $all[$i]['sig'] = $sg; $all[$i]['signer'] = mb_substr(trim((string)($input['signer'] ?? '')),0,60); $us = (string)($input['use'] ?? ''); $all[$i]['use'] = in_array($us, ['vacation','personal'], true) ? $us : ''; $hit = $all[$i]; } }
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
/* file the decision in the staff member's own file (director-only view in Files) */
try{
 $sr2 = roster($school, 'staff'); $pid = '';
 if (is_array($sr2)){ foreach ($sr2 as $p2){ if (mb_strtolower(trim($p2['name'])) === mb_strtolower(trim($hit['name']))){ $pid = $p2['id']; break; } } }
 if ($pid !== '' && strpos($pid, 'pend_') !== 0){
  $pd = pdir($school, 'staff', $pid); $tf2 = $pd.'/timeoff.json'; $tl = jread($tf2, []); if (!is_array($tl)) $tl = [];
  $tl = array_values(array_filter($tl, function($x) use ($id){ return ($x['id'] ?? '') !== $id; }));
  if ($st === 'approved' || $st === 'denied'){ $tl[] = ['id'=>$id,'status'=>$st,'type'=>$hit['type'],'from'=>$hit['from'],'to'=>$hit['to'],'hours'=>$hit['hours'] ?? '','reason'=>$hit['reason'] ?? '','use'=>$hit['use'] ?? '','signer'=>$hit['signer'] ?? '','decidedAt'=>$hit['decidedAt'] ?? '','requestedAt'=>$hit['at'] ?? '','short'=>!empty($hit['short']),'notice'=>$hit['notice'] ?? null,'note'=>$hit['note'] ?? '','esig'=>$hit['esig'] ?? '','sig'=>$hit['sig'] ?? '']; }
  usort($tl, function($a, $b){ return strcmp($b['from'], $a['from']); });
  jwrite($tf2, $tl);
 }
}catch(Throwable $e){}
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
if ((int)date('N') >= 4){ $tw = fte_target_week(); if (!fte_have_week($school, $tw)) $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'fte', 'href'=>'fte.html', 'label'=>'Weekly FTE report for the week of '.date('n/j', strtotime($tw)).' not filed yet', 'status'=>'missing', 'red'=>((int)date('N') >= 5)]; }
foreach (nh_list_all($school) as $nh0){ if (($nh0['status'] ?? 'new') !== 'new') continue; $nn = $nh0['name'] ?? ''; $lab = ''; if (!empty($nh0['packet']) && empty($nh0['final'])) $lab = 'New hire '.$nn.' signed their employee packet — review and sign your lines'; elseif (nh_train_done($nh0) >= count($NH_TRAIN)) $lab = 'New hire '.$nn.' finished all onboarding steps — check their certificates'; if ($lab !== '') $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'newhire', 'href'=>'newhires.html', 'label'=>$lab, 'status'=>'missing', 'red'=>false]; }
foreach (ori_refile($school) as $uo){ $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'orient', 'href'=>'parent-manage.html', 'label'=>'Parent orientation signed by '.($uo['parent'] ?? '').' for '.short_child($uo['child'] ?? '').' is not in a child\'s file yet (child not on the roster, or the name did not match)', 'status'=>'missing', 'red'=>false]; }
foreach (en_list_all($school) as $en0){ if (($en0['status'] ?? '') === 'new') $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'enroll', 'href'=>'enroll.html', 'label'=>'New enrollment packet: '.($en0['child']['first'] ?? '').' '.mb_substr($en0['child']['last'] ?? '', 0, 1).'. — review and approve', 'status'=>'missing', 'red'=>false]; }
$upn = 0; foreach (up_all($school) as $uq){ if (($uq['status'] ?? '') === 'new') $upn++; }
if ($upn) $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'upload', 'href'=>'uploads.html', 'label'=>$upn.' document'.($upn === 1 ? '' : 's').' sent by parents to check and file', 'status'=>'missing', 'red'=>false];
foreach (pp_status_list($school) as $ps){ if ($ps['ok']) continue; $isNext = ($ps['month'] !== date('Y-m')); $items[] = ['kind'=>'school', 'id'=>'', 'name'=>$school, 'sub'=>'School', 'doc'=>'pp', 'href'=>'parent-manage.html', 'label'=>'Parent portal: '.$ps['monthName'].' '.$ps['label'].' not posted yet'.($isNext ? ' (month ends soon)' : ''), 'status'=>'missing', 'red'=>(!$isNext && (int)date('j') >= 5)]; }
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
if ($action === 'to_person'){
$d = pdir($school, 'staff', $id); $l = jread($d.'/timeoff.json', []);
echo json_encode(['list'=>is_array($l) ? $l : []]); exit;
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
