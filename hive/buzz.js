/* The Buzz Board — self-injecting add-on for The Hive teacher & director portals.
Loads after the portal's inline script, so it reuses the page's global api()/esc()/show().
Teacher portal: one 🐝 tab (both schools). Director portal: 🐝 Team Buzz + 👑 My Buzz Board (school-scoped by api.php).
v3: adds an All-Time Leaders board (never resets) and a 30-day history dropdown for the weekly chart. */
(function(){
var path = location.pathname.toLowerCase();
var isDir = path.indexOf('director.html') > -1;
var isTeach = path.indexOf('teacher.html') > -1;
if(!isDir && !isTeach) return;
var esc = window.esc || function(s){return (s==null?'':(''+s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};

var css = ''
+ '.bz-days{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:6px 0 10px;}'
+ '.bz-day{padding:7px 14px;border-radius:12px;font-weight:800;cursor:pointer;background:#fff;color:#9b8576;box-shadow:0 3px 10px rgba(74,58,48,.10);font-size:.82rem;text-align:center;}'
+ '.bz-day.on{background:linear-gradient(90deg,#ffb13d,#ff6b6b);color:#fff;}'
+ '.bz-day small{display:block;font-size:.66rem;font-weight:600;opacity:.85;}'
+ '.bz-school{font-weight:900;font-size:1rem;margin:16px 0 8px;padding:6px 14px;border-radius:12px;color:#fff;display:inline-block;background:#2fc4b2;}'
+ '.bz-wrap{background:#fff;border-radius:16px;padding:8px;box-shadow:0 6px 18px rgba(74,58,48,.10);overflow-x:auto;margin-bottom:6px;}'
+ '.bz-wrap table{border-collapse:collapse;width:100%;min-width:520px;}'
+ '.bz-wrap th,.bz-wrap td{padding:8px 5px;text-align:center;font-size:.8rem;}'
+ '.bz-wrap th.nm,.bz-wrap td.nm{text-align:left;font-weight:800;white-space:nowrap;padding-left:8px;min-width:110px;}'
+ '.bz-wrap thead th{color:#9b8576;font-size:.68rem;font-weight:800;border-bottom:2px solid #f0e2d4;line-height:1.15;}'
+ '.bz-wrap tbody tr{border-bottom:1px solid #f6ece0;}'
+ '.bz-dot{width:22px;height:22px;border-radius:50%;display:inline-block;line-height:22px;font-size:.75rem;color:#fff;}'
+ '.bz-g{background:#46c97f;} .bz-r{background:#ff6b6b;} .bz-p{background:#e7ddd0;color:#b9ab9a;} .bz-na{background:#f2ece3;color:#c9bcac;}'
+ '.bz-pts{font-weight:900;color:#9b6bff;}'
+ '.bz-lead{background:#fff;border-radius:16px;padding:12px 16px;box-shadow:0 6px 18px rgba(74,58,48,.10);}'
+ '.bz-lrow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f6ece0;}'
+ '.bz-lrow:last-child{border-bottom:none;} .bz-rank{font-weight:900;width:24px;color:#9b8576;} .bz-lnm{flex:1;font-weight:800;} .bz-lst{color:#ffb13d;font-weight:900;}'
+ '.bz-lnm-sc{font-weight:600;font-size:.7rem;color:#c9bcac;}'
+ '.bz-weekbar{text-align:center;margin-bottom:8px;}'
+ '.bz-weekbar label{font-size:.78rem;font-weight:800;color:#9b8576;margin-right:6px;}'
+ '.bz-weekbar select{padding:5px 10px;border-radius:10px;border:1px solid #f0e2d4;font-weight:700;color:#7a6a5c;background:#fff;}'
+ '.bz-hist-note{margin-bottom:8px;} .bz-hist-note .bz-back{cursor:pointer;text-decoration:underline;font-weight:800;}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

var DAYNAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
var TCOLS = [['Clock In','Clock In'],['Lunch Out','Lunch Out'],['Lunch In','Lunch In'],['Clock Out','Clock Out'],['Cleaning Chart','Cleaning Chart'],['Classroom ✓','Classroom Checklist']];
var DCOLS = [['Clock In','Clock In'],['Clock Out','Clock Out'],['Daily To-Dos','Daily To-Dos Complete'],['Facility Walk','Facility Walkthrough']];
var WCOLS = [['Tuition · Wed AM','Tuition Paid (Wed AM)'],['FTE Reports · Thu','FTE Reports (Thu)'],['Billing · Thu','Billing (Thu)']];
var bzDay = null;

function monday(){ var d=new Date(); var wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd); return d.toISOString().slice(0,10); }
function sel(v){ return v && v.name ? v.name : (v||''); }
function state(f,name,dateStr){ if(f[name]===true) return 'g'; var now=new Date(); var cutoff=new Date(dateStr+'T18:00:00'); var today=now.toISOString().slice(0,10); if(dateStr<today) return 'r'; if(dateStr===today && now>=cutoff) return 'r'; return 'p'; }
function dot(s){ var m={g:['bz-g','✓'],r:['bz-r','✕'],p:['bz-p','·'],na:['bz-na','–']}; var x=m[s]||m.p; return '<span class="bz-dot '+x[0]+'">'+x[1]+'</span>'; }
function todayName(){ var n=DAYNAMES[(new Date().getDay()+6)%7]; return DAYNAMES.indexOf(n)>-1?n:'Monday'; }
function fmtWeek(w){ if(!w) return ''; var d=new Date(w+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate(); }

function addTab(label, gradient, panelId, onshow){
var nav = document.querySelector('nav');
var t = document.createElement('div');
t.className = 'tab'; t.style.background = gradient; t.textContent = label;
t.onclick = function(){ if(window.show) show(panelId, t); else { document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('show');}); document.getElementById('p-'+panelId).classList.add('show'); document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');}); t.classList.add('active'); } onshow(); };
nav.appendChild(t);
}
function addPanel(panelId, inner){
var main = document.querySelector('main');
var p = document.createElement('div'); p.className='panel'; p.id='p-'+panelId; p.innerHTML=inner; main.appendChild(p); return p;
}
function daysBar(cb){ var mon=new Date(monday()+'T00:00:00'); return DAYNAMES.map(function(dn,i){ var dt=new Date(mon); dt.setDate(mon.getDate()+i); var md=(dt.getMonth()+1)+'/'+dt.getDate(); return '<div class="bz-day '+(dn===bzDay?'on':'')+'" data-d="'+dn+'">'+dn.slice(0,3)+'<small>'+md+'</small></div>'; }).join(''); }
function wireDays(container, cb){ container.querySelectorAll('.bz-day').forEach(function(el){ el.onclick=function(){ bzDay=el.getAttribute('data-d'); cb(); }; }); }

// ---------- TEACHER / TEAM BOARD ----------
var teamRecsAll=[];   // everything currently live in Buzz Board (bounded to ~30 days by the weekly archive-rollup)
var teamRecs=[];      // records for whichever week is currently being viewed (bzWeek)
var curWeekRecs=[];   // records for the real current week — always drives "This Week's Hive Leaders"
var bzWeek=null;      // the week ("Week Of" date) currently selected in the history dropdown

async function loadTeam(){
bzDay=todayName();
var mon=monday();
var d=await api({action:'list', table:'Buzz Board', maxRecords:300, sortField:'Date'});
teamRecsAll=((d&&d.records)||[]).map(function(r){return {f:r.fields};});
curWeekRecs=teamRecsAll.filter(function(r){return (sel(r.f['Week Of'])||'').slice(0,10)===mon;});
bzWeek=mon;
renderWeekPicker();
applyWeek();
loadAllTime();
}

function weekList(){ var seen={}; var out=[]; teamRecsAll.forEach(function(r){ var w=(sel(r.f['Week Of'])||'').slice(0,10); if(w && !seen[w]){ seen[w]=1; out.push(w); } }); return out.sort().reverse(); }

function renderWeekPicker(){
var wrap=document.getElementById('bztWeekWrap'); if(!wrap) return;
var wks=weekList(); var mon=monday();
if(wks.length<=1){ wrap.innerHTML=''; return; }
var opts=wks.map(function(w){ return '<option value="'+w+'"'+(w===bzWeek?' selected':'')+'>Week of '+fmtWeek(w)+(w===mon?' (this week)':'')+'</option>'; }).join('');
wrap.innerHTML='<label>📅 History:</label><select id="bztWeekSel">'+opts+'</select>';
document.getElementById('bztWeekSel').onchange=function(){ bzWeek=this.value; applyWeek(); };
}

function applyWeek(){ teamRecs=teamRecsAll.filter(function(r){return (sel(r.f['Week Of'])||'').slice(0,10)===bzWeek;}); renderTeam(); }

function renderTeam(){
var daysEl=document.getElementById('bztDays'); daysEl.innerHTML=daysBar(); wireDays(daysEl, renderTeam);
var rows=teamRecs.filter(function(r){return sel(r.f.Day)===bzDay;});
var schools=Array.from(new Set(rows.map(function(r){return sel(r.f.School);}))).sort();
var area=document.getElementById('bztArea'); var html='';
var mon=monday();
if(bzWeek && bzWeek!==mon){ html+='<div class="empty bz-hist-note">📅 Viewing history — week of '+fmtWeek(bzWeek)+'. <span class="bz-back" id="bztBackToNow">Back to this week</span></div>'; }
if(!rows.length){ html+='<div class="empty">No board for this day yet 🐝</div>'; }
else { schools.forEach(function(sc){
html+='<div class="bz-school">'+esc(sc)+'</div><div class="bz-wrap"><table><thead><tr><th class="nm">Teacher</th>'+TCOLS.map(function(c){return '<th>'+c[0]+'</th>';}).join('')+'<th>Points</th><th>⭐</th></tr></thead><tbody>';
rows.filter(function(r){return sel(r.f.School)===sc;}).sort(function(a,b){return (b.f.Points||0)-(a.f.Points||0)||sel(a.f.Staff).localeCompare(sel(b.f.Staff));}).forEach(function(r){ var f=r.f; var noLunch=f['No Lunch']===true; var ds=sel(f.Date);
html+='<tr><td class="nm">'+esc(sel(f.Staff))+'</td>'+TCOLS.map(function(c){ var isL=(c[1]==='Lunch Out'||c[1]==='Lunch In'); if(isL&&noLunch) return '<td>'+dot('na')+'</td>'; return '<td>'+dot(state(f,c[1],ds))+'</td>'; }).join('')+'<td class="bz-pts">'+(f.Points||0)+'/6</td><td>'+sel(f['Perfect Day'])+'</td></tr>'; });
html+='</tbody></table></div>'; });
}
area.innerHTML=html;
var backBtn=document.getElementById('bztBackToNow');
if(backBtn) backBtn.onclick=function(){ bzWeek=mon; var s=document.getElementById('bztWeekSel'); if(s) s.value=mon; applyWeek(); };

var tally={}; curWeekRecs.forEach(function(r){ var n=sel(r.f.Staff); if(!n)return; if(!tally[n])tally[n]={stars:0,pts:0}; if(sel(r.f['Perfect Day']))tally[n].stars++; tally[n].pts+=(r.f.Points||0); });
var arr=Object.keys(tally).map(function(n){return {n:n,stars:tally[n].stars,pts:tally[n].pts};}).sort(function(a,b){return b.pts-a.pts||b.stars-a.stars;}).slice(0,10);
var medal=['🥇','🥈','🥉'];
document.getElementById('bztLead').innerHTML=arr.length?arr.map(function(p,i){return '<div class="bz-lrow"><span class="bz-rank">'+(medal[i]||(i+1))+'</span><span class="bz-lnm">'+esc(p.n)+'</span><span class="bz-lst">'+p.pts+' done'+(p.stars?' · '+'⭐'.repeat(p.stars):'')+'</span></div>';}).join(''):'<div class="empty">Scores grow through the week 🌟</div>';
}

// All-Time Leaders — combines the archived "Buzz Board — All-Time" totals with whatever's still live
// (not yet archived) in Buzz Board, so it's always accurate and NEVER reset week to week.
async function loadAllTime(){
var el=document.getElementById('bztAllTime'); if(!el) return;
var d=await api({action:'list', table:'Buzz Board — All-Time', maxRecords:100});
var recs=((d&&d.records)||[]).map(function(r){return r.fields;});
var tally={};
recs.forEach(function(f){ var n=sel(f.Staff); if(!n)return; tally[n]=tally[n]||{pts:0,stars:0,school:sel(f.School)}; tally[n].pts+=(f['All-Time Points']||0); tally[n].stars+=(f['All-Time Perfect Days']||0); });
teamRecsAll.forEach(function(r){ var n=sel(r.f.Staff); if(!n)return; tally[n]=tally[n]||{pts:0,stars:0,school:sel(r.f.School)}; tally[n].pts+=(r.f.Points||0); if(sel(r.f['Perfect Day']))tally[n].stars++; });
var arr=Object.keys(tally).map(function(n){return {n:n,pts:tally[n].pts,stars:tally[n].stars,school:tally[n].school};}).sort(function(a,b){return b.pts-a.pts||b.stars-a.stars;}).slice(0,10);
var medal=['🥇','🥈','🥉'];
el.innerHTML=arr.length?arr.map(function(p,i){return '<div class="bz-lrow"><span class="bz-rank">'+(medal[i]||(i+1))+'</span><span class="bz-lnm">'+esc(p.n)+' <span class="bz-lnm-sc">('+esc(p.school)+')</span></span><span class="bz-lst">'+p.pts+' pts'+(p.stars?' · '+'⭐'.repeat(Math.min(p.stars,5))+(p.stars>5?' +'+(p.stars-5):''):'')+'</span></div>';}).join(''):'<div class="empty">All-time totals grow week by week 🏆</div>';
}

// ---------- DIRECTOR OWN BOARD ----------
async function loadDir(){ var mon=monday();
var res=await Promise.all([ api({action:'list', table:'Buzz Board — Directors', maxRecords:100, sortField:'Date'}), api({action:'list', table:'Buzz Board — Director Weekly', maxRecords:50, sortField:'Week Of'}) ]);
var daily=((res[0]&&res[0].records)||[]).map(function(r){return r.fields;}).filter(function(f){return (sel(f['Week Of'])||'').slice(0,10)===mon;});
var weekly=((res[1]&&res[1].records)||[]).map(function(r){return r.fields;}).filter(function(f){return (sel(f['Week Of'])||'').slice(0,10)===mon;});
var byDir={}; daily.forEach(function(f){ var n=sel(f.Director); (byDir[n]=byDir[n]||[]).push(f); });
var html='';
Object.keys(byDir).forEach(function(dir){
html+='<div class="bz-school" style="background:#9b6bff">👑 '+esc(dir)+' — Daily</div><div class="bz-wrap"><table><thead><tr><th class="nm">Day</th>'+DCOLS.map(function(c){return '<th>'+c[0]+'</th>';}).join('')+'<th>Points</th><th>⭐</th></tr></thead><tbody>';
var byDay={}; byDir[dir].forEach(function(f){ byDay[sel(f.Day)]=f; });
DAYNAMES.forEach(function(dn){ var f=byDay[dn]; if(!f){ html+='<tr><td class="nm">'+dn.slice(0,3)+'</td>'+DCOLS.map(function(){return '<td>'+dot('p')+'</td>';}).join('')+'<td class="bz-pts">0/4</td><td></td></tr>'; return; } var ds=sel(f.Date);
html+='<tr><td class="nm">'+dn.slice(0,3)+'</td>'+DCOLS.map(function(c){return '<td>'+dot(state(f,c[1],ds))+'</td>';}).join('')+'<td class="bz-pts">'+(f.Points||0)+'/4</td><td>'+sel(f['Perfect Day'])+'</td></tr>'; });
html+='</tbody></table></div>';
});
html+='<div class="bz-school" style="background:#ffb13d">🗓️ Weekly Duties</div><div class="bz-wrap"><table><thead><tr><th class="nm">Director</th>'+WCOLS.map(function(c){return '<th>'+c[0]+'</th>';}).join('')+'<th>Points</th><th>⭐</th></tr></thead><tbody>';
if(!weekly.length){ html+='<tr><td class="nm">This week</td>'+WCOLS.map(function(){return '<td>'+dot('p')+'</td>';}).join('')+'<td class="bz-pts">0/3</td><td></td></tr>'; }
weekly.forEach(function(f){ html+='<tr><td class="nm">'+esc(sel(f.Director))+'</td>'+WCOLS.map(function(c){return '<td>'+dot(f[c[1]]===true?'g':'p')+'</td>';}).join('')+'<td class="bz-pts">'+(f.Points||0)+'/3</td><td>'+sel(f['Perfect Week'])+'</td></tr>'; });
html+='</tbody></table></div>';
document.getElementById('bzdArea').innerHTML=html;
}

// ---------- BUILD UI ----------
function boot(){
if(!document.querySelector('nav') || !document.querySelector('main')) { return setTimeout(boot, 300); }
if(isTeach){
addPanel('buzz', '<div class="step">🐝 The Buzz Board — see who\'s filling their hive this week! 💛</div><div class="bz-weekbar" id="bztWeekWrap"></div><div class="bz-days" id="bztDays"></div><div id="bztArea" class="empty">Loading the hive… 🐝</div><div class="step" style="margin-top:20px">🏆 This Week\'s Hive Leaders</div><div class="bz-lead" id="bztLead"></div><div class="step" style="margin-top:20px">👑 All-Time Hive Leaders</div><div class="bz-lead" id="bztAllTime"></div>');
addTab('🐝 The Buzz Board', 'linear-gradient(90deg,#ffb13d,#ff6b6b)', 'buzz', loadTeam);
} else {
addPanel('buzzt', '<div class="banner">🐝 The Buzz Board — your team\'s week at a glance. Green fills in as they clock in/out and finish their charts. Cheer them on! 💛</div><div class="bz-weekbar" id="bztWeekWrap"></div><div class="bz-days" id="bztDays"></div><div id="bztArea" class="empty">Loading the hive… 🐝</div><div class="sect">🏆 This Week\'s Hive Leaders</div><div class="bz-lead" id="bztLead"></div><div class="sect">👑 All-Time Hive Leaders</div><div class="bz-lead" id="bztAllTime"></div>');
addPanel('buzzd', '<div class="banner">👑 Your Buzz Board — your daily wins and your weekly duties (tuition by Wed, FTE + billing Thu). Lead by example! 💛</div><div id="bzdArea" class="empty">Loading your board… 🐝</div>');
addTab('🐝 Team Buzz', 'linear-gradient(90deg,#ffb13d,#ff6b6b)', 'buzzt', loadTeam);
addTab('👑 My Buzz Board', 'linear-gradient(90deg,#c95ab0,#9b6bff)', 'buzzd', loadDir);
}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
