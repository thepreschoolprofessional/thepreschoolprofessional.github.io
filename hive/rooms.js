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
  chain = chain.then(fn).catch(function(e){ toast('Could not save: '+e.message+' — tap Refresh to re-sync.', true); S.lastErr=e.message; })
    .then(function(){ S.pending--; paintSaving(); });
  return chain;
}
function paintSaving(){ var el=document.getElementById('sv'); if(el) el.textContent = S.pending? 'Saving…' : 'Saved'; if(el) el.className='sv '+(S.pending?'busy':'ok'); }

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
  return p.then(loadDay).then(function(){ S.loaded=true; render(); }).catch(function(e){ if(!quiet) toast(e.message,true); });
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
function attMapFor(list){ var m={}; list.forEach(function(c){ var a=attOf(c.name); m[c.name]={Arrival:a.Arrival||'',Departure:a.Departure||'',B:!!a.B,L:!!a.L,P:!!a.P,WC:a.WC||'',IR:a.IR||'',AR:a.AR||''}; }); return m; }
function dayOf(roomName){ return S.days[roomName] || {id:null, staff:{}, transitions:[], counts:[], mgmt:{}, notes:''}; }
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
function render(){
  if(S.view==='login'){ APP.innerHTML=loginHTML(); return; }
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
  var sch=ls('hiveRoomsSchool')||'DeLand 2';
  return '<div class="login"><div class="hex">&#11042;</div><h1>Hive Rooms</h1><p class="sub">Fast sign-in / sign-out for every classroom</p>'
   +'<label class="lbl">Your PIN</label><input class="inp" id="pin" type="password" autocomplete="off" autocapitalize="characters" placeholder="Staff or director PIN" value="'+esc(ls('hiveRoomsPin')||'')+'">'
   +'<label class="lbl">School (teachers pick; directors are set automatically)</label><select class="inp" id="sch"><option'+(sch==='DeLand 2'?' selected':'')+'>DeLand 2</option><option'+(sch==='Sanford'?' selected':'')+'>Sanford</option></select>'
   +'<button class="btn big" data-act="login">Open my rooms</button><div id="lerr" class="err"></div>'
   +'<button class="link" data-act="help">How do I put this on my phone like an app?</button></div>';
}
function headerHTML(){
  var h='<div class="hdr"><div class="hl"><b>'+esc(S.school)+'</b><span class="chip">'+(S.role==='director'?'Director':'Teacher')+'</span></div>'
   +'<div class="hr"><span id="sv" class="sv ok">Saved</span><button class="ib" data-act="refresh" title="Refresh">&#8635;</button><button class="ib" data-act="help" title="Help">?</button><button class="ib" data-act="logout" title="Log out">&#9099;</button></div></div>'
   +'<div class="dnav"><button class="ib" data-act="dprev">&lsaquo;</button><div class="dt">'+esc(niceDate(S.date))+(isToday()?' <span class="chip g">Today</span>':' <span class="chip o">Back-fill (director)</span>')+'</div><button class="ib" data-act="dnext">&rsaquo;</button>'+(isToday()?'':'<button class="btn sec sm" data-act="dtoday">Today</button>')+'</div>';
  return h;
}
function boardHTML(){
  var h='<div class="pad"><div class="act2"><button class="btn sec" data-act="gotodcf">&#128196; All rooms — paper form (DCF)</button>'
   +(S.role==='director'?'<button class="btn sec" data-act="gotoflags">&#10067; Questions to answer'+(S.flagN?' ('+S.flagN+')':'')+'</button><button class="btn sec" data-act="gotowd">Withdrawn children</button>':'<button class="btn sec" data-act="gotowd">Withdrawn (director)</button>')+'</div>';
  if(!S.rooms.length) h+='<div class="card">No rooms are set up for '+esc(S.school)+' yet.</div>';
  h+='<div class="tiles">';
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
  h+='<div class="meal"><span class="lbl2">Whole room:</span><button class="btn sm" data-act="allin">Check all IN</button><button class="btn sm" data-act="meal" data-m="B">B all</button><button class="btn sm" data-act="meal" data-m="L">Lunch all</button><button class="btn sm" data-act="meal" data-m="P">PM Snack all</button><button class="btn sm" data-act="wcall">Wellness all</button></div>';
  h+='<div class="cnt">'+pres+' in room now &middot; '+list.length+' on this sheet</div>';
  h+='<div class="klist">';
  list.forEach(function(c){
    var a=attOf(c.name), st=a.Arrival?(a.Departure?'out':'in'):'none', k=encodeURIComponent(c.name);
    var age=P.ageStr(c.dob,S.date);
    h+='<div class="kr '+st+'"><label class="ck"><input type="checkbox" data-act="sel" data-k="'+k+'"'+(S.sel[c.name]?' checked':'')+'></label>'
     +'<div class="kn"><b>'+esc(c.name)+'</b> <small>'+esc(age?age+' yr':'')+(c.visiting?' &middot; '+esc(c.visiting):'')+'</small><div class="kt">'
     +(a.Arrival?'In '+fmt(a.Arrival):'Not in')+(a.Departure?' &middot; Out '+fmt(a.Departure):'')+'</div></div>'
     +'<button class="qb '+(st==='none'?'in':(st==='in'?'out':'back'))+'" data-act="quick" data-k="'+k+'">'+(st==='none'?'IN':(st==='in'?'OUT':'Back IN'))+'</button>'
     +'<div class="chips">'
     +chip('B',a.B,c.name,'B')+chip('L',a.L,c.name,'L')+chip('P',a.P,c.name,'P')
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
  h+='<div class="card"><b>Today\'s transitions</b>'+(t.length?'':'<div class="sub2">None yet.</div>')+t.map(function(x,i){ return '<div class="tli">#'+(i+1)+' <b>'+esc(x.dest)+'</b> &middot; out '+fmt(x.out)+(x.in?' &middot; in '+fmt(x.in):' &middot; <span class="rd">still out</span>')+' &middot; counts '+esc(x.outCount)+(x.in?' / '+esc(x.inCount):'')+'</div>'; }).join('')+'</div>';
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
  var html=P.render({school:S.school, room:r.name, date:S.date, teachers:teachersFor(r.name), children:list, att:attMapFor(list), day:day, asOf: isToday()? nowHM(): null});
  return '<div class="noprint"><button class="btn" data-act="print">Print / save as PDF</button> <span class="sub2">This is what DCF sees — same layout as the paper roster.</span></div><div class="pfwrap">'+html+'</div>';
}
function dcfHTML(){
  var h='<div class="pad noprint"><button class="btn sec sm" data-act="back">&lsaquo; Rooms</button> <b>All rooms — '+esc(S.school)+' — '+esc(niceDate(S.date))+'</b> <button class="btn" data-act="print">Print all</button></div>';
  h+='<div class="pfwrap">';
  S.rooms.forEach(function(r){
    var list=roomKids(r.name);
    h+=P.render({school:S.school, room:r.name, date:S.date, teachers:teachersFor(r.name), children:list, att:attMapFor(list), day:dayOf(r.name), asOf: isToday()? nowHM(): null});
  });
  return h+'</div>';
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
  var p={}, redo=[];
  names.forEach(function(n){ var a=attOf(n); if(a.Arrival && a.Departure) redo.push(n); p[n]={Arrival:time, Departure:''}; });
  if(redo.length && !confirm(redo.join(', ')+' already signed out. Sign back in and clear the out time?')) return;
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

var ACT = {
 login: function(){
  var pin=val('pin').trim(), sch=val('sch'); if(!pin){ document.getElementById('lerr').textContent='Enter your PIN.'; return; }
  S.pin=pin; S.school=sch; document.getElementById('lerr').textContent='Checking…';
  api('whoami','').then(function(w){
    S.role=w.role; if(w.school) S.school=w.school;
    ls('hiveRoomsPin',pin); ls('hiveRoomsSchool',S.school);
    S.view='board'; S.loaded=false; return refresh();
  }).catch(function(e){ S.pin=null; var el=document.getElementById('lerr'); if(el) el.textContent=e.message; });
 },
 logout: function(){ ls('hiveRoomsPin',null); S.pin=null; S.view='login'; S.loaded=false; render(); },
 refresh: function(){ reloadAll().then(function(){ toast('Refreshed'); }); },
 help: function(){ openModal('<h3>Put this on your phone</h3><p><b>iPhone / iPad:</b> open this page in Safari &rarr; tap the Share button &rarr; <b>Add to Home Screen</b>.</p><p><b>Android:</b> open in Chrome &rarr; tap the &#8942; menu &rarr; <b>Add to Home screen</b> (or Install app).</p><p>It opens full-screen like an app. You will need your PIN the first time.</p><div class="mrow"><button class="btn" data-act="mclose2">Got it</button></div>'); },
 mclose: function(){ closeModal(); }, mclose2: function(){ closeModal(); },
 dprev: function(){ var go=function(){ shiftDate(-1); S.sel={}; refresh(); }; if(S.role==='teacher') needDirector(go); else go(); }, dnext: function(){ var d=new Date(S.date+'T12:00:00'); d.setDate(d.getDate()+1); var nd=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); if(S.role==='teacher' && nd>todayISO()) return; var go=function(){ shiftDate(1); S.sel={}; refresh(); }; if(S.role==='teacher' && nd!==todayISO()) needDirector(go); else go(); }, dtoday: function(){ S.date=todayISO(); S.sel={}; refresh(); },
 openroom: function(el){ S.room=decodeURIComponent(el.getAttribute('data-r')); S.view='room'; S.tab='sheet'; S.sel={}; render(); window.scrollTo(0,0); },
 back: function(){ S.view='board'; S.sel={}; render(); },
 tab: function(el){ S.tab=el.getAttribute('data-t'); render(); },
 gotodcf: function(){ S.view='dcf'; render(); window.scrollTo(0,0); },
 gotowd: function(){ if(S.role==='director'){ S.view='withdrawn'; render(); } else needDirector(function(){ S.view='withdrawn'; render(); }); },
 print: function(){ window.print(); },
 sel: function(el){ var n=keyOf(el); S.sel[n]=el.checked; render(); },
 selall: function(){ roomKids(S.room).forEach(function(c){ S.sel[c.name]=true; }); render(); },
 selpres: function(){ S.sel={}; presentIn(S.room).forEach(function(c){ S.sel[c.name]=true; }); render(); },
 selnone: function(){ S.sel={}; render(); },
 timenow: function(el){ var i=document.getElementById(el.getAttribute('data-id')); if(i) i.value=nowHM(); },
 quick: function(el){ var n=keyOf(el), a=attOf(n);
   if(!a.Arrival) signIn([n], nowHM()); else if(!a.Departure) signOut([n], nowHM()); else signIn([n], nowHM()); },
 bin: function(){ var t=val('bt')||nowHM(); S.bulkTime=''; var n=selNames(); signIn(n,t); S.sel={}; render(); toast(n.length+' signed IN at '+fmt(t)); },
 bout: function(){ var t=val('bt')||nowHM(); S.bulkTime=''; var n=selNames(); signOut(n,t); S.sel={}; render(); },
 allin: function(){ var n=roomKids(S.room).filter(function(c){ return !attOf(c.name).Arrival; }).map(function(c){return c.name;}); if(!n.length){ toast('Everyone is already signed in.'); return; } if(confirm('Sign in '+n.length+' children who are not in yet, at '+fmt(nowHM())+'?')) signIn(n, nowHM()); },
 mealone: function(el){ var n=keyOf(el), m=el.getAttribute('data-m'); if(m==='L' && !attOf(n).L && isSchoolager(n)){ askLunch([n]); return; } toggleMeal([n], m, 'toggle'); },
 lunchyes: function(el){ var hol=el.getAttribute('data-h')==='1', names=S.lunchAsk||[], p={}; var note='Lunch confirmed '+S.date+': here for lunch; '+(hol?'school holiday / no school':'not a holiday')+' ('+(S.role==='director'?'director':'teacher')+')'; names.forEach(function(n){ p[n]={L:true,'Lunch Note':note}; }); closeModal(); patchAtt(p); toast('Lunch added for '+names.length+' school-ager'+(names.length>1?'s':'')); },
 gotoflags: function(){ api('listFlags','').then(function(r){ S.flags=r.records||[]; S.flagN=S.flags.length; S.view='flags'; render(); window.scrollTo(0,0); }).catch(function(e){ toast(e.message,true); }); },
 flagsubmit: function(el){ var id=el.getAttribute('data-id'), v=val('fa'+id).trim(); if(!v){ toast('Type your answer first.', true); return; } flagSave(id,{'Director Answer': v+' ('+S.date+')'},'Answer saved'); },
 flaglunch: function(el){ var id=el.getAttribute('data-id'); flagSave(id,{L:true,'Lunch Note':'Lunch added by director '+S.date+': school holiday, here for lunch','Director Answer':'Holiday: lunch added ('+S.date+')'},'Lunch added'); },
 flagremove: function(el){ var id=el.getAttribute('data-id'); if(!confirm('Remove this child from that day (clears sign-in/out and meals)?')) return; flagSave(id,{Arrival:'',Departure:'',B:false,L:false,P:false,'Director Answer':'Removed from this day by director ('+S.date+')'},'Removed from that day'); },
 meal: function(el){ var m=el.getAttribute('data-m'); var pres=roomKids(S.room).filter(function(c){ return attOf(c.name).Arrival; }).map(function(c){return c.name;});
   if(!pres.length){ toast('Sign children in first.', true); return; }
   var all=pres.every(function(n){ return attOf(n)[m]; });
   if(m==='L' && !all){ var sa=pres.filter(function(n){ return isSchoolager(n) && !attOf(n).L; }); if(sa.length){ var rest=pres.filter(function(n){ return sa.indexOf(n)<0; }); if(rest.length) toggleMeal(rest, m, 'set'); askLunch(sa); return; } }
   toggleMeal(pres, m, all?'clear':'set'); toast((all?'Cleared ':'Marked ')+(m==='B'?'breakfast':m==='L'?'lunch':'PM snack')+' for '+pres.length+' children'); },
 wc: function(el){ var n=keyOf(el), a=attOf(n); var p={}; p[n]={WC: a.WC? '' : nowHM()}; patchAtt(p); },
 wcall: function(){ var pres=roomKids(S.room).filter(function(c){ return attOf(c.name).Arrival && !attOf(c.name).WC; }).map(function(c){return c.name;}); if(!pres.length){ toast('Wellness checks already done for everyone in.'); return; } var p={}; pres.forEach(function(n){ p[n]={WC:nowHM()}; }); patchAtt(p); toast('Wellness check marked for '+pres.length); },
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
  if(act==='sel'||act==='pick') return; // handled on change
  if(act==='mclose' && e.target!==el) return;
  fn(el);
});
document.addEventListener('change', function(e){ var el=e.target; if(el.getAttribute && el.getAttribute('data-act')==='sel') ACT.sel(el); else if(el.getAttribute && el.getAttribute('data-act')==='pick') ACT.pick(el); });
document.addEventListener('keydown', function(e){ if(e.key==='Enter'){ var t=e.target; if(t.id==='pin') ACT.login(); if(t.id==='dpin') ACT.dpinok(); } });

/* ---------- boot / timers ---------- */
function boot(){
  var pin=ls('hiveRoomsPin');
  if(pin){ S.pin=pin; S.school=ls('hiveRoomsSchool')||'DeLand 2';
    api('whoami','').then(function(w){ S.role=w.role; if(w.school) S.school=w.school; S.view='board'; return refresh(); }).catch(function(){ S.view='login'; render(); });
  } else render();
}
setInterval(function(){ if(S.view!=='login' && document.visibilityState==='visible' && !modalOpen() && S.pending===0 && isToday()) refresh(true); }, 20000);
setInterval(function(){ if(S.view!=='login' && !modalOpen() && S.view!=='dcf' && S.tab!=='paper') render(); }, 60000);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && S.view!=='login' && !modalOpen() && S.pending===0) refresh(true); });
window.__rooms = {S:S, ACT:ACT, refresh:refresh, st:schoolTeachers, tf:teachersFor}; // for tests
boot();
})();
