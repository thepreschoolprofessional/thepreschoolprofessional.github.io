<?php
/* ============================================================
THE HIVE — Talk to Bear Line (TEST VERSION), built 11/20/26.
A director says or types what they want. Claude Haiku turns the words into ONE
proposed change. Nothing happens until the director taps Yes, and every Yes is
logged with the director's school and role.

Safety:
- The Claude key lives OUTSIDE public_html in hive-claude-key.php (never in this repo).
- Haiku never writes anything. It only proposes. This file checks every proposal
  against the director's own school before it does anything.
- TALK_LIVE = false means PRACTICE MODE: a Yes is logged, but nothing in Bear Line
  changes. Mrs. Bear flips this to true only after she has tried it.
============================================================ */
define('TALK_LIVE', false);
define('DAILY_CAP', 300);               // most Haiku calls per school per day (spending guard)
define('MODEL', 'claude-sonnet-5-5');   // was Haiku: Sonnet thinks the request through and asks for missing details
define('TALK_HOST', 'thepreschoolprofessional.net');   // where the portal's own endpoints live (lookups run as the director)
@set_time_limit(120);

$__t = 'PASTE_YOUR_AIRTABLE_TOKEN_HERE';
$__dirs = [dirname(__DIR__, 2), dirname(__DIR__), __DIR__];
foreach ($__dirs as $__d){
if (file_exists($__d.'/hive-token.php')){ include_once $__d.'/hive-token.php'; if (defined('HIVE_TOKEN') && HIVE_TOKEN !== 'PASTE_YOUR_AIRTABLE_TOKEN_HERE'){ $__t = HIVE_TOKEN; break; } }
}
$__k = '';
foreach ($__dirs as $__d){
if (file_exists($__d.'/hive-claude-key.php')){ include_once $__d.'/hive-claude-key.php'; if (defined('CLAUDE_KEY') && strpos(CLAUDE_KEY, 'sk-ant-') === 0){ $__k = CLAUDE_KEY; break; } }
}
$__o = '';
foreach ($__dirs as $__d){
if (file_exists($__d.'/hive-owner-email.php')){ include_once $__d.'/hive-owner-email.php'; if (defined('OWNER_EMAIL') && filter_var(OWNER_EMAIL, FILTER_VALIDATE_EMAIL)){ $__o = OWNER_EMAIL; break; } }
}
define('OWNER_ADDR', $__o);   // Mrs. Bear's own address, kept outside public_html (never in this public repo)
define('AIRTABLE_TOKEN', $__t);
define('CLAUDE_API_KEY', $__k);
define('BASE_ID', 'app2HNkUSJqx9IkYZ');
define('PIN_TABLE', 'Portal Access');
define('PIN_CACHE', sys_get_temp_dir() . '/hive_pins_cache.json');
define('PIN_CACHE_TTL', 300);

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROLE_SCHOOL = ['director-sanford' => 'Sanford', 'director-deland' => 'DeLand 2'];
/* Email goes ONLY to addresses already saved in the portal (dcf.js OFFICE_MAIL / SPONSOR_TO) or Mrs. Bear's private file. Claude never picks an address. */
$OFFICE = ['Sanford' => 'sanfordoffice.1320@gmail.com', 'DeLand 2' => 'delandoffice.238@gmail.com'];
$FOOD = ['Sanford' => '', 'DeLand 2' => 'ccfp@ccswfl.org'];
$VAULT = ['elc' => 'ELC / School Readiness', 'food' => 'Food Program (CACFP)', 'dcf' => 'DCF / Licensing', 'other' => 'Staff Meetings & Other'];
function recipient($key, $school){ global $OFFICE, $FOOD;
if ($key === 'office') return [$OFFICE[$school], 'the '.$school.' office ('.$OFFICE[$school].')'];
if ($key === 'food_program') return $FOOD[$school] ? [$FOOD[$school], 'the food program sponsor ('.$FOOD[$school].')'] : ['', ''];
if ($key === 'owner') return OWNER_ADDR ? [OWNER_ADDR, 'Mrs. Bear ('.OWNER_ADDR.')'] : ['', ''];
return ['', '']; }
/* The document types in Staff Files and Student Files, read from files-api.php so the two never drift apart. */
function doc_types(){
$src = @file_get_contents(__DIR__.'/files-api.php') ?: ''; $out = ['staff' => [], 'student' => []];
foreach (['staff', 'student'] as $k){
if (!preg_match("/'".$k."'\\s*=>\\s*\\[(.*?)\\n\\s*\\]/s", $src, $m)) continue;
preg_match_all("/^\\s*'([a-z0-9]+)'\\s*=>\\s*\\['((?:[^'\\\\]|\\\\.)*)'/m", $m[1], $mm, PREG_SET_ORDER);
foreach ($mm as $x) $out[$k][$x[1]] = stripslashes($x[2]);
}
return $out; }

function fail($msg, $code = 400){ http_response_code($code); echo json_encode(['error'=>$msg]); exit; }
function now_et(){ return new DateTime('now', new DateTimeZone('America/New_York')); }

function at_request($method, $path, $query = null, $body = null){
$url = 'https://api.airtable.com/v0/' . BASE_ID . '/' . rawurlencode($path[0]) . (isset($path[1]) ? '/'.$path[1] : '');
if ($query) $url .= '?' . http_build_query($query);
$opts = ['http' => ['method' => $method, 'header' => "Authorization: Bearer " . AIRTABLE_TOKEN . "\r\nContent-Type: application/json\r\n", 'ignore_errors' => true, 'timeout' => 20]];
if ($body !== null) $opts['http']['content'] = json_encode($body);
$res = @file_get_contents($url, false, stream_context_create($opts));
return json_decode($res ?: '{}', true);
}
function at_all($table, $formula){
$q = ['pageSize' => 100, 'filterByFormula' => $formula]; $all = []; $n = 0;
do { $out = at_request('GET', [$table], $q); $all = array_merge($all, $out['records'] ?? []); $q['offset'] = $out['offset'] ?? null; $n++; } while (!empty($q['offset']) && $n < 6);
return $all;
}
function sel($v){ return is_array($v) ? ($v['name'] ?? '') : (string)$v; }

function get_pins(){
if (file_exists(PIN_CACHE) && time() - filemtime(PIN_CACHE) < PIN_CACHE_TTL) return json_decode(file_get_contents(PIN_CACHE), true);
$res = at_request('GET', [PIN_TABLE], ['maxRecords' => 10]);
$pins = [];
foreach (($res['records'] ?? []) as $r){ $role = strtolower(trim($r['fields']['Role'] ?? '')); $pin = strtoupper(trim($r['fields']['PIN'] ?? '')); if ($role && $pin) $pins[$pin] = $role; }
if ($pins) file_put_contents(PIN_CACHE, json_encode($pins));
return $pins;
}

/* ---------- private folder for the log + daily counter (outside public_html when possible) ---------- */
function private_dir(){
foreach ([dirname(__DIR__, 2), dirname(__DIR__)] as $d){ $p = $d.'/talk-to-bearline'; if (is_dir($p) || @mkdir($p, 0700)) { if (is_writable($p)) return $p; } }
$p = sys_get_temp_dir().'/talk-to-bearline'; if (!is_dir($p)) @mkdir($p, 0700); return $p;
}
function log_line($row){
$row['when'] = now_et()->format('Y-m-d H:i:s');
@file_put_contents(private_dir().'/log-'.now_et()->format('Y-m').'.jsonl', json_encode($row)."\n", FILE_APPEND | LOCK_EX);
}
function bump_cap($school){
$f = private_dir().'/count-'.preg_replace('/[^a-z0-9]/i', '', $school).'-'.now_et()->format('Y-m-d').'.txt';
$n = (int)@file_get_contents($f); if ($n >= DAILY_CAP) return false;
@file_put_contents($f, (string)($n + 1), LOCK_EX); return true;
}

/* ---------- names Haiku may pick from (this school only), cached 5 minutes ---------- */
function school_context($school){
$f = sys_get_temp_dir().'/talk_ctx_'.md5($school).'.json';
if (file_exists($f) && time() - filemtime($f) < 300) return json_decode(file_get_contents($f), true);
$sq = str_replace("'", "\\'", $school);
$staff = []; foreach (at_all('Staff Roster', "AND({Active}=TRUE(),OR({School}='$sq',{School}='Both'))") as $r){ $n = trim($r['fields']['Name'] ?? ''); if ($n) $staff[] = $n; }
$kids = []; foreach (at_all('Room Children', "AND({School}='$sq',{Status}='Active')") as $r){ $n = trim($r['fields']['Child'] ?? ''); if ($n) $kids[$n] = trim($r['fields']['Room'] ?? ''); }
$rooms = []; foreach (at_all('Rooms', "{School}='$sq'") as $r){ $n = trim($r['fields']['Room'] ?? ''); if ($n && !empty($r['fields']['Active'])) $rooms[] = $n; }
$items = []; foreach (at_all('Inventory', "OR({School}='$sq',{School}='Both')") as $r){ $n = trim($r['fields']['Item'] ?? ''); if ($n) $items[$n] = $r['id']; }
sort($staff); ksort($kids); ksort($items);
$ctx = ['staff' => array_values(array_unique($staff)), 'kids' => $kids, 'items' => $items, 'rooms' => $rooms];
if ($staff || $kids) file_put_contents($f, json_encode($ctx));
return $ctx;
}
/* Exact match first, then a unique case-insensitive / first-name match. Returns '' when unsure. */
function pick_name($want, $list){
$want = trim((string)$want); if ($want === '') return '';
$norm = function($s){ return preg_replace('/[^a-z0-9 ]/', '', strtolower(trim($s))); };
$w = $norm($want);
foreach ($list as $n) if ($norm($n) === $w) return $n;
$words = []; $starts = [];
foreach ($list as $n){ $nn = ' '.$norm($n).' '; if (strpos($nn, ' '.$w.' ') !== false) $words[] = $n; elseif (strpos($nn, ' '.$w) !== false) $starts[] = $n; }
if (count($words) === 1) return $words[0];
return (!$words && count($starts) === 1) ? $starts[0] : '';
}
function hm_ok($t){ return is_string($t) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t); }
function hm12($t){ if (!hm_ok($t)) return $t; list($h, $m) = explode(':', $t); $h = (int)$h; return (($h % 12) ?: 12).':'.$m.($h < 12 ? ' AM' : ' PM'); }
function punch_word($ty){ return ['in' => 'clocked in', 'lunchOut' => 'out to lunch', 'lunchIn' => 'back from lunch', 'out' => 'clocked out'][$ty] ?? $ty; }
function nice_day($ymd){ $d = DateTime::createFromFormat('Y-m-d', $ymd, new DateTimeZone('America/New_York')); return $d ? $d->format('l, M j') : $ymd; }
function ymd_ok($d){ if (!is_string($d) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return false; $x = DateTime::createFromFormat('Y-m-d', $d); return $x && $x->format('Y-m-d') === $d; }

/* ---------- Bear Line tablet server (bearphonicsacademy.com), server to server ----------
The sync code lives in elc-sync-code.php outside public_html, never in this repo. Returns [ok, answer, error]. */
function bl_post($school, $payload){
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
if (!defined('ELC_SYNC_CODE')) return [false, null, 'not_connected'];
$bl = ($school === 'Sanford') ? 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php' : 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php';
$c = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n", 'timeout' => 25, 'ignore_errors' => true,
'content' => json_encode(['code' => ELC_SYNC_CODE] + $payload)]]);
$j = json_decode((string)@file_get_contents($bl, false, $c), true);
if (!is_array($j)) return [false, null, 'no_answer'];
return [!empty($j['ok']), $j, (string)($j['error'] ?? '')];
}
/* The front tablet's Family Corner notices (needs hive_notices on the tablet side; null when it isn't there yet). */
function bl_notices($school){
list($ok, $j) = bl_post($school, ['action' => 'hive_notices']);
return ($ok && isset($j['notices']) && is_array($j['notices'])) ? $j['notices'] : null;
}
/* One notice whose words contain what the director said, or null when none or more than one fits. */
function pick_notice($want, $list){
$norm = function($s){ return trim(preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9 ]/', ' ', strtolower((string)$s)))); };
$w = $norm($want); if ($w === '') return null; $words = explode(' ', $w); $hit = [];
foreach ((array)$list as $n){ $t = ' '.$norm(($n['title'] ?? '').' '.($n['en'] ?? '').' '.($n['es'] ?? '')).' ';
$all = true; foreach ($words as $x){ if (strpos($t, ' '.$x) === false){ $all = false; break; } }
if ($all) $hit[] = $n; }
return count($hit) === 1 ? $hit[0] : null;
}
/* Lookups on the Bear Line tablet itself, offered to Claude next to the portal lookups. */
$TABLET_READS = [
'tablet_notices' => 'Notices on the front tablet Family Corner. args {}',
'tablet_events' => 'Events on the front tablet screen (like Friendsgiving Lunch). args {}',
'tablet_child_notes' => 'Notes and observations waiting for one child\'s parent at the tablet. args {"child":"exact child name"}',
'tablet_unsigned' => 'ELC children whose parent signature is missing on the Bear Line tablet (sign-in, sign-out or absence excuse). Use it for questions like how many ELC children are missing signatures. args {"from":"YYYY-MM-DD","to":"YYYY-MM-DD","who":"elc or all"}, this month so far and ELC only if empty',
'tablet_absences' => 'Absences on the Bear Line tablet with the reason the parent gave and whether the excuse is signed. args {"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}, this month so far if empty',
'tablet_staff_day' => 'Staff clock punches on the Bear Line time clock for one day (who clocked in, lunch, out). Times only, never pay. args {"date":"YYYY-MM-DD"}, today if empty',
'tablet_staff_requests' => 'Staff time-fix requests still open on the Bear Line time clock. args {}',
'tablet_day' => 'Children signed in and out on the Bear Line tablet (the parent sign-in record, not the Rooms board) for one day. args {"date":"YYYY-MM-DD"}, today if empty',
];
function tablet_read($op, $a, $school){
$a = is_array($a) ? $a : [];
if ($op === 'tablet_notices') $q = ['action' => 'hive_notices'];
elseif ($op === 'tablet_events') $q = ['action' => 'hive_events'];
elseif ($op === 'tablet_child_notes'){ if (trim((string)($a['child'] ?? '')) === '') return ['error' => 'child is needed']; $q = ['action' => 'hive_child_note', 'op' => 'list', 'child' => (string)$a['child']]; }
elseif ($op === 'tablet_unsigned'){ $q = ['action' => 'hive_bl_unsigned', 'who' => (strtolower((string)($a['who'] ?? '')) === 'all' ? 'all' : 'elc')]; if (ymd_ok((string)($a['from'] ?? ''))) $q['from'] = (string)$a['from']; if (ymd_ok((string)($a['to'] ?? ''))) $q['to'] = (string)$a['to']; }
elseif ($op === 'tablet_absences'){ $q = ['action' => 'hive_bl_absences']; if (ymd_ok((string)($a['from'] ?? ''))) $q['from'] = (string)$a['from']; if (ymd_ok((string)($a['to'] ?? ''))) $q['to'] = (string)$a['to']; }
elseif ($op === 'tablet_staff_day'){ $d = (string)($a['date'] ?? ''); $q = ['action' => 'hive_bl_staff_day', 'date' => ymd_ok($d) ? $d : now_et()->format('Y-m-d')]; }
elseif ($op === 'tablet_staff_requests'){ $q = ['action' => 'hive_staff_requests']; }
elseif ($op === 'tablet_day'){ $d = (string)($a['date'] ?? ''); $q = ['action' => 'hive_child_day', 'date' => ymd_ok($d) ? $d : now_et()->format('Y-m-d')]; }
else return ['error' => 'unknown lookup'];
list($ok, $j, $e) = bl_post($school, $q);
if (!$ok) return ['error' => $e === 'not_connected' ? 'Bear Line is not connected from here yet' : ('the tablet did not answer that lookup'.($e ? ' ('.$e.')' : ''))];
unset($j['ok']); return $j;
}
function note_child($n){ return (string)($n['child'] ?? $n['name'] ?? $n['childName'] ?? ''); }
/* A plain one-column PDF (Helvetica), enough for a printed record in a child's file. */
function simple_pdf($title, $lines){
$enc = function($t){ $t = @iconv('UTF-8', 'Windows-1252//TRANSLIT', (string)$t); return str_replace(['\\', '(', ')', "\r"], ['\\\\', '\\(', '\\)', ''], (string)$t); };
$rows = [];
foreach (array_merge([$title, ''], $lines) as $ln){ $ln = (string)$ln; if ($ln === ''){ $rows[] = ''; continue; } foreach (explode("\n", wordwrap($ln, 92, "\n", true)) as $w) $rows[] = $w; }
$pages = array_chunk($rows, 52); $objs = []; $kids = [];
$objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'; $objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
$n = 4;
foreach ($pages as $pg){
$st = "BT /F1 10 Tf 13 TL 50 760 Td\n"; foreach ($pg as $r) $st .= '('.$enc($r).") Tj T*\n"; $st .= 'ET';
$objs[$n] = '<< /Length '.strlen($st)." >>\nstream\n".$st."\nendstream";
$objs[$n + 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '.$n.' 0 R >>';
$kids[] = ($n + 1).' 0 R'; $n += 2;
}
$objs[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.count($kids).' >>';
ksort($objs); $out = "%PDF-1.4\n"; $off = [];
foreach ($objs as $i => $o){ $off[$i] = strlen($out); $out .= $i." 0 obj\n".$o."\nendobj\n"; }
$x = strlen($out); $out .= "xref\n0 ".(count($objs) + 1)."\n0000000000 65535 f \n";
foreach ($objs as $i => $o) $out .= sprintf("%010d 00000 n \n", $off[$i]);
return $out."trailer\n<< /Size ".(count($objs) + 1)." /Root 1 0 R >>\nstartxref\n".$x."\n%%EOF";
}
function filed_notes_file($school){ return private_dir().'/filed-notes-'.preg_replace('/[^a-z0-9]/i', '', $school).'.json'; }
/* Archived (seen) notes for one child that aren't in the Student File yet. */
function notes_to_file($school, $kid){
list($ok, $j, $e) = bl_post($school, ['action' => 'hive_child_note', 'op' => 'archived', 'child' => $kid]);
if (!$ok || !isset($j['notes']) || !is_array($j['notes'])) return null;
$done = json_decode((string)@file_get_contents(filed_notes_file($school)), true) ?: [];
$k = strtolower(preg_replace('/[^a-z0-9]/i', '', $kid)); $f = strtolower(preg_replace('/[^a-z0-9]/i', '', explode(' ', $kid)[0]));
return array_values(array_filter($j['notes'], function($n) use ($done, $k, $f){ $c = strtolower(preg_replace('/[^a-z0-9]/i', '', note_child($n)));
return !isset($done[(string)($n['id'] ?? '')]) && ($c === '' || $c === $k || $c === $f || strpos($k, $c) === 0); }));
}
function note_record_line($n){
$t = ucfirst((string)($n['type'] ?? 'note'));
$when = (string)($n['created'] ?? $n['at'] ?? $n['from'] ?? '');
$seen = (string)($n['seen'] ?? $n['seenAt'] ?? $n['okAt'] ?? $n['ok_at'] ?? '');
$who = (string)($n['seenBy'] ?? $n['okBy'] ?? $n['parent'] ?? '');
$es = (string)($n['es'] ?? ''); $en = (string)($n['en'] ?? $n['text'] ?? '');
return $t.($when ? ', left '.$when : '').(!empty($n['by']) ? ' by '.$n['by'] : '').': '.$en.($es !== '' && $es !== $en ? ' / '.$es : '').($seen ? '  (parent tapped OK '.$seen.($who ? ', '.$who : '').')' : '');
}
function bl_child_notes($school, $child){
list($ok, $j) = bl_post($school, ['action' => 'hive_child_note', 'op' => 'list', 'child' => $child]);
return ($ok && isset($j['notes']) && is_array($j['notes'])) ? $j['notes'] : null;
}
function show_word($w){ return ['in' => 'drop-off (sign-in)', 'out' => 'pickup (sign-out)', 'both' => 'drop-off and pickup'][$w] ?? $w; }
function day_span($fr, $to, $open = 'until taken down'){ return (empty($to) || $to >= '2099-01-01') ? 'from '.($fr ? nice_day($fr) : 'now').' '.$open : ($fr ? nice_day($fr) : 'now').' to '.nice_day($to); }
function notice_line($n){ $to = $n['to'] ?? $n['until'] ?? ''; return (!empty($n['type']) && $n['type'] === 'observation' ? 'observation ' : '').'"'.($n['en'] ?? $n['text'] ?? '').'"'.(!empty($n['from']) || $to ? ' ('.day_span($n['from'] ?? '', $to).')' : ''); }

/* ---------- Every Director Portal card, as the exact calls the card makes ----------
talk-catalogue.php lists each call (endpoint, action, its arguments). Lookups ("read") run right away
because they change nothing. Changes ("write") only come back as a proposal for the director's Yes.
Every call goes through the portal's own endpoints with the director's own PIN, so Talk to Bear Line
can never do more than that director could do by hand on the card. */
function catalogue(){ static $c = null; if ($c === null){ $c = []; $raw = @include __DIR__.'/talk-catalogue.php'; foreach ((is_array($raw) ? $raw : []) as $e) if (!empty($e['id'])) $c[$e['id']] = $e; } return $c; }
function cat_ids($kind){ return array_keys(array_filter(catalogue(), function($e) use ($kind){ return $e['kind'] === $kind; })); }
function cat_lines($kind){
$out = [];
foreach (catalogue() as $id => $e){ if ($e['kind'] !== $kind) continue; $ps = [];
foreach ((array)($e['params'] ?? []) as $k => $d) if (($d['type'] ?? '') !== 'signature') $ps[] = $k.' ('.($d['type'] ?? 'string').(!empty($d['required']) ? ', required' : '').(!empty($d['enum']) ? ', one of '.implode('|', $d['enum']) : '').')'.(!empty($d['desc']) ? ': '.$d['desc'] : '');
$out[] = '* '.$id.' ['.($e['card'] ?? '').'] '.($e['what'] ?? '').($ps ? ' Args: '.implode('; ', $ps).'.' : ' No args.').(!empty($e['needs_id_from']) ? ' Ids from: '.$e['needs_id_from'].'.' : '').(!empty($e['outside_effect']) && $e['outside_effect'] !== 'none' ? ' Outside effect: '.$e['outside_effect'].'.' : '').(!empty($e['response']) && $kind === 'read' ? ' Returns: '.$e['response'].'.' : ''); }
return implode("\n", $out);
}
/* Checks Claude's arguments against the card's own list: only known keys, right types, allowed choices. */
function cat_args($id, $args, $kind){
$c = catalogue(); if (!isset($c[$id]) || $c[$id]['kind'] !== $kind) return [null, [], 'that isn\'t something the portal cards do'];
$e = $c[$id]; if (!is_array($args)) $args = [];
$body = ['action' => $e['action']]; $vals = [];
$put = function($k, $v) use (&$body){ if (strpos($k, '.') !== false){ list($a, $b) = explode('.', $k, 2); if (!isset($body[$a]) || !is_array($body[$a])) $body[$a] = []; $body[$a][$b] = $v; } else $body[$k] = $v; };
foreach ((array)($e['fixed'] ?? []) as $k => $v) $put($k, $v);
$miss = [];
foreach ((array)($e['params'] ?? []) as $k => $d){
if (($d['type'] ?? '') === 'signature') continue;   // the director signs on the screen; never made up
if (!array_key_exists($k, $args) || $args[$k] === '' || $args[$k] === null){ if (!empty($d['required'])) $miss[] = $k; continue; }
$v = $args[$k]; $t = $d['type'] ?? 'string';
if ($t === 'number'){ if (!is_numeric($v)) return [null, [], $k.' must be a number']; $v = $v + 0; }
elseif ($t === 'boolean'){ if (!is_bool($v)){ $v = filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE); if ($v === null) return [null, [], $k.' must be yes or no']; } }
elseif ($t === 'array' || $t === 'object'){ if (!is_array($v)) return [null, [], $k.' must be a list']; if (strlen(json_encode($v)) > 20000) return [null, [], $k.' is too long']; }
else { if (!is_scalar($v)) return [null, [], $k.' must be text']; $v = mb_substr(trim((string)$v), 0, 4000); }
if (!empty($d['enum']) && !in_array($v, $d['enum'], true)) return [null, [], $k.' must be one of '.implode(', ', $d['enum'])];
$put($k, $v); $vals[$k] = $v;
}
if ($miss) return [null, $miss, 'missing'];
return [$body, $vals, ''];
}
function post_json($endpoint, $body){
$ch = curl_init('https://'.TALK_HOST.'/hive/'.$endpoint);
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode($body)]);
$raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$j = json_decode($raw ?: '', true);
return is_array($j) ? $j : ['error' => 'no answer ('.$code.')'];
}
function portal_call($id, $body, $pin){
global $school; static $pass = null;
$c = catalogue(); if (!isset($c[$id])) return ['error' => 'Not allowed'];
$e = $c[$id]; if (!preg_match('/^[a-z0-9-]+\.php$/', $e['endpoint'])) return ['error' => 'Not allowed'];
if ($e['endpoint'] === 'pack-api.php' || $e['endpoint'] === 'clean-api.php'){
/* The classroom packet pages use a director sign-in made from the same director PIN (good for 4 hours). */
$sk = $school === 'Sanford' ? 'sanford' : 'deland';
if ($pass === null) $pass = post_json('pack-api.php', ['act' => 'dirlogin', 's' => $sk, 'p' => 'director', 'pin' => $pin]);
if (empty($pass['pass'])) return ['error' => 'The classroom packet sign-in didn\'t work'.(!empty($pass['error']) ? ' ('.$pass['error'].')' : '').'.'];
if ($e['endpoint'] === 'pack-api.php'){ if (!isset($e['params']['action'])) unset($body['action']); $body += ['p' => 'director']; $body['s'] = $sk; $body['pass'] = $pass['pass']; $body['dtok'] = $pass['dtok'] ?? ''; }
else { $body['rpass'] = $pass['pass']; $body['sk'] = $sk; }
}
else { $body['pin'] = $pin; if (!empty($e['dirpin'])) $body['dirpin'] = $pin; }
$body = iso_force($body);
$j = post_json($e['endpoint'], $body);
if (isset($j['error']) && strpos((string)$j['error'], 'no answer') === 0) return ['error' => 'The '.($e['card'] ?? 'portal').' card didn\'t answer.'];
return iso_filter($j) ?? [];
}
/* ONE-SCHOOL RULE: a director only ever gets their own school. The school comes from the PIN (never from the words). Anything a lookup returns that is marked with the other school is dropped before Claude sees it,
   and anything Claude sends with a School field is forced to the director's own school. */
function iso_names(){ global $school; return $school === 'Sanford' ? ['Sanford', 'DeLand'] : ['DeLand', 'Sanford']; }
function iso_other_hit($val){ list($mine, $other) = iso_names(); $v = (string)$val; return stripos($v, $other) !== false && stripos($v, $mine) === false; }
function iso_filter($v){
if (!is_array($v)) return $v;
foreach (['School', 'school', 'Location', 'sk', 'fields.School'] as $k){ if (isset($v[$k]) && is_string($v[$k]) && iso_other_hit($v[$k])) return null; }
if (isset($v['fields']) && is_array($v['fields']) && isset($v['fields']['School']) && is_string($v['fields']['School']) && iso_other_hit($v['fields']['School'])) return null;
$o = []; $list = array_keys($v) === range(0, count($v) - 1);
foreach ($v as $k => $x){ $y = iso_filter($x); if ($y === null && is_array($x)) continue; if ($list) $o[] = $y; else $o[$k] = $y; }
return $o;
}
function iso_force($b){
global $school; if (!is_array($b)) return $b;
foreach ($b as $k => $x){
if (is_array($x)) { $b[$k] = iso_force($x); continue; }
if (is_string($k) && preg_match('/(^|\.)school$/i', $k) && is_string($x) && $x !== '' && (stripos($x, 'sanford') !== false || stripos($x, 'deland') !== false)) $b[$k] = ($school === 'Sanford') ? 'Sanford' : 'DeLand 2';
}
return $b;
}
/* Keeps lookups small for Claude: no file contents, signatures or pictures, long lists cut short. */
function shrink($v, $depth = 0){
if (is_string($v)) return mb_strlen($v) > 400 ? mb_substr($v, 0, 400).'…' : $v;
if (!is_array($v)) return $v;
$o = []; $i = 0;
foreach ($v as $k => $x){
if (++$i > 60){ $o['more'] = (count($v) - 60).' more not shown'; break; }
if (is_string($k) && preg_match('/(pin|password|passcode|token|secret)$/i', $k)){ $o[$k] = '[hidden]'; continue; }
if (is_string($k) && preg_match('/(b64|pdf|png|jpg|photo|image|sig|face|data)$/i', $k) && is_string($x) && strlen($x) > 200){ $o[$k] = '[file]'; continue; }
$o[$k] = $depth > 6 ? '…' : shrink($x, $depth + 1);
}
return $o;
}
function nice_key($k){ if (strpos($k, '.') !== false) return substr($k, strpos($k, '.') + 1); return ucfirst(trim(strtolower(preg_replace('/([a-z])([A-Z])/', '$1 $2', str_replace('_', ' ', $k))))); }

/* ============================================================ */
if (AIRTABLE_TOKEN === 'PASTE_YOUR_AIRTABLE_TOKEN_HERE') fail('The Airtable token is missing on the server.', 503);
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('Bad request');
$pin = strtoupper(trim($input['pin'] ?? ''));
$pins = get_pins();
if (!$pin || !isset($pins[$pin])) fail('That PIN isn\'t right.', 401);
$role = $pins[$pin];
if (!isset($ROLE_SCHOOL[$role])) fail('Talk to Bear Line is for directors only.', 403);
$school = $ROLE_SCHOOL[$role];
$action = $input['action'] ?? '';

if ($action === 'whoami'){
echo json_encode(['school' => $school, 'live' => TALK_LIVE, 'keyReady' => CLAUDE_API_KEY !== '']); exit;
}

/* ---------- Check the link to the Bear Line tablet. Changes nothing: a made-up staff name must
   come back unknown_staff, and an empty notice must be refused. ---------- */
if ($action === 'selftest'){
$lines = [];
list($ok, $j, $e) = bl_post($school, ['action' => 'hive_fix_punch', 'staff' => 'Zzqx Linkcheck Nobody', 'date' => now_et()->format('Y-m-d'), 'type' => 'in', 'at' => '09:00', 'by' => 'Talk to Bear Line link check', 'note' => 'Link check with a made-up name']);
$lines[] = 'Staff time fixes: '.($e === 'unknown_staff' ? 'connected (a made-up name was turned away, as it should be).' : ($e === 'not_connected' ? 'not connected, elc-sync-code.php isn\'t next to hive-token.php on this server yet.' : ($e === 'denied' ? 'the code doesn\'t match the tablet\'s code.' : ($e === 'no_answer' ? 'the tablet didn\'t answer.' : 'unexpected answer ('.($ok ? 'ok' : $e).').'))));
if ($e !== 'not_connected'){
list($ok2, $j2, $e2) = bl_post($school, ['action' => 'hive_set_notice', 'op' => 'linkcheck', 'en' => '', 'by' => 'Talk to Bear Line link check']);
$lines[] = 'Front tablet notices: '.(in_array($e2, ['bad_op','empty_text'], true) ? 'connected.' : ($e2 === 'denied' ? 'the code doesn\'t match.' : 'unexpected answer ('.($ok2 ? 'ok' : $e2).').'));
list($ok3, $j3, $e3) = bl_post($school, ['action' => 'hive_child_note', 'op' => 'linkcheck', 'child' => '', 'en' => '', 'by' => 'Talk to Bear Line link check']);
$lines[] = 'Notes for one family: '.(in_array($e3, ['bad_op','empty_text','unknown_child'], true) ? 'connected.' : ($e3 === 'denied' ? 'the code doesn\'t match.' : 'not there yet (desktop Prompt 3 adds it).'));
list($ok4, $j4, $e4) = bl_post($school, ['action' => 'hive_event', 'op' => 'linkcheck', 'en' => '', 'by' => 'Talk to Bear Line link check']);
$lines[] = 'Front tablet events: '.(in_array($e4, ['bad_op','empty_text'], true) ? 'connected.' : ($e4 === 'denied' ? 'the code doesn\'t match.' : 'not there yet (desktop Prompt 4 adds it).'));
list($ok5, $j5, $e5) = bl_post($school, ['action' => 'hive_child_sign', 'child' => 'Zzqx Linkcheck Nobody', 'date' => now_et()->format('Y-m-d'), 'type' => 'in', 'at' => '09:00', 'by' => 'Talk to Bear Line link check']);
$lines[] = 'Child sign-in on the tablet record: '.($e5 === 'unknown_child' ? 'connected (a made-up name was turned away).' : ($e5 === 'denied' ? 'the code doesn\'t match.' : 'not there yet (desktop Prompt 4 adds it).'));
$lines[] = 'Reading the notices already up: '.(bl_notices($school) !== null ? 'works.' : 'not there yet (desktop Prompt 3 adds it).');
}
log_line(['school' => $school, 'role' => $role, 'words' => 'Link check', 'kind' => 'selftest', 'result' => implode(' ', $lines)]);
echo json_encode(['ok' => true, 'say' => implode("\n", $lines)]); exit;
}

/* ---------- PLAN: words -> one proposed change ---------- */
if ($action === 'plan'){
$words = trim(mb_substr((string)($input['words'] ?? ''), 0, 400));
if ($words === '') fail('Say or type what you want done.');
$fi = (array)($input['file'] ?? []); $file = null;
if (!empty($fi['name'])) $file = ['name' => mb_substr(preg_replace('/[^\w .()\-]/u', '', (string)$fi['name']), 0, 80), 'type' => in_array($fi['type'] ?? '', ['image/jpeg','image/png','application/pdf'], true) ? $fi['type'] : 'file'];
$docs = doc_types();
if (CLAUDE_API_KEY === '') fail('The Claude key hasn\'t been added to the server yet. Mrs. Bear adds it in Hostinger, then this starts working.', 503);
if (!bump_cap($school)) fail('Talk to Bear Line has reached today\'s limit for '.$school.'. It resets at midnight.', 429);

$ctx = school_context($school);
$cards = array_slice(array_values(array_filter(array_map(function($c){ return trim(mb_substr((string)$c, 0, 60)); }, (array)($input['cards'] ?? [])))), 0, 160);
$now = now_et();
$hist = [];
foreach (array_slice((array)($input['history'] ?? []), -8) as $h){ $u = trim(mb_substr((string)($h['you'] ?? ''), 0, 300)); $b = trim(mb_substr((string)($h['me'] ?? ''), 0, 300)); if ($u !== '') $hist[] = "Director: $u\nYou: $b"; }

$system = "You are Talk to Bear Line, the voice helper for the director of Kid City USA $school, a preschool. "
."The director says or types a request. It may ask for several things in one sentence (for example \"the toddlers are going to the playground and sign Ms. Ana out at 2\"). Return one action for each thing, in the order they said them, at most 5. You never make changes yourself: the director sees each proposal and taps Yes or No on each one. Yes and No buttons appear ONLY on a proposed change. In a clarify or an answer, NEVER say tap, press or click Yes; there is no button there. If you need a go-ahead or a missing detail, ask it as a plain question the director can answer by typing (for example: Want me to send it? Type yes or tell me what to change).\n\n"
."ONE SCHOOL ONLY: you work for the director of Kid City USA $school and nobody else. Never ask which school, never answer about, look up, send to or change anything at the other school, even if asked or if a result seems to include it. If asked about the other school, say kindly that you can only help with $school. "
."What you can see and do: in the Director Portal you can look up almost every card (briefing, staff hours, buzz board, ratios, enrollment, new hires, parent portal, parent uploads and replies, staff and student files, training, reporting, DCF binder, transportation, inventory, food program, the Director Pack tiles) and propose changes to most of them. On the Bear Line tablet you can look up: who is signed in or out on a day, ELC children missing parent signatures, absences and their reasons, staff clock punches, open time-fix requests, front-screen notices and events, and a child's parent notes; and you can propose signing a child in or out, fixing a staff punch, and adding or changing notices, events and parent notes. You never handle PINs, passwords or pay amounts. If the director asks what you can do, tell them this in plain words with a couple of example questions. If something is not on that list, say so plainly and name the closest thing you can do.\n\nThink the request through before you answer: work out which card or action fits, what it needs, and what the director already gave you. When they ask to send a template email to parents (inquiry, enrolled, onboard, tour, registration, sams, teacher hub, management hub), use the portal op api_create_email_automation_requests with Template and Parent Emails; the card fills in the rest. If a detail is missing, use clarify and name the card and every missing detail with the choices, in one message.\n\nWhenever you ask a question (clarify), say you cannot do something (cant), or need something said a certain way, ALWAYS finish with one short example of exactly how the director can say it, in quotes, using real names from the lists when you can (for example: Try saying: \"send the tour email to mom@example.com\"). Never just tell them to say it another way.\n\nPick kind:\n"
."- room_sign_in / room_sign_out: sign one or more CHILDREN in or out for TODAY, on the Rooms board and on the Bear Line tablet record (the parent sign-in). children = exact names from the Children list. time = HH:MM 24-hour; use the current time when they say now or give no time.\n"
."- staff_time_fix: fix a STAFF member's clock-in or clock-out time (for example \"sign Ms. Ana out at 2 PM yesterday\"). This changes their punch on the Bear Line time clock right away. staff = exact name from the Staff list. date = YYYY-MM-DD (today if not said). time_in, lunch_out, lunch_in and/or time_out as HH:MM 24-hour (lunch_out = left for lunch, lunch_in = back from lunch); leave the ones they didn't mention empty. reason = their reason, or \"Entered by the director with Talk to Bear Line\".\n"
."- inventory_count: set the on-hand count of a supply. item = exact name from the Inventory list. qty = whole number as text.\n"
."- rooms_board: a whole CLASS or ROOM on the Rooms board. board_action = out (the room is leaving for the playground, outside, the playroom or the office; also called a transition), back (the room is coming back inside), move (move children or a whole room into another room), or meal (mark breakfast, lunch or PM snack). room = exact name from the Rooms list. room_to = for out: Playground, Outside, Playroom or Office; for move: the exact room they go to. For meal, item = breakfast, lunch or snack. For move of only some children, children = their exact names.\n"
."- open_card: they want to open, bring up or go to a page, form, card or tool (for example \"bring up the food program forms\"). card = exact name from the Cards list that fits best.\n"
."- question: they ask how, where, when or how many about the Director Portal or the school. question = their question, cleaned up. The director chatbot answers it.\n"
."- tablet: put up, change, take down or list notices on the front sign-in tablet's Family Corner, which every family sees (for example \"Happy Birthday Gabriella\" or \"Picture day is Friday\"). The tablet has no greeting, so a greeting or a message for the tablet is a notice. notice_op = add, update, remove, or list (they ask what's on the front tablet). body = the notice in English exactly as it should show (plain text, at most 300 characters). es = the same notice in Spanish. title = a short title only if they give one, else empty. from = first day it shows and to_date = last day, as YYYY-MM-DD; leave from empty for today and to_date empty for until it's taken down. For update or remove, notice_match = a few words from the notice they mean. To sign a child in or out use room_sign_in / room_sign_out; to fix a staff clock time use staff_time_fix.\n"
."- parent_note: a note on ONE child for that child's own parent. It pops up on the Bear Line tablet right after the parent enters their PIN and stays until they tap OK. children = [exact child name]. note_type = note (a reminder or message, for example \"please bring a change of clothes\") or observation (how the child did in class, a good day, anything to share; it also goes in the child's file later). Parents see both kinds. notice_op = add, remove (take a note down), list (what's waiting for that child), or file (put that child's notes the parent already read into the Student File). body = the note in English as the parent will read it, kind and short, written as the school (plain text, at most 300 characters). es = the same note in Spanish. from = first day it can show and to_date = last day, as YYYY-MM-DD; leave from empty for today and to_date empty for until the parent taps OK. For remove, notice_match = a few words from the note. For something every family sees, use tablet.\n"
."- tablet_event: put up, change or take down an EVENT on the front tablet screen (for example \"Friendsgiving Lunch on Nov 25 at 11:30\"). notice_op = add, update or remove. body = the event name in English, es = in Spanish, from = the event day (YYYY-MM-DD), to_date = last day only for a several-day event, else empty, time = start time HH:MM 24-hour or empty. For update or remove, notice_match = a few words from the event. Closed days come from the Closures card, not here.\n"
."- clarify: you are not sure who or what they mean, a name matches nobody or more than one person, or ANY detail needed to finish the request is missing (who, which child, which date or time, which email address, how long, what the wording should be). Ask for ALL the missing details in ONE short question, and offer likely answers when you can. Never tell the director to say it another way or ask in another form; say exactly what is missing. question = that one short question.\n"
."- compose: they want the onboarding or enrollment LINK emailed to one person (for example \"send an onboarding email to Maria at maria@example.com\" or \"email Mr. Lee the new staff link\"). link_kind = staff (a new staff member), existing (a staff member who already works here and signs the packet once) or enroll (a family). email_to = the email address exactly as the director typed it in their words; if they gave no address leave it empty and use clarify to ask for it. recipient = the person's name if given. You never send this: it opens Gmail with the message ready and the director taps Send there.\n"
."- file_to_person: put the ATTACHED file in a staff member's or child's file. staff = exact staff name OR children = [exact child name]. doc = the key of the best document type from that person's Documents list.\n"
."- file_to_vault: put the ATTACHED file in the Audit Vault in Reporting. month = YYYY-MM (this month unless they say). section = elc, food, dcf or other.\n"
."- email: send an email for the director. to = office (the director's own school office, ".$OFFICE[$school]."; always use office when they say email it to me, send it to me or email myself), food_program (the food program sponsor)".(OWNER_ADDR ? ", or owner (Mrs. Bear, only when they name Mrs. Bear or the owner)" : "").". Never write an email address yourself. subject = short subject. body = the email text, written as the director in first person, polite and short, signed \"Kid City USA $school\". attach = yes when the attached file should go with it, otherwise no.\n"
."- portal: any other change a director can make by hand on a Director Portal card (time off, new hires, enrollments, parent uploads and requests, the parent portal board, room notes, staff and child files, facility checklists, weekly checks, DCF forms, transportation, supplies, messages to send through ProCare, the briefing checklist, staff meeting, and everything else in the Portal changes list below). op = the id from the Portal changes list. args_json = a JSON object with that change's args, built exactly as described (ids come from a portal_read lookup first). say = one sentence describing the change in plain words with names and dates.\n"
."- answer: after you looked something up with portal_read, answer the director's question in say (one to three short sentences with the real names, numbers and dates). Use this for questions about what is in the portal right now (who is off tomorrow, how many enrollments are waiting, which checks aren't done).\n"
."- cant: anything about PINs, passwords, codes, money or payroll amounts, or something no card can do. Say WHY in one kind sentence, and when a Director Portal card does something close, also use open_card for it in the same answer.\n\n"
."Looking things up: use the portal_read tool whenever you need real data, to answer a question or to find the id a change needs (for example list the time off requests before approving one). Lookups change nothing. Do not guess ids. If a lookup shows more than one possible match, use clarify.\n\n"
."Portal changes list (op ids for kind portal):\n".cat_lines('write')."\n\n"
."Portal lookups (op ids for the portal_read tool):\n".cat_lines('read')."\n".implode("\n", array_map(function($k, $v){ return "$k: $v"; }, array_keys($TABLET_READS), $TABLET_READS));
/* Everything above stays the same all day, so Claude reads it from the cache (about a tenth of the price). What changes goes after it. */
$dynamic = "Today is ".$now->format('l, Y-m-d')." and the time is ".$now->format('H:i')." (Eastern).\n\n"
.($file ? "The director has attached a file: \"".$file['name']."\" (".$file['type'].").\n\n" : "No file is attached. If they ask to file or email an attachment, use clarify and ask them to tap the paperclip first.\n\n")
."Rules: Only use names that are in the lists below, spelled exactly as listed. Never guess between two people. A staff member is never a child. "
."say = one short, friendly sentence to the director describing exactly what you propose, with names, day and 12-hour time, or your question. Leave every field you don't use as an empty string.\n\n"
."Staff list: ".implode('; ', $ctx['staff'])."\n\n"
."Children list: ".implode('; ', array_keys($ctx['kids']))."\n\n"
."Rooms list: ".implode('; ', $ctx['rooms'] ?? [])."\n\n"
."Inventory list: ".implode('; ', array_keys($ctx['items']))."\n\n"
."Staff documents (key = label): ".implode('; ', array_map(function($k, $v){ return "$k = $v"; }, array_keys($docs['staff']), $docs['staff']))."\n\n"
."Child documents (key = label): ".implode('; ', array_map(function($k, $v){ return "$k = $v"; }, array_keys($docs['student']), $docs['student']))."\n\n"
."Cards list: ".implode('; ', $cards);

$one = ['type' => 'object', 'additionalProperties' => false,
'properties' => [
'kind' => ['type' => 'string', 'enum' => ['portal','answer','compose','file_to_person','file_to_vault','email','rooms_board','room_sign_in','room_sign_out','staff_time_fix','inventory_count','open_card','question','tablet','tablet_event','parent_note','clarify','cant']],
'say' => ['type' => 'string'], 'children' => ['type' => 'array', 'items' => ['type' => 'string']],
'time' => ['type' => 'string'], 'staff' => ['type' => 'string'], 'date' => ['type' => 'string'],
'time_in' => ['type' => 'string'], 'time_out' => ['type' => 'string'], 'lunch_out' => ['type' => 'string'], 'lunch_in' => ['type' => 'string'], 'reason' => ['type' => 'string'],
'notice_op' => ['type' => 'string', 'enum' => ['add','update','remove','list','file','']], 'es' => ['type' => 'string'], 'title' => ['type' => 'string'], 'from' => ['type' => 'string'], 'to_date' => ['type' => 'string'], 'notice_match' => ['type' => 'string'], 'note_type' => ['type' => 'string', 'enum' => ['note','observation','']],
'item' => ['type' => 'string'], 'qty' => ['type' => 'string'], 'card' => ['type' => 'string'], 'question' => ['type' => 'string'],
'board_action' => ['type' => 'string', 'enum' => ['out','back','move','meal','']], 'room' => ['type' => 'string'], 'room_to' => ['type' => 'string'],
'doc' => ['type' => 'string'], 'month' => ['type' => 'string'], 'section' => ['type' => 'string', 'enum' => ['elc','food','dcf','other','']],
'to' => ['type' => 'string', 'enum' => array_merge(['office','food_program'], OWNER_ADDR ? ['owner'] : [], [''])], 'subject' => ['type' => 'string'], 'body' => ['type' => 'string'], 'attach' => ['type' => 'string', 'enum' => ['yes','no']],
'op' => ['type' => 'string', 'enum' => array_merge(cat_ids('write'), [''])], 'args_json' => ['type' => 'string'],
'link_kind' => ['type' => 'string', 'enum' => ['staff','existing','enroll','']], 'email_to' => ['type' => 'string'], 'recipient' => ['type' => 'string']],
'required' => ['op','args_json','link_kind','email_to','recipient','kind','say','children','time','staff','date','time_in','time_out','lunch_out','lunch_in','reason','notice_op','es','title','from','to_date','notice_match','note_type','item','qty','card','question','board_action','room','room_to','doc','month','section','to','subject','body','attach']];
$schema = ['type' => 'object', 'additionalProperties' => false, 'properties' => ['actions' => ['type' => 'array', 'items' => $one]], 'required' => ['actions']];

$user = ($hist ? "Earlier in this conversation:\n".implode("\n", $hist)."\n\n" : '')."Director's request: ".$words;
$reads = array_merge(cat_ids('read'), array_keys($TABLET_READS));
$tools = $reads ? [['name' => 'portal_read', 'description' => 'Look something up in the Director Portal for this school, exactly the way the card does it. Changes nothing. Returns the card\'s JSON.',
'input_schema' => ['type' => 'object', 'additionalProperties' => false, 'properties' => [
'op' => ['type' => 'string', 'enum' => $reads, 'description' => 'Lookup id from the Portal lookups list'],
'args_json' => ['type' => 'string', 'description' => 'JSON object with the lookup\'s args, or {} when it has none']], 'required' => ['op','args_json']]]] : [];
$msgs = [['role' => 'user', 'content' => $user]]; $looked = 0; $res = [];
for ($round = 0; $round < 6; $round++){
$req = ['model' => MODEL, 'max_tokens' => 2000,
'system' => [['type' => 'text', 'text' => $system, 'cache_control' => ['type' => 'ephemeral', 'ttl' => '1h']], ['type' => 'text', 'text' => $dynamic]],
'output_config' => ['effort' => 'high', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
'messages' => $msgs];
if ($tools){ $req['tools'] = $tools; if ($round >= 5 || $looked >= 8) $req['tool_choice'] = ['type' => 'none']; }
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90,
CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: '.CLAUDE_API_KEY, 'anthropic-version: 2026-10-21'],
CURLOPT_POSTFIELDS => json_encode($req)]);
$raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
if ($code !== 200 && $req['model'] !== 'claude-haiku-5-5'){   /* the better model wasn't available just now: use the small one so the director still gets an answer */
$req['model'] = 'claude-haiku-5-5'; $req['output_config']['effort'] = 'low';
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40,
CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: '.CLAUDE_API_KEY, 'anthropic-version: 2026-10-21'],
CURLOPT_POSTFIELDS => json_encode($req)]);
$raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
}
$res = json_decode($raw ?: '{}', true);
if ($code !== 200){ log_line(['school'=>$school,'role'=>$role,'words'=>$words,'result'=>'Claude error '.$code]); fail('Talk to Bear Line couldn\'t reach Claude just now ('.$code.'). Try again in a minute.', 502); }
if (($res['stop_reason'] ?? '') !== 'tool_use') break;
$results = [];
foreach (($res['content'] ?? []) as $b){
if (($b['type'] ?? '') !== 'tool_use') continue;
$looked++;
$in = (array)($b['input'] ?? []); $op = (string)($in['op'] ?? '');
if (isset($TABLET_READS[$op])) $got = tablet_read($op, json_decode((string)($in['args_json'] ?? '{}'), true), $school);
else { list($body, $vals, $err) = cat_args($op, json_decode((string)($in['args_json'] ?? '{}'), true), 'read');
$got = $err ? ['error' => $err] : portal_call($op, $body, $pin); }
$txt = json_encode(shrink($got), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (strlen($txt) > 14000) $txt = mb_strcut($txt, 0, 14000).' …(cut short)';
$results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'content' => $txt] + (!empty($got['error']) ? ['is_error' => true] : []);
}
if (!$results) break;
$msgs[] = ['role' => 'assistant', 'content' => $res['content']];
$msgs[] = ['role' => 'user', 'content' => $results];
}
if (($res['stop_reason'] ?? '') === 'refusal') fail('I can\'t help with that one.', 422);
$text = ''; foreach (($res['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $text .= $b['text'];
$P = json_decode($text, true);
if (!is_array($P) || empty($P['actions']) || !is_array($P['actions'])) fail('I didn\'t catch that. Try saying it another way.', 502);
$plans = [];
foreach (array_slice($P['actions'], 0, 5) as $p){
if (!is_array($p) || empty($p['kind'])) continue;

/* Re-check every name against this school's own lists. Anything unsure becomes a question back. */
$out = ['kind' => $p['kind'], 'say' => (string)$p['say']];
$ask = function($q) use (&$out){ $out = ['kind' => 'clarify', 'say' => $q]; };
switch ($p['kind']){
case 'room_sign_in': case 'room_sign_out':
$names = []; $miss = [];
foreach ((array)$p['children'] as $c){ $m = pick_name($c, array_keys($ctx['kids'])); if ($m) $names[$m] = 1; else $miss[] = $c; }
$t = hm_ok($p['time']) ? $p['time'] : $now->format('H:i');
if ($miss) $ask('I couldn\'t find '.implode(', ', $miss).' on the '.$school.' children list. Which child do you mean?');
elseif (!$names) $ask('Which child?');
else { $out['children'] = array_keys($names); $out['time'] = $t; $out['date'] = $now->format('Y-m-d');
$out['say'] = ($p['kind'] === 'room_sign_in' ? 'Sign in ' : 'Sign out ').implode(', ', $out['children']).' today at '.hm12($t).', on the Rooms board and the Bear Line tablet record?'; }
break;
case 'staff_time_fix':
$s = pick_name($p['staff'], $ctx['staff']);
$d = preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['date']) ? $p['date'] : $now->format('Y-m-d');
$fx = []; foreach (['in' => 'time_in', 'lunchOut' => 'lunch_out', 'lunchIn' => 'lunch_in', 'out' => 'time_out'] as $ty => $k){ if (hm_ok($p[$k] ?? '')) $fx[$ty] = $p[$k]; }
$seq = array_values($fx); $sorted = $seq; sort($sorted);
if (!$s) $ask('Which staff member? I couldn\'t match "'.$p['staff'].'" to one person on the '.$school.' staff list.');
elseif (!$fx) $ask('What time should '.$s.' be clocked in or out?');
elseif ($d > $now->format('Y-m-d')) $ask('That day hasn\'t happened yet. Which day did you mean?');
elseif ($seq !== $sorted) $ask('Those times are out of order for '.$s.'. What time did they clock in, go to lunch, come back and clock out?');
else { $out += ['staff' => $s, 'date' => $d, 'time_in' => $fx['in'] ?? '', 'lunch_out' => $fx['lunchOut'] ?? '', 'lunch_in' => $fx['lunchIn'] ?? '', 'time_out' => $fx['out'] ?? '', 'reason' => trim($p['reason']) ?: 'Entered by the director with Talk to Bear Line'];
$out['say'] = 'Change '.$s.'\'s time on '.nice_day($d).' to '.implode(', ', array_map(function($ty, $t){ return punch_word($ty).' at '.hm12($t); }, array_keys($fx), $fx)).' on the Bear Line time clock?'; }
break;
case 'inventory_count':
$it = pick_name($p['item'], array_keys($ctx['items']));
$q = preg_match('/^\d{1,5}$/', trim($p['qty'])) ? (int)$p['qty'] : -1;
if (!$it) $ask('Which supply? I couldn\'t match "'.$p['item'].'" to the '.$school.' inventory list.');
elseif ($q < 0) $ask('How many '.$it.' are on hand?');
else { $out += ['item' => $it, 'qty' => $q]; $out['say'] = 'Set '.$it.' to '.$q.' on hand?'; }
break;
case 'rooms_board':
/* Handed to Director Bear Chat's Rooms board panel, which shows the count, who counted and the sweep before Confirm. */
$rl = $ctx['rooms'] ?? []; $rm = pick_name($p['room'], $rl); $ba = (string)$p['board_action'];
$names = []; foreach ((array)$p['children'] as $c){ $m = pick_name($c, array_keys($ctx['kids'])); if ($m) $names[] = $m; }
if ($ba === 'out'){ $pl = pick_name($p['room_to'], ['Playground','Outside','Playroom','Office']) ?: 'Playground';
if (!$rm) $ask('Which room is going out to the '.$pl.'?'); else $out['command'] = $rm.' going out to the '.$pl; }
elseif ($ba === 'back'){ $out['command'] = $rm ? $rm.' back inside' : 'back inside'; }
elseif ($ba === 'move'){ $to = pick_name($p['room_to'], $rl);
if (!$to) $ask('Which room should they move to?');
elseif ($names) $out['command'] = 'move '.implode(' and ', $names).' to '.$to;
elseif ($rm) $out['command'] = 'move everyone in '.$rm.' to '.$to;
else $ask('Who should move to '.$to.'?'); }
elseif ($ba === 'meal'){ $ml = preg_match('/lunch/i', $p['item']) ? 'lunch' : (preg_match('/snack/i', $p['item']) ? 'PM snack' : 'breakfast'); $out['command'] = 'Mark '.$ml.($rm ? ' for '.$rm : ''); }
else $ask('What should happen on the Rooms board?');
break;
case 'open_card':
$c = pick_name($p['card'], $cards);
if (!$c){ $out = ['kind' => 'question', 'say' => (string)$p['say'], 'question' => $words]; } else $out['card'] = $c;
break;
case 'question': $out['question'] = trim($p['question']) ?: $words; break;
case 'file_to_person':
if (!$file){ $ask('Tap the paperclip and pick the file or photo first, then tell me where it goes.'); break; }
$kid = ''; foreach ((array)$p['children'] as $c){ $kid = pick_name($c, array_keys($ctx['kids'])); if ($kid) break; }
$st = $kid ? '' : pick_name($p['staff'], $ctx['staff']);
$pkind = $kid ? 'student' : 'staff'; $who = $kid ?: $st;
if (!$who){ $ask('Whose file should this go in? I couldn\'t match that name to one person at '.$school.'.'); break; }
$doc = (string)$p['doc'];
if (!isset($docs[$pkind][$doc])){ $ask('Which document is this for '.$who.'?'); break; }
$out += ['person_kind' => $pkind, 'person' => $who, 'doc' => $doc, 'doc_label' => $docs[$pkind][$doc], 'file_name' => $file['name']];
$out['say'] = 'File "'.$file['name'].'" in '.$who.'\'s '.($pkind === 'staff' ? 'Staff File' : 'Student File').' under '.$docs[$pkind][$doc].'?';
break;
case 'file_to_vault':
if (!$file){ $ask('Tap the paperclip and pick the file or photo first, then tell me where it goes.'); break; }
$mo = preg_match('/^20\d\d-(0[1-9]|1[0-2])$/', $p['month']) ? $p['month'] : $now->format('Y-m');
$sec = isset($VAULT[$p['section']]) ? $p['section'] : '';
if (!$sec){ $ask('Which part of the Audit Vault: ELC, Food Program, DCF, or Staff Meetings & Other?'); break; }
$out += ['month' => $mo, 'section' => $sec, 'file_name' => $file['name']];
$out['say'] = 'File "'.$file['name'].'" in the Audit Vault, '.DateTime::createFromFormat('Y-m-d', $mo.'-01')->format('F Y').', '.$VAULT[$sec].'?';
break;
case 'email':
list($addr, $label) = recipient((string)$p['to'], $school);
if (!$addr){ $ask($p['to'] === 'food_program' ? 'There\'s no food program email saved for '.$school.'. Its claim goes through KidKare. Who should I email instead?' : ($p['to'] === 'owner' ? 'Mrs. Bear\'s email isn\'t saved on the server yet, so I can\'t email her from here. I can send it to the '.$school.' office instead.' : 'Who should this go to: the '.$school.' office'.(OWNER_ADDR ? ', the food program, or Mrs. Bear?' : ' or the food program?'))); break; }
$att = ($p['attach'] === 'yes' && $file) ? $file['name'] : '';
$sub = trim(mb_substr(strip_tags((string)$p['subject']), 0, 120)); $bod = trim(mb_substr(strip_tags((string)$p['body']), 0, 3000));
if ($sub === '' || $bod === ''){ $ask('What should the email say?'); break; }
$out += ['to' => (string)$p['to'], 'to_label' => $label, 'to_addr' => $addr, 'subject' => $sub, 'body' => $bod, 'attach' => $att];
$out['say'] = 'Send this email to '.$label.($att ? ' with "'.$att.'" attached' : '').'?';
break;
case 'compose':
$to = trim((string)($p['email_to'] ?? ''));
if (!filter_var($to, FILTER_VALIDATE_EMAIL) || stripos($words, $to) === false){ $ask('What email address should I put in the To box? Type it out and I will get it ready.'); break; }
$lk = in_array($p['link_kind'], ['staff','existing','enroll'], true) ? $p['link_kind'] : 'staff';
$sk = ($school === 'Sanford') ? 'sanford' : 'deland'; $sch = ($school === 'Sanford') ? 'Kid City USA Sanford' : 'Kid City USA DeLand 2';
$link = 'https://thepreschoolprofessional.net/hive/'.($lk === 'enroll' ? 'welcome.html' : 'onboard.html').'?school='.$sk.($lk === 'existing' ? '&existing=1' : '');
if ($lk === 'existing'){ $csub = 'Please sign your '.$sch.' employee packet'; $cbod = "Hello!\n\nWe are putting everyone's employee packet online so we do not have to copy stacks of paper. Please use this link, check your information, and sign one time. Your signature goes on the whole packet, and then I will confirm your hire date and sign my part.\n\n".$link."\n\nThank you!\n".$sch; }
elseif ($lk === 'enroll'){ $csub = 'Welcome to '.$sch.' - your enrollment packet'; $cbod = "Hello!\n\nThank you for choosing ".$sch.". Please use this link to fill out and sign your enrollment packet right on your phone or computer:\n\n".$link."\n\nIf you have any questions, just reply to this email or call us.\n\nThank you!\n".$sch; }
else { $csub = 'Welcome to the '.$sch.' team - your new-hire packet'; $cbod = "Hello!\n\nWe are so happy you are joining ".$sch.". Please use this link to sign up, follow your training checklist, and fill out and sign your Employee Packet:\n\n".$link."\n\nIf you have any questions, just reply to this email or call us.\n\nThank you!\n".$sch; }
$out += ['to_email' => $to, 'subject' => $csub, 'body' => $cbod, 'link' => $link];
$out['say'] = 'Here is the '.($lk === 'enroll' ? 'family enrollment' : ($lk === 'existing' ? 'current-staff' : 'new-staff')).' email for '.$to.'. Tap the button and Gmail opens with it ready; you press Send there.';
break;
case 'portal':
$a = json_decode((string)$p['args_json'], true);
if (!is_array($a)) $a = [];
if ((string)$p['op'] === 'api_create_email_automation_requests'){   // the portal card fills these itself, so the director never has to
 $em = trim((string)($a['fields.Parent Emails'] ?? '')); $first = preg_split('/[\s,;]+/', $em, -1, PREG_SPLIT_NO_EMPTY); $cnt = count($first);
 if (empty($a['fields.Requested By'])) $a['fields.Requested By'] = 'Director, Kid City USA '.$school.' (Talk to Bear Line)';
 if (empty($a['fields.Requested At'])) $a['fields.Requested At'] = gmdate('c');
 if (empty($a['fields.Request']) && $cnt && !empty($a['fields.Template'])) $a['fields.Request'] = $a['fields.Template'].' → '.$first[0].($cnt > 1 ? ' +'.($cnt - 1).' more' : '');
}
list($body, $vals, $err) = cat_args((string)$p['op'], $a, 'write');
if ($err === 'missing'){   // say exactly what is missing and which card it is, with the choices
 $ce = catalogue()[$p['op']] ?? []; $parts = [];
 foreach ($vals as $k){ $d = $ce['params'][$k] ?? []; $lbl = nice_key($k); $parts[] = $lbl.(!empty($d['enum']) ? ' (pick one: '.implode(', ', $d['enum']).')' : (!empty($d['desc']) ? ' ('.$d['desc'].')' : '')); }
 $bits = []; foreach ($vals as $k){ $d = $ce['params'][$k] ?? []; $bits[] = nice_key($k).' '.(!empty($d['enum']) ? $d['enum'][0] : (stripos($k, 'email') !== false ? 'mom@example.com' : (stripos($k, 'date') !== false ? 'tomorrow' : 'the details'))); }
 $ex = 'Do the '.($ce['card'] ?? 'portal').' card: '.implode(', ', $bits);
 $out = ['kind' => 'clarify', 'say' => 'This is the '.($ce['card'] ?? 'portal').' card. To finish it I still need: '.implode('; ', $parts).'. Tell me those and I will set it up for your Yes. Example: "'.$ex.'"', 'card' => ($ce['card'] ?? '')]; break; }
if ($err){ $ask('I couldn\'t line that up with the portal card ('.$err.'). Try telling me the name, the date and what to do, like: "sign Ana out today at 2 PM".'); break; }
$e = catalogue()[$p['op']]; $det = [];
foreach ($vals as $k => $v){ if (preg_match('/(^id$|Id$|_id$|^recordId$|^records?$)/', $k)) continue; $det[nice_key($k)] = is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : (is_bool($v) ? ($v ? 'Yes' : 'No') : (string)$v); }
$needSig = false; foreach ((array)($e['params'] ?? []) as $d) if (($d['type'] ?? '') === 'signature') $needSig = true;
$out += ['op' => $p['op'], 'args' => $vals, 'sign' => $needSig, 'card' => $e['card'] ?? '', 'details' => $det, 'effect' => ($e['outside_effect'] ?? 'none') !== 'none' ? $e['outside_effect'] : ''];
$out['say'] = trim((string)$p['say']) ?: ($e['what'] ?? 'Make this change').'?';
break;
case 'answer': $out['say'] = trim((string)$p['say']) ?: 'I couldn\'t find that.'; break;
case 'parent_note':
$names = []; foreach ((array)$p['children'] as $c){ $m = pick_name($c, array_keys($ctx['kids'])); if ($m) $names[$m] = 1; }
if (count($names) !== 1){ $ask(count($names) > 1 ? 'A note goes to one child\'s family at a time. Which child first?' : 'Which child is the note for? I couldn\'t match that name on the '.$school.' children list.'); break; }
$kid = array_keys($names)[0]; $nop = (string)$p['notice_op'];
if ($nop === 'file'){
$ns = notes_to_file($school, $kid);
if ($ns === null){ $ask('I can\'t read the notes '.$kid.'\'s parent already saw yet. Nothing was changed.'); break; }
if (!$ns){ $out = ['kind' => 'answer', 'say' => 'There are no read notes for '.$kid.' waiting to be filed. Notes move there 60 days after the parent taps OK.']; break; }
$out += ['notice_op' => 'file', 'child' => $kid, 'count' => count($ns), 'preview' => "Goes in: $kid's Student File, as one PDF under Teacher notes and observations\n".implode("\n", array_map('note_record_line', $ns))];
$out['say'] = 'File '.count($ns).' read '.(count($ns) === 1 ? 'note' : 'notes').' in '.$kid.'\'s Student File?'; break;
}
if ($nop === 'list' || $nop === 'remove'){
$ns = bl_child_notes($school, $kid);
if ($ns === null){ $ask('I can leave new notes for a family, but I can\'t see the notes already waiting yet. Nothing was changed.'); break; }
if ($nop === 'list'){ $out = ['kind' => 'answer', 'say' => $ns ? 'Waiting for '.$kid.'\'s parent: '.implode('; ', array_map('notice_line', $ns)).'.' : 'Nothing is waiting for '.$kid.'\'s parent.']; break; }
$old = pick_notice($p['notice_match'] ?: $p['body'], $ns);
if (!$old){ $ask($ns ? 'Which note do you mean? '.$kid.' has: '.implode('; ', array_map('notice_line', $ns)).'.' : 'Nothing is waiting for '.$kid.'\'s parent.'); break; }
$out += ['notice_op' => 'remove', 'notice_id' => (string)($old['id'] ?? ''), 'child' => $kid, 'preview' => 'Taking down: '.notice_line($old)];
$out['say'] = 'Take this note down so '.$kid.'\'s parent won\'t see it?'; break;
}
$en = trim(mb_substr(strip_tags((string)$p['body']), 0, 300));
if ($en === ''){ $ask('What should the note to '.$kid.'\'s parent say?'); break; }
$es = trim(mb_substr(strip_tags((string)$p['es']), 0, 300)) ?: $en;
$ty = $p['note_type'] === 'observation' ? 'observation' : 'note';
$fr = ymd_ok($p['from']) ? $p['from'] : $now->format('Y-m-d');
$to = ymd_ok($p['to_date']) ? $p['to_date'] : '';
if ($to !== '' && ($to < $fr || $to < $now->format('Y-m-d'))){ $ask('That last day doesn\'t work. Which days should the note show?'); break; }
$out += ['notice_op' => 'add', 'child' => $kid, 'en' => $en, 'es' => $es, 'note_type' => $ty, 'from' => $fr, 'to_date' => $to];
$out['preview'] = "For: $kid's parent only\nKind: ".($ty === 'observation' ? 'Observation (how '.explode(' ', $kid)[0].' did; also kept for the child\'s file)' : 'Note (a reminder or message)')
."\nThe parent sees it: as a pop-up on the Bear Line tablet right after they enter their PIN, until they tap OK\nEnglish: $en\nSpanish: $es\nDays: ".day_span($fr, $to, 'until the parent taps OK');
$out['say'] = 'Leave this '.($ty === 'observation' ? 'observation' : 'note').' for '.$kid.'\'s parent? They\'ll see it right after they enter their PIN on the tablet.';
break;
case 'tablet_event':
$nop = (string)$p['notice_op']; $old = null;
if ($nop === 'update' || $nop === 'remove'){
list($okE, $jE) = bl_post($school, ['action' => 'hive_events']);
$ev = ($okE && isset($jE['events']) && is_array($jE['events'])) ? $jE['events'] : null;
if ($ev === null){ $ask('I can\'t change front tablet events from here yet. That part is still being built on the tablet.'); break; }
$old = pick_notice($p['notice_match'] ?: $p['body'], $ev);
if (!$old){ $ask($ev ? 'Which event do you mean? The front tablet shows: '.implode('; ', array_map(function($x){ return ($x['en'] ?? '').' ('.(!empty($x['date']) ? nice_day($x['date']) : '').')'; }, $ev)).'.' : 'There are no events on the '.$school.' front tablet right now.'); break; }
if ($nop === 'remove'){ $out += ['notice_op' => 'remove', 'notice_id' => (string)($old['id'] ?? ''), 'preview' => 'Taking down: '.($old['en'] ?? '').(!empty($old['date']) ? ' ('.nice_day($old['date']).')' : '')]; $out['say'] = 'Take this event off the '.$school.' front tablet?'; break; }
}
$en = trim(mb_substr(strip_tags((string)$p['body']), 0, 120)) ?: (string)($old['en'] ?? '');
if ($en === ''){ $ask('What\'s the event called?'); break; }
$es = trim(mb_substr(strip_tags((string)$p['es']), 0, 120)) ?: (string)($old['es'] ?? $en);
$dd = ymd_ok($p['from']) ? $p['from'] : (string)($old['date'] ?? '');
if (!ymd_ok($dd)){ $ask('What day is '.$en.'?'); break; }
if ($dd < $now->format('Y-m-d')){ $ask('That day has passed. Which day is '.$en.'?'); break; }
$un = ymd_ok($p['to_date']) && $p['to_date'] > $dd ? $p['to_date'] : '';
$tm = hm_ok($p['time']) ? $p['time'] : (string)($old['time'] ?? '');
$out += ['notice_op' => $old ? 'update' : 'add', 'notice_id' => $old ? (string)($old['id'] ?? '') : '', 'en' => $en, 'es' => $es, 'from' => $dd, 'to_date' => $un, 'time' => $tm];
$out['preview'] = "Event: $en\nSpanish: $es\nDay: ".nice_day($dd).($un ? ' to '.nice_day($un) : '').($tm ? "\nTime: ".hm12($tm) : '');
$out['say'] = ($old ? 'Change this event' : 'Put this event').' on the '.$school.' front tablet?';
break;
case 'tablet':
$nop = (string)$p['notice_op'];
if ($nop === 'list'){
$ns = bl_notices($school);
if ($ns === null){ $out = ['kind' => 'answer', 'say' => 'I can\'t read the front tablet\'s notices from here yet. I can put up a new one.']; break; }
$out = ['kind' => 'answer', 'say' => $ns ? 'The '.$school.' front tablet shows: '.implode('; ', array_map('notice_line', $ns)).'.' : 'There are no notices on the '.$school.' front tablet right now.']; break;
}
$old = null;
if ($nop === 'update' || $nop === 'remove'){
$ns = bl_notices($school);
if ($ns === null){ $ask('I can put up new notices on the front tablet, but I can\'t see the ones already there yet, so I can\'t change or take one down from here. Use the Notices page for that one.'); break; }
$old = pick_notice($p['notice_match'] ?: $p['body'], $ns);
if (!$old){ $ask($ns ? 'Which notice do you mean? The front tablet shows: '.implode('; ', array_map('notice_line', $ns)).'.' : 'There are no notices on the '.$school.' front tablet right now.'); break; }
}
if ($nop === 'remove'){
$out += ['notice_op' => 'remove', 'notice_id' => (string)($old['id'] ?? ''), 'preview' => 'Taking down: '.notice_line($old)];
$out['say'] = 'Take this notice off the '.$school.' front tablet?'; break;
}
$en = trim(mb_substr(strip_tags((string)$p['body']), 0, 300));
if ($en === '' && $old) $en = (string)($old['en'] ?? '');
if ($en === ''){ $ask('What should the notice on the front tablet say?'); break; }
$es = trim(mb_substr(strip_tags((string)$p['es']), 0, 300)) ?: ($old && trim($p['body']) === '' ? (string)($old['es'] ?? $en) : $en);
$ti = trim(mb_substr(strip_tags((string)$p['title']), 0, 60)) ?: ($old['title'] ?? 'Family Corner');
$fr = ymd_ok($p['from']) ? $p['from'] : ($old['from'] ?? $now->format('Y-m-d'));
$to = ymd_ok($p['to_date']) ? $p['to_date'] : ($old['to'] ?? '');
if ($to !== '' && $to < $fr){ $ask('The last day comes before the first day. Which days should it show?'); break; }
if ($to !== '' && $to < $now->format('Y-m-d')){ $ask('That end date has already passed. Which days should it show?'); break; }
$out += ['notice_op' => $old ? 'update' : 'add', 'notice_id' => $old ? (string)($old['id'] ?? '') : '', 'en' => $en, 'es' => $es, 'title' => $ti, 'from' => $fr, 'to_date' => $to];
$out['preview'] = "Title: $ti\nEnglish: $en\nSpanish: $es\nShows: ".day_span($fr, $to);
$out['say'] = $old ? 'Change this notice on the '.$school.' front tablet?' : 'Put this notice on the '.$school.' front tablet?';
break;
}
$plans[] = $out;
}
if (!$plans) fail('I didn\'t catch that. Try saying it another way.', 502);
echo json_encode(['plans' => $plans, 'live' => TALK_LIVE]); exit;
}

/* ---------- DO: the director tapped Yes (or No) ---------- */
if ($action === 'do'){
$p = (array)($input['plan'] ?? []);
$words = trim(mb_substr((string)($input['words'] ?? ''), 0, 400));
$kind = (string)($p['kind'] ?? '');
$base = ['school' => $school, 'role' => $role, 'words' => $words, 'kind' => $kind];
if (!empty($input['declined'])){ log_line($base + ['result' => 'Declined']); echo json_encode(['ok' => true]); exit; }
$ctx = school_context($school);
/* Files: the page itself saves through files-api.php / reporting-api.php (the same calls the Staff Files,
   Student Files and Audit Vault cards make) and only when live. Here we check it and keep the log. */
if ($kind === 'file_to_person' || $kind === 'file_to_vault'){
if ($kind === 'file_to_person'){ $docs = doc_types(); $pk = (string)($p['person_kind'] ?? ''); $who = (string)($p['person'] ?? ''); $doc = (string)($p['doc'] ?? '');
$okp = $pk === 'staff' ? in_array($who, $ctx['staff'], true) : ($pk === 'student' && isset($ctx['kids'][$who]));
if (!$okp || !isset($docs[$pk][$doc])) fail('That doesn\'t check out. Nothing was filed.');
$what = '"'.mb_substr((string)($p['file_name'] ?? ''), 0, 80).'" filed in '.$who.'\'s '.($pk === 'staff' ? 'Staff File' : 'Student File').' under '.$docs[$pk][$doc]; }
else { $mo = (string)($p['month'] ?? ''); $sec = (string)($p['section'] ?? '');
if (!preg_match('/^20\d\d-(0[1-9]|1[0-2])$/', $mo) || !isset($VAULT[$sec])) fail('That doesn\'t check out. Nothing was filed.');
$what = '"'.mb_substr((string)($p['file_name'] ?? ''), 0, 80).'" filed in the Audit Vault, '.$mo.', '.$VAULT[$sec]; }
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing was filed. Live, this would be: '.$what.'.']); exit; }
if (empty($input['done'])){ echo json_encode(['ok' => true, 'go' => true]); exit; }   // the page saves it, then calls back with done
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}
if ($kind === 'email'){
list($addr, $label) = recipient((string)($p['to'] ?? ''), $school);   // the address always comes from the server's own list
$sub = trim(mb_substr(strip_tags((string)($p['subject'] ?? '')), 0, 120)); $bod = trim(mb_substr(strip_tags((string)($p['body'] ?? '')), 0, 3000));
if (!$addr || $sub === '' || $bod === '') fail('That email doesn\'t check out. Nothing was sent.');
$raw = null; $fn = '';
if (!empty($p['attach'])){
$raw = base64_decode((string)($input['b64'] ?? ''), true);
if ($raw === false || strlen($raw) < 100 || strlen($raw) > 10 * 1024 * 1024) fail('The attached file didn\'t come through. Nothing was sent.');
if (substr($raw, 0, 4) === '%PDF') $ext = 'pdf'; elseif (substr($raw, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg'; elseif (substr($raw, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png'; else fail('Only photos and PDFs can be attached. Nothing was sent.');
$fn = preg_replace('/[^A-Za-z0-9 ._()-]/', '', preg_replace('/\.[A-Za-z0-9]+$/', '', (string)$p['attach'])) ?: 'attachment'; $fn .= '.'.$ext;
}
$what = 'Email to '.$label.': "'.$sub.'"'.($fn ? ' with '.$fn.' attached' : '');
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing was sent. Live, this would send the '.$what.'.']); exit; }
$sn = 'Kid City USA '.$school; $bd = 'b'.md5(uniqid('', true));
$hdr = "From: ".$sn." <noreply@thepreschoolprofessional.net>\r\nReply-To: ".$OFFICE[$school]."\r\nMIME-Version: 1.0\r\n";
$txt = str_replace(["\r\n", "\r"], "\n", $bod); $txt = str_replace("\n", "\r\n", $txt)."\r\n";
if ($raw !== null){
$ct = $ext === 'pdf' ? 'application/pdf' : ($ext === 'png' ? 'image/png' : 'image/jpeg');
$hdr .= "Content-Type: multipart/mixed; boundary=\"$bd\"";
$body = "--$bd\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n".$txt."\r\n--$bd\r\nContent-Type: $ct; name=\"$fn\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$fn\"\r\n\r\n".chunk_split(base64_encode($raw))."\r\n--$bd--";
} else { $hdr .= "Content-Type: text/plain; charset=UTF-8"; $body = $txt; }
if (!function_exists('mail') || !@mail($addr, '=?UTF-8?B?'.base64_encode($sub).'?=', $body, $hdr)){ log_line($base + ['details' => $what, 'result' => 'Failed']); fail('The email didn\'t send. Nothing went out.', 502); }
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Sent. '.$what.'.']); exit;
}
if ($kind === 'portal'){
$op = (string)($p['op'] ?? '');
list($body, $vals, $err) = cat_args($op, (array)($p['args'] ?? []), 'write');   // checked again: the card's own rules, not the page's copy
if ($err) fail('That change doesn\'t check out ('.$err.'). Nothing changed.');
$e = catalogue()[$op];
foreach ((array)($e['params'] ?? []) as $k => $d){ if (($d['type'] ?? '') !== 'signature') continue;
$sg = (string)($input['sig'] ?? ''); $png = strpos($sg, 'data:image/png;base64,') === 0 && strlen($sg) < 120000 ? base64_decode(substr($sg, 22), true) : false;
if ($png === false || substr($png, 0, 8) !== "\x89PNG\r\n\x1a\n") fail('Please sign on the screen first. Nothing changed.');
$body[$k] = $sg; }
$what = ($e['card'] ?? 'Portal').': '.mb_substr(trim((string)($p['say'] ?? '')) ?: ($e['what'] ?? $op), 0, 300).' ['.$op.' '.mb_substr(json_encode($vals, JSON_UNESCAPED_UNICODE), 0, 600).']';
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would be done on the '.($e['card'] ?? 'portal').' card, logged as the '.$school.' director.']); exit; }
$got = portal_call($op, $body, $pin);
if (!empty($got['error'])){ log_line($base + ['details' => $what, 'result' => 'Failed: '.mb_substr((string)$got['error'], 0, 200)]); fail('The '.($e['card'] ?? 'portal').' card said: '.mb_substr((string)$got['error'], 0, 200).' Nothing changed.', 502); }
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done on the '.($e['card'] ?? 'portal').' card.']); exit;
}
if ($kind === 'rooms_board'){ log_line($base + ['details' => mb_substr((string)($input['details'] ?? ''), 0, 300), 'result' => TALK_LIVE ? 'Done' : 'Practice']); echo json_encode(['ok' => true]); exit; }
if (!in_array($kind, ['room_sign_in','room_sign_out','staff_time_fix','inventory_count','tablet','tablet_event','parent_note'])) fail('Nothing to change.');
$ctx = school_context($school);
$now = now_et(); $today = $now->format('Y-m-d');

/* Re-validate from scratch: the page could have been changed by anyone. */
if ($kind === 'room_sign_in' || $kind === 'room_sign_out'){
$names = []; foreach ((array)($p['children'] ?? []) as $c){ if (isset($ctx['kids'][$c])) $names[] = $c; }
$t = (string)($p['time'] ?? '');
if (!$names || !hm_ok($t)) fail('Those children or that time don\'t check out. Nothing was changed.');
$sq = str_replace("'", "\\'", $school);
$rows = []; foreach (at_all('Room Attendance', "AND({School}='$sq',IS_SAME({Date},'$today','day'))") as $r){ $rows[$r['fields']['Child'] ?? ''] = $r; }
$creates = []; $updates = []; $done = []; $skipped = [];
foreach ($names as $n){
$a = $rows[$n]['fields'] ?? []; $arr = $a['Arrival'] ?? ''; $dep = $a['Departure'] ?? '';
if ($kind === 'room_sign_in'){
if ($arr && $dep){ $f = ($t < $dep) ? ['Arrival' => $t] : ['Departure' => '']; }   // same rules as the Rooms board
else $f = $arr ? ['Arrival' => $t] : ['Arrival' => $t, 'Departure' => ''];
$f['Arrival By'] = 'Director (Talk to Bear Line)';
} else {
if (!$arr){ $skipped[] = $n.' (not signed in yet)'; continue; }
if ($t < $arr){ $skipped[] = $n.' (that\'s before they arrived)'; continue; }
$f = ['Departure' => $t, 'Departure By' => 'Director (Talk to Bear Line)'];
}
if (isset($rows[$n])) $updates[] = ['id' => $rows[$n]['id'], 'fields' => $f];
else $creates[] = array_merge(['Key' => $school.'|'.$today.'|'.$n, 'Date' => $today, 'Child' => $n, 'Home Room' => $ctx['kids'][$n], 'School' => $school], $f);
$done[] = $n;
}
$what = ($kind === 'room_sign_in' ? 'Signed in ' : 'Signed out ').implode(', ', $done).' at '.hm12($t).($skipped ? '. Skipped: '.implode(', ', $skipped) : '');
if (!$done){ log_line($base + ['details' => $what, 'result' => 'Nothing to do']); echo json_encode(['ok' => true, 'say' => 'Nothing changed. Skipped: '.implode(', ', $skipped).'.']); exit; }
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would be: '.$what.'.']); exit; }
foreach (array_chunk($creates, 10) as $ch){ $r = at_request('POST', ['Room Attendance'], null, ['records' => array_map(function($f){ return ['fields' => $f]; }, $ch), 'typecast' => true]); if (empty($r['records'])) { log_line($base + ['details' => $what, 'result' => 'Failed']); fail('The Rooms board didn\'t save. Nothing else was changed.', 502); } }
foreach (array_chunk($updates, 10) as $ch){ $r = at_request('PATCH', ['Room Attendance'], null, ['records' => $ch, 'typecast' => true]); if (empty($r['records'])) { log_line($base + ['details' => $what, 'result' => 'Failed']); fail('The Rooms board didn\'t save. Nothing else was changed.', 502); } }
/* The same sign-in or sign-out on the Bear Line tablet record (each school's monthly units file), through hive_child_sign. */
$tab = []; $tabErr = '';
foreach ($done as $n){ list($ok, $j, $e) = bl_post($school, ['action' => 'hive_child_sign', 'child' => $n, 'date' => $today, 'type' => $kind === 'room_sign_in' ? 'in' : 'out', 'at' => $t, 'by' => 'Director '.$school.' (Talk to Bear Line)', 'note' => 'Entered by the director with Talk to Bear Line']);
if ($ok) $tab[] = $n; else { $tabErr = $e; if (in_array($e, ['not_connected','bad_action','no_answer','denied'], true) || $e === '' || stripos($e, 'unknown') === 0 && $e !== 'unknown_child') break; } }
$tabSay = count($tab) === count($done) ? ' Also on the Bear Line tablet record.' : ($tab ? ' On the tablet record only for '.implode(', ', $tab).'; the rest still need it there.' : ' The Bear Line tablet record isn\'t connected from here yet, so it was changed on the Rooms board only.');
log_line($base + ['details' => $what.'. Tablet: '.($tab ? implode(', ', $tab) : 'none'.($tabErr ? ' ('.$tabErr.')' : '')), 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.'.$tabSay]); exit;
}

if ($kind === 'staff_time_fix'){
/* Changes the punch on the Bear Line time clock itself (the same place the tablet and the director's
   Staff Sign In/Out page write), so Staff Hours, the timesheet and payroll all read the new time.
   Bear Line's hive_fix_punch: staff, date, type (in, out, lunchOut, lunchIn), at (HH:MM), by, note; it writes the staff audit. */
$s = (string)($p['staff'] ?? ''); $d = (string)($p['date'] ?? '');
$fx = []; foreach (['in' => 'time_in', 'lunchOut' => 'lunch_out', 'lunchIn' => 'lunch_in', 'out' => 'time_out'] as $ty => $k){ if (hm_ok($p[$k] ?? '')) $fx[$ty] = $p[$k]; }
$seq = array_values($fx); $sorted = $seq; sort($sorted);
if (!in_array($s, $ctx['staff'], true) || !ymd_ok($d) || $d > $today || !$fx) fail('That time fix doesn\'t check out. Nothing was changed.');
if ($seq !== $sorted) fail('Those times are out of order. Nothing was changed.');
$what = $s.' on '.nice_day($d).': '.implode(', ', array_map(function($ty, $t){ return punch_word($ty).' '.hm12($t); }, array_keys($fx), $fx));
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would set '.$what.' on the Bear Line time clock right away, logged as the '.$school.' director.']); exit; }
$done = [];
foreach ($fx as $type => $at){
list($ok, $j, $e) = bl_post($school, ['action' => 'hive_fix_punch', 'staff' => $s, 'date' => $d, 'type' => $type, 'at' => $at, 'by' => 'Director '.$school.' (Talk to Bear Line)', 'note' => mb_substr((string)($p['reason'] ?? ''), 0, 200)]);
if (!$ok){
log_line($base + ['details' => $what, 'result' => 'Failed '.$e.($done ? ' after '.implode(', ', $done) : '')]);
$msg = ['not_connected' => 'Bear Line isn\'t connected from here yet.', 'unknown_staff' => 'Bear Line doesn\'t have a staff member named '.$s.'.', 'ambiguous_staff' => 'Bear Line has more than one '.$s.'.',
'out_before_in' => 'Bear Line says the clock-out would be before the clock-in.', 'bad_time' => 'Bear Line didn\'t accept that day or time.', 'denied' => 'Bear Line turned the request away.'][$e] ?? ('Bear Line didn\'t take the change'.($e ? ' ('.$e.')' : '').'.');
fail($msg.($done ? ' Already changed: '.implode(', ', $done).'. Check Staff Sign In/Out.' : ' Nothing was changed.'), 502);
}
$done[] = punch_word($type).' '.hm12($at);
}
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'. Staff Hours shows it on its next refresh.']); exit;
}

if ($kind === 'parent_note'){
/* A note or observation on one child that pops up for that child's parent after their tablet PIN (Bear Line's hive_child_note). */
$nop = (string)($p['notice_op'] ?? ''); $kid = (string)($p['child'] ?? '');
if (!isset($ctx['kids'][$kid]) || !in_array($nop, ['add','remove','file'], true)) fail('That note doesn\'t check out. Nothing was changed.');
if ($nop === 'file'){
$ns = notes_to_file($school, $kid);
if (!$ns) fail('There are no read notes for '.$kid.' to file. Nothing was changed.');
$what = count($ns).' read '.(count($ns) === 1 ? 'note' : 'notes').' filed in '.$kid.'\'s Student File';
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing was filed. Live, this would be: '.$what.'.']); exit; }
$pdf = simple_pdf('Kid City USA '.$school.' - Notes and observations for '.$kid.' (printed '.now_et()->format('M j, Y').')', array_merge(array_map('note_record_line', $ns), ['', 'Shown to the parent on the Bear Line tablet; each line says when they tapped OK.']));
$r = post_json('files-api.php', ['pin' => $pin, 'action' => 'roster', 'kind' => 'student']);
$hit = array_values(array_filter((array)($r['people'] ?? []), function($x) use ($kid){ return ($x['name'] ?? '') === $kid; }));
if (count($hit) !== 1){ log_line($base + ['details' => $what, 'result' => 'Failed: no Student File']); fail('I couldn\'t find '.$kid.'\'s Student File. Nothing was filed.', 502); }
$u = post_json('files-api.php', ['pin' => $pin, 'action' => 'upload', 'kind' => 'student', 'id' => $hit[0]['id'], 'doc' => 'obs', 'name' => 'Notes and observations '.now_et()->format('Y-m-d'), 'b64' => base64_encode($pdf)]);
if (!empty($u['error'])){ log_line($base + ['details' => $what, 'result' => 'Failed: '.mb_substr((string)$u['error'], 0, 150)]); fail('The Student File said: '.mb_substr((string)$u['error'], 0, 150).' Nothing was filed.', 502); }
$fd = json_decode((string)@file_get_contents(filed_notes_file($school)), true) ?: [];
foreach ($ns as $n) if (!empty($n['id'])) $fd[(string)$n['id']] = now_et()->format('Y-m-d');
@file_put_contents(filed_notes_file($school), json_encode($fd), LOCK_EX);
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}
$send = ['action' => 'hive_child_note', 'op' => $nop, 'child' => $kid, 'by' => 'Director '.$school.' (Talk to Bear Line)'];
if ($nop === 'remove'){
$nid = (string)($p['notice_id'] ?? ''); if (!preg_match('/^[A-Za-z0-9_\-]{1,40}$/', $nid)) fail('That note doesn\'t check out. Nothing was changed.');
$send['id'] = $nid; $what = 'Note for '.$kid.'\'s parent taken down ('.$nid.')';
} else {
$en = trim(mb_substr(strip_tags((string)($p['en'] ?? '')), 0, 300)); $es = trim(mb_substr(strip_tags((string)($p['es'] ?? '')), 0, 300)) ?: $en;
$ty = (string)($p['note_type'] ?? ''); $fr = (string)($p['from'] ?? ''); $to = (string)($p['to_date'] ?? '');
if ($en === '' || !in_array($ty, ['note','observation'], true) || !ymd_ok($fr) || ($to !== '' && (!ymd_ok($to) || $to < $fr || $to < $today))) fail('That note doesn\'t check out. Nothing was changed.');
$send += ['en' => $en, 'es' => $es, 'type' => $ty, 'from' => $fr]; if ($to !== '') $send['until'] = $to;
$what = ($ty === 'observation' ? 'Observation' : 'Note').' for '.$kid.'\'s parent, shown after their tablet PIN: "'.$en.'"';
}
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed and no parent sees anything. Live, this would be: '.$what.'.']); exit; }
list($ok, $j, $e) = bl_post($school, $send);
if (!$ok){ log_line($base + ['details' => $what, 'result' => 'Failed '.$e]);
$m = (array)($j['matches'] ?? $j['names'] ?? $j['children'] ?? []);
fail((['not_connected' => 'Bear Line isn\'t connected from here yet.', 'unknown_child' => 'The tablet doesn\'t have a child named '.$kid.'.', 'ambiguous_child' => 'The tablet has more than one '.$kid.($m ? ' ('.implode(', ', array_map('strval', array_slice($m, 0, 6))).')' : '').'.', 'unknown_note' => 'That note isn\'t there anymore.'][$e] ?? ('The tablet didn\'t take it'.($e ? ' ('.$e.')' : '').'.')).' Nothing was changed.', 502); }
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}

if ($kind === 'tablet_event'){
/* Events on the front tablet screen, through hive_event (desktop Prompt 4). */
$nop = (string)($p['notice_op'] ?? ''); $nid = (string)($p['notice_id'] ?? '');
if (!in_array($nop, ['add','update','remove'], true) || ($nop !== 'add' && !preg_match('/^[A-Za-z0-9_\-]{1,40}$/', $nid))) fail('That event doesn\'t check out. Nothing was changed.');
$send = ['action' => 'hive_event', 'op' => $nop, 'by' => 'Director '.$school.' (Talk to Bear Line)']; if ($nop !== 'add') $send['id'] = $nid;
if ($nop === 'remove') $what = 'Front tablet event taken down ('.$nid.')';
else {
$en = trim(mb_substr(strip_tags((string)($p['en'] ?? '')), 0, 120)); $es = trim(mb_substr(strip_tags((string)($p['es'] ?? '')), 0, 120)) ?: $en;
$dd = (string)($p['from'] ?? ''); $un = (string)($p['to_date'] ?? ''); $tm = (string)($p['time'] ?? '');
if ($en === '' || !ymd_ok($dd) || $dd < $today || ($un !== '' && (!ymd_ok($un) || $un < $dd)) || ($tm !== '' && !hm_ok($tm))) fail('That event doesn\'t check out. Nothing was changed.');
$send += ['en' => $en, 'es' => $es, 'date' => $dd]; if ($un !== '') $send['until'] = $un; if ($tm !== '') $send['time'] = $tm;
$what = 'Front tablet event '.($nop === 'add' ? 'put up' : 'changed').': '.$en.', '.nice_day($dd).($un ? ' to '.nice_day($un) : '').($tm ? ' at '.hm12($tm) : '');
}
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would be: '.$what.'.']); exit; }
list($ok, $j, $e) = bl_post($school, $send);
if (!$ok){ log_line($base + ['details' => $what, 'result' => 'Failed '.$e]); fail(($e === 'not_connected' ? 'Bear Line isn\'t connected from here yet.' : ($e === 'unknown_event' ? 'That event isn\'t on the tablet anymore.' : 'The tablet didn\'t take it'.($e ? ' ('.$e.')' : '').'.')).' Nothing was changed.', 502); }
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}

if ($kind === 'tablet'){
/* Front tablet Family Corner notices, through Bear Line's hive_set_notice (the same list the Notices page edits). */
$nop = (string)($p['notice_op'] ?? ''); $nid = (string)($p['notice_id'] ?? '');
if (!in_array($nop, ['add','update','remove'], true) || ($nop !== 'add' && !preg_match('/^[A-Za-z0-9_\-]{1,40}$/', $nid))) fail('That notice doesn\'t check out. Nothing was changed.');
$send = ['action' => 'hive_set_notice', 'op' => $nop, 'by' => 'Director '.$school.' (Talk to Bear Line)'];
if ($nop !== 'add') $send['id'] = $nid;
if ($nop === 'remove') $what = 'Front tablet notice taken down ('.$nid.')';
else {
$en = trim(mb_substr(strip_tags((string)($p['en'] ?? '')), 0, 300)); $es = trim(mb_substr(strip_tags((string)($p['es'] ?? '')), 0, 300)) ?: $en;
$ti = trim(mb_substr(strip_tags((string)($p['title'] ?? '')), 0, 60)) ?: 'Family Corner';
$fr = (string)($p['from'] ?? ''); $to = (string)($p['to_date'] ?? '');
if ($en === '' || !ymd_ok($fr) || ($to !== '' && (!ymd_ok($to) || $to < $fr || $to < $today))) fail('That notice doesn\'t check out. Nothing was changed.');
$send += ['en' => $en, 'es' => $es, 'title' => $ti, 'from' => $fr]; if ($to !== '') $send['to'] = $to;
$what = ($nop === 'add' ? 'Front tablet notice put up: "' : 'Front tablet notice changed to: "').$en.'" ('.day_span($fr, $to).')';
}
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would be: '.$what.'.']); exit; }
list($ok, $j, $e) = bl_post($school, $send);
if (!$ok){ log_line($base + ['details' => $what, 'result' => 'Failed '.$e]); fail(($e === 'not_connected' ? 'Bear Line isn\'t connected from here yet.' : ($e === 'unknown_notice' ? 'That notice isn\'t on the tablet anymore.' : 'The tablet didn\'t take it'.($e ? ' ('.$e.')' : '').'.')).' Nothing was changed.', 502); }
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}

if ($kind === 'inventory_count'){
$it = (string)($p['item'] ?? ''); $q = $p['qty'] ?? null;
if (!isset($ctx['items'][$it]) || !is_numeric($q) || (int)$q < 0) fail('That count doesn\'t check out. Nothing was changed.');
$what = $it.' set to '.(int)$q.' on hand';
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would be: '.$what.'.']); exit; }
$r = at_request('PATCH', ['Inventory', $ctx['items'][$it]], null, ['fields' => ['On-Hand Qty' => (int)$q, 'Last Updated' => $today], 'typecast' => true]);
if (empty($r['id'])){ log_line($base + ['details' => $what, 'result' => 'Failed']); fail('The count didn\'t save.', 502); }
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}
}

/* ---------- LOG: this school's last 30 Yes/No taps ---------- */
if ($action === 'log'){
$lines = @file(private_dir().'/log-'.now_et()->format('Y-m').'.jsonl', FILE_IGNORE_NEW_LINES) ?: [];
$out = [];
foreach (array_reverse($lines) as $l){ $r = json_decode($l, true); if (($r['school'] ?? '') !== $school || empty($r['result']) || strpos($r['result'], 'Claude error') === 0) continue; $out[] = ['when' => $r['when'], 'words' => $r['words'] ?? '', 'details' => $r['details'] ?? '', 'result' => $r['result']]; if (count($out) >= 30) break; }
echo json_encode(['log' => $out]); exit;
}

fail('Unknown action');
