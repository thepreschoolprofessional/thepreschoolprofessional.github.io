/* Bear Chat: a free question bank for the Parent Portal.
   Matches a typed or spoken question to the bank in bear-chat-data.js and answers from portal content.
   Anything it can't match goes to the family's school director as a regular Parent Message.
   BearChat.mount(el, {school, pin, mode}) where mode is 'preview' (nothing is sent) or 'live'. */
(function(){
var D = window.BC_DATA, OPT = {}, ROOT = null, LOG = [], MISSED = [], BLOBS = [], IDLE = null, HIDDEN_AT = 0, REC = null;
var IDLE_MS = 3*60*1000, AWAY_MS = 60*1000; /* clear after 3 minutes without use, or after 1 minute away from the page */
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
var STOP = ('a an the is are am be been do does did i me my we our you your it its to of in on at for and or can could would will '
  + 'what whats when where who how why there this that these those with have has had get got please hi hello hey just about any '
  + 'if so up as by from was were need want know tell let us im ill dont cant should child like wanna gonna gotta some').split(' ');
var STOPSET = {}; STOP.forEach(function(w){ STOPSET[w]=1; });
var EVENTISH = /\b(sign|signup|bring|lunch|party|potluck|feast|friendsgiving|event|food|volunteer|celebrat)/;
var WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

/* ---------- text matching ---------- */
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
function build(){ DF = {};
  INDEX = D.QS.map(function(e){
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
  /* date and holiday hints */
  var hasOpen = /\b(open|closed|close|shut|school|class|care|off)\b/.test(n) || /closed/.test(n);
  var hol = holidayIn(n), day = dayIn(n);
  scores.forEach(function(r){
    var id = r.x.e.id;
    if (hol && id==='open-holiday' && (hasOpen || !EVENTISH.test(n))) r.s += 6;
    if (day && hasOpen){ if (day.kind==='today' && id==='open-today') r.s += 6; if (day.kind==='tomorrow' && id==='open-tomorrow') r.s += 6; if ((day.kind==='weekday'||day.kind==='date'||day.kind==='nextweek') && id==='open-date') r.s += 6; }
  });
  scores.sort(function(a,b){ return b.s - a.s; });
  return scores.filter(function(r){ return r.s > 0; }).slice(0, 4);
}
function confident(m){ if (!m.length) return false; var a = m[0].s, b = m.length > 1 ? m[1].s : 0; if (a >= 7 || (a >= 1.5 && a >= b * 1.3)) return true;
  /* near-ties that all lead to the same card are still a confident answer */
  var g = m[0].x.e.go; return a >= 3 && !!g && m.filter(function(r){ return r.s >= a * 0.77; }).every(function(r){ return r.x.e.go === g; }); }

/* ---------- dates, in Florida time ---------- */
function todayParts(){
  var f = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'});
  var p = {}; f.formatToParts(new Date()).forEach(function(x){ p[x.type]=x.value; });
  return {y:+p.year, m:+p.month, d:+p.day, hh:+p.hour % 24, mm:+p.minute};
}
function ymd(dt){ return dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')+'-'+String(dt.getUTCDate()).padStart(2,'0'); }
function todayUTC(){ var t = todayParts(); return new Date(Date.UTC(t.y, t.m-1, t.d)); }
function addDays(dt, n){ return new Date(dt.getTime() + n*86400000); }
function nice(dt){ return dt.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric'}); }
function niceStr(s){ return nice(new Date(s+'T00:00:00Z')); }
function rangeStr(c){ return c[0]===c[1] ? niceStr(c[0]) : niceStr(c[0])+' to '+niceStr(c[1]); }
function holidayIn(n){ var keys = Object.keys(D.holidayWords).sort(function(a,b){return b.length-a.length;}); for (var i=0;i<keys.length;i++){ if ((' '+n+' ').indexOf(' '+keys[i]) > -1) return D.holidayWords[keys[i]]; } return null; }
function dayIn(n){
  if (/\btoday\b|\btonight\b|\bright now\b/.test(n)) return {kind:'today'};
  if (/\btomorrow\b/.test(n)) return {kind:'tomorrow'};
  if (/\bnext week\b/.test(n)) return {kind:'nextweek'};
  for (var i=0;i<MONTHS.length;i++){
    var re = new RegExp('\\b('+MONTHS[i]+'|'+MONTHS[i].slice(0,3)+')\\s+(\\d{1,2})\\b'), m = n.match(re);
    if (m) return {kind:'date', month:i, day:+m[2]};
  }
  var md = n.match(/\b(\d{1,2})\s(\d{1,2})\b/); /* "11 27" after punctuation was stripped from 11/27 */
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
function closuresFor(){ return (D.closures[OPT.school] || []); }
function closureOn(dt){ var s = ymd(dt), L = closuresFor(); for (var i=0;i<L.length;i++){ if (s>=L[i][0] && s<=L[i][1]) return L[i]; } return null; }
function dayAnswer(dt, label){
  var wd = dt.getUTCDay(), c = closureOn(dt), when = label ? label+' ('+nice(dt)+')' : nice(dt);
  if (wd===0 || wd===6) return when.charAt(0).toUpperCase()+when.slice(1)+' is a weekend, so we are closed. We are open Monday through Friday, 6:30 AM to 5:30 PM.';
  if (!c) return 'Yes, we are open '+when+', 6:30 AM to 5:30 PM.';
  if (c[2]==='all') return 'No, we are closed '+when+' for '+c[3]+'. All classes are closed, with no Break Camp.';
  if (c[2]==='early') return 'We are open '+when+' but close early at 5:00 PM. '+c[3]+'.';
  return 'Preschool, toddlers and infants are open '+when+'. VPK and school-age are closed for '+c[3]+', and Break Camp is available: ask the front office.';
}
var LIVE = {
  openDay: function(e){ var dt = addDays(todayUTC(), e.day||0); return dayAnswer(dt, e.day ? 'tomorrow' : 'today'); },
  openDate: function(e, text){
    var info = dayIn(norm(text));
    if (info && info.kind==='nextweek'){ var t = todayUTC(), mon = addDays(t, ((8 - t.getUTCDay()) % 7) || 7), out = [];
      for (var i=0;i<5;i++){ var d = addDays(mon,i), c = closureOn(d); if (c) out.push(nice(d)+': '+(c[2]==='all'?'closed for everyone':c[2]==='early'?'closing early at 5 PM':'VPK and school-age closed, preschool open')+' ('+c[3]+')'); }
      return out.length ? 'Next week:\n'+out.join('\n') : 'We are open every day next week (Monday to Friday, 6:30 AM to 5:30 PM). No closures are on the calendar.'; }
    if (info && info.kind!=='nextweek'){ var dt = resolveDay(info); if (dt) return dayAnswer(dt); }
    return LIVE.closureList();
  },
  openHoliday: function(e, text){
    var h = holidayIn(norm(text));
    if (h==='LABOR' || h==='JULY4') return byId('labor-july').a;
    if (h){ var L = closuresFor().filter(function(c){ return c[3].toLowerCase().indexOf(h.toLowerCase()) > -1 || (h==='Christmas' && /christmas|winter/i.test(c[3])) || (h==='New Year' && /new year/i.test(c[3])) || (h==='Thanksgiving' && /thanksgiving/i.test(c[3])); });
      if (L.length) return L.map(function(c){ return (c[2]==='all' ? 'Closed for everyone: ' : c[2]==='early' ? 'Open, closing early at 5 PM: ' : 'Preschool open, VPK and school-age closed (Break Camp available): ') + rangeStr(c) + ' ('+c[3]+')'; }).join('\n'); }
    return LIVE.closureList();
  },
  nextClosed: function(){
    var t = ymd(todayUTC()), L = closuresFor().filter(function(c){ return c[1] >= t; });
    var all = L.filter(function(c){ return c[2]==='all'; })[0], any = L[0];
    if (!any) return 'There are no more closures on this school year\'s calendar. The Closures card will show the new calendar when it is posted.';
    var s = '';
    if (all) s += 'The next day we are closed for everyone is '+rangeStr(all)+' ('+all[3]+').';
    if (any && any !== all) s += (s?' ':'')+'Before that, on '+rangeStr(any)+' ('+any[3]+'), '+(any[2]==='early'?'we close early at 5 PM.':'VPK and school-age are closed and preschool is open.');
    return s;
  },
  closureList: function(){
    var t = ymd(todayUTC()), L = closuresFor().filter(function(c){ return c[1] >= t; }).slice(0, 8);
    if (!L.length) return 'There are no more closures on this school year\'s calendar.';
    return 'Coming up:\n' + L.map(function(c){ return '• '+rangeStr(c)+': '+c[3]+(c[2]==='all'?' (closed for everyone)':c[2]==='early'?' (closing early)':' (VPK and school-age closed, preschool open)'); }).join('\n') + '\nThe Closures card has the full calendar to print.';
  },
  lesson: function(e){
    var L = (D.lessons||{})[e.lesson]; if (!L) return 'This is one of the Parent Orientation lessons. Open the Parent Orientation card to take it.';
    return 'The "'+L.t+'" lesson in Parent Orientation covers:\n'+L.pts.map(function(p){ return '• '+p; }).join('\n');
  },
  hours: function(){
    var p = todayParts(), dt = todayUTC(), wd = dt.getUTCDay(), c = closureOn(dt), mins = p.hh*60 + p.mm;
    var s = 'We are open Monday through Friday, 6:30 AM to 5:30 PM. Children must be picked up by closing time.';
    var openNow = wd>0 && wd<6 && mins >= 390 && mins < (c && c[2]==='early' ? 1020 : 1050) && !(c && c[2]==='all');
    return s + (openNow ? ' We are open right now.' : ' We are closed right now.');
  }
};
/* Parent Portal card ids (parent.html tabs) so an answer can open the right card */
var CARD = {'Closures':'closures','Tuition':'fees','What to Bring':'bring','Send Us':'msg','When Your Child Is Sick':'sick','Food Program Forms':'forms',
  'Send Us a Document':'docs','Menu':'menu','Drop-Off':'pick','Documents':'res','Lesson Plans':'lessons','Bear Phonics Academy Online':'bp','Meet Our Teachers':'teach',
  'Teddy Bear Talk':'tbt','Parent Orientation':'learn','Events':'events','Newsletter':'news','Message Board':'board','Monday Overview':'mon','Friday Briefing':'fri',
  'Things to Do':'todo','Add to Your Phone':'app','Year-Round Book Fair':'fair','Fundraiser':'fund'};
/* the family Welcome page (where Register Online and Book a tour live) */
var WELCOME = {'Register Online':'reg','Welcome Page':''};
function openCard(name, lesson){
  if (name in WELCOME){ window.open('welcome.html?school='+encodeURIComponent(OPT.school||'')+(WELCOME[name] ? '#'+WELCOME[name] : ''), '_blank'); return; }
  var id = CARD[name]; if (!id) { window.open('parent.html','_blank'); return; }
  if (lesson){
    var lt = [].slice.call(document.querySelectorAll('nav .tab')).filter(function(t){ return (t.getAttribute('onclick')||'').indexOf("show('learn'") > -1; })[0];
    if (lt && window.PPA && PPA.learn){ lt.click(); PPA.learn(lesson); return; }
    window.open('parent.html#card=learn&lesson='+encodeURIComponent(lesson)+'&school='+encodeURIComponent(OPT.school||''), '_blank'); return;
  }
  var tab = [].slice.call(document.querySelectorAll('nav .tab')).filter(function(t){ return (t.getAttribute('onclick')||'').indexOf("show('"+id+"'") > -1; })[0];
  if (tab){ tab.click(); return; }
  window.open('parent.html#card='+id+'&school='+encodeURIComponent(OPT.school||''), '_blank');
}
function byId(id){ for (var i=0;i<D.QS.length;i++) if (D.QS[i].id===id) return D.QS[i]; return {}; }

/* ---------- portal lookups (same calls the Parent Portal makes) ---------- */
function filesApi(action, extra){ return fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({pin:OPT.pin, action:action, school:OPT.school}, extra||{}))}).then(function(r){ return r.json(); }); }
function hiveApi(body){ return fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({pin:OPT.pin}, body))}).then(function(r){ return r.json(); }); }
var CACHE = {};
function cached(k, fn){ if (!CACHE[k]) CACHE[k] = fn().catch(function(e){ delete CACHE[k]; throw e; }); return CACHE[k]; }
function auto(){ return cached('auto', function(){ return filesApi('pp_auto').then(function(j){ if (!j || j.error) throw new Error((j&&j.error)||'x'); return j; }); }); }
function ppList(){ return cached('list', function(){ return filesApi('pp_list').then(function(j){ if (!j || j.error) throw new Error((j&&j.error)||'x'); return j; }); }); }
function link(u, t){ return '<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(t)+'</a>'; }
var ASYNC = {
  doc: function(e){
    return ppList().then(function(j){
      var L = (j.items||[]).filter(function(x){ return x.kind===e.doc; }).sort(function(a,b){ return (b.month||'').localeCompare(a.month||'') || (b.at||'').localeCompare(a.at||''); }), it = L[0];
      if (!it){ if (e.doc==='newsletter') return 'This month\'s newsletter is on the Newsletter card.'; return 'The '+e.doc+' will be posted on the '+(e.go||'portal')+' card soon.'; }
      if (!it.file) return 'The '+esc(it.title||e.doc)+' is on the '+esc(e.go)+' card.';
      return filesApi('pp_get',{name:it.file}).then(function(g){
        if (!g || g.error) throw 0;
        var bin = atob(g.b64), u8 = new Uint8Array(bin.length); for (var i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
        var ext = (it.file.split('.').pop()||'').toLowerCase(), u = URL.createObjectURL(new Blob([u8],{type: ext==='pdf'?'application/pdf':(ext==='png'?'image/png':'image/jpeg')})); BLOBS.push(u);
        return {html: 'Here is '+(it.month && it.month!==j.month ? 'the most recent ' : 'this month\'s ')+esc(e.doc)+': '+link(u, 'Open the '+(it.title||e.doc))};
      });
    });
  },
  forms: function(e){ return auto().then(function(a){
    var re = e.formRe ? new RegExp(e.formRe, 'i') : null, F = re ? a.forms.filter(function(f){ return re.test(f.doc); }) : a.forms;
    if (!F.length) return e.a || 'No food program forms are posted yet.';
    return {html: esc(e.lead || 'Food Program forms (print, fill out and return to the office):')+'<br>'+F.slice(0,10).map(function(f){ return '• '+link(f.link, f.doc); }).join('<br>')+(re ? '<br>Print it, fill it out and return it to the office, or send a photo on the Send Us a Document card.' : '')}; }); },
  withEmail: function(e){ return portalData().then(function(P){
    var rx = new RegExp(e.emailRe, 'i'), extra = P.sections.filter(function(x){ return rx.test(x.h+' '+x.body); }).slice(0,2);
    return {html: esc(fill(e.a))+extra.map(function(x){ var ln = x.body.split('\n').filter(function(l){ return rx.test(l); }).slice(0,2).join(' '); return '<br><br><b>From '+esc(x.src)+':</b> '+esc(ln || x.body.slice(0,200)); }).join('')}; }); },
  teachers: function(){ return portalData().then(function(P){ var T = P.teachers;
    if (!T.length) return "Our teacher bios are coming soon. Open the Meet Our Teachers card to see them when they're posted.";
    return {html:'Teachers at '+esc(OPT.school)+':<br>'+T.map(function(t){ return '• <b>'+esc(t.name)+'</b>'+(t.role?', '+esc(t.role):''); }).join('<br>')+'<br>Open Meet Our Teachers to read about each one.'}; }); },
  lessons: function(){ return auto().then(function(a){ if (!a.lessons.length) return 'The '+a.monthName+' lesson plans are not posted yet. Please check back soon.'; return {html: a.monthName+' lesson plans. Pick your child\'s age group:<br>'+a.lessons.map(function(x){ return '• '+link(x.link, x.age||x.plan); }).join('<br>')}; }); },
  weekly: function(e){
    if (/Monday|Friday/.test(e.kind)) return portalData().then(function(P){ var S = P.sections.filter(function(x){ return x.kind===e.kind; });
      if (!S.length) return 'The '+e.kind+' will show up on its card as soon as it is sent.';
      return {html:'<b>'+esc(S[0].src.replace(/^this week's |^last /,'').replace(/^./,function(c){ return c.toUpperCase(); }))+'</b><br>'+S.slice(0,8).map(function(x){ return '• <b>'+esc(x.h)+'</b>: '+esc(x.body.split('\n')[0].slice(0,160)); }).join('<br>')}; });
    return auto().then(function(a){ var dt = function(w){ var t = Date.parse(String(w.title||'').split('—').pop()); return isNaN(t) ? 0 : t; }, W = (a.weekly||[]).filter(function(w){ return w.kind===e.kind; }).sort(function(x,y){ return dt(y)-dt(x); });
    if (!W.length && e.kind === 'Things to do'){ return portalData().then(function(P){ var f = P.sections.filter(function(x){ return /things to do/i.test(x.h); })[0];
      if (!f) return 'This week\'s list of things to do isn\'t posted yet. A new list comes out every Monday on the Things to Do card.';
      return {html:'The new list comes out on Monday. Here is the last one, from the '+esc(f.src)+':<br>'+f.body.split('\n').filter(Boolean).slice(0,8).map(function(l){ return '• '+esc(l); }).join('<br>')}; }); }
    if (!W.length) return 'This week\'s '+e.kind+' isn\'t posted yet. Check the '+e.go+' card soon.';
    var w = W[0], lines = String(w.body||'').split(/\n+/).map(function(s){ return s.replace(/^\s*[-•*]\s*/,'').trim(); }).filter(Boolean).slice(0,6);
    return {html:'<b>'+esc(w.title||e.kind)+'</b><br>'+lines.map(function(l){ return '• '+esc(l); }).join('<br>')}; }); },
  events: function(e, text){ return filesApi('pp_ev_list').then(function(r){ var E = (r && r.events) || [];
    if (E.length){ var qt = toks(text||''), best = null, bs = 0; E.forEach(function(ev){ var et = {}; toks(ev.title+' '+evExtra(ev.title)).forEach(function(t){ et[t]=1; }); var sc = qt.filter(function(t){ return et[t]; }).length; if (sc > bs){ bs = sc; best = ev; } });
      if (best) return {html: eventHtml(best) + (E.length > 1 ? '<br><br>Also coming up: '+E.filter(function(x){ return x !== best; }).slice(0,4).map(function(x){ return esc(x.title); }).join(', ')+'.' : '')}; }
    if (!E.length) return 'No events need sign-ups right now. Check the Events card and the newsletter for dates.';
    return {html:'Coming up:<br>'+E.slice(0,5).map(function(ev){ var d = ''; try{ d = new Date(ev.when+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); }catch(x){ d = ev.when; } return '• <b>'+esc(ev.title)+'</b>, '+esc(d); }).join('<br>')+'<br>To sign up to bring something, open the Events and Sign-Ups card.'}; }); },
  monthDates: function(){ return auto().then(function(a){ var d = (a.newsletter && a.newsletter.form && a.newsletter.form.dates) || [];
    if (!d.length) return 'No special dates are listed for '+a.monthName+'. The Newsletter card has the full month.';
    return {html:'Important dates in '+esc(a.monthName)+':<br>'+d.map(function(x){ return '• <b>'+esc(x[0])+'</b>: '+esc(x[1]); }).join('<br>')}; }); },
  board: function(){ return ppList().then(function(j){ var B = j.board || [];
    if (!B.length) return 'There are no new messages on the Message Board right now.';
    return {html: B.slice(0,3).map(function(b){ return '• <b>'+esc(b.title)+'</b>: '+esc(String(b.message||'').slice(0,220)); }).join('<br>')}; }); },
  resources: function(e){ return hiveApi({action:'list', table:'Resource Links', maxRecords:200, sortField:'Order', asParent:true}).then(function(d){
    var R = (d.records||[]).map(function(r){ return r.fields; }).filter(function(r){ var sc = (r.School&&r.School.name)||r.School||'Both'; return (sc==='Both'||sc===OPT.school) && r.URL && r.URL.charAt(0)!=='#'; });
    var rx = new RegExp(e.resRe || 'handbook|registr|enroll|packet|form|document', 'i'), M = R.filter(function(r){ return rx.test((r.Title||'')+' '+((r.Section&&r.Section.name)||r.Section||'')); });
    var L = (M.length ? M : R).slice(0, 8);
    if (!L.length) return 'The handbook and registration documents are on the Documents and Registration card.';
    return {html:'From the Documents and Registration card:<br>'+L.map(function(r){ return '• '+link(r.URL, r.Title); }).join('<br>')}; }); }
};

/* ---------- everything on the Parent Portal right now (searched as answers) ---------- */
function evExtra(t){ t = String(t||'').toLowerCase(); var x = 'event sign up signup bring';
  if (/friendsgiving|thanksgiving|turkey/.test(t)) x += ' thanksgiving friendsgiving potluck feast turkey lunch food';
  if (/christmas|holiday|winter|santa/.test(t)) x += ' christmas holiday party winter';
  if (/picture|photo/.test(t)) x += ' picture photo day';
  if (/party|celebrat/.test(t)) x += ' party celebration';
  return x; }
function evWhen(ev){ try{ var d = new Date(ev.when+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); var t = String(ev.time||'').split(':'), h = +t[0];
  return d + (ev.time ? ' at '+((h%12)||12)+':'+(t[1]||'00')+(h>=12?' PM':' AM') : ''); }catch(x){ return ev.when; } }
function eventHtml(ev){
  var items = ev.items || [], need = items.filter(function(i){ return i.left > 0; }), gone = items.length - need.length;
  return '<b>'+esc(ev.title)+'</b><br>'+esc(evWhen(ev))+(ev.rooms && ev.rooms.length ? ' · '+esc(ev.rooms.join(', ')) : '')
    + (ev.note ? '<br>'+esc(ev.note) : '')
    + (need.length ? '<br><br><b>Still needed:</b><br>'+need.map(function(i){ return '• '+esc(i.name)+' ('+i.left+' left)'; }).join('<br>') : (items.length ? '<br><br>Everything on the list is taken. You can still offer something else.' : ''))
    + (gone ? '<br>'+gone+' item'+(gone>1?'s are':' is')+' already taken.' : '')
    + '<br><br>To sign up, open Events and Sign-Ups, check what you will bring, add your family name and tap Sign me up.';
}
var SECRET = /(pin|passcode|door code|password|gate code)[^.\n]{0,40}\d{3,}/i;
function emailSections(html, src){
  var t = String(html||'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td)[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ');
  var ta = document.createElement('textarea'); ta.innerHTML = t; t = ta.value;
  var L = t.split('\n').map(function(l){ return l.replace(/[\s ]+/g,' ').trim(); }).filter(function(l){ return l && /[a-z0-9]/i.test(l); });
  var out = [], cur = null;
  L.forEach(function(l){
    var head = l.length <= 60 && !/[.!?:,;)]$/.test(l) && !/^[•\-*]/.test(l) && !/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i.test(l) && !/^[“"]/.test(l);
    if (head){ cur = {h:l, lines:[], src:src}; out.push(cur); }
    else if (cur) cur.lines.push(l.replace(/^[•\-*]\s*/,''));
  });
  return out.filter(function(x){ return x.lines.length && !SECRET.test(x.h+' '+x.lines.join(' ')) && !/^(with mrs|kid city usa|the monday honey|bear line|dear |good morning|happy friday)/i.test(x.h) && !(x.lines.length===1 && /^(monday|friday|happy friday|dear |good morning)/i.test(x.lines[0])); }).map(function(x){ return {h:x.h, body:x.lines.join('\n'), src:x.src}; });
}
function newest(W, kind){ var dt = function(w){ var t = Date.parse(String(w.title||'').split('—').pop()); return isNaN(t) ? 0 : t; };
  return (W||[]).filter(function(w){ return w.kind===kind; }).sort(function(x,y){ return dt(y)-dt(x); })[0]; }
function soft(p){ return p.then(function(x){ return x; }, function(){ return null; }); }
function portalData(){ return cached('portal', function(){
  return Promise.all([soft(auto()), soft(ppList()), soft(filesApi('pp_ev_list')),
    soft(hiveApi({action:'list', table:'Resource Links', maxRecords:200, sortField:'Order', asParent:true})), soft(filesApi('bios_public'))]).then(function(R){
    var a = R[0] || {}, sections = [];
    [['Monday Overview','this week\'s Monday Overview'],['Friday Briefing','last Friday Briefing']].forEach(function(k){ var w = newest(a.weekly, k[0]); if (w) sections = sections.concat(emailSections(w.body, k[1]).map(function(x){ x.kind = k[0]; return x; })); });
    var res = ((R[3] && R[3].records) || []).map(function(r){ return r.fields; }).filter(function(r){ var sc = (r.School&&r.School.name)||r.School||'Both'; return (sc==='Both'||sc===OPT.school) && r.URL && !/^(Menu|Newsletter|Lesson Plans)\b/i.test(r.Title||''); });
    return {auto:a, board:(R[1] && R[1].board) || [], events:(R[2] && R[2].events) || [], res:res,
      teachers:((R[4] && R[4].staff) || []).map(function(t){ return {name:t.name, role:t.role}; }), sections:sections};
  }); }); }
var AGE = {'Infant':'infant infants baby babies newborn','Ones':'ones one 1 year old toddler','Twos':'twos two 2 year old toddler','Threes':'threes three 3 year old preschool',
  'Fours':'fours four 4 year old vpk pre-k prek','School Age':'school age after school kindergarten older'};
var FORMK = [[/medical statement \(/i,'allergy allergic food allergies special diet dietary needs doctor medical peanut nut gluten dairy lactose'],[/food substitution/i,'allergy allergic substitute substitution swap special diet'],
  [/milk/i,'milk dairy lactose soy almond oat milk substitute whole'],[/dietary preference/i,'vegetarian vegan religious preference halal kosher pork diet'],[/infant feeding/i,'infant baby bottle formula breast milk feeding schedule'],
  [/formula/i,'formula infant baby special formula medical'],[/infant menu/i,'infant baby menu food eat'],[/free.*reduced/i,'free reduced meal application income lunch cost price']];
var RESK = [[/facebook/i,'facebook social follow'],[/instagram/i,'instagram social follow'],[/tiktok/i,'tiktok social follow'],[/review/i,'review google rate stars recommend'],
  [/registration|register/i,'register registration enroll sign new child sibling procare update information'],[/handbook/i,'handbook rules policies policy guide'],[/calendar/i,'calendar closures year yearly dates holidays'],
  [/college/i,'college degree masters teacher job career tuition'],[/packet/i,'packet homework take home missed'],[/uniform/i,'uniform shirt order size buy']];
function kw(map, t){ return map.filter(function(m){ return m[0].test(t); }).map(function(m){ return m[1]; }).join(' '); }
function loadPortal(){
  portalData().then(function(P){
    var Q = [], C = 'On the portal right now', a = P.auto || {};
    P.events.forEach(function(ev, i){ Q.push({id:'ev-'+i, c:C, go:'Events', html:eventHtml(ev), q:[ev.title, 'Sign up for '+ev.title, 'What can I bring to '+ev.title+'?', 'When is '+ev.title+'?'],
      k:ev.title+' '+(ev.note||'')+' '+(ev.items||[]).map(function(x){ return x.name; }).join(' ')+' '+evExtra(ev.title)}); });
    (a.weekly||[]).filter(function(w){ return w.kind==='Update'; }).forEach(function(w, i){ var ev = /sign.?up|events/i.test(w.body||'');
      Q.push({id:'up-'+i, c:C, go:ev ? 'Events' : 'Newsletter', a:String(w.body||''), q:[w.title], k:w.title+' '+(w.body||'')+' '+evExtra(w.title)}); });
    var td = (a.weekly||[]).filter(function(w){ return w.kind==='Things to do'; })[0];
    if (td) Q.push({id:'todo-now', c:C, go:'Things to Do', html:'<b>'+esc(td.title)+'</b><br>'+String(td.body||'').split(/\n+/).filter(Boolean).map(function(l){ return '• '+esc(l.replace(/^\s*[-•*]\s*/,'')); }).join('<br>'),
      q:['Things to do this weekend', 'What can we do this weekend near '+OPT.school+'?'], k:'weekend things do fun family free '+td.title+' '+td.body});
    P.sections.forEach(function(x, i){ Q.push({id:'em-'+i, c:C, go:x.kind, html:'<b>'+esc(x.h)+'</b><br>'+x.body.split('\n').map(esc).join('<br>')+'<br><i>From '+esc(x.src)+'.</i>',
      q:[x.h], k:x.h+' '+x.body+(/suppl/i.test(x.h+x.body) ? ' wipes tissues supplies' : '')}); });
    (a.forms||[]).forEach(function(f, i){ Q.push({id:'form-'+i, c:C, go:'Food Program Forms', html:link(f.link, f.doc)+'<br>Print it, fill it out and return it to the office, or send a photo on the Send Us a Document card.',
      q:[f.doc, 'Where is the '+f.doc+'?'], k:f.doc+' form '+kw(FORMK, f.doc)}); });
    (a.lessons||[]).forEach(function(l, i){ Q.push({id:'lp-'+i, c:C, go:'Lesson Plans', html:a.monthName+' lesson plan for '+esc(l.age||l.plan)+': '+link(l.link, 'Open the lesson plan'),
      q:['Lesson plan for '+(l.age||l.plan), 'What is my '+(l.age||'')+' learning?'], k:'lesson plan learning '+(l.age||'')+' '+(AGE[l.age]||'')}); });
    P.board.forEach(function(b, i){ Q.push({id:'bd-'+i, c:C, go:'Message Board', html:'<b>'+esc(b.title)+'</b><br>'+esc(b.message).replace(/\n/g,'<br>'), q:[b.title], k:b.title+' '+b.message}); });
    P.res.forEach(function(r, i){ var u = String(r.URL||''), msg = u.charAt(0)==='#', t = msg ? u.slice(u.indexOf(':')+1) : '';
      Q.push({id:'rl-'+i, c:C, go:msg ? 'Send Us' : 'Documents', html:esc(r.Description||r.Title)+'<br>'+(msg ? 'Open Send Us a Message and pick '+esc(t)+'.' : link(u, 'Open '+r.Title)), q:[r.Title], k:r.Title+' '+(r.Description||'')+' '+kw(RESK, r.Title)}); });
    P.teachers.forEach(function(t, i){ Q.push({id:'tc-'+i, c:C, go:'Meet Our Teachers', a:t.name+(t.role ? ' is on our team: '+t.role+'.' : ' is on our team.')+' Open Meet Our Teachers to read more.', q:['Who is '+t.name+'?'], k:t.name+' '+(t.role||'')+' teacher'}); });
    Q.forEach(function(e){ e.dyn = true; e.q = e.q.filter(Boolean); e.k = String(e.k||'').replace(SECRET, ''); });
    D.QS = D.QS.filter(function(e){ return !e.dyn; }).concat(Q);
    build(); renderBrowse();
  }).catch(function(){});
}

/* ---------- answering ---------- */
function fill(s){ var sc = D.schools[OPT.school] || {}; return String(s).replace(/\{(\w+)\}/g, function(_, k){ return sc[k] || (k==='school' ? OPT.school : ''); }); }
function answer(e, text){
  if (e.html) return Promise.resolve({html:e.html});
  if (e.live && LIVE[e.live]) return Promise.resolve(fill(LIVE[e.live](e, text)));
  if (e.live && ASYNC[e.live]) return ASYNC[e.live](e, text).then(function(r){ return typeof r === 'string' ? fill(r) : r; }).catch(function(){ return 'I couldn\'t load that just now. It\'s on the '+(e.go||'portal')+' card in the Parent Portal.'; });
  return Promise.resolve(fill(e.a));
}
function say(who, content, extra){
  var box = ROOT.querySelector('.bc-log'), d = document.createElement('div');
  d.className = 'bc-msg ' + (who==='me' ? 'bc-me' : 'bc-bot');
  if (content && content.html) d.innerHTML = content.html; else d.innerHTML = esc(content).replace(/\n/g,'<br>');
  if (extra) d.appendChild(extra);
  box.appendChild(d); box.scrollTop = box.scrollHeight;
  return d;
}
function chips(list, onPick){
  var w = document.createElement('div'); w.className = 'bc-chips';
  list.forEach(function(it){ var b = document.createElement('button'); b.type='button'; b.className='bc-chip'; b.textContent = it.label; b.onclick = function(){ onPick(it); }; w.appendChild(b); });
  return w;
}
function ask(text, picked){
  text = String(text||'').trim(); if (!text) return;
  say('me', text);
  var e = picked, m = null;
  if (!e){ m = match(text); if (confident(m)) e = m[0].x.e; }
  if (!e){
    MISSED.push({q:text, at:new Date().toISOString()});
    var alts = (m||[]).filter(function(r){ return r.s >= 2.5; }).slice(0,3);
    var ex = document.createElement('div');
    if (alts.length){ ex.appendChild(chips(alts.map(function(r){ return {label:r.x.e.q[0], e:r.x.e}; }), function(it){ ask(it.label, it.e); })); }
    ex.appendChild(chips([{label:'💬 Send my question to the director'}], function(){ handoff(text, 'Question from Bear Chat'); }));
    say('bot', alts.length ? 'I\'m not sure I have that one. Did you mean one of these? If not, I can send your question to your director.' : 'I don\'t have an answer for that yet. I can send your question to your school\'s director.', ex);
    renderMissed();
    return;
  }
  LOG.push({q:text, id:e.id});
  var wait = say('bot', '…');
  answer(e, text).then(function(r){
    if (r && r.html) wait.innerHTML = r.html; else wait.innerHTML = esc(r).replace(/\n/g,'<br>');
    var ex = [];
    var L = e.lesson && (D.lessons||{})[e.lesson];
    if (e.go) ex.push({label:e.go in WELCOME ? (e.go==='Register Online' ? '📝 Register Online' : 'Open our Welcome page') : (L && e.go==='Parent Orientation' ? '🎓 Take this lesson' : 'Open '+e.go+' in the portal'), go:e.go, lesson:L && e.go==='Parent Orientation' ? e.lesson : ''});
    if (L && e.go!=='Parent Orientation') ex.push({label:'🎓 Learn more: '+L.t+' lesson', go:'Parent Orientation', lesson:e.lesson});
    if (e.handoff) ex.push({label:'💬 Send this to the director', h:e.handoff});
    ex.push({label:'👍 That helped', ok:1});
    ex.push({label:'Not what I asked', no:1});
    wait.appendChild(chips(ex, function(it){
      if (it.go){ openCard(it.go, it.lesson); return; }
      if (it.h){ handoff(text, it.h); return; }
      if (it.ok){ say('bot', 'Glad to help! 🐝'); return; }
      if (it.no){ MISSED.push({q:text, at:new Date().toISOString(), wrong:e.id}); renderMissed(); handoff(text, 'Question from Bear Chat'); }
    }));
    ROOT.querySelector('.bc-log').scrollTop = 1e9;
  });
}
function handoff(question, type){
  var f = document.createElement('form'); f.className = 'bc-form';
  f.innerHTML = '<label>Your name<input name="n" required maxlength="80" autocomplete="off"></label>'
    + '<label>Phone or email (so the director can reply)<input name="c" maxlength="120" autocomplete="off"></label>'
    + '<label>Your message<textarea name="m" required maxlength="1500" autocomplete="off"></textarea></label>'
    + '<button type="submit" class="bc-send">'+(OPT.mode==='live' ? 'Send to the director' : 'Preview: show what would be sent')+'</button>';
  f.querySelector('textarea').value = question;
  f.onsubmit = function(ev){
    ev.preventDefault();
    var E = f.elements, name = E.n.value.trim(), contact = E.c.value.trim(), msg = E.m.value.trim();
    var fields = {Name:name, School:OPT.school, Type:'💬 General Feedback / Question', Email:/@/.test(contact)?contact:'', Phone:/@/.test(contact)?'':contact,
      Details:'[Bear Chat] '+type+'\n'+msg, Submitted:new Date().toISOString(), Status:'New'};
    if (OPT.mode !== 'live'){
      f.outerHTML = '<div class="bc-preview-note"><b>Preview only. Nothing was sent.</b><br>When Bear Chat is live, this goes to the '+esc(OPT.school)+' director as a regular parent message (Director Portal, Parent Replies), marked [Bear Chat], with the family\'s name and contact. The director answers the family as usual, then taps Add to Bear Chat so the next family who asks gets the answer once it is approved.</div>';
      return;
    }
    f.querySelector('button').disabled = true;
    hiveApi({action:'create', table:'Parent Messages', fields:fields}).then(function(d){
      f.outerHTML = d && d.records ? '<div class="bc-preview-note">✅ Sent to your director. They will get back to you soon.</div>' : '<div class="bc-preview-note">😕 That didn\'t go through. Please call '+esc((D.schools[OPT.school]||{}).phone||'the office')+'.</div>';
    }).catch(function(){ f.outerHTML = '<div class="bc-preview-note">😕 That didn\'t go through. Please call the office.</div>'; });
  };
  say('bot', OPT.mode==='live' ? 'I\'ll send this to your director. Add your name and how to reach you.' : 'In the live version, the family fills this in and it goes to the director.', f);
}

/* ---------- questions it couldn't answer (owner preview only, kept in memory, cleared with the chat) ---------- */
function renderMissed(){
  var el = ROOT.querySelector('.bc-missed'); if (!el) return;
  if (!MISSED.length || OPT.mode !== 'preview'){ el.innerHTML = ''; return; }
  el.innerHTML = '<details><summary>Questions Bear Chat couldn\'t answer this session ('+MISSED.length+')</summary><ul>'+MISSED.map(function(m){ return '<li>'+esc(m.q)+(m.wrong?' <i>(gave the wrong answer)</i>':'')+'</li>'; }).join('')+'</ul></details>';
}

/* ---------- browse all questions ---------- */
function renderBrowse(){
  var el = ROOT.querySelector('.bc-browse'), cats = {}, total = 0;
  D.QS.forEach(function(e){ (cats[e.c] = cats[e.c] || []).push(e); total += e.q.length; });
  el.innerHTML = '<div class="bc-browse-h">Tap a question <span>('+D.QS.length+' answers, '+total+' ways to ask)</span></div>' + Object.keys(cats).map(function(c){
    return '<details><summary>'+esc(c)+' ('+cats[c].length+')</summary><div class="bc-qlist">'+cats[c].map(function(e){ return '<button type="button" class="bc-q" data-id="'+esc(e.id)+'">'+esc(e.q[0])+'</button>'; }).join('')+'</div></details>';
  }).join('');
  el.querySelectorAll('.bc-q').forEach(function(b){ b.onclick = function(){ var e = byId(b.getAttribute('data-id')); ask(e.q[0], e); ROOT.querySelector('.bc-input').focus(); }; });
}

/* ---------- voice (free, built into Chrome and Safari) ---------- */
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

/* approved answers from the directors' Bear Chat queue (Airtable: Bear Chat Answers, Status Approved) */
function loadNew(){
  fetch('inbox-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:OPT.pin, action:'bc_public', school:OPT.school})})
    .then(function(r){ return r.json(); }).then(function(j){
      var L = (j && j.answers) || []; if (!L.length) return;
      D.QS = D.QS.filter(function(e){ return !e.fromQueue; });
      L.forEach(function(x){ var q = [String(x.q)].concat(String(x.alt||'').split(/\n+/).map(function(t){ return t.trim(); }).filter(Boolean)).slice(0, 12);
        D.QS.push({id:'new-'+x.id, c:'New answers from your directors', q:q, k:'', a:String(x.a), fromQueue:true}); });
      build(); renderBrowse();
    }).catch(function(){});
}
function mount(el, opt){
  OPT = opt || {}; ROOT = el; build(); MISSED = [];
  try{ sessionStorage.removeItem('bcMissed'); }catch(e){} /* the old preview kept missed questions here; nothing is stored now */
  el.innerHTML = '<div class="bc-wrap">'
    + '<div class="bc-log" aria-live="polite"></div>'
    + '<div class="bc-privacy">🔒 This chat is private to you. It clears itself after 3 minutes without use, and nothing is saved on this device. <button type="button" class="bc-clear">Clear chat now</button></div>'
    + '<form class="bc-bar"><input class="bc-input" placeholder="Type or speak a question…" autocomplete="off" maxlength="300"><button type="button" class="bc-mic" title="Speak">🎤</button><button class="bc-go" type="submit">Ask</button></form>'
    + '<div class="bc-voice-note">Voice uses your browser\'s free voice typing (Google in Chrome, Apple in Safari). Best for school questions, not private details.</div>'
    + '<div class="bc-browse"></div><div class="bc-missed"></div></div>';
  el.querySelector('.bc-bar').onsubmit = function(ev){ ev.preventDefault(); var i = el.querySelector('.bc-input'); ask(i.value); i.value=''; };
  el.querySelector('.bc-clear').onclick = function(){ reset(); el.querySelector('.bc-input').focus(); };
  ['keydown','pointerdown','touchstart','input'].forEach(function(t){ el.addEventListener(t, poke, true); });
  if (!window.__bcHooks){ window.__bcHooks = 1;
    window.addEventListener('pagehide', function(){ reset(); });
    window.addEventListener('pageshow', function(ev){ if (ev.persisted) reset(); });
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') HIDDEN_AT = Date.now();
      else if (HIDDEN_AT && Date.now() - HIDDEN_AT > AWAY_MS) reset();
    });
  }
  renderBrowse(); renderMissed(); setupVoice(); loadNew(); loadPortal();
  greet();
}
function greet(){
  var sc = D.schools[OPT.school] || {};
  say('bot', 'Hi! I\'m Bear Chat 🐻 for '+(sc.name||OPT.school)+'. Ask me about closures, hours, fees, what to bring, sick days, pick-up, the menu, lessons, events, enrolling or Parent Orientation. If I don\'t know, I\'ll send your question to your director.',
    chips([{label:'Is the school open tomorrow?'},{label:'When is the next holiday?'},{label:"What's for lunch this week?"},{label:'What does my child need to bring?'}], function(it){ ask(it.label); }));
}
/* activity keeps the chat; 3 minutes without use clears it so the next family starts fresh */
function poke(){ clearTimeout(IDLE); IDLE = setTimeout(function(){ if (LOG.length || MISSED.length || ROOT.querySelector('.bc-me')) reset(); }, IDLE_MS); }
/* wipe everything this family typed or saw: the conversation, any half-filled message, voice, opened files */
function reset(){
  if (!ROOT) return;
  clearTimeout(IDLE); IDLE = null; HIDDEN_AT = 0;
  try{ if (REC) REC.abort(); }catch(e){} REC = null;
  BLOBS.forEach(function(u){ try{ URL.revokeObjectURL(u); }catch(e){} }); BLOBS = [];
  LOG = []; MISSED = [];
  var log = ROOT.querySelector('.bc-log'); if (log) log.innerHTML = '';
  var inp = ROOT.querySelector('.bc-input'); if (inp){ inp.value = ''; inp.blur(); }
  var mic = ROOT.querySelector('.bc-mic'); if (mic) mic.classList.remove('on');
  ROOT.querySelectorAll('.bc-browse details[open]').forEach(function(d){ d.open = false; });
  renderMissed(); greet();
}
window.BearChat = {mount:mount, reset:reset, match:function(t){ build(); return match(t); }, _test:{norm:norm, toks:toks, dayIn:dayIn, holidayIn:holidayIn, confident:confident, setSchool:function(s){ OPT.school = s; }, LIVE:LIVE, byId:byId}};
})();
