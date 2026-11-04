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
var FROMREP=false; try{ FROMREP=new URLSearchParams(location.search).get('from')==='rep'; }catch(e){}
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
  var pm=monthStart(addDays(tm,-1)); var ps=[loadRange(ms,me)]; if(tm!==ms) ps.push(loadRange(tm,te)); if(pm!==ms&&pm!==tm) ps.push(loadRange(pm,monthEnd(pm))); if(monthStart(wk)!==ms) ps.push(loadRange(monthStart(wk),monthEnd(wk))); if(monthStart(we)!==ms && monthStart(we)!==monthStart(wk)) ps.push(loadRange(monthStart(we),monthEnd(we)));
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
  h+='<div class="hdr"><div><b>DCF Binder</b> <span class="sch">'+esc(S.school)+'</span></div><div class="hbtn">'+(FROMREP?'<a class="btn sec sm" href="reporting.html">&lsaquo; Monthly Reporting</a>':'<a class="btn sec sm" href="director.html">&lsaquo; Director portal</a>')+' <button class="btn sec sm" id="prt">Print</button></div></div>';
  h+='<div class="bar"><button class="btn sec sm" data-a="prev">&lsaquo;</button><input type="date" id="dt" value="'+S.date+'"><button class="btn sec sm" data-a="next">&rsaquo;</button><button class="btn sec sm" data-a="today">Today</button>'+(S.busy?'<span class="load">loading&hellip;</span>':'')+'</div>';
  var wk=monday(S.date), t=todayNY();
  var mt=missingList(monthStart(t),t).length+(drillMissing(t)?1:0)+(drillMissing(addDays(monthStart(t),-1))?1:0);
  h+='<div class="tabs">'+TABS.filter(function(x){ return FROMREP || !(x.id==='food'||x.id==='pack'||S.tab===x.id); }).map(function(x){ return '<button class="tab'+(S.tab===x.id?' on':'')+'" data-tab="'+x.id+'">'+x.label+(x.id==='miss'&&mt?' <span class="red">'+mt+'</span>':'')+'</button>'; }).join('')+'</div>';
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
    var pmIso=addDays(monthStart(t),-1); if(p[0]==='This month'&&drillMissing(pmIso)) h+='<button class="line bad" data-tab="drill" data-d="'+pmIso+'">&#9679; No fire/emergency drill logged for LAST month ('+d2(pmIso).toLocaleDateString('en-US',{month:'long'})+') &rsaquo;</button>';
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
function wageFor(name){ var n=String(name||'').toLowerCase(); if(S.school==='DeLand 2') return /sahoo|madhumita|honey/.test(n)?20:15; if(S.school==='Sanford') return /sheena/.test(n)?21:15; return 15; }
var PARB=['bah','bth','bap','bs','bap2','baa','boh','bth2','bop','bs2','bop2','boa'];
function laborFor(name){ var d=pkData('PAR',name); if(!d) return null; var sp=d.sp||{}, a=0, o=0; Object.keys(d.days||{}).forEach(function(k){ var r=d.days[k]; a+=parseFloat(r.a)||0; o+=parseFloat(r.o)||0; }); var ah=parseFloat(sp.ah); if(isNaN(ah)) ah=a; var oh=parseFloat(sp.oh); if(isNaN(oh)) oh=o; var w=wageFor(name), aw=parseFloat(sp.aw), ow=parseFloat(sp.ow); if(isNaN(aw)) aw=w; if(isNaN(ow)) ow=w; var t=ah*aw+oh*ow; return t>0?Math.round(t*100)/100:null; }
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
var PFORMS=[['SITEINFO','Site Information'],['CHECKLIST','Provider Check List'],['ENTRANCES','Entrances'],['TERMS','Terminations'],['PAR','Personnel Activity (PAR)'],['INFANTFEED','Infant Feeding'],['MEDICAL','Medical Statement'],['DIETARY','Dietary Preference'],['EXPEND','Expenditure Worksheet'],['LABOR','Labor Summary'],['REVIEW','Review & Submit']];
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
  if(pk.form==='CHECKLIST') body=chkOv(); else if(pk.form==='ENTRANCES') body=entOv(); else if(pk.form==='TERMS') body=termForm(); else if(pk.form==='PAR') body=parOv(); else if(pk.form==='SITEINFO') body=siteOv(); else if(KF[pk.form]) body=kidOv(pk.form); else if(pk.form==='EXPEND') body=expOv(); else if(pk.form==='LABOR') body=labOv(); else body=reviewForm(st);
  if(pk.form==='REVIEW') return h+'<div class="card" id="paper">'+body+'</div>';
  h+='<div class="card paper'+(/^(SITEINFO|CHECKLIST|ENTRANCES|MEDICAL|DIETARY|INFANTFEED|PAR|LABOR|EXPEND)$/.test(pk.form)?' ovwrap '+(pk.form==='EXPEND'?'land':'port'):'')+'" id="paper">'+body+'</div>';
  h+='<div class="mrow noprint"><button class="btn sec" data-pf="print">Print / Save PDF</button>'+'<button class="btn grn" data-pf="save">Save now</button>'+'</div>';
  return h;
}
function fld(key,label,req,val,ph){ return '<label class="fl">'+esc(label)+(req?' <span class="rq">*</span>':'')+'<input class="fi'+(req?' rq-in':'')+'" data-f="'+key+'" data-req="'+(req?1:0)+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'"></label>'; }

/* ----- exact official-form overlays ----- */
var OVFS={SITEINFO:10,CHECKLIST:10,ENTRANCES:10,MEDICAL:10,DIETARY:10,INFANTFEED:10,PAR:9,LABOR:10,EXPEND:11};
function ovForm(key,get,opt){
  opt=opt||{}; var sp=window.OVSPEC[key], h='<div class="ovp '+(sp.w>sp.h?'land':'port')+'" data-ovk="'+key+'" style="--fs:'+(OVFS[key]/sp.w*100).toFixed(3)+'cqw"><img src="files/food-program/forms/'+(opt.img||key.toLowerCase())+'.jpg" alt="">';
  sp.f.forEach(function(f){
    var st='left:'+(f.x/sp.w*100).toFixed(3)+'%;top:'+(f.y/sp.h*100).toFixed(3)+'%;width:'+(f.w/sp.w*100).toFixed(3)+'%;height:'+(f.h/sp.h*100).toFixed(3)+'%';
    var o=opt.render&&opt.render(f); if(o===false) return; if(typeof o==='string'){ h+='<div class="ovx" style="'+st+'">'+o+'</div>'; return; }
    var v=get(f.id), req=sp.req.indexOf(f.id)>-1;
    if(f.t==='s'){ h+='<div class="ovsig" data-sig="'+f.id+'" data-form="'+key+'" style="'+st+'">'+(v?'<img src="'+esc(v)+'" alt="signature">':'<span>Tap to sign</span>')+'<input type="hidden" '+(f.sp?'class="spi" data-sp="'+f.id+'"':'data-f="'+f.id+'"')+' value="'+esc(v||'')+'"></div>'; return; }
    if(f.t==='c') h+='<input type="checkbox" class="ovc'+(req?' rq-in':'')+'" data-f="'+f.id+'" style="'+st+'"'+(v?' checked':'')+'>';
    else h+='<input class="ovi'+(req?' rq-in':'')+'" data-f="'+f.id+'" style="'+st+'" value="'+esc(v||'')+'">';
  });
  return h+'</div>';
}
function kidOv(form){
  var pk=S.pk, kid=pk.kid||''; var names=kidNames(); if(!kid&&names.length) kid=pk.kid=names[0];
  var d=pkData(form,kid)||{}, sn=(SITEDEF[S.school]||{}).sname||'';
  var dflt=form==='INFANTFEED'?{facility:sn,infant:kid}:{child:kid,center:sn};
  var h='<label class="fl noprint">Child <span class="rq">*</span><select id="kidSel" class="inp">'+names.map(function(n){return '<option'+(n===kid?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>';
  var done=[]; Object.keys(pk.recs).forEach(function(k){ var p=k.split('|'); if(p[1]===form&&p[2]) done.push(p[2]); });
  if(done.length) h+='<div class="hint noprint">Saved for: '+done.map(esc).join(', ')+'</div>';
  h+=ovForm(form,function(id){ var v=d[id]; return (v==null||v==='')?(dflt[id]||''):v; });
  return h+'<div class="hint noprint">This is the official form. Fill it in, then Print / Save PDF for the parent or physician to sign. Upload the signed copy on the Forms tab.</div>';
}
var EXPDEF={'Sanford|2026-10':[['2','2000150-27721274','Walmart','244.34','','',''],['9','2000155-50435703','Walmart','239.39','','',''],['19','2000155-17455353','Walmart','265.95','','',''],['26','2000153-27095377','Walmart','227.44','','','']]};
function expOv(){
  var rows=(pkData('EXPEND')||{}).rows||[], m=S.pk.month, cn=['wd','wr','wv','c1','c2','c3','c4'];
  var hv=rows.some(function(r){ return r.some(function(v){return v;}); }), dfx=EXPDEF[S.school+'|'+m];
  var filled=rows.filter(function(r){ return r.some(function(v){return v;}); });
  var subset=dfx&&filled.length<dfx.length&&filled.every(function(r){ return dfx.some(function(d){ return d[1]===r[1]; }); });
  if(dfx&&(!hv||subset)){ rows=dfx; setTimeout(function(){ if(S.pk.form==='EXPEND') schedSave(); },400); }
  return ovForm('EXPEND',function(){return '';},{render:function(f){
    if(f.id==='center') return '<span class="ovs">'+esc((SITEDEF[S.school]||{}).sname||'')+'</span>';
    if(f.id==='month') return '<span class="ovs">'+MONTHS[+m.slice(5)-1]+'</span>';
    if(f.id==='year') return '<span class="ovs">'+m.slice(0,4)+'</span>';
    if(f.tot){ var n={food:1,nonfood:2,serv:3,milk:4}[f.tot]; return '<div class="ovt" id="et'+n+'">'+(n===4?'0':'0.00')+'</div>'; }
    var mm=/^r(\d+)_(\w+)$/.exec(f.id), r=+mm[1]-1, c=['day','rcpt','payee','food','nonfood','serv','milk'].indexOf(mm[2]);
    return '<input class="ws ovi '+cn[c]+(c>2?' num':'')+'" style="position:static;width:100%;height:100%" '+(c>2?'inputmode="decimal" ':'')+'value="'+esc(((rows[r]||[])[c])||'')+'">';
  }});
}
function labOv(){
  var rows=(pkData('LABOR')||{}).rows||[], m=S.pk.month;
  var ld=pkData('LABOR')||{}, auto=[];
  (S.pk.staff||[]).forEach(function(n){ var c=laborFor(n); if(c!=null) auto.push([n,c]); });
  var have=rows.some(function(r){ return r.some(function(v){return v;}); });
  if(!have&&auto.length){ rows=auto.map(function(a){return [a[1].toFixed(2)];}); setTimeout(function(){ if(S.pk.form==='LABOR') schedSave(); },400); }
  var note=auto.length?'<div class="hint noprint">Filled from each person&rsquo;s Personnel Activity Report (admin + operational hours &times; hourly wage): '+auto.map(function(a,i){return '#'+(i+1)+' '+esc(a[0])+' $'+a[1].toFixed(2);}).join(' &middot; ')+'. Type over any amount to change it.</div>':'<div class="hint noprint">Nothing to pull yet: save each employee&rsquo;s PAR hours first and the amounts fill in here.</div>';
  return ovForm('LABOR',function(id){return id==='sig'?(ld.sig||''):'';},{render:function(f){
    if(f.t==='s') return null;
    if(f.id==='center') return '<span class="ovs">'+esc((SITEDEF[S.school]||{}).sname||'')+'</span>';
    if(f.id==='month') return '<span class="ovs">'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</span>';
    if(f.id==='total') return '<div class="ovt" id="labTot">0.00</div>';
    var i=+f.id.slice(1)-1, r=rows[i]||[], v=r.length?r[r.length-1]:'';
    return '<input class="ws lab ovi num ovl" style="position:static;width:100%;height:100%" inputmode="decimal" value="'+esc(v||'')+'">';
  }})+note;
}
function parQuick(){
  var dopt='<option value="wk">Every weekday (Mon&ndash;Fri)</option><option value="all">Every day of the month</option><option value="mwf">Mon / Wed / Fri</option><option value="tt">Tue / Thu</option><option value="cus">Specific days&hellip;</option>';
  function row(k,lab,def){ return '<div class="qfrow"><b>'+lab+'</b><input class="inp qh" id="qf-'+k+'-h" inputmode="decimal" placeholder="hrs/day" value="'+def+'"><select class="inp" id="qf-'+k+'-d">'+dopt+'</select><input class="inp" id="qf-'+k+'-c" placeholder="e.g. 1,2,5-9" style="display:none"></div>'; }
  return '<div class="card noprint qf"><div class="ct">Quick fill this month</div><div class="sub">Type the hours per day and pick which days. Leave hours blank to skip a column. It only fills the days you pick, so you can still change any box afterward.</div>'+row('a','Admin hours','')+row('o','Operational hours','')+row('r','Regular hours worked','')+row('p','Paid leave hours','')+'<div class="mrow"><button class="btn grn" data-pf="parfill">Fill the table</button><button class="btn sec" data-pf="parclear">Clear this month</button></div></div>';
}
function parDays(sel,txt,dim,y,m){
  var out=[]; for(var d=1;d<=dim;d++){ var w=new Date(y,m-1,d).getDay();
    if(sel==='all'||(sel==='wk'&&w>0&&w<6)||(sel==='mwf'&&(w===1||w===3||w===5))||(sel==='tt'&&(w===2||w===4))) out.push(d); }
  if(sel==='cus'){ String(txt||'').split(',').forEach(function(p){ var r=p.trim().split('-'); var a=+r[0], b=r.length>1?+r[1]:a; for(var d=a;d<=b;d++) if(d>=1&&d<=dim&&out.indexOf(d)<0) out.push(d); }); }
  return out;
}
function parFill(){
  if(isLocked()) return toast('This month is locked.',true);
  var m=S.pk.month, y=+m.slice(0,4), mo=+m.slice(5), dim=new Date(y,mo,0).getDate(), n=0;
  ['a','o','r','p'].forEach(function(k){ var hv=$('qf-'+k+'-h').value.trim(); if(hv==='') return; var days=parDays($('qf-'+k+'-d').value,$('qf-'+k+'-c').value,dim,y,mo);
    days.forEach(function(d){ var i=document.querySelector('.pv[data-d="'+d+'"][data-k="'+k+'"]'); if(i&&!i.disabled){ i.value=hv; n++; } }); });
  parTotals(); postPack(); schedSave(); toast(n?('Filled '+n+' boxes.'):'Nothing to fill - enter hours first.',!n);
}
function parClear(){ if(isLocked()) return; if(!confirm('Clear every hours box on this form?')) return; document.querySelectorAll('.pv').forEach(function(i){ i.value=''; }); parTotals(); postPack(); schedSave(); }
/* ----- signature pad ----- */
var SIGDATE={MEDICAL:{sig:'f:sdate'},DIETARY:{psig:'f:pdate'},INFANTFEED:{psig:'f:pdate'},SITEINFO:{sig:'f:sdate'},PAR:{sigE:'s:sigdate',sigD:'s:sd'}};
function todayUS(){ var d=new Date(); return ('0'+(d.getMonth()+1)).slice(-2)+'/'+('0'+d.getDate()).slice(-2)+'/'+d.getFullYear(); }
function openPad(box){
  if(isLocked()) return toast('This month is locked.',true);
  var ov=document.createElement('div'); ov.className='padov'; ov.innerHTML='<div class="padbox"><div class="ct">Sign here</div><canvas width="700" height="220"></canvas><div class="mrow"><button class="btn sec" data-pad="clear">Clear</button><button class="btn sec" data-pad="cancel">Cancel</button><button class="btn grn" data-pad="save">Use this signature</button></div><div class="hint">Use your finger or mouse. Today&rsquo;s date fills in next to it.</div></div>';
  document.body.appendChild(ov);
  var c=ov.querySelector('canvas'), x=c.getContext('2d'), dr=false, any=false; x.lineWidth=3; x.lineCap='round'; x.lineJoin='round'; x.strokeStyle='#0a2a8a';
  function pos(e){ var r=c.getBoundingClientRect(); return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]; }
  c.style.touchAction='none';
  c.addEventListener('pointerdown',function(e){ dr=true; any=true; var p=pos(e); x.beginPath(); x.moveTo(p[0],p[1]); c.setPointerCapture(e.pointerId); e.preventDefault(); });
  c.addEventListener('pointermove',function(e){ if(!dr) return; var p=pos(e); x.lineTo(p[0],p[1]); x.stroke(); });
  ['pointerup','pointercancel'].forEach(function(t){ c.addEventListener(t,function(){ dr=false; }); });
  ov.addEventListener('click',function(e){ var a=e.target.getAttribute&&e.target.getAttribute('data-pad'); if(!a) return;
    if(a==='clear'){ x.clearRect(0,0,c.width,c.height); any=false; }
    else if(a==='cancel') ov.remove();
    else if(a==='save'){ if(!any) return toast('Draw your signature first.',true);
      var t=document.createElement('canvas'); t.width=350; t.height=110; t.getContext('2d').drawImage(c,0,0,350,110);
      var url=t.toDataURL('image/png'), hid=box.querySelector('input'); hid.value=url; box.querySelector('span,img')&&box.querySelector('span,img').remove(); var im=new Image(); im.src=url; box.insertBefore(im,hid);
      var form=box.getAttribute('data-form'), id=box.getAttribute('data-sig'), dm=(SIGDATE[form]||{})[id];
      if(dm){ var kind=dm.split(':')[0], did=dm.split(':')[1], de=document.querySelector(kind==='f'?'#paper [data-f="'+did+'"]':'#paper [data-sp="'+did+'"]'); if(de&&!de.value) de.value=todayUS(); }
      hid.dispatchEvent(new Event('input',{bubbles:true})); ov.remove(); postPack(); schedSave(); } });
}
document.addEventListener('change',function(e){ var t=e.target; if(t.id&&/^qf-.-d$/.test(t.id)){ var c=$(t.id.replace(/-d$/,'-c')); if(c) c.style.display=t.value==='cus'?'':'none'; } });
document.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('.ovsig'); if(b) openPad(b); });
function parOv(){
  var pk=S.pk, m=pk.month, d=pkData('PAR',pk.emp)||{days:{}}, sp=d.sp||{}, dim=new Date(+m.slice(0,4),+m.slice(5),0).getDate();
  var h=parQuick()+'<label class="fl noprint">Employee <span class="rq">*</span> <span class="hint">(pick from the list or type any name, then press Enter)</span><input id="pEmp" class="inp" list="pEmpL" autocomplete="off" value="'+esc(pk.emp||'')+'"><datalist id="pEmpL">'+(pk.staff||[]).map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist></label>';
  h+=ovForm('PAR',function(id){return sp[id]||'';},{render:function(f){
    if(f.t==='s') return null;
    if(f.id==='center') return '<span class="ovs">'+esc((SITEDEF[S.school]||{}).sname||'')+'</span>';
    if(f.id==='emp') return '<span class="ovs">'+esc(pk.emp||'')+'</span>';
    if(f.id==='month') return '<span class="ovs sm">'+m.slice(5)+'/'+m.slice(0,4)+'</span>';
    if(f.id==='title') return '<input id="pTitle" class="ovi ovl rq-in" style="position:static;width:100%;height:100%" value="'+esc(d.title||'')+'">';
    if(f.tot) return '<div class="ovt" id="pt-'+f.tot+'">0</div>';
    if(PARB.indexOf(f.id)>-1) return false;
    if(f.sp){ var dv=sp[f.id]||''; if(!dv&&(f.id==='aw'||f.id==='ow')) dv=String(wageFor(pk.emp)); return '<input class="ovi ovl spi" data-sp="'+f.id+'" style="position:static;width:100%;height:100%" value="'+esc(dv)+'">'; }
    var r=(d.days||{})[f.day]||{}, off=f.day>dim;
    return '<input class="ovi pv num" data-d="'+f.day+'" data-k="'+f.k+'" inputmode="decimal" style="position:static;width:100%;height:100%" value="'+esc(r[f.k]||'')+'"'+(off?' disabled':'')+'>';
  }});
  var li=h.lastIndexOf('</div>'); h=h.slice(0,li)+'<div class="ovx ovwhite" style="left:4.3%;top:'+(656/792*100).toFixed(3)+'%;width:91%;height:'+(62/792*100).toFixed(3)+'%"></div>'+h.slice(li);
  return h+'<div class="hint noprint">Part A (hourly staff) fills in as you type; wages are filled in for you (type over them if one changes). Part B is not used. The sponsor/director signs the printed copy.</div>';
}
var SD={'Sanford':{cname:'Kid City USA Sanford',street:'1320 Hickory Ave.',city:'Sanford',state:'FL',zip:'32771',phone:'(407) 942-3242',m_br:'1',m_lu:'1',m_as:'1',sv0:'1',sv0_br:'1',sv0_lu:'1',sv0_as:'1'},'DeLand 2':{auth:'4-2677',cname:'Kid City USA DeLand 2',street:'238 S. Armelia Ave.',city:'DeLand',state:'FL',zip:'32724',phone:'386-279-7553',fn:'Shanika',ln:'Preston',title:'Owner',phone2:'386-279-7553',m_br:'1',m_lu:'1',m_as:'1',sv0:'1',sv0_br:'1',sv0_lu:'1',sv0_as:'1',ts_br:'7am',tf_br:'9am',ts_lu:'10:30',tf_lu:'12pm',ts_as:'2pm',tf_as:'4pm'}};

function schImg(k){ return k.toLowerCase()+(S.school==='Sanford'?'_sanford':'_deland'); }
function siteOv(){
  var d=pkData('SITEINFO'), df=SD[S.school]||{}; if(!d) setTimeout(function(){ if(S.pk.form==='SITEINFO') schedSave(); },400);
  d=d||{};
  var h=ovForm('SITEINFO',function(id){ var v=d[id]; return Object.prototype.hasOwnProperty.call(d,id)?v:(df[id]||''); },{img:'siteinfo',render:function(f){ return null; }});
  return h+'<div class="hint noprint">This is the official Child Care Center Site Information form. Yellow boxes are still needed. Sanford&rsquo;s 4C authorization number is not on file yet.</div>';
}
function chkOv(){
  var d=pkData('CHECKLIST')||{c:[],other:[],sug:[]}, m=S.pk.month;
  var h=ovForm('CHECKLIST',function(){return '';},{img:schImg('CHECKLIST'),render:function(f){
    if(f.id==='month') return '<span class="ovs">'+MONTHS[+m.slice(5)-1]+'</span>';
    if(f.id==='year') return '<span class="ovs">'+m.slice(0,4)+'</span>';
    var t=f.id[0], i=+f.id.slice(1);
    if(t==='c') return '<input type="checkbox" class="pc ovc" data-i="'+i+'" style="position:static" '+(d.c&&d.c[i]?'checked':'')+'>';
    if(t==='o') return '<input class="po ovi" style="position:static;width:100%;height:100%" value="'+esc((d.other||[])[i]||'')+'">';
    return '<input class="ps ovi" style="position:static;width:100%;height:100%" value="'+esc((d.sug||[])[i]||'')+'">';
  }});
  return h+'<div class="hint noprint">Tick each item as it goes in the packet. Yellow items are required.</div>';
}
function entOv(){
  var rows=entRows(), m=S.pk.month, sv0=pkData('ENTRANCES')||{};
  var h='<label class="ck2 noprint"><input type="checkbox" id="entNone" '+(sv0.none?'checked':'')+'> <span>No entrances or terminations this month</span></label>';
  h+=ovForm('ENTRANCES',function(){return '';},{img:schImg('ENTRANCES'),render:function(f){
    if(f.id==='month') return '<span class="ovs">'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</span>';
    var r=rows[f.row]||{}, c=f.col==='n';
    return '<input class="'+(c?'en':'ed')+' ovi" style="position:static;width:100%;height:100%" value="'+esc((c?r.n:r.d)||'')+'">';
  }});
  return h+(rows.length>25?'<div class="warnbox">More than 25 entrances &mdash; only the first 25 fit on this page. Tell Charles to add a second page.</div>':'')+'<div class="hint noprint">Pre-filled with children added through the Rooms board this month. Type to fix or add anyone else.</div>';
}
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
  var si=pkData('SITEINFO'); var SREQ=window.OVSPEC.SITEINFO.req, sdf=SD[S.school]||{}; s.SITEINFO={ok:!!si&&SREQ.every(function(k){ var v=si[k]; return String((v==null||v==='')?(sdf[k]||''):v).trim(); }), why:'Site Information still has yellow boxes'};
  var ck=pkData('CHECKLIST'); var need=[0,2,4,5,6,7]; s.CHECKLIST={ok:!!ck&&need.every(function(i){return ck.c&&ck.c[i];}), why:'Check list items still unchecked'};
  var en=pkData('ENTRANCES'); s.ENTRANCES={ok:!!en&&((en.rows&&en.rows.length)||en.none), why:'Entrances not reviewed (add rows or tick "none this month")'};
  var tm=pkData('TERMS'); s.TERMS={ok:!!tm&&((tm.rows&&tm.rows.length)||tm.none), why:'Terminations not reviewed (add rows or tick "none this month")'};
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
  var rows=[['SITEINFO','Site Information'],['CHECKLIST','Monthly Provider Check List'],['ENTRANCES','Monthly Entrances'],['TERMS','Monthly Terminations'],['PAR','Personnel Activity Reports'],['PARENTSIGN','Parent-signed forms'],['RECEIPTS','Receipts'],['EXPEND','Program Expenditures Worksheet'],['LABOR','Labor Summary Worksheet']];
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
  if(S.pk.form==='CHECKLIST'){ var NEED=[0,2,4,5,6,7]; p.querySelectorAll('.pc').forEach(function(c){ var l=c.closest('label')||c; if(l) l.classList.toggle('need',NEED.indexOf(+c.getAttribute('data-i'))>-1&&!c.checked); }); }
  if(S.pk.form==='PAR'){ ['pAuth','pTitle'].forEach(function(id){ var e=$(id); if(e) e.classList.toggle('need',!e.value.trim()); }); }
  if(S.pk.form==='ENTRANCES'){ var nn=$('entNone'), has=[].some.call(p.querySelectorAll('.en'),function(x){return x.value.trim();}); p.classList.toggle('needbox',!(nn&&nn.checked)&&!has); }
  if(isLocked()) p.querySelectorAll('input,select,textarea').forEach(function(i){ i.disabled=true; });
}
/* ----- saving ----- */
function collect(form){
  var pk=S.pk, data={}, emp='';
  if(form==='CHECKLIST'){ data={c:[].map.call(document.querySelectorAll('.pc'),function(x){return x.checked;}),other:[].map.call(document.querySelectorAll('.po'),function(x){return x.value;}),sug:[].map.call(document.querySelectorAll('.ps'),function(x){return x.value;})}; }
  else if(form==='ENTRANCES'){ var n=document.querySelectorAll('.en'), dd=document.querySelectorAll('.ed'), rows=[]; for(var i=0;i<n.length;i++) if(n[i].value.trim()||dd[i].value.trim()) rows.push({n:n[i].value.trim(),d:dd[i].value.trim()}); var nn=$('entNone'); data={rows:rows,none:!!(nn&&nn.checked)}; }
  else if(form==='TERMS'){ data=termCollect(); }
  else if(form==='PAR'){ emp=pk.emp; var days={}; document.querySelectorAll('.pv').forEach(function(x){ if(x.value.trim()){ var k=x.getAttribute('data-d'); (days[k]=days[k]||{})[x.getAttribute('data-k')]=x.value.trim(); } }); var sp={}; document.querySelectorAll('.spi').forEach(function(x){ if(x.value.trim()) sp[x.getAttribute('data-sp')]=x.value.trim(); }); data={auth:'',title:($('pTitle')||{value:''}).value.trim(),days:days,sp:sp}; }
  else if(form==='SITEINFO'||KF[form]){ if(KF[form]) emp=pk.kid||''; document.querySelectorAll('#paper [data-f]').forEach(function(x){ data[x.getAttribute('data-f')]=x.type==='checkbox'?(x.checked?'1':''):x.value.trim(); }); if(KF[form]&&!emp) return null; }
  else if(form==='EXPEND'||form==='LABOR'){ var per=form==='EXPEND'?7:1, all=[].map.call(document.querySelectorAll('#paper input.ws'),function(x){return x.value.trim();}), rows=[]; for(var q=0;q<all.length;q+=per) rows.push(all.slice(q,q+per)); data={rows:rows}; var sgl=document.querySelector('#paper [data-f=sig]'); if(sgl&&form==='LABOR') data.sig=sgl.value; }
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
  var wg=wageFor(S.pk.emp); ['aw','ow'].forEach(function(k){ var e=g(k); if(e&&!e.value) e.value=wg; });
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
  h+='<label class="btn sm sec" style="display:inline-block;cursor:pointer">'+(up.length?'Add another page':'Upload signed copy')+'<input type="file" class="pfup" data-i="'+i+'" accept="image/*,.pdf,application/pdf" multiple style="display:none"></label>';
  if(S.upBusy===i) h+=' <span class="hint">Uploading&hellip;</span>';
  return h+'</div>';
}
function fileToB64(file){
  return new Promise(function(res,rej){
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||'')){ if(file.size>5.5*1024*1024) return rej(new Error('That PDF is over 5 MB. Scan at a lower size, or file it in Monthly Reporting (Audit Vault) which takes up to 12 MB.')); var fr=new FileReader(); fr.onload=function(){ res({b64:String(fr.result).split(',')[1],mime:'application/pdf'}); }; fr.onerror=function(){ rej(new Error('Could not read the file')); }; fr.readAsDataURL(file); return; }
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
  var mf=[['CHECKLIST','Monthly Provider Check List'],['ENTRANCES','Monthly Entrances'],['TERMS','Monthly Terminations'],['PAR','Personnel Activity Report']];
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
  if(el.hasAttribute('data-pf')){ var a2=el.getAttribute('data-pf'),pk=S.pk; if(a2==='prev'||a2==='next'){ flushSave().then(function(){ pk.month=shiftMonth(pk.month,a2==='prev'?-1:1); pk.loaded=''; render(); }); } else if(a2==='form'){ var fv=el.getAttribute('data-v'); flushSave().then(function(){ pk.form=fv; render(); }); } else if(a2==='save') savePacket(); else if(a2==='submit') submitPacket(); else if(a2==='parfill') parFill(); else if(a2==='parclear') parClear(); else if(a2==='print'){ var ls=pk.form==='EXPEND', stt=$('pgst'); if(!stt){ stt=document.createElement('style'); stt.id='pgst'; document.head.appendChild(stt); } stt.textContent='@page{size:letter '+(ls?'landscape':'portrait')+';margin:'+(/^(SITEINFO|CHECKLIST|ENTRANCES|MEDICAL|DIETARY|INFANTFEED|PAR|LABOR|EXPEND)$/.test(pk.form)?'0':'0.4in')+'}'; window.print(); } return; }
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
api('whoami').then(function(w){ S.school=w.school; try{var q=new URLSearchParams(location.search);if(q.get('date')&&/^\d{4}-\d{2}-\d{2}$/.test(q.get('date')))S.date=q.get('date');if(q.get('tab'))S.tab=q.get('tab');if(q.get('form')&&S.pk&&PFORMS.some(function(p){return p[0]===q.get('form');}))S.pk.form=q.get('form');}catch(e){} render(); return ensureData(); }).then(function(){ try{var c=new URLSearchParams(location.search).get('cell');if(c){var p=c.split('|');if(FORMS[p[0]])openCell(p[0],p[1],p[2]);}}catch(e){} }).catch(function(e){ document.getElementById('app').innerHTML='<div class="card"><b>'+esc(e.message)+'</b><br><a class="btn" href="index.html">Back to sign in</a></div>'; });
/* ===== add-on 11/4/26: weekly attendance & meal count reports + monthly terminations ===== */
/* DCF Binder add-on (11/4/26): Weekly Attendance & Meal Count Reports per classroom + Monthly Terminations form.
   Loaded after dcf.js. Uses dcf.js globals (S, api, esc, addDays, monday, MONTHS, HDR, pkData ...). */
(function(){
var LOGO='data:image/png;base64,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';
var REPH={'DeLand 2':{name:'Kid City USA Deland 2 Inc (573)',phone:'(386) 279-7553',sponsor:'Child Care of Southwest Florida (U-2677)',sphone:'(239) 936-0899'},
          'Sanford':{name:'Kid City USA Sanford',phone:'(407) 942-3242',sponsor:'Community Coordinated Child Care (4C)',sphone:'(407) 522-2252'}};
var ROWS=22;
S.rep={rooms:null,kids:null,room:'',loading:false};
var css=document.createElement('style');
css.textContent='\
.rpbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0}\
.rpbar .b{font-weight:700}\
.rpscroll{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px;margin-top:8px}\
.rp{position:relative;width:1060px;margin:0 auto;font:11px Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:6px 10px 4px 30px}.rp td.age{overflow:visible}\
.rp .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;min-height:58px}\
.rp .hl{width:32%;font-size:10px}.rp .hl b{font:700 17px Georgia,serif;display:block;margin-top:6px}.rp .hl i{font:12px Georgia,serif;font-style:normal;display:block;margin-left:60px}\
.rp .hc{width:36%;text-align:center}.rp .hc b{font:700 19px Georgia,serif;text-decoration:underline}.rp .hc div{font-size:14px;margin-top:2px}\
.rp .hr{width:32%;text-align:right}.rp .hr b{font:700 14px Georgia,serif}.rp .hr i{font:12px Georgia,serif;font-style:normal;display:block}\
.rp table{border-collapse:collapse;width:100%;table-layout:fixed;border:2px solid #000}\
.rp td,.rp th{border:1px solid #000;padding:0;text-align:center;font-weight:400;overflow:hidden;white-space:nowrap}\
.rp .dg{border-left:2px solid #000}\
.rp th.dayh{font:13px Georgia,serif;line-height:1.25;height:38px}\
.rp th.dayh small{display:block;font-size:12px}\
.rp .cl{text-align:left;font:13px Georgia,serif;padding:0 4px;height:38px;vertical-align:bottom}\
.rp .sh th{font:11px Georgia,serif;height:19px}\
.rp tr.kid td{height:19px;font-size:11px}.rp td.nm{text-align:left;padding-left:3px;font:12px Georgia,serif}.rp td.age{font-size:10px;text-align:left;padding-left:2px}.rp td.nbr{font:12px Georgia,serif}\
.rp td.rn{border:0;border-right:1px solid #000;font-size:10px;text-align:right;padding-right:2px;background:#fff;width:20px}\
.rp td.x{font-weight:700;font-size:12px}.rp td.dsh{font-size:10px}\
.rp .lab{text-align:left;font:12px Georgia,serif;padding:0 4px}.rp .labr{text-align:right;font:13px Georgia,serif;padding-right:8px}\
.rp tr.tot td{height:24px;font-weight:700;font-size:11px}\
.rp.rpblue{background:#cfe6f7!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.rp.rpblue td,.rp.rpblue th{background:transparent}\
.rpscroll .rp td[data-ed]{cursor:pointer}.rpscroll .rp td[data-ed]:hover{outline:2px solid #1565c0;background:rgba(21,101,192,.12)}\
.rp .sq{position:absolute;width:22px;height:22px;background:#222}\
.rp .ft{display:flex;gap:12px;align-items:flex-end;margin-top:6px;font:11px Georgia,serif}\
.rp .ft .id{font:700 18px Georgia,serif;line-height:1.1;width:130px}\
.rp .ft .cert{flex:1;font-size:10.5px;line-height:1.3}\
.rp .ft .sg{width:390px;white-space:nowrap;text-align:right;font:700 13px Georgia,serif}\
.rp .ft .sg span{display:inline-block;border-bottom:1px solid #000;width:150px;margin-left:4px}\
.rp .pg{position:absolute;right:14px;bottom:62px;font:11px Arial}\
#repprint{display:none}\
.tf{max-width:760px;margin:0 auto;font-family:Georgia,"Times New Roman",serif;color:#000}\
.tf .lh2{font:600 14px Arial,sans-serif;text-align:center;line-height:1.35;margin-bottom:12px}\
.tf .row1{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:2px}.tf .row1 img{height:70px}\
.tf .mo{font-size:19px}.tf .mo input{border:0;border-bottom:1px solid #000;font:19px Georgia,serif;width:230px;background:transparent}\
.tf h2.tt{text-align:center;font:400 21px Georgia,serif;margin:0 0 -2px 70px}\
.tf table{border-collapse:collapse;width:100%;border:1px solid #000}.tf th{font:400 20px Georgia,serif;border:1px solid #000;padding:2px}\
.tf td{border:1px solid #000;padding:0;height:29px}.tf td input{width:100%;height:100%;border:0;background:transparent;font:15px Georgia,serif;padding:0 6px}\
.tf .upd{font:13px Calibri,Arial,sans-serif;margin-top:34px}\
@media print{body.repmode #app,body.repmode .toast{display:none!important}body.repmode{background:#fff}body.repmode #repprint{display:block}#repprint .rp{width:100%;max-width:none;page-break-after:always;break-after:page}#repprint .rp:last-child{page-break-after:auto;break-after:auto}.rpscroll{border:0;padding:0}}';
document.head.appendChild(css);
var pc=document.createElement('div'); pc.id='repprint'; document.body.appendChild(pc);

/* ---------- helpers ---------- */
function fmtMD(s,yy){ var p=s.split('-'); return (+p[1])+'/'+(+p[2])+(yy?'/'+p[0].slice(2):''); }
function fmtFull(s){ var p=s.split('-'); return p[1]+'/'+p[2]+'/'+p[0]; }
var DN=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
function ageOf(dob,asOf){ if(!dob) return ''; var a=dob.split('-'), b=asOf.split('-'); var m=(+b[0]-+a[0])*12+(+b[1]-+a[1]); if(+b[2]<+a[2]) m--; if(m<0) return ''; return Math.floor(m/12)+'y '+(m%12)+'m'; }
function nowStamp(){ var d=new Date(), o={timeZone:'America/New_York'}; var dt=d.toLocaleDateString('en-US',Object.assign({year:'numeric',month:'2-digit',day:'2-digit'},o)); var t=d.toLocaleTimeString('en-US',Object.assign({hour:'numeric',minute:'2-digit'},o)).toLowerCase(); var tz=(d.toLocaleTimeString('en-US',Object.assign({timeZoneName:'short'},o)).split(' ').pop()); return dt+'<br>'+t.replace(' ',' ')+' '+tz; }
function nkey(n){ return String(n||'').trim().toLowerCase(); }
function loadRep(){
  if(S.rep.loading||S.rep.rooms) return; S.rep.loading=true;
  Promise.all([api('list','Rooms'),api('list','Room Children')]).then(function(r){
    S.rep.rooms=(r[0].records||[]).map(function(x){return x.fields;}).filter(function(f){return f.Room&&f.Active!==false;}).sort(function(a,b){return (a.Order||99)-(b.Order||99);});
    S.rep.kids=(r[1].records||[]).map(function(x){return x.fields;});
  }).catch(function(e){ toast(e.message,true); S.rep.rooms=[]; S.rep.kids=[]; }).then(function(){ S.rep.loading=false; render(); });
}
function kidsFor(room,mon){
  var days=[0,1,2,3,4].map(function(i){return addDays(mon,i);}), seen={}, out=[];
  (S.rep.kids||[]).forEach(function(k){
    if(k.Room!==room) return;
    var st=(k.Status&&k.Status.name)||k.Status||''; var wd=k['Withdrawn Date']||'';
    if(/withdr/i.test(st)&&(!wd||wd<mon)) return;
    var key=nkey(k.Child); if(!key||seen[key]) return; seen[key]=1; out.push({n:k.Child,dob:k.DOB||''});
  });
  S.att.forEach(function(a){ var f=a.fields; if(days.indexOf(f.Date)<0) return; if((f['Home Room']||f['Current Room'])!==room) return; var key=nkey(f.Child); if(!key||seen[key]) return; seen[key]=1; out.push({n:f.Child,dob:''}); });
  out.sort(function(a,b){return nkey(a.n)<nkey(b.n)?-1:1;});
  return out;
}
function markFor(name,date){
  var key=nkey(name), r=null; S.att.forEach(function(a){ var f=a.fields; if(f.Date===date&&nkey(f.Child)===key) r=f; });
  if(!r) return null; return {att:!!(r.Arrival), b:!!r.B, l:!!r.L, p:!!r.P};
}
function repPages(room,mon){
  var kids=kidsFor(room,mon), n=Math.max(1,Math.ceil(kids.length/ROWS)), pages=[];
  for(var p=0;p<n;p++) pages.push(repPage(room,mon,kids.slice(p*ROWS,(p+1)*ROWS),p+1,n));
  return pages;
}
function repPage(room,mon,kids,pg,np){
  var H=REPH[S.school]||REPH['Sanford'], days=[0,1,2,3,4].map(function(i){return addDays(mon,i);});
  var sat=addDays(mon,5), sun=addDays(mon,6);
  var h='<div class="rp'+(S.school==='DeLand 2'?' rpblue':'')+'"><div class="sq" style="left:10px;top:92px"></div><div class="sq" style="right:10px;top:104px"></div>';
  h+='<div class="hd"><div class="hl"><span>'+nowStamp()+'</span><b>'+esc(H.name)+'</b><i>'+esc(H.phone)+'</i></div>';
  h+='<div class="hc"><b>Weekly Attendance &amp; Meal Count Report</b><div>Week Of: '+fmtMD(mon,1)+'-'+fmtMD(sat,1)+' (Mon '+fmtMD(mon)+'-Sun '+fmtMD(sun)+')</div></div>';
  h+='<div class="hr"><b>Sponsor: '+esc(H.sponsor)+'</b><i>'+esc(H.sphone)+'</i></div></div>';
  h+='<table><colgroup><col style="width:5%"><col style="width:4%"><col style="width:20%">'; for(var c=0;c<35;c++) h+='<col>'; h+='</colgroup>';
  h+='<tr><th colspan="3" class="cl">CLASSROOM #: &nbsp; <span style="font:14px Georgia">'+esc(room)+'</span></th>';
  days.forEach(function(d,i){ h+='<th colspan="7" class="dayh dg">'+fmtFull(d)+'<small>'+DN[i]+'</small></th>'; }); h+='</tr>';
  h+='<tr class="sh"><th>AGE</th><th>NBR</th><th>CHILD NAME</th>';
  days.forEach(function(){ ['Att','B','','L','P','',''].forEach(function(t,j){ h+='<th'+(j===0?' class="dg"':'')+'>'+t+'</th>'; }); }); h+='</tr>';
  var tot=days.map(function(){return {a:0,b:0,l:0,p:0};});
  for(var r=0;r<ROWS;r++){
    var k=kids[r]; h+='<tr class="kid"><td class="age" style="position:relative"><span class="rn" style="position:absolute;left:-22px;top:3px;width:18px;text-align:right;font-size:10px">'+(r+1)+'</span>'+(k?esc(ageOf(k.dob,mon)):'')+'</td><td class="nbr"></td><td class="nm">'+(k?esc(String(k.n).toUpperCase()):'')+'</td>';
    days.forEach(function(d,i){
      var m=k?markFor(k.n,d):null; if(m&&m.att){tot[i].a++;} if(m&&m.b)tot[i].b++; if(m&&m.l)tot[i].l++; if(m&&m.p)tot[i].p++;
      var ed=function(col){ return k?' data-ed="'+esc(k.n)+'|'+d+'|'+col+'|'+esc(room)+'"':''; };
      h+='<td class="x dg"'+ed('a')+'>'+(m&&m.att?'X':'')+'</td><td class="x"'+ed('B')+'>'+(m&&m.b?'X':'')+'</td><td class="dsh">-</td><td class="x"'+ed('L')+'>'+(m&&m.l?'X':'')+'</td><td class="x"'+ed('P')+'>'+(m&&m.p?'X':'')+'</td><td class="dsh">-</td><td class="dsh">-</td>';
    });
    h+='</tr>';
  }
  h+='<tr><td colspan="3" class="lab" style="height:24px;border-top:2px solid #000">* Special Diet</td>'; days.forEach(function(){ h+='<td colspan="7" class="dg" style="border-top:2px solid #000"></td>'; }); h+='</tr>';
  h+='<tr class="tot"><td colspan="3" class="labr">Daily Totals:</td>'; days.forEach(function(d,i){ var t=tot[i], has=kids.length&&(t.a||t.b||t.l||t.p); [t.a,t.b,'',t.l,t.p,'',''].forEach(function(v,j){ h+='<td'+(j===0?' class="dg"':'')+'>'+(v===''?'':(has?v:''))+'</td>'; }); }); h+='</tr>';
  h+='<tr class="tot"><td colspan="3" class="labr" style="font-weight:400">Total Nbr of Program Staff Meals:</td>'; days.forEach(function(){ for(var j=0;j<7;j++) h+='<td class="dsh'+(j===0?' dg':'')+'" style="font-weight:400">-</td>'; }); h+='</tr></table>';
  h+='<div class="sq" style="left:10px;bottom:46px"></div><div class="sq" style="right:10px;bottom:46px"></div>';
  h+='<div class="ft"><div class="id">CXFORMID1008</div><div class="cert">I certify that the information on this form is true and correct to the best of my knowledge and that I will claim reimbursement only for eligible meals served to eligible participants. I understand that misrepresentation may result in prosecution under applicable state or federal statutes. &nbsp; <b>Mark only an &ldquo;X&rdquo; within the lines!</b> &nbsp;This may be read by a machine.</div><div class="sg">Teacher:<span></span> &nbsp; Date:<span style="width:90px"></span></div></div>';
  h+='<div class="pg">Page '+pg+' of '+np+'</div></div>';
  return h;
}


/* ---------- editable weekly report: click a cell to add/remove a mark (director only, saves to the Rooms board data) ---------- */
function repEdit(spec){
  var p=spec.split('|'), name=p[0], date=p[1], col=p[2], room=p[3], key=nkey(name), rec=null;
  S.att.forEach(function(a){ var f=a.fields; if(f.Date===date&&nkey(f.Child)===key) rec=a; });
  var done=function(res){ var r=res&&res.records?res.records[0]:res; if(r&&r.id){ S.att=S.att.filter(function(t){return t.id!==r.id;}); S.att.push(r); toast('Saved.'); render(); } else toast('Did not save',true); };
  var fail=function(e){ toast(e.message||'Did not save',true); };
  if(col==='a'){
    if(rec&&rec.fields.Arrival){ if(!confirm('Remove the attendance mark for '+name+' on '+date+'? (Clears the arrival time)')) return; api('update','Room Attendance',{recordId:rec.id,fields:{Arrival:'','Arrival By':'Director edit'}}).then(done).catch(fail); return; }
    var t=prompt('Arrival time for '+name+' (24-hour, like 07:30):','07:30'); if(!t) return; if(!/^\d{1,2}:\d{2}$/.test(t.trim())){ toast('Enter a time like 07:30',true); return; } t=('0'+t.trim()).slice(-5);
    if(rec) api('update','Room Attendance',{recordId:rec.id,fields:{Arrival:t,'Arrival By':'Director edit'}}).then(done).catch(fail);
    else api('create','Room Attendance',{fields:{Key:S.school+'|'+date+'|'+name,Child:name,Date:date,'Home Room':room,Arrival:t,'Arrival By':'Director edit'}}).then(done).catch(fail);
    return;
  }
  var nv=!(rec&&rec.fields[col]), fields={}; fields[col]=nv;
  if(rec) api('update','Room Attendance',{recordId:rec.id,fields:fields}).then(done).catch(fail);
  else { fields.Key=S.school+'|'+date+'|'+name; fields.Child=name; fields.Date=date; fields['Home Room']=room; api('create','Room Attendance',{fields:fields}).then(done).catch(fail); }
}
/* ---------- Attendance tab ---------- */
var oldAtt=attView;
attView=function(){
  var base=oldAtt?oldAtt():'';
  base=base.replace(/<div class="hint">Full rosters[\s\S]*$/,'<div class="hint">Weekly forms are below. Room times and ratios print from the Rooms board.</div><a class="btn sec" href="rooms.html">Open Rooms board</a></div>');
  if(!S.rep.rooms){ loadRep(); return base+'<div class="card">Loading classrooms&hellip;</div>'; }
  var mon=monday(S.date), sat=addDays(mon,5);
  var h='<div class="card"><div class="ct">Weekly Attendance &amp; Meal Count Reports</div><div class="sub">Same form as the KidKare report, one per classroom. Tap any box to add or remove a mark. Tap a classroom to see it filled in. Print any time.</div>';
  h+='<div class="rpbar"><button class="btn sec sm" data-rep="prev">&lsaquo;</button><span class="b">Week of '+fmtMD(mon,1)+' &ndash; '+fmtMD(addDays(mon,4),1)+'</span><button class="btn sec sm" data-rep="next">&rsaquo;</button><button class="btn sec sm" data-rep="thisweek">This week</button></div><div class="rpbar">';
  S.rep.rooms.forEach(function(r){ h+='<button class="btn'+(S.rep.room===r.Room?'':' sec')+'" data-rep="room" data-v="'+esc(r.Room)+'">'+esc(r.Room)+'</button>'; });
  h+='</div><div class="rpbar"><button class="btn grn sm" data-rep="print"'+(S.rep.room?'':' disabled')+'>Print this classroom</button><button class="btn sec sm" data-rep="printall">Print all classrooms</button></div></div>';
  if(S.rep.room){ var pgs=repPages(S.rep.room,mon); h+='<div class="rpscroll" id="reppage">'+pgs.join('<div style="height:14px"></div>')+'</div>'; }
  return base+h;
};
document.addEventListener('click',function(e){
  var ce=e.target.closest&&e.target.closest('.rpscroll td[data-ed]'); if(ce){ repEdit(ce.getAttribute('data-ed')); return; }
  var el=e.target.closest&&e.target.closest('[data-rep]'); if(!el) return; var a=el.getAttribute('data-rep');
  if(a==='prev'||a==='next'){ S.date=addDays(S.date,a==='prev'?-7:7); ensureData(); render(); }
  else if(a==='thisweek'){ S.date=todayNY(); ensureData(); render(); }
  else if(a==='room'){ S.rep.room=el.getAttribute('data-v'); render(); }
  else if(a==='print'||a==='printall'){
    var mon=monday(S.date), rooms=a==='print'?[S.rep.room]:S.rep.rooms.map(function(r){return r.Room;}), html='';
    rooms.forEach(function(r){ html+=repPages(r,mon).join(''); });
    $('repprint').innerHTML=html; doPrint('landscape');
  }
});
function doPrint(orient){
  var st=document.createElement('style'); st.textContent='@page{size:'+orient+';margin:.25in}'; document.head.appendChild(st);
  document.body.classList.add('repmode');
  var done=function(){ document.body.classList.remove('repmode'); st.remove(); $('repprint').innerHTML=''; window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint',done); setTimeout(function(){ window.print(); },60);
}
window.repDoPrint=doPrint;

/* ---------- Monthly Terminations (packet tab) ---------- */
function fmtUS(s){ if(!s) return ''; var p=s.split('-'); return p.length===3?(+p[1])+'/'+(+p[2])+'/'+p[0]:s; }
window.termRows=function(){
  var pk=S.pk, saved=pkData('TERMS'); if(saved&&saved.rows) return saved.rows;
  var m=pk.month, out=[];
  (pk.kids||[]).forEach(function(k){ var f=k.fields, st=(f.Status&&f.Status.name)||f.Status||''; var wd=f['Withdrawn Date']||''; if(/withdr/i.test(st)&&wd.slice(0,7)===m) out.push({n:f.Child,d:fmtUS(wd),s:wd}); });
  return out.sort(function(a,b){return a.s<b.s?-1:1;}).map(function(r){return {n:r.n,d:r.d};});
};
window.termForm=function(){
  var rows=termRows(), m=S.pk.month, sv0=pkData('TERMS')||{}, H=HDR[S.school]||[];
  var h='<label class="ck2 noprint"><input type="checkbox" id="termNone" '+(sv0.none?'checked':'')+'> <span>No terminations this month</span></label><div class="tf">';
  h+='<div class="lh2">'+H.map(esc).join('<br>')+'</div>';
  h+='<div class="row1">'+(S.school==='DeLand 2'?'<img src="'+LOGO+'" alt="Child Care of Southwest Florida">':'<span></span>')+'<div class="mo">Month: <input value="'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'" readonly></div></div>';
  h+='<h2 class="tt">Monthly Terminations</h2><table><tr><th style="width:52%">Childs Name</th><th>Termination Date</th></tr>';
  for(var i=0;i<26;i++){ var r=rows[i]||{}; h+='<tr><td><input class="tn" value="'+esc(r.n||'')+'"></td><td><input class="td" value="'+esc(r.d||'')+'"></td></tr>'; }
  h+='</table><div class="upd">Updated 6.18.19</div></div>';
  return h+(rows.length>26?'<div class="warnbox">More than 26 terminations &mdash; only the first 26 fit on this page. Tell Charles to add a second page.</div>':'')+'<div class="hint noprint">Pre-filled with children withdrawn through the Rooms board this month. Type to fix or add anyone else.</div>';
};
window.termCollect=function(){
  var n=document.querySelectorAll('.tn'), d=document.querySelectorAll('.td'), rows=[]; for(var i=0;i<n.length;i++) if(n[i].value.trim()||d[i].value.trim()) rows.push({n:n[i].value.trim(),d:d[i].value.trim()});
  var nn=document.getElementById('termNone'); return {rows:rows,none:!!(nn&&nn.checked)};
};
})();

window.__dcf={S:S,cellState:cellState,missingList:missingList,drillMissing:drillMissing,parseItems:parseItems};
})();
