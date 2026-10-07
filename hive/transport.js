/* 🚌 Transportation Log — self-injecting add-on for The Hive teacher & director portals (built 10/6/26).
Same pattern as buzz.js: loads after the page's inline script and reuses api()/esc()/show().
One shared tab on BOTH portals. Data lives in Airtable "Transportation Trips" + "Transportation Riders".
Flow per trip: Start (departure location + time) → riders IN → Arrive (arrival time) → riders OUT →
Driver signs (name + DATE only) → 2nd staff confirms the visual sweep + signs (name + DATE only) → Complete.
Rules from Mrs. Bear: signatures carry the date only (no timestamps); departure location is always Kid City.
Week-at-a-glance grid, any past day can be opened and back-filled.
v2 (10/7/26): AM run = Kid City → school; PM run = school → Kid City (departure/arrival swap). Signatures print with DATE only on the paper log. */
(function(){
var path = location.pathname.toLowerCase();
var isDir = path.indexOf('director.html') > -1;
var isTeach = path.indexOf('teacher.html') > -1;
if(!isDir && !isTeach) return;
var esc = window.esc || function(s){return (s==null?'':(''+s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};

var css = ''
+ '.tr-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin:4px 0 10px;}'
+ '.tr-wk{display:flex;align-items:center;gap:8px;font-weight:900;color:#7a6a5c;}'
+ '.tr-wk button{border:none;background:#fff;border-radius:10px;padding:6px 12px;font-weight:900;cursor:pointer;box-shadow:0 3px 10px rgba(74,58,48,.10);color:#7a6a5c;}'
+ '.tr-sel{padding:7px 10px;border-radius:10px;border:1px solid #f0e2d4;font-weight:700;color:#7a6a5c;background:#fff;}'
+ '.tr-wrap{background:#fff;border-radius:16px;padding:8px;box-shadow:0 6px 18px rgba(74,58,48,.10);overflow-x:auto;margin-bottom:12px;}'
+ '.tr-wrap table{border-collapse:collapse;width:100%;min-width:560px;}'
+ '.tr-wrap th,.tr-wrap td{padding:7px 4px;text-align:center;font-size:.78rem;}'
+ '.tr-wrap th.nm,.tr-wrap td.nm{text-align:left;font-weight:800;white-space:nowrap;padding-left:8px;min-width:150px;}'
+ '.tr-wrap thead th{color:#9b8576;font-size:.68rem;font-weight:800;border-bottom:2px solid #f0e2d4;line-height:1.15;}'
+ '.tr-wrap tbody tr{border-bottom:1px solid #f6ece0;}'
+ '.tr-cell{display:inline-block;min-width:52px;padding:6px 6px;border-radius:10px;font-weight:900;font-size:.72rem;cursor:pointer;color:#fff;}'
+ '.tr-none{background:#f2ece3;color:#b9ab9a;} .tr-started{background:#ffb13d;} .tr-arrived{background:#ff9b4a;} .tr-await{background:#9b6bff;} .tr-done{background:#46c97f;} .tr-today{outline:2px dashed #ffb13d;outline-offset:2px;}'
+ '.tr-legend{font-size:.72rem;color:#9b8576;margin:0 0 10px;} .tr-legend span{display:inline-block;width:12px;height:12px;border-radius:4px;vertical-align:middle;margin:0 4px 0 10px;}'
+ '.tr-card{background:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 6px 18px rgba(74,58,48,.10);margin-bottom:12px;}'
+ '.tr-h{font-weight:900;font-size:1.05rem;margin-bottom:6px;color:#4a3a30;} .tr-sub{font-size:.8rem;color:#9b8576;margin-bottom:10px;}'
+ '.tr-row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;} .tr-row>div{flex:1;min-width:140px;}'
+ '.tr-lbl{display:block;font-size:.7rem;font-weight:800;color:#9b8576;margin-bottom:3px;}'
+ '.tr-inp{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:10px;border:1px solid #f0e2d4;font-weight:700;color:#4a3a30;background:#fff;font-size:.9rem;}'
+ '.tr-btn{border:none;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer;color:#fff;background:linear-gradient(90deg,#ffb13d,#ff6b6b);box-shadow:0 4px 12px rgba(255,107,107,.25);font-size:.9rem;}'
+ '.tr-btn.sec{background:#fff;color:#7a6a5c;box-shadow:0 3px 10px rgba(74,58,48,.10);} .tr-btn.grn{background:linear-gradient(90deg,#46c97f,#2fc4b2);} .tr-btn.pur{background:linear-gradient(90deg,#c95ab0,#9b6bff);}'
+ '.tr-btn:disabled{opacity:.45;cursor:default;}'
+ '.tr-step{display:flex;align-items:center;gap:8px;font-weight:900;color:#7a6a5c;margin:14px 0 6px;font-size:.85rem;} .tr-step b{display:inline-block;width:22px;height:22px;border-radius:50%;background:#ffb13d;color:#fff;text-align:center;line-height:22px;font-size:.72rem;} .tr-step.ok b{background:#46c97f;}'
+ '.tr-riders{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:6px 0;}'
+ '.tr-rider{display:flex;align-items:center;justify-content:space-between;background:#fbf7f2;border-radius:12px;padding:8px 10px;font-weight:800;font-size:.85rem;color:#4a3a30;}'
+ '.tr-tog{border:none;border-radius:10px;padding:6px 10px;font-weight:900;cursor:pointer;font-size:.72rem;background:#e7ddd0;color:#9b8576;min-width:44px;} .tr-tog.on{background:#46c97f;color:#fff;}'
+ '.tr-sig{background:#fbf7f2;border-radius:12px;padding:10px 12px;margin-top:6px;} .tr-sigok{color:#2a9d5c;font-weight:900;}'
+ '.tr-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#4a3a30;color:#fff;padding:10px 18px;border-radius:14px;font-weight:800;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);}'
+ '.tr-back{cursor:pointer;font-weight:900;color:#9b6bff;margin-bottom:8px;display:inline-block;}'
+ '.tr-warn{background:#fff3e0;border-radius:12px;padding:8px 12px;font-size:.8rem;color:#8a5a1a;font-weight:700;margin:8px 0;}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

var DAYS = ['Mon','Tue','Wed','Thu','Fri'];
var RUNS = ['AM','PM'];
var TRIPS = 'Transportation Trips', RIDERS = 'Transportation Riders';

function ymd(d){var m=d.getMonth()+1,dd=d.getDate();return d.getFullYear()+'-'+(m<10?'0'+m:m)+'-'+(dd<10?'0'+dd:dd);}
function today(){ return ymd(new Date()); }
function mondayOf(d){ var x=new Date(d.getTime()); var wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ var x=new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }
function md(d){ return (d.getMonth()+1)+'/'+d.getDate(); }
function nowHM(){ var d=new Date(); var h=d.getHours(), m=d.getMinutes(); var ap=h>=12?'PM':'AM'; h=h%12; if(h===0)h=12; return h+':'+(m<10?'0'+m:m)+' '+ap; }
function sel(v){ return v && v.name ? v.name : (v||''); }
function toast(msg){ var t=document.createElement('div'); t.className='tr-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2600); }
function lines(s){ return (s||'').split('\n').map(function(x){return x.trim();}).filter(Boolean); }
function statusClass(f){ if(!f) return 'tr-none'; var s=sel(f.Status); if(s==='Complete') return 'tr-done'; if(s==='Awaiting 2nd Signature') return 'tr-await'; if(s==='Arrived') return 'tr-arrived'; return 'tr-started'; }
function statusShort(f){ if(!f) return '—'; var s=sel(f.Status); return s==='Complete'?'✓':(s==='Awaiting 2nd Signature'?'2nd?':(s==='Arrived'?'Arr':'Go')); }

// ---------- state ----------
var weekMon = mondayOf(new Date());
var school = null;           // 'Sanford' | 'DeLand 2'
var roleName = isDir ? 'director' : 'teacher';
var riders = [];             // {id, f}
var trips = [];              // {id, f} for the visible week
var dests = [];              // distinct destinations for this school
var open = null;             // {date, dest, run, rec}

function kidCity(){ return 'Kid City USA '+(school||''); }
function fromLoc(dest,run){ return run==='PM' ? dest : kidCity(); }
function toLoc(dest,run){ return run==='PM' ? kidCity() : dest; }
function mySchool(){
if(isDir) return window.SCHOOL || null;
return localStorage.getItem('hiveSchool') || null;
}
function myName(){ return localStorage.getItem('hiveName') || ''; }

// ---------- data ----------
async function loadRiders(){
var d=await api({action:'list', table:RIDERS, maxRecords:200, sortField:'Child'});
riders=((d&&d.records)||[]).map(function(r){return {id:r.id,f:r.fields};}).filter(function(r){ var s=sel(r.f.School); return r.f.Active!==false && (s===school||s==='Both'); });
var seen={}; dests=[]; riders.forEach(function(r){ var dn=sel(r.f.Destination); if(dn&&!seen[dn]){seen[dn]=1;dests.push(dn);} }); dests.sort();
}
async function loadTrips(){
var a=ymd(weekMon), b=ymd(addDays(weekMon,4));
var formula="AND(IS_AFTER({Date},DATEADD('"+a+"',-1,'days')),IS_BEFORE({Date},DATEADD('"+b+"',1,'days')),{School}='"+school+"')";
var d=await api({action:'list', table:TRIPS, maxRecords:200, filterByFormula:formula, sortField:'Date'});
trips=((d&&d.records)||[]).map(function(r){return {id:r.id,f:r.fields};});
}
function findTrip(date,dest,run){ for(var i=0;i<trips.length;i++){ var f=trips[i].f; if(sel(f.Date)===date && sel(f.Destination)===dest && sel(f.Run)===run) return trips[i]; } return null; }
function ridersFor(dest,run){ return riders.filter(function(r){ return sel(r.f.Destination)===dest && (run==='AM'?r.f.AM===true:r.f.PM===true); }).map(function(r){return sel(r.f.Child);}); }

// ---------- render: week grid ----------
function renderGrid(){
var area=document.getElementById('trArea'); if(!area) return;
if(!school){ area.innerHTML='<div class="tr-warn">Pick your school above to see the bus log.</div>'; return; }
var t=today();
var html='<div class="tr-top"><div class="tr-wk"><button id="trPrev">‹</button><span>Week of '+md(weekMon)+' – '+md(addDays(weekMon,4))+'</span><button id="trNext">›</button><button id="trNow" class="sec" style="font-size:.75rem">This week</button></div>'
+ '<button class="tr-btn" id="trNew" style="font-size:.8rem">+ Start a trip</button></div>';
html+='<div class="tr-legend">Tap any box to open that trip (past days too).<span class="tr-done"></span>Complete<span class="tr-await"></span>Needs 2nd signature<span class="tr-arrived"></span>Arrived<span class="tr-started"></span>On the road<span class="tr-none"></span>Not logged</div>';
if(!dests.length){ html+='<div class="tr-warn">No riders set up for '+esc(school)+' yet — ask Mrs. Bear to add the rider list.</div>'; }
else{
html+='<div class="tr-wrap"><table><thead><tr><th class="nm">School → Run</th>'+DAYS.map(function(dn,i){ var d=addDays(weekMon,i); return '<th>'+dn+'<br><span style="font-weight:600">'+md(d)+'</span></th>'; }).join('')+'</tr></thead><tbody>';
dests.forEach(function(dest){ RUNS.forEach(function(run){
html+='<tr><td class="nm">'+esc(dest.replace(' Elementary',''))+' <span style="color:#9b8576;font-weight:700">· '+run+'</span></td>';
DAYS.forEach(function(dn,i){ var date=ymd(addDays(weekMon,i)); var tr=findTrip(date,dest,run); var cls=statusClass(tr&&tr.f)+(date===t?' tr-today':'');
html+='<td><span class="tr-cell '+cls+'" data-date="'+date+'" data-dest="'+esc(dest)+'" data-run="'+run+'">'+statusShort(tr&&tr.f)+'</span></td>'; });
html+='</tr>'; }); });
html+='</tbody></table></div>';
}
area.innerHTML=html;
document.getElementById('trPrev').onclick=function(){ weekMon=addDays(weekMon,-7); refresh(); };
document.getElementById('trNext').onclick=function(){ weekMon=addDays(weekMon,7); refresh(); };
document.getElementById('trNow').onclick=function(){ weekMon=mondayOf(new Date()); refresh(); };
document.getElementById('trNew').onclick=function(){ var d=new Date(); var run=d.getHours()<12?'AM':'PM'; var dest=dests[0]; if(!dest){toast('No riders set up yet'); return;} openTrip(today(),dest,run); };
area.querySelectorAll('.tr-cell').forEach(function(el){ el.onclick=function(){ openTrip(el.getAttribute('data-date'),el.getAttribute('data-dest'),el.getAttribute('data-run')); }; });
}

// ---------- render: one trip ----------
function openTrip(date,dest,run){ open={date:date,dest:dest,run:run,rec:findTrip(date,dest,run)}; renderTrip(); }
function closeTrip(){ open=null; refresh(); }

function renderTrip(){
var area=document.getElementById('trArea'); var o=open; var f=o.rec?o.rec.f:null; var t=today();
var isPast=o.date<t, isToday=o.date===t;
var dd=new Date(o.date+'T00:00:00'); var nice=DAYS[(dd.getDay()+6)%7]+' '+md(dd);
var status=f?sel(f.Status):'';
var roster=ridersFor(o.dest,o.run); var inL=f?lines(f['Riders In']):[]; var outL=f?lines(f['Riders Out']):[];
// riders already marked but not on the roster (one-offs) still show
inL.concat(outL).forEach(function(n){ if(roster.indexOf(n)<0) roster.push(n); });
var html='<span class="tr-back" id="trBack">‹ Back to the week</span>';
html+='<div class="tr-card"><div class="tr-h">🚌 '+esc(o.dest)+' · '+o.run+' run · '+nice+'</div><div class="tr-sub">'+esc(fromLoc(o.dest,o.run))+' → '+esc(toLoc(o.dest,o.run))+(isPast?' · <b style="color:#c97a1a">Back-filling a past day — enter the times as they happened.</b>':'')+'</div>';

// STEP 1 — Depart
var s1ok=!!f;
html+='<div class="tr-step'+(s1ok?' ok':'')+'"><b>1</b> Depart</div>';
if(!f){
html+='<div class="tr-row"><div><span class="tr-lbl">Departure location</span><input class="tr-inp" id="trDepLoc" value="'+esc(fromLoc(o.dest,o.run))+'"></div><div><span class="tr-lbl">Departure time</span><input class="tr-inp" id="trDepTime" value="'+(isToday?nowHM():'')+'" placeholder="7:05 AM"></div><div><span class="tr-lbl">Destination</span><select class="tr-inp" id="trDest">'+dests.map(function(x){return '<option'+(x===o.dest?' selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select></div><div><span class="tr-lbl">Run</span><select class="tr-inp" id="trRun"><option'+(o.run==='AM'?' selected':'')+'>AM</option><option'+(o.run==='PM'?' selected':'')+'>PM</option></select></div></div>';
html+='<button class="tr-btn" id="trStart">Start trip →</button>';
} else {
html+='<div class="tr-row"><div><span class="tr-lbl">Departure location</span><input class="tr-inp" id="trDepLoc" value="'+esc(f['Departure Location']||'')+'"></div><div><span class="tr-lbl">Departure time</span><input class="tr-inp" id="trDepTime" value="'+esc(f['Departure Time']||'')+'" placeholder="7:05 AM"></div></div>';
}

if(f){
// STEP 2 — Riders IN
html+='<div class="tr-step'+(inL.length?' ok':'')+'"><b>2</b> Riders on the bus (tap IN as each child boards)</div><div class="tr-riders">'+roster.map(function(n){ var on=inL.indexOf(n)>-1; return '<div class="tr-rider"><span>'+esc(n)+'</span><button class="tr-tog'+(on?' on':'')+'" data-k="in" data-n="'+esc(n)+'">'+(on?'IN ✓':'IN')+'</button></div>'; }).join('')+'</div>';
html+='<div class="tr-row"><div><input class="tr-inp" id="trExtra" placeholder="Add a rider not on the list (First L.)"></div><div style="flex:0"><button class="tr-btn sec" id="trAddExtra">Add</button></div></div>';
// STEP 3 — Arrive
var arrived=!!(f['Arrival Time']);
html+='<div class="tr-step'+(arrived?' ok':'')+'"><b>3</b> Arrive at '+esc(toLoc(o.dest,o.run))+'</div>';
html+='<div class="tr-row"><div><span class="tr-lbl">Arrival time</span><input class="tr-inp" id="trArrTime" value="'+esc(f['Arrival Time']||'')+'" placeholder="7:35 AM"></div><div style="flex:0;align-self:flex-end"><button class="tr-btn grn" id="trArrive">'+(arrived?'Update':'Mark arrived (now)')+'</button></div></div>';
// STEP 4 — Riders OUT
html+='<div class="tr-step'+(outL.length&&outL.length>=inL.length?' ok':'')+'"><b>4</b> Riders off the bus (tap OUT as each child exits)</div><div class="tr-riders">'+roster.map(function(n){ var on=outL.indexOf(n)>-1; var was=inL.indexOf(n)>-1; return '<div class="tr-rider" style="'+(was?'':'opacity:.45')+'"><span>'+esc(n)+'</span><button class="tr-tog'+(on?' on':'')+'" data-k="out" data-n="'+esc(n)+'">'+(on?'OUT ✓':'OUT')+'</button></div>'; }).join('')+'</div>';
var missing=inL.filter(function(n){return outL.indexOf(n)<0;});
if(inL.length && missing.length) html+='<div class="tr-warn">Still on the bus: '+esc(missing.join(', '))+'</div>';
// STEP 5 — Driver signature
var dSigned=!!(f['Driver Name']&&f['Driver Date']);
html+='<div class="tr-step'+(dSigned?' ok':'')+'"><b>5</b> Driver — visual sweep done, sign</div><div class="tr-sig">';
if(dSigned) html+='<div class="tr-sigok">✓ '+esc(f['Driver Name'])+' · '+esc(sel(f['Driver Date']))+'</div>';
else html+='<div class="tr-row"><div><span class="tr-lbl">Driver name</span><input class="tr-inp" id="trDrvName" value="'+esc(myName())+'"></div><div><span class="tr-lbl">Date</span><input class="tr-inp" id="trDrvDate" type="date" value="'+o.date+'"></div><div style="flex:0;align-self:flex-end"><button class="tr-btn" id="trDrvSign">Sign as driver</button></div></div><div class="tr-sub" style="margin:6px 0 0">By signing: all rows, seats and under seats were physically inspected and all children exited the vehicle.</div>';
html+='</div>';
// STEP 6 — 2nd staff signature
var sSigned=!!(f['Second Staff Name']&&f['Second Staff Date']);
html+='<div class="tr-step'+(sSigned?' ok':'')+'"><b>6</b> 2nd staff — visual sweep done, sign</div><div class="tr-sig">';
if(sSigned) html+='<div class="tr-sigok">✓ '+esc(f['Second Staff Name'])+' · '+esc(sel(f['Second Staff Date']))+'</div>';
else html+='<div class="tr-row"><div><span class="tr-lbl">2nd staff name</span><input class="tr-inp" id="trSecName" value="'+(dSigned&&myName()!==f['Driver Name']?esc(myName()):'')+'"></div><div><span class="tr-lbl">Date</span><input class="tr-inp" id="trSecDate" type="date" value="'+o.date+'"></div><div style="flex:0;align-self:flex-end"><button class="tr-btn pur" id="trSecSign">Sign as 2nd staff</button></div></div><div class="tr-sub" style="margin:6px 0 0">The 2nd staff member must do their own physical inspection and visual sweep before signing.</div>';
html+='</div>';
html+='<div class="tr-row" style="margin-top:12px"><div><span class="tr-lbl">Notes (optional)</span><input class="tr-inp" id="trNotes" value="'+esc(f.Notes||'')+'"></div><div style="flex:0;align-self:flex-end"><button class="tr-btn sec" id="trSave">Save</button></div></div>';
if(status==='Complete') html+='<div class="tr-sigok" style="margin-top:10px;font-size:1rem">✅ Trip complete — both signatures in.</div>';
}
html+='</div>';
area.innerHTML=html;
wireTrip();
}

function wireTrip(){
var o=open; var f=o.rec?o.rec.f:null;
document.getElementById('trBack').onclick=closeTrip;
if(!f){ document.getElementById('trStart').onclick=startTrip; var sync=function(){ document.getElementById('trDepLoc').value=fromLoc(val('trDest')||o.dest, val('trRun')||o.run); }; document.getElementById('trDest').onchange=sync; document.getElementById('trRun').onchange=sync; return; }
document.querySelectorAll('.tr-tog').forEach(function(b){ b.onclick=function(){ toggleRider(b.getAttribute('data-k'), b.getAttribute('data-n')); }; });
document.getElementById('trAddExtra').onclick=function(){ var n=(document.getElementById('trExtra').value||'').trim(); if(!n) return; toggleRider('in',n); };
document.getElementById('trArrive').onclick=function(){ var v=(document.getElementById('trArrTime').value||'').trim(); if(!v) v=nowHM(); saveFields({'Arrival Time':v, 'Departure Location':val('trDepLoc'), 'Departure Time':val('trDepTime'), 'Status': nextStatus(f,{arr:v})}, 'Arrival marked'); };
var ds=document.getElementById('trDrvSign'); if(ds) ds.onclick=function(){ var n=val('trDrvName'), d=val('trDrvDate'); if(!n||!d){toast('Name and date, please'); return;} localStorage.setItem('hiveName',n); saveFields({'Driver Name':n,'Driver Date':d,'Sweep Confirmed':true,'Status':nextStatus(f,{drv:1})}, 'Signed as driver'); };
var ss=document.getElementById('trSecSign'); if(ss) ss.onclick=function(){ var n=val('trSecName'), d=val('trSecDate'); if(!n||!d){toast('Name and date, please'); return;} if(f['Driver Name'] && n.trim().toLowerCase()===(f['Driver Name']||'').trim().toLowerCase()){ toast('2nd staff must be a different person than the driver'); return; } saveFields({'Second Staff Name':n,'Second Staff Date':d,'Status':nextStatus(f,{sec:1})}, 'Signed as 2nd staff'); };
document.getElementById('trSave').onclick=function(){ saveFields({'Departure Location':val('trDepLoc'),'Departure Time':val('trDepTime'),'Arrival Time':val('trArrTime'),'Notes':val('trNotes')}, 'Saved'); };
}
function val(id){ var e=document.getElementById(id); return e?(e.value||'').trim():''; }
function nextStatus(f, add){
var arr=add.arr||f['Arrival Time']; var drv=add.drv||(f['Driver Name']&&f['Driver Date']); var sec=add.sec||(f['Second Staff Name']&&f['Second Staff Date']);
if(drv&&sec) return 'Complete'; if(drv||sec) return 'Awaiting 2nd Signature'; if(arr) return 'Arrived'; return 'Started';
}

async function startTrip(){
var o=open; var dest=val('trDest')||o.dest, run=val('trRun')||o.run, loc=val('trDepLoc'), tm=val('trDepTime');
if(!loc){ toast('Departure location, please'); return; }
if(findTrip(o.date,dest,run)){ open={date:o.date,dest:dest,run:run,rec:findTrip(o.date,dest,run)}; renderTrip(); return; }
var fields={'Trip':school+' · '+dest+' · '+o.date+' · '+run,'School':school,'Destination':dest,'Date':o.date,'Run':run,'Departure Location':loc,'Departure Time':tm,'Status':'Started','Started By Role':roleName+(myName()?' · '+myName():''),'Submitted At':new Date().toISOString()};
var res=await api({action:'create', table:TRIPS, fields:fields});
var rec=res&&res.records&&res.records[0];
if(!rec||!rec.id){ toast("Didn't save — "+((res&&res.error)||'try again')); return; }
trips.push({id:rec.id,f:rec.fields}); open={date:o.date,dest:dest,run:run,rec:trips[trips.length-1]}; toast('Trip started 🚌'); renderTrip();
}
async function toggleRider(kind,name){
var f=open.rec.f; var key=kind==='in'?'Riders In':'Riders Out'; var L=lines(f[key]); var i=L.indexOf(name);
if(i>-1) L.splice(i,1); else L.push(name);
await saveFields((function(){var x={}; x[key]=L.join('\n'); return x;})(), null);
}
async function saveFields(fields, msg){
var rec=open.rec; var res=await api({action:'update', table:TRIPS, recordId:rec.id, fields:fields});
if(!res||!res.id){ toast("Didn't save — "+((res&&res.error)||'try again')); return; }
Object.keys(fields).forEach(function(k){ rec.f[k]=fields[k]; });
if(msg) toast(msg); renderTrip();
}

// ---------- boot ----------
async function refresh(){
school=mySchool();
var area=document.getElementById('trArea'); if(!area) return;
if(!school){ renderGrid(); return; }
area.innerHTML='<div class="empty">Loading the bus log… 🚌</div>';
try{ await loadRiders(); await loadTrips(); }catch(e){ area.innerHTML='<div class="tr-warn">Couldn\'t load — check your connection and try again.</div>'; return; }
if(open){ open.rec=findTrip(open.date,open.dest,open.run); renderTrip(); } else renderGrid();
}
function boot(){
if(!document.querySelector('nav') || !document.querySelector('main')) { return setTimeout(boot, 300); }
var intro = isTeach
? '<div class="step">🚌 Transportation Log — start the trip (AM: Kid City → school · PM: school → Kid City), tap each child IN and OUT, mark arrival, then the driver and a 2nd staff member each sign (date only). Any day can be opened and filled in later.</div>'
: '<div class="banner">🚌 Transportation Log — every bus run to Hamilton and Midway, with riders IN/OUT and both sweep signatures. Green = complete. Tap a purple box to add the 2nd signature.</div>';
var schoolPick = isTeach ? '<div class="tr-top"><div><span class="tr-lbl">Your school</span><select class="tr-sel" id="trSchool"><option value="">— pick —</option><option>Sanford</option><option>DeLand 2</option></select></div><div><span class="tr-lbl">Your name</span><input class="tr-inp" id="trMyName" style="width:auto" placeholder="First Last"></div></div>' : '';
addPanel('transport', intro + schoolPick + '<div id="trArea" class="empty">Loading… 🚌</div>');
addTab('🚌 Transportation', 'linear-gradient(90deg,#2fc4b2,#46c97f)', 'transport', function(){ open=null; refresh(); });
if(isTeach){
var s=document.getElementById('trSchool'); s.value=localStorage.getItem('hiveSchool')||''; s.onchange=function(){ localStorage.setItem('hiveSchool',s.value); open=null; refresh(); };
var n=document.getElementById('trMyName'); n.value=myName(); n.onchange=function(){ localStorage.setItem('hiveName',n.value.trim()); };
}
}
function addTab(label, gradient, panelId, onshow){
var nav = document.querySelector('nav'); var t = document.createElement('div');
t.className = 'tab'; t.style.background = gradient; t.textContent = label;
t.onclick = function(){ if(window.show) show(panelId, t); else { document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('show');}); document.getElementById('p-'+panelId).classList.add('show'); document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');}); t.classList.add('active'); } onshow(); };
nav.appendChild(t);
}
function addPanel(panelId, inner){ var main = document.querySelector('main'); var p = document.createElement('div'); p.className='panel'; p.id='p-'+panelId; p.innerHTML=inner; main.appendChild(p); return p; }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
