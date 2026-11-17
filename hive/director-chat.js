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
  if (!e){ m = match(text); if (confident(m)) e = m[0].x.e; }
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
  var d = say('bot', answerText(e, text)), ex = [];
  (e.go ? [e.go] : []).concat(e.also || []).forEach(function(g){ ex.push({label:goLabel(g), go:g}); });
  ex.push({label:'👍 That helped', ok:1});
  ex.push({label:'Not what I asked', no:1});
  d.appendChild(chips(ex, function(it){
    if (it.go){ openCard(it.go); return; }
    if (it.ok){ say('bot', 'Glad to help! 🐝'); return; }
    if (it.no){ MISSED.push({q:text, wrong:e.id}); renderMissed(); handoff(text); }
  }));
  ROOT.querySelector('.bc-log').scrollTop = 1e9;
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
  LOG = []; MISSED = [];
  var log = ROOT.querySelector('.bc-log'); if (log) log.innerHTML = '';
  var inp = ROOT.querySelector('.bc-input'); if (inp){ inp.value = ''; inp.blur(); }
  var mic = ROOT.querySelector('.bc-mic'); if (mic) mic.classList.remove('on');
  ROOT.querySelectorAll('.bc-browse details[open]').forEach(function(d){ d.open = false; });
  renderMissed(); greet();
}
window.DirectorChat = {mount:mount, reset:reset, match:function(t){ build(); return match(t); }, _test:{norm:norm, toks:toks, confident:confident, setSchool:function(s){ OPT.school = s; build(); }, LIVE:LIVE, byId:byId, answerText:answerText}};
})();
