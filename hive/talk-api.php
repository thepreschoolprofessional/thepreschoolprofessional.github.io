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
define('MODEL', 'claude-haiku-5-5');

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
function nice_day($ymd){ $d = DateTime::createFromFormat('Y-m-d', $ymd, new DateTimeZone('America/New_York')); return $d ? $d->format('l, M j') : $ymd; }

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
foreach (array_slice((array)($input['history'] ?? []), -4) as $h){ $u = trim(mb_substr((string)($h['you'] ?? ''), 0, 300)); $b = trim(mb_substr((string)($h['me'] ?? ''), 0, 300)); if ($u !== '') $hist[] = "Director: $u\nYou: $b"; }

$system = "You are Talk to Bear Line, the voice helper for the director of Kid City USA $school, a preschool. "
."The director says or types a request. It may ask for several things in one sentence (for example \"the toddlers are going to the playground and sign Ms. Ana out at 2\"). Return one action for each thing, in the order they said them, at most 5. You never make changes yourself: the director sees each proposal and taps Yes or No on each one.\n\n"
."Today is ".$now->format('l, Y-m-d')." and the time is ".$now->format('H:i')." (Eastern).\n\n"
."Pick kind:\n"
."- room_sign_in / room_sign_out: sign one or more CHILDREN in or out on the Rooms board for TODAY. children = exact names from the Children list. time = HH:MM 24-hour; use the current time when they say now or give no time.\n"
."- staff_time_fix: fix a STAFF member's clock-in or clock-out time (for example \"sign Ms. Ana out at 2 PM yesterday\"). This changes their punch on the Bear Line time clock right away. staff = exact name from the Staff list. date = YYYY-MM-DD (today if not said). time_in and/or time_out as HH:MM 24-hour; leave the one they didn't mention empty. reason = their reason, or \"Entered by the director with Talk to Bear Line\".\n"
."- inventory_count: set the on-hand count of a supply. item = exact name from the Inventory list. qty = whole number as text.\n"
."- rooms_board: a whole CLASS or ROOM on the Rooms board. board_action = out (the room is leaving for the playground, outside, the playroom or the office; also called a transition), back (the room is coming back inside), move (move children or a whole room into another room), or meal (mark breakfast, lunch or PM snack). room = exact name from the Rooms list. room_to = for out: Playground, Outside, Playroom or Office; for move: the exact room they go to. For meal, item = breakfast, lunch or snack. For move of only some children, children = their exact names.\n"
."- open_card: they want to open, bring up or go to a page, form, card or tool (for example \"bring up the food program forms\"). card = exact name from the Cards list that fits best.\n"
."- question: they ask how, where, when or how many about the Director Portal or the school. question = their question, cleaned up. The director chatbot answers it.\n"
."- tablet: they want something done on the front tablet itself: the greeting message on the tablet, or they say to do it ON the tablet. Talk to Bear Line can't do those yet. When they just say to sign a staff member in or out at a time, use staff_time_fix instead.\n"
."- clarify: you are not sure who or what they mean, a name matches nobody or more than one person, or a needed time is missing for staff. question = one short question back.\n"
."- file_to_person: put the ATTACHED file in a staff member's or child's file. staff = exact staff name OR children = [exact child name]. doc = the key of the best document type from that person's Documents list.\n"
."- file_to_vault: put the ATTACHED file in the Audit Vault in Reporting. month = YYYY-MM (this month unless they say). section = elc, food, dcf or other.\n"
."- email: send an email for the director. to = office (this school's office email, also used when they say \"email it to me\"), food_program (the food program sponsor), or owner (Mrs. Bear). Never write an email address yourself. subject = short subject. body = the email text, written as the director in first person, polite and short, signed \"Kid City USA $school\". attach = yes when the attached file should go with it, otherwise no.\n"
."- cant: anything else, or anything about PINs, passwords, codes, money, or contacting parents or staff.\n\n"
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
'kind' => ['type' => 'string', 'enum' => ['file_to_person','file_to_vault','email','rooms_board','room_sign_in','room_sign_out','staff_time_fix','inventory_count','open_card','question','tablet','clarify','cant']],
'say' => ['type' => 'string'], 'children' => ['type' => 'array', 'items' => ['type' => 'string']],
'time' => ['type' => 'string'], 'staff' => ['type' => 'string'], 'date' => ['type' => 'string'],
'time_in' => ['type' => 'string'], 'time_out' => ['type' => 'string'], 'reason' => ['type' => 'string'],
'item' => ['type' => 'string'], 'qty' => ['type' => 'string'], 'card' => ['type' => 'string'], 'question' => ['type' => 'string'],
'board_action' => ['type' => 'string', 'enum' => ['out','back','move','meal','']], 'room' => ['type' => 'string'], 'room_to' => ['type' => 'string'],
'doc' => ['type' => 'string'], 'month' => ['type' => 'string'], 'section' => ['type' => 'string', 'enum' => ['elc','food','dcf','other','']],
'to' => ['type' => 'string', 'enum' => ['office','food_program','owner','']], 'subject' => ['type' => 'string'], 'body' => ['type' => 'string'], 'attach' => ['type' => 'string', 'enum' => ['yes','no']]],
'required' => ['kind','say','children','time','staff','date','time_in','time_out','reason','item','qty','card','question','board_action','room','room_to','doc','month','section','to','subject','body','attach']];
$schema = ['type' => 'object', 'additionalProperties' => false, 'properties' => ['actions' => ['type' => 'array', 'items' => $one]], 'required' => ['actions']];

$user = ($hist ? "Earlier in this conversation:\n".implode("\n", $hist)."\n\n" : '')."Director's request: ".$words;
$req = ['model' => MODEL, 'max_tokens' => 1500,
'system' => [['type' => 'text', 'text' => $system, 'cache_control' => ['type' => 'ephemeral']]],
'output_config' => ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
'messages' => [['role' => 'user', 'content' => $user]]];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: '.CLAUDE_API_KEY, 'anthropic-version: 2026-10-21'],
CURLOPT_POSTFIELDS => json_encode($req)]);
$raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$res = json_decode($raw ?: '{}', true);
if ($code !== 200){ log_line(['school'=>$school,'role'=>$role,'words'=>$words,'result'=>'Claude error '.$code]); fail('Talk to Bear Line couldn\'t reach Claude just now ('.$code.'). Try again in a minute.', 502); }
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
$out['say'] = ($p['kind'] === 'room_sign_in' ? 'Sign in ' : 'Sign out ').implode(', ', $out['children']).' today at '.hm12($t).'?'; }
break;
case 'staff_time_fix':
$s = pick_name($p['staff'], $ctx['staff']);
$d = preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['date']) ? $p['date'] : $now->format('Y-m-d');
$ti = hm_ok($p['time_in']) ? $p['time_in'] : ''; $to = hm_ok($p['time_out']) ? $p['time_out'] : '';
if (!$s) $ask('Which staff member? I couldn\'t match "'.$p['staff'].'" to one person on the '.$school.' staff list.');
elseif (!$ti && !$to) $ask('What time should '.$s.' be clocked in or out?');
elseif ($d > $now->format('Y-m-d')) $ask('That day hasn\'t happened yet. Which day did you mean?');
else { $out += ['staff' => $s, 'date' => $d, 'time_in' => $ti, 'time_out' => $to, 'reason' => trim($p['reason']) ?: 'Entered by the director with Talk to Bear Line'];
$out['say'] = 'Change '.$s.'\'s time on '.nice_day($d).' to '.implode(' and ', array_filter([$ti ? 'clocked in at '.hm12($ti) : '', $to ? 'clocked out at '.hm12($to) : ''])).' on the Bear Line time clock?'; }
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
if (!$addr){ $ask($p['to'] === 'food_program' ? 'There\'s no food program email saved for '.$school.'. Its claim goes through KidKare. Who should I email instead?' : ($p['to'] === 'owner' ? 'Mrs. Bear\'s email isn\'t saved on the server yet, so I can\'t email her from here. I can send it to the '.$school.' office instead.' : 'Who should this go to: the '.$school.' office, the food program, or Mrs. Bear?')); break; }
$att = ($p['attach'] === 'yes' && $file) ? $file['name'] : '';
$sub = trim(mb_substr(strip_tags((string)$p['subject']), 0, 120)); $bod = trim(mb_substr(strip_tags((string)$p['body']), 0, 3000));
if ($sub === '' || $bod === ''){ $ask('What should the email say?'); break; }
$out += ['to' => (string)$p['to'], 'to_label' => $label, 'to_addr' => $addr, 'subject' => $sub, 'body' => $bod, 'attach' => $att];
$out['say'] = 'Send this email to '.$label.($att ? ' with "'.$att.'" attached' : '').'?';
break;
case 'tablet': $out['say'] = 'Things on the front tablet itself (staff clock in or out, child sign-in on the tablet, the tablet greeting) aren\'t connected to Talk to Bear Line yet. Mrs. Bear is adding them next.'; break;
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
if ($kind === 'rooms_board'){ log_line($base + ['details' => mb_substr((string)($input['details'] ?? ''), 0, 300), 'result' => TALK_LIVE ? 'Done' : 'Practice']); echo json_encode(['ok' => true]); exit; }
if (!in_array($kind, ['room_sign_in','room_sign_out','staff_time_fix','inventory_count'])) fail('Nothing to change.');
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
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'.']); exit;
}

if ($kind === 'staff_time_fix'){
/* Changes the punch on the Bear Line time clock itself (the same place the tablet and the director's
   Staff Sign In/Out page write), so Staff Hours, the timesheet and payroll all read the new time. */
$s = (string)($p['staff'] ?? ''); $d = (string)($p['date'] ?? ''); $ti = (string)($p['time_in'] ?? ''); $to = (string)($p['time_out'] ?? '');
if (!in_array($s, $ctx['staff'], true) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || $d > $today || (!hm_ok($ti) && !hm_ok($to))) fail('That time fix doesn\'t check out. Nothing was changed.');
if (hm_ok($ti) && hm_ok($to) && $to <= $ti) fail('The clock-out has to be after the clock-in. Nothing was changed.');
$fix = []; if (hm_ok($ti)) $fix['in'] = $ti; if (hm_ok($to)) $fix['out'] = $to;
$what = $s.' on '.nice_day($d).': '.implode(', ', array_map(function($k, $v){ return ($k === 'in' ? 'clocked in ' : 'clocked out ').hm12($v); }, array_keys($fix), $fix));
if (!TALK_LIVE){ log_line($base + ['details' => $what, 'result' => 'Practice']); echo json_encode(['ok' => true, 'practice' => true, 'say' => 'Practice mode: nothing changed. Live, this would set '.$what.' on the Bear Line time clock right away, logged as the '.$school.' director.']); exit; }
foreach ([dirname(__DIR__, 2), dirname(__DIR__), __DIR__] as $d0){ if (file_exists($d0.'/elc-sync-code.php')) include_once $d0.'/elc-sync-code.php'; }
if (!defined('ELC_SYNC_CODE')) fail('Bear Line isn\'t connected from here yet. Nothing was changed.', 503);
$bl = ($school === 'Sanford') ? 'https://bearphonicsacademy.com/elc-94f077be04/bearline-api.php' : 'https://bearphonicsacademy.com/elc-1ce53ee46c/bearline-api.php';
foreach ($fix as $type => $at){
$ctx0 = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n", 'timeout' => 25, 'ignore_errors' => true,
'content' => json_encode(['action' => 'hive_fix_punch', 'code' => ELC_SYNC_CODE, 'staff' => $s, 'date' => $d, 'type' => $type, 'at' => $at, 'by' => 'Director '.$school.' (Talk to Bear Line)', 'note' => mb_substr((string)($p['reason'] ?? ''), 0, 200)])]]);
$j = json_decode((string)@file_get_contents($bl, false, $ctx0), true);
if (!is_array($j) || empty($j['ok'])){
$e = is_array($j) ? (string)($j['error'] ?? '') : '';
log_line($base + ['details' => $what, 'result' => 'Failed '.$e]);
$msg = $e === 'unknown_staff' ? 'Bear Line doesn\'t have a staff member named '.$s.'.' : ($e === 'ambiguous_staff' ? 'Bear Line has more than one '.$s.'.' : 'Bear Line didn\'t take the change'.($e ? ' ('.$e.')' : '').'.');
fail($msg.($type === 'out' && isset($fix['in']) ? ' The clock-in may already be changed; check Staff Sign In/Out.' : ' Nothing was changed.'), 502);
}
}
log_line($base + ['details' => $what, 'result' => 'Done']); echo json_encode(['ok' => true, 'say' => 'Done. '.$what.'. Staff Hours shows it on its next refresh.']); exit;
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
