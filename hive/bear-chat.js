/* Bear Chat: a free question bank for the Parent Portal.
   Matches a typed or spoken question to the bank in bear-chat-data.js and answers from portal content.
   Anything it can't match goes to the family's school director as a regular Parent Message.
   BearChat.mount(el, {school, pin, mode}) where mode is 'preview' (nothing is sent) or 'live'. */
(function(){
var D = window.BC_DATA, OPT = {}, ROOT = null, LOG = [], MISSED = [];
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
var STOP = ('a an the is are am be been do does did i me my we our you your it its to of in on at for and or can could would will '
  + 'what whats when where who how why there this that these those with have has had get got please hi hello hey just about any '
  + 'if so up as by from was were need want know tell let us im ill dont cant should child like').split(' ');
var STOPSET = {}; STOP.forEach(function(w){ STOPSET[w]=1; });
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
    if (hol && id==='open-holiday') r.s += 6;
    if (day && hasOpen){ if (day.kind==='today' && id==='open-today') r.s += 6; if (day.kind==='tomorrow' && id==='open-tomorrow') r.s += 6; if ((day.kind==='weekday'||day.kind==='date'||day.kind==='nextweek') && id==='open-date') r.s += 6; }
  });
  scores.sort(function(a,b){ return b.s - a.s; });
  return scores.filter(function(r){ return r.s > 0; }).slice(0, 4);
}
function confident(m){ if (!m.length) return false; var a = m[0].s, b = m.length > 1 ? m[1].s : 0; return a >= 7 || (a >= 1.5 && a >= b * 1.3); }

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
  hours: function(){
    var p = todayParts(), dt = todayUTC(), wd = dt.getUTCDay(), c = closureOn(dt), mins = p.hh*60 + p.mm;
    var s = 'We are open Monday through Friday, 6:30 AM to 5:30 PM. Children must be picked up by closing time.';
    var openNow = wd>0 && wd<6 && mins >= 390 && mins < (c && c[2]==='early' ? 1020 : 1050) && !(c && c[2]==='all');
    return s + (openNow ? ' We are open right now.' : ' We are closed right now.');
  }
};
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
        var ext = (it.file.split('.').pop()||'').toLowerCase(), u = URL.createObjectURL(new Blob([u8],{type: ext==='pdf'?'application/pdf':(ext==='png'?'image/png':'image/jpeg')}));
        return {html: 'Here is '+(it.month && it.month!==j.month ? 'the most recent ' : 'this month\'s ')+esc(e.doc)+': '+link(u, 'Open the '+(it.title||e.doc))};
      });
    });
  },
  forms: function(){ return auto().then(function(a){ if (!a.forms.length) return 'No food program forms are posted yet.'; return {html: 'Food Program forms (print, fill out and return to the office):<br>'+a.forms.slice(0,10).map(function(f){ return '• '+link(f.link, f.doc); }).join('<br>')}; }); },
  lessons: function(){ return auto().then(function(a){ if (!a.lessons.length) return 'The '+a.monthName+' lesson plans are not posted yet. Please check back soon.'; return {html: a.monthName+' lesson plans. Pick your child\'s age group:<br>'+a.lessons.map(function(x){ return '• '+link(x.link, x.age||x.plan); }).join('<br>')}; }); },
  weekly: function(e){ return auto().then(function(a){ var dt = function(w){ var t = Date.parse(String(w.title||'').split('—').pop()); return isNaN(t) ? 0 : t; }, W = (a.weekly||[]).filter(function(w){ return w.kind===e.kind; }).sort(function(x,y){ return dt(y)-dt(x); });
    if (!W.length) return 'This week\'s '+e.kind+' isn\'t posted yet. Check the '+e.go+' card soon.';
    var w = W[0], lines = String(w.body||'').split(/\n+/).map(function(s){ return s.replace(/^\s*[-•*]\s*/,'').trim(); }).filter(Boolean).slice(0,6);
    return {html:'<b>'+esc(w.title||e.kind)+'</b><br>'+lines.map(function(l){ return '• '+esc(l); }).join('<br>')}; }); },
  events: function(){ return filesApi('pp_ev_list').then(function(r){ var E = (r && r.events) || [];
    if (!E.length) return 'No events need sign-ups right now. Check the Events card and the newsletter for dates.';
    return {html:'Coming up:<br>'+E.slice(0,5).map(function(ev){ var d = ''; try{ d = new Date(ev.when+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); }catch(x){ d = ev.when; } return '• <b>'+esc(ev.title)+'</b>, '+esc(d); }).join('<br>')+'<br>To sign up to bring something, open the Events and Sign-Ups card.'}; }); },
  monthDates: function(){ return auto().then(function(a){ var d = (a.newsletter && a.newsletter.form && a.newsletter.form.dates) || [];
    if (!d.length) return 'No special dates are listed for '+a.monthName+'. The Newsletter card has the full month.';
    return {html:'Important dates in '+esc(a.monthName)+':<br>'+d.map(function(x){ return '• <b>'+esc(x[0])+'</b>: '+esc(x[1]); }).join('<br>')}; }); },
  board: function(){ return ppList().then(function(j){ var B = j.board || [];
    if (!B.length) return 'There are no new messages on the Message Board right now.';
    return {html: B.slice(0,3).map(function(b){ return '• <b>'+esc(b.title)+'</b>: '+esc(String(b.message||'').slice(0,220)); }).join('<br>')}; }); },
  resources: function(){ return hiveApi({action:'list', table:'Resource Links', maxRecords:200, sortField:'Order', asParent:true}).then(function(d){
    var R = (d.records||[]).map(function(r){ return r.fields; }).filter(function(r){ var sc = (r.School&&r.School.name)||r.School||'Both'; return (sc==='Both'||sc===OPT.school) && r.URL && r.URL.charAt(0)!=='#'; });
    var M = R.filter(function(r){ return /handbook|registr|enroll|packet|form|document/i.test((r.Title||'')+' '+((r.Section&&r.Section.name)||r.Section||'')); });
    var L = (M.length ? M : R).slice(0, 8);
    if (!L.length) return 'The handbook and registration documents are on the Documents and Registration card.';
    return {html:'From the Documents and Registration card:<br>'+L.map(function(r){ return '• '+link(r.URL, r.Title); }).join('<br>')}; }); }
};

/* ---------- answering ---------- */
function fill(s){ var sc = D.schools[OPT.school] || {}; return String(s).replace(/\{(\w+)\}/g, function(_, k){ return sc[k] || (k==='school' ? OPT.school : ''); }); }
function answer(e, text){
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
    MISSED.push({q:text, at:new Date().toISOString()}); saveMissed();
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
    if (e.go) ex.push({label:'Open '+e.go+' in the portal', go:e.go});
    if (e.handoff) ex.push({label:'💬 Send this to the director', h:e.handoff});
    ex.push({label:'👍 That helped', ok:1});
    ex.push({label:'Not what I asked', no:1});
    wait.appendChild(chips(ex, function(it){
      if (it.go){ window.open('parent.html','_blank'); return; }
      if (it.h){ handoff(text, it.h); return; }
      if (it.ok){ say('bot', 'Glad to help! 🐝'); return; }
      if (it.no){ MISSED.push({q:text, at:new Date().toISOString(), wrong:e.id}); saveMissed(); renderMissed(); handoff(text, 'Question from Bear Chat'); }
    }));
    ROOT.querySelector('.bc-log').scrollTop = 1e9;
  });
}
function handoff(question, type){
  var f = document.createElement('form'); f.className = 'bc-form';
  f.innerHTML = '<label>Your name<input name="n" required maxlength="80"></label>'
    + '<label>Phone or email (so the director can reply)<input name="c" maxlength="120"></label>'
    + '<label>Your message<textarea name="m" required maxlength="1500"></textarea></label>'
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

/* ---------- questions it couldn't answer (this device only, for the preview) ---------- */
function saveMissed(){ try{ sessionStorage.setItem('bcMissed', JSON.stringify(MISSED.slice(-50))); }catch(e){} }
function renderMissed(){
  var el = ROOT.querySelector('.bc-missed'); if (!el) return;
  if (!MISSED.length){ el.innerHTML = ''; return; }
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
    if (on && rec){ rec.stop(); return; }
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
    var inp = ROOT.querySelector('.bc-input'), finalText = '';
    rec.onresult = function(ev){ var t = ''; for (var i=0;i<ev.results.length;i++){ t += ev.results[i][0].transcript; if (ev.results[i].isFinal) finalText = t; } inp.value = t; };
    rec.onend = function(){ on = false; btn.classList.remove('on'); if (finalText.trim()){ ask(finalText); inp.value = ''; } };
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
  OPT = opt || {}; ROOT = el; build();
  try{ MISSED = JSON.parse(sessionStorage.getItem('bcMissed')||'[]'); }catch(e){ MISSED = []; }
  el.innerHTML = '<div class="bc-wrap">'
    + '<div class="bc-log"></div>'
    + '<form class="bc-bar"><input class="bc-input" placeholder="Type or speak a question…" autocomplete="off" maxlength="300"><button type="button" class="bc-mic" title="Speak">🎤</button><button class="bc-go" type="submit">Ask</button></form>'
    + '<div class="bc-voice-note">Voice uses your browser\'s free voice typing (Google in Chrome, Apple in Safari). Best for school questions, not private details.</div>'
    + '<div class="bc-browse"></div><div class="bc-missed"></div></div>';
  el.querySelector('.bc-bar').onsubmit = function(ev){ ev.preventDefault(); var i = el.querySelector('.bc-input'); ask(i.value); i.value=''; };
  renderBrowse(); renderMissed(); setupVoice(); loadNew();
  var sc = D.schools[OPT.school] || {};
  say('bot', 'Hi! I\'m Bear Chat 🐻 for '+(sc.name||OPT.school)+'. Ask me about closures, hours, fees, what to bring, sick days, pick-up, the menu, lessons or events. If I don\'t know, I\'ll send your question to your director.',
    chips([{label:'Is the school open tomorrow?'},{label:'When is the next holiday?'},{label:"What's for lunch this week?"},{label:'What does my child need to bring?'}], function(it){ ask(it.label); }));
}
window.BearChat = {mount:mount, match:function(t){ build(); return match(t); }, _test:{norm:norm, toks:toks, dayIn:dayIn, holidayIn:holidayIn, confident:confident, setSchool:function(s){ OPT.school = s; }, LIVE:LIVE, byId:byId}};
})();
