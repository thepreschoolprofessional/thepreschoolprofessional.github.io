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
var CLOSED = ['2026-07-03','2026-07-31','2026-09-07','2026-11-11','2026-11-26','2026-11-27','2026-12-24','2026-12-25','2027-01-01','2027-01-18','2027-03-26','2027-05-31','2027-06-18']; /* both schools; from the signed 2026-27 ELC holiday schedule (School Closures Tracker). Add any extra closed day here. */
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
 {id:'food',label:'Food Program'},
 {id:'pack',label:'Month-End Packet'},
 {id:'forms',label:'Forms to Print'}
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
  if(S.tab==='pack'&&S.pk.form==='PAR') parTotals();
  if(S.tab==='pack') postPack();
  $('dt').onchange=function(){ if(this.value){ S.date=this.value; ensureData(); } };
}
function body(){
  var tab=TABS.filter(function(x){return x.id===S.tab;})[0];
  if(S.tab==='miss') return missingView();
  if(S.tab==='trans') return transView();
  if(S.tab==='att') return attView();
  if(S.tab==='food') return foodView();
  if(S.tab==='pack') return packView();
  if(S.tab==='forms') return formsView();
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


/* ---------- MONTH-END FOOD PROGRAM PACKET ---------- */
var HDR={'DeLand 2':['KID CITY USA DELAND 2 INC.','238 S ARMELIA AVE.','DELAND, FL. 32724'],'Sanford':['KID CITY USA SANFORD','1320 HICKORY AVE.','SANFORD, FL. 32771']};
var PAR_DEFAULT={'DeLand 2':'Madhumita Sahoo'};
var CHK=['Monthly Provider Check list','Infant/Child Menus (NOT NECESSARY IF CLAIMING ON-LINE)','Receipts for Operating Expenses, including itemized food/non-food receipts, including CATERED MEAL RECEIPTS','CN labels or PFS (Product Formulation Statement) for processed/pre-cooked food packages','Personnel Activity Report (PAR) for Operating Labor Expenses','Free and Reduced-Price Meal Applications, DCF forms or Center Enrollment forms with Original Child Participation forms','Infant Feeding form, Medical Statement, Dietary Preference Request form','Monthly Entrances/Terminations form','Other (Please specify)'];
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
S.pk={month:defMonth(),form:'PAR',emp:'',staff:null,kids:null,recs:{},loaded:''};
function defMonth(){ var t=todayNY(); return (+t.slice(8)<=10) ? monthStart(addDays(monthStart(t),-1)).slice(0,7) : t.slice(0,7); }
function mLabel(m){ return MONTHS[+m.slice(5)-1]+' '+m.slice(0,4); }
function shiftMonth(m,n){ var d=new Date(+m.slice(0,4),+m.slice(5)-1+n,1,12); return iso(d).slice(0,7); }
function pkKey(form,emp){ return S.pk.month+'|'+form+'|'+(emp||''); }
function loadPacket(){
  var pk=S.pk, m=pk.month; S.busy++; render();
  var ps=[api('list','Monthly Forms',{month:m})];
  if(!pk.staff) ps.push(api('list','Staff Roster')); else ps.push(Promise.resolve(null));
  ps.push(api('list','Room Children'));
  return Promise.all(ps).then(function(r){
    pk.recs={}; r[0].records.forEach(function(x){ pk.recs[pkKey(x.fields.Form,x.fields.Employee)]=x; });
    if(r[1]) pk.staff=r[1].records.map(function(x){return x.fields.Name;}).filter(function(n){return n&&n!=='Mrs. Honey';}).sort();
    pk.kids=r[2].records; pk.loaded=m;
    if(!pk.emp){ var d=PAR_DEFAULT[S.school]; pk.emp=(d&&pk.staff.indexOf(d)>-1)?d:(pk.staff[0]||''); }
  }).catch(function(e){ toast(e.message,true); }).then(function(){ S.busy--; render(); });
}
function pkData(form,emp){ var r=S.pk.recs[pkKey(form,emp)]; if(!r) return null; try{ return JSON.parse(r.fields.Data||'{}'); }catch(e){ return null; } }
var PFORMS=[['SITEINFO','Site Information'],['CHECKLIST','Provider Check List'],['ENTRANCES','Entrances / Terminations'],['PAR','Personnel Activity (PAR)'],['INFANTFEED','Infant Feeding'],['MEDICAL','Medical Statement'],['DIETARY','Dietary Preference'],['EXPEND','Expenditure Worksheet'],['LABOR','Labor Summary'],['REVIEW','Review & Submit']];
var KF={
 INFANTFEED:{title:'Infant Feeding Form',fields:[['dob','Date of birth',1],['parent','Parent / guardian',1],['feed','Feeding type (breast milk / iron-fortified formula)',1],['brand','Formula brand & type (if formula)',0],['amt','Amount per feeding (oz)',1],['freq','How often (hours)',1],['solids','Solid foods already introduced (grains, fruits, vegetables, meats)',0],['allergy','Allergies / foods to avoid',0],['pdate','Parent signature date (sign on printed copy)',0]]},
 MEDICAL:{title:'Medical Statement for Special Dietary Needs',fields:[['dob','Date of birth',1],['parent','Parent / guardian',1],['diag','Disability or medical condition requiring a special diet',1],['avoid','Foods to omit / avoid',1],['sub','Foods or substitutions to serve',1],['phys','Licensed physician / medical authority name',1],['physph','Physician phone',0],['sdate','Date signed by physician',1]]},
 DIETARY:{title:'Dietary Preference Request',fields:[['dob','Date of birth',0],['parent','Parent / guardian',1],['reason','Reason (religious, ethical, personal preference)',1],['avoid','Foods the child does not eat',1],['sub','Acceptable substitutions the parent will supply or approve',0],['pdate','Parent signature date (sign on printed copy)',0]]}
};
var SITEF=[['sname','Site name',1],['saddr','Address',1],['sphone','Phone',1],['auth','Authorization / site number',1],['sponsor','Sponsor',1],['license','DCF license number',1],['dirn','Director name',1],['dire','Director email',1],['days','Days of operation',1],['hours','Hours of operation',1],['cap','Licensed capacity',0],['bt','Breakfast time',1],['lt','Lunch time',1],['st','PM snack time',1]];
var SITEDEF={'Sanford':{sname:'Kid City USA Sanford',saddr:'1320 Hickory Ave., Sanford, FL 32771',phone:'',sphone:'(407) 942-3242',sponsor:'4C Florida',license:'C18SE0336',dirn:'Sanchita',dire:'sanfordoffice.1320@gmail.com',days:'Monday - Friday',hours:'6:30 AM - 5:30 PM'},'DeLand 2':{sname:'Kid City USA DeLand 2 Inc.',saddr:'238 S Armelia Ave., DeLand, FL 32724',sponsor:'CCSWFL',auth:'4-2677',dirn:'Madhumita Sahoo',dire:'delandoffice.238@gmail.com',days:'Monday - Friday'}};
function isLocked(){ return !!S.pk.recs[pkKey('SUBMITTED','')]; }
function dayKidKey(c){ return c; }
function packView(){
  var pk=S.pk;
  if(PFORMS.every(function(f){return f[0]!==pk.form;})) pk.form='SITEINFO';
  if(pk.loaded!==pk.month) { if(!S.busy) setTimeout(loadPacket,0); return '<div class="card">Loading&hellip;</div>'; }
  var lk=isLocked(), st=pkStatus();
  var h='<div class="card noprint"><div class="ct">Month-end Food Program packet</div><div class="sub">Yellow boxes are required. Everything saves as you type. When all tabs show a check, open <b>Review &amp; Submit</b>.</div>';
  h+='<div class="bar"><button class="btn sec sm" data-pf="prev">&lsaquo;</button><b>'+mLabel(pk.month)+'</b><button class="btn sec sm" data-pf="next">&rsaquo;</button><span id="svst" class="hint" style="margin-left:auto"></span></div>';
  if(lk){ var sd=pkData('SUBMITTED')||{}; h+='<div class="okline">&#128274; Submitted'+(sd.by?' by '+esc(sd.by):'')+(sd.at?' on '+esc(new Date(sd.at).toLocaleDateString('en-US',{month:'short',day:'numeric'})):'')+'. This month is locked; Charles is preparing the email draft.</div>'; }
  h+='<div class="tabs">';
  PFORMS.forEach(function(f){ var s=st[f[0]]; var mark=s==null?'':(s.ok?' &#10003;':' <span class="red">&#9679;</span>'); h+='<button class="tab'+(pk.form===f[0]?' on':'')+'" data-pf="form" data-v="'+f[0]+'">'+f[1]+mark+'</button>'; });
  h+='</div></div>';
  var body;
  if(pk.form==='CHECKLIST') body=chkForm(); else if(pk.form==='ENTRANCES') body=entForm(); else if(pk.form==='PAR') body=parForm(); else if(pk.form==='SITEINFO') body=siteForm(); else if(KF[pk.form]) body=kidForm(pk.form); else if(pk.form==='EXPEND') body=expForm(); else if(pk.form==='LABOR') body=labForm(); else body=reviewForm(st);
  if(pk.form==='REVIEW') return h+'<div class="card" id="paper">'+body+'</div>';
  h+='<div class="card paper" id="paper">'+body+'</div>';
  h+='<div class="mrow noprint"><button class="btn sec" data-pf="print">Print / Save PDF</button>'+'<button class="btn grn" data-pf="save">Save now</button>'+'</div>';
  return h;
}
function fld(key,label,req,val,ph){ return '<label class="fl">'+esc(label)+(req?' <span class="rq">*</span>':'')+'<input class="fi'+(req?' rq-in':'')+'" data-f="'+key+'" data-req="'+(req?1:0)+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'"></label>'; }
function siteForm(){
  var d=pkData('SITEINFO')||{}, df=SITEDEF[S.school]||{};
  var h=letterhead()+'<h2 class="pt">CCFP Site Information</h2><div class="pm">'+mLabel(S.pk.month)+'</div><div class="fgrid">';
  SITEF.forEach(function(f){ var v=d[f[0]]; if(v==null||v==='') v=df[f[0]]||(f[0]==='sphone'?df.sphone:'')||''; h+=fld(f[0],f[1],f[2],v); });
  return h+'</div><div class="hint noprint">Pre-filled from what we know. Anything still yellow is something the sponsor needs.</div>';
}
function kidNames(){ var a=(S.pk.kids||[]).map(function(k){return k.fields.Child;}).filter(Boolean); a.sort(); return a; }
function kidForm(form){
  var def=KF[form], pk=S.pk, kid=pk.kid||'';
  var names=kidNames(); if(!kid&&names.length) kid=pk.kid=names[0];
  var d=pkData(form,kid)||{};
  var h=letterhead()+'<h2 class="pt">'+esc(def.title)+'</h2><div class="pm">'+mLabel(pk.month)+'</div>';
  h+='<label class="fl">Child <span class="rq">*</span><select id="kidSel" class="inp">'+names.map(function(n){return '<option'+(n===kid?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>';
  var done=[]; Object.keys(pk.recs).forEach(function(k){ var p=k.split('|'); if(p[1]===form&&p[2]) done.push(p[2]); });
  if(done.length) h+='<div class="hint noprint">Saved for: '+done.map(esc).join(', ')+'</div>';
  h+='<div class="fgrid">';
  def.fields.forEach(function(f){ h+=fld(f[0],f[1],f[2],d[f[0]]); });
  return h+'</div><div class="hint noprint">Print this page for the parent / physician to sign, then upload the signed copy on the Forms tab.</div>';
}
function wsRows(n,cols,sv){ var h=''; for(var i=0;i<n;i++){ h+='<tr>'+cols.map(function(c,j){ var v=((sv||[])[i]||[])[j]||''; return '<td><input class="ws '+c+'" value="'+esc(v)+'" '+(/^c\d|lab/.test(c)?'inputmode="decimal"':'')+'></td>'; }).join('')+'</tr>'; } return h; }
function expForm(){
  return letterhead()+'<h2 class="pt">PROGRAM EXPENDITURES WORKSHEET</h2><div class="pm">Center: <b>'+esc((HDR[S.school]||[''])[0])+'</b> &nbsp; Month <b>'+MONTHS[+S.pk.month.slice(5)-1]+'</b> Year <b>'+S.pk.month.slice(0,4)+'</b></div><div class="warnbox noprint">Saves as you type and goes in the Food Program email. Print / Save PDF for the paper packet.</div><table class="pt2 wsx"><tr><th>Day of Month</th><th>Receipt Number</th><th>Name of Payee for Expenditures Claimed</th><th>Food Costs</th><th>Nonfood Supplies and Expendable Equipment Costs</th><th>Purchase Services &amp; Non-expendable Equipment Costs</th><th>Milk Amount (gallons)</th></tr>'+wsRows(24,['wd','wr','wv','c1','c2','c3','c4'],(pkData('EXPEND')||{}).rows)+'<tr><td colspan="3" style="text-align:right;font-weight:700;padding:6px">TOTAL</td><td id="et1" class="tt">0.00</td><td id="et2" class="tt">0.00</td><td id="et3" class="tt">0.00</td><td id="et4" class="tt">0</td></tr></table><div class="rev">Program Expenditures worksheet</div>';
}
function labForm(){
  var h=letterhead()+'<h2 class="pt">Labor Summary Worksheet</h2><div class="pm">TOTAL LABOR COSTS FOR ALL STAFF WORKING ON THE FOOD PROGRAM</div><div class="pm" style="font-size:14px">Center: <b>'+esc((HDR[S.school]||[''])[0])+'</b> &nbsp; Month/Yr: <b>'+mLabel(S.pk.month)+'</b></div><div class="warnbox noprint">Saves as you type and goes in the Food Program email. Print / Save PDF for the paper packet.</div><table class="pt2 wsx"><tr><th style="width:44px">#</th><th>Employee</th><th>Total CCFP salary (admin + oper.) $</th></tr>';
  var lr=(pkData('LABOR')||{}).rows||[]; for(var i=1;i<=25;i++){ var r0=lr[i-1]||[]; h+='<tr><td>#'+i+'</td><td><input class="ws wn" value="'+esc(r0[0]||'')+'"></td><td><input class="ws lab" inputmode="decimal" value="'+esc(r0[1]||'')+'"></td></tr>'; }
  return h+'<tr><td colspan="2" style="text-align:right;font-weight:700;padding:6px">TOTAL Labor Costs For the Month</td><td id="labTot" class="tt">0.00</td></tr></table><div class="cert">Signature of center owner, director, or representative: ________________________________</div><div class="hint noprint">Complete this if you claim more than one person for labor. Add each employee&rsquo;s total operational + administrative salary together.</div><div class="rev">Rev 2/16/11 &nbsp; Labor Summary Worksheet for centers</div>';
}
function wsCalc(){
  [1,2,3].forEach(function(n){ var t=0; document.querySelectorAll('input.c'+n).forEach(function(i){ var v=parseFloat(i.value); if(!isNaN(v)) t+=v; }); var e=$('et'+n); if(e) e.textContent=t.toFixed(2); });
  var m=0; document.querySelectorAll('input.c4').forEach(function(i){ var v=parseFloat(i.value); if(!isNaN(v)) m+=v; }); var e4=$('et4'); if(e4) e4.textContent=(Math.round(m*100)/100);
  var lt=0; document.querySelectorAll('input.lab').forEach(function(i){ var v=parseFloat(i.value); if(!isNaN(v)) lt+=v; }); var l=$('labTot'); if(l) l.textContent=lt.toFixed(2);
}
/* ----- status / review ----- */
function pkStatus(){
  var pk=S.pk, s={}, any=function(f){ return Object.keys(pk.recs).filter(function(k){return k.split('|')[1]===f;}); };
  var si=pkData('SITEINFO'); s.SITEINFO={ok:!!si&&SITEF.filter(function(f){return f[2]&&!String(si[f[0]]||(SITEDEF[S.school]||{})[f[0]]||'').trim();}).length===0, why:'Site details incomplete'};
  var ck=pkData('CHECKLIST'); var need=[0,2,4,5,6,7]; s.CHECKLIST={ok:!!ck&&need.every(function(i){return ck.c&&ck.c[i];}), why:'Check list items still unchecked'};
  var en=pkData('ENTRANCES'); s.ENTRANCES={ok:!!en&&((en.rows&&en.rows.length)||en.none), why:'Entrances not reviewed (add rows or tick "none this month")'};
  s.PAR={ok:any('PAR').length>0, why:'No Personnel Activity Report saved'};
  var pf=pkData('PARENTFORMS')||{items:[]}; var openPF=(pf.items||[]).filter(function(i){return !i.done;});
  s.INFANTFEED={ok:true}; s.MEDICAL={ok:true}; s.DIETARY={ok:true};
  s.PARENTSIGN={ok:openPF.length===0, why:openPF.length+' parent form(s) not returned signed'};
  var RC=(S.school==='DeLand 2'?RECEIPTS[pk.month]:RECEIPTS['S|'+pk.month])||[]; s.RECEIPTS={ok:RC.length>0, why:'No receipts loaded for the month'};
  var hasv=function(f){ var d=pkData(f); return !!d&&(d.rows||[]).some(function(r){return r.some(function(v){return v;});}); }; s.EXPEND={ok:hasv('EXPEND'), why:'Expenditure worksheet not filled in'}; s.LABOR={ok:hasv('LABOR'), why:'Labor summary not filled in'};
  return s;
}
function reviewForm(st){
  var lk=isLocked(), ws=pkData('WORKSHEETS')||{};
  var rows=[['SITEINFO','Site Information'],['CHECKLIST','Monthly Provider Check List'],['ENTRANCES','Monthly Entrances / Terminations'],['PAR','Personnel Activity Reports'],['PARENTSIGN','Parent-signed forms'],['RECEIPTS','Receipts'],['EXPEND','Program Expenditures Worksheet'],['LABOR','Labor Summary Worksheet']];
  var h='<div class="ct">Review &amp; Submit &mdash; '+mLabel(S.pk.month)+'</div><div class="sub">Green means ready. Red means the sponsor will be missing something.</div>';
  var miss=[];
  rows.forEach(function(r){ var s=st[r[0]]; if(!s.ok) miss.push(s.why); h+='<div class="line '+(s.ok?'ok':'bad')+'">'+(s.ok?'&#10003; ':'&#9679; ')+r[1]+(s.ok?'':' &mdash; '+esc(s.why))+(PFORMS.some(function(f){return f[0]===r[0];})?' <button class="btn sec sm" data-pf="form" data-v="'+r[0]+'">open</button>':'')+'</div>'; });
  if(lk) return h+'<div class="okline" style="margin-top:12px">&#128274; Submitted and locked.</div>';
  h+='<div class="mrow"><button class="btn grn" data-pf="submit">Submit month-end packet</button></div><div class="hint">Submitting locks '+mLabel(S.pk.month)+' and tells Charles to build the Food Program email draft. It does not send anything to the sponsor.</div>';
  return h;
}
function submitPacket(){
  var st=pkStatus(), miss=[]; Object.keys(st).forEach(function(k){ if(st[k]&&!st[k].ok&&st[k].why) miss.push(st[k].why); });
  var nm=directorName(); if(!nm) return toast('Enter your name first.',true);
  if(miss.length && !confirm('Still missing:\n- '+miss.join('\n- ')+'\n\nSubmit anyway? The month will be locked.')) return;
  if(!miss.length && !confirm('Submit '+mLabel(S.pk.month)+' and lock it?')) return;
  flushSave();
  var now=new Date().toISOString(), pk=S.pk, data={by:nm,at:now,missing:miss,school:S.school};
  api('create','Monthly Forms',{fields:{Entry:S.school+' · '+pk.month+' · SUBMITTED',Month:pk.month,Form:'SUBMITTED',Employee:'',Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}}).then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ pk.recs[pkKey('SUBMITTED','')]=r; toast('Submitted. Month locked.'); render(); } else toast('Did not submit',true); }).catch(function(e){ toast(e.message,true); });
}
/* ----- required highlighting + lock ----- */
function postPack(){
  var p=$('paper'); if(!p) return;
  p.querySelectorAll('.rq-in').forEach(function(i){ i.classList.toggle('need',!String(i.value).trim()); });
  if(S.pk.form==='EXPEND'||S.pk.form==='LABOR') wsCalc();
  if(S.pk.form==='CHECKLIST'){ var NEED=[0,2,4,5,6,7]; p.querySelectorAll('.pc').forEach(function(c){ var l=c.closest('label'); if(l) l.classList.toggle('need',NEED.indexOf(+c.getAttribute('data-i'))>-1&&!c.checked); }); }
  if(S.pk.form==='PAR'){ ['pAuth','pTitle'].forEach(function(id){ var e=$(id); if(e) e.classList.toggle('need',!e.value.trim()); }); }
  if(S.pk.form==='ENTRANCES'){ var nn=$('entNone'), has=[].some.call(p.querySelectorAll('.en'),function(x){return x.value.trim();}); p.classList.toggle('needbox',!(nn&&nn.checked)&&!has); }
  if(isLocked()) p.querySelectorAll('input,select,textarea').forEach(function(i){ i.disabled=true; });
}
/* ----- saving ----- */
function collect(form){
  var pk=S.pk, data={}, emp='';
  if(form==='CHECKLIST'){ data={c:[].map.call(document.querySelectorAll('.pc'),function(x){return x.checked;}),other:[].map.call(document.querySelectorAll('.po'),function(x){return x.value;}),sug:[].map.call(document.querySelectorAll('.ps'),function(x){return x.value;})}; }
  else if(form==='ENTRANCES'){ var n=document.querySelectorAll('.en'), dd=document.querySelectorAll('.ed'), rows=[]; for(var i=0;i<n.length;i++) if(n[i].value.trim()||dd[i].value.trim()) rows.push({n:n[i].value.trim(),d:dd[i].value.trim()}); var nn=$('entNone'); data={rows:rows,none:!!(nn&&nn.checked)}; }
  else if(form==='PAR'){ emp=pk.emp; var days={}; document.querySelectorAll('.pv').forEach(function(x){ if(x.value.trim()){ var k=x.getAttribute('data-d'); (days[k]=days[k]||{})[x.getAttribute('data-k')]=x.value.trim(); } }); var sp={}; document.querySelectorAll('.spi').forEach(function(x){ if(x.value.trim()) sp[x.getAttribute('data-sp')]=x.value.trim(); }); data={auth:$('pAuth').value.trim(),title:$('pTitle').value.trim(),days:days,sp:sp}; }
  else if(form==='SITEINFO'||KF[form]){ if(KF[form]) emp=pk.kid||''; document.querySelectorAll('#paper [data-f]').forEach(function(x){ data[x.getAttribute('data-f')]=x.value.trim(); }); if(KF[form]&&!emp) return null; }
  else if(form==='EXPEND'||form==='LABOR'){ var trs=document.querySelectorAll('#paper table tr'), rows=[]; trs.forEach(function(tr){ var ins=tr.querySelectorAll('input.ws'); if(!ins.length) return; var r=[].map.call(ins,function(x){return x.value.trim();}); rows.push(r); }); data={rows:rows}; }
  else return null;
  return {form:form,emp:emp,data:data};
}
function writeRec(c,silent){
  var pk=S.pk, nm=directorName()||'Director', ex=pk.recs[pkKey(c.form,c.emp)], now=new Date().toISOString(), p;
  if(ex) p=api('update','Monthly Forms',{recordId:ex.id,fields:{Data:JSON.stringify(c.data),'Updated By':nm,'Updated At':now}});
  else p=api('create','Monthly Forms',{fields:{Entry:S.school+' · '+pk.month+' · '+c.form+(c.emp?' · '+c.emp:''),Month:pk.month,Form:c.form,Employee:c.emp,Data:JSON.stringify(c.data),'Updated By':nm,'Updated At':now}});
  return p.then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ pk.recs[pkKey(c.form,c.emp)]=r; var e=$('svst'); if(e) e.textContent='Saved '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); if(!silent){ toast('Saved.'); render(); } } else toast('Did not save',true); }).catch(function(e){ toast(e.message,true); });
}
var saveT=null;
function flushSave(){ if(saveT){ clearTimeout(saveT); saveT=null; var c=collect(S.pk.form); if(c) return writeRec(c,true); } return Promise.resolve(); }
function schedSave(){ if(isLocked()) return; var e=$('svst'); if(e) e.textContent='Saving…'; clearTimeout(saveT); saveT=setTimeout(function(){ saveT=null; var c=collect(S.pk.form); if(c) writeRec(c,true); },1200); }
function savePacket(){ var nm=directorName(); if(!nm) return toast('Enter your name first.',true); clearTimeout(saveT); saveT=null; var c=collect(S.pk.form); if(!c) return toast('Nothing to save on this tab.'); writeRec(c,false); }
function letterhead(){ var a=HDR[S.school]||[]; return '<div class="lh">'+a.map(esc).join('<br>')+'</div>'; }
function chkForm(){
  var d=pkData('CHECKLIST')||{c:[],other:[],sug:[]}, m=S.pk.month;
  var h=letterhead()+'<h2 class="pt">Monthly Provider Check List</h2><div class="pm">Month <b>'+MONTHS[+m.slice(5)-1]+'</b> &nbsp; Year <b>'+m.slice(0,4)+'</b></div><div class="pb"><b>X &ndash; Before Submitting</b></div>';
  CHK.forEach(function(t,i){ h+='<label class="ck2"><input type="checkbox" class="pc" data-i="'+i+'" '+(d.c&&d.c[i]?'checked':'')+'> <span>'+esc(t)+'</span></label>'; });
  for(var i=0;i<3;i++) h+='<input class="ln po" placeholder="'+(i?'':'Other (specify)')+'" value="'+esc((d.other||[])[i]||'')+'">';
  h+='<div class="pb"><b>Suggestions</b></div>';
  for(i=0;i<3;i++) h+='<input class="ln ps" value="'+esc((d.sug||[])[i]||'')+'">';
  return h+'<div class="rev">Revised 6.27.2023/mis</div>';
}
function entRows(){
  var pk=S.pk, saved=pkData('ENTRANCES'); if(saved&&saved.rows) return saved.rows;
  var m=pk.month, out=[];
  (pk.kids||[]).forEach(function(k){ var f=k.fields; if(!f['KidKare Action']||f['KidKare Action']==='Needs Remove') return; var d=new Date(k.createdTime).toLocaleDateString('en-CA',{timeZone:NY}); if(d.slice(0,7)===m) out.push({n:f.Child,d:d}); });
  return out.sort(function(a,b){return a.d<b.d?-1:1;});
}
function entForm(){
  var rows=entRows(), m=S.pk.month;
  var h=letterhead()+'<div class="pm">Month: <b>'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</b></div><h2 class="pt">Monthly Entrances</h2><table class="pt2"><tr><th>Childs Name</th><th>Entrance Date</th></tr>';
  for(var i=0;i<28;i++){ var r=rows[i]||{}; h+='<tr><td><input class="en" value="'+esc(r.n||'')+'"></td><td><input class="ed" value="'+esc(r.d||'')+'" placeholder="'+(i?'':'YYYY-MM-DD')+'"></td></tr>'; }
  var sv0=pkData('ENTRANCES')||{};
  h+='</table><label class="ck2 noprint"><input type="checkbox" id="entNone" '+(sv0.none?'checked':'')+'> <span>No entrances or terminations this month</span></label>';
  return h+'<div class="hint noprint">Pre-filled with children added through the Rooms board this month. Fix or add anyone else by typing.</div><div class="rev">Updated 6.18.19</div>';
}
function parForm(){
  var pk=S.pk, m=pk.month, d=pkData('PAR',pk.emp)||{days:{}}, dim=new Date(+m.slice(0,4),+m.slice(5),0).getDate();
  var AUTH={'DeLand 2':'4-2677'}, au=(d.auth!=null&&d.auth!=='')?d.auth:(AUTH[S.school]||'');
  function cell(i,k){ var r=(d.days||{})[i]||{}, off=i>dim; return '<td><input class="pv" data-d="'+i+'" data-k="'+k+'" inputmode="decimal" value="'+esc(r[k]||'')+'"'+(off?' disabled':'')+'></td>'; }
  function side(i){ return '<td class="dn">'+i+'</td>'+['a','o','r','p'].map(function(k){return cell(i,k);}).join(''); }
  var h=letterhead()+'<h2 class="pt">Child Care Food Program</h2><h3 class="pt2h">PERSONNEL ACTIVITY REPORT</h3><div class="pel">&middot; *Electronic self-calculating version of this form is on our website</div>';
  h+='<div class="parhead"><label>Authorization Number <input id="pAuth" class="ln sm" value="'+esc(au)+'"></label><label>Employee Name: <select id="pEmp" class="inp sm">'+(pk.staff||[]).map(function(n){return '<option'+(n===pk.emp?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label><span>Month/Year <b>'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</b></span></div>';
  h+='<div class="parins"><b>INSTRUCTIONS:</b> This form is required for <i>all private sector</i> employees who work on the Child Care Food Program (CCFP). Each month, indicate the number of hours per day spent on administrative and operational activities related to the CCFP (to nearest quarter hour). Examples of CCFP administrative activities include, but are not limited to: monitoring, record keeping, compiling data, completing the claim for reimbursement, and attending training related to CCFP. Examples of CCFP operational activities include, but are not limited to: menu planning, grocery shopping, cooking and serving meals and clean up after meals.</div>';
  h+='<table class="par par2"><tr><th rowspan="2" class="dh">Date</th><th colspan="2">Hours Worked<br>on CCFP</th><th colspan="2">Total<br>Hours Worked<br>(CCFP &amp; Non-CCFP)</th><th rowspan="2" class="dh">Date</th><th colspan="2">Hours Worked<br>on CCFP</th><th colspan="2">Total<br>Hours Worked<br>(CCFP &amp; Non-CCFP)</th></tr>';
  h+='<tr><th>Admin.</th><th>Oper.</th><th>Regular</th><th>Paid Leave</th><th>Admin.</th><th>Oper.</th><th>Regular</th><th>Paid Leave</th></tr>';
  for(var i=1;i<=16;i++){
    h+='<tr>'+side(i);
    if(i<=15) h+=side(i+16); else h+='<td class="dn tl">TOTAL</td>'+['a','o','r','p'].map(function(k){return '<td class="tot" id="pt-'+k+'">0</td>';}).join('');
    h+='</tr>';
  }
  h+='</table>';
  h+='<div class="cert">I certify that this is an accurate record of the number of hours worked on the Child Care Food Program.</div><div class="sig3"><label>Employee&rsquo;s Signature<input class="ln" placeholder="(sign on the printed copy)" disabled></label><label>Title<input id="pTitle" class="ln" value="'+esc(d.title||'')+'"></label><label>Date<input class="ln" disabled></label></div>';
  var sp=d.sp||{};
  function I(k,w){ return '<input class="spi" data-sp="'+k+'" inputmode="decimal" style="width:'+(w||80)+'px" value="'+esc(sp[k]||'')+'">'; }
  function T(k,w){ return '<input class="spi" data-sp="'+k+'" style="width:'+(w||160)+'px" value="'+esc(sp[k]||'')+'">'; }
  h+='<div class="sponsor"><div class="sh">TO BE COMPLETED BY SPONSOR / CENTER DIRECTOR / AUTHORIZED REPRESENTATIVE</div>';
  h+='<div><b>A.</b> (HOURLY PAID STAFF)</div><div>Total administrative hours worked on CCFP '+I('ah')+' x $'+I('aw')+' (hourly wage) = $'+I('aa')+' (Total admin. CCFP salary)</div><div>Total operational hours worked on CCFP '+I('oh')+' x $'+I('ow')+' (hourly wage) = $'+I('oa')+' (Total oper. CCFP salary)</div>';
  h+='<div><b>B.</b> (SALARIED STAFF)</div><div>Total administrative hours worked on CCFP '+I('bah')+' &divide; Total hours worked '+I('bth')+' = '+I('bap',60)+'%</div><div class="ind">Total Salary to be <b>paid</b> this month $'+I('bs')+' x '+I('bap2',60)+'% = $'+I('baa')+' (Total admin. CCFP salary)</div><div>Total operational hours worked on CCFP '+I('boh')+' &divide; Total hours worked '+I('bth2')+' = '+I('bop',60)+'%</div><div class="ind">Total Salary to be <b>paid</b> this month $'+I('bs2')+' x '+I('bop2',60)+'% = $'+I('boa')+' (Total oper. CCFP salary)</div>';
  h+='<div><b>I certify that payroll records are on file that verify the total wages as listed above.</b></div><div>Signature of Sponsor/Center Director/Authorized Representative <span class="noprint">(sign on the printed copy)</span> &nbsp; Date '+T('sd',110)+'</div></div>';
  h+='<div class="hint noprint">The pay section fills in as you type. Hours carry over from the table above when left blank; amounts and percentages calculate themselves.</div><div class="rev">Revised 2/2011 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; I-026-04</div>';
  return h;
}
function spCalc(){
  var g=function(k){ var e=document.querySelector('[data-sp='+k+']'); return e?e:null; }, v=function(k){ var e=g(k); return e?parseFloat(e.value):NaN; };
  var set=function(k,val,dec){ var e=g(k); if(!e||document.activeElement===e) return; e.value=(isNaN(val)||!isFinite(val))?'':(dec==null?String(Math.round(val*100)/100):val.toFixed(dec)); };
  var T={a:0,o:0,r:0,p:0}; document.querySelectorAll('.pv').forEach(function(i){ var x=parseFloat(i.value); if(!isNaN(x)) T[i.getAttribute('data-k')]+=x; });
  var ah=g('ah'); if(ah&&!ah.value&&T.a) ah.value=Math.round(T.a*100)/100; var oh=g('oh'); if(oh&&!oh.value&&T.o) oh.value=Math.round(T.o*100)/100;
  var bah=g('bah'); if(bah&&!bah.value&&T.a) bah.value=Math.round(T.a*100)/100; var boh=g('boh'); if(boh&&!boh.value&&T.o) boh.value=Math.round(T.o*100)/100;
  var tot=T.r+T.p; ['bth','bth2'].forEach(function(k){ var e=g(k); if(e&&!e.value&&tot) e.value=Math.round(tot*100)/100; });
  set('aa',v('ah')*v('aw'),2); set('oa',v('oh')*v('ow'),2);
  set('bap',v('bah')/v('bth')*100,2); set('bap2',v('bah')/v('bth')*100,2); set('baa',v('bs')*(v('bah')/v('bth')),2);
  set('bop',v('boh')/v('bth2')*100,2); set('bop2',v('boh')/v('bth2')*100,2); set('boa',v('bs2')*(v('boh')/v('bth2')),2);
}
function parTotals(){
  var t={a:0,o:0,r:0,p:0}; document.querySelectorAll('.pv').forEach(function(i){ var v=parseFloat(i.value); if(!isNaN(v)) t[i.getAttribute('data-k')]+=v; });
  ['a','o','r','p'].forEach(function(k){ var e=$('pt-'+k); if(e) e.textContent=Math.round(t[k]*100)/100; });
  spCalc();
}
/* ---------- FORMS TO PRINT (prefilled, fillable PDFs + month-end forms) ---------- */
var RECEIPTS={'2026-10':[['Sep 30 order, delivered Oct 1 &middot; $813.01','files/food-program/receipt-2026-10-walmart-sep30-order.pdf'],['Sep 21 order, Oct 2 delivery only (It\'s Delish) &middot; $19.99','files/food-program/receipt-2026-10-walmart-sep21-itsdelish.pdf'],['Oct 15 order, delivered Oct 19 &middot; $564.65','files/food-program/receipt-2026-10-walmart-oct15-order.pdf'],['Oct 30 order, delivery Nov 3 &middot; $1,005.13','files/food-program/receipt-2026-10-walmart-oct30-order.pdf']]};
var CNLABELS={};
var BLANKS=[['Free &amp; Reduced-Price Meal Application (blank, DeLand 2)','files/food-program/deland2-free-reduced-application-blank.pdf'],['Infant Feeding Form (blank, DeLand 2)','files/food-program/deland2-infant-feeding-form-blank.pdf']];
function savePF(data){
  var pk=S.pk, nm=directorName()||'Director', ex=pk.recs[pkKey('PARENTFORMS','')], now=new Date().toISOString(), p;
  if(ex) p=api('update','Monthly Forms',{recordId:ex.id,fields:{Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}});
  else p=api('create','Monthly Forms',{fields:{Entry:S.school+' · '+pk.month+' · PARENTFORMS',Month:pk.month,Form:'PARENTFORMS',Employee:'',Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}});
  return p.then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ pk.recs[pkKey('PARENTFORMS','')]=r; toast('Saved.'); } else toast('Did not save',true); render(); }).catch(function(e){ toast(e.message,true); });
}

function signedFor(it){
  var kind=(it.type==='INFANT')?'INFANT':'FR', out=[];
  Object.keys(S.pk.recs).forEach(function(k){ var r=S.pk.recs[k]; if(r.fields.Form!=='SIGNED') return; var d; try{ d=JSON.parse(r.fields.Data||'{}'); }catch(e){ return; } if(d.kind===kind && (d.child||'').toLowerCase().replace(/[^a-z]/g,'')===(it.child||'').toLowerCase().replace(/[^a-z]/g,'')) out.push(d); });
  return out.sort(function(a,b){ return (a.at||'')<(b.at||'')?-1:1; });
}
function signedBlock(it,i){
  var up=signedFor(it), h='<div class="noprint" style="margin-top:8px">';
  up.forEach(function(d,n){ h+='<div class="hint">&#10003; Signed copy '+(n+1)+' uploaded'+(d.at?' '+esc(new Date(d.at).toLocaleDateString('en-US',{month:'short',day:'numeric'})):'')+' &middot; <a href="#" data-dl="'+esc(d.file)+'" data-nm="'+esc((it.child||'form').replace(/[^A-Za-z0-9]+/g,'-')+'-signed-'+(n+1)+(/\.pdf$/.test(d.file)?'.pdf':/\.png$/.test(d.file)?'.png':'.jpg'))+'">download</a></div>'; });
  h+='<label class="btn sm sec" style="display:inline-block;cursor:pointer">'+(up.length?'Add another page':'Upload signed copy')+'<input type="file" class="pfup" data-i="'+i+'" accept="image/*,application/pdf" multiple style="display:none"></label>';
  if(S.upBusy===i) h+=' <span class="hint">Uploading&hellip;</span>';
  return h+'</div>';
}
function fileToB64(file){
  return new Promise(function(res,rej){
    if(file.type==='application/pdf'){ if(file.size>5.5*1024*1024) return rej(new Error('That PDF is over 5 MB. Scan at a lower size.')); var fr=new FileReader(); fr.onload=function(){ res({b64:String(fr.result).split(',')[1],mime:'application/pdf'}); }; fr.onerror=function(){ rej(new Error('Could not read the file')); }; fr.readAsDataURL(file); return; }
    var img=new Image(), u=URL.createObjectURL(file);
    img.onload=function(){ var mx=2200, sc=Math.min(1,mx/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc); var x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); res({b64:c.toDataURL('image/jpeg',0.82).split(',')[1],mime:'image/jpeg'}); };
    img.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('That photo could not be read. Try a JPG, PNG or PDF.')); };
    img.src=u;
  });
}
function uploadSigned(files,i){
  var dd=pkData('PARENTFORMS')||{items:[]}, it=dd.items[i]; if(!it||!files.length) return;
  var kind=(it.type==='INFANT')?'INFANT':'FR', chain=Promise.resolve(), ok=0;
  S.upBusy=i; render();
  Array.prototype.forEach.call(files,function(f){
    chain=chain.then(function(){ return fileToB64(f); }).then(function(p){
      return api('upload','Monthly Forms',{month:S.pk.month,child:it.child,kind:kind,name:f.name,b64:p.b64,by:directorName()||'Director'});
    }).then(function(res){ var r=res.records[0]; S.pk.recs[pkKey('SIGNED',r.fields.Employee)]=r; ok++; });
  });
  chain.then(function(){ it.done=true; return savePF(dd); }).then(function(){ toast(ok+' page'+(ok>1?'s':'')+' uploaded for '+it.child+'.'); }).catch(function(e){ toast(e.message,true); }).then(function(){ S.upBusy=null; render(); });
}
function downloadSigned(id,nm){
  api('getfile','',{id:id}).then(function(r){ var bin=atob(r.b64), a=new Uint8Array(bin.length); for(var k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); var mt=/\.pdf$/.test(id)?'application/pdf':/\.png$/.test(id)?'image/png':'image/jpeg'; var u=URL.createObjectURL(new Blob([a],{type:mt})); var l=document.createElement('a'); l.href=u; l.download=nm; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function(){URL.revokeObjectURL(u);},4000); }).catch(function(e){ toast(e.message,true); });
}
function formsView(){
  var pk=S.pk;
  if(pk.loaded!==pk.month){ if(!S.busy) setTimeout(loadPacket,0); return '<div class="card">Loading&hellip;</div>'; }
  var d=pkData('PARENTFORMS')||{items:[]}, items=d.items||[];
  var h='<div class="card"><div class="ct">Forms to print</div><div class="sub">Everything for the month-end Food Program packet in one place. Prefilled forms open as PDFs: type in any blank (SNAP / case number, income, address, phone), print, and have the parent sign.</div>';
  h+='<div class="bar"><button class="btn sec sm" data-pf="prev">&lsaquo;</button><b>'+mLabel(pk.month)+'</b><button class="btn sec sm" data-pf="next">&rsaquo;</button></div></div>';
  var mf=[['CHECKLIST','Monthly Provider Check List'],['ENTRANCES','Monthly Entrances'],['PAR','Personnel Activity Report']];
  h+='<div class="card"><div class="ct">Month-end forms (filled in for you)</div>';
  mf.forEach(function(f){ var saved=Object.keys(pk.recs).some(function(k){return k.split('|')[1]===f[0];}); h+='<div class="line '+(saved?'ok':'bad')+'">'+(saved?'&#10003; ':'&#9679; ')+f[1]+' <button class="btn sec sm" data-goto="'+f[0]+'">open &amp; print</button></div>'; });
  h+='</div>';
  h+='<div class="card"><div class="ct">Forms for parents to sign</div>';
  if(!items.length) h+='<div class="okline">Nothing waiting for a parent signature this month.</div>';
  items.forEach(function(it,i){
    h+='<div class="line '+(it.done?'ok':'bad')+'"><b>'+esc(it.child)+'</b> &middot; '+esc(it.type==='INFANT'?'Infant Feeding Form':'Free & Reduced Meal Application')+(it.why?'<div class="hint">'+esc(it.why)+'</div>':'')+'<div style="margin-top:6px"><a class="btn sm" target="_blank" href="'+esc(it.file)+'">Open &amp; print</a> <label style="margin-left:10px"><input type="checkbox" class="pfdone" data-i="'+i+'" '+(it.done?'checked':'')+'> Returned signed</label></div>'+signedBlock(it,i)+'</div>';
  });
  h+='</div>';
  {
    var RC=(S.school==='DeLand 2'?RECEIPTS[pk.month]:RECEIPTS['S|'+pk.month])||[];
    h+='<div class="card"><div class="ct">Walmart receipts</div>';
    if(!RC.length) h+='<div class="hint">No receipts loaded for '+mLabel(pk.month)+' yet.</div>';
    RC.forEach(function(r){ h+='<div class="line"><a class="btn sm" target="_blank" href="'+r[1]+'">Open &amp; print</a> '+r[0]+'</div>'; });
    h+='</div>';
    h+='<div class="card"><div class="ct">CN Labels / Product Formulation Statements</div>';
    var CN=CNLABELS[pk.month]||[];
    if(!CN.length) h+='<div class="hint">None on file yet for '+mLabel(pk.month)+'. When a CN label or PFS is added it will show here to print with the receipts.</div>';
    CN.forEach(function(r){ h+='<div class="line"><a class="btn sm" target="_blank" href="'+r[1]+'">Open &amp; print</a> '+r[0]+'</div>'; });
    h+='</div>';
  }
  if(S.school==='DeLand 2'){ h+='<div class="card"><div class="ct">Blank forms</div>'; BLANKS.forEach(function(b){ h+='<div class="line"><a target="_blank" href="'+b[1]+'">'+b[0]+'</a></div>'; }); h+='</div>'; }
  return h;
}

/* ---------- events ---------- */
document.addEventListener('input',function(e){ var t=e.target; if(t.classList.contains('pv')) parTotals(); if(t.classList.contains('spi')) spCalc(); if(t.closest&&t.closest('#paper')){ if(t.classList.contains('ws')) wsCalc(); postPack(); schedSave(); } });
document.addEventListener('change',function(e){ var t=e.target; if(t.classList&&t.classList.contains('wsflag')){ var w=pkData('WORKSHEETS')||{}; w[t.getAttribute('data-w')]=t.checked; writeRec({form:'WORKSHEETS',emp:'',data:w},false); return; } if(t.id==='kidSel'){ flushSave().then(function(){ S.pk.kid=t.value; render(); }); return; } if(t.closest&&t.closest('#paper')&&(t.type==='checkbox')&&!t.classList.contains('ws')){ postPack(); schedSave(); } });
document.addEventListener('change',function(e){ if(e.target.classList&&e.target.classList.contains('pfup')){ var fl=e.target.files; uploadSigned(fl,+e.target.getAttribute('data-i')); return; } if(e.target.classList&&e.target.classList.contains('pfdone')){ var dd=pkData('PARENTFORMS')||{items:[]}; var it=dd.items[+e.target.getAttribute('data-i')]; if(it){ it.done=e.target.checked; savePF(dd); } return; } if(e.target.id==='pEmp'){ var nv=e.target.value; flushSave().then(function(){ S.pk.emp=nv; render(); }); } });
document.addEventListener('click',function(e){
  var dl=e.target.closest&&e.target.closest('[data-dl]'); if(dl){ e.preventDefault(); downloadSigned(dl.getAttribute('data-dl'),dl.getAttribute('data-nm')); return; }
  var el=e.target.closest('[data-cell],[data-tab],[data-a],[data-adddrill],[data-pf],[data-goto]'); if(!el) return;
  if(el.hasAttribute('data-goto')){ S.tab='pack'; S.pk.form=el.getAttribute('data-goto'); render(); return; }
  if(el.hasAttribute('data-pf')){ var a2=el.getAttribute('data-pf'),pk=S.pk; if(a2==='prev'||a2==='next'){ flushSave().then(function(){ pk.month=shiftMonth(pk.month,a2==='prev'?-1:1); pk.loaded=''; render(); }); } else if(a2==='form'){ var fv=el.getAttribute('data-v'); flushSave().then(function(){ pk.form=fv; render(); }); } else if(a2==='save') savePacket(); else if(a2==='submit') submitPacket(); else if(a2==='print') window.print(); return; }
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
