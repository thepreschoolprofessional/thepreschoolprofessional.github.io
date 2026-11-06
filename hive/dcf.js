/* THE HIVE - DCF Binder (director-only). Reads the same Airtable records the teacher portal, Friday PDFs and weekly emails use.
   Director edits write back to those same records. Built 11/2/26. */
(function(){
'use strict';
var PIN = sessionStorage.getItem('hivePin');
if(!PIN || sessionStorage.getItem('hiveRole')!=='director'){ location.href='index.html'; return; }
var API='dcf-api.php';
var NY='America/New_York';

/* ---------- config: what is expected, and the paper form items ---------- */
var CLASSROOMS = { 'Sanford':['Honeybees - Tod./Inf.','VPK/Pre-School (Pollen-Jocks)','Schoolagers (Worker Bees)'], 'DeLand 2':['Infant/Toddler','Honey Bees - Tod. Front',"Three's - Honey Combs","Four's - Honey Combs"] };
var RM_LEGACY = { 'Sanford':{'Ones':'Honeybees - Tod./Inf.','Fours / VPK':'VPK/Pre-School (Pollen-Jocks)','School Age':'Schoolagers (Worker Bees)'}, 'DeLand 2':{'Infant Room':'Infant/Toddler','Ones':'Honey Bees - Tod. Front','Twos':'Honey Bees - Tod. Front','Threes':"Three's - Honey Combs"} };
function rmKey(r){ var m=RM_LEGACY[(typeof S!=='undefined'&&S.school)||'']||{}; return m[r]||r; }
var BLDG='Whole Building / Common Areas';
var CLOSED = ['2026-07-03','2026-07-31','2026-09-07','2026-11-11','2026-11-26','2026-11-27','2026-12-23','2026-12-24','2026-12-25','2027-01-01','2027-01-18','2027-03-26','2027-05-31','2027-06-18']; /* both schools; from the signed 2026-27 ELC holiday schedule (School Closures Tracker). Add any extra closed day here. */
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
  for(var id in S.subs){ var x=S.subs[id].fields; if(x.Date!==date) continue; if(sv(x['Form Type'])!==f.type) continue; if(room && f.per==='room' && rmKey(sv(x['Room / Classroom']))!==room) continue; out.push(S.subs[id]); }
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
    return !Object.keys(S.subs).some(function(id){ var x=S.subs[id].fields; return sv(x['Form Type'])===FORMS.drl.type && x.Date>=ms && x.Date<=me && (drillInfo(S.subs[id]).type==='Fire'); });
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
  h+='<div class="tabs">'+TABS.filter(function(x){ return FROMREP || S.tab===x.id || !(x.id==='food'||x.id==='pack'); }).map(function(x){ return '<button class="tab'+(S.tab===x.id?' on':'')+'" data-tab="'+x.id+'">'+x.label+(x.id==='miss'&&mt?' <span class="red">'+mt+'</span>':'')+'</button>'; }).join('')+'</div>';
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
var DTYPES=['Fire','Alternate route','Nap-time','Lockdown','Inclement weather','Other emergency'];
function drillInfo(r){ var d=String(r.fields.Details||''), i=d.indexOf('DRILL:'); var o={}; if(i>-1){ try{ o=JSON.parse(d.slice(i+6).split('\n')[0]); }catch(e){} } o.date=r.fields.Date; o.by=r.fields['Staff Name']||''; o.id=r.id; if(!o.type) o.type='Fire'; return o; }
function drillRows(from,to){ var rows=[]; for(var id in S.subs){ var x=S.subs[id]; if(sv(x.fields['Form Type'])===FORMS.drl.type && x.fields.Date>=from && x.fields.Date<=to) rows.push(drillInfo(x)); } rows.sort(function(a,b){return a.date<b.date?-1:1;}); return rows; }
var _mainLibs=null;
function loadLibs(){
  if(_mainLibs) return _mainLibs;
  function sc(src){ return new Promise(function(res,rej){ var el=document.createElement('script'); el.src=src; el.onload=res; el.onerror=function(){ rej(new Error('Could not load '+src)); }; document.head.appendChild(el); }); }
  _mainLibs=(window.PDFLib?Promise.resolve():sc('pdf-lib.min.js?v=117')).catch(function(e){ _mainLibs=null; throw e; });
  return _mainLibs;
}
function drillEnsureP(yr){
  var key='drl|'+yr; if(S.loaded[key]===true) return Promise.resolve();
  if(S.loaded[key] && S.loaded[key].then) return S.loaded[key];
  S.loaded[key]=api('list','Facility Submissions',{from:yr+'-01-01',to:yr+'-12-31',formType:'drl'}).then(function(res){ (res.records||[]).forEach(function(x){ S.subs[x.id]=x; }); S.loaded[key]=true; }).catch(function(e){ S.loaded[key]='err'; toast('Could not load all of the year\'s drills: '+e.message,true); });
  return S.loaded[key];
}
function drillEnsure(yr){ var key='drl|'+yr; if(S.loaded[key]) return; drillEnsureP(yr).then(function(){ render(); }); }
function drillView(){
  var t=todayNY(), yr=S.date.slice(0,4); drillEnsure(yr);
  var _yl=S.loaded['drl|'+yr]!==true && S.loaded['drl|'+yr]!=='err', rows=drillRows(addDays(t,-365)>yr+'-01-01'?addDays(t,-365):yr+'-01-01', '9999-12-31');
  var y0=yr+'-01-01', y1=yr+'-12-31', yrows=drillRows(y0,y1), h='<div class="card"><div class="ct">Fire &amp; emergency drill log &mdash; '+yr+'</div>';
  h+=(_yl?'<div class="sub"><b>Loading all of '+yr+'&hellip;</b></div>':'')+'<div class="sub">DCF: a fire drill every month at varied dates and times. Once a year: alternate-route, nap-time, lockdown and inclement-weather drills. Keep records 12 months.</div>';
  h+='<div style="margin:8px 0">'+DTYPES.slice(1,5).map(function(ty){ var n=yrows.filter(function(r){return r.type===ty;}).length; return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:4px 10px;border-radius:12px;font-weight:700;background:'+(n?'#e3f4e8':'#fdeaea')+';color:'+(n?'#1c7c3f':'#b71c1c')+'">'+(n?'&#10003; ':'&#9679; ')+ty+': '+(n?n+' done':'needed in '+yr)+'</span>'; }).join('')+'</div>';
  h+='<div class="tbl" style="overflow:auto"><table class="gr" style="font-size:12px;border-collapse:collapse"><tr><th>Month</th><th>Date</th><th>Time</th><th>Type</th><th>Adults</th><th>Children</th><th>Time to clear</th><th>Route</th><th>Extinguisher checked</th><th>Comments</th><th>Dir.</th><th></th></tr>';
  for(var m=1;m<=12;m++){ var mk=yr+'-'+(m<10?'0':'')+m, mr=yrows.filter(function(r){return r.date.slice(0,7)===mk;}), mn=d2(mk+'-01').toLocaleDateString('en-US',{month:'short'});
    var fires=mr.filter(function(r){return r.type==='Fire';}).length;
    if(!mr.length) h+='<tr><td><b>'+mn+'</b></td><td colspan="10" style="color:'+(mk<t.slice(0,7)||(mk===t.slice(0,7)&&+t.slice(8)>=25)?'#b71c1c':'#999')+'">'+(mk<=t.slice(0,7)?'No drill logged':'&mdash;')+'</td><td>'+(mk<=t.slice(0,7)?'<button class="btn sec sm" data-adddrill="'+mk+'">Add</button>':'')+'</td></tr>';
    else mr.forEach(function(r,i){ h+='<tr><td>'+(i?'':'<b>'+mn+'</b>')+'</td><td>'+nice(r.date)+'</td><td>'+esc(r.time||'')+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.adults||'')+'</td><td>'+esc(r.kids||'')+'</td><td>'+esc(r.clear||'')+'</td><td>'+esc(r.route||'')+'</td><td>'+esc(r.ext||'')+'</td><td>'+esc(r.note||'')+'</td><td>'+esc(r.init||'')+'</td><td><button class="btn sec sm" data-cell="drl|'+r.date+'|(building)|'+r.id+'">open</button></td></tr>'; }); }
  h+='</table></div><div class="mrow" style="margin-top:8px"><button class="btn grn" data-adddrill="'+t+'">Log a drill</button> <button class="btn" data-ofgo="drill">See &amp; print the official fire log</button> <button class="btn sec" data-dact="vault">Save log to vault</button> <label class="btn sec" style="margin:0;cursor:pointer">Upload a paper log (photo or PDF)<input type="file" accept="image/*,application/pdf" style="display:none" data-dact="upload"></label></div></div>';
  return h;
}
function ascii(s){ return String(s==null?'':s).replace(/[^\x20-\x7e]/g,''); }
function drillPdf(yr){ return drillEnsureP(yr).then(function(){ return drillPdf0(yr); }); }
function drillPdf0(yr){
  var rows=drillRows(yr+'-01-01',yr+'-12-31'), fire=rows.filter(function(r){return r.type==='Fire'||r.type==='Alternate route'||r.type==='Nap-time';}), em=rows.filter(function(r){return !(r.type==='Fire'||r.type==='Alternate route'||r.type==='Nap-time');});
  return loadLibs().then(function(){
    var L=PDFLib, rgb=L.rgb;
    return L.PDFDocument.create().then(function(doc){ return Promise.all([doc.embedFont(L.StandardFonts.Helvetica),doc.embedFont(L.StandardFonts.HelveticaBold)]).then(function(f){
      var F=f[0], B=f[1], PER=13, pages=Math.max(1,Math.ceil(fire.length/PER),Math.ceil(em.length/PER));
      function mdy(s){ var q=String(s||'').split('-'); return q.length===3?(+q[1])+'/'+(+q[2])+'/'+q[0].slice(2):''; }
      for(var pg=0;pg<pages;pg++){
        var page=doc.addPage([792,612]), H=612;
        page.drawText('NAME OF FACILITY/HOME:',{x:30,y:H-40,size:10,font:B}); page.drawText('Kid City USA '+ascii(S.school),{x:178,y:H-40,size:13,font:F}); page.drawText(String(yr),{x:690,y:H-40,size:14,font:F});
        page.drawLine({start:{x:30,y:H-46},end:{x:762,y:H-46},thickness:1});
        function panel(x0,title,desc,cols,data,fmt){
          var w=cols.reduce(function(s,c){return s+c[1];},0), y=H-58;
          page.drawRectangle({x:x0,y:y-22,width:w,height:22,color:rgb(.86,.88,.45),borderColor:rgb(0,0,0),borderWidth:1});
          page.drawText(title,{x:x0+w/2-B.widthOfTextAtSize(title,12)/2,y:y-16,size:12,font:B});
          page.drawRectangle({x:x0,y:y-76,width:w,height:54,borderColor:rgb(0,0,0),borderWidth:1});
          var words=desc.split(' '), line='', ly=y-34; words.forEach(function(wd){ if(F.widthOfTextAtSize(line+wd,7.5)>w-10){ page.drawText(line,{x:x0+5,y:ly,size:7.5,font:F}); ly-=9; line=''; } line+=wd+' '; }); page.drawText(line,{x:x0+5,y:ly,size:7.5,font:F});
          var hy=y-76, hh=108, cx=x0;
          cols.forEach(function(c){ page.drawRectangle({x:cx,y:hy-hh,width:c[1],height:hh,borderColor:rgb(0,0,0),borderWidth:.7,color:rgb(.93,.93,.93)}); page.drawText(c[0],{x:cx+c[1]/2+3,y:hy-hh+4,size:5.8,font:B,rotate:L.degrees(90)}); cx+=c[1]; });
          var ry=hy-hh;
          for(var i=0;i<PER;i++){ var r=data[pg*PER+i], cx2=x0; ry-=18; cols.forEach(function(c,ci){ page.drawRectangle({x:cx2,y:ry,width:c[1],height:18,borderColor:rgb(0,0,0),borderWidth:.7}); if(r){ var t=ascii(fmt(r)[ci]); var sz=9; while(sz>5&&F.widthOfTextAtSize(t,sz)>c[1]-4) sz-=.5; page.drawText(t,{x:cx2+3,y:ry+5,size:sz,font:F,color:rgb(.1,.1,.55)}); } cx2+=c[1]; }); }
        }
        panel(30,'FIRE DRILL','Conduct fire drills, at various times when children are in care. A minimum of one fire drill annually must occur while children are napping/sleeping and one fire drill must be conducted using alternate evacuation route. Annually, at least one fire drill will be conducted while licensing staff are present.',
          [['DATE (MM/DD/YY)',44],['TIME OF DAY',38],['NUMBER OF ADULT PARTICIPANTS',32],['NUMBER OF CHILD PARTICIPANTS',32],['TIME TO CLEAR BUILDING',38],['ROUTE USED / ALTERNATE',40],['DATE EXTINGUISHER CHECKED',42],['COMMENTS',62],['INITIALS OF OWNER/DIRECTOR',38]],fire,
          function(r){ return [mdy(r.date),r.time,r.adults,r.kids,r.clear,(r.route||(r.type==='Alternate route'?'Alt':''))+(r.type==='Nap-time'?' (nap)':''),r.ext,r.note,r.init]; });
        panel(402,'EMERGENCY PREPAREDNESS','Conduct drills of the emergency preparedness and evacuation plan for situations such as inclement weather (tornadoes) or a necessary lock down of the facility due to an outside threat. Annually you must practice each drill outlined in your emergency preparedness plan at least once.',
          [['DATE (MM/DD/YY)',44],['TIME OF DAY',38],['NUMBER OF ADULT PARTICIPANTS',32],['NUMBER OF CHILD PARTICIPANTS',32],['SITUATION / EVENT PRACTICED',62],['TIME TAKEN TO COMPLETE',40],['COMMENTS',80],['INITIALS OF OWNER/DIRECTOR',38]],em,
          function(r){ return [mdy(r.date),r.time,r.adults,r.kids,r.type+(r.type==='Other emergency'&&r.route?': '+r.route:''),r.clear,r.note,r.init]; });
        page.drawText('Keep records 12 months. Page '+(pg+1)+' of '+pages+'. Generated from the Hive drill log.',{x:30,y:14,size:7,font:F,color:rgb(.4,.4,.4)});
      }
      return doc.save();
    }); });
  });
}
function bytesB64(u8){ var s='',i,ch=0x8000; for(i=0;i<u8.length;i+=ch) s+=String.fromCharCode.apply(null,u8.subarray(i,i+ch)); return btoa(s); }
function vaultCall(action,extra){ var body={pin:PIN,action:action}; for(var k in extra) body[k]=extra[k]; return fetch('reporting-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json();}); }
function drillVault(silent){
  var yr=S.date.slice(0,4), month=todayNY().slice(0,7), name='Fire Drill Log '+yr+' - '+S.school+'.pdf';
  return drillPdf(yr).then(function(u8){
    return vaultCall('remove',{month:month,cat:'dcf',name:name}).catch(function(){}).then(function(){ return vaultCall('upload',{month:month,cat:'dcf',name:name,b64:bytesB64(u8)}); });
  }).then(function(j){ if(j&&j.error) throw new Error(j.error); toast('Drill log filed in the vault (DCF / Licensing, '+month+').'); }).catch(function(e){ toast('Drill saved, but the vault copy failed: '+e.message,true); });
}
function printDrills(){ var yr=S.date.slice(0,4), w=window.open('about:blank','_blank'); drillPdf(yr).then(function(u8){ var url=URL.createObjectURL(new Blob([u8],{type:'application/pdf'})); if(w) w.location.href=url; else location.href=url; }).catch(function(e){ if(w) w.close(); toast(e.message,true); }); }

function fileB64(file){ return new Promise(function(ok,no){ var r=new FileReader(); r.onload=function(){ ok(String(r.result).split(',')[1]||''); }; r.onerror=function(){ no(new Error('Could not read that file.')); }; r.readAsDataURL(file); }); }
function drillUpload(inp){
  var f=inp.files&&inp.files[0]; if(!f) return; var month=todayNY().slice(0,7), ext=/pdf/i.test(f.type)?'pdf':(/png/i.test(f.type)?'png':'jpg');
  fileB64(f).then(function(b){ return vaultCall('upload',{month:month,cat:'dcf',name:'Fire Drill Log paper copy '+todayNY()+' - '+S.school+'.'+ext,b64:b}); })
  .then(function(j){ if(j&&j.error) throw new Error(j.error); toast('Paper log filed in the vault (DCF / Licensing). Please also enter the drills above so the red alert clears.'); }).catch(function(e){ toast(e.message,true); });
  inp.value='';
}
/* ----- Food Program papers: every saved hours sheet and form is filed as a PDF in the Reporting vault ----- */
function parPdf(emp,d,m){
  return loadLibs().then(function(){
    var L=PDFLib, rgb=L.rgb; return L.PDFDocument.create().then(function(doc){ return Promise.all([doc.embedFont(L.StandardFonts.Helvetica),doc.embedFont(L.StandardFonts.HelveticaBold)]).then(function(f){
      var F=f[0], B=f[1], pg=doc.addPage([612,792]), y=752, y0=+m.slice(0,4), mo=+m.slice(5), dim=new Date(y0,mo,0).getDate(), hd=HDR[S.school]||[''];
      function tx(t,x,yy,sz,font,al,w){ t=String(t==null?'':t); var fo=font||F; if(al==='c'){ x=x+(w-fo.widthOfTextAtSize(t,sz))/2; } if(al==='r'){ x=x+w-fo.widthOfTextAtSize(t,sz); } pg.drawText(t,{x:x,y:yy,size:sz,font:fo,color:rgb(0,0,0)}); }
      tx('PERSONNEL ACTIVITY REPORT (Child Care Food Program)',36,y,13,B); y-=16;
      tx(hd[0]+'  '+(hd[1]||'')+'  '+(hd[2]||''),36,y,8.5); y-=14;
      tx('Employee: '+emp,36,y,10.5,B); tx('Title: '+(d.title||''),300,y,10.5); y-=14;
      tx('Month: '+MONTHS[mo-1]+' '+y0,36,y,10.5); tx('Sponsor: '+((SITEDEF[S.school]||{}).sponsor||''),300,y,10.5); y-=18;
      var cols=[['Day',36,40],['Admin hrs',76,90],['Operational hrs',166,110],['Regular hrs',276,90],['Day total',366,90],['Notes',456,120]]; 
      cols.forEach(function(c){ pg.drawRectangle({x:c[1],y:y-4,width:c[2],height:15,borderColor:rgb(0,0,0),borderWidth:.6,color:rgb(.9,.9,.9)}); tx(c[0],c[1],y,8.5,B,'c',c[2]); }); y-=15;
      var ta=0,to=0,tr=0,tt=0;
      for(var dd=1;dd<=dim;dd++){ var r=(d.days||{})[dd]||{}, closed=(r.o==='Closed'), a=parseFloat(r.a)||0, o=closed?0:(parseFloat(r.o)||0), rg=parseFloat(r.r)||0, tot=a+o+rg; ta+=a; to+=o; tr+=rg; tt+=tot;
        var vals=[String(dd),r.a||'',closed?'Closed':(r.o||''),r.r||'',tot?String(Math.round(tot*100)/100):'',closed?'closed':''];
        cols.forEach(function(c,i){ pg.drawRectangle({x:c[1],y:y-3,width:c[2],height:15,borderColor:rgb(.5,.5,.5),borderWidth:.4}); tx(vals[i],c[1],y,8.5,F,'c',c[2]); }); y-=15; }
      var tv=['Total',String(Math.round(ta*100)/100),String(Math.round(to*100)/100),String(Math.round(tr*100)/100),String(Math.round(tt*100)/100),''];
      cols.forEach(function(c,i){ pg.drawRectangle({x:c[1],y:y-3,width:c[2],height:16,borderColor:rgb(0,0,0),borderWidth:.8,color:rgb(.95,.95,.95)}); tx(tv[i],c[1],y,9,B,'c',c[2]); }); y-=26;
      tx('I certify that this is an accurate record of the hours worked on the Child Care Food Program.',36,y,8.5); y-=24;
      tx('Employee signature ________________________   Date __________',36,y,9); y-=22;
      tx('Director / authorized representative ________________________   Date __________',36,y,9); y-=16;
      tx('Hours sheet copy of the Food Program Personnel Activity Report, filed from the Hive. Sign the printed official copy.',36,y,7,F);
      return doc.save();
    }); });
  });
}
function plainPdf(title,lines){
  return loadLibs().then(function(){ var L=PDFLib, rgb=L.rgb; return L.PDFDocument.create().then(function(doc){ return Promise.all([doc.embedFont(L.StandardFonts.Helvetica),doc.embedFont(L.StandardFonts.HelveticaBold)]).then(function(f){
    var pg=doc.addPage([612,792]), y=752; function nl(){ if(y<50){ pg=doc.addPage([612,792]); y=752; } }
    pg.drawText(title,{x:36,y:y,size:13,font:f[1]}); y-=22;
    lines.forEach(function(ln){ String(ln).match(/.{1,100}(\s|$)|\S+/g).forEach(function(w){ nl(); pg.drawText(w.replace(/[^\x20-\x7E]/g,' '),{x:36,y:y,size:9,font:f[0]}); y-=12; }); });
    return doc.save(); }); }); });
}
function flat(o,pre,out){ out=out||[]; if(o&&typeof o==='object'){ Object.keys(o).forEach(function(k){ flat(o[k],(pre?pre+' / ':'')+k,out); }); } else if(o!==''&&o!=null&&o!==false){ out.push(pre+': '+o); } return out; }
function foodVault(silent){
  var pk=S.pk, m=pk.month, keys=Object.keys(pk.recs).filter(function(k){ var p=k.split('|'); return p[0]===m && p[1]!=='SUBMITTED' && p[1]!=='SIGNED' && p[1]!=='PARENTFORMS'; });
  var jobs=[]; keys.forEach(function(k){ var p=k.split('|'), form=p[1], emp=p[2], d=pkData(form,emp)||{};
    if(form==='PAR') jobs.push({name:'Food Program PAR hours sheet - '+emp+' - '+m+'.pdf',make:function(){ return parPdf(emp,d,m); }});
    else { var lbl=(PFORMS.filter(function(x){return x[0]===form;})[0]||[form,form])[1]; jobs.push({name:'Food Program '+lbl+(emp?' - '+emp:'')+' - '+m+'.pdf',make:function(){ return plainPdf(lbl+(emp?' - '+emp:'')+' - '+S.school+' - '+m,flat(d,'',[])); }}); } });
  if(!jobs.length){ if(!silent) toast('Nothing saved for this month yet.',true); return Promise.resolve(); }
  var ok=0, bad=0;
  return jobs.reduce(function(pr,j){ return pr.then(function(){ return j.make().then(function(u8){ return vaultCall('remove',{month:m,cat:'food',name:j.name}).catch(function(){}).then(function(){ return vaultCall('upload',{month:m,cat:'food',name:j.name,b64:bytesB64(u8)}); }); }).then(function(r){ if(r&&r.error) bad++; else ok++; }).catch(function(){ bad++; }); }); },Promise.resolve())
  .then(function(){ toast(ok+' Food Program paper'+(ok===1?'':'s')+' filed in the vault (Food Program, '+m+')'+(bad?'; '+bad+' did not save.':'.'),!!bad); });
}
function drillForm(date,recId){
  var rec=recId&&S.subs[recId], o=rec?drillInfo(rec):{type:'Fire',date:date}, nm=directorName();
  var h='<div class="mback" data-a="mclose"><div class="mbox" data-stop="1"><h3>Drill log entry</h3>';
  h+='<label class="lbl">Date</label><input class="inp" type="date" id="dd" value="'+esc(o.date||date)+'">';
  h+='<label class="lbl">Type of drill</label><select class="inp" id="dty">'+DTYPES.map(function(x){return '<option'+(x===o.type?' selected':'')+'>'+x+'</option>';}).join('')+'</select>';
  [['dtm','Time of day (vary it)',o.time,'e.g. 10:15 AM'],['dad','Adults present',o.adults,''],['dkd','Children present',o.kids,''],['dcl','Time to clear the building',o.clear,'e.g. 2 min 10 sec'],['drt','Route used / alternate route',o.route,''],['dex','Extinguisher checked on (date)',o.ext,''],['dnt','Comments',o.note,'']].forEach(function(f){ h+='<label class="lbl">'+f[1]+'</label><input class="inp" id="'+f[0]+'" value="'+esc(f[2]||'')+'" placeholder="'+f[3]+'">'; });
  h+='<label class="lbl">Director initials</label><input class="inp" id="din" value="'+esc(o.init||(nm||'').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase())+'">';
  h+='<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-a="mclose">Close</button><button class="btn grn" id="dsave">Save drill</button></div></div></div>';
  $('modal').innerHTML=h;
  $('dsave').onclick=function(){
    if(!nm){ $('merr').textContent='Enter your name first.'; return; }
    var d=$('dd').value; if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){ $('merr').textContent='Pick the date.'; return; }
    var j={type:$('dty').value,time:$('dtm').value.trim(),adults:$('dad').value.trim(),kids:$('dkd').value.trim(),clear:$('dcl').value.trim(),route:$('drt').value.trim(),ext:$('dex').value.trim(),note:$('dnt').value.trim(),init:$('din').value.trim()};
    var items='✅ '+j.type+' drill conducted & logged'+(j.time?' at '+j.time:'')+(j.kids?' · '+j.kids+' children, '+(j.adults||'?')+' adults':'')+(j.clear?' · cleared in '+j.clear:''), det='DRILL:'+JSON.stringify(j), btn=$('dsave'); btn.disabled=true; btn.textContent='Saving...';
    var p=rec?api('update','Facility Submissions',{recordId:rec.id,fields:{Items:items,Details:det,Date:d}}):api('create','Facility Submissions',{fields:{Submission:S.school+' · Drill · '+j.type+' · '+d.slice(5).replace('-','/'),'Room / Classroom':FORMS.drl.room,'Form Type':FORMS.drl.type,'Staff Name':nm,Date:d,'Submitted At':new Date().toISOString(),Items:items,'Overall Status':'✅ All OK',Details:det,Status:'🟡 Pending'}});
    p.then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ S.subs[r.id]=r; } $('modal').innerHTML=''; toast('Drill saved.'); render(); drillVault(); }).catch(function(e){ btn.disabled=false; btn.textContent='Save drill'; $('merr').textContent=e.message; });
  };
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
      else if(m.kind==='of') h+='<button class="line bad" data-tab="ofc" data-d="'+m.mon+'">&#9679; Week of '+nice(m.mon)+' &middot; '+esc(m.room)+' &middot; official '+(m.form==='ind'?'indoor':'playground')+' inspection needs the director signature &rsaquo;</button>';
      else if(m.kind==='wk') h+='<button class="line bad" data-tab="att" data-d="'+m.mon+'" data-wkroom="'+esc(m.room)+'">&#9679; Week of '+nice(m.mon)+' &middot; '+esc(m.room)+' &middot; attendance &amp; meal count report not signed &rsaquo;</button>';
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
function openCell(k,date,room,recId){
  if(k==='drl') return drillForm(date,recId);
  var f=FORMS[k], c=cellState(k,date,room), rec=c.list[0], rm=f.per==='room'?room:f.room;
  var items, who='', when='', link='', details='', ro=!rec;
  if(rec){ items=parseItems(rec.fields.Items); who=rec.fields['Staff Name']||''; when=rec.fields['Submitted At']?new Date(rec.fields['Submitted At']).toLocaleString('en-US',{timeZone:NY}):''; link=rec.fields['Drive Link']||''; details=rec.fields.Details||''; }
  else items=f.items(dow(date)).map(function(t){return {ok:true,text:t};});
  var h='<div class="mback" data-a="mclose"><div class="mbox" data-stop="1"><h3>'+esc(f.label)+'</h3><div class="sub">'+(f.per==='room'?esc(room)+' &middot; ':'')+nice(date)+'</div>';
  if(rec){ h+='<div class="sub">Signed / done by <b>'+esc(who||'?')+'</b>'+(when?' &middot; '+esc(when):'')+(link?' &middot; <a href="'+esc(link)+'" target="_blank" rel="noopener">PDF</a>':'')+'</div>';
    c.list.slice(1).forEach(function(o){ h+='<div class="sub">Also signed by <b>'+esc(o.fields['Staff Name']||'?')+'</b>'+(o.fields['Submitted At']?' &middot; '+esc(new Date(o.fields['Submitted At']).toLocaleString('en-US',{timeZone:NY})):'')+'</div>'; }); }
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
function addDrill(d){ drillForm(/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d:todayNY()); }


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
  h+='<div class="mrow noprint"><button class="btn sec" data-pf="print">Print / Save PDF</button>'+'<button class="btn grn" data-pf="save">Save now</button>'+'<button class="btn sec" onclick="foodVault()">File this month\'s Food Program papers as PDFs in the vault</button>'+'</div>';
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
  return '<div class="card noprint qf"><div class="ct">Quick fill this month</div><div class="sub">Type the hours per day and pick which days. Leave hours blank to skip a column. It only fills the days you pick, so you can still change any box afterward.</div>'+row('a','Admin hours','')+row('o','Operational hours','')+row('r','Regular hours worked','')+row('p','Paid leave hours','')+'<div class="mrow"><button class="btn grn" data-pf="parfill">Fill the table</button><button class="btn sec" data-pf="parclear">Clear this month</button></div><div class="mrow"><button class="btn" style="background:#2e7d32;color:#fff" data-pf="parmulti">Fill sheets for several staff&hellip;</button></div></div>';
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

/* ----- fill several staff PAR sheets at once (pop-up) ----- */
function parMulti(){
  var pk=S.pk, names=pk.staff||[]; if(isLocked()) return toast('This month is locked.',true);
  if(!names.length) return toast('No staff list loaded yet. Open the PAR tab and try again.',true);
  var m=pk.month, h='<div class="mback" data-a="mclose"><div class="mbox" data-stop="1" style="max-width:640px"><h3>Fill Personnel Activity Reports &mdash; '+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</h3>';
  h+='<div class="sub">Pick who worked on the Food Program. Weekends and closed days are filled in as <b>Closed</b> automatically. Each person gets their own saved sheet, kept in this month&rsquo;s Food Program packet.</div>';
  h+='<div class="qfrow"><b>Same for everyone</b></div><div style="display:flex;flex-wrap:wrap;gap:8px"><label>Operational hrs Mon&ndash;Thu<input class="inp" id="pm-o" value="3" inputmode="decimal"></label><label>Operational hrs Friday<input class="inp" id="pm-f" value="4" inputmode="decimal"></label><label>Regular hrs / day<input class="inp" id="pm-r" value="8" inputmode="decimal"></label><label>Admin hrs / day (optional)<input class="inp" id="pm-a" value="" inputmode="decimal"></label><label>Title<input class="inp" id="pm-t" value="Teacher"></label></div>';
  h+='<div style="margin:8px 0"><button class="btn sec sm" onclick="document.querySelectorAll(\'.pm-ck\').forEach(function(c){c.checked=true})">Select all</button> <button class="btn sec sm" onclick="document.querySelectorAll(\'.pm-ck\').forEach(function(c){c.checked=false})">Select none</button></div>';
  h+='<div style="max-height:260px;overflow:auto;border:1px solid #ccc;border-radius:8px;padding:6px">'+names.map(function(n,i){ var have=pkData('PAR',n)&&Object.keys((pkData('PAR',n)||{}).days||{}).length; return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><label style="flex:1"><input type="checkbox" class="pm-ck" data-n="'+esc(n)+'"> '+esc(n)+(have?' <small style="color:#2e7d32">(has a sheet &mdash; will be replaced)</small>':'')+'</label><input class="inp pm-tt" placeholder="title (optional)" style="width:130px"></div>'; }).join('')+'</div>';
  h+='<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-a="mclose">Cancel</button><button class="btn grn" data-pf="pmgo" id="pmgo">Create the sheets</button></div></div></div>';
  $('modal').innerHTML=h;
}
function parMultiGo(){
  var pk=S.pk, m=pk.month, y=+m.slice(0,4), mo=+m.slice(5), dim=new Date(y,mo,0).getDate();
  var o=$('pm-o').value.trim(), f=$('pm-f').value.trim(), r=$('pm-r').value.trim(), a=$('pm-a').value.trim(), t0=$('pm-t').value.trim();
  var rows=[].filter.call(document.querySelectorAll('.pm-ck'),function(c){return c.checked;}).map(function(c){ return {n:c.getAttribute('data-n'),t:(c.parentNode.parentNode.querySelector('.pm-tt').value.trim()||t0)}; });
  if(!rows.length){ $('merr').textContent='Pick at least one person.'; return; }
  if(!directorName()){ $('merr').textContent='Enter your name first.'; return; }
  var btn=$('pmgo'); btn.disabled=true; btn.textContent='Creating 0 of '+rows.length+'…'; var i=0;
  (function next(){
    if(i>=rows.length){ $('modal').innerHTML=''; pk.emp=rows[0].n; toast(rows.length+' sheet'+(rows.length===1?'':'s')+' saved to '+MONTHS[mo-1]+'.'); render(); foodVault(true); return; }
    var q=rows[i], ex=pkData('PAR',q.n)||{}, days={};
    for(var d=1;d<=dim;d++){ var iso=m+'-'+(d<10?'0':'')+d, w=new Date(y,mo-1,d).getDay();
      if(w===0||w===6||!isSchoolDay(iso)){ days[d]={o:'Closed'}; continue; }
      var rec={}; if(a) rec.a=a; var ov=(w===5&&f!=='')?f:o; if(ov!=='') rec.o=ov; if(r!=='') rec.r=r; days[d]=rec; }
    var data={auth:ex.auth||'',title:q.t,days:days,sp:ex.sp||{}};
    writeRec({form:'PAR',emp:q.n,data:data},true).then(function(){ i++; btn.textContent='Creating '+i+' of '+rows.length+'…'; next(); });
  })();
}
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
  var rows=[['SITEINFO','Site Information'],['CHECKLIST','Monthly Provider Check List'],['ENTRANCES','Monthly Entrances'],['TERMS','Monthly Terminations'],['PAR','Personnel Activity Reports'],['PARENTSIGN','Parent-signed forms'],['WEEKSIGN','Weekly Attendance & Meal Count reports signed & dated'],['RECEIPTS','Receipts'],['EXPEND','Program Expenditures Worksheet'],['LABOR','Labor Summary Worksheet']];
  var h='<div class="ct">Review &amp; Submit &mdash; '+mLabel(S.pk.month)+'</div><div class="sub">Green means ready. Red means the sponsor will be missing something.</div>';
  var miss=[];
  rows.forEach(function(r){ var s=st[r[0]]; if(!s.ok) miss.push(s.why); h+='<div class="line '+(s.ok?'ok':'bad')+'">'+(s.ok?'&#10003; ':'&#9679; ')+r[1]+(s.ok?'':' &mdash; '+esc(s.why))+(PFORMS.some(function(f){return f[0]===r[0];})?' <button class="btn sec sm" data-pf="form" data-v="'+r[0]+'">open</button>':'')+(r[0]==='WEEKSIGN'&&s.first?' <button class="btn sec sm" data-tab="att" data-d="'+s.first.mon+'" data-wkroom="'+esc(s.first.room)+'">open</button>':'')+'</div>'; });
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
  api('create','Monthly Forms',{fields:{Entry:S.school+' · '+pk.month+' · SUBMITTED',Month:pk.month,Form:'SUBMITTED',Employee:'',Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}}).then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ pk.recs[pkKey('SUBMITTED','')]=r; toast('Submitted. Month locked.'); render(); foodVault(true); } else toast('Did not submit',true); }).catch(function(e){ toast(e.message,true); });
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
var BLANKS={'DeLand 2':[['Free &amp; Reduced-Price Meal Application (blank, DeLand 2)','files/food-program/deland2-free-reduced-application-blank.pdf'],['Infant Feeding Form (blank, DeLand 2)','files/food-program/deland2-infant-feeding-form-blank.pdf']],
 'Sanford':[['Infant Feeding Form (blank, 4C)','https://4cflorida.org/wp-content/uploads/2023/09/Infant-Feeding-Form-FINAL-fillable-1.pdf'],['Dietary Preference Request Form (blank, 4C)','https://4cflorida.org/wp-content/uploads/2025/07/Dietary-Preference-Request-Form-2025.pdf'],['Parent Request for Milk Substitution (blank, 4C)','https://4cflorida.org/wp-content/uploads/2023/09/Parent-Request-For-Milk-Substitution.pdf'],['Parent Request for Food Substitution (blank, 4C)','https://4cflorida.org/wp-content/uploads/2024/07/Food-Substitution-Request-20190624.pdf'],['Meal Count Summary (blank, 4C)','https://4cflorida.org/wp-content/uploads/2024/07/Meal-Count-Summary-Blank-02242021.pdf']]};
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
  if(BLANKS[S.school]){ h+='<div class="card"><div class="ct">Blank forms</div>'; BLANKS[S.school].forEach(function(b){ h+='<div class="line"><a target="_blank" href="'+b[1]+'">'+b[0]+'</a></div>'; }); h+='</div>'; }
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
  if(el.hasAttribute('data-pf')){ var a2=el.getAttribute('data-pf'),pk=S.pk; if(a2==='prev'||a2==='next'){ flushSave().then(function(){ pk.month=shiftMonth(pk.month,a2==='prev'?-1:1); pk.loaded=''; render(); }); } else if(a2==='form'){ var fv=el.getAttribute('data-v'); flushSave().then(function(){ pk.form=fv; render(); }); } else if(a2==='save') savePacket(); else if(a2==='submit') submitPacket(); else if(a2==='parfill') parFill(); else if(a2==='parmulti') parMulti(); else if(a2==='pmgo') parMultiGo(); else if(a2==='parclear') parClear(); else if(a2==='print'){ var ls=pk.form==='EXPEND', stt=$('pgst'); if(!stt){ stt=document.createElement('style'); stt.id='pgst'; document.head.appendChild(stt); } stt.textContent='@page{size:letter '+(ls?'landscape':'portrait')+';margin:'+(/^(SITEINFO|CHECKLIST|ENTRANCES|MEDICAL|DIETARY|INFANTFEED|PAR|LABOR|EXPEND)$/.test(pk.form)?'0':'0.4in')+'}'; window.print(); } return; }
  if(el.getAttribute('data-a')==='mclose' && e.target.closest('[data-stop]') && !e.target.classList.contains('btn')) return;
  if(el.hasAttribute('data-adddrill')){ var ad=el.getAttribute('data-adddrill'); addDrill(ad.length===7?ad+'-'+todayNY().slice(8):ad); return; }
  if(el.hasAttribute('data-cell')){ var p=el.getAttribute('data-cell').split('|'); openCell(p[0],p[1],p[2],p[3]); return; }
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
.rp .ft .sg{width:500px;white-space:nowrap;text-align:right;font:700 13px Georgia,serif}\
.rp .ft .sg span.wsig{position:relative;width:210px;height:24px;vertical-align:bottom}.rp .ft .sg span.wsig img{position:absolute;left:6px;bottom:1px;height:30px}\
.rp .ft .sg span.wdt{width:92px;text-align:center;font-weight:400}\
.rpscroll .wsig,.rpscroll .wdt{cursor:pointer}.rpscroll .wsig:hover,.rpscroll .wdt:hover{outline:2px solid #1565c0}.rpscroll .wsig.need{outline:2px dashed #c62828;background:#fff1f1}\
.wkbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0;padding:8px 10px;border-radius:10px;font-size:14px}.wkbar.bad{background:#ffebee;border:1px solid #ef9a9a}.wkbar.ok{background:#e8f5e9;border:1px solid #a5d6a7}\
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
  var h='<div class="rp"><div class="sq" style="left:10px;top:92px"></div><div class="sq" style="right:10px;top:104px"></div>';
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
  h+='<div class="ft"><div class="id">CXFORMID1008</div><div class="cert">I certify that the information on this form is true and correct to the best of my knowledge and that I will claim reimbursement only for eligible meals served to eligible participants. I understand that misrepresentation may result in prosecution under applicable state or federal statutes. &nbsp; <b>Mark only an &ldquo;X&rdquo; within the lines!</b> &nbsp;This may be read by a machine.</div>'+wkFoot(room,mon)+'</div>';
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
  wkLoad(mon.slice(0,7)); var wkOpen=0; S.rep.rooms.forEach(function(r){ var nd=wkNeed(mon,r.Room), sg=!!wkData(mon,r.Room); if(nd) wkOpen++; h+='<button class="btn'+(S.rep.room===r.Room?'':' sec')+'" data-rep="room" data-v="'+esc(r.Room)+'">'+esc(r.Room)+(nd?' <span style="color:#ff5252">&#9679;</span>':(sg?' <span style="color:#2e7d32">&#10003;</span>':''))+'</button>'; });
  h+='</div><div class="rpbar"><button class="btn grn sm" data-rep="print"'+(S.rep.room?'':' disabled')+'>Print this classroom</button><button class="btn sec sm" data-rep="printall">Print all classrooms</button></div></div>';
  if(wkOpen) h=h.replace('<div class="rpbar"><button class="btn sec sm" data-rep="prev">','<div class="wkbar bad"><b style="color:#c62828">&#9679; '+wkOpen+' classroom report'+(wkOpen===1?'':'s')+' this week still need'+(wkOpen===1?'s':'')+' a director/staff signature and date.</b> Tap a classroom marked with a red dot.</div><div class="rpbar"><button class="btn sec sm" data-rep="prev">');
  if(S.rep.room){ var pgs=repPages(S.rep.room,mon); h+=wkBar(S.rep.room,mon)+'<div class="rpscroll" id="reppage">'+pgs.join('<div style="height:14px"></div>')+'</div>'; }
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

/* ---------- weekly sign-off (11/4/26): every Weekly Attendance & Meal Count report must be signed + dated by a director/staff ---------- */
var WK_START='2026-09-28';
S.wks={}; S.wksLoaded={};
function wkKey(mon,room){ return mon+'|'+room; }
function wkData(mon,room){ var r=S.wks[wkKey(mon,room)]; if(!r) return null; try{ var d=JSON.parse(r.fields.Data||'{}'); return d&&d.sig?d:null; }catch(e){ return null; } }
function wkSplit(k){ var i=k.indexOf('|'); return [k.slice(0,i),k.slice(i+1)]; }
function wkLoad(m){
  if(S.wksLoaded[m]) return Promise.resolve(); S.wksLoaded[m]='loading';
  return api('list','Monthly Forms',{month:m}).then(function(res){ (res.records||[]).forEach(function(x){ if(x.fields.Form!=='WKSIGN') return; var e=String(x.fields.Employee||''), i=e.indexOf(' '); if(i<0) return; S.wks[wkKey(e.slice(0,i),e.slice(i+1))]=x; }); S.wksLoaded[m]=true; render(); }).catch(function(e){ S.wksLoaded[m]='err'; toast(e.message,true); });
}
function wkPrev(m){ return monthStart(addDays(m+'-01',-1)).slice(0,7); }
function wkEnsure(m){ var pm=wkPrev(m), ms=m+'-01', ps=pm+'-01'; S.wkReq=S.wkReq||{}; wkLoad(m); wkLoad(pm); [[ms,monthEnd(ms)],[ps,monthEnd(ps)]].forEach(function(r){ var k=rangeKey(r[0],r[1]); if(S.wkReq[k]||S.loaded[k]) return; S.wkReq[k]=1; loadRange(r[0],r[1]); }); }
function wkRooms(mon){
  var days=[0,1,2,3,4].map(function(i){return addDays(mon,i);}), seen={}, out=[], ok=null;
  if(S.rep&&S.rep.rooms&&S.rep.rooms.length){ ok={}; S.rep.rooms.forEach(function(r){ ok[r.Room]=1; }); }
  S.att.forEach(function(a){ var f=a.fields; if(days.indexOf(f.Date)<0||!f.Arrival) return; var r=f['Home Room']||f['Current Room']; if(!r||seen[r]) return; if(ok&&!ok[r]) return; seen[r]=1; out.push(r); });
  return out.sort();
}
function wkEnded(mon){ return mon>=WK_START && addDays(mon,4)<=todayNY(); }
function wkNeed(mon,room){ return wkEnded(mon) && S.wksLoaded[mon.slice(0,7)]===true && wkRooms(mon).indexOf(room)>=0 && !wkData(mon,room); }
function wkWeeksOf(M){
  var ms=M+'-01', me=monthEnd(ms), seen={}, out=[];
  for(var d=ms; d<=me; d=addDays(d,1)){ if(!isSchoolDay(d)) continue; var mon=monday(d); if(seen[mon]) continue; seen[mon]=1; if(wkEnded(mon)) out.push(mon); }
  return out;
}
function wkMonth(M){
  var pm=wkPrev(M), ready=S.wksLoaded[M]===true&&S.wksLoaded[pm]===true&&!!S.loaded[rangeKey(M+'-01',monthEnd(M+'-01'))]&&!!S.loaded[rangeKey(pm+'-01',monthEnd(pm+'-01'))];
  var open=[], need=0; if(ready) wkWeeksOf(M).forEach(function(mon){ wkRooms(mon).forEach(function(r){ need++; if(!wkData(mon,r)) open.push({mon:mon,room:r}); }); });
  return {ready:ready,need:need,open:open};
}
function wkOpenInRange(from,to){
  var out=[], seen={};
  for(var d=from; d<=to; d=addDays(d,1)){ var mon=monday(d), fri=addDays(mon,4); if(seen[mon]) continue; seen[mon]=1; if(fri<from||fri>to) continue; if(!wkEnded(mon)||S.wksLoaded[mon.slice(0,7)]!==true) continue; wkRooms(mon).forEach(function(r){ if(!wkData(mon,r)) out.push({mon:mon,room:r}); }); }
  return out;
}
function wkFoot(room,mon){
  var d=wkData(mon,room), k=wkKey(mon,room);
  return '<div class="sg">Director / Staff:<span class="wsig'+(d||!wkEnded(mon)?'':' need')+'" data-wsig="'+esc(k)+'">'+(d?'<img src="'+d.sig+'" alt="signature">':'')+'</span> &nbsp; Date:<span class="wdt" data-wdt="'+esc(k)+'">'+(d?esc(d.date||''):'')+'</span></div>';
}
function wkPad(cb){
  var ov=document.createElement('div'); ov.className='padov'; ov.innerHTML='<div class="padbox"><div class="ct">Sign the weekly report</div><canvas width="700" height="220"></canvas><div class="mrow"><button class="btn sec" data-pad="clear">Clear</button><button class="btn sec" data-pad="cancel">Cancel</button><button class="btn grn" data-pad="save">Use this signature</button></div><div class="hint">Use your finger or mouse. Today&rsquo;s date fills in next to it (you can change it afterward).</div></div>';
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
    else if(a==='save'){ if(!any) return toast('Draw your signature first.',true); var t=document.createElement('canvas'); t.width=350; t.height=110; t.getContext('2d').drawImage(c,0,0,350,110); ov.remove(); cb(t.toDataURL('image/png')); } });
}
function wkSave(k,data){
  var sp=wkSplit(k), mon=sp[0], room=sp[1], nm=directorName()||'Director', ex=S.wks[k], now=new Date().toISOString(), p;
  if(ex) p=api('update','Monthly Forms',{recordId:ex.id,fields:{Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}});
  else p=api('create','Monthly Forms',{fields:{Entry:S.school+' · '+mon+' · WKSIGN · '+room,Month:mon.slice(0,7),Form:'WKSIGN',Employee:mon+' '+room,Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}});
  return p.then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ S.wks[k]=r; toast(data.sig?'Signed and dated.':'Signature cleared.'); render(); } else toast('Did not save',true); }).catch(function(e){ toast(e.message||'Did not save',true); });
}
function wkSign(k){
  var nm=directorName(); if(!nm) return;
  wkPad(function(url){ wkSave(k,{sig:url,date:todayUS(),by:nm,at:new Date().toISOString()}); });
}
function wkDate(k){
  var d=wkData.apply(null,wkSplit(k)); if(!d) return toast('Sign first, then the date can be changed.',true);
  var v=prompt('Date signed (mm/dd/yyyy):',d.date||todayUS()); if(v===null) return; v=v.trim(); var m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m) return toast('Enter the date like 11/02/2026',true);
  d.date=('0'+m[1]).slice(-2)+'/'+('0'+m[2]).slice(-2)+'/'+m[3]; d.by=directorName()||d.by; wkSave(k,d);
}
function wkClear(k){
  if(!wkData.apply(null,wkSplit(k))) return;
  if(!confirm('Clear this signature and date? The report will show as NOT signed until it is signed again.')) return;
  wkSave(k,{});
}
function wkBar(room,mon){
  var k=wkKey(mon,room), d=wkData(mon,room), ended=wkEnded(mon), loaded=S.wksLoaded[mon.slice(0,7)]===true;
  if(!loaded) return '<div class="wkbar">Checking sign-off&hellip;</div>';
  if(d) return '<div class="wkbar ok">&#10003; <b>Signed &amp; dated</b> &mdash; '+esc(d.by||'')+' &middot; '+esc(d.date||'')+' <button class="btn sec sm" data-wk="sign" data-k="'+esc(k)+'">Sign again</button><button class="btn sec sm" data-wk="date" data-k="'+esc(k)+'">Change date</button><button class="btn sec sm" data-wk="clear" data-k="'+esc(k)+'">Clear signature</button></div>';
  return '<div class="wkbar '+(ended?'bad':'')+'">'+(ended?'<b style="color:#c62828">&#9679; Not signed yet.</b> A director or staff member must sign and date this report.':'This week is not over yet. Sign it once the week ends (it becomes required after Friday).')+' <button class="btn grn sm" data-wk="sign" data-k="'+esc(k)+'">&#9998; Sign &amp; date</button></div>';
}
document.addEventListener('click',function(e){
  var s=e.target.closest&&e.target.closest('.rpscroll .wsig'); if(s){ wkSign(s.getAttribute('data-wsig')); return; }
  var dd=e.target.closest&&e.target.closest('.rpscroll .wdt'); if(dd){ wkDate(dd.getAttribute('data-wdt')); return; }
  var b=e.target.closest&&e.target.closest('[data-wk]'); if(b){ var a=b.getAttribute('data-wk'), k=b.getAttribute('data-k'); if(a==='sign') wkSign(k); else if(a==='date') wkDate(k); else if(a==='clear') wkClear(k); return; }
  var r=e.target.closest&&e.target.closest('[data-wkroom]'); if(r){ S.rep.room=r.getAttribute('data-wkroom'); render(); }
});
/* hook into the existing screens */
var _ed=ensureData; ensureData=function(){ var p=_ed(); wkEnsure(S.date.slice(0,7)); wkEnsure(todayNY().slice(0,7)); return p; };
var _lp=loadPacket; loadPacket=function(){ var p=_lp(); wkEnsure(S.pk.month); return p; };
var _ps=pkStatus; pkStatus=function(){ var s=_ps(), w=wkMonth(S.pk.month); s.WEEKSIGN=w.ready?{ok:!w.open.length,why:w.open.length+' weekly attendance & meal count report(s) not signed & dated',first:w.open[0]}:{ok:false,why:'Still checking the weekly report sign-offs'}; return s; };
var _ml=missingList; missingList=function(from,to){ var out=_ml(from,to); try{ wkOpenInRange(from,to).forEach(function(x){ out.push({kind:'wk',mon:x.mon,room:x.room}); }); }catch(e){} return out; };

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

/* ===== add-on 11/4/26: OFFICIAL FORMS tab - the real Kid City / Bee System paper forms, filled in from the portal records ===== */
(function(){
var OF={form:'bee',room:null,trip:0,signs:{},loaded:{},cache:{},tok:0,blank:null,libs:null,last:null};
var BEE_ROWS=[88.6,106.3,119.1,131.9,144.6,157.5,170.3,195.4,208.2,221.1,233.9,246.8,271.8,284.7,297.5,310.3,323.1,335.9,348.8,361.6,374.3,390.2,405.9,421.6,437.4,453.2,468.9,484.7,500.4,516.2,531.9,547.7,563.5];
var BEE_COLS=[289.3,307.3,323.4,345.9,363.5,380.4,402.2,419.8,442.3,460.0,477.0,498.7,516.4,539.0,556.7,573.7,595.4,613.2,635.7,653.5,670.3,692.1,709.9,732.5,750.2,767.1];
var BEE_ITEM_ROWS={"wipe door knobs":4,"clean cubbies":5,"sanitize cots cribs tables high chairs":6,"sanitize bottles cups":7,"sanitize toys":8,"clean sinks":9,"clean refrigerator":10,"clean bathroom changing table diaper can":11,"mop":12,"take garbage out sanitize trash can":13,"deep clean language center":15,"deep clean writing center":16,"deep clean math center":18,"deep clean music center":19,"deep clean dramatic play":21,"deep clean art center":22,"deep clean cars blocks center":24,"deep clean lego table":25,"deep clean discovery center":27,"wash trash cans":28};
var BATH_ROWS=[203.6,219.4,235.5,251.6,267.6,283.8,299.9,316.0,332.1,348.2];
var BATH_DAY_X=[183,207,227,254,278,300,323,344,371,395,416,440,461,488,512,533,557,578,605,629,650,674,695,722,746];
var BATH_ITEM_ROWS={"8 00 am cleaning":3,"10 00 am cleaning":4,"12 00 pm cleaning":5,"2 00 pm cleaning":6,"4 00 pm cleaning":7,"6 00 pm cleaning":8};
var IND_ROWS=[65.0,84.6,98.3,112.1,125.7,139.5,153.1,180.0,206.9,220.6,247.5,274.4,301.2,328.1,341.8,355.5,369.2,396.0,409.7,423.4,450.3,477.2,517.3,544.1,571.0,584.9,611.7,638.6,665.5,679.2,706.1,732.9];
var IND_DAY_COLS=[[320.2,358.9],[369.7,408.8],[419.6,472.8],[483.6,528.2],[539.0,570.5]];
var IND_ITEMS=["all entrances exits are kept clear of clutter","hallways and tops of walls are kept clean and clutter free","bathrooms are clean and well stocked with toilet paper soap and paper towels","staff purses and personal items are locked out of reach of children","cell phones are not in classroom","hands are washed by staff and children upon arrival to classroom","each child has brief health check by classroom teacher includes parent caregiver communication","all hygiene supplies are available soap paper towels toilet paper lined garbage can warm water","all areas are clean and clutter free garbage emptied floors swept toys and workspace bathroom clean","all chemicals are locked out of reach of children","air fresheners are not used","all electrical outlets are covered","furniture and equipment is in good repair check for broken toys accessories wrinkled disrepair rugs carpet","heavy toys items are stored on lowest shelf","window cords are adjusted to prevent strangulation","children s personal nap items are kept separated use of cubbies bags or storage containers","tables and chairs are not stacked while children are present","diapering supplies are gathered and within reach before beginning including a lined and covered foot operated garbage can","changing table is clean and free of any obstructions only changing pad","first aid kit is available in each room appropriately stocked","bottles sippy cups are labeled with first and last name","infants always placed on their back to sleep in cribs pack n plays","infant room all bottles have full name date and refrigerated immediately","cribs are free of soft bedding bumper pads pillows and stuffed toys","cribs have tight fitting mattress and a secure fitted sheet","highchairs are in good repair and cleaned and sanitized before after use","safety restraints are used on infant seats swings strollers and highchairs"];
var PLAY_ROWS=[102.9,119.9,124.3,130.9,158.1,192.1,245.3,272.2,287.2,302.1,329.0,343.8,370.7,385.6,412.5,439.4,454.3,481.2,496.0,522.9,549.8,564.7,579.6,594.5,609.3,624.3,639.2];
var PLAY_DAY_COLS=[[287.0,345.3],[345.3,404.1],[404.1,463.7],[463.7,522.4],[522.4,569.5]];
var PLAY_ITEMS=["surfacing is free from broken glass nails trash and animal excrement","there are no visible cracks bending or warping rusting or breakage of any equipment","toys are clean and in good repair","there are no worn swing hangers or chains","there are no missing damaged or loose swing seats","there are no broken supports or anchors","there are no cement support footings that are exposed cracked or loose in the ground","there are no accessible sharp edges or points","there are no protruding bolt ends that have lost caps or covers","there are no loose bolts nuts and so forth that require tightening","there are no nails that have become loose","there are no splintered cracked or otherwise deteriorating wood","there is no chipped or peeling paint","trees shade covering maintained and in good repair","play areas free of foreign objects that may injure children","no unsafe equipment","ground cover adequate in play areas","ground free from debris litter rusted equipment","area free of any insect nest or infestation","equipment age appropriate and accessible"];
var EOD_ROWS=[194.9,210.4,225.9,241.5,257.0,272.5,287.9,303.4,318.9,334.4,349.8,365.3,380.9,396.4,411.9,427.4,442.9,458.3,473.8,489.3,504.8,520.4,535.9,551.4,566.8,582.3,597.8,613.3,634.5,650.0,665.5,681.0,696.4];
var EOD_COLS=[36.3,86.4,288.9,437.4,575.8];
var TL_COL_X0=[144.0,243.1,342.1,441.1,540.1,639.1], TL_IN_DX=18, TL_OUT_DX=54, TL_DATE_TOP=158, TL_DEPLOC_TOP=182, TL_DEST_TOP=205, TL_DEPTIME_TOP=220, TL_ARRTIME_TOP=232;
var TL_ROWS=[250.5,264.6,281.6,295.5,309.7,326.6,340.7,357.7,374.6,388.6,405.6,424.9,441.8,460.7,477.5,494.3], TL_NAME_X=40, TL_DRIVER_TOP=533, TL_SECOND_TOP=560;
var OFS={
 bee:{label:'Bee Clean Chart',page:0,fk:'cls',per:'room',span:'month',sign:false},
 bath:{label:'Bathroom Cleaning Log',page:1,fk:'bath',per:'room',span:'month',sign:false},
 ind:{label:'Daily Indoor Inspection',page:2,fk:'ind',per:'room',span:'week',sign:true},
 out:{label:'Daily Playground Inspection',page:3,fk:'out',per:'one',span:'week',sign:true},
 san:{label:'Sanitation & Safety Log',custom:'log',fk:'san',per:'one',span:'month',sign:false},
 tmp:{label:'Temperature Log (fridge / freezer / water)',custom:'log',fk:'tmp',per:'one',span:'month',sign:false},
 sec:{label:'Security & Sign-in Log',custom:'log',fk:'sec',per:'one',span:'month',sign:false},
 eod:{label:'End of Day Building Sweep',page:4,fk:'eod',per:'one',span:'month',sign:false},
 drill:{label:'Fire & Emergency Drill Log',custom:'drill',per:'one',span:'year',sign:false},
 sched:{label:'Staff Schedule (posted)',custom:'sched',per:'one',span:'week',sign:false},
 rsched:{label:'Classroom Schedules',custom:'rsched',per:'one',span:'week',sign:false},
 trans:{label:'Transportation Log',page:5,per:'trip',span:'week',sign:false}
};
function mid(a,b){return (a+b)/2;}
function norm(s){ s=String(s||'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ').trim(); return s.replace(/\s+/g,' '); }
function bestMatch(label,cands){ var n=norm(label); if(cands.indexOf(n)>=0) return n; var head=n.split(' ').slice(0,5).join(' '); for(var i=0;i<cands.length;i++){ var c=cands[i]; if(c.indexOf(head)===0 || n.indexOf(c.split(' ').slice(0,5).join(' '))===0) return c; } return null; }
function clean(s){ return String(s||'').replace(/[^\x20-\x7E -ÿ–—’‘“”·]/g,'').replace(/\s{2,}/g,' ').trim(); }
function items(text){ var out=[]; String(text||'').split(/\r?\n/).forEach(function(l){ l=l.trim(); if(!l) return; var flag=/^(⚠|❌|🚨)/.test(l); out.push([l.replace(/^[^\w]+/,''),flag?'flag':'ok']); }); return out; }
function wdi(s){ return (d2(s).getDay()+6)%7; }
function blockOf(d,ms){ var fm=addDays(ms,-wdi(ms)), m=addDays(d,-wdi(d)); return Math.round((d2(m)-d2(fm))/604800000); }
function subsOf(fk,room,from,to){ var out=[]; for(var id in S.subs){ var x=S.subs[id].fields; if(x.Date<from||x.Date>to) continue; if(sv(x['Form Type'])!==FORMS[fk].type) continue; if(room && FORMS[fk].per==='room' && rmKey(sv(x['Room / Classroom']))!==room) continue; out.push(S.subs[id]); } return out; }
function fmtUS(s){ var p=s.split('-'); return p[1]+'/'+p[2]+'/'+p[0]; }
function loadLibs(){
  if(OF.libs) return OF.libs;
  function sc(src){ return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=function(){ rej(new Error('Could not load '+src)); }; document.head.appendChild(s); }); }
  OF.libs=(window.PDFLib&&window.pdfjsLib?Promise.resolve():sc('pdf-lib.min.js?v=117').then(function(){ return sc('pdfjs.min.js?v=3111'); })).then(function(){ pdfjsLib.GlobalWorkerOptions.workerSrc='pdfjs.worker.min.js?v=3111'; });
  return OF.libs;
}
function loadBlank(){ if(OF.blank) return Promise.resolve(OF.blank); return fetch('files/facility-forms-blank.pdf?v=1').then(function(r){ if(!r.ok) throw new Error('Blank forms file not found'); return r.arrayBuffer(); }).then(function(b){ OF.blank=b; return b; }); }

/* ---- signatures (weekly sign-off on Indoor + Playground inspections; Director's line on the paper form) ---- */
function sgKey(form,mon,room){ return mon+' '+form+' '+room; }
function sgData(form,mon,room){ var r=OF.signs[sgKey(form,mon,room)]; if(!r) return null; try{ var d=JSON.parse(r.fields.Data||'{}'); return d&&d.sig?d:null; }catch(e){ return null; } }
function sgLoad(m){
  if(OF.loaded[m]) return Promise.resolve(); OF.loaded[m]='loading';
  return api('list','Monthly Forms',{month:m}).then(function(res){ (res.records||[]).forEach(function(x){ if(x.fields.Form!=='OFSIGN') return; var e=String(x.fields.Employee||''), a=e.indexOf(' '), b=e.indexOf(' ',a+1); if(a<0||b<0) return; OF.signs[sgKey(e.slice(a+1,b),e.slice(0,a),e.slice(b+1))]=x; }); OF.loaded[m]=true; render(); }).catch(function(e){ OF.loaded[m]=false; });
}
function sgEnsure(){ var mon=monday(S.date); sgLoad(S.date.slice(0,7)); sgLoad(mon.slice(0,7)); }
function sgSave(form,mon,room,data){
  var k=sgKey(form,mon,room), ex=OF.signs[k], nm=directorName()||'Director', now=new Date().toISOString(), p;
  if(ex) p=api('update','Monthly Forms',{recordId:ex.id,fields:{Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}});
  else p=api('create','Monthly Forms',{fields:{Entry:S.school+' · '+mon+' · OFSIGN · '+form+' '+room,Month:mon.slice(0,7),Form:'OFSIGN',Employee:k,Data:JSON.stringify(data),'Updated By':nm,'Updated At':now}});
  return p.then(function(res){ var r=res.records?res.records[0]:res; if(r&&r.id){ OF.signs[k]=r; toast(data.sig?'Signed and dated.':'Signature cleared.'); render(); } else toast('Did not save',true); }).catch(function(e){ toast(e.message||'Did not save',true); });
}
function sgPad(cb){
  var ov=document.createElement('div'); ov.className='padov'; ov.innerHTML='<div class="padbox"><div class="ct">Sign the official form</div><canvas width="700" height="220"></canvas><div class="mrow"><button class="btn sec" data-pad="clear">Clear</button><button class="btn sec" data-pad="cancel">Cancel</button><button class="btn grn" data-pad="save">Save signature</button></div></div>';
  document.body.appendChild(ov);
  var c=ov.querySelector('canvas'), x=c.getContext('2d'), dr=false, any=false; x.lineWidth=3; x.lineCap='round'; x.lineJoin='round'; x.strokeStyle='#0a2a8a'; c.style.touchAction='none';
  function pos(e){ var r=c.getBoundingClientRect(); return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]; }
  c.addEventListener('pointerdown',function(e){ dr=true; any=true; var p=pos(e); x.beginPath(); x.moveTo(p[0],p[1]); c.setPointerCapture(e.pointerId); e.preventDefault(); });
  c.addEventListener('pointermove',function(e){ if(!dr) return; var p=pos(e); x.lineTo(p[0],p[1]); x.stroke(); });
  ['pointerup','pointercancel'].forEach(function(t){ c.addEventListener(t,function(){ dr=false; }); });
  ov.addEventListener('click',function(e){ var a=e.target.getAttribute&&e.target.getAttribute('data-pad'); if(!a) return;
    if(a==='clear'){ x.clearRect(0,0,c.width,c.height); any=false; }
    else if(a==='cancel') ov.remove();
    else if(a==='save'){ if(!any) return toast('Draw your signature first.',true); var t=document.createElement('canvas'); t.width=350; t.height=110; t.getContext('2d').drawImage(c,0,0,350,110); ov.remove(); cb(t.toDataURL('image/png')); } });
}
function needSign(form,mon,room){ return OFS[form].sign && mon>='2026-09-28' && addDays(mon,4)<=todayNY() && OF.loaded[mon.slice(0,7)]===true && !sgData(form,mon,room) && subsOf(OFS[form].fk,room,mon,addDays(mon,4)).length>0; }
function signRooms(form){ return OFS[form].per==='room'?(CLASSROOMS[S.school]||[]):['Playground']; }

/* ---- drawing ---- */
function mkCtx(page,font,bold,doc,collect){
  var H=page.getHeight(), rgb=PDFLib.rgb;
  var c={page:page,H:H,doc:doc,texts:[]};
  c.check=function(cx,top,st,size){ if(st==='flag') return; var cy=H-top, s=(size||8)*0.5, col=rgb(.05,.45,.15);
    page.drawLine({start:{x:cx-s,y:cy},end:{x:cx-s*.25,y:cy-s*.7},thickness:1.4,color:col,lineCap:1}); page.drawLine({start:{x:cx-s*.25,y:cy-s*.7},end:{x:cx+s,y:cy+s*.8},thickness:1.4,color:col,lineCap:1}); };
  c.box=function(x,top,w,h){ page.drawRectangle({x:x,y:H-top-h,width:w,height:h,color:rgb(1,1,1)}); };
  c.text=function(x,top,s,size,b,color,center,maxw){ s=clean(s); if(!s) return; size=size||8; var f=b?bold:font; if(maxw){ while(f.widthOfTextAtSize(s,size)>maxw&&size>5) size-=.5; } var w=f.widthOfTextAtSize(s,size); var px=center?x-w/2:x; if(collect){ c.texts.push({x:px,top:top,s:s,size:size,b:!!b,color:color||[0,0,0]}); return; } page.drawText(s,{x:px,y:H-top,size:size,font:f,color:rgb.apply(null,color||[0,0,0])}); };
  return c;
}
function stampBee(c,room,ms){
  var R=subsOf('cls',room,ms,monthEnd(ms));
  c.text(110,mid(BEE_ROWS[1],BEE_ROWS[2])+4,d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),10,true);
  c.text(108,mid(BEE_ROWS[2],BEE_ROWS[3])+4,room+'  ·  '+S.school,10,true,null,false,175);
  R.forEach(function(s){ var d=s.fields.Date, b=blockOf(d,ms), w=wdi(d); if(w>4||b<0||b>4) return; var col=b*5+w;
    items(s.fields.Items).forEach(function(it){ var key=bestMatch(it[0],Object.keys(BEE_ITEM_ROWS)); if(!key) return; var r=BEE_ITEM_ROWS[key]; c.check(mid(BEE_COLS[col],BEE_COLS[col+1]),mid(BEE_ROWS[r],BEE_ROWS[r+1]),it[1],8); }); });
}
function stampBath(c,room,ms){
  var R=subsOf('bath',room,ms,monthEnd(ms));
  c.text(100,mid(BATH_ROWS[0],BATH_ROWS[1])+4,room,9,true,null,false,75);
  c.text(80,mid(BATH_ROWS[1],BATH_ROWS[2])+4,d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),9,true);
  R.forEach(function(s){ var d=s.fields.Date, b=blockOf(d,ms), w=wdi(d); if(w>4||b<0||b>4) return; var col=b*5+w;
    items(s.fields.Items).forEach(function(it){ var key=bestMatch(it[0],Object.keys(BATH_ITEM_ROWS)); if(!key) return; var r=BATH_ITEM_ROWS[key]; c.check(BATH_DAY_X[col]+4.5,mid(BATH_ROWS[r],BATH_ROWS[r+1]),it[1],8); }); });
}
function stampWeekly(c,fk,room,mon,ROWS,COLS,LIST,dateRow,firstRow,withInit){
  var days=[0,1,2,3,4].map(function(i){return addDays(mon,i);});
  c.text(36,38,S.school,11,true); c.text(36,52,(fk==='ind'?'Room: '+room+'   ':'Playground   ')+'Week of '+fmtUS(mon),10,true,null,false,225);
  days.forEach(function(d,i){ c.text(mid(COLS[i][0],COLS[i][1]),mid(ROWS[dateRow],ROWS[dateRow+1])+3,d.slice(5).replace('-','/'),9,true,null,true); });
  subsOf(fk,room,mon,addDays(mon,4)).forEach(function(s){ var i=wdi(s.fields.Date); if(i>4) return;
    items(s.fields.Items).forEach(function(it){ var key=bestMatch(it[0],LIST); if(!key) return; var r=firstRow+LIST.indexOf(key); c.check(mid(COLS[i][0],COLS[i][1]),mid(ROWS[r],ROWS[r+1]),it[1],8); });
    if(withInit) c.text(mid(COLS[i][0],COLS[i][1]),mid(ROWS[25],ROWS[26])+3,String(s.fields['Staff Name']||'').slice(0,12),7,false,null,true); });
}
function stampEod(c,ms){
  var R=subsOf('eod',null,ms,monthEnd(ms)).sort(function(a,b){ return a.fields.Date<b.fields.Date?-1:1; });
  c.text(165,152,S.school,11,true); c.text(480,152,d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),11,true);
  var by={}, order=[]; R.forEach(function(s){ var d=s.fields.Date; if(!by[d]){ by[d]=[]; order.push(d); } by[d].push(s); });
  order.forEach(function(d,k){ var r=k+1; if(r>=EOD_ROWS.length-1) return; var ty=mid(EOD_ROWS[r],EOD_ROWS[r+1])+3, st=[]; by[d].forEach(function(s){ var n=String(s.fields['Staff Name']||'').trim(); if(n&&st.indexOf(n)<0) st.push(n); });
    c.text(mid(EOD_COLS[0],EOD_COLS[1]),ty,d.slice(5).replace('-','/'),7,false,null,true); if(st[0]) c.text(EOD_COLS[1]+4,ty,st[0],7,false,null,false,195); if(st[1]) c.text(EOD_COLS[2]+4,ty,st[1],7,false,null,false,140); });
}
function tripsOf(mon){ var we=addDays(mon,4); return S.trips.filter(function(t){ return t.fields.Date>=mon&&t.fields.Date<=we&&t.fields.Destination; }); }
function tripCombos(mon){ var seen={}, out=[]; tripsOf(mon).forEach(function(t){ var dest=sv(t.fields.Destination), run=sv(t.fields.Run); var k=dest+'|'+run; if(!seen[k]){ seen[k]=1; out.push({dest:dest,run:run}); } }); return out.sort(function(a,b){ return (a.dest+a.run)<(b.dest+b.run)?-1:1; }); }
function stampTrans(c,mon,combo){
  var TR=tripsOf(mon).filter(function(t){ return sv(t.fields.Destination)===combo.dest&&sv(t.fields.Run)===combo.run; });
  c.text(36,26,S.school+'  ·  '+combo.dest+'  ·  '+combo.run+' run',10,true,null,false,330); c.text(36,38,'Week of '+fmtUS(mon),10,true);
  var days=[0,1,2,3,4].map(function(i){return addDays(mon,i);}), kid='Kid City USA '+S.school, dd=combo.run==='PM'?[combo.dest,kid]:[kid,combo.dest];
  function tr(d){ return TR.filter(function(t){ return t.fields.Date===d; })[0]; }
  days.forEach(function(d,i){ var t=tr(d); if(!t) return; var f=t.fields, x0=TL_COL_X0[i]; c.text(x0+12,TL_DATE_TOP,d.slice(5,7)+'  '+d.slice(8)+'  '+d.slice(2,4),7.5);
    c.text(x0+4,TL_DEPLOC_TOP,f['Departure Location']||dd[0],6.5,false,null,false,90); c.text(x0+4,TL_DEST_TOP,dd[1],6.5,false,null,false,90);
    c.text(x0+50,TL_DEPTIME_TOP,f['Departure Time']||'',6.5,false,null,false,46); c.text(x0+47,TL_ARRTIME_TOP,f['Arrival Time']||'',6.5,false,null,false,49); });
  var names=[]; TR.forEach(function(t){ String(t.fields['Riders In']||'').split(/\r?\n/).concat(String(t.fields['Riders Out']||'').split(/\r?\n/)).forEach(function(n){ n=n.trim(); if(n&&names.indexOf(n)<0) names.push(n); }); });
  names=names.sort().slice(0,TL_ROWS.length-1);
  names.forEach(function(n,r){ c.text(TL_NAME_X,mid(TL_ROWS[r],TL_ROWS[r+1])+3,n,7.5,false,null,false,100); });
  days.forEach(function(d,i){ var t=tr(d); if(!t) return; var f=t.fields, x0=TL_COL_X0[i], ins=String(f['Riders In']||'').split(/\r?\n/).map(function(s){return s.trim();}), outs=String(f['Riders Out']||'').split(/\r?\n/).map(function(s){return s.trim();});
    names.forEach(function(n,r){ var cy=mid(TL_ROWS[r],TL_ROWS[r+1]); if(ins.indexOf(n)>=0) c.text(x0+TL_IN_DX,cy+3,'X',8,true,null,true); if(outs.indexOf(n)>=0) c.text(x0+TL_OUT_DX,cy+3,'X',8,true,null,true); });
    function us(s){ s=String(s||'').slice(0,10); return /^\d{4}-/.test(s)?fmtUS(s):''; }
    if(f['Driver Date']) c.text(x0+8,TL_DRIVER_TOP+1,us(f['Driver Date']),7.5); if(f['Second Staff Date']) c.text(x0+8,TL_SECOND_TOP+1,us(f['Second Staff Date']),7.5); });
}
function logPdf(fk,ms){
  var f=FORMS[fk], me=monthEnd(ms), subs=subsOf(fk,null,ms,me).sort(function(a,b){ return a.fields.Date<b.fields.Date?-1:(a.fields.Date>b.fields.Date?1:0); }), days=[];
  for(var d=ms; d<=me; d=addDays(d,1)) if(isSchoolDay(d)) days.push(d);
  var cols=[], keys=[];
  subs.forEach(function(sb){ items(sb.fields.Items).forEach(function(it){ var k=bestMatch(it[0],keys); if(!k){ k=norm(it[0]); keys.push(k); cols.push(clean(it[0])); } }); });
  if(!cols.length) f.items(1).forEach(function(t){ keys.push(norm(t)); cols.push(clean(t)); });
  return PDFLib.PDFDocument.create().then(function(doc){ return Promise.all([doc.embedFont(PDFLib.StandardFonts.Helvetica),doc.embedFont(PDFLib.StandardFonts.HelveticaBold)]).then(function(fs){
    var F=fs[0], B=fs[1], rgb=PDFLib.rgb, page=doc.addPage([792,612]), H=612, L=30, W=732;
    function T(s,x,y,sz,b,maxw){ s=clean(s); if(!s) return; while(maxw&&(b?B:F).widthOfTextAtSize(s,sz)>maxw&&sz>4.5) sz-=.5; page.drawText(s,{x:x,y:y,size:sz,font:b?B:F}); }
    var title=f.label.replace(/^./,function(c){return c.toUpperCase();}), mon=d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'});
    T('KID CITY USA - '+S.school.toUpperCase(),L,H-36,15,true); T(title+' - '+mon,L,H-54,12,true);
    T('Done every school day. Each person who completes it signs with their name. A director reviews the page at the end of the month.',L,H-68,8);
    var wDate=62, wBy=125, wTime=52, wRev=62, wItem=Math.max(48,Math.min(150,(W-wDate-wBy-wTime-wRev)/cols.length)), used=wDate+wBy+wTime+wRev+wItem*cols.length;
    var hy=H-80, hh=52, x=L;
    function cell(x0,y0,w,h,fill){ page.drawRectangle({x:x0,y:y0,width:w,height:h,borderColor:rgb(0,0,0),borderWidth:.7,color:fill||undefined}); }
    function wrap(s,w,sz){ var out=[],line=''; clean(s).split(' ').forEach(function(wd){ if(F.widthOfTextAtSize((line+' '+wd).trim(),sz)>w-6&&line){ out.push(line); line=wd; } else line=(line+' '+wd).trim(); }); if(line) out.push(line); return out; }
    cell(x,hy-hh,wDate,hh,rgb(.9,.9,.9)); T('DATE',x+8,hy-hh/2-3,8,true); x+=wDate;
    cols.forEach(function(c){ cell(x,hy-hh,wItem,hh,rgb(.9,.9,.9)); var ls=wrap(c,wItem,6.5).slice(0,5); ls.forEach(function(l,i){ T(l,x+3,hy-10-i*8,6.5,true); }); x+=wItem; });
    cell(x,hy-hh,wBy,hh,rgb(.9,.9,.9)); T('SIGNED BY (staff name)',x+4,hy-hh/2-3,7.5,true); x+=wBy;
    cell(x,hy-hh,wTime,hh,rgb(.9,.9,.9)); T('TIME',x+10,hy-hh/2-3,8,true); x+=wTime;
    cell(x,hy-hh,wRev,hh,rgb(.9,.9,.9)); T('DIRECTOR',x+6,hy-hh/2+2,7.5,true); T('INITIALS',x+8,hy-hh/2-8,7.5,true);
    var rh=Math.min(20,(hy-hh-52)/Math.max(days.length,1)), y=hy-hh;
    days.forEach(function(dd){
      y-=rh; x=L; var list=subs.filter(function(sb){ return sb.fields.Date===dd; }), done={}, names=[], flag={}, tm='';
      list.forEach(function(sb){ items(sb.fields.Items).forEach(function(it){ var k=bestMatch(it[0],keys); if(k){ if(it[1]==='flag') flag[k]=1; else done[k]=1; } }); var n=String(sb.fields['Staff Name']||'').trim(); if(n&&names.indexOf(n)<0) names.push(n); if(!tm&&sb.fields['Submitted At']) tm=new Date(sb.fields['Submitted At']).toLocaleTimeString('en-US',{timeZone:NY,hour:'numeric',minute:'2-digit'}); });
      cell(x,y,wDate,rh); T(fmtUS(dd).slice(0,5)+'  '+d2(dd).toLocaleDateString('en-US',{weekday:'short'}),x+4,y+rh/2-3,8,false); x+=wDate;
      keys.forEach(function(k){ cell(x,y,wItem,rh); if(done[k]){ var cx=x+wItem/2, cy=y+rh/2, g=rgb(.05,.45,.15); page.drawLine({start:{x:cx-4,y:cy},end:{x:cx-1,y:cy-3.5},thickness:1.5,color:g}); page.drawLine({start:{x:cx-1,y:cy-3.5},end:{x:cx+5,y:cy+4},thickness:1.5,color:g}); } else if(flag[k]){ T('!',x+wItem/2-2,y+rh/2-3,10,true); } x+=wItem; });
      cell(x,y,wBy,rh); T(names.join(', '),x+4,y+rh/2-3,7.5,false,wBy-8); x+=wBy;
      cell(x,y,wTime,rh); T(tm,x+4,y+rh/2-3,7.5,false,wTime-6); x+=wTime;
      cell(x,y,wRev,rh);
    });
    T('Check mark = done and OK.   ! = flagged, needs attention.   Blank row = not recorded.',L,y-16,8);
    T('Director review:  ______________________________     Date: ______________',L,y-34,10);
    T('Printed from the Hive portal - '+title+' - '+mon,L,14,7);
    return doc.save();
  }); });
}

function sopLoad(){ return fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:PIN,action:'sop_get'})}).then(function(r){return r.json();}).then(function(j){ if(j&&j.error) throw new Error(j.error); if(!window.SOP) throw new Error('sop-data.js did not load'); return SOP.merge(S.school,j.data); }); }
function schedPdf(kind){
  return sopLoad().then(function(D){ var L=PDFLib, rgb=L.rgb;
    return L.PDFDocument.create().then(function(doc){ return Promise.all([doc.embedFont(L.StandardFonts.Helvetica),doc.embedFont(L.StandardFonts.HelveticaBold)]).then(function(f){
      var F=f[0], B=f[1];
      function hdr(page,title,sub){ page.drawText('NAME OF FACILITY/HOME:',{x:30,y:572,size:10,font:B}); page.drawText('Kid City USA '+ascii(S.school),{x:178,y:572,size:13,font:F}); page.drawText(ascii(title),{x:30,y:548,size:16,font:B}); page.drawText(ascii(sub),{x:30,y:532,size:10,font:F}); page.drawLine({start:{x:30,y:526},end:{x:762,y:526},thickness:1}); }
      function cell(page,t,x,y,w,sz,b){ t=ascii(t); var fo=b?B:F; while(sz>5&&fo.widthOfTextAtSize(t,sz)>w-6) sz-=.5; page.drawText(t,{x:x+3,y:y,size:sz,font:fo}); }
      function foot(page){ page.drawText('Director signature: ______________________________   Date: ______________',{x:30,y:30,size:10,font:F}); }
      function hx(c){ return rgb(parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255); }
      function rect(page,x,y,w,h,fill){ page.drawRectangle({x:x,y:y,width:w,height:h,borderColor:rgb(0,0,0),borderWidth:.7,color:fill?(typeof fill==='string'?hx(fill):rgb(.92,.92,.92)):undefined}); }
      function tm(t){ return t?SOP.fmt(t).replace(' AM','a').replace(' PM','p'):''; }
      if(kind==='sched'){
        var page=doc.addPage([792,612]); hdr(page,'Staff Schedule','Posted weekly hours - week of '+nice(monday(S.date)));
        var cols=[['Name',120],['Position',150],['Room',130],['Mon',60],['Tue',60],['Wed',60],['Thu',60],['Fri',60],['Break',82]], x=30, y=500;
        cols.forEach(function(c){ rect(page,x,y,c[1],20,1); cell(page,c[0],x,y+6,c[1],9,1); x+=c[1]; });
        (D.staff||[]).forEach(function(st){ y-=26; x=30; var vals=[st.name,st.role||'',st.room||''];
          [1,2,3,4,5].forEach(function(d){ var w=(st.week||{})[d]; vals.push(w?tm(w.in)+'-'+tm(w.out):'OFF'); });
          vals.push(st.brk?tm(st.brk.s)+'-'+tm(st.brk.e):'');
          var tint=SOP.color(D,st.name)[0]; cols.forEach(function(c,i){ rect(page,x,y,c[1],26,tint); cell(page,vals[i],x,y+9,c[1],i>2?7.5:9,i===0); x+=c[1]; }); });
        var cz=[]; (function(){ var mo=monday(S.date); for(var q=0;q<5;q++){ var dd=addDays(mo,q), cc=SOP.closure(dd,S.school); if(cc) cz.push(nice(dd)+': '+(cc.type==='all'?'SCHOOL CLOSED - ':'VPK and school-age closed - ')+cc.name); } })(); cz.forEach(function(t,i){ page.drawText(ascii(t),{x:30,y:84-i*11,size:9,font:B}); });
        page.drawText('Schedules may change when a staff member is out; changes are recorded in the Hive.',{x:30,y:54,size:9,font:F}); foot(page);
      } else {
        Object.keys(D.rooms).forEach(function(r){ var o=D.rooms[r], age=(SOP.AGE[o.tpl]||{label:''}), page=doc.addPage([792,612]);
          hdr(page,'Classroom Daily Schedule - '+r,age.label+'   Teachers: '+(D.staff||[]).filter(function(s){return s.room===r;}).map(function(s){return s.name;}).join(', '));
          var bl=o.blocks||[], y=506, rh=Math.min(22,Math.floor(450/Math.max(1,bl.length)));
          rect(page,30,y,150,rh,1); cell(page,'Time',30,y+6,150,9,1); rect(page,180,y,582,rh,1); cell(page,'Activity',180,y+6,582,9,1);
          bl.forEach(function(b){ y-=rh; rect(page,30,y,150,rh,0); cell(page,SOP.fmt(b.s)+' - '+SOP.fmt(b.e),30,y+6,150,9,0); rect(page,180,y,582,rh,0); cell(page,b.t,180,y+6,582,9,0); });
          foot(page); });
      }
      return doc.save(); }); }); });
}
function buildCustom(F,collect){
  return loadLibs().then(function(){
    if(F.custom==='drill') return drillPdf(S.date.slice(0,4));
    if(F.custom==='sched'||F.custom==='rsched') return schedPdf(F.custom);
    return logPdf(F.fk,monthStart(S.date));
  }).then(function(bytes){ return {bytes:bytes,texts:[]}; });
}
function build(collect){
  var F=OFS[OF.form], mon=monday(S.date), ms=monthStart(S.date), room=OF.room, combo=null;
  if(F.custom) return buildCustom(F,collect);
  return Promise.all([loadLibs(),loadBlank()]).then(function(){
    return PDFLib.PDFDocument.load(OF.blank);
  }).then(function(src){
    return PDFLib.PDFDocument.create().then(function(out){ return out.copyPages(src,[F.page]).then(function(pg){ out.addPage(pg[0]); return out.embedFont(PDFLib.StandardFonts.Helvetica).then(function(font){ return out.embedFont(PDFLib.StandardFonts.HelveticaBold).then(function(bold){ return {out:out,font:font,bold:bold}; }); }); }); });
  }).then(function(o){
    var page=o.out.getPage(0), c=mkCtx(page,o.font,o.bold,o.out,collect), p=Promise.resolve();
    if(OF.form==='bee') stampBee(c,room,ms); else if(OF.form==='bath') stampBath(c,room,ms);
    else if(OF.form==='ind'){ stampWeekly(c,'ind',room,mon,IND_ROWS,IND_DAY_COLS,IND_ITEMS,2,4,false); var d=sgData('ind',mon,room); if(d) p=o.out.embedPng(d.sig).then(function(im){ page.drawImage(im,{x:150,y:c.H-762,width:80,height:25}); c.text(410,749,d.date||'',9); }); }
    else if(OF.form==='out'){ stampWeekly(c,'out','Playground',mon,PLAY_ROWS,PLAY_DAY_COLS,PLAY_ITEMS,3,5,true); var d2_=sgData('out',mon,'Playground'); if(d2_) p=o.out.embedPng(d2_.sig).then(function(im){ page.drawImage(im,{x:100,y:c.H-668,width:80,height:25}); c.text(400,664,d2_.date||'',9); }); }
    else if(OF.form==='eod') stampEod(c,ms);
    else if(OF.form==='trans'){ var cs=tripCombos(mon); combo=cs[Math.min(OF.trip,cs.length-1)]; if(combo) stampTrans(c,mon,combo); }
    return p.then(function(){ return o.out.save(); }).then(function(bytes){ return {bytes:bytes,texts:c.texts}; });
  });
}
function paint(bytes,texts){
  return pdfjsLib.getDocument({data:bytes.slice(0)}).promise.then(function(doc){
    var n=Math.min(doc.numPages,8), urls=[], land=false;
    function one(i){
      return doc.getPage(i).then(function(pg){
        var vp=pg.getViewport({scale:3}), cv=document.createElement('canvas'); cv.width=vp.width; cv.height=vp.height; land=vp.width>vp.height;
        return pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise.then(function(){ var x=cv.getContext('2d'), sc=3; if(i===1) (texts||[]).forEach(function(t){ x.fillStyle='rgb('+Math.round(t.color[0]*255)+','+Math.round(t.color[1]*255)+','+Math.round(t.color[2]*255)+')'; x.font=(t.b?'bold ':'')+(t.size*sc)+'px Helvetica, Arial, sans-serif'; x.textBaseline='alphabetic'; x.fillText(t.s,t.x*sc,t.top*sc); }); urls.push(cv.toDataURL('image/jpeg',.92)); return i<n?one(i+1):null; });
      });
    }
    return one(1).then(function(){ return {url:urls[0],urls:urls,landscape:land}; });
  });
}
function hashOf(){
  var mon=monday(S.date), ms=monthStart(S.date), F=OFS[OF.form], bits=[OF.form,OF.room,OF.trip,S.school,S.date];
  if(F.fk){ var from=F.span==='month'?ms:mon, to=F.span==='month'?monthEnd(ms):addDays(mon,4); subsOf(F.fk,OF.room,from,to).forEach(function(s){ bits.push(s.id+(s.fields.Items||'').length+(s.fields['Staff Name']||'')); }); }
  else if(F.custom==='drill'){ var yy=S.date.slice(0,4); bits.push(S.loaded['drl|'+yy]===true); drillRows(yy+'-01-01',yy+'-12-31').forEach(function(r){ bits.push(r.id+JSON.stringify(r).length); }); }
  else tripsOf(mon).forEach(function(t){ bits.push(t.id+JSON.stringify(t.fields).length); });
  if(F.sign){ var d=sgData(OF.form,mon,OF.form==='out'?'Playground':OF.room); bits.push(d?d.date+d.sig.length:'nosig'); }
  var s=bits.join('~'), h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return String(h);
}
function missRows(){
  var F=OFS[OF.form]; if(!F.fk) return []; var mon=monday(S.date), ms=monthStart(S.date), from=F.span==='month'?ms:mon, to=F.span==='month'?monthEnd(ms):addDays(mon,4), t=todayNY(), out=[];
  for(var d=from; d<=to&&d<t; d=addDays(d,1)){ if(!isSchoolDay(d)) continue; var r=F.per==='room'?OF.room:(F.fk==='out'?'Playground':'(building)'); if(cellState(F.fk,d,r).s==='miss') out.push({d:d,r:r}); }
  return out;
}
function detailCard(fk){
  var ms=monthStart(S.date), me=monthEnd(ms), t=todayNY(), f=FORMS[fk], mn=d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  var h='<div class="card"><div class="ct">Who did it &mdash; '+esc(f.label)+', '+mn+'</div><div class="sub">Every check that was marked and the staff name that signed it, day by day. Tap Open to look at a day or fix it.</div><div class="gw"><table class="grid" style="font-size:12px;min-width:640px"><tr><th>Day</th><th>Checks</th><th>Signed by (and time)</th><th></th></tr>';
  for(var d=ms; d<=me && d<=t; d=addDays(d,1)){
    var list=subsFor(fk,d,null).sort(function(a,b){ return String(a.fields['Submitted At']||'')<String(b.fields['Submitted At']||'')?-1:1; });
    if(!list.length){ if(!isSchoolDay(d)) continue; h+='<tr><td>'+nice(d)+'</td><td colspan="2" style="color:'+(d<t?'#c62828':'#888')+'">'+(d<t?'&#9679; Not recorded':'Not done yet today')+'</td><td><button class="btn sec sm" data-cell="'+fk+'|'+d+'|(building)">'+(d<t?'Fill in':'Open')+'</button></td></tr>'; continue; }
    var its=[], seen={}; list.forEach(function(sb){ parseItems(sb.fields.Items).forEach(function(it){ var k=norm(it.text); if(!seen[k]){ seen[k]=1; its.push(it); } else if(!it.ok) its.forEach(function(o){ if(norm(o.text)===k) o.ok=false; }); }); });
    var names=list.map(function(sb){ var tm=sb.fields['Submitted At']?new Date(sb.fields['Submitted At']).toLocaleTimeString('en-US',{timeZone:NY,hour:'numeric',minute:'2-digit'}):''; return '<b>'+esc(sb.fields['Staff Name']||'?')+'</b>'+(tm?' <span style="color:#666">'+esc(tm)+'</span>':''); });
    var notes=list.map(function(sb){ return String(sb.fields.Details||'').trim(); }).filter(Boolean);
    h+='<tr><td style="white-space:nowrap">'+nice(d)+'</td><td>'+its.map(function(it){ return '<div style="color:'+(it.ok?'#1c7c3f':'#c62828')+'">'+(it.ok?'&#10003; ':'&#9888; ')+esc(it.text)+'</div>'; }).join('')+(notes.length?'<div style="color:#666;margin-top:3px">Note: '+esc(notes.join(' | '))+'</div>':'')+'</td><td>'+names.join('<br>')+'</td><td><button class="btn sec sm" data-cell="'+fk+'|'+d+'|(building)">Open</button></td></tr>';
  }
  return h+'</table></div></div>';
}
function ofView(){
  var F=OFS[OF.form], mon=monday(S.date); sgEnsure(); if(F.custom==='drill') drillEnsure(S.date.slice(0,4));
  var rooms=CLASSROOMS[S.school]||[]; if(F.per==='room'&&(!OF.room||rooms.indexOf(OF.room)<0)) OF.room=rooms[0];
  var h='<div class="card"><div class="ct">Official forms &mdash; the real paper forms, filled in</div><div class="sub">These are the same Kid City / Bee System forms DCF expects to see, filled in from what staff entered on the portal. Blank = not done or not entered yet. Use the &lsaquo; &rsaquo; buttons above for the week or month.</div><div class="rpbar">';
  Object.keys(OFS).forEach(function(k){ h+='<button class="btn'+(OF.form===k?'':' sec')+' sm" data-of="form" data-v="'+k+'">'+OFS[k].label+'</button>'; });
  h+='</div>';
  if(F.per==='room'){ h+='<div class="rpbar">'; rooms.forEach(function(r){ var nd=F.sign&&needSign(OF.form,mon,r); h+='<button class="btn'+(OF.room===r?'':' sec')+' sm" data-of="room" data-v="'+esc(r)+'">'+esc(r)+(nd?' <span style="color:#ff5252">&#9679;</span>':'')+'</button>'; }); h+='</div>'; }
  if(OF.form==='trans'){ var cs=tripCombos(mon); if(!cs.length) h+='<div class="sub">No bus trips logged for this week.</div>'; else { h+='<div class="rpbar">'; cs.forEach(function(c,i){ h+='<button class="btn'+(OF.trip===i?'':' sec')+' sm" data-of="trip" data-v="'+i+'">'+esc(c.dest)+' &middot; '+esc(c.run)+'</button>'; }); h+='</div>'; } }
  h+='<div class="sub"><b>'+(F.span==='year'?'Year '+S.date.slice(0,4):F.span==='month'?d2(monthStart(S.date)).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'Week of '+nice(mon))+'</b></div>';
  var mr=missRows(); if(mr.length){ h+='<div class="wkbar bad"><b style="color:#c62828">&#9679; Not updated yet ('+mr.length+'):</b> '; mr.forEach(function(m){ h+='<button class="btn sec sm" data-cell="'+F.fk+'|'+m.d+'|'+esc(m.r)+'">'+nice(m.d)+'</button> '; }); h+='<div class="hint">Tap a day to fill it in or fix it. It stays blank on the form until it is entered.</div></div>'; }
  if(F.sign){ var sr=OF.form==='out'?'Playground':OF.room, d=sgData(OF.form,mon,sr), ended=addDays(mon,4)<=todayNY();
    h+='<div class="wkbar'+(d||!ended?'':' bad')+'">'+(d?'<b style="color:#2e7d32">&#10003; Director signed '+esc(d.date||'')+' by '+esc(d.by||'')+'</b>':'<b'+(ended?' style="color:#c62828"':'')+'>'+(ended?'&#9679; ':'')+'Director signature and date '+(ended?'needed for this week':'(sign at the end of the week)')+'</b>')+' <button class="btn grn sm" data-of="sign">'+(d?'Re-sign':'Sign')+'</button>'+(d?' <button class="btn sec sm" data-of="sdate">Change date</button> <button class="btn sec sm" data-of="sclear">Clear</button>':'')+'<div class="hint">Directors sign, change the date or clear the sign-off. Staff fill in the daily checklists on their phones; a director fixes a day with the buttons above.</div></div>'; }
  var key=hashOf(), cached=OF.cache[key];
  h+='<div class="sub"><b>'+esc(S.school)+'</b>'+(F.per==='room'&&OF.room?' &middot; <b>'+esc(OF.room)+'</b>':'')+' &middot; '+(F.span==='year'?'year '+S.date.slice(0,4):F.span==='month'?d2(monthStart(S.date)).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'week of '+fmtUS(mon)+' to '+fmtUS(addDays(mon,4)))+' &mdash; on a phone, slide the form left and right to see all of it.</div><div class="rpbar"><button class="btn grn sm" data-of="print">Print this form</button><button class="btn sec sm" data-of="dl">Download PDF</button></div><div class="rpscroll" id="ofbox">'+(cached?(cached.urls||[cached.url]).map(function(u){ return '<img src="'+u+'" style="width:100%;min-width:900px;max-width:1100px;display:block;margin:0 auto 10px;background:#fff">'; }).join(''):'<div class="sub">Drawing the form&hellip;</div>')+'</div></div>';
  if(F.fk && F.per==='one' && F.fk!=='out') h+=detailCard(F.fk);
  OF.want=key; return h;
}
function ofAfter(){
  var key=OF.want; if(!key||OF.cache[key]||OF.building===key) return; OF.building=key;
  Promise.all([build(true),build(false)]).then(function(b2){ return paint(b2[0].bytes,b2[0].texts).then(function(r){ r.bytes=b2[1].bytes; OF.cache[key]=r; OF.building=null; var keys=Object.keys(OF.cache); if(keys.length>12) delete OF.cache[keys[0]]; if(OF.want===key&&S.tab==='ofc') render(); }); })
   .catch(function(e){ OF.building=null; var b=$('ofbox'); if(b) b.innerHTML='<div class="miss">Could not draw the form: '+esc(e.message||e)+'</div>'; });
}
/* hooks */
TABS.splice(7,0,{id:'ofc',label:'Official Forms',forms:[]});
var oldBody=body; body=function(){ return S.tab==='ofc'?ofView():oldBody(); };
var oldRender=render; render=function(){ oldRender(); if(S.tab==='ofc') ofAfter(); };
var body2=body; body=function(){ var h=body2(), m={clean:['bee','bath'],insp:['ind','out','san'],temp:['tmp','sec'],eod:['eod']}[S.tab];
  if(m) h='<div class="card"><div class="ct">The official paper form</div><div class="sub">Tap to see the real form filled in from what staff entered, with who signed. You can print it from there.</div><div class="mrow">'+m.map(function(k){ return '<button class="btn" data-ofgo="'+k+'">'+OFS[k].label+' &mdash; see &amp; print</button>'; }).join(' ')+'</div></div>'+h;
  return h; };
document.addEventListener('click',function(e){ var el=e.target.closest&&e.target.closest('[data-ofgo]'); if(!el) return; e.preventDefault(); OF.form=el.getAttribute('data-ofgo'); OF.trip=0; S.tab='ofc'; render(); try{ window.scrollTo(0,0); }catch(x){} });
var oldMissing=missingList;
missingList=function(from,to){ var out=oldMissing(from,to); try{ ['ind','out'].forEach(function(f){ var seen={}; for(var d=from; d<=to; d=addDays(d,1)){ var mon=monday(d); if(seen[mon]||addDays(mon,4)<from||addDays(mon,4)>to) continue; seen[mon]=1; signRooms(f).forEach(function(r){ if(needSign(f,mon,r)) out.push({kind:'of',form:f,mon:mon,room:r}); }); } }); }catch(e){} return out; };
document.addEventListener('click',function(e){
  var el=e.target.closest&&e.target.closest('[data-of]'); if(!el) return; var a=el.getAttribute('data-of'), v=el.getAttribute('data-v'), mon=monday(S.date), F=OFS[OF.form], sr=OF.form==='out'?'Playground':OF.room;
  if(a==='form'){ OF.form=v; OF.trip=0; render(); }
  else if(a==='room'){ OF.room=v; render(); }
  else if(a==='trip'){ OF.trip=+v; render(); }
  else if(a==='sign'){ var nm=directorName(); if(!nm) return; sgPad(function(url){ sgSave(OF.form,mon,sr,{sig:url,date:todayUS(),by:nm,at:new Date().toISOString()}); }); }
  else if(a==='sdate'){ var d=sgData(OF.form,mon,sr); if(!d) return; var s=prompt('Date signed (mm/dd/yyyy):',d.date||todayUS()); if(s===null) return; var m=s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m) return toast('Enter the date like 11/02/2026',true); d.date=('0'+m[1]).slice(-2)+'/'+('0'+m[2]).slice(-2)+'/'+m[3]; sgSave(OF.form,mon,sr,d); }
  else if(a==='sclear'){ if(!sgData(OF.form,mon,sr)) return; if(!confirm('Clear this signature and date? The form will show as NOT signed until it is signed again.')) return; sgSave(OF.form,mon,sr,{}); }
  else if(a==='print'||a==='dl'){ var c=OF.cache[OF.want]; if(!c) return toast('The form is still drawing.',true);
    if(a==='dl'){ var b=new Blob([c.bytes],{type:'application/pdf'}), u=URL.createObjectURL(b), l=document.createElement('a'); l.href=u; l.download=(S.school+' - '+F.label+' - '+(F.span==='month'?monthStart(S.date).slice(0,7):mon)+(OF.room?' - '+OF.room:'')+'.pdf').replace(/[\/\\]/g,'-'); document.body.appendChild(l); l.click(); l.remove(); setTimeout(function(){ URL.revokeObjectURL(u); },4000); }
    else { $('repprint').innerHTML=(c.urls||[c.url]).map(function(u){ return '<img class="rp" src="'+u+'" style="width:100%;display:block">'; }).join(''); window.repDoPrint(c.landscape?'landscape':'portrait'); } }
});
window.__dcfOf={OF:OF,OFS:OFS,build:build};
})();

document.addEventListener('click',function(e){ var el=e.target.closest&&e.target.closest('[data-dact]'); if(!el) return; var a=el.getAttribute('data-dact'); if(a==='vault'){ e.preventDefault(); drillVault(); } });
document.addEventListener('change',function(e){ var el=e.target; if(el&&el.getAttribute&&el.getAttribute('data-dact')==='upload') drillUpload(el); });
window.__dcf={S:S,cellState:cellState,missingList:missingList,drillMissing:drillMissing,parseItems:parseItems};
})();
