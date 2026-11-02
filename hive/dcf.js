/* THE HIVE - DCF Binder (director-only). Reads the same Airtable records the teacher portal, Friday PDFs and weekly emails use.
   Director edits write back to those same records. Built 11/2/26. */
(function(){
'use strict';
var PIN = sessionStorage.getItem('hivePin');
if(!PIN || sessionStorage.getItem('hiveRole')!=='director'){ location.href='index.html'; return; }
var API='dcf-api.php';
var NY='America/New_York';

/* ---------- config: what is expected, and the paper form items ---------- */
var CLASSROOMS = { 'Sanford':['Ones','Fours / VPK','School Age'], 'DeLand 2':['Infant Room','Ones','Twos','Threes'] };
var BLDG='Whole Building / Common Areas';
var CLOSED = ['2026-11-26','2026-11-27','2026-12-24','2026-12-25','2026-12-31','2027-01-01']; /* closed days: never flagged (edit this list) */
var DEEP = {1:['Language Center','Writing Center'],2:['Math Center','Music Center'],3:['Dramatic Play','Art Center'],4:['Cars/Blocks Center','Lego Table'],5:['Discovery Center','Wash trash cans']};
var INDOOR=['All entrances/exits are kept clear of clutter.','Hallways and tops of walls are kept clean and clutter free.','Bathrooms are clean and well stocked with toilet paper, soap and paper towels.','Staff purses and personal items are locked out of reach of children.','Cell phones are not in classroom.','Hands are washed by staff and children upon arrival to classroom.','Each child has brief health check by classroom teacher (includes parent/caregiver communication).','All hygiene supplies are available (soap, paper towels, toilet paper, lined garbage can, warm water).','All areas are clean and clutter-free (garbage emptied, floors swept, toys and workspace, bathroom clean).','All chemicals are locked/out of reach of children.','Air fresheners are not used.','All electrical outlets are covered.','Furniture and equipment is in good repair (check for broken toys, accessories, wrinkled/disrepair rugs/carpet).','Heavy toys/items are stored on lowest shelf.','Window cords are adjusted to prevent strangulation.',"Children's personal/nap items are kept separated (use of cubbies, bags, or storage containers).",'Tables and chairs are not stacked while children are present.','Diapering supplies are gathered and within reach before beginning (including a lined and covered foot operated garbage can).','Changing table is clean and free of any obstructions (only changing pad).','First aid kit is available in each room / appropriately stocked.','Bottles & sippy cups are labeled with first and last name.','Infants always placed on their back to sleep in cribs/pack-n-plays.','Infant Room (additions): all bottles have full name/date and refrigerated immediately.','Cribs are free of soft bedding, bumper pads, pillows and stuffed toys.','Cribs have tight fitting mattress and a secure fitted sheet.','Highchairs are in good repair and cleaned and sanitized before/after use.','Safety restraints are used on infant seats, swings, strollers and highchairs.'];
var OUTDOOR=['Surfacing is free from broken glass, nails, trash, and animal excrement, and check for compressed/packed areas, prior to allowing children to enter the play area.','There are no visible cracks, bending or warping, rusting or breakage of any equipment.','Toys are clean and in good repair.','There are no worn swing hangers or chains.','There are no missing, damaged, or loose swing seats.','There are no broken supports or anchors.','There are no cement support footings that are exposed, cracked, or loose in the ground.','There are no accessible sharp edges or points.','There are no protruding bolt ends that have lost caps or covers.','There are no loose bolts, nuts, and so forth that require tightening.','There are no nails that have become loose.','There are no splintered, cracked or otherwise deteriorating wood.','There is no chipped or peeling paint.','Trees/shade covering maintained and in good repair.','Play areas free of foreign objects that may injure children.','Unsafe equipment.','Ground cover adequate in play areas.','Ground free from debris/litter/rusted equipment.','Area free of any insect nest or infestation.','Equipment age appropriate and accessible.'];
var FORMS = {
 bath:{type:'🚽 Bathroom Cleaning',label:'Bathroom cleaning',per:'room',items:function(){return ['8:00 AM cleaning','10:00 AM cleaning','12:00 PM cleaning','2:00 PM cleaning','4:00 PM cleaning','6:00 PM cleaning'];}},
 cls:{type:'🧹 Classroom Cleaning',label:'Classroom cleaning (Bee Clean Chart)',per:'room',items:function(dow){ return ['Wipe door knobs','Clean cubbies','Sanitize cots / cribs / tables / high chairs','Sanitize bottles / cups','Sanitize toys','Clean sinks','Clean refrigerator','Clean bathroom / changing table / diaper can','Mop','Take garbage out / sanitize trash can'].concat((DEEP[dow]||[]).map(function(x){return 'Deep clean: '+x;})); }},
 ind:{type:'🏠 Indoor Inspection',label:'Daily indoor inspection',per:'room',items:function(){return INDOOR;}},
 out:{type:'🛝 Outdoor / Playground Inspection',label:'Daily playground inspection',room:'Playground',items:function(){return OUTDOOR;}},
 san:{type:'🧼 Sanitation & Safety',label:'Sanitation & safety',room:BLDG,items:function(dow){ var a=['Diapering/restroom sanitation','Nap-mat/cot sanitized','Outdoor trash/dumpster removed','Sensory/water table sanitized']; if(dow===1) a=a.concat(['First-aid kit + go-bag checked','Pest/sanitation walkthrough','Vehicle safety check (if transporting)']); return a; }},
 tmp:{type:'🌡️ Temp & Safety Logs',label:'Fridge / freezer / water temps',room:'Kitchen',items:function(){return ['Refrigerator temp','Freezer temp','Water temperature at sinks'];}},
 sec:{type:'🔒 Security & Attendance',label:'Doors locked + sign-in/out verified',room:BLDG,items:function(){return ['Doors locked & secured','Sign-in/out verified'];}},
 eod:{type:'🌙 End of Day Building Sweep',label:'End-of-day building sweep',room:BLDG,items:function(){return ['End-of-day visual sweep of entire building & all playgrounds completed by 2 closing staff.'];}},
 drl:{type:'🧯 Drills & Emergency',label:'Fire / emergency drill',room:BLDG,monthly:true,items:function(){return ['Fire/emergency drill conducted & logged'];}}
};
var TABS = [
 {id:'miss',label:'Missing'},
 {id:'clean',label:'Cleaning',forms:['bath','cls']},
 {id:'insp',label:'Inspections',forms:['ind','out','san']},
 {id:'temp',label:'Temps & Security',forms:['tmp','sec']},
 {id:'eod',label:'End of Day',forms:['eod']},
 {id:'drill',label:'Drills',forms:['drl']},
 {id:'trans',label:'Transportation'},
 {id:'att',label:'Attendance'},
 {id:'food',label:'Food Program'}
];

/* ---------- state + helpers ---------- */
var S={school:'',tab:'miss',date:todayNY(),subs:{},trips:[],att:[],meals:[],loaded:{},busy:0,name:''};
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function sv(x){ return x && typeof x==='object' ? (x.name||'') : (x||''); }
function todayNY(){ return new Date().toLocaleDateString('en-CA',{timeZone:NY}); }
function d2(s){ var p=s.split('-'); return new Date(+p[0],+p[1]-1,+p[2],12); }
function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(s,n){ var d=d2(s); d.setDate(d.getDate()+n); return iso(d); }
function dow(s){ return d2(s).getDay(); }
function monday(s){ var d=dow(s); return addDays(s, d===0?-6:1-d); }
function monthStart(s){ return s.slice(0,8)+'01'; }
function monthEnd(s){ var d=d2(s); return iso(new Date(d.getFullYear(), d.getMonth()+1, 0, 12)); }
function nice(s){ return d2(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }
function isSchoolDay(s){ var w=dow(s); return w>=1&&w<=5 && CLOSED.indexOf(s)<0; }
function toast(m,bad){ var t=$('toast'); t.textContent=m; t.className='toast show'+(bad?' bad':''); clearTimeout(toast.h); toast.h=setTimeout(function(){t.className='toast';},3200); }
function api(action,table,extra){
  var body={pin:PIN,action:action,table:table||''}; for(var k in (extra||{})) body[k]=extra[k];
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(j){ if(j&&j.error) throw new Error(j.error); return j; });
}
function directorName(){
  if(S.name) return S.name;
  var n=localStorage.getItem('hiveName')||'';
  if(!n){ n=(prompt('Your name (saved on anything you fill in or fix):')||'').trim(); if(n) localStorage.setItem('hiveName',n); }
  S.name=n; return n;
}

/* ---------- data ---------- */
function rangeKey(a,b){ return a+'|'+b; }
function loadRange(from,to){
  var key=rangeKey(from,to); if(S.loaded[key]) return Promise.resolve();
  S.busy++; render();
  return Promise.all([
    api('list','Facility Submissions',{from:from,to:to}),
    api('list','Transportation Trips',{from:from,to:to}),
    api('list','Room Attendance',{from:from,to:to}),
    api('list','Daily Meal Counts',{from:from,to:to})
  ]).then(function(r){
    S.loaded[key]=true;
    r[0].records.forEach(function(x){ S.subs[x.id]=x; });
    r[1].records.forEach(function(x){ S.trips=S.trips.filter(function(t){return t.id!==x.id;}); S.trips.push(x); });
    r[2].records.forEach(function(x){ S.att=S.att.filter(function(t){return t.id!==x.id;}); S.att.push(x); });
    r[3].records.forEach(function(x){ S.meals=S.meals.filter(function(t){return t.id!==x.id;}); S.meals.push(x); });
    if(r[0].truncated) toast('Very large month: some entries may not be shown.',true);
  }).catch(function(e){ toast(e.message,true); }).then(function(){ S.busy--; render(); });
}
function ensureData(){
  var ms=monthStart(S.date), me=monthEnd(S.date), wk=monday(S.date), we=addDays(wk,4), tm=monthStart(todayNY()), te=monthEnd(todayNY());
  var ps=[loadRange(ms,me)]; if(tm!==ms) ps.push(loadRange(tm,te)); if(monthStart(wk)!==ms) ps.push(loadRange(monthStart(wk),monthEnd(wk))); if(monthStart(we)!==ms && monthStart(we)!==monthStart(wk)) ps.push(loadRange(monthStart(we),monthEnd(we)));
  return Promise.all(ps);
}
function subsFor(formKey,date,room){
  var f=FORMS[formKey], out=[];
  for(var id in S.subs){ var x=S.subs[id].fields; if(x.Date!==date) continue; if(sv(x['Form Type'])!==f.type) continue; if(room && f.per==='room' && sv(x['Room / Classroom'])!==room) continue; out.push(S.subs[id]); }
  return out;
}
function expectedRooms(formKey){ var f=FORMS[formKey]; return f.per==='room' ? CLASSROOMS[S.school] : ['(building)']; }
function cellState(formKey,date,room){
  var t=todayNY(); var list=subsFor(formKey,date,room==='(building)'?null:room);
  if(list.length){ var bad=list.some(function(r){ return sv(r.fields['Overall Status']).indexOf('Issues')>-1||sv(r.fields['Overall Status']).indexOf('Incident')>-1; }); return {s:bad?'warn':'ok',list:list}; }
  if(!isSchoolDay(date)) return {s:'na',list:[]};
  if(date>t) return {s:'future',list:[]};
  if(date===t) return {s:'today',list:[]};
  return {s:'miss',list:[]};
}
/* missing items between two dates (inclusive) */
function missingList(from,to){
  var out=[], t=todayNY(), d=from;
  while(d<=to && d<=t){
    if(isSchoolDay(d) && d<t){
      Object.keys(FORMS).forEach(function(k){ var f=FORMS[k]; if(f.monthly) return; expectedRooms(k).forEach(function(r){ if(cellState(k,d,r).s==='miss') out.push({kind:'form',form:k,date:d,room:r}); }); });
      if(!S.att.some(function(a){ return a.fields.Date===d; })) out.push({kind:'att',date:d});
      if(!S.meals.some(function(m){ return m.fields.Date===d; })) out.push({kind:'meal',date:d});
    }
    d=addDays(d,1);
  }
  return out;
}
function drillMissing(monthIso){
  var ms=monthStart(monthIso), me=monthEnd(monthIso), t=todayNY();
  if(ms>t) return false;
  /* due by the end of the month; flag once the month is over, or after the 25th for the current month */
  if(me<t || t.slice(0,7)===monthIso.slice(0,7) && +t.slice(8)>=25 ){
    return !Object.keys(S.subs).some(function(id){ var x=S.subs[id].fields; return sv(x['Form Type'])===FORMS.drl.type && x.Date>=ms && x.Date<=me; });
  }
  return false;
}

/* ---------- render ---------- */
function render(){
  var h='';
  h+='<div class="hdr"><div><b>DCF Binder</b> <span class="sch">'+esc(S.school)+'</span></div><div class="hbtn"><a class="btn sec sm" href="director.html">&lsaquo; Director portal</a> <button class="btn sec sm" id="prt">Print</button></div></div>';
  h+='<div class="bar"><button class="btn sec sm" data-a="prev">&lsaquo;</button><input type="date" id="dt" value="'+S.date+'"><button class="btn sec sm" data-a="next">&rsaquo;</button><button class="btn sec sm" data-a="today">Today</button>'+(S.busy?'<span class="load">loading&hellip;</span>':'')+'</div>';
  var wk=monday(S.date), t=todayNY();
  var mt=missingList(monthStart(t),t).length+(drillMissing(t)?1:0);
  h+='<div class="tabs">'+TABS.map(function(x){ return '<button class="tab'+(S.tab===x.id?' on':'')+'" data-tab="'+x.id+'">'+x.label+(x.id==='miss'&&mt?' <span class="red">'+mt+'</span>':'')+'</button>'; }).join('')+'</div>';
  h+='<div class="body">'+body()+'</div><div id="toast" class="toast"></div><div id="modal"></div>';
  $('app').innerHTML=h;
  $('prt').onclick=function(){ window.print(); };
  $('dt').onchange=function(){ if(this.value){ S.date=this.value; ensureData(); } };
}
function body(){
  var tab=TABS.filter(function(x){return x.id===S.tab;})[0];
  if(S.tab==='miss') return missingView();
  if(S.tab==='trans') return transView();
  if(S.tab==='att') return attView();
  if(S.tab==='food') return foodView();
  var h='';
  if(tab.forms.length===1 && FORMS[tab.forms[0]].monthly) return drillView();
  tab.forms.forEach(function(k){ h+=gridFor(k); });
  return h;
}
function gridFor(k){
  var f=FORMS[k], wk=monday(S.date), days=[0,1,2,3,4].map(function(i){return addDays(wk,i);});
  var h='<div class="card"><div class="ct">'+esc(f.label)+'</div><div class="sub">Week of '+nice(wk)+' &middot; tap a box to see it or fix it</div><div class="gw"><table class="grid"><tr><th></th>'+days.map(function(d){return '<th>'+nice(d).split(',')[0]+'<br><small>'+d.slice(5)+'</small></th>';}).join('')+'</tr>';
  expectedRooms(k).forEach(function(r){
    h+='<tr><th class="rl">'+(r==='(building)'?'Building':esc(r))+'</th>';
    days.forEach(function(d){ var c=cellState(k,d,r); h+='<td><button class="cell c-'+c.s+'" data-cell="'+k+'|'+d+'|'+esc(r)+'">'+({ok:'&#10003;',warn:'&#9888;',miss:'&#9679;',today:'&#8230;',future:'',na:'&ndash;'}[c.s])+'</button></td>'; });
    h+='</tr>';
  });
  return h+'</table></div></div>';
}
function drillView(){
  var m=monthStart(S.date), me=monthEnd(S.date), rows=[];
  for(var id in S.subs){ var x=S.subs[id]; if(sv(x.fields['Form Type'])===FORMS.drl.type && x.fields.Date>=m && x.fields.Date<=me) rows.push(x); }
  rows.sort(function(a,b){return a.fields.Date<b.fields.Date?-1:1;});
  var h='<div class="card"><div class="ct">Fire / emergency drills &mdash; '+d2(S.date).toLocaleDateString('en-US',{month:'long',year:'numeric'})+'</div>';
  if(!rows.length) h+='<div class="miss">No drill logged this month.</div>'; else rows.forEach(function(r){ h+='<div class="line ok">&#10003; '+nice(r.fields.Date)+' &middot; '+esc(r.fields['Staff Name']||'')+' <button class="btn sec sm" data-cell="drl|'+r.fields.Date+'|(building)">open</button></div>'; });
  h+='<button class="btn grn" data-adddrill="1">Add a drill for a date</button></div>';
  return h;
}
function missingView(){
  var t=todayNY(), h='';
  [['Today',t,t],['This week',monday(t),t],['This month',monthStart(t),t]].forEach(function(p){
    var from=p[1], to=p[2], list=(p[0]==='Today'?missingTodayList(t):missingList(from,to));
    var dm=(p[0]==='This month'&&drillMissing(t));
    h+='<div class="card"><div class="ct">'+p[0]+' <span class="'+((list.length||dm)?'red':'grn')+'">'+(list.length+(dm?1:0))+'</span></div>';
    if(!list.length && !dm) h+='<div class="okline">&#10003; Nothing missing.</div>';
    if(dm) h+='<button class="line bad" data-tab="drill">&#9679; No fire/emergency drill logged for '+d2(t).toLocaleDateString('en-US',{month:'long'})+' &rsaquo;</button>';
    list.forEach(function(m){
      if(m.kind==='form') h+='<button class="line bad" data-cell="'+m.form+'|'+m.date+'|'+esc(m.room)+'">&#9679; '+nice(m.date)+' &middot; '+esc(FORMS[m.form].label)+(m.room==='(building)'?'':' &middot; '+esc(m.room))+' &rsaquo;</button>';
      else if(m.kind==='att') h+='<button class="line bad" data-tab="att" data-d="'+m.date+'">&#9679; '+nice(m.date)+' &middot; no attendance recorded &rsaquo;</button>';
      else h+='<button class="line bad" data-tab="food" data-d="'+m.date+'">&#9679; '+nice(m.date)+' &middot; no meal counts recorded &rsaquo;</button>';
    });
    h+='</div>';
  });
  return h+'<div class="hint">Weekends and the closed days listed in the page settings are never flagged. Today shows once the day is over.</div>';
}
function missingTodayList(t){ /* today: show items still open (after 5 PM it matters) */
  var out=[]; if(!isSchoolDay(t)) return out;
  var hr=+new Date().toLocaleString('en-US',{timeZone:NY,hour:'numeric',hour12:false});
  if(hr<17) return out;
  Object.keys(FORMS).forEach(function(k){ var f=FORMS[k]; if(f.monthly) return; expectedRooms(k).forEach(function(r){ if(cellState(k,t,r).s==='today') out.push({kind:'form',form:k,date:t,room:r}); }); });
  return out;
}
function transView(){
  var wk=monday(S.date), we=addDays(wk,4);
  var rows=S.trips.filter(function(x){ return x.fields.Date>=wk && x.fields.Date<=we; }).sort(function(a,b){ return (a.fields.Date+(a.fields['Departure Time']||''))<(b.fields.Date+(b.fields['Departure Time']||''))?-1:1; });
  var h='<div class="card"><div class="ct">Transportation log &mdash; week of '+nice(wk)+'</div>';
  if(!rows.length) h+='<div class="sub">No bus trips logged this week.</div>';
  rows.forEach(function(x){ var f=x.fields; h+='<div class="line '+(f['Sweep Confirmed']?'ok':'bad')+'"><b>'+nice(f.Date)+'</b> &middot; '+esc(sv(f.Run))+' &middot; '+esc(sv(f.Destination))+'<br><small>Left '+esc(f['Departure Location']||'')+' '+esc(f['Departure Time']||'')+' &middot; Arrived '+esc(f['Arrival Time']||'')+' &middot; Driver '+esc(f['Driver Name']||'-')+' &middot; 2nd staff '+esc(f['Second Staff Name']||'-')+' &middot; Sweep '+(f['Sweep Confirmed']?'&#10003;':'<b class="redt">not confirmed</b>')+'</small></div>'; });
  return h+'<div class="hint">The weekly vehicle safety inspection is still on paper.</div></div>';
}
function attView(){
  var d=S.date, rows=S.att.filter(function(a){return a.fields.Date===d;});
  var h='<div class="card"><div class="ct">Attendance &mdash; '+nice(d)+'</div>';
  if(!rows.length) h+=(isSchoolDay(d)&&d<=todayNY()?'<div class="miss">No attendance recorded for this day.</div>':'<div class="sub">Nothing recorded.</div>');
  else { var by={}; rows.forEach(function(a){ var r=a.fields['Current Room']||a.fields['Home Room']||'?'; (by[r]=by[r]||[]).push(a.fields); });
    Object.keys(by).forEach(function(r){ var ps=by[r].filter(function(f){return f.Arrival;}).length; h+='<div class="line ok"><b>'+esc(r)+'</b> &middot; '+ps+' present of '+by[r].length+'</div>'; }); }
  return h+'<div class="hint">Full rosters (times, meals, ratios) print from the Rooms board.</div><a class="btn sec" href="rooms.html">Open Rooms board</a></div>';
}
function foodView(){
  var wk=monday(S.date), days=[0,1,2,3,4].map(function(i){return addDays(wk,i);});
  var h='<div class="card"><div class="ct">Food program &mdash; daily meal counts</div><div class="sub">Week of '+nice(wk)+' (from the KidKare counts saved each afternoon)</div><div class="gw"><table class="grid"><tr><th></th><th>B</th><th>L</th><th>P</th><th>Present</th></tr>';
  days.forEach(function(d){ var m=S.meals.filter(function(x){return x.fields.Date===d;})[0]; var f=m?m.fields:null;
    h+='<tr><th class="rl">'+nice(d)+'</th>'+(f?'<td>'+(f.Breakfast||0)+'</td><td>'+(f.Lunch||0)+'</td><td>'+(f['PM Snack']||0)+'</td><td>'+(f.Present||0)+'</td>':'<td colspan="4" class="'+(isSchoolDay(d)&&d<todayNY()?'redt':'')+'">'+(isSchoolDay(d)&&d<todayNY()?'not recorded':'&ndash;')+'</td>')+'</tr>'; });
  return h+'</table></div><div class="hint">The weekly sponsor attendance sheets and the daily backup log are being added to this tab next.</div></div>';
}

/* ---------- cell modal: view / edit / fill in ---------- */
function parseItems(txt){ return String(txt||'').split('\n').filter(function(l){return l.trim();}).map(function(l){ var ok=l.indexOf('⚠')===0?false:true; return {ok:ok, text:l.replace(/^(✅|⚠️?|⚠)\s*/,'')}; }); }
function openCell(k,date,room){
  var f=FORMS[k], c=cellState(k,date,room), rec=c.list[0], rm=f.per==='room'?room:f.room;
  var items, who='', when='', link='', details='', ro=!rec;
  if(rec){ items=parseItems(rec.fields.Items); who=rec.fields['Staff Name']||''; when=rec.fields['Submitted At']?new Date(rec.fields['Submitted At']).toLocaleString('en-US',{timeZone:NY}):''; link=rec.fields['Drive Link']||''; details=rec.fields.Details||''; }
  else items=f.items(dow(date)).map(function(t){return {ok:true,text:t};});
  var h='<div class="mback" data-a="mclose"><div class="mbox" data-stop="1"><h3>'+esc(f.label)+'</h3><div class="sub">'+(f.per==='room'?esc(room)+' &middot; ':'')+nice(date)+'</div>';
  if(rec) h+='<div class="sub">Done by <b>'+esc(who||'?')+'</b>'+(when?' &middot; '+esc(when):'')+(link?' &middot; <a href="'+esc(link)+'" target="_blank" rel="noopener">PDF</a>':'')+'</div>';
  else h+='<div class="miss">Not recorded. Fill it in below if it was done (every box starts checked &mdash; uncheck anything that was not OK).</div>';
  h+='<div class="items">'+items.map(function(it,i){ return '<label class="it"><input type="checkbox" class="ck" data-i="'+i+'" '+(it.ok?'checked':'')+'> <span>'+esc(it.text)+'</span></label>'; }).join('')+'</div>';
  h+='<label class="lbl">Note (optional)</label><input class="inp" id="mnote" value="'+esc(details)+'" placeholder="Anything that needs attention">';
  h+='<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-a="mclose">Close</button><button class="btn grn" id="msave">'+(rec?'Save changes':'Save as done')+'</button></div></div></div>';
  $('modal').innerHTML=h;
  $('msave').onclick=function(){ saveCell(k,date,room,rec,items,rm); };
}
function saveCell(k,date,room,rec,items,rm){
  var f=FORMS[k], nm=directorName(); if(!nm){ $('merr').textContent='Enter your name first.'; return; }
  var cks=document.querySelectorAll('.ck'), lines=[], bad=0;
  items.forEach(function(it,i){ var on=cks[i].checked; if(!on) bad++; lines.push((on?'✅ ':'⚠️ ')+it.text); });
  var note=($('mnote').value||'').trim(); var over=bad?'⚠️ Issues Flagged':'✅ All OK';
  var btn=$('msave'); btn.disabled=true; btn.textContent='Saving...';
  var p;
  if(rec){
    var det=note; if(det.indexOf('Edited by')<0) det=(det?det+' | ':'')+'Edited by '+nm;
    p=api('update','Facility Submissions',{recordId:rec.id,fields:{Items:lines.join('\n'),'Overall Status':over,Details:det}});
  } else {
    var now=new Date(); var label=S.school+' · '+(f.per==='room'?room:rm)+' · '+f.label+' · '+date.slice(5).replace('-','/')+' (director entry)';
    p=api('create','Facility Submissions',{fields:{Submission:label,'Room / Classroom':rm,'Form Type':f.type,'Staff Name':nm,Date:date,'Submitted At':now.toISOString(),Items:lines.join('\n'),'Overall Status':over,Details:(note?note+' | ':'')+'Entered by director '+nm,Status:'🟡 Pending'}});
  }
  p.then(function(res){
    var r=res.records?res.records[0]:res; if(r&&r.id){ S.subs[r.id]=r; }
    $('modal').innerHTML=''; toast('Saved. It now shows everywhere this form is used.'); render();
  }).catch(function(e){ btn.disabled=false; btn.textContent='Save'; $('merr').textContent=e.message; });
}
function addDrill(){
  var d=prompt('Date of the drill (YYYY-MM-DD):', todayNY()); if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  openCell('drl',d,'(building)');
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-cell],[data-tab],[data-a],[data-adddrill]'); if(!el) return;
  if(el.getAttribute('data-a')==='mclose' && e.target.closest('[data-stop]') && !e.target.classList.contains('btn')) return;
  if(el.hasAttribute('data-adddrill')){ addDrill(); return; }
  if(el.hasAttribute('data-cell')){ var p=el.getAttribute('data-cell').split('|'); openCell(p[0],p[1],p[2]); return; }
  if(el.hasAttribute('data-tab')){ S.tab=el.getAttribute('data-tab'); var d=el.getAttribute('data-d'); if(d) S.date=d; render(); if(d) ensureData(); return; }
  var a=el.getAttribute('data-a');
  if(a==='mclose'){ $('modal').innerHTML=''; }
  else if(a==='prev'){ S.date=addDays(S.date,S.tab==='drill'?-30:(S.tab==='att'?-1:-7)); ensureData(); }
  else if(a==='next'){ S.date=addDays(S.date,S.tab==='drill'?30:(S.tab==='att'?1:7)); ensureData(); }
  else if(a==='today'){ S.date=todayNY(); ensureData(); }
});

/* ---------- boot ---------- */
api('whoami').then(function(w){ S.school=w.school; render(); return ensureData(); }).catch(function(e){ document.getElementById('app').innerHTML='<div class="card"><b>'+esc(e.message)+'</b><br><a class="btn" href="index.html">Back to sign in</a></div>'; });
window.__dcf={S:S,cellState:cellState,missingList:missingList,drillMissing:drillMissing,parseItems:parseItems};
})();
