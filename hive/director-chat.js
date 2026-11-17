/* Director Bear Chat: a free question bank for the Director Portal.
   Matches a typed or spoken question to the bank in director-chat-data.js and answers with the steps,
   plus a button that opens the right Director Portal card. Same matching as the parent Bear Chat (bear-chat.js).
   Each director sees answers for their own school only. It never shows a PIN, door code or password:
   PIN questions open the Family and Staff PINs card, where every lookup is the director's own.
   DirectorChat.mount(el, {school, pin, mode}) where mode is 'preview' (nothing is sent) or 'live'.
   Closure dates come from bear-chat-data.js (window.BC_DATA) when that file is loaded too. */
(function(){
var D = window.DC_DATA, P = window.BC_DATA || {}, OPT = {}, ROOT = null, LOG = [], MISSED = [], IDLE = null, HIDDEN_AT = 0, REC = null;
var IDLE_MS = 3*60*1000, AWAY_MS = 60*1000; /* clear after 3 minutes without use, or after 1 minute away from the page */
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
var STOP = ('a an the is are am be been do does did i me my we our you your it its to of in on at for and or can could would will '
  + 'what whats when where who how why there this that these those with have has had get got please hi hello hey just about any '
  + 'if so up as by from was were need want know tell let us im ill dont cant should like wanna gonna gotta some find see go '
  + 'thing things way').split(' ');
var STOPSET = {}; STOP.forEach(function(w){ STOPSET[w]=1; });
var WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

/* ---------- text matching (same as bear-chat.js) ---------- */
function norm(s){
  s = ' ' + String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ') + ' ';
  Object.keys(D.syn).forEach(function(k){ if (k.indexOf(' ')>-1 || k.indexOf('-')>-1){ s = s.split(' '+k+' ').join(' '+D.syn[k]+' '); } });
  return s.trim();
}
function stem(w){ if (w.length>4 && /ies$/.test(w)) return w.slice(0,-3)+'y'; if (w.length>3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0,-1); return w; }
function toks(s){
  return norm(s).split(' ').map(function(w){ return D.syn[w] || w; }).join(' ').split(/[\s-]+/)
    .filter(function(w){ return w && !STOPSET[w]; }).map(stem);
}
var INDEX = [], DF = {}, NQ = 0;
function forSchool(e){ return !e.school || e.school === OPT.school; }
function build(){ DF = {};
  INDEX = D.QS.filter(forSchool).map(function(e){
    var set = {}, kset = {};
    e.q.forEach(function(q){ toks(q).forEach(function(t){ set[t]=1; }); });
    toks(e.k||'').forEach(function(t){ set[t]=1; kset[t]=1; });
    var phr = e.q.map(function(q){ return norm(q); });
    var ptoks = e.q.map(function(q){ var o = {}; toks(q).forEach(function(t){ o[t]=1; }); return o; });
    return {e:e, set:set, kset:kset, phr:phr, ptoks:ptoks};
  });
  INDEX.forEach(function(x){ Object.keys(x.set).forEach(function(t){ DF[t]=(DF[t]||0)+1; }); });
  NQ = INDEX.length;
}
function match(text){
  var n = norm(text), qt = toks(text);
  if (!qt.length){ var ex = INDEX.filter(function(x){ return x.phr.indexOf(n) > -1; }); return ex.length ? [{x:ex[0], s:9, hit:0}] : []; }
  var scores = INDEX.map(function(x){
    var s = 0, hit = 0;
    qt.forEach(function(t){ if (x.set[t]){ hit++; s += Math.log(1 + NQ/(DF[t]||1)) * (x.kset[t] ? 1.25 : 1); } });
    if (x.phr.indexOf(n) > -1) s += 8;
    else if (hit === qt.length && x.ptoks.some(function(pt){ return qt.every(function(t){ return pt[t]; }); })) s += 2;
    s = s * (0.55 + 0.45 * hit/qt.length);
    return {x:x, s:s, hit:hit};
  });
  var hasOpen = /\b(open|closed|close|shut|school|off|closure)\b/.test(n), day = dayIn(n), hol = holidayIn(n);
  scores.forEach(function(r){
    var id = r.x.e.id;
    if (hasOpen && (day || hol) && id==='open-date' && !/\b(flyer|flyers|print|pdf|picture)\b/.test(n)) r.s += 6;
  });
  scores.sort(function(a,b){ return b.s - a.s; });
  return scores.filter(function(r){ return r.s > 0; }).slice(0, 4);
}
function confident(m){ if (!m.length) return false; var a = m[0].s, b = m.length > 1 ? m[1].s : 0; if (a >= 7 || (a >= 1.5 && a >= b * 1.3)) return true;
  var g = m[0].x.e.go; return a >= 3 && !!g && m.filter(function(r){ return r.s >= a * 0.77; }).every(function(r){ return r.x.e.go === g; }); }

/* ---------- closures, in Florida time (calendar from bear-chat-data.js) ---------- */
function todayParts(){
  var f = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  var p = {}; f.formatToParts(new Date()).forEach(function(x){ p[x.type]=x.value; });
  return {y:+p.year, m:+p.month, d:+p.day};
}
function ymd(dt){ return dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')+'-'+String(dt.getUTCDate()).padStart(2,'0'); }
function todayUTC(){ var t = todayParts(); return new Date(Date.UTC(t.y, t.m-1, t.d)); }
function addDays(dt, n){ return new Date(dt.getTime() + n*86400000); }
function nice(dt){ return dt.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric'}); }
function niceStr(s){ return nice(new Date(s+'T00:00:00Z')); }
function rangeStr(c){ return c[0]===c[1] ? niceStr(c[0]) : niceStr(c[0])+' to '+niceStr(c[1]); }
function holidayIn(n){ var H = P.holidayWords || {}, keys = Object.keys(H).sort(function(a,b){return b.length-a.length;}); for (var i=0;i<keys.length;i++){ if ((' '+n+' ').indexOf(' '+keys[i]) > -1) return H[keys[i]]; } return null; }
function dayIn(n){
  if (/\btoday\b/.test(n)) return {kind:'today'};
  if (/\btomorrow\b/.test(n)) return {kind:'tomorrow'};
  if (/\bnext week\b/.test(n)) return {kind:'nextweek'};
  for (var i=0;i<MONTHS.length;i++){
    var m = n.match(new RegExp('\\b('+MONTHS[i]+'|'+MONTHS[i].slice(0,3)+')\\s+(\\d{1,2})\\b'));
    if (m) return {kind:'date', month:i, day:+m[2]};
  }
  var md = n.match(/\b(\d{1,2})\s(\d{1,2})\b/);
  if (md && +md[1]>=1 && +md[1]<=12 && +md[2]>=1 && +md[2]<=31) return {kind:'date', month:+md[1]-1, day:+md[2]};
  for (var w=0; w<7; w++){ if (new RegExp('\\b'+WEEKDAYS[w]+'\\b').test(n)) return {kind:'weekday', wd:w, next:/\bnext\b/.test(n)}; }
  return null;
}
function resolveDay(info){
  var t = todayUTC();
  if (info.kind==='today') return t;
  if (info.kind==='tomorrow') return addDays(t,1);
  if (info.kind==='weekday'){ var diff = (info.wd - t.getUTCDay() + 7) % 7; if (info.next && diff===0) diff = 7; return addDays(t, diff); }
  if (info.kind==='date'){ var y = t.getUTCFullYear(), dt = new Date(Date.UTC(y, info.month, info.day)); if (dt < addDays(t,-31)) dt = new Date(Date.UTC(y+1, info.month, info.day)); return dt; }
  return null;
}
function closuresFor(){ return ((P.closures||{})[OPT.school] || []); }
function closureOn(dt){ var s = ymd(dt), L = closuresFor(); for (var i=0;i<L.length;i++){ if (s>=L[i][0] && s<=L[i][1]) return L[i]; } return null; }
function kindStr(c){ return c[2]==='all' ? 'closed for everyone' : c[2]==='early' ? 'open, closing early at 5:00 PM' : 'VPK and school-age closed; preschool, toddlers and infants open, Break Camp available'; }
var LIVE = {
  openDate: function(e, text){
    var n = norm(text), info = dayIn(n), h = holidayIn(n);
    if (!closuresFor().length) return 'The closure calendar is on the Closures card.';
    if (info && info.kind==='nextweek'){ var t = todayUTC(), mon = addDays(t, ((8 - t.getUTCDay()) % 7) || 7), out = [];
      for (var i=0;i<5;i++){ var d = addDays(mon,i), c = closureOn(d); if (c) out.push(nice(d)+': '+kindStr(c)+' ('+c[3]+')'); }
      return out.length ? 'Next week at '+OPT.school+':\n'+out.join('\n') : 'No closures next week at '+OPT.school+'. Normal hours, 6:30 AM to 5:30 PM.'; }
    if (info){ var dt = resolveDay(info); if (dt){ var wd = dt.getUTCDay(), c2 = closureOn(dt);
      if (wd===0 || wd===6) return nice(dt)+' is a weekend.';
      return c2 ? nice(dt)+' at '+OPT.school+': '+kindStr(c2)+' ('+c2[3]+').' : nice(dt)+' is a normal day at '+OPT.school+', 6:30 AM to 5:30 PM.'; } }
    if (h && typeof h === 'string'){ var L = closuresFor().filter(function(c){ return c[3].toLowerCase().indexOf(h.toLowerCase()) > -1 || (h==='Christmas' && /christmas|winter/i.test(c[3])); });
      if (L.length) return L.map(function(c){ return rangeStr(c)+': '+kindStr(c)+' ('+c[3]+')'; }).join('\n'); }
    var tt = ymd(todayUTC()), U = closuresFor().filter(function(c){ return c[1] >= tt; }).slice(0, 8);
    return U.length ? 'Coming up at '+OPT.school+':\n'+U.map(function(c){ return '• '+rangeStr(c)+': '+c[3]+' ('+kindStr(c)+')'; }).join('\n') : 'No more closures on this year\'s calendar.';
  }
};

/* ---------- live: what a class is doing on a day (director-chat-lessons.js, copied from the Bear Phonics Academy Teacher Hubs) ---------- */
var L = window.DC_LESSONS || {classes:{}};
var HUB = 'https://bearphonicsacademy.com/teachers/';
var CLASSES = [
  {k:'ones',   n:'Ones',   icon:'🧸', re:/\b(ones|one year olds?|1 year olds?|1s|ones class)\b/},
  {k:'twos',   n:'Twos',   icon:'🚂', re:/\b(twos|two year olds?|2 year olds?|2s|twos class)\b/},
  {k:'threes', n:'Threes', icon:'🖍️', re:/\b(threes|three year olds?|3 year olds?|3s)\b/},
  {k:'fours',  n:'Fours / VPK', icon:'🎒', re:/\b(fours|four year olds?|4 year olds?|4s|vpk|pre k|prek|pollen jocks?)\b/},
  {k:'infant', n:'Infants', re:/\b(infants?|babies|baby room)\b/},
  {k:'sa',     n:'School Age', re:/\b(school age|schoolagers?|school agers?|worker bees|after school|aftercare)\b/}
];
function plain(s){ return ' '+String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim()+' '; }
var CLASS_RX = new RegExp(CLASSES.map(function(c){ return c.re.source; }).join('|'), 'g');
function classIn(text){ var t = plain(text); for (var i=0;i<CLASSES.length;i++){ if (CLASSES[i].re.test(t)) return CLASSES[i]; } return null; }
function classByKey(k){ for (var i=0;i<CLASSES.length;i++) if (CLASSES[i].k===k) return CLASSES[i]; return null; }
var LESSON_WORDS = /\b(lessons?|teach|teaching|taught|learn|learning|doing|plans?|activity|activities|crafts?|art|circle time|morning meeting|story|book|read aloud|reading|song|letter|word|trait|theme|show|episode|outside play|stream|curriculum|working on|centers?|small groups?|topic)\b/;
var NOT_DAILY = /\b(pdf|print|printable|workbooks?|supplements?|wizard|phonics books?|monthly|month s plan|months plan|take homes?|take home|resources|folder|upload|binder)\b/;
function wantsLesson(text){
  var t = plain(text), c = classIn(text), d = dayIn(norm(text)) || /\b(this week)\b/.test(t);
  if (!LESSON_WORDS.test(t)) return false;
  if (NOT_DAILY.test(t) && !d) return false;
  if (/\b(file|files|folder|pin|code|ratio|ratios|attendance|signed in|sign in|hours)\b/.test(t)) return false;
  return !!(c || (d && /\b(class|classes|classroom|room|kids|children|students|lesson|lessons|teach|teaching|learning)\b/.test(t)));
}
function nextSchoolDay(dt){ var x = dt; while (x.getUTCDay()===0 || x.getUTCDay()===6) x = addDays(x,1); return x; }
function lessonLines(c, s, dt){
  var p = ((L.classes[c.k]||{}).days||{})[s], o = [];
  if (!p) return null;
  o.push((c.icon?c.icon+' ':'')+c.n+' · '+nice(dt)+(p.theme ? '\nTheme: '+p.theme : ''));
  var w = []; if (p.letter) w.push('Letter of the week: '+p.letter); if (p.word) w.push('Word: '+p.word); if (p.trait) w.push('Trait: '+p.trait);
  if (w.length) o.push(w.join(' · '));
  var b = function(lbl, v){ if (v && (!v.join || v.length)) o.push('• '+lbl+': '+(v.join ? v.join('; ') : v)); };
  b('Morning meeting', p.topics); b('Centers (craft and sensory)', p.craft); b('Small groups', p.lessons); b('Song', p.song);
  b('Outside play', p.outside); b('Read-aloud', p.reading); b('S.T.R.E.A.M.', p.stream); b('Show', p.show);
  return o.join('\n');
}
function lastDay(c){ var d = Object.keys((L.classes[c.k]||{}).days||{}).sort(); return d.length ? d[d.length-1] : ''; }
function hubBtn(c, today){ return {label:'📅 Open the '+c.n+' Teacher Hub'+(today?' (opens on today)':''), href:HUB+c.k+'.html#day'}; }
LIVE.lesson = function(e, text){
  var c = classIn(text), n = norm(text), info = dayIn(n), t = todayUTC(), week = /\bthis week\b/.test(plain(text));
  if (!c) return {t:'Which class do you want?', ask:CLASSES.slice(0,4).map(function(x){ return {label:x.icon+' '+x.n, q:x.n+' '+(text.replace(/[?.!]+$/,''))}; }), noGo:1};
  if (c.k==='infant') return {t:'Infants don\'t have a daily Teacher Hub plan. Their monthly plan in the Lesson Plan Wizard is a folder with take-home and sign language activities (no weekly grid).', go:'Lesson Plan Wizard'};
  if (c.k==='sa') return {t:'School Age doesn\'t have daily plans in the Teacher Hub yet ("coming soon"). The monthly School Age plan and the K-3 and 4-6 workbooks are in the Lesson Plan Wizard.', go:'Lesson Plan Wizard'};
  if (!L.classes[c.k]) return {t:'I don\'t have the '+c.n+' daily plans copied yet. The Teacher Hub opens on today\'s plan.', btns:[hubBtn(c,1)], go:'Daily Plans'};
  var days = [];
  if (week || (info && info.kind==='nextweek')){
    var mon = addDays(t, -((t.getUTCDay()+6)%7)); if (info && info.kind==='nextweek') mon = addDays(mon,7);
    for (var i=0;i<5;i++) days.push(addDays(mon,i));
    var lines = days.map(function(d){ var s = ymd(d), p = L.classes[c.k].days[s], cl = closureOn(d);
      if (p) return '• '+nice(d)+': '+[p.craft&&p.craft[0], p.reading&&('read-aloud '+p.reading)].filter(Boolean).join('; ');
      if (cl) return '• '+nice(d)+': '+kindStr(cl)+' ('+cl[3]+')';
      return '• '+nice(d)+': '+(s < (Object.keys(L.classes[c.k].days).sort()[0]||'') ? 'not copied (see the Teacher Hub)' : 'no plan in the Teacher Hub'); });
    var p0 = L.classes[c.k].days[ymd(days[0])] || L.classes[c.k].days[ymd(days[1])] || {};
    return {t:c.n+', week of '+nice(days[0])+(p0.theme?'\nTheme: '+p0.theme:'')+(p0.letter?' · Letter '+p0.letter:'')+'\n'+lines.join('\n')+'\nAsk me about one day for the full plan.', btns:[hubBtn(c)], go:'Lesson Plan Wizard', noGo:0};
  }
  var hdt = null;
  if (!info){ var hn = (/\bturkey\b/.test(n) && !/\bthanksgiving\b/.test(n)) ? null : holidayIn(n);
    if (hn){ var Hs = closuresFor().filter(function(x){ return x[1] >= ymd(t) && String(x[3]).toLowerCase().indexOf(String(hn).toLowerCase()) > -1; }).sort(function(a,b){ return (a[2]==='all'?0:1)-(b[2]==='all'?0:1) || (a[0]<b[0]?-1:1); }); if (Hs.length) hdt = new Date(Hs[0][0]+'T00:00:00Z'); } }
  var dt = hdt || (info ? resolveDay(info) : t), note = '';
  if (!dt) dt = t;
  if (dt.getUTCDay()===0 || dt.getUTCDay()===6){ note = nice(dt)+' is a weekend, so here\'s the next school day.\n'; dt = nextSchoolDay(dt); }
  var s = ymd(dt), cl = closureOn(dt), txt = lessonLines(c, s, dt);
  if (!txt){
    var closedL = ((L.classes[c.k]||{}).closed||[]).indexOf(s) > -1;
    if (cl || closedL) return {t:note+nice(dt)+': no '+c.n+' plan. '+(cl ? OPT.school+' is '+kindStr(cl)+' ('+cl[3]+').' : 'The Teacher Hub shows it as a closed day.'), btns:[hubBtn(c)]};
    var ld = lastDay(c);
    if (ld && s > ld) return {t:note+'I have the '+c.n+' daily plans through '+niceStr(ld)+'. For '+nice(dt)+', open the Teacher Hub, or the monthly plan in the Lesson Plan Wizard.', btns:[hubBtn(c)], go:'Lesson Plan Wizard'};
    return {t:note+'I don\'t have a '+c.n+' plan for '+nice(dt)+'. The Teacher Hub has every day it covers.', btns:[hubBtn(c)], go:'Daily Plans'};
  }
  var more = CLASSES.slice(0,4).filter(function(x){ return x.k!==c.k; }).map(function(x){ return {label:x.icon+' '+x.n+(s===ymd(t)?' today':' that day'), q:'What are the '+x.n.split(' ')[0]+' doing '+(s===ymd(t)?'today':'on '+nice(dt))}; });
  if (s===ymd(t)) more.unshift({label:c.n+' tomorrow', q:'What are the '+c.n.split(' ')[0]+' doing tomorrow'});
  return {t:note+txt+'\nTimes, directions and links are in the '+c.n+' Teacher Hub.', btns:[hubBtn(c, s===ymd(t))], go:'Lesson Plan Wizard', ask:more};
};

var HUB_DOCS = /\b(workbooks?|supplements?|instructions|resource pages?|take homes?|take home|hive pages?|monthly plan|month s plan|months plan|lesson plan pdf|printables?)\b/;
LIVE.hubDocs = function(e, text){
  var c = classIn(text);
  if (!c || c.k==='infant' || c.k==='sa') return {t:'The monthly lesson plans, workbooks and supplements for every class are in the Lesson Plan Wizard. Pick the class and the month.'+(c&&c.k==='sa'?' School Age has K-3 and 4-6 workbooks there.':''), go:'Lesson Plan Wizard'};
  return {t:'In the '+c.n+' Teacher Hub, under Daily Plans, pick the month. The buttons above the day plan open the Lesson Plan, the Student Workbook (whole month), the Teacher\'s Supplement, the Instructions, Resource pages and HIVE take-home pages. Each day also has a button for that day\'s supplement pages. The December workbook links aren\'t opening yet, and Mrs. Bear has been told. The same files are also in the Lesson Plan Wizard.', btns:[hubBtn(c)], go:'Lesson Plan Wizard'};
};

/* ---------- live: open one child's or staff member's file (the director's own Student Files / Staff Files, looked up when asked; nothing is stored) ---------- */
var DOCS = {
  student: [
    [/\b(cubby|bin label|bin labels|picture of (the |him|her|them)|photo of (the |him|her|them)|childs picture|childs photo|kids picture|take (a |their |his |her )?(picture|photo|pic)|upload (a |their |his |her )?(picture|photo|pic)|add (a |their |his |her )?(picture|photo|pic)|(picture|photo|pic) (in|to|on|for) )\b/, 'cubby', 'Cubby & bin photo', 'Tap 📷 Take photo or 📎 Choose photo. It only shows once a photo release is on file.'],
    [/\b(photo release|video release|media release|picture release)\b/, 'photo', 'Photo / video release'],
    [/\b(shots?|shot record|immunizations?|vaccines?|vaccinations?|680|681|dh 680|dh 681)\b/, 'imm', 'Immunization record (DH 680 / 681)'],
    [/\b(physicals?|3040|dh 3040|check ?up|well visit|physical exam)\b/, 'phys', 'Physical exam (DH 3040)'],
    [/\b(registration|enrollment packet|registration packet)\b/, 'reg', 'Registration form / enrollment packet'],
    [/\b(medication|medicine|meds|inhaler|epi ?pen)\b/, 'medauth', 'Medication authorization'],
    [/\b(medical treatment|medical authorization|treatment authorization)\b/, 'med', 'Medical treatment authorization'],
    [/\b(emergency contacts?|authorized pick ?up|pick ?up list|pickup)\b/, 'em', 'Emergency contacts & authorized pickup'],
    [/\b(allerg(y|ies)|care plan|special needs plan)\b/, 'allg', 'Allergy / special needs care plan'],
    [/\b(diet|dietary|meal changes?|medical statement|special diet)\b/, 'dmed', 'Medical statement / dietary request'],
    [/\b(infant feeding|formula|feeding form)\b/, 'infant', 'Infant feeding form'],
    [/\b(free and reduced|free reduced|f and r|f r form)\b/, 'fr', 'Free & reduced meal application'],
    [/\b(food program enrollment|cacfp)\b/, 'cacfp', 'Food Program enrollment'],
    [/\b(parent id|parents id|drivers? licen[cs]e|id copy|photo id)\b/, 'pid', 'Parent ID copy'],
    [/\b(financial agreement|tuition agreement)\b/, 'fin', 'Financial agreement'],
    [/\b(handbook)\b/, 'hb', 'Handbook receipt'],
    [/\b(orientation)\b/, 'por', 'Parent orientation'],
    [/\b(distracted driver)\b/, 'dd', 'Distracted driver information'],
    [/\b(flu|influenza)\b/, 'flu', 'Influenza information'],
    [/\b(discipline|expulsion)\b/, 'disc', 'Discipline & expulsion policy receipt'],
    [/\b(transport consent|emergency transport)\b/, 'tcons', 'Emergency medical consent for transport'],
    [/\b(sleep position|feeding device)\b/, 'sleep', 'Physician authorization (sleep position / feeding device)'],
    [/\b(brochure|know your child care)\b/, 'broch', 'Know Your Child Care Facility brochure receipt'],
    [/\b(elc certificate|payment certificate|school readiness certificate|eligibility)\b/, 'elcpay', 'ELC / School Readiness payment certificate'],
    [/\b(elc|4c|early learning coalition)\b/, 'elc', 'Other ELC / 4C paperwork'],
    [/\b(custody|court)\b/, 'cust', 'Custody / court papers'],
    [/\b(what makes my child special|all about me)\b/, 'special', 'What makes my child special'],
    [/\b(nutrition|physical activity policy)\b/, 'nut', 'Nutrition & physical activity policy'],
    [/\b(food and activity permission|food permission)\b/, 'foodp', 'Food and activity permission']
  ],
  staff: [
    [/\b(bio|bio card|staff photo|teacher photo|their picture|her picture|his picture|picture|photo|pic)\b/, 'bio', 'Bio card & photo', 'Tap the Bio card & photo box to add the photo and short bio for the parent page.'],
    [/\b(training certificates?|sign (a |the |their |his |her )?certificates?|certificates? to sign|lesson certificates?)\b/, 'cert', 'Training certificates', 'Tap Sign now on each certificate waiting for your signature.'],
    [/\b(cpr)\b/, 'cpr', 'Infant & child CPR certificate'],
    [/\b(first aid)\b/, 'fa', 'First Aid certificate'],
    [/\b(background|screening|clearinghouse|fingerprints?|level 2)\b/, 'bg', 'Background screening'],
    [/\b(tb|tuberculosis|health screening)\b/, 'tb', 'TB / health screening'],
    [/\b(safe sleep)\b/, 'ss', 'Safe Sleep certificate'],
    [/\b(transcript|40 hour|10 hour|dcf training|dcf hours)\b/, 'dcf', 'DCF training transcript'],
    [/\b(cda|credential|fcccp|director credential)\b/, 'cred', 'Staff / Director credential'],
    [/\b(diploma|degree|education|transcripts? from school|high school)\b/, 'edu', 'Education credentials'],
    [/\b(drivers? licen[cs]e|license copy|id copy)\b/, 'dl', 'Driver\'s license'],
    [/\b(i 9|i9|w 4|w4|direct deposit|tax forms?)\b/, 'tax', 'Direct deposit / W-4 / I-9'],
    [/\b(application)\b/, 'app', 'Application for Employment'],
    [/\b(references?|reference check|employment history)\b/, 'ref', 'Employment history / reference check'],
    [/\b(good moral|affidavit)\b/, 'gm', 'Affidavit of Good Moral Character'],
    [/\b(orientation)\b/, 'orient', 'Orientation certificate'],
    [/\b(fire extinguisher)\b/, 'fire', 'Fire extinguisher training'],
    [/\b(in ?service|5268)\b/, 'inserv', 'In-service training record (CF-FSP 5268)'],
    [/\b(review|evaluation|90 day)\b/, 'rev', '90-day and performance reviews'],
    [/\b(time ?sheets?)\b/, 'pay', 'Signed weekly time sheets'],
    [/\b(literacy)\b/, 'lit', 'Early Literacy training'],
    [/\b(fare|food allergy training)\b/, 'fare', 'FARE training'],
    [/\b(medication training|medication administration)\b/, 'med', 'Medication administration training'],
    [/\b(transportation training|driver training)\b/, 'trans', 'Transportation training'],
    [/\b(driver physical)\b/, 'dphys', 'Driver physical exam'],
    [/\b(job description)\b/, 'jd', 'Job description'],
    [/\b(code of conduct)\b/, 'coc', 'Employee code of conduct'],
    [/\b(confidentiality)\b/, 'conf', 'Confidentiality agreement'],
    [/\b(infant training)\b/, 'inf', 'Approved infant training'],
    [/\b(civil rights)\b/, 'civ', 'Civil Rights training'],
    [/\b(5131|personnel file form)\b/, 'f5131', 'Personnel file form CF-FSP 5131'],
    [/\b(abuse hotline|central abuse)\b/, 'cah', 'Central Abuse Hotline records search'],
    [/\b(sex offender|predator)\b/, 'sop', 'Sexual predator / offender search'],
    [/\b(out of state)\b/, 'oos', 'Out-of-state registry searches'],
    [/\b(volunteer)\b/, 'vol', 'Volunteer acknowledgment']
  ]
};
var STAFF_WORDS = /\b(staff|teacher|teachers|employee|employees|coworker|assistant|aide|cook|floater|personnel|hire|new hire)\b/;
var CHILD_WORDS = /\b(child|childs|children|student|students|kid|kids|son|daughter|baby|infant|toddler|family)\b/;
var FILE_WORDS = /\b(file|files|folder|paperwork|documents?|record|records|upload|scan|attach|missing|expired|expiring|on file)\b/;
function docIn(kind, text){ var t = plain(text), L2 = DOCS[kind]; for (var i=0;i<L2.length;i++){ if (L2[i][0].test(t)) return {key:L2[i][1], label:L2[i][2], how:L2[i][3]}; } return null; }
function kindIn(text){ var t = plain(text); if (STAFF_WORDS.test(t) && !CHILD_WORDS.test(t)) return 'staff'; if (CHILD_WORDS.test(t)) return 'student';
  var s = docIn('staff', text), c = docIn('student', text); if (s && !c && s.key!=='bio') return 'staff'; return ''; }
function nameInText(text){
  var raw = String(text||''), first = (raw.match(/[A-Za-z-]+/)||[''])[0].toLowerCase(), short = raw.split(/\s+/).filter(Boolean).length <= 5;
  var c = nameWords(text).filter(function(x){ if (LESSON_WORDS.test(' '+x.w+' ') || GENERIC_WORDS[x.w]) return false;
    var cap = x.w.charAt(0).toUpperCase()+x.w.slice(1);
    if (new RegExp("\\b"+x.w+"[’']s\\b",'i').test(raw)) return true;
    if (x.w === first) return short;
    return new RegExp('\\b'+cap+'\\b').test(raw); });
  return c.length ? c[0].w : '';
}
function wantsFile(text){ var t = plain(text), who = nameInText(text);
  if (who && (FILE_WORDS.test(t) || docIn('student', text) || docIn('staff', text)) && !/\b(how|what|when|why|whose|does|did|do i|is there|are there)\b/.test(t)) return true;
  if (who && / s (file|folder)\b/.test(' '+String(text).toLowerCase().replace(/[’']s\b/g,' s')+' ')) return true;
  return /\b(upload|add|scan|attach|take|put|open|pull up|find|show me)\b.*\b(childs|child s|students|kids|teachers|staff members?|employees) (file|folder)\b/.test(t) && !/\b(what|whose|withdrawn|need)\b/.test(t); }
var ROSTER = {};
function roster(kind){
  if (!OPT.pin) return Promise.reject(new Error('nopin'));
  if (!ROSTER[kind]){
    ROSTER[kind] = fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:OPT.pin, action:'roster', kind:kind})})
      .then(function(r){ return r.json(); }).then(function(j){ if (!j || j.error || !j.people) throw new Error('roster'); return j.people.filter(function(p){ return !/^recTEST/.test(p.id) && !/\btest\b|practice/i.test(p.name); }); });
    ROSTER[kind].catch(function(){ delete ROSTER[kind]; });
  }
  return ROSTER[kind];
}
function shortName(n){ var p = String(n||'').trim().split(/\s+/); if (p.length < 2) return p[0]||''; var last = p[p.length-1]; return p[0]+' '+(/^[A-Z]\.$/.test(last) ? last : last.charAt(0).toUpperCase()+'.'); }
var NOT_NAMES = {}, GENERIC_WORDS = {};
('pull up show open find charles can free reduced family families parent parents whose does did name iphone my list intro lesson lessons training drive need new without withdrawn blurry email reply orientation online enrollment food program elc notary copy formulas formula statement over counter medicine remind know expiring expired paper packet how what where when why who which is are do i we the a an to of for in on at with please').split(' ').forEach(function(w){ GENERIC_WORDS[w]=1; });
('mrs mr ms miss bear bears handbook file files folder child childs student students kid kids teacher teachers staff upload picture photo pic shot shots record records physical cpr open find show '
 + 'cubby bin take add put scan attach document documents paper papers form forms missing expired expiring new son daughter baby infant toddler director '
 + 'release medication allergy birth certificate card first aid background id license tb today tomorrow class room twos threes fours ones vpk school').split(' ').forEach(function(w){ NOT_NAMES[w]=1; });
function nameWords(text){
  var raw = String(text||'').replace(/[’']s\b/gi,'').replace(/[’']/g,''), words = raw.split(/[^A-Za-z-]+/).filter(Boolean), out = [];
  words.forEach(function(w, i){ var lw = w.toLowerCase(); if (lw.length < 2 || NOT_NAMES[lw]) return; if (STOPSET[lw] && w.charAt(0) !== w.charAt(0).toUpperCase()) return; if (i===0 && STOPSET[lw]) return;
    out.push({w:lw, next:(words[i+1]||'')}); });
  return out;
}
function findPeople(text, people){
  var hits = [], seen = {};
  nameWords(text).forEach(function(nw){
    var m = people.filter(function(p){ var f = String(p.name).trim().split(/\s+/)[0].toLowerCase(); return f === nw.w; });
    if (m.length > 1 && nw.next){ var ini = nw.next.charAt(0).toLowerCase(), m2 = m.filter(function(p){ var q = String(p.name).trim().split(/\s+/); return q.length > 1 && q[q.length-1].charAt(0).toLowerCase() === ini; }); if (m2.length) m = m2; }
    m.forEach(function(p){ if (!seen[p.id]){ seen[p.id]=1; hits.push(p); } });
  });
  return hits;
}
function candidateName(text){ var c = nameWords(text).filter(function(x){ return !LESSON_WORDS.test(' '+x.w+' ') && !/^(how|where|what|can|need|want|please)$/.test(x.w); }); return c.length ? c[0].w : ''; }
function fileUrl(kind, p, doc){ return 'files.html?kind='+kind+'&open='+encodeURIComponent(p.id)+(doc ? '&doc='+doc.key : ''); }
function fileAnswer(kind, text, people){
  var doc = docIn(kind, text), who = kind==='staff' ? 'Staff Files' : 'Student Files', hits = findPeople(text, people);
  var how = doc ? (doc.how || 'On that line, tap 📷 Take photo or 📎 Choose file or PDF, and add the expiration date if it asks. If the paper copy is in your binder, tap Mark on file.') : '';
  if (hits.length === 1){
    var p = hits[0], nm = shortName(p.name);
    return {t:(doc ? nm+'\'s file opens right at '+doc.label+'. '+how : 'Here\'s '+nm+'\'s file'+(p.sub?' ('+p.sub+')':'')+'. Red items are missing or expired.'), btns:[{label:(kind==='staff'?'🗂️':'🧒')+' Open '+nm+'\'s file', href:fileUrl(kind, p, doc)}], noGo:1};
  }
  if (hits.length > 1){
    return {t:'I found '+hits.length+' with that name at '+OPT.school+'. Which one?'+(doc?' It opens at '+doc.label+'.':''), btns:hits.slice(0,6).map(function(p){ return {label:'Open '+shortName(p.name)+'\'s file'+(p.sub?' ('+p.sub+')':''), href:fileUrl(kind, p, doc)}; }), noGo:1};
  }
  return null;
}
LIVE.file = function(e, text){
  var kind = kindIn(text) || e.kind || 'student', who = kind==='staff' ? 'Staff Files' : 'Student Files', cand = nameInText(text), doc = docIn(kind, text);
  var std = '📷 Take photo or 📎 Choose file or PDF (or Mark on file if the paper copy is in your binder). Add the expiration date on anything that renews.';
  var generic = (kind==='staff' ? 'Staff Files > tap the person > ' : 'Student Files > tap the child > ') + (doc ? (doc.how ? doc.label+': '+doc.how : 'find "'+doc.label+'" > '+std) : 'find the line > '+std);
  var Cand = cand.charAt(0).toUpperCase()+cand.slice(1);
  var box = {kind:kind, text:text};
  if (!OPT.pin) return {t:generic, go:who};
  if (!cand) return {t:generic+'\nTell me the '+(kind==='staff'?'staff member\'s':'child\'s')+' first name and I\'ll open their file'+(doc?' right at that line':'')+'.', go:who, nameBox:box};
  return roster(kind).then(function(people){
    var r = fileAnswer(kind, text, people);
    if (!r && !kindIn(text)){ var other = kind==='staff' ? 'student' : 'staff';
      return roster(other).then(function(pp){ return fileAnswer(other, text, pp) || {t:'I couldn\'t find "'+Cand+'" in Student Files or Staff Files at '+OPT.school+'. Check the spelling, or look under Withdrawn / Former staff. '+generic, go:who, nameBox:box, notFound:1}; }); }
    return r || {t:'I couldn\'t find "'+Cand+'" in '+who+' at '+OPT.school+'. Check the spelling, or look under '+(kind==='staff'?'Former staff':'Withdrawn')+'. '+generic, go:who, nameBox:box, notFound:1};
  });
};
LIVE.addPerson = function(e, text){
  var kind = kindIn(text) || 'student';
  return {t:(kind==='staff' ? 'Staff Files > ➕ Add staff: type their first and last name and pick the role. New hires who signed the online packet are added from New Hires instead (Add to Staff Files and Bear Line).' : 'Student Files > ➕ Add child: first name, last name, birthday and room. A family that registered online is added from New Enrollments instead (Approve and add to the school), which files the packet too.'),
    btns:[{label:'➕ Add '+(kind==='staff'?'staff':'a child')+' now', href:'files.html?kind='+kind+'&add=1'}], go:kind==='staff'?'New Hires':'New Enrollments'};
};

/* the live answers above, as bank entries so they show in the browse list too */
D.QS.push(
  {id:'live-lesson', c:'Lessons and files', live:'lesson', q:['What are the twos doing today?','What lesson are the threes doing tomorrow?','What is the fours class learning this week?','What are the ones doing on Thursday?','What is the letter of the week for the twos?','What book do the threes read today?'], k:'lesson today tomorrow teaching learning craft letter word week class', a:'', go:'Daily Plans'},
  {id:'live-file', c:'Lessons and files', live:'file', q:['Upload a picture to a child\'s file','Open a child\'s file','Upload a shot record to a child\'s file','Open a staff member\'s file','Upload a teacher\'s CPR card','Take a cubby photo for a child'], k:'open file folder upload picture photo shot record child staff', a:'', go:'Student Files', also:['Staff Files']},
  {id:'live-hubdocs', c:'Lessons and files', live:'hubDocs', q:['Where is the twos workbook?','Where is the threes teacher supplement?','Where are the fours monthly instructions?'], k:'workbook supplement instructions resource take home monthly lesson plan', a:'', go:'Lesson Plan Wizard'},
  {id:'live-add', c:'Lessons and files', live:'addPerson', q:['How do I add a child to Student Files?','How do I add a new staff member to Staff Files?','Add a child','Add a staff member'], k:'add new child staff person student files staff files', a:'', go:'Student Files'}
);

/* ---------- opening a Director Portal card ---------- */
/* D.cards: name -> {tab:'id'} (a tab inside director.html), {page:'file.html'}, {fn:'openPins'} (a director.html button) or {url:'https://...'} */
function findTab(name){
  var L = [].slice.call(document.querySelectorAll('nav .tab')), lab = function(t){ return (t.textContent||'').replace(/\s+/g,' ').trim().replace(/^[^A-Za-z0-9]+\s/,''); };
  return L.filter(function(t){ return lab(t) === name; })[0] || L.filter(function(t){ return lab(t).indexOf(name) === 0; })[0];
}
function openCard(name){
  var c = D.cards[name] || {};
  var tab = findTab(name);
  if (tab){ tab.click(); var p = c.tab && document.getElementById('p-'+c.tab); if (p && p.scrollIntoView) p.scrollIntoView({behavior:'smooth', block:'start'}); return; }
  if (c.url){ window.open(c.url, '_blank', 'noopener'); return; }
  if (c.page){ window.open(c.page, '_blank'); return; }
  /* not on the Director Portal page (the owner preview): open the portal at that card */
  window.open('director.html#open='+encodeURIComponent(name), '_blank');
}
function byId(id){ for (var i=0;i<D.QS.length;i++) if (D.QS[i].id===id) return D.QS[i]; return {}; }

/* ---------- answering ---------- */
function fill(s){ var sc = D.schools[OPT.school] || {}; return String(s).replace(/\{(\w+)\}/g, function(_, k){ return sc[k] || (k==='school' ? OPT.school : ''); }); }
function answerText(e, text){
  if (e.live && LIVE[e.live]) return fill(LIVE[e.live](e, text));
  var a = e.a; if (e.steps) a += '\n' + e.steps.map(function(s, i){ return (i+1)+'. '+s; }).join('\n');
  return fill(a);
}
function say(who, content, extra){
  var box = ROOT.querySelector('.bc-log'), d = document.createElement('div');
  d.className = 'bc-msg ' + (who==='me' ? 'bc-me' : 'bc-bot');
  d.innerHTML = esc(content).replace(/\n/g,'<br>');
  if (extra) d.appendChild(extra);
  box.appendChild(d); box.scrollTop = box.scrollHeight;
  return d;
}
function chips(list, onPick){
  var w = document.createElement('div'); w.className = 'bc-chips';
  list.forEach(function(it){ var b = document.createElement('button'); b.type='button'; b.className='bc-chip'; b.textContent = it.label; b.onclick = function(){ onPick(it); }; w.appendChild(b); });
  return w;
}
function goLabel(g){ var c = D.cards[g] || {}; return (c.icon ? c.icon+' ' : '')+'Open '+g; }
function ask(text, picked){
  text = String(text||'').trim(); if (!text) return;
  say('me', text);
  var e = picked, m = null;
  if (!e){ if (classIn(text) && (HUB_DOCS.test(plain(text)) || (/\b(lesson plans?|plans?|curriculum)\b/.test(plain(text)) && /\b(january|february|march|april|may|june|july|august|september|october|november|december|monthly|this month|next month)\b/.test(plain(text)) && !(dayIn(norm(text))||{}).day)) && !/\b(file|files|attendance|pin)\b/.test(plain(text))) e = byId('live-hubdocs'); else if (wantsLesson(text)) e = byId('live-lesson'); else if (wantsFile(text)) e = byId('live-file'); }
  if (!e){ m = match(text); if (confident(m)) e = m[0].x.e; }
  if (!e && classIn(text)){ var m2 = match(plain(text).replace(CLASS_RX, ' ')); if (confident(m2)){ m = m2; e = m2[0].x.e; } }
  if (!e){
    MISSED.push({q:text});
    var alts = (m||[]).filter(function(r){ return r.s >= 2.5; }).slice(0,3);
    var ex = document.createElement('div');
    if (alts.length) ex.appendChild(chips(alts.map(function(r){ return {label:r.x.e.q[0], e:r.x.e}; }), function(it){ ask(it.label, it.e); }));
    ex.appendChild(chips([{label:'💬 Ask Mrs. Bear'}], function(){ handoff(text); }));
    say('bot', alts.length ? 'I\'m not sure I have that one. Did you mean one of these? If not, I can send it to Mrs. Bear.' : 'I don\'t have that one yet. I can send your question to Mrs. Bear, and the answer gets added here.', ex);
    renderMissed();
    return;
  }
  LOG.push(e.id);
  var res = (e.live && LIVE[e.live]) ? LIVE[e.live](e, text) : null;
  if (res && typeof res.then === 'function'){
    var wait = say('bot', 'Looking that up…');
    res.then(function(r){ if (r && r.notFound && !picked){ var mb = match(text); if (confident(mb) && !mb[0].x.e.live){ LOG.push(mb[0].x.e.id); show(wait, mb[0].x.e, null, text); return; } } show(wait, e, r, text); }, function(){ show(wait, e, {t:'I couldn\'t look that up right now. Try again in a minute, or open the card.'}, text); });
    return;
  }
  show(say('bot', ''), e, res, text);
}
/* fill a bot bubble: r is a live result {t, btns:[{label,href}], go, ask:[{label,q}], nameBox, noGo}, a string, or null for a bank answer */
function show(d, e, r, text){
  if (typeof r === 'string') r = {t:r};
  var txt = r ? fill(r.t||'') : answerText(e, text), ex = [];
  d.innerHTML = esc(txt).replace(/\n/g,'<br>');
  ((r && r.btns) || []).forEach(function(b){ ex.push({label:b.label, href:b.href}); });
  var gos = r ? (r.noGo ? [] : (r.go ? [r.go] : (e.go ? [e.go] : [])).concat(r.go ? [] : (e.also || []))) : (e.go ? [e.go] : []).concat(e.also || []);
  gos.forEach(function(g){ ex.push({label:goLabel(g), go:g}); });
  ((r && r.ask) || []).forEach(function(a){ ex.push({label:a.label, q:a.q}); });
  ex.push({label:'👍 That helped', ok:1});
  ex.push({label:'Not what I asked', no:1});
  d.appendChild(chips(ex, function(it){
    if (it.href){ window.open(it.href, '_blank'); return; }
    if (it.go){ openCard(it.go); return; }
    if (it.q){ ask(it.q); return; }
    if (it.ok){ say('bot', 'Glad to help! 🐝'); return; }
    if (it.no){ MISSED.push({q:text, wrong:e.id}); renderMissed(); handoff(text); }
  }));
  if (r && r.nameBox) d.appendChild(nameBox(r.nameBox));
  ROOT.querySelector('.bc-log').scrollTop = 1e9;
}
/* a small "first name" box: runs the file lookup again with the name added (the name is only used for this lookup) */
function nameBox(b){
  var f = document.createElement('form'); f.className = 'bc-form bc-name';
  f.innerHTML = '<label>'+(b.kind==='staff'?'Staff member\'s':'Child\'s')+' first name<input name="n" maxlength="40" autocomplete="off" autocapitalize="words"></label><button type="submit" class="bc-send">Open their file</button>';
  f.onsubmit = function(ev){ ev.preventDefault(); var n = f.elements.n.value.replace(/[^A-Za-z' -]/g,'').trim(); if (!n) return;
    f.remove(); ask(n.charAt(0).toUpperCase()+n.slice(1)+'\'s file'+(b.kind==='staff'?' (staff)':'')+(docIn(b.kind, b.text) ? ', '+docIn(b.kind, b.text).label : ''), byId('live-file')); };
  return f;
}
/* a question it can't answer goes to Mrs. Bear as a Director Portal note (the same notes Charles picks up every hour on weekdays) */
function handoff(question){
  var f = document.createElement('form'); f.className = 'bc-form';
  f.innerHTML = '<label>Your question<textarea name="m" required maxlength="1500" autocomplete="off"></textarea></label>'
    + '<button type="submit" class="bc-send">'+(OPT.mode==='live' ? 'Send to Mrs. Bear' : 'Preview: show what would be sent')+'</button>';
  f.querySelector('textarea').value = question;
  f.onsubmit = function(ev){
    ev.preventDefault();
    var msg = f.elements.m.value.trim(); if (!msg) return;
    if (OPT.mode !== 'live'){
      f.outerHTML = '<div class="bc-preview-note"><b>Preview only. Nothing was sent.</b><br>When Director Bear Chat is live, this goes to Mrs. Bear as a Director Portal note from '+esc(OPT.school)+', marked Director Bear Chat.</div>';
      return;
    }
    f.querySelector('button').disabled = true;
    fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:OPT.pin, action:'create', table:'Tab Notes',
      fields:{'Note':('Bear Chat: '+msg).slice(0,90), 'Full Note':'[Director Bear Chat] '+msg, 'Tab':'Director Bear Chat', 'By':OPT.school+' director', 'When':new Date().toISOString(), 'Status':'🟡 New'}})})
      .then(function(r){ return r.json(); }).then(function(d){ f.outerHTML = '<div class="bc-preview-note">'+(d && !d.error ? '✅ Sent to Mrs. Bear.' : '😕 That didn\'t go through. Please message Mrs. Bear directly.')+'</div>'; })
      .catch(function(){ f.outerHTML = '<div class="bc-preview-note">😕 That didn\'t go through. Please message Mrs. Bear directly.</div>'; });
  };
  say('bot', OPT.mode==='live' ? 'I\'ll send this to Mrs. Bear.' : 'In the live version, the director can send this to Mrs. Bear.', f);
}
function renderMissed(){
  var el = ROOT.querySelector('.bc-missed'); if (!el) return;
  if (!MISSED.length || OPT.mode !== 'preview'){ el.innerHTML = ''; return; }
  el.innerHTML = '<details><summary>Questions it couldn\'t answer this session ('+MISSED.length+')</summary><ul>'+MISSED.map(function(m){ return '<li>'+esc(m.q)+(m.wrong?' <i>(gave the wrong answer)</i>':'')+'</li>'; }).join('')+'</ul></details>';
}
function renderBrowse(){
  var el = ROOT.querySelector('.bc-browse'), cats = {}, total = 0, L = D.QS.filter(forSchool);
  L.forEach(function(e){ (cats[e.c] = cats[e.c] || []).push(e); total += e.q.length; });
  el.innerHTML = '<div class="bc-browse-h">Tap a question <span>('+L.length+' answers, '+total+' ways to ask)</span></div>' + Object.keys(cats).map(function(c){
    return '<details><summary>'+esc(c)+' ('+cats[c].length+')</summary><div class="bc-qlist">'+cats[c].map(function(e){ return '<button type="button" class="bc-q" data-id="'+esc(e.id)+'">'+esc(e.q[0])+'</button>'; }).join('')+'</div></details>';
  }).join('');
  el.querySelectorAll('.bc-q').forEach(function(b){ b.onclick = function(){ var e = byId(b.getAttribute('data-id')); ask(e.q[0], e); }; });
}
function setupVoice(){
  var btn = ROOT.querySelector('.bc-mic'), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ btn.style.display = 'none'; ROOT.querySelector('.bc-voice-note').textContent = 'Tip: tap the microphone on your phone\'s keyboard to speak your question.'; return; }
  var rec = null, on = false;
  btn.onclick = function(){
    if (on && rec && rec === REC){ rec.stop(); return; }
    rec = REC = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
    var inp = ROOT.querySelector('.bc-input'), finalText = '';
    rec.onresult = function(ev){ var t = ''; for (var i=0;i<ev.results.length;i++){ t += ev.results[i][0].transcript; if (ev.results[i].isFinal) finalText = t; } inp.value = t; };
    rec.onend = function(){ on = false; btn.classList.remove('on'); if (rec !== REC) return; REC = null; if (finalText.trim()){ ask(finalText); inp.value = ''; } };
    rec.onerror = function(){ on = false; btn.classList.remove('on'); };
    on = true; btn.classList.add('on'); rec.start();
  };
}
function mount(el, opt){
  OPT = opt || {}; ROOT = el; build(); MISSED = [];
  el.innerHTML = '<div class="bc-wrap">'
    + '<div class="bc-log" aria-live="polite"></div>'
    + '<div class="bc-privacy">🔒 This chat clears itself after 3 minutes without use, and nothing is saved on this device. It never shows PINs or codes. <button type="button" class="bc-clear">Clear chat now</button></div>'
    + '<form class="bc-bar"><input class="bc-input" placeholder="Type or speak a question…" autocomplete="off" maxlength="300"><button type="button" class="bc-mic" title="Speak">🎤</button><button class="bc-go" type="submit">Ask</button></form>'
    + '<div class="bc-voice-note">Voice uses your browser\'s free voice typing. Best for how-to questions, not names or private details.</div>'
    + '<div class="bc-browse"></div><div class="bc-missed"></div></div>';
  el.querySelector('.bc-bar').onsubmit = function(ev){ ev.preventDefault(); var i = el.querySelector('.bc-input'); ask(i.value); i.value=''; };
  el.querySelector('.bc-clear').onclick = function(){ reset(); el.querySelector('.bc-input').focus(); };
  ['keydown','pointerdown','touchstart','input'].forEach(function(t){ el.addEventListener(t, poke, true); });
  if (!window.__dcHooks){ window.__dcHooks = 1;
    window.addEventListener('pagehide', function(){ reset(); });
    window.addEventListener('pageshow', function(ev){ if (ev.persisted) reset(); });
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') HIDDEN_AT = Date.now();
      else if (HIDDEN_AT && Date.now() - HIDDEN_AT > AWAY_MS) reset();
    });
  }
  renderBrowse(); renderMissed(); setupVoice(); greet();
}
function greet(){
  say('bot', 'Hi! I\'m Director Bear Chat 🐻 for '+OPT.school+'. Ask me where something is or how to do it in the Director Portal: food program, DCF binder, files, staff hours, schedules, enrollments, new hires, reports and more. I\'ll give you the steps and a button to the right card.',
    chips((D.starters||[]).map(function(s){ return {label:s}; }), function(it){ ask(it.label); }));
}
function poke(){ clearTimeout(IDLE); IDLE = setTimeout(function(){ if (LOG.length || MISSED.length || ROOT.querySelector('.bc-me')) reset(); }, IDLE_MS); }
function reset(){
  if (!ROOT) return;
  clearTimeout(IDLE); IDLE = null; HIDDEN_AT = 0;
  try{ if (REC) REC.abort(); }catch(e){} REC = null;
  LOG = []; MISSED = []; ROSTER = {};
  var log = ROOT.querySelector('.bc-log'); if (log) log.innerHTML = '';
  var inp = ROOT.querySelector('.bc-input'); if (inp){ inp.value = ''; inp.blur(); }
  var mic = ROOT.querySelector('.bc-mic'); if (mic) mic.classList.remove('on');
  ROOT.querySelectorAll('.bc-browse details[open]').forEach(function(d){ d.open = false; });
  renderMissed(); greet();
}
window.DirectorChat = {mount:mount, reset:reset, match:function(t){ build(); return match(t); }, _test:{wantsLesson:wantsLesson, wantsFile:wantsFile, classIn:classIn, findPeople:findPeople, docIn:docIn, kindIn:kindIn, nameWords:nameWords, norm:norm, toks:toks, confident:confident, setSchool:function(s){ OPT.school = s; build(); }, LIVE:LIVE, byId:byId, answerText:answerText}};
})();
