/* The Hive — Rooms board (fast sign-in/out, meals, wellness, transitions, DCF paper view, roster).
   Built 11/2/26. Talks only to rooms-api.php (separate from the live portal api.php). */
(function(){
'use strict';
var P = window.RoomsPaper, esc = P.esc;
var API = 'rooms-api.php';
var APP = document.getElementById('app'), MODAL = document.getElementById('modal'), TOAST = document.getElementById('toast');

/* ---------- state ---------- */
var S = {pin:null, role:null, school:null, dirPin:null, dirAt:0, date:todayISO(), rooms:[], kids:[], attRows:{}, days:{},
  view:'login', room:null, tab:'sheet', sel:{}, bulkTime:'', loaded:false, pending:0, tick:0, lastErr:''};

function pad(n){ return (n<10?'0':'')+n; }
function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function nowHM(){ var d=new Date(); return pad(d.getHours())+':'+pad(d.getMinutes()); }
function isToday(){ return S.date===todayISO(); }
function toMin(hm){ var p=hm.split(':'); return (+p[0])*60+(+p[1]); }
function ls(k,v){ try{ if(v===undefined) return sessionStorage.getItem(k)||localStorage.getItem(k); if(v===null){ sessionStorage.removeItem(k); localStorage.removeItem(k); } else { sessionStorage.setItem(k,v); localStorage.setItem(k,v); } }catch(e){ return null; } }
function niceDate(ds){ var d=new Date(ds+'T12:00:00'); return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }
function shiftDate(n){ var d=new Date(S.date+'T12:00:00'); d.setDate(d.getDate()+n); S.date=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }

/* ---------- api ---------- */
function isWriteDay(action, table){ return /^(update|updateMany|create|createMany)$/.test(action) && (table==='Room Attendance'||table==='Room Day'); }
function api(action, table, extra, pinOverride){
  if(!pinOverride && S.role==='teacher' && !isToday() && isWriteDay(action, table)){
    if(S.dirPin && Date.now()-S.dirAt<10*60*1000) pinOverride=S.dirPin;
    else return Promise.reject(new Error('Teachers can only change today. Tell your director to change an earlier day.'));
  }
  var body = {pin: pinOverride||S.pin, school: S.school, action: action, table: table};
  if(extra) for(var k in extra) body[k]=extra[k];
  return fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(j){ if(!r.ok || j.error) throw new Error(j.error||('Error '+r.status)); return j; }); });
}
var chain = Promise.resolve();
function enqueue(fn){
  S.pending++; paintSaving();
  /* 2026-11-18: a failed save keeps showing "Not saved" until a later save works or Refresh is tapped */
  chain = chain.then(fn).then(function(){ S.saveFailed=false; }, function(e){ S.saveFailed=true; toast('Could not save: '+e.message+' — tap Refresh to re-sync.', true); S.lastErr=e.message; })
    .then(function(){ S.pending--; paintSaving(); });
  return chain;
}
function paintSaving(){ var el=document.getElementById('sv'); if(!el) return; el.textContent = S.pending? 'Saving…' : (S.saveFailed? '⚠ Not saved, tap ↻' : 'Saved'); el.className='sv '+(S.pending?'busy':(S.saveFailed?'bad':'ok')); }

/* ---------- data load ---------- */
function parseJSON(s,d){ try{ return s? JSON.parse(s): d; }catch(e){ return d; } }
function loadStatic(){
  return Promise.all([api('list','Rooms'), api('list','Room Children')]).then(function(r){
    S.rooms = (r[0].records||[]).filter(function(x){ return x.fields.Active; }).map(function(x){ return {id:x.id, name:x.fields.Room, teachers:(x.fields.Teachers||'').split(',').map(function(t){return t.trim();}).filter(Boolean), order:x.fields.Order||99}; }).sort(function(a,b){return a.order-b.order;});
    S.kids = (r[1].records||[]).map(function(x){ var f=x.fields; return {id:x.id, name:f.Child, dob:f.DOB||'', room:f.Room||'', status:(f.Status&&f.Status.name)||f.Status||'Active', wdDate:f['Withdrawn Date']||'', wdFrom:f['Withdrawn From Room']||'', wdReason:f['Withdraw Reason']||'', kk:!!f['KidKare Removed'], pc:!!f['ProCare Removed'], verify:f.Verify||'', order:f.Order||99}; });
  });
}
function loadDay(){
  return Promise.all([api('list','Room Attendance',{date:S.date}), api('list','Room Day',{date:S.date})]).then(function(r){
    var att={};
    (r[0].records||[]).forEach(function(x){ var n=x.fields.Child; if(!n) return; if(!att[n] || x.createdTime<att[n].created) att[n]={id:x.id, created:x.createdTime, f:x.fields}; });
    var days={};
    (r[1].records||[]).forEach(function(x){ var rm=x.fields.Room; if(!rm) return; if(!days[rm] || x.createdTime<days[rm].created){ var f=x.fields; days[rm]={id:x.id, created:x.createdTime, staff:parseJSON(f.Staff,{}), transitions:parseJSON(f.Transitions,[]), counts:parseJSON(f.Counts,[]), mgmt:parseJSON(f.Mgmt,{}), notes:f.Notes||''}; } });
    S.attRows=att; S.days=days;
  });
}
function refresh(quiet){
  var p = S.loaded ? Promise.resolve() : loadStatic();
  return p.then(loadDay).then(function(){ S.loaded=true; if(!quiet) S.saveFailed=false; render(); autoCatch(); }).catch(function(e){ if(!quiet) toast(e.message,true); });
}
/* automatic transportation catch-up for school-age rooms: fills BLANK times from the trip log only (never overwrites) */
var AUTOC={};
function autoCatch(){
  if(!S.room || !isSA(S.room) || S.pending>0) return;
  if(S.role==='teacher' && !isToday()) return;
  var key=S.school+'|'+S.date+'|'+S.room; if(AUTOC[key] && Date.now()-AUTOC[key]<5*60*1000) return; AUTOC[key]=Date.now();
  transCatch(false).then(function(r){ if(Object.keys(r.patches).length){ patchAtt(r.patches); toast('Filled in '+(r.nOut+r.nIn)+' school time(s) from the transportation log.'); } }).catch(function(){});
}
function reloadAll(){ S.loaded=false; return refresh(); }

/* ---------- derived ---------- */
function activeKids(){ return S.kids.filter(function(k){ return k.status==='Active'; }); }
function attOf(name){ return (S.attRows[name]&&S.attRows[name].f)||{}; }
function effRoom(k){ var a=attOf(k.name); return a['Current Room']||k.room; }
function roomKids(roomName){
  var out=[];
  activeKids().forEach(function(k){
    var er=effRoom(k);
    if(er===roomName) out.push({name:k.name, dob:k.dob, visiting: k.room!==roomName ? 'from '+k.room : '', order:(k.room===roomName?0:1000)+k.order, id:k.id});
  });
  return out.sort(function(a,b){ return a.order-b.order; });
}
function movedOut(roomName){ return activeKids().filter(function(k){ return k.room===roomName && effRoom(k)!==roomName; }); }
function attMapFor(list){ var m={}; list.forEach(function(c){ var a=attOf(c.name); m[c.name]={Arrival:a.Arrival||'',Departure:a.Departure||'',B:!!a.B,L:!!a.L,P:!!a.P,WC:a.WC||'',IR:a.IR||'',AR:a.AR||'',SO:a['School Out']||'',SI:a['School In']||''}; }); return m; }
function saFix(m,sa){ if(!sa) return m; Object.keys(m).forEach(function(k){ var a=m[k]; if(a && !a.SO && !a.SI && a.Departure && a.Departure<'09:30'){ m[k]=Object.assign({},a,{SO:a.Departure,Departure:''}); } }); return m; }
function isSA(roomName){ return /school.?age|worker/i.test(roomName||''); }
function dayOf(roomName){ return S.days[roomName] || {id:null, staff:{}, transitions:[], counts:[], mgmt:{}, notes:''}; }
function portalSchool(){ try{ var s=sessionStorage.getItem('hiveSchool')||''; return (s==='Sanford'||s==='DeLand 2')? s : ''; }catch(e){ return ''; } }
function isPresent(a){ return !!(a.Arrival && !a.Departure); }
function presentIn(roomName){ return roomKids(roomName).filter(function(c){ return isPresent(attOf(c.name)); }); }
function openTrans(day){ for(var i=day.transitions.length-1;i>=0;i--){ if(!day.transitions[i].in) return day.transitions[i]; } return null; }
function roomObj(name){ for(var i=0;i<S.rooms.length;i++) if(S.rooms[i].name===name) return S.rooms[i]; return null; }
function staffNow(day){ return P.staffAt(day.staff, nowHM()); }
function roomRatioNow(roomName){
  var list=roomKids(roomName), day=dayOf(roomName), am=attMapFor(list), hm=isToday()? nowHM() : '12:00';
  return P.ratioAt(list.map(function(c){return {name:c.name,dob:c.dob};}), am, day.staff, hm, S.date);
}
function lastCountMin(roomName){
  var day=dayOf(roomName), best=null;
  day.counts.forEach(function(c){ if(best==null || c.t>best) best=c.t; });
  if(best==null){ roomKids(roomName).forEach(function(c){ var a=attOf(c.name); if(a.Arrival && (best==null||a.Arrival<best)) best=a.Arrival; }); }
  return best;
}
function headcountDue(roomName){
  if(!isToday()) return false;
  if(!presentIn(roomName).length) return false;
  var last=lastCountMin(roomName); if(!last) return false;
  return toMin(nowHM())-toMin(last) >= 10;
}
function schoolTeachers(){ var o=[]; S.rooms.forEach(function(r){ r.teachers.forEach(function(t){ if(o.indexOf(t)<0) o.push(t); }); }); S.rooms.forEach(function(r){ Object.keys(dayOf(r.name).staff).forEach(function(t){ if(o.indexOf(t)<0) o.push(t); }); }); return o; }
function teachersFor(roomName){ var r=roomObj(roomName); var t=(r?r.teachers:[]).slice(); Object.keys(dayOf(roomName).staff).forEach(function(k){ if(t.indexOf(k)<0) t.push(k); }); return t; }

/* ---------- writes ---------- */
function attKey(name){ return S.school+'|'+S.date+'|'+name; }
function kidByName(n){ for(var i=0;i<S.kids.length;i++) if(S.kids[i].name===n && S.kids[i].status==='Active') return S.kids[i]; return null; }
/* patches: {name: {Field:val}} — optimistic local update, then batched save */
function patchAtt(patches){
  var names=Object.keys(patches); if(!names.length) return;
  names.forEach(function(n){
    if(!S.attRows[n]) S.attRows[n]={id:null, created:'', f:{Child:n}};
    for(var k in patches[n]) S.attRows[n].f[k]=patches[n][k];
  });
  render();
  enqueue(function(){
    var creates=[], updates=[];
    names.forEach(function(n){
      var row=S.attRows[n];
      if(row.id){ updates.push({id:row.id, fields:patches[n]}); }
      else { var kid=kidByName(n); var f={Key:attKey(n), Date:S.date, Child:n, 'Home Room':kid?kid.room:''}; for(var k in row.f) if(k!=='Child') f[k]=row.f[k]; f.Child=n; creates.push({name:n, fields:f}); }
    });
    var p=Promise.resolve();
    for(var i=0;i<creates.length;i+=10){ (function(chunk){ p=p.then(function(){ return api('createMany','Room Attendance',{records:chunk.map(function(c){return c.fields;})}).then(function(res){ (res.records||[]).forEach(function(rec,j){ var nm=chunk[j].name; S.attRows[nm].id=rec.id; S.attRows[nm].created=rec.createdTime; }); }); }); })(creates.slice(i,i+10)); }
    for(var u=0;u<updates.length;u+=10){ (function(chunk){ p=p.then(function(){ return api('updateMany','Room Attendance',{records:chunk}); }); })(updates.slice(u,u+10)); }
    return p;
  });
}
function saveDay(roomName){
  var d=S.days[roomName]; if(!d) return;
  var fields={Staff:JSON.stringify(d.staff), Transitions:JSON.stringify(d.transitions), Counts:JSON.stringify(d.counts), Mgmt:JSON.stringify(d.mgmt), Notes:d.notes||''};
  render();
  enqueue(function(){
    if(d.id) return api('update','Room Day',{recordId:d.id, fields:fields});
    var f={Key:S.school+'|'+roomName+'|'+S.date, Room:roomName, Date:S.date}; for(var k in fields) f[k]=fields[k];
    return api('create','Room Day',{fields:f}).then(function(res){ var rec=(res.records||[])[0]; if(rec){ d.id=rec.id; d.created=rec.createdTime; } });
  });
}
function ensureDay(roomName){ if(!S.days[roomName]) S.days[roomName]={id:null, created:'', staff:{}, transitions:[], counts:[], mgmt:{}, notes:''}; return S.days[roomName]; }

/* ---------- UI helpers ---------- */
function toast(msg, bad){ TOAST.textContent=msg; TOAST.className='toast show'+(bad?' bad':''); clearTimeout(toast.t); toast.t=setTimeout(function(){ TOAST.className='toast'; }, bad?6000:2600); }
function openModal(html){ MODAL.innerHTML='<div class="mback" data-act="mclose"><div class="mbox">'+html+'</div></div>'; var f=MODAL.querySelector('[autofocus]'); if(f) setTimeout(function(){f.focus();},50); }
function closeModal(){ MODAL.innerHTML=''; }
function modalOpen(){ return !!MODAL.firstChild; }
function val(id){ var e=document.getElementById(id); return e?e.value:''; }
function chk(id){ var e=document.getElementById(id); return !!(e&&e.checked); }
function timeOrNow(id){ var v=val(id); return v||nowHM(); }
function timeInput(id, label){ return '<label class="lbl">'+esc(label||'Time')+'</label><div class="trow"><input class="inp" type="time" id="'+id+'" value="'+nowHM()+'"><button class="btn sec" type="button" data-act="timenow" data-id="'+id+'">Now</button></div>'; }
function fmt(hm){ return P.fmt12(hm); }

/* ---------- screens ---------- */
function loadNotes(){ S.notesAt=Date.now(); fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:S.pin,school:S.school,action:'rn_list'})}).then(function(r){return r.json()}).then(function(j){ if(j&&j.notes){ S.notes=j.notes; render(); } }).catch(function(){}); }
function isMgr(){ return S.role==='director'||S.role==='owner'; }
function noteHTML(room){
  var n=S.notes||{}, h='';
  function box(k,label){ var x=n[k]; if(!x&&!isMgr()) return ''; var t=x?esc(x.text):'<i>No note yet</i>'; return '<div class="card" style="border-left:6px solid #e91e63;background:#fff0f6;margin:8px 0;padding:10px 12px"><b>&#128221; '+label+'</b><div style="white-space:pre-wrap;margin-top:4px">'+t+'</div>'+(x&&x.by?'<small>from '+esc(x.by)+'</small>':'')+(isMgr()?' <button class="btn sec sm" data-act="notedit" data-r="'+encodeURIComponent(k)+'">'+(x?'Change':'Add a note')+'</button>':'')+'</div>'; }
  if(room) h+=box(room,'Note for this classroom');
  h+=box('ALL','Note for all staff');
  return h;
}
function render(){
  if(S.view==='login'){ APP.innerHTML=loginHTML(); return; }
  if(S.pin&&!S.notesAt) loadNotes();
  var y=window.scrollY;
  var h=headerHTML();
  if(S.view==='board') h+=boardHTML();
  else if(S.view==='room') h+=roomHTML();
  else if(S.view==='dcf') h+=dcfHTML();
  else if(S.view==='withdrawn') h+=withdrawnHTML();
  else if(S.view==='flags') h+=flagsHTML();
  APP.innerHTML=h;
  window.scrollTo(0,y);
  paintSaving();
}
function loginHTML(){
  var sch=ls('hiveRoomsSchool')||portalSchool(); /* 2026-11-18: no more DeLand 2 default */
  return '<div class="login"><div class="hex">&#11042;</div><h1>Hive Rooms</h1><p class="sub">Fast sign-in / sign-out for every classroom</p>'
   +'<label class="lbl">Your PIN</label><input class="inp" id="pin" type="password" autocomplete="off" autocapitalize="characters" placeholder="Staff or director PIN" value="'+esc(ls('hiveRoomsPin')||'')+'">'
   +'<label class="lbl">School (teachers pick; directors are set automatically)</label><select class="inp" id="sch"><option value=""'+(sch?'':' selected')+'>Pick your school…</option><option'+(sch==='DeLand 2'?' selected':'')+'>DeLand 2</option><option'+(sch==='Sanford'?' selected':'')+'>Sanford</option></select>'
   +'<button class="btn big" data-act="login">Open my rooms</button><div id="lerr" class="err"></div>'
   +'<button class="link" data-act="help">How do I put this on my phone like an app?</button></div>';
}
function headerHTML(){
  var h='<div class="hdr"><div class="hl"><b>'+esc(S.school)+'</b><span class="chip">'+(S.role==='director'?'Director':(S.asTeacher?'Teacher view':'Teacher'))+'</span></div>'
   +'<div class="hr"><span id="sv" class="sv ok">Saved</span><button class="ib" data-act="refresh" title="Refresh">&#8635;</button><button class="ib" data-act="help" title="Help">?</button><button class="ib" data-act="logout" title="Log out">&#9099;</button></div></div>'
   +'<div class="dnav"><button class="ib" data-act="dprev">&lsaquo;</button><div class="dt">'+esc(niceDate(S.date))+(isToday()?' <span class="chip g">Today</span>':' <span class="chip o">Back-fill (director)</span>')+'</div><button class="ib" data-act="dnext">&rsaquo;</button>'+(isToday()?'':'<button class="btn sec sm" data-act="dtoday">Today</button>')+'</div>';
  return h;
}
function boardHTML(){
  var h='<div class="pad">'+noteHTML('')+'<div class="act2"><button class="btn sec" data-act="gotodcf">&#128196; All rooms — paper form (DCF)</button>'
   +(S.role==='director'?'<button class="btn sec" data-act="gotoflags">&#10067; Questions to answer'+(S.flagN?' ('+S.flagN+')':'')+'</button><button class="btn sec" data-act="gotowd">Withdrawn children</button>':'<button class="btn sec" data-act="gotowd">Withdrawn (director)</button>')+'</div>';
  if(!S.rooms.length) h+='<div class="card">No rooms are set up for '+esc(S.school)+' yet.</div>';
  var totKids=0,totPres=0,totStaff=0;S.rooms.forEach(function(r){var l=roomKids(r.name);totKids+=l.length;totPres+=presentIn(r.name).length;totStaff+=staffNow(dayOf(r.name));});h+='<div class="card" style="display:flex;flex-wrap:wrap;gap:10px 28px;align-items:center;margin:10px 0;border:3px solid var(--y)"><b style="font-size:18px">Whole school right now</b><span><b style="font-size:26px">'+totPres+'</b> children in / '+totKids+' enrolled</span><span><b style="font-size:26px">'+totStaff+'</b> staff in rooms</span></div>';h+='<div class="tiles">';
  S.rooms.forEach(function(r){
    var list=roomKids(r.name), pres=presentIn(r.name).length, day=dayOf(r.name), rt=roomRatioNow(r.name), ot=openTrans(day);
    var ar=0, ir=0; list.forEach(function(c){ var a=attOf(c.name); if(a.AR) ar++; if(a.IR) ir++; });
    var due=headcountDue(r.name);
    h+='<button class="tile'+(rt.over?' warn':'')+'" data-act="openroom" data-r="'+encodeURIComponent(r.name)+'">'
     +'<div class="tn">'+esc(r.name)+'</div><div class="ts">'+esc(r.teachers.join(', '))+'</div>'
     +'<div class="tc"><span class="big">'+pres+'</span><span class="of"> in / '+list.length+' on roster</span></div>'
     +'<div class="tr">Ratio now <b class="'+(rt.over?'rd':'')+'">'+(rt.kids||rt.staff? rt.kids+':'+rt.staff : '—')+'</b>'+(rt.req&&rt.kids?' <small>(max '+rt.req+':1 for '+rt.grp+')</small>':'')+'</div>'
     +(ot?'<div class="tb o">With class: '+esc(ot.dest)+' since '+fmt(ot.out)+'</div>':'')
     +(due?'<div class="tb r">Headcount due</div>':'')
     +((ar||ir)?'<div class="tb r">'+(ar?ar+' accident ':'')+(ir?ir+' illness':'')+' report(s)</div>':'')
     +'</button>';
  });
  h+='</div></div>';
  return h;
}
function roomHTML(){
  var r=roomObj(S.room); if(!r){ S.view='board'; return boardHTML(); }
  var tabs=[['sheet','Sign In / Out'],['leave','Leave Room'],['staff','Staff & Ratio'],['paper','Paper Form']];
  var h='<div class="pad"><div class="rtop"><button class="btn sec sm" data-act="back">&lsaquo; Rooms</button><div class="rtt"><b>'+esc(r.name)+'</b><small>'+esc(r.teachers.join(', '))+'</small></div>'
   +(S.role==='director'?'<button class="btn sec sm" data-act="roster">Roster</button>':'<button class="btn sec sm" data-act="roster">Roster</button>')+'</div>';
  if(S.role!=='teacher' && S.rooms.length>1){
    h+='<div class="rswitch" style="display:flex;gap:8px;align-items:center;margin:8px 0"><button class="btn sm" data-act="prevroom">&lsaquo; Previous room</button>'
     +'<select class="inp" data-act="pickroom" style="flex:1;min-width:0">'+S.rooms.map(function(x){ return '<option value="'+encodeURIComponent(x.name)+'"'+(x.name===r.name?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+'</select>'
     +'<button class="btn sm" data-act="nextroom">Next room &rsaquo;</button></div>';
  }
  h+=noteHTML(r.name);
  h+='<div class="tabs">'+tabs.map(function(t){ return '<button class="tab'+(S.tab===t[0]?' on':'')+'" data-act="tab" data-t="'+t[0]+'">'+t[1]+'</button>'; }).join('')+'</div>';
  var day=dayOf(r.name), ot=openTrans(day);
  if(ot && S.tab!=='leave') h+='<div class="banner o">With class at <b>'+esc(ot.dest)+'</b> since '+fmt(ot.out)+' <button class="btn sm" data-act="return">Return to room</button></div>';
  if(headcountDue(r.name)) h+='<div class="banner r">Headcount due — last was '+fmt(lastCountMin(r.name))+' <button class="btn sm" data-act="count">Count now</button></div>';
  if(S.tab==='sheet') h+=sheetTab(r);
  else if(S.tab==='leave') h+=leaveTab(r);
  else if(S.tab==='staff') h+=staffTab(r);
  else h+=paperTab(r);
  h+='</div>';
  return h;
}
function sheetTab(r){
  var list=roomKids(r.name), h='';
  var nSel=Object.keys(S.sel).filter(function(k){return S.sel[k];}).length;
  var pres=presentIn(r.name).length;
  h+='<div class="meal"><span class="lbl2">Whole room:</span><button class="btn sm" data-act="allin">Check all IN</button><button class="btn sm" data-act="meal" data-m="B">B all</button><button class="btn sm" data-act="meal" data-m="L">Lunch all</button><button class="btn sm" data-act="meal" data-m="P">PM Snack all</button><button class="btn sm" data-act="wcall">Wellness all</button>'+(isSA(r.name)?'<button class="btn sm" data-act="soall">All to school</button><button class="btn sm" data-act="siall">All back from school</button><button class="btn sm" data-act="catchup">Catch up from transportation</button>':'')+'</div>';
  h+='<div class="cnt">'+pres+' in room now &middot; '+list.length+' on this sheet</div>';
  h+='<div class="klist">';
  list.forEach(function(c){
    var a=attOf(c.name), st=a.Arrival?(a.Departure?'out':'in'):'none', k=encodeURIComponent(c.name);
    var age=P.ageStr(c.dob,S.date);
    h+='<div class="kr '+st+'"><label class="ck"><input type="checkbox" data-act="sel" data-k="'+k+'"'+(S.sel[c.name]?' checked':'')+'></label>'
     +'<div class="kn"><b>'+esc(c.name)+'</b> <small>'+esc(age?age+' yr':'')+(c.visiting?' &middot; '+esc(c.visiting):'')+'</small><div class="kt">'
     +(a.Arrival?'In '+fmt(a.Arrival):'Not in')+(a['School Out']?' &middot; To school '+fmt(a['School Out']):'')+(a['School In']?' &middot; Back '+fmt(a['School In']):'')+(a.Departure?' &middot; Out '+fmt(a.Departure):'')+'</div></div>'
     +'<button class="qb '+(st==='none'?'in':(st==='in'?'out':'back'))+'" data-act="quick" data-k="'+k+'">'+(st==='none'?'IN':(st==='in'?'OUT':'Back IN'))+'</button>'
     +'<div class="chips">'
     +chip('B',a.B,c.name,'B')+chip('L',a.L,c.name,'L')+chip('P',a.P,c.name,'P')
     +(isSA(r.name)?'<button class="chip2'+(a['School Out']?' on':'')+'" data-act="so" data-k="'+k+'">To school</button><button class="chip2'+(a['School In']?' on':'')+'" data-act="si" data-k="'+k+'">Back</button>':'')
     +'<button class="chip2" data-act="times" data-k="'+k+'">Times</button>'
     +'<button class="chip2'+(a.WC?' on':'')+'" data-act="wc" data-k="'+k+'">WC</button>'
     +'<button class="chip2 flag'+(a.IR?' on':'')+'" data-act="note" data-t="IR" data-k="'+k+'">IR</button>'
     +'<button class="chip2 flag'+(a.AR?' on':'')+'" data-act="note" data-t="AR" data-k="'+k+'">AR</button></div></div>';
  });
  h+='</div>';
  var mo=movedOut(r.name);
  if(mo.length) h+='<div class="sub2">Moved to another room today: '+mo.map(function(k){return esc(k.name)+' &rarr; '+esc(effRoom(k));}).join(', ')+'</div>';
  if(nSel){
    h+='<div class="bulk"><div class="bt"><b>'+nSel+' selected</b> <button class="link" data-act="selall">All</button> <button class="link" data-act="selpres">Present</button> <button class="link" data-act="selnone">Clear</button></div>'
     +'<div class="brow"><input class="inp" type="time" id="bt" value="'+esc(S.bulkTime||nowHM())+'"><button class="btn sec sm" data-act="timenow" data-id="bt">Now</button>'
     +'<button class="btn grn" data-act="bin">Sign IN</button><button class="btn org" data-act="bout">Sign OUT</button><button class="btn sec" data-act="bmove">Move…</button></div></div>';
  } else {
    h+='<div class="hint">Tip: tap the big IN / OUT button for one child, or tick several names and sign them in together at one time.</div><div class="row2"><button class="link" data-act="selall">Select everyone</button></div>';
  }
  return h;
}
function chip(label, on, name, m){ return '<button class="chip2'+(on?' on':'')+'" data-act="mealone" data-m="'+m+'" data-k="'+encodeURIComponent(name)+'">'+label+'</button>'; }
function leaveTab(r){
  var day=dayOf(r.name), ot=openTrans(day), pres=presentIn(r.name).length, h='';
  h+='<div class="card">';
  if(ot){ h+='<div class="bigmsg">With class at <b>'+esc(ot.dest)+'</b><br><small>left '+fmt(ot.out)+' &middot; counted '+esc(ot.outCount)+'</small></div><button class="btn big grn" data-act="return">Return to room &mdash; sweep &amp; count</button>'; }
  else { h+='<div class="bigmsg">In the classroom<br><small>'+pres+' children in the room</small></div><button class="btn big" data-act="leave"'+(pres?'':' disabled')+'>Leave the room &mdash; sweep &amp; count first</button>'; }
  h+='</div>';
  h+='<div class="card"><b>Headcount</b><div class="sub2">Count every 10 minutes. Last: '+(lastCountMin(r.name)?fmt(lastCountMin(r.name)):'none yet')+'</div><button class="btn" data-act="count">Record a headcount</button></div>';
  var t=day.transitions;
  h+='<div class="card"><b>'+(isToday()?'Today\'s':'This day\'s')+' transitions</b>'+(t.length?'':'<div class="sub2">None yet.</div>')+t.map(function(x,i){ return '<div class="tli">#'+(i+1)+' <b>'+esc(x.dest)+'</b> &middot; out '+fmt(x.out)+(x.in?' &middot; in '+fmt(x.in):' &middot; <span class="rd">still out</span>')+' &middot; counts '+esc(x.outCount)+(x.in?' / '+esc(x.inCount):'')+' <button class="btn sec sm" data-act="tredit" data-i="'+i+'">Edit</button> <button class="btn sec sm" data-act="trdel" data-i="'+i+'">Delete</button></div>'; }).join('')+'<div class="row2" style="margin-top:8px"><button class="btn sec" data-act="tradd">Add one from my paper form</button></div><div class="sub2">Use this to enter a transition that is on your paper form for today or an earlier day (use the date arrows at the top).</div></div>';
  return h;
}
function staffTab(r){
  var day=dayOf(r.name), teachers=teachersFor(r.name), h='';
  h+='<div class="card"><b>Teachers in this room</b>'+timeInput('stT','Time to stamp')+'<div class="sub2">Leave as is to stamp right now.</div>';
  teachers.forEach(function(t){
    var s=day.staff[t]||[], last=s[s.length-1], k=encodeURIComponent(t);
    var btn = (last && last.in && !last.out) ? '<button class="btn org sm" data-act="stout" data-k="'+k+'">Time OUT</button>' : (s.length<3 ? '<button class="btn grn sm" data-act="stin" data-k="'+k+'">Time IN</button>' : '<small>3 of 3 used</small>');
    var ed = s.length ? ' <button class="btn sec sm" data-act="stedit" data-k="'+k+'">Edit times</button>' : '';
    h+='<div class="stl"><b>'+esc(t)+'</b><span>'+(s.map(function(x){ return fmt(x.in)+'–'+(x.out?fmt(x.out):'…'); }).join(' &nbsp; ')||'not in yet')+'</span>'+btn+ed+'</div>';
  });
  var have=teachers, opts=schoolTeachers().filter(function(t){return have.indexOf(t)<0;});
  h+='<label class="lbl">Teacher coming in? Pick their name (they are stamped IN at the time above)</label><select class="inp" id="tpick" data-act="pick"><option value="">Choose a teacher…</option>'+opts.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'<option value="__other">Someone else (type a name)…</option></select></div>';
  // ratio grid
  var list=roomKids(r.name), am=attMapFor(list), kl=list.map(function(c){return {name:c.name,dob:c.dob};}), nowS=nowHM();
  h+='<div class="card"><b>Children : Staff by hour</b><div class="sub2">Fills in automatically from sign-ins and staff times. Red = over the limit for the majority age group in the room (3s = 15:1, 2s = 11:1, 4s = 20:1; a tie uses the younger group).</div><div class="rgrid">';
  P.SLOTS.forEach(function(s,i){
    var show = !isToday() || s<=nowS; var q=P.ratioAt(kl,am,day.staff,s,S.date); var txt=(show&&(q.kids||q.staff))? q.kids+':'+q.staff : '—';
    h+='<div class="rc'+(show&&q.over?' over':'')+'"><div class="rt">'+P.SLOT_LABELS[i]+'</div><div class="rv">'+txt+'</div><button class="mi" data-act="mgmt" data-s="'+s+'">'+esc(day.mgmt[s]||'initial')+'</button></div>';
  });
  h+='</div><div class="sub2">Management initials: director taps a slot and enters the director PIN.</div></div>';
  return h;
}
function paperTab(r){
  var list=roomKids(r.name), day=dayOf(r.name);
  var html=P.render({schoolAge:isSA(r.name), school:S.school, room:r.name, date:S.date, teachers:teachersFor(r.name), children:list, att:saFix(attMapFor(list),isSA(r.name)), day:day, asOf: isToday()? nowHM(): null});
  var food=weekReady()? foodPages(r) : '<div class="card noprint">Loading the food count form&hellip;</div>';
  return '<div class="noprint"><button class="btn" data-act="print">Print both forms</button> <button class="btn sec" data-act="printfood">Print food form only</button> <span class="sub2">Attendance roster first, then the Weekly Attendance &amp; Meal Count (food) form just below it. Same layouts as the DCF binder.</span></div><div class="pfwrap">'+html+'</div><div class="noprint" style="margin:14px 0 4px;font-weight:700">Food count form (this week)</div>'+food;
}
/* ---------- Food Count tab: the same Weekly Attendance & Meal Count form as the DCF Binder, built from this board's own sign-in and meal data ---------- */
var FC_REPH={'DeLand 2':{name:'Kid City USA Deland 2 Inc (573)',phone:'(386) 279-7553',sponsor:'Child Care of Southwest Florida (U-2677)',sphone:'(239) 936-0899'},
 'Sanford':{name:'Kid City USA Sanford',phone:'(407) 942-3242',sponsor:'Community Coordinated Child Care (4C)',sphone:'(407) 522-2252'}};
var FC_ROWS=22, FC_DN=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
(function(){ var st=document.createElement('style'); st.textContent='.fcw{overflow-x:auto;background:#fff;border:1px solid #ccc;border-radius:10px;padding:8px;margin-top:8px}'
 +'.fcp{position:relative;width:1060px;margin:0 auto 14px;font:11px Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:6px 10px 4px 30px}'
 +'.fcp .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;min-height:50px}.fcp .hl{width:32%;font-size:10px}.fcp .hl b{font:700 17px Georgia,serif;display:block;margin-top:6px}.fcp .hl i{font:12px Georgia,serif;font-style:normal;display:block}'
 +'.fcp .hc{width:36%;text-align:center}.fcp .hc b{font:700 19px Georgia,serif;text-decoration:underline}.fcp .hc div{font-size:14px;margin-top:2px}.fcp .hr{width:32%;text-align:right}.fcp .hr b{font:700 14px Georgia,serif}.fcp .hr i{font:12px Georgia,serif;font-style:normal;display:block}'
 +'.fcp table{border-collapse:collapse;width:100%;table-layout:fixed;border:2px solid #000}.fcp td,.fcp th{border:1px solid #000;padding:0;text-align:center;font-weight:400;overflow:hidden;white-space:nowrap}.fcp .dg{border-left:2px solid #000}'
 +'.fcp th.dayh{font:13px Georgia,serif;line-height:1.25;height:38px}.fcp th.dayh small{display:block;font-size:12px}.fcp .cl{text-align:left;font:13px Georgia,serif;padding:0 4px;height:38px;vertical-align:bottom}.fcp .sh th{font:11px Georgia,serif;height:19px}'
 +'.fcp tr.kid td{height:19px;font-size:11px}.fcp td.nm{text-align:left;padding-left:3px;font:12px Georgia,serif}.fcp td.age{font-size:10px;text-align:left;padding-left:2px}.fcp td.x{font-weight:700;font-size:12px}.fcp td.dsh{font-size:10px}'
 +'.fcp .lab{text-align:left;font:12px Georgia,serif;padding:0 4px}.fcp .labr{text-align:right;font:13px Georgia,serif;padding-right:8px}.fcp tr.tot td{height:24px;font-weight:700;font-size:11px}'
 +'.fcp .ft{margin-top:6px;font:10.5px Georgia,serif;line-height:1.3}.fcp .pg{text-align:right;font:11px Arial}'
 +'.fcm{background:#fff8e1;border:1px solid #ffd54f;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:14px}.fcm.ok{background:#e8f5e9;border-color:#a5d6a7}.fcm b{font-weight:700}'
 +'@media print{.fcw{border:0;padding:0;overflow:visible}.fcp{width:100%;page-break-after:always;break-after:page}.fcp:last-child{page-break-after:auto;break-after:auto}}';
 document.head.appendChild(st); })();
function fcMonday(ds){ var d=new Date(ds+'T12:00:00'), w=d.getDay(); d.setDate(d.getDate()-(w===0?6:w-1)); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function fcAdd(ds,n){ var d=new Date(ds+'T12:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function fcMD(ds,yy){ var p=ds.split('-'); return (+p[1])+'/'+(+p[2])+(yy?'/'+p[0].slice(2):''); }
function fcFull(ds){ var p=ds.split('-'); return p[1]+'/'+p[2]+'/'+p[0]; }
function fcAge(dob,asOf){ if(!dob) return ''; var a=dob.split('-'), b=asOf.split('-'); var m=(+b[0]-+a[0])*12+(+b[1]-+a[1]); if(+b[2]<+a[2]) m--; if(m<0) return ''; return Math.floor(m/12)+'y '+(m%12)+'m'; }
function fcLoad(mon){
  S.wk={mon:mon, rows:{}, loading:true, school:S.school};
  var days=[0,1,2,3,4].map(function(i){ return fcAdd(mon,i); });
  Promise.all(days.map(function(d){ return api('list','Room Attendance',{date:d}).then(function(r){ var m={}; (r.records||[]).forEach(function(x){ var n=x.fields.Child; if(!n) return; var k=n.trim().toLowerCase(); if(!m[k] || x.createdTime<m[k].created) m[k]={created:x.createdTime, f:x.fields}; }); S.wk.rows[d]=m; }); }))
  .catch(function(e){ toast('Could not load the week: '+e.message, true); })
  .then(function(){ if(S.wk) S.wk.loading=false; if((S.view==='room' && S.tab==='paper') || S.view==='dcf') render(); });
}
function fcMark(d,name){
  var k=name.trim().toLowerCase(), f=null;
  if(d===S.date){ var a=S.attRows[name]; if(a) f=a.f; else { for(var n in S.attRows) if(n.trim().toLowerCase()===k){ f=S.attRows[n].f; break; } } }
  else { var m=(S.wk&&S.wk.rows[d])||{}; if(m[k]) f=m[k].f; }
  return f ? {att:!!f.Arrival, b:!!f.B, l:!!f.L, p:!!f.P} : null;
}
function printOnly(cls){ document.body.classList.add(cls); var done=function(){ document.body.classList.remove(cls); window.removeEventListener('afterprint',done); }; window.addEventListener('afterprint',done); setTimeout(function(){ window.print(); },50); }
function weekReady(){
  var mon=fcMonday(S.date);
  if(!S.wk || S.wk.mon!==mon || S.wk.school!==S.school){ fcLoad(mon); return false; }
  return !S.wk.loading;
}
function foodPages(r,opt){
  var mon=fcMonday(S.date);
  var days=[0,1,2,3,4].map(function(i){ return fcAdd(mon,i); });
  var kids=roomKids(r.name).map(function(c){ return {n:c.name, dob:c.dob}; }), seen={};
  kids.forEach(function(k){ seen[k.n.trim().toLowerCase()]=1; });
  days.forEach(function(d){ var m=(d===S.date)?null:((S.wk.rows[d])||{}); var add=function(n,f){ var key=n.trim().toLowerCase(); if(seen[key]) return; if((f['Home Room']||f['Current Room'])!==r.name) return; seen[key]=1; kids.push({n:n,dob:''}); };
    if(m) for(var k in m) add(m[k].f.Child, m[k].f); else for(var n in S.attRows) add(n, S.attRows[n].f); });
  kids.sort(function(a,b){ return a.n.toLowerCase()<b.n.toLowerCase()?-1:1; });
  /* does today's board match the food count? */
  var today=S.date, noMeal=[], mealNoIn=[];
  kids.forEach(function(k){ var m=fcMark(today,k.n); if(!m) return; if(m.att && !m.b && !m.l && !m.p) noMeal.push(k.n); if(!m.att && (m.b||m.l||m.p)) mealNoIn.push(k.n); });
  var h='';
  var chk='<div class="fcm noprint'+((noMeal.length||mealNoIn.length)?'':' ok')+'">'+((noMeal.length||mealNoIn.length)?'<b>Check '+esc(niceDate(today))+':</b>'+(noMeal.length?' signed in but no meals marked yet &mdash; '+esc(noMeal.join(', '))+'.':'')+(mealNoIn.length?' meals marked but not signed in &mdash; '+esc(mealNoIn.join(', '))+'.':'')+' Fix them on the Sign In / Out tab and this form updates.':'<b>'+esc(niceDate(today))+':</b> everyone signed in has their meals marked, and the food count matches the room.')+'</div>';
  var n=Math.max(1,Math.ceil(kids.length/FC_ROWS)), H=FC_REPH[S.school]||FC_REPH['Sanford'], sat=fcAdd(mon,5), sun=fcAdd(mon,6);
  h+='<div class="fcw">';
  for(var p=0;p<n;p++){
    var pk=kids.slice(p*FC_ROWS,(p+1)*FC_ROWS);
    h+='<div class="fcp"><div class="hd"><div class="hl"><b>'+esc(H.name)+'</b><i>'+esc(H.phone)+'</i></div><div class="hc"><b>Weekly Attendance &amp; Meal Count Report</b><div>Week Of: '+fcMD(mon,1)+'-'+fcMD(sat,1)+' (Mon '+fcMD(mon)+'-Sun '+fcMD(sun)+')</div></div><div class="hr"><b>Sponsor: '+esc(H.sponsor)+'</b><i>'+esc(H.sphone)+'</i></div></div>';
    h+='<table><colgroup><col style="width:5%"><col style="width:4%"><col style="width:20%">'; for(var c=0;c<35;c++) h+='<col>'; h+='</colgroup>';
    h+='<tr><th colspan="3" class="cl">CLASSROOM #: &nbsp; <span style="font:14px Georgia">'+esc(r.name)+'</span></th>'; days.forEach(function(d,i){ h+='<th colspan="7" class="dayh dg">'+fcFull(d)+'<small>'+FC_DN[i]+'</small></th>'; }); h+='</tr>';
    h+='<tr class="sh"><th>AGE</th><th>NBR</th><th>CHILD NAME</th>'; days.forEach(function(){ ['Att','B','','L','P','',''].forEach(function(t,j){ h+='<th'+(j===0?' class="dg"':'')+'>'+t+'</th>'; }); }); h+='</tr>';
    var tot=days.map(function(){ return {a:0,b:0,l:0,p:0}; });
    for(var q=0;q<FC_ROWS;q++){
      var k=pk[q]; h+='<tr class="kid"><td class="age">'+(k?esc(fcAge(k.dob,mon)):'')+'</td><td></td><td class="nm">'+(k?esc(String(k.n).toUpperCase()):'')+'</td>';
      days.forEach(function(d,i){ var m=k?fcMark(d,k.n):null; if(m&&m.att) tot[i].a++; if(m&&m.b) tot[i].b++; if(m&&m.l) tot[i].l++; if(m&&m.p) tot[i].p++;
        h+='<td class="x dg">'+(m&&m.att?'X':'')+'</td><td class="x">'+(m&&m.b?'X':'')+'</td><td class="dsh">-</td><td class="x">'+(m&&m.l?'X':'')+'</td><td class="x">'+(m&&m.p?'X':'')+'</td><td class="dsh">-</td><td class="dsh">-</td>'; });
      h+='</tr>';
    }
    h+='<tr><td colspan="3" class="lab" style="height:24px;border-top:2px solid #000">* Special Diet</td>'; days.forEach(function(){ h+='<td colspan="7" class="dg" style="border-top:2px solid #000"></td>'; }); h+='</tr>';
    h+='<tr class="tot"><td colspan="3" class="labr">Daily Totals:</td>'; days.forEach(function(d,i){ var t=tot[i], has=pk.length&&(t.a||t.b||t.l||t.p); [t.a,t.b,'',t.l,t.p,'',''].forEach(function(v,j){ h+='<td'+(j===0?' class="dg"':'')+'>'+(v===''?'':(has?v:''))+'</td>'; }); }); h+='</tr></table>';
    h+='<div class="ft">I certify that the information on this form is true and correct to the best of my knowledge and that I will claim reimbursement only for eligible meals served to eligible participants. The director signs and dates the official weekly copy in the DCF Binder.</div><div class="pg">Page '+(p+1)+' of '+n+'</div></div>';
  }
  return (opt&&opt.nocheck?'':chk)+h+'</div>';
}
function dcfHTML(){
  var h='<div class="pad noprint"><button class="btn sec sm" data-act="back">&lsaquo; Rooms</button> <b>All rooms — '+esc(S.school)+' — '+esc(niceDate(S.date))+'</b> <button class="btn" data-act="printrosters">Print all rosters</button> <button class="btn" data-act="printallfood">Print all food forms</button></div>';
  h+='<div class="pfwrap">';
  S.rooms.forEach(function(r){
    var list=roomKids(r.name);
    h+=P.render({schoolAge:isSA(r.name), school:S.school, room:r.name, date:S.date, teachers:teachersFor(r.name), children:list, att:saFix(attMapFor(list),isSA(r.name)), day:dayOf(r.name), asOf: isToday()? nowHM(): null});
  });
  h+='</div>';
  h+='<div class="noprint" style="margin:14px 0 4px;font-weight:700">Food count forms (this week)</div>';
  h+= weekReady()? S.rooms.map(function(r){ return foodPages(r,{nocheck:true}); }).join('') : '<div class="card noprint">Loading the food count forms&hellip;</div>';
  return h;
}
function withdrawnHTML(){
  var wd=S.kids.filter(function(k){ return k.status==='Withdrawn'; }).sort(function(a,b){ return (b.wdDate||'').localeCompare(a.wdDate||''); });
  var h='<div class="pad"><button class="btn sec sm" data-act="back">&lsaquo; Rooms</button> <b>Withdrawn children</b>';
  h+='<div class="sub2">Kept for records. Charles removes each child from the food program (KidKare) and reminds the director to remove them from ProCare.</div>';
  if(!wd.length) h+='<div class="card">No withdrawn children.</div>';
  wd.forEach(function(k){
    h+='<div class="card wd"><b>'+esc(k.name)+'</b> <small>from '+esc(k.wdFrom||k.room)+' &middot; '+esc(k.wdDate)+(k.wdReason?' &middot; '+esc(k.wdReason):'')+'</small>'
     +'<div class="stl"><span>Food program (KidKare): '+(k.kk?'<b class="gr">removed</b>':'<b class="rd">waiting</b>')+'</span><span>ProCare: '+(k.pc?'<b class="gr">removed</b>':'<b class="rd">director to remove</b>')+'</span></div>'
     +'<div class="row2">'+(k.pc?'':'<button class="btn sm" data-act="pcdone" data-id="'+k.id+'">I removed them from ProCare</button> ')+'<button class="btn sec sm" data-act="reinstate" data-id="'+k.id+'">Undo (put back)</button></div></div>';
  });
  return h+'</div>';
}

/* ---------- director gate ---------- */
function needDirector(cb){
  if(S.role==='director'||S.role==='owner'){ cb(S.pin); return; }
  if(S.dirPin && Date.now()-S.dirAt<10*60*1000){ cb(S.dirPin); return; }
  openModal('<h3>Director PIN needed</h3><p class="sub2">Only a director can do this. Enter the director PIN for '+esc(S.school)+'.</p><input class="inp" id="dpin" type="password" autocomplete="off" autocapitalize="characters" autofocus><div id="derr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn" data-act="dpinok">Continue</button></div>');
  needDirector.cb=cb;
}

/* ---------- actions ---------- */
function keyOf(el){ return decodeURIComponent(el.getAttribute('data-k')||''); }
/* school-age lunch confirmation (Mrs. Bear 11/4/26): Worker Bees never get lunch unless a director/teacher confirms they were here and whether it was a holiday */
function isSchoolager(n){ var k=kidByName(n); var r=(k&&k.room)||''; return /^Schoolagers/i.test(r) || /^Schoolagers/i.test(effRoom(k||{name:n,room:''})||''); }
function askLunch(names, then){
  S.lunchAsk=names;
  openModal('<h3>Lunch for school-age children</h3><p>School-agers do not normally get lunch. Please confirm for <b>'+esc(names.join(', '))+'</b>:</p><p><b>Were they here for lunch?</b> And <b>was today a school holiday</b> (no school)?</p><div class="mrow" style="flex-direction:column;gap:8px"><button class="btn grn" data-act="lunchyes" data-h="1">Yes, here for lunch &mdash; school holiday / no school</button><button class="btn" data-act="lunchyes" data-h="0">Yes, here for lunch &mdash; NOT a holiday</button><button class="btn sec" data-act="mclose2">No / Cancel</button></div>');
}
function flagsHTML(){
  var L=S.flags||[], h='<div class="pad"><button class="btn sec sm" data-act="back">&lsaquo; Rooms</button> <b>Questions to answer &mdash; '+esc(S.school)+'</b> <button class="btn sec sm" data-act="roster">Add / remove children (Roster)</button>';
  if(!L.length) return h+'<div class="card">Nothing waiting. All flagged questions are answered.</div></div>';
  h+='<p class="sub2">Answer each one, or fix it: add lunch if the school-ager was here and it was a holiday, or remove the child from that day. Your answer clears the flag.</p>';
  L.forEach(function(x){ var f=x.fields, isHol=/school holiday/i.test(f['Director Flag']||'');
    h+='<div class="card"><div><b>'+esc(f.Child||'')+'</b> &middot; '+esc(f.Date||'')+' &middot; <small>'+esc(f['Current Room']||'')+(f.Arrival?' &middot; in '+esc(f.Arrival):'')+(f.Departure?' out '+esc(f.Departure):'')+'</small></div>'
     +'<div class="sub2">'+esc(f['Director Flag']||'')+'</div>'
     +'<input class="inp" id="fa'+x.id+'" placeholder="Your answer / note">'
     +'<div class="mrow" style="flex-wrap:wrap;gap:6px"><button class="btn sm" data-act="flagsubmit" data-id="'+x.id+'">Submit answer</button>'
     +(isHol?'<button class="btn grn sm" data-act="flaglunch" data-id="'+x.id+'">Holiday &mdash; add lunch</button>':'')
     +'<button class="btn org sm" data-act="flagremove" data-id="'+x.id+'">Remove child from this day</button></div></div>';
  });
  return h+'</div>';
}
function flagRec(id){ for(var i=0;i<(S.flags||[]).length;i++) if(S.flags[i].id===id) return S.flags[i]; return null; }
function flagSave(id, fields, msg){
  api('update','Room Attendance',{recordId:id, fields:fields}).then(function(){ S.flags=(S.flags||[]).filter(function(x){return x.id!==id;}); toast(msg); render(); }).catch(function(e){ toast('Could not save: '+e.message, true); });
}
function selNames(){ return Object.keys(S.sel).filter(function(k){ return S.sel[k]; }); }

function signIn(names, time){
  var p={}, redo=[], chg=[];
  names.forEach(function(n){ var a=attOf(n);
    if(a.Arrival && a.Departure){
      if(time<a.Departure){ p[n]={Arrival:time}; }            // fixing the arrival time: keep the sign-out as it is
      else { redo.push(n); p[n]={Departure:''}; }               // came back later: keep the FIRST arrival, just reopen the day
    } else if(a.Arrival && a.Arrival!==time){ chg.push(n+' ('+fmt(a.Arrival)+')'); p[n]={Arrival:time}; }
    else p[n]={Arrival:time, Departure:''};
  });
  if(redo.length && !confirm(redo.join(', ')+' already signed out. Sign back in now? Their first arrival time stays the same.')) return;
  if(chg.length && !confirm(chg.join(', ')+' already signed in. Change the arrival time to '+fmt(time)+'?')) return;
  patchAtt(p);
}
function signOut(names, time){
  var p={}, bad=[];
  names.forEach(function(n){ var a=attOf(n); if(!a.Arrival){ bad.push(n); return; } if(time<a.Arrival){ bad.push(n+' (out before in)'); return; } p[n]={Departure:time}; });
  if(bad.length) toast('Skipped: '+bad.join(', ')+' — sign them in first / check the time.', true);
  patchAtt(p);
}
function toggleMeal(names, m, mode){
  var p={}; names.forEach(function(n){ var a=attOf(n); p[n]={}; p[n][m]= mode==='set'? true : (mode==='clear'? false : !a[m]); }); patchAtt(p);
}

/* ---------- school-age helpers: day gate, transition form, transportation catch-up ---------- */
function gateDay(cb){ if(S.role==='teacher' && !isToday()) needDirector(function(){ cb(); }); else cb(); }
function trPresentAt(n,t){ var a=attOf(n); if(!a.Arrival) return false; if(!t) return !a.Departure && !(a['School Out'] && !a['School In']); if(a.Arrival>t) return false; var so=a['School Out']||'', si=a['School In']||''; if(so && so<=t && (!si || si>t)) return false; if(a.Departure && a.Departure<t) return false; return true; }
function trKidsHtml(x,i){ var have=(i>=0 && x.kids && x.kids.length)?x.kids:null, t=x.out||(i<0&&isToday()?nowHM():'');
  var kids=roomKids(S.room); if(have) have.forEach(function(n){ if(!kids.some(function(c){return c.name===n;})) kids.push({name:n}); });
  if(!kids.length) return '<div class="sub2">No children on this room\'s list.</div>';
  return kids.map(function(c){ var on=have? have.indexOf(c.name)>=0 : trPresentAt(c.name,t);
    return '<label class="ck2" style="display:block;padding:3px 0"><input type="checkbox" class="tkid" value="'+esc(c.name)+'"'+(on?' checked':'')+' onchange="trKidCount()"> '+esc(c.name)+'</label>'; }).join(''); }
function trKidCount(){
  var outs=[].map.call(document.querySelectorAll('.tkid:checked'),function(b){return b.value}), e=document.getElementById('tkn');
  if(e) e.textContent=outs.length+' child'+(outs.length===1?'':'ren')+' checked.';
  var c=document.getElementById('tocnt'); if(c) c.value=outs.length;
  var box=document.getElementById('tkin'); if(!box) return;
  var prev=window.__trPrev||{}; box.querySelectorAll('.tkin').forEach(function(b){ prev[b.value]=b.checked; }); window.__trPrev=prev;
  box.innerHTML=outs.length? outs.map(function(n){ var on=(n in prev)?prev[n]:true; return '<label class="ck2" style="display:block;padding:3px 0"><input type="checkbox" class="tkin" value="'+esc(n)+'"'+(on?' checked':'')+' onchange="trInCount()"> '+esc(n)+'</label>'; }).join('') : '<div class="sub2">Check who went first.</div>';
  trInCount();
}
function trInCount(){
  var n=document.querySelectorAll('.tkin:checked').length, e=document.getElementById('tkin2'); if(e) e.textContent=n+' came back in'+(document.querySelectorAll('.tkin').length-n>0?' ('+(document.querySelectorAll('.tkin').length-n)+' went home)':'')+'.';
  var ic=document.getElementById('ticnt'), ti=document.getElementById('tin'); if(ic) ic.value=(ti&&ti.value)? n : '';
}
function trKidsRefresh(){ var t=(document.getElementById('tout')||{}).value||''; document.querySelectorAll('.tkid').forEach(function(b){ b.checked=trPresentAt(b.value,t); }); trKidCount(); }
window.trKidCount=trKidCount; window.trInCount=trInCount; window.trKidsRefresh=trKidsRefresh;
function trForm(i){
  var r=roomObj(S.room), day=ensureDay(S.room), x=(i>=0&&day.transitions[i])||{}, pres=presentIn(S.room).length;
  var dests=['Outside','Playroom'].concat(S.rooms.filter(function(z){return z.name!==S.room;}).map(function(z){return z.name;})).concat(['Office','Other (type it in)']);
  var known=dests.indexOf(x.dest)>=0;
  openModal('<h3>'+(i>=0?'Edit transition':'Add a transition from the paper form')+'</h3><p class="sub2">'+esc(niceDate(S.date))+'. Copy what is on the paper form.</p>'
   +'<label class="lbl">Where did they go?</label><select class="inp" id="tdest" onchange="document.getElementById(\'tdestO\').style.display=this.value===\'Other (type it in)\'?\'block\':\'none\'">'+dests.map(function(d){ return '<option'+((known?d===x.dest:(x.dest&&d==='Other (type it in)'))?' selected':'')+'>'+esc(d)+'</option>'; }).join('')+'</select>'
   +'<input class="inp" id="tdestO" placeholder="Type where they went" value="'+esc(!known&&x.dest?x.dest:'')+'" style="margin-top:6px;display:'+(!known&&x.dest?'block':'none')+'">'
   +'<div class="trow"><label class="lbl" style="min-width:120px">Time out</label><input class="inp" type="time" id="tout" value="'+esc(x.out||(i<0&&isToday()?nowHM():''))+'" '+(i<0?'onchange="trKidsRefresh()"':'')+'></div>'
   +'<label class="lbl">Who went (check each child)</label><div id="tkids" style="max-height:200px;overflow:auto;border:1px solid #ddd;border-radius:10px;padding:6px 10px">'+trKidsHtml(x,i)+'</div><div class="sub2" id="tkn"></div>'
   +'<div class="trow"><label class="lbl" style="min-width:120px">Count going out</label><input class="inp" type="number" inputmode="numeric" id="tocnt" value="'+esc(x.outCount!==undefined&&x.outCount!==''?x.outCount:(i<0?pres:''))+'"></div>'
   +'<label class="lbl">Counted by (out)</label>'+whoSelect(S.room,'toby')
   +'<div class="trow"><label class="lbl" style="min-width:120px">Time back in</label><input class="inp" type="time" id="tin" value="'+esc(x['in']||'')+'" onchange="trInCount()"></div>'
   +'<label class="lbl">Who came back in (uncheck children who went home)</label><div id="tkin" style="max-height:200px;overflow:auto;border:1px solid #ddd;border-radius:10px;padding:6px 10px"></div><div class="sub2" id="tkin2"></div>'
   +'<div class="trow"><label class="lbl" style="min-width:120px">Count coming back</label><input class="inp" type="number" inputmode="numeric" id="ticnt" value="'+esc(x.inCount!==undefined?x.inCount:'')+'"></div>'
   +'<label class="lbl">Counted by (back)</label>'+whoSelect(S.room,'tiby')
   +'<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn grn" data-act="trsave" data-i="'+i+'">Save</button></div>');
  window.__trPrev={}; if(i>=0 && (x.kidsIn||(x['in']&&x.kids))){ var ki=x.kidsIn||x.kids; (x.kids||[]).forEach(function(n){ window.__trPrev[n]=ki.indexOf(n)>=0; }); }
  trKidCount();
  if(x.outBy){ var e=document.getElementById('toby'); if(e){ if(![].some.call(e.options,function(o){return o.value===x.outBy||o.text===x.outBy;})) e.insertAdjacentHTML('afterbegin','<option>'+esc(x.outBy)+'</option>'); e.value=x.outBy; } }
  if(x.inBy){ var e2=document.getElementById('tiby'); if(e2){ if(![].some.call(e2.options,function(o){return o.value===x.inBy||o.text===x.inBy;})) e2.insertAdjacentHTML('afterbegin','<option>'+esc(x.inBy)+'</option>'); e2.value=x.inBy; } }
}
function nameKey(n){ var p=String(n||'').replace(/[^A-Za-z'’\s.-]/g,'').trim().split(/\s+/); if(p.length<2) return (p[0]||'').toLowerCase(); return (p[0]+' '+p[p.length-1].charAt(0)).toLowerCase(); }
function t24(s){ var m=/^\s*(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(s||''); if(!m) return ''; var h=+m[1]; if(m[3]){ var pm=/p/i.test(m[3]); if(pm&&h<12) h+=12; if(!pm&&h===12) h=0; } return pad(h)+':'+m[2]; }
function transCatch(useFallback){
  return api('trips','',{date:S.date}).then(function(res){
    var trips=(res.trips||[]).filter(function(t){ return /complete|arrived|awaiting|started/i.test(t.status||'') || t.depart || t.arrive; });
    var am={}, pm={}, amDest={};
    trips.forEach(function(t){ (String(t.kids||'').split(/\n+/)).forEach(function(nm){ var k=nameKey(nm); if(!k) return;
      if(t.ampm==='AM'){ if(t24(t.depart)) am[k]=t24(t.depart); amDest[k]=t.dest; } else if(t.ampm==='PM'){ if(t24(t.arrive)) pm[k]=t24(t.arrive); if(!amDest[k]) amDest[k]=t.dest; } }); });
    var dow=new Date(S.date+'T12:00:00').getDay(), early=(dow===3), now=nowHM(), today=isToday();
    var p={}, nOut=0, nIn=0, fb=0, skipped=[];
    roomKids(S.room).forEach(function(c){ var a=attOf(c.name), k=nameKey(c.name), o=a['School Out']||'', i=a['School In']||''; if(!a.Arrival){ return; }
      var np={};
      if(!o){ var to=am[k]; if(!to && useFallback && a.Arrival<'08:00') { to='08:00'; fb++; } if(to && (!today||to<=now) && !(a.Departure && a.Departure<to)){ np['School Out']=to; o=to; nOut++; } }
      if(!i && o && !a.Departure){ var ti=pm[k]; if(!ti && useFallback){ var d=amDest[k]||''; var base=/hamilton/i.test(d)?'15:30':/midway/i.test(d)?'15:15':''; if(base){ ti=early?pad(+base.slice(0,2)-1)+base.slice(2):base; fb++; } else skipped.push(c.name); }
        if(ti && (!today||ti<=now) && ti>=o){ np['School In']=ti; nIn++; } }
      if(Object.keys(np).length) p[c.name]=np; });
    return {patches:p, nOut:nOut, nIn:nIn, fb:fb, skipped:skipped, trips:trips.length};
  });
}
function showCatch(r){
  var names=Object.keys(r.patches);
  openModal('<h3>Catch up from transportation</h3><p class="sub2">'+(r.trips?r.trips+' transportation trip(s) found for '+esc(niceDate(S.date))+'.':'No transportation trips were logged for '+esc(niceDate(S.date))+'.')+' Only blank times are filled. Anything you already entered stays as it is.</p>'
   +'<p>'+(names.length?'Ready to fill <b>'+r.nOut+'</b> left-for-school and <b>'+r.nIn+'</b> back-from-school time(s) for: '+names.map(esc).join(', ')+'.':'Nothing to fill in from the trip log.')+'</p>'
   +'<div class="mrow" style="flex-direction:column;gap:8px">'+(names.length?'<button class="btn grn" data-act="catchupgo" data-fb="0">Fill from the trip log</button>':'')
   +'<button class="btn sec" data-act="catchupgo" data-fb="1">Also use the usual times where no trip was logged</button><button class="btn sec" data-act="mclose2">Cancel</button></div>'
   +'<p class="sub2">Usual times: out 8:00 &middot; Midway back 3:15, Hamilton back 3:30 &middot; Wednesday early release one hour earlier.</p>');
}
var ACT = {
 login: function(){
  var pin=val('pin').trim(), sch=val('sch'); if(!pin){ document.getElementById('lerr').textContent='Enter your PIN.'; return; }
  S.pin=pin; S.school=sch; document.getElementById('lerr').textContent='Checking…';
  api('whoami','').then(function(w){
    S.role=w.role; if(w.school) S.school=w.school;
    if(!S.school){ S.pin=null; var le=document.getElementById('lerr'); if(le) le.textContent='Pick your school first.'; return; }
    ls('hiveRoomsPin',pin); ls('hiveRoomsSchool',S.school);
    S.view='board'; S.loaded=false; return refresh();
  }).catch(function(e){ S.pin=null; var el=document.getElementById('lerr'); if(el) el.textContent=e.message; });
 },
 logout: function(){ ls('hiveRoomsPin',null); S.pin=null; S.view='login'; S.loaded=false; render(); },
 refresh: function(){ reloadAll().then(function(){ toast('Refreshed'); }); },
 help: function(){ openModal('<h3>Put this on your phone</h3><p><b>iPhone / iPad:</b> open this page in Safari &rarr; tap the Share button &rarr; <b>Add to Home Screen</b>.</p><p><b>Android:</b> open in Chrome &rarr; tap the &#8942; menu &rarr; <b>Add to Home screen</b> (or Install app).</p><p>It opens full-screen like an app. You will need your PIN the first time.</p><div class="mrow"><button class="btn" data-act="mclose2">Got it</button></div>'); },
 mclose: function(){ closeModal(); }, mclose2: function(){ closeModal(); },
 dprev: function(){ var go=function(){ shiftDate(-1); S.sel={}; refresh(); }; if(S.role==='teacher') needDirector(go); else go(); }, dnext: function(){ var d=new Date(S.date+'T12:00:00'); d.setDate(d.getDate()+1); var nd=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); if(S.role==='teacher' && nd>todayISO()) return; var go=function(){ shiftDate(1); S.sel={}; refresh(); }; if(S.role==='teacher' && nd!==todayISO()) needDirector(go); else go(); }, dtoday: function(){ S.date=todayISO(); S.sel={}; refresh(); },
 openroom: function(el){ S.room=decodeURIComponent(el.getAttribute('data-r')); S.view='room'; S.tab='sheet'; S.sel={}; render(); window.scrollTo(0,0); autoCatch(); },
 back: function(){ S.view='board'; S.sel={}; render(); },
 prevroom: function(){ ACT.gotoroom(-1); }, nextroom: function(){ ACT.gotoroom(1); },
 gotoroom: function(d){ var i=0; for(var k=0;k<S.rooms.length;k++) if(S.rooms[k].name===S.room) i=k; var n=S.rooms.length; S.room=S.rooms[(i+d+n)%n].name; S.sel={}; render(); window.scrollTo(0,0); },
 pickroom: function(el){ var nm=decodeURIComponent(el.value); if(nm&&roomObj(nm)){ S.room=nm; S.sel={}; render(); window.scrollTo(0,0); } },
 tab: function(el){ S.tab=el.getAttribute('data-t'); render(); },
 gotodcf: function(){ S.view='dcf'; render(); window.scrollTo(0,0); },
 gotowd: function(){ if(S.role==='director'){ S.view='withdrawn'; render(); } else needDirector(function(){ S.view='withdrawn'; render(); }); },
 print: function(){ window.print(); },
 printfood: function(){ printOnly('pr-food'); },
 printrosters: function(){ printOnly('pr-roster'); },
 printallfood: function(){ printOnly('pr-food'); },
 sel: function(el){ var n=keyOf(el); S.sel[n]=el.checked; render(); },
 selall: function(){ roomKids(S.room).forEach(function(c){ S.sel[c.name]=true; }); render(); },
 selpres: function(){ S.sel={}; presentIn(S.room).forEach(function(c){ S.sel[c.name]=true; }); render(); },
 selnone: function(){ S.sel={}; render(); },
 timenow: function(el){ var i=document.getElementById(el.getAttribute('data-id')); if(i) i.value=nowHM(); },
 quick: function(el){ var n=keyOf(el), a=attOf(n);
   if(!a.Arrival) signIn([n], nowHM()); else if(!a.Departure) signOut([n], nowHM()); else signIn([n], nowHM()); },
 bin: function(){ var t=val('bt')||nowHM(); S.bulkTime=''; var n=selNames(); signIn(n,t); S.sel={}; render(); toast(n.length+' signed IN at '+fmt(t)); },
 bout: function(){ var t=val('bt')||nowHM(); S.bulkTime=''; var n=selNames(); signOut(n,t); S.sel={}; render(); },
 allin: function(){ var n=roomKids(S.room).filter(function(c){ return !attOf(c.name).Arrival; }).map(function(c){return c.name;}); if(!n.length){ toast('Everyone is already signed in.'); return; } /* 2026-11-18: no longer signs in absent children; ticks everyone not in yet so the teacher unticks anyone absent, then taps Sign IN */ S.sel={}; n.forEach(function(x){ S.sel[x]=true; }); render(); toast('Ticked '+n.length+' not in yet. Untick anyone who is absent, then tap Sign IN.'); },
 mealone: function(el){ var n=keyOf(el), m=el.getAttribute('data-m'); if(m==='L' && !attOf(n).L && isSchoolager(n)){ askLunch([n]); return; } toggleMeal([n], m, 'toggle'); },
 lunchyes: function(el){ var hol=el.getAttribute('data-h')==='1', names=S.lunchAsk||[], p={}; var note='Lunch confirmed '+S.date+': here for lunch; '+(hol?'school holiday / no school':'not a holiday')+' ('+(S.role==='director'?'director':'teacher')+')'; names.forEach(function(n){ p[n]={L:true,'Lunch Note':note}; }); closeModal(); patchAtt(p); toast('Lunch added for '+names.length+' school-ager'+(names.length>1?'s':'')); },
 gotoflags: function(){ api('listFlags','').then(function(r){ S.flags=r.records||[]; S.flagN=S.flags.length; S.view='flags'; render(); window.scrollTo(0,0); }).catch(function(e){ toast(e.message,true); }); },
 flagsubmit: function(el){ var id=el.getAttribute('data-id'), v=val('fa'+id).trim(); if(!v){ toast('Type your answer first.', true); return; } flagSave(id,{'Director Answer': v+' ('+S.date+')'},'Answer saved'); },
 flaglunch: function(el){ var id=el.getAttribute('data-id'); flagSave(id,{L:true,'Lunch Note':'Lunch added by director '+S.date+': school holiday, here for lunch','Director Answer':'Holiday: lunch added ('+S.date+')'},'Lunch added'); },
 flagremove: function(el){ var id=el.getAttribute('data-id'); if(!confirm('Remove this child from that day (clears sign-in/out and meals)?')) return; flagSave(id,{Arrival:'',Departure:'',B:false,L:false,P:false,'Director Answer':'Removed from this day by director ('+S.date+')'},'Removed from that day'); },
 meal: function(el){ var m=el.getAttribute('data-m'); /* 2026-11-18: only children still here (signed in, not signed out) */ var pres=roomKids(S.room).filter(function(c){ return isPresent(attOf(c.name)); }).map(function(c){return c.name;});
   var mealName=(m==='B'?'breakfast':m==='L'?'lunch':'PM snack');
   if(!pres.length){ toast('No children are signed in right now. Tap a child\'s own box for anyone who ate and already went home.', true); return; }
   var all=pres.every(function(n){ return attOf(n)[m]; });
   if(m==='L' && !all){ var sa=pres.filter(function(n){ return isSchoolager(n) && !attOf(n).L; }); if(sa.length){ var rest=pres.filter(function(n){ return sa.indexOf(n)<0; }); if(rest.length) toggleMeal(rest, m, 'set'); askLunch(sa); return; } }
   if(all && !confirm('Everyone here already has '+mealName+'. Take '+mealName+' OFF for all '+pres.length+' children?')) return;
   toggleMeal(pres, m, all?'clear':'set'); toast((all?'Cleared ':'Marked ')+mealName+' for '+pres.length+' children here now'+(all?'':'. Tap a child\'s own box for anyone who ate and already went home.')); },
 so: function(el){ var n=keyOf(el), a=attOf(n); var p={}; p[n]={'School Out': a['School Out']? '' : nowHM()}; patchAtt(p); },
 si: function(el){ var n=keyOf(el), a=attOf(n); var p={}; p[n]={'School In': a['School In']? '' : nowHM()}; patchAtt(p); },
 soall: function(){ var n=roomKids(S.room).filter(function(c){ var a=attOf(c.name); return a.Arrival && !a.Departure && !a['School Out']; }).length; if(!n){ toast('Nobody left to send to school.'); return; }
   gateDay(function(){ openModal('<h3>All to school</h3><p class="sub2">'+n+' child(ren) who are in and not yet marked. Set the time they left (change it if you wrote it down).</p>'+timeInput('sat','Left for school')+'<div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn grn" data-act="soallgo">Save</button></div>'); }); },
 soallgo: function(){ var t=timeOrNow('sat'), p={}; roomKids(S.room).forEach(function(c){ var a=attOf(c.name); if(a.Arrival && !a.Departure && !a['School Out']) p[c.name]={'School Out':t}; }); closeModal(); patchAtt(p); toast('Marked '+Object.keys(p).length+' child(ren) to school at '+fmt(t)); },
 siall: function(){ var n=roomKids(S.room).filter(function(c){ var a=attOf(c.name); return a['School Out'] && !a['School In'] && !a.Departure; }).length; if(!n){ toast('Nobody to bring back.'); return; }
   gateDay(function(){ openModal('<h3>All back from school</h3><p class="sub2">'+n+' child(ren) are out at school. Set the time they came back.</p>'+timeInput('sbt','Back from school')+'<div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn grn" data-act="siallgo">Save</button></div>'); }); },
 siallgo: function(){ var t=timeOrNow('sbt'), p={}; roomKids(S.room).forEach(function(c){ var a=attOf(c.name); if(a['School Out'] && !a['School In'] && !a.Departure) p[c.name]={'School In':t}; }); closeModal(); patchAtt(p); toast('Marked '+Object.keys(p).length+' child(ren) back at '+fmt(t)); },
 /* per-child time editor (director on any day, teacher today) */
 times: function(el){ var n=keyOf(el), a=attOf(n), sa=isSA(S.room);
   gateDay(function(){ var h='<h3>Times &mdash; '+esc(n)+'</h3><p class="sub2">'+esc(niceDate(S.date))+'. Change any time, or clear it to remove it.</p>';
     [['Arrival','Came in','tmA'],sa?['School Out','Left for school','tmO']:null,sa?['School In','Back from school','tmI']:null,['Departure','Went home','tmD']].filter(Boolean).forEach(function(f){
       h+='<div class="trow"><label class="lbl" style="min-width:130px">'+f[1]+'</label><input class="inp" type="time" id="'+f[2]+'" value="'+esc(a[f[0]]||'')+'"></div>'; });
     h+='<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn" data-act="timesave" data-k="'+encodeURIComponent(n)+'">Save times</button></div>';
     openModal(h); }); },
 timesave: function(el){ var n=keyOf(el), sa=isSA(S.room), a=attOf(n), err=document.getElementById('merr'), p={}; p[n]={};
   var A=val('tmA'), D=val('tmD'), O=sa?val('tmO'):(a['School Out']||''), I=sa?val('tmI'):(a['School In']||'');
   if(A && D && D<A){ err.textContent='Went-home time is before the came-in time.'; return; }
   if(O && I && I<O){ err.textContent='Back-from-school is before left-for-school.'; return; }
   p[n].Arrival=A; p[n].Departure=D; if(sa){ p[n]['School Out']=O; p[n]['School In']=I; }
   closeModal(); patchAtt(p); toast('Times saved for '+n); },
 /* transportation catch-up: fill BLANK School Out / School In from the Transportation Trips log */
 catchup: function(){ gateDay(function(){ toast('Checking the transportation log…'); transCatch(false).then(function(r){ showCatch(r); }).catch(function(e){ toast(e.message,true); }); }); },
 catchupgo: function(el){ var useFB=el.getAttribute('data-fb')==='1'; closeModal(); transCatch(useFB).then(function(r){ if(!Object.keys(r.patches).length){ toast('Nothing to fill in.'); return; } patchAtt(r.patches); toast('Filled '+r.nOut+' left-for-school and '+r.nIn+' back-from-school time(s). Nothing already entered was changed.'); }).catch(function(e){ toast(e.message,true); }); },
 /* transitions: add from the paper form, edit, delete (any day) */
 tradd: function(){ gateDay(function(){ trForm(-1); }); },
 tredit: function(el){ var i=+el.getAttribute('data-i'); gateDay(function(){ trForm(i); }); },
 trsave: function(el){ var i=+el.getAttribute('data-i'), err=document.getElementById('merr');
   var dest=val('tdest'); if(dest==='Other (type it in)') dest=(val('tdestO')||'').trim();
   var out=val('tout'), tin=val('tin'), oc=parseInt(val('tocnt'),10), ic=parseInt(val('ticnt'),10);
   if(!dest){ err.textContent='Pick where they went.'; return; } if(!out){ err.textContent='Enter the time they left the room.'; return; }
   if(tin && tin<out){ err.textContent='Back-in time is before the out time.'; return; }
   var chk=[].map.call(document.querySelectorAll('.tkid:checked'),function(b){return b.value;}); if(!chk.length){ err.textContent='Check the children who went (at least one).'; return; }
   var day=ensureDay(S.room), by=val('toby'), iby=val('tiby');
   var rec=(i>=0 && day.transitions[i]) ? day.transitions[i] : {kids:[]};
   rec.kids=chk; rec.kidsIn=tin?[].map.call(document.querySelectorAll('.tkin:checked'),function(b){return b.value}):[]; if(tin) ic=rec.kidsIn.length; rec.dest=dest; rec.out=out; rec.outCount=isNaN(oc)?'':oc; rec.outBy=by; rec['in']=tin||''; rec.inCount=tin?(isNaN(ic)?'':ic):''; rec.inBy=tin?iby:'';
   if(i<0){ day.transitions.push(rec); day.counts.push({t:out,count:rec.outCount,by:by,kind:'sweep'}); if(tin) day.counts.push({t:tin,count:rec.inCount,by:iby,kind:'sweep'}); }
   day.transitions.sort(function(a,b){ return (a.out||'')<(b.out||'')?-1:1; }); day.transitions.forEach(function(x,k){ x.n=k+1; });
   saveDay(S.room); closeModal(); render(); toast('Transition saved.'); },
 trdel: function(el){ var i=+el.getAttribute('data-i'); gateDay(function(){ var day=ensureDay(S.room); var x=day.transitions[i]; if(!x) return; if(!confirm('Delete the transition to '+x.dest+' at '+fmt(x.out)+'?')) return; day.transitions.splice(i,1); day.transitions.forEach(function(y,k){ y.n=k+1; }); saveDay(S.room); render(); toast('Transition deleted.'); }); },
 wc: function(el){ var n=keyOf(el), a=attOf(n); var p={}; p[n]={WC: a.WC? '' : 'X'}; patchAtt(p); },
 wcall: function(){ var pres=roomKids(S.room).filter(function(c){ return isPresent(attOf(c.name)) && !attOf(c.name).WC; }).map(function(c){return c.name;}); if(!pres.length){ toast('Wellness checks already done for everyone in.'); return; } var p={}; pres.forEach(function(n){ p[n]={WC:'X'}; }); patchAtt(p); toast('Wellness check marked for '+pres.length); },
 note: function(el){ var n=keyOf(el), t=el.getAttribute('data-t'), a=attOf(n);
   openModal('<h3>'+(t==='IR'?'Illness report':'Accident report')+' — '+esc(n)+'</h3><p class="sub2">'+(t==='IR'?'What symptoms did you see? Time noticed, temperature, who was told.':'What happened, where, what was done, and who was told. Tell the director right away and fill out the Accident/Incident report.')+'</p><textarea class="inp" id="nt" rows="5" autofocus>'+esc(a[t]||'')+'</textarea><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button>'+(a[t]?'<button class="btn sec" data-act="notesave" data-t="'+t+'" data-k="'+encodeURIComponent(n)+'" data-clear="1">Remove report</button>':'')+'<button class="btn" data-act="notesave" data-t="'+t+'" data-k="'+encodeURIComponent(n)+'">Save</button></div>'); },
 notesave: function(el){ var n=keyOf(el), t=el.getAttribute('data-t'); var v=el.getAttribute('data-clear')?'':val('nt').trim(); var p={}; p[n]={}; p[n][t]=v; patchAtt(p); closeModal(); if(v && t==='AR') toast('Saved. Tell the director now.'); },
 bmove: function(){ var n=selNames(); var opts=S.rooms.filter(function(r){ return r.name!==S.room; });
   openModal('<h3>Move '+n.length+' child'+(n.length>1?'ren':'')+' to…</h3><p class="sub2">Use when rooms are combined. They will show on the other room\'s sheet today.</p>'+opts.map(function(r){ return '<button class="btn sec wide" data-act="movego" data-r="'+encodeURIComponent(r.name)+'">'+esc(r.name)+'</button>'; }).join('')+'<div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button></div>'); },
 movego: function(el){ var to=decodeURIComponent(el.getAttribute('data-r')); var p={}; selNames().forEach(function(n){ p[n]={'Current Room':to}; }); patchAtt(p); S.sel={}; closeModal(); toast('Moved to '+to); },
 /* transitions + counts */
 leave: function(){ var r=roomObj(S.room), pres=presentIn(S.room); if(!pres.length){ toast('No children are signed in.',true); return; }
   var dests=S.rooms.filter(function(x){return x.name!==S.room;}).map(function(x){return x.name;}).concat(['Playground','Office']); dests=['Outside','Playroom'].concat(dests.filter(function(d){return d!=='Playground';}));
   openModal('<h3>Leaving the room</h3><p class="sub2">1) Count the children &nbsp;2) Do a sweep of the room &nbsp;3) Then go.</p><label class="lbl">Where are you going?</label><select class="inp" id="dest" onchange="document.getElementById(\'destOther\').style.display=this.value===\'Other (type it in)\'?\'block\':\'none\'">'+dests.concat(['Other (type it in)']).map(function(d){ return '<option>'+esc(d)+'</option>'; }).join('')+'</select><input class="inp" id="destOther" placeholder="Type where you are going" style="display:none;margin-top:6px">'
    +'<label class="lbl">Children counted leaving (expected '+pres.length+')</label><input class="inp" id="cnt" type="number" inputmode="numeric" value="'+pres.length+'">'
    +'<label class="lbl">Counted by</label>'+whoSelect(r.name,'by')
    +'<label class="ck2"><input type="checkbox" id="swp"> I did a sweep and no child was left in the classroom</label>'+timeInput('ttime','Time leaving')
    +'<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn grn" data-act="leavego" data-exp="'+pres.length+'">Leave now</button></div>'); },
 leavego: function(el){ var exp=+el.getAttribute('data-exp'); var dest=val('dest'); if(dest==='Other (type it in)') dest=(val('destOther')||'').trim(); var cnt=parseInt(val('cnt'),10), by=val('by'), t=timeOrNow('ttime'), err=document.getElementById('merr');
   if(!dest){ err.textContent='Pick where you are going.'; return; }
   if(isNaN(cnt)){ err.textContent='Enter the count.'; return; }
   if(!chk('swp')){ err.textContent='Please do the sweep and tick the box before leaving.'; return; }
   if(cnt!==exp && !confirm('You counted '+cnt+' but '+exp+' are signed in. Re-count to be sure. Leave anyway?')) return;
   var day=ensureDay(S.room); day.transitions.push({n:day.transitions.length+1, dest:dest, out:t, outCount:cnt, outBy:by, kids:presentIn(S.room).map(function(c){return c.name;})});
   day.counts.push({t:t, count:cnt, by:by, kind:'sweep'}); saveDay(S.room); closeModal(); S.tab='leave'; render(); toast('Out to '+dest+' at '+fmt(t)); },
 'return': function(){ var r=roomObj(S.room), day=dayOf(S.room), ot=openTrans(day); if(!ot){ toast('The room is not out.'); return; }
   openModal('<h3>Back in the room</h3><p class="sub2">Count everyone back in, then sweep the area you left. Left with '+esc(ot.outCount)+'.</p>'
    +'<label class="lbl">Children counted coming back</label><input class="inp" id="cnt" type="number" inputmode="numeric" value="'+esc(ot.outCount)+'" autofocus>'
    +'<label class="lbl">Counted by</label>'+whoSelect(r.name,'by')
    +'<label class="ck2"><input type="checkbox" id="swp"> I swept the area we left &mdash; nobody was left behind</label>'+timeInput('ttime','Time back')
    +'<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn grn" data-act="returngo" data-exp="'+esc(ot.outCount)+'">Back in room</button></div>'); },
 returngo: function(el){ var exp=+el.getAttribute('data-exp'), cnt=parseInt(val('cnt'),10), by=val('by'), t=timeOrNow('ttime'), err=document.getElementById('merr');
   if(isNaN(cnt)){ err.textContent='Enter the count.'; return; }
   if(!chk('swp')){ err.textContent='Please sweep the area and tick the box.'; return; }
   if(cnt!==exp){ if(!confirm('Count is '+cnt+' but '+exp+' left. A child may be missing — keep looking and tell a director. Only continue if every child is accounted for. Continue?')) return; }
   var day=ensureDay(S.room), ot=openTrans(day); if(ot){ ot.in=t; ot.inCount=cnt; ot.inBy=by; ot.kidsIn=presentIn(S.room).map(function(c){return c.name;}); }
   day.counts.push({t:t, count:cnt, by:by, kind:'sweep'}); saveDay(S.room); closeModal(); render(); toast('Back in room at '+fmt(t)); },
 count: function(){ var r=roomObj(S.room), pres=presentIn(S.room).length;
   openModal('<h3>Headcount</h3><p class="sub2">Children in the room right now (signed in: '+pres+').</p><input class="inp" id="cnt" type="number" inputmode="numeric" value="'+pres+'" autofocus><label class="lbl">Counted by</label>'+whoSelect(r.name,'by')+timeInput('ttime','Time')+'<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn" data-act="countgo" data-exp="'+pres+'">Save count</button></div>'); },
 countgo: function(el){ var exp=+el.getAttribute('data-exp'), cnt=parseInt(val('cnt'),10), t=timeOrNow('ttime'); if(isNaN(cnt)){ document.getElementById('merr').textContent='Enter the count.'; return; }
   if(cnt!==exp && !confirm('You counted '+cnt+' but '+exp+' are signed in. Fix the sign-ins or re-count. Save anyway?')) return;
   var day=ensureDay(S.room); day.counts.push({t:t, count:cnt, by:val('by'), kind:'headcount'}); saveDay(S.room); closeModal(); render(); toast('Headcount saved'); },
 /* staff */
 stedit: function(el){ var t=decodeURIComponent(el.getAttribute('data-k')); needDirector(function(){ var s=(dayOf(S.room).staff[t]||[]); if(!s.length) return; var h='<h3>Edit times — '+esc(t)+'</h3><p class="sub2">Change the time this person came in or went out. Leave Out empty if still here.</p>'; s.forEach(function(x,i){ h+='<div class="trow"><label class="lbl" style="min-width:60px">Shift '+(i+1)+'</label><input class="inp" type="time" id="sei'+i+'" value="'+esc(x['in']||'')+'"><input class="inp" type="time" id="seo'+i+'" value="'+esc(x.out||'')+'"></div>'; }); h+='<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn" data-act="stsave" data-k="'+encodeURIComponent(t)+'">Save times</button></div>'; openModal(h); }); },
 stsave: function(el){ var t=decodeURIComponent(el.getAttribute('data-k')); var day=ensureDay(S.room); var s=day.staff[t]||[]; var err=document.getElementById('merr'); var upd=[]; for(var i=0;i<s.length;i++){ var a=val('sei'+i), b=val('seo'+i); if(!a){ err.textContent='Every shift needs an In time.'; return; } if(b && b<a){ err.textContent='Out time is before the in time.'; return; } upd.push([a,b]); } upd.forEach(function(u,i){ s[i]['in']=u[0]; s[i].out=u[1]; }); saveDay(S.room); closeModal(); toast('Times updated.'); },
 stin: function(el){ var t=decodeURIComponent(el.getAttribute('data-k')), tm=timeOrNow('stT'); var day=ensureDay(S.room); var s=day.staff[t]=day.staff[t]||[]; if(s.length<3) s.push({'in':tm,out:''}); saveDay(S.room); },
 stout: function(el){ var t=decodeURIComponent(el.getAttribute('data-k')), tm=timeOrNow('stT'); var day=ensureDay(S.room); var s=day.staff[t]||[]; var last=s[s.length-1]; if(last){ if(tm<last['in']){ toast('Out time is before the in time.',true); return; } last.out=tm; } saveDay(S.room); },
 pick: function(el){ var v=el.value; if(!v) return; if(v==='__other'){ el.value=''; ACT.addstaff(); return; } var tm=timeOrNow('stT'); var day=ensureDay(S.room); var st=day.staff[v]=day.staff[v]||[]; if(st.length<3 && !(st.length && !st[st.length-1].out)) st.push({'in':tm,out:''}); saveDay(S.room); toast(v+' in at '+fmt(tm)); },
 addstaff: function(){ openModal('<h3>Someone else is in this room</h3><p class="sub2">Type the name of the sub or floater.</p><input class="inp" id="sother" placeholder="Name, e.g. Ms Lopez" autofocus><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn" data-act="addstaffgo">Add &amp; time IN</button></div>'); },
 addstaffgo: function(){ var n=val('sother').trim(); if(!n) return; var tm=nowHM(); var day=ensureDay(S.room); if(!day.staff[n]) day.staff[n]=[{'in':tm,out:''}]; saveDay(S.room); closeModal(); },
 mgmt: function(el){ var s=el.getAttribute('data-s'); needDirector(function(){ openModal('<h3>Management initials — '+P.SLOT_LABELS[P.SLOTS.indexOf(s)]+'</h3><input class="inp" id="mi" maxlength="4" autocapitalize="characters" autofocus placeholder="Your initials"><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn sec" data-act="migo" data-s="'+s+'" data-clear="1">Clear</button><button class="btn" data-act="migo" data-s="'+s+'">Save</button></div>'); }); },
 migo: function(el){ var s=el.getAttribute('data-s'); var day=ensureDay(S.room); if(el.getAttribute('data-clear')) delete day.mgmt[s]; else { var v=val('mi').trim().toUpperCase(); if(!v) return; day.mgmt[s]=v; }
   // management writes need a director PIN, so send with it
   var pinUse=S.role==='director'?S.pin:S.dirPin; closeModal(); mgmtSave(S.room, pinUse); },
 /* director gate */
 dpinok: function(){ var p=val('dpin').trim(); if(!p) return; api('whoami','',null,p).then(function(w){ if(w.role!=='director'){ throw new Error('That is not a director PIN.'); } if(w.school && w.school!==S.school){ throw new Error('That PIN is for '+w.school+', not '+S.school+'.'); } S.dirPin=p; S.dirAt=Date.now(); closeModal(); var cb=needDirector.cb; needDirector.cb=null; if(cb) cb(p); }).catch(function(e){ var el=document.getElementById('derr'); if(el) el.textContent=e.message; }); },
 /* roster (director: add / withdraw) */
 notedit: function(el){ var k=decodeURIComponent(el.getAttribute('data-r')), x=(S.notes||{})[k]||{}; openModal('<h3>Note for '+(k==='ALL'?'all staff':esc(k))+'</h3><p class="sub2">Staff can read this on the board. Only owners and directors can change it. Leave it empty to clear it.</p><textarea class="inp" id="ntx" rows="4" maxlength="300" placeholder="Have a great weekend!">'+esc(x.text||'')+'</textarea><label class="lbl">Show until (optional)</label><input class="inp" type="date" id="ntu" value="'+esc(x.until||'')+'"><div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn" data-act="roomnotesave" data-r="'+encodeURIComponent(k)+'">Save note</button></div>'); },
 roomnotesave: function(el){ var k=decodeURIComponent(el.getAttribute('data-r')); fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:S.pin,school:S.school,action:'rn_set',room:k,text:val('ntx'),until:val('ntu'),by:S.role==='owner'?'Mrs. Bear':'Director'})}).then(function(r){return r.json()}).then(function(j){ if(j.error) throw new Error(j.error); S.notes=j.notes; closeModal(); render(); toast('Note saved'); }).catch(function(e){ var m=document.getElementById('merr'); if(m) m.textContent=e.message; }); },
 roster: function(){ if(S.role==='director') rosterModal(S.pin); else needDirector(function(p){ rosterModal(p); }); },
 addkid: function(el){ var p=el.getAttribute('data-p'); var err=document.getElementById('merr'); err.textContent='';
   var fn=val('kfn').trim(), ln=val('kln').trim(), dob=val('kdob'), room=val('kroom');
   if(!fn||!ln){ err.textContent='Enter the child\'s first AND last name.'; return; }
   if(!dob){ err.textContent='Enter the date of birth.'; return; }
   var name=fn+' '+ln.charAt(0).toUpperCase()+'.';
   if(S.kids.some(function(k){ return k.status==='Active' && k.name.toLowerCase()===name.toLowerCase(); })){ err.textContent=name+' is already on a roster. Use a different last initial or letter.'; return; }
   var race=['AI','As','Bl','HI','Wh','Un'].filter(function(c){ return chk('krace'+c); });
   var eth=radio('keth'); if(!race.length){ err.textContent='Pick at least one race (or Unknown) - KidKare requires it.'; return; } if(!eth){ err.textContent='Pick an ethnicity (or Unknown) - KidKare requires it.'; return; }
   var gmode=radio('kgm'); var g={mode:gmode||'new'};
   if(g.mode==='existing'){ g.existing=val('kgex').trim(); if(!g.existing){ err.textContent='Type the existing parent/guardian name exactly as it shows in KidKare.'; return; } }
   else { g.rel=val('kgrel'); g.first=val('kgfn').trim(); g.mid=val('kgmn').trim(); g.last=val('kgln').trim(); g.phone=val('kgph').trim(); g.phone2=val('kgph2').trim(); g.email=val('kgem').trim(); g.lang=val('kglang'); g.addr=val('kgad').trim(); g.city=val('kgct').trim(); g.state=val('kgst').trim()||'FL'; g.zip=val('kgzp').trim();
     if(!g.first||!g.last||!g.phone||!g.addr||!g.city||!g.zip){ err.textContent='Guardian needs first + last name, primary phone, address, city and zip (KidKare requires them).'; return; } }
   var days={}; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(d){ if(chk('kd'+d)) days[d]={drop:val('kdr'+d),pick:val('kpk'+d)}; });
   if(!Object.keys(days).length){ err.textContent='Pick the days the child attends.'; return; }
   var meals=['B','AM','L','PM','D','E'].filter(function(c){ return chk('km'+c); });
   var intake={first:fn,mid:val('kmn').trim(),last:ln,dob:dob,enroll:val('ken'),expire:val('kex'),sex:radio('ksex')||'',race:race,eth:eth,
     specialNeeds:chk('ksn'),atRisk:chk('kar'),solidsDate:val('ksol'),specialDiet:chk('ksd'),milkSub:chk('kms'),milkAllergy:chk('kma'),dietExp:val('kde'),notes:val('kno').trim(),
     guardian:g,days:days,timesVary:chk('ktv'),overnight:chk('kov'),meals:meals,migrant:chk('kmi'),room:room};
   if(!intake.enroll||!intake.expire){ err.textContent='Enter the enrollment date and expiration date.'; return; }
   api('create','Room Children',{fields:{Child:name, Room:room, DOB:dob, Status:'Active', Order:99, 'KidKare Action':'Needs Add', 'KidKare Intake':JSON.stringify(intake)}},p).then(function(){ closeModal(); toast(name+' added to '+room+'. Charles will add them in KidKare at the next 10 AM / 6 PM check. Remember ProCare too.'); return reloadAll(); }).catch(function(e){ err.textContent=e.message; }); },
 wdopen: function(el){ var id=el.getAttribute('data-id'), p=el.getAttribute('data-p'); var k=S.kids.filter(function(x){return x.id===id;})[0]; if(!k) return;
   openModal('<h3>Withdraw '+esc(k.name)+'?</h3><p class="sub2">They come off every room sheet. Charles will remove them from the food program (KidKare) and remind the director to remove them from ProCare.</p><label class="lbl">Reason</label><select class="inp" id="wr"><option>Moved away</option><option>Changed schools / programs</option><option>Aged out / started kindergarten</option><option>Family decision</option><option>Other</option></select><label class="lbl">Last day</label><input class="inp" type="date" id="wdt" value="'+todayISO()+'"><div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Cancel</button><button class="btn org" data-act="wdgo" data-id="'+id+'" data-p="'+esc(p)+'">Withdraw</button></div>'); },
 wdgo: function(el){ var id=el.getAttribute('data-id'), p=el.getAttribute('data-p'); var k=S.kids.filter(function(x){return x.id===id;})[0]; if(!k) return;
   api('update','Room Children',{recordId:id, fields:{Status:'Withdrawn','Withdrawn Date':val('wdt'),'Withdrawn From Room':k.room,'Withdraw Reason':val('wr'),'KidKare Action':'Needs Remove'}},p).then(function(){ closeModal(); toast(k.name+' withdrawn. KidKare removal happens at the next 10 AM / 6 PM check; remove from ProCare too.'); return reloadAll(); }).catch(function(e){ var m=document.getElementById('merr'); if(m) m.textContent=e.message; }); },
 pcdone: function(el){ var id=el.getAttribute('data-id'); needDirector(function(p){ api('update','Room Children',{recordId:id, fields:{'ProCare Removed':true}},p).then(reloadAll).then(function(){ toast('Marked removed from ProCare'); }).catch(function(e){ toast(e.message,true); }); }); },
 reinstate: function(el){ var id=el.getAttribute('data-id'); if(!confirm('Put this child back on their room roster?')) return; needDirector(function(p){ api('update','Room Children',{recordId:id, fields:{Status:'Active','Withdrawn Date':null,'Withdrawn From Room':'','Withdraw Reason':'','KidKare Action':null}},p).then(reloadAll).then(function(){ toast('Put back on the roster'); }).catch(function(e){ toast(e.message,true); }); }); }
};
function mgmtSave(roomName, pinUse){
  var d=S.days[roomName]; var fields={Staff:JSON.stringify(d.staff), Transitions:JSON.stringify(d.transitions), Counts:JSON.stringify(d.counts), Mgmt:JSON.stringify(d.mgmt), Notes:d.notes||''};
  render();
  enqueue(function(){
    if(d.id) return api('update','Room Day',{recordId:d.id, fields:fields}, pinUse);
    var f={Key:S.school+'|'+roomName+'|'+S.date, Room:roomName, Date:S.date}; for(var k in fields) f[k]=fields[k];
    return api('create','Room Day',{fields:f}, pinUse).then(function(res){ var rec=(res.records||[])[0]; if(rec){ d.id=rec.id; } });
  });
}
function whoSelect(roomName,id){ var t=teachersFor(roomName); return '<select class="inp" id="'+id+'">'+t.map(function(x){ return '<option>'+esc(x)+'</option>'; }).join('')+'<option value="">Other / initials not listed</option></select>'; }

function chk(id){ var e=document.getElementById(id); return !!(e&&e.checked); }
function radio(name){ var e=document.querySelector('input[name="'+name+'"]:checked'); return e?e.value:''; }
function kkForm(rooms){
  var Y=new Date().getFullYear(), exp=(new Date().getMonth()>=7?Y+1:Y)+'-07-31';
  function ck(id,l,chk0){ return '<label class="ckl"><input type="checkbox" id="'+id+'"'+(chk0?' checked':'')+'> '+l+'</label>'; }
  var h='<h4>Child</h4><div class="g2"><input class="inp" id="kfn" placeholder="First name"><input class="inp" id="kmn" placeholder="Middle (optional)"></div><input class="inp" id="kln" placeholder="Last name" style="margin-top:8px">'
   +'<label class="lbl">Date of birth</label><input class="inp" type="date" id="kdob"><label class="lbl">Room</label><select class="inp" id="kroom">'+rooms.map(function(n){ return '<option'+(n===S.room?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select>'
   +'<div class="g2"><div><label class="lbl">Enrollment date</label><input class="inp" type="date" id="ken" value="'+todayISO()+'"></div><div><label class="lbl">Enrollment expires</label><input class="inp" type="date" id="kex" value="'+exp+'"></div></div>'
   +'<label class="lbl">Sex</label><div class="rg"><label><input type="radio" name="ksex" value="Male"> Male</label><label><input type="radio" name="ksex" value="Female"> Female</label></div>'
   +'<label class="lbl">Race (check all that apply)</label>'+ck('kraceAI','American Indian / Alaskan Native')+ck('kraceAs','Asian')+ck('kraceBl','Black or African American')+ck('kraceHI','Native Hawaiian / Pacific Islander')+ck('kraceWh','White')+ck('kraceUn','Unknown')
   +'<label class="lbl">Ethnicity</label><div class="rg"><label><input type="radio" name="keth" value="Hispanic or Latino"> Hispanic or Latino</label><label><input type="radio" name="keth" value="Not Hispanic or Latino"> Not Hispanic or Latino</label><label><input type="radio" name="keth" value="Unknown"> Unknown</label></div>'
   +'<label class="lbl">Special</label>'+ck('ksn','Special needs')+ck('kar','At-risk child')+'<label class="lbl">Developmentally ready for solid foods (date, infants)</label><input class="inp" type="date" id="ksol">'
   +'<label class="lbl">Diet</label>'+ck('ksd','Special diet')+ck('kms','Needs milk substitution')+ck('kma','Milk allergy')+'<label class="lbl">Diet expiration date</label><input class="inp" type="date" id="kde"><label class="lbl">Notes</label><input class="inp" id="kno" placeholder="Optional">'
   +'<h4>Parent / guardian</h4><div class="rg"><label><input type="radio" name="kgm" value="existing"> Already in KidKare (sibling)</label><label><input type="radio" name="kgm" value="new" checked> New contact</label></div>'
   +'<div class="hint">For an existing contact I only link them. I never change who pays.</div><input class="inp" id="kgex" placeholder="Existing contact exactly as in KidKare, e.g. WONG, SAMANTHA">'
   +'<label class="lbl">New contact</label><select class="inp" id="kgrel"><option>Mother</option><option>Father</option><option>Other</option></select><div class="g2" style="margin-top:8px"><input class="inp" id="kgfn" placeholder="First name"><input class="inp" id="kgmn" placeholder="Middle"></div><input class="inp" id="kgln" placeholder="Last name" style="margin-top:8px">'
   +'<div class="g2" style="margin-top:8px"><input class="inp" id="kgph" type="tel" placeholder="Primary phone"><input class="inp" id="kgph2" type="tel" placeholder="Other phone"></div><input class="inp" id="kgem" type="email" placeholder="Email" style="margin-top:8px"><select class="inp" id="kglang" style="margin-top:8px"><option>English</option><option>Spanish</option></select>'
   +'<input class="inp" id="kgad" placeholder="Street address" style="margin-top:8px"><div class="g3" style="margin-top:8px"><input class="inp" id="kgct" placeholder="City"><input class="inp" id="kgst" value="FL"><input class="inp" id="kgzp" placeholder="Zip"></div>'
   +'<h4>Care schedule</h4><div class="hint">Check the days the child attends and the usual drop-off / pick-up times.</div>';
  [['Mon','Monday'],['Tue','Tuesday'],['Wed','Wednesday'],['Thu','Thursday'],['Fri','Friday'],['Sat','Saturday'],['Sun','Sunday']].forEach(function(d){
    h+='<div class="dayrow"><label class="ckl"><input type="checkbox" id="kd'+d[0]+'"'+(['Mon','Tue','Wed','Thu','Fri'].indexOf(d[0])>-1?' checked':'')+'> '+d[1]+'</label><input class="inp sm" type="time" id="kdr'+d[0]+'" value="07:00"><input class="inp sm" type="time" id="kpk'+d[0]+'" value="17:30"></div>';
  });
  h+=ck('ktv','Drop-off / pick-up times vary')+ck('kov','Child stays overnight')
   +'<label class="lbl">Meals the child takes</label>'+ck('kmB','Breakfast',true)+ck('kmAM','AM snack')+ck('kmL','Lunch',true)+ck('kmPM','PM snack',true)+ck('kmD','Dinner')+ck('kmE','Evening snack')
   +'<label class="lbl">CACFP</label>'+ck('kmi','Child is the dependent of a migrant worker');
  return h;
}
function rosterModal(p){
  var rooms=S.rooms.map(function(r){return r.name;});
  var h='<h3>Roster — '+esc(S.school)+'</h3><div class="rst">';
  S.rooms.forEach(function(r){
    h+='<div class="rsr"><b>'+esc(r.name)+'</b>';
    S.kids.filter(function(k){ return k.status==='Active' && k.room===r.name; }).sort(function(a,b){return a.order-b.order;}).forEach(function(k){
      h+='<div class="rsk"><span>'+esc(k.name)+' <small>'+esc(k.dob)+(k.verify?' &middot; <span class="rd">check name</span>':'')+'</small></span><button class="btn sec sm" data-act="wdopen" data-id="'+k.id+'" data-p="'+esc(p)+'">Withdraw</button></div>';
    });
    h+='</div>';
  });
  h+='</div><h2 class="addh">Add a child</h2><div class="hint">Fill this once. Charles adds the child to KidKare at 10 AM / 6 PM, then clears the parent details.</div>'+kkForm(rooms)+'<div id="merr" class="err"></div><div class="mrow"><button class="btn sec" data-act="mclose2">Close</button><button class="btn grn" data-act="addkid" data-p="'+esc(p)+'">Add child</button></div>';
  openModal(h);
}

/* ---------- events ---------- */
document.addEventListener('click', function(e){
  var el=e.target.closest('[data-act]'); if(!el) return;
  var act=el.getAttribute('data-act'); var fn=ACT[act]; if(!fn) return;
  if(act==='sel'||act==='pick'||act==='pickroom') return; // handled on change
  if(act==='mclose' && e.target!==el) return;
  fn(el);
});
document.addEventListener('change', function(e){ var el=e.target; if(el.getAttribute && el.getAttribute('data-act')==='sel') ACT.sel(el); else if(el.getAttribute && el.getAttribute('data-act')==='pick') ACT.pick(el); else if(el.getAttribute && el.getAttribute('data-act')==='pickroom') ACT.pickroom(el); });
document.addEventListener('keydown', function(e){ if(e.key==='Enter'){ var t=e.target; if(t.id==='pin') ACT.login(); if(t.id==='dpin') ACT.dpinok(); } });

/* ---------- boot / timers ---------- */
function boot(){
  var pin=ls('hiveRoomsPin');
  if(pin){ S.pin=pin; S.school=ls('hiveRoomsSchool')||portalSchool();
    api('whoami','').then(function(w){ S.role=w.role; if(w.school) S.school=w.school; if(!S.school){ S.pin=null; S.view='login'; render(); return; } if(S.role==='director' && /[?&]as=teacher\b/.test(location.search)){ S.role='teacher'; S.asTeacher=1; } S.view='board'; return refresh(); }).catch(function(){ S.view='login'; render(); });
  } else render();
}
setInterval(function(){ if(S.view!=='login' && document.visibilityState==='visible' && !modalOpen() && S.pending===0 && isToday()) refresh(true); }, 20000);
setInterval(function(){ if(S.view!=='login' && !modalOpen() && S.view!=='dcf' && S.tab!=='paper' && S.view!=='dcf') render(); }, 60000);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && S.view!=='login' && !modalOpen() && S.pending===0) refresh(true); });
window.__rooms = {S:S, ACT:ACT, refresh:refresh, st:schoolTeachers, tf:teachersFor}; // for tests
boot();
})();
