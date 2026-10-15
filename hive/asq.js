/* 🧩 ASQ Screenings — self-injecting add-on for The Hive teacher & director portals (built 10/15/26).
Same pattern as transport.js: loads after the page's inline script and reuses api()/esc()/show().
Data lives in Airtable "ASQ Tracker". One row per child per screening.
Rules from Mrs. Bear + the SR contract:
- ASQ-3 + ASQ:SE-2 are due within 45 calendar days of School Readiness enrollment (and again at redetermination).
- The screening itself is completed ONLINE through the ELC's own link (Provider Portal -> Incomplete Queue).
  The questionnaires are copyrighted (Brookes), so the Hive never reproduces them -- it tracks who is due,
  which age questionnaire to pick, and each step after.
- After the ELC posts the Summary Result Letter to ShareFile, the parent signs it + gets the ASQ activities
  within 10 days, then the signed letter is uploaded back to ShareFile.
- Children = first name + last initial only.
Age interval is computed from DOB on today's date (the day the screening is done). */
(function(){
var path = location.pathname.toLowerCase();
var isDir = path.indexOf('director.html') > -1;
var isTeach = path.indexOf('teacher.html') > -1;
if(!isDir && !isTeach) return;
var T = 'ASQ Tracker';
var esc = window.esc || function(s){return (s==null?'':(''+s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
var PORTAL_URL = 'https://providerservices.floridaearlylearning.com/Account/Login';
var SHAREFILE = {'Sanford':'https://seminoleearlylearning.sharefile.com/dashboard'};
var STATUSES = ['⏳ Due','📝 Parent consent','✅ Submitted to ELC','📬 Summary letter posted','✍️ Parent signed','📁 Uploaded to ShareFile','🎉 Complete','🚫 Parent declined'];
var DONE = ['🎉 Complete','🚫 Parent declined'];

var css = ''
+ '.aq-guide{background:#fff;border-radius:18px;padding:14px 18px;margin-bottom:12px;box-shadow:0 6px 18px rgba(74,58,48,.10);border-left:8px solid #9b6bff;font-size:.92rem;line-height:1.45;}'
+ '.aq-guide ol{margin:6px 0 4px 18px;padding:0;} .aq-guide li{margin:2px 0;}'
+ '.aq-links{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 2px;} .aq-links a{background:#9b6bff;color:#fff;border-radius:10px;padding:7px 12px;font-weight:800;text-decoration:none;font-size:.85rem;}'
+ '.aq-links a.sf{background:#2fc4b2;}'
+ '.aq-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px;}'
+ '.aq-sel,.aq-inp{padding:7px 10px;border-radius:10px;border:1px solid #f0e2d4;font-weight:700;color:#7a6a5c;background:#fff;font-family:inherit;font-size:.9rem;}'
+ '.aq-card{background:#fff;border-radius:16px;padding:12px 16px;margin-bottom:10px;box-shadow:0 6px 18px rgba(74,58,48,.10);border-left:8px solid #ffb13d;}'
+ '.aq-card.late{border-left-color:#ff6b6b;} .aq-card.soon{border-left-color:#ff9b4a;} .aq-card.ok{border-left-color:#46c97f;}'
+ '.aq-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline;cursor:pointer;}'
+ '.aq-name{font-weight:900;font-size:1.05rem;} .aq-meta{color:#9b8576;font-size:.8rem;font-weight:700;}'
+ '.aq-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-weight:900;font-size:.75rem;color:#fff;background:#ffb13d;margin-left:4px;}'
+ '.aq-pill.late{background:#ff6b6b;} .aq-pill.soon{background:#ff9b4a;} .aq-pill.ok{background:#46c97f;} .aq-pill.st{background:#9b6bff;}'
+ '.aq-q{background:#f6f0ff;border-radius:10px;padding:8px 10px;margin:8px 0;font-weight:800;color:#5a4cc9;font-size:.88rem;}'
+ '.aq-q.warn{background:#fff6d9;color:#9a6a00;}'
+ '.aq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:8px;}'
+ '.aq-grid label{font-size:.72rem;font-weight:800;color:#9b8576;display:block;margin-bottom:2px;}'
+ '.aq-grid .aq-inp,.aq-grid .aq-sel{width:100%;box-sizing:border-box;}'
+ '.aq-save{border:none;border-radius:12px;padding:9px 16px;color:#fff;font-weight:900;cursor:pointer;background:#12946c;margin-top:10px;}'
+ '.aq-body{display:none;} .aq-card.open .aq-body{display:block;}'
+ '.aq-next{font-size:.82rem;font-weight:700;color:#7a6a5c;margin-top:4px;}'
+ '.aq-sec{font-weight:900;color:#7a6a5c;margin:16px 0 8px;font-size:.95rem;}'
+ '.aq-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#4a3a30;color:#fff;padding:10px 18px;border-radius:12px;font-weight:800;z-index:9999;}'
+ '.aq-empty{color:#9b8576;text-align:center;padding:18px;}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

function toast(msg){ var t=document.createElement('div'); t.className='aq-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2600); }
function sel(v){ return (v && typeof v==='object') ? (v.name||'') : (v||''); }
function d0(s){ if(!s) return null; var p=(''+s).slice(0,10).split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function iso(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function nice(s){ var d=d0(s); return d ? (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear() : ''; }
function addDays(s,n){ var d=d0(s); if(!d) return ''; d.setDate(d.getDate()+n); return iso(d); }
function today(){ var t=new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function daysUntil(s){ var d=d0(s); if(!d) return null; return Math.round((d - today())/86400000); }

/* Age in completed months + days on a given date */
function ageMD(dob, on){
  var b=d0(dob); if(!b) return null; var o=on||today();
  var m=(o.getFullYear()-b.getFullYear())*12 + (o.getMonth()-b.getMonth());
  var anchor=new Date(b.getFullYear(), b.getMonth()+m, b.getDate());
  if(anchor > o){ m--; anchor=new Date(b.getFullYear(), b.getMonth()+m, b.getDate()); }
  var dd=Math.round((o-anchor)/86400000);
  return {m:m, d:dd};
}
/* ASQ-3 questionnaire windows (age in months+days, upper bound inclusive) */
var ASQ3=[[2,[1,0],[2,30]],[4,[3,0],[4,30]],[6,[5,0],[6,30]],[8,[7,0],[8,30]],[9,[9,0],[9,30]],[10,[10,0],[10,30]],[12,[11,0],[12,30]],[14,[13,0],[14,30]],[16,[15,0],[16,30]],[18,[17,0],[18,30]],[20,[19,0],[20,30]],[22,[21,0],[22,30]],[24,[23,0],[25,15]],[27,[25,16],[28,15]],[30,[28,16],[31,15]],[33,[31,16],[34,15]],[36,[34,16],[38,30]],[42,[39,0],[44,30]],[48,[45,0],[50,30]],[54,[51,0],[56,30]],[60,[57,0],[66,0]]];
/* ASQ:SE-2 windows (months) */
var SE2=[[2,1,2],[6,3,8],[12,9,14],[18,15,20],[24,21,26],[30,27,32],[36,33,41],[48,42,53],[60,54,72]];
function ge(a,b){ return a.m>b[0] || (a.m===b[0] && a.d>=b[1]); }
function le(a,b){ return a.m<b[0] || (a.m===b[0] && a.d<=b[1]); }
function pickQ(dob){
  var a=ageMD(dob); if(!a) return null;
  var q3=null, se=null;
  for(var i=0;i<ASQ3.length;i++){ if(ge(a,ASQ3[i][1]) && le(a,ASQ3[i][2])){ q3=ASQ3[i][0]; break; } }
  for(var j=0;j<SE2.length;j++){ if(a.m>=SE2[j][1] && a.m<=SE2[j][2]){ se=SE2[j][0]; break; } }
  return {age:a, q3:q3, se:se};
}
function qText(dob){
  var p=pickQ(dob); if(!p) return {cls:'warn', txt:'Add the date of birth (from ProCare) and the right questionnaire will show here.'};
  var ageTxt=p.age.m+' months, '+p.age.d+' days old today';
  if(!p.q3 && !p.se) return {cls:'warn', txt:ageTxt+' — outside the ASQ age range. Check with the ELC.'};
  var t='Use ASQ-3 '+(p.q3?p.q3+' Month':'(n/a)')+' + ASQ:SE-2 '+(p.se?p.se+' Month':'(n/a)')+'  ·  '+ageTxt;
  if(p.age.m<24) t+='  ·  Born 3+ weeks early? Adjust the age for prematurity before picking.';
  return {cls:'', txt:t, short:'ASQ-3 '+(p.q3||'?')+' Month + ASQ:SE-2 '+(p.se||'?')+' Month'};
}
function nextStep(f){
  var s=sel(f.Status)||'⏳ Due';
  if(s==='⏳ Due') return 'Next: get the parent\'s consent, then complete the screening online through the ELC link.';
  if(s==='📝 Parent consent') return 'Next: complete + submit the screening online through the ELC Provider Portal (Incomplete Queue).';
  if(s==='✅ Submitted to ELC') return 'Next: watch ShareFile (ASQ folder) for the Summary Result Letter. Mark it "Summary letter posted" with the date.';
  if(s==='📬 Summary letter posted'){ var by=f['Letter Posted Date']?nice(addDays(f['Letter Posted Date'],10)):'10 days from posting'; return 'Next: parent signs the letter + gets the ASQ activities by '+by+'.'; }
  if(s==='✍️ Parent signed') return 'Next: upload the signed Summary Letter to the ASQ folder in ShareFile.';
  if(s==='📁 Uploaded to ShareFile') return 'Last step: mark Complete.';
  return '';
}
function dueInfo(f){
  var s=sel(f.Status); if(DONE.indexOf(s)>-1) return {cls:'ok', txt:s};
  var n=daysUntil(f['Due Date']);
  if(n===null) return {cls:'', txt:'No due date'};
  if(['✅ Submitted to ELC','📬 Summary letter posted','✍️ Parent signed','📁 Uploaded to ShareFile'].indexOf(s)>-1) return {cls:'ok', txt:'Screened ✓'};
  if(n<0) return {cls:'late', txt:'OVERDUE '+(-n)+' day'+(n===-1?'':'s')};
  if(n===0) return {cls:'late', txt:'Due TODAY'};
  if(n<=10) return {cls:'soon', txt:'Due in '+n+' day'+(n===1?'':'s')};
  return {cls:'', txt:'Due '+nice(f['Due Date'])};
}

var school=null, rows=[], openId=null;
async function getSchool(){
  if(isDir){ if(school) return school; try{ var w=await api({action:'whoami'}); if(w && w.school) school=w.school; }catch(e){} return school; }
  return localStorage.getItem('hiveSchool') || null;
}
function myName(){ return localStorage.getItem('hiveName') || ''; }

async function refresh(){
  var area=document.getElementById('aqArea'); if(!area) return;
  var sc=await getSchool();
  if(!sc){ area.innerHTML='<div class="aq-empty">Pick your school above to see which children need an ASQ. 🧩</div>'; renderLinks(null); return; }
  renderLinks(sc);
  area.innerHTML='<div class="aq-empty">Loading… 🧩</div>';
  var d=await api({action:'list', table:T, maxRecords:300, sortField:'Due Date', sortDir:'asc', filterByFormula: isTeach ? "{School}='"+sc+"'" : ''});
  if(d && d.error){ area.innerHTML='<div class="aq-empty">'+esc(d.error)+'</div>'; return; }
  rows=((d&&d.records)||[]);
  render();
}
function renderLinks(sc){
  var el=document.getElementById('aqLinks'); if(!el) return;
  var h='<a href="'+PORTAL_URL+'" target="_blank" rel="noopener">Open ELC Provider Portal ↗</a>';
  if(sc && SHAREFILE[sc]) h+='<a class="sf" href="'+SHAREFILE[sc]+'" target="_blank" rel="noopener">Open ShareFile ↗</a>';
  el.innerHTML=h;
}
function render(){
  var area=document.getElementById('aqArea'); if(!area) return;
  var open=[], done=[];
  rows.forEach(function(r){ (DONE.indexOf(sel(r.fields.Status))>-1 ? done : open).push(r); });
  var h='';
  if(!open.length) h+='<div class="aq-empty">No ASQ screenings open right now. 🎉</div>';
  else h+='<div class="aq-sec">Open screenings ('+open.length+')</div>'+open.map(card).join('');
  if(done.length) h+='<details><summary class="aq-sec" style="cursor:pointer">Finished ('+done.length+')</summary>'+done.map(card).join('')+'</details>';
  area.innerHTML=h;
  area.querySelectorAll('.aq-head').forEach(function(hd){ hd.onclick=function(){ var c=hd.parentNode; var id=c.getAttribute('data-id'); openId=(openId===id?null:id); area.querySelectorAll('.aq-card').forEach(function(x){ x.classList.toggle('open', x.getAttribute('data-id')===openId); }); }; });
  area.querySelectorAll('.aq-save').forEach(function(b){ b.onclick=function(){ save(b.getAttribute('data-id')); }; });
  area.querySelectorAll('.aq-dob').forEach(function(inp){ inp.onchange=function(){ var id=inp.getAttribute('data-id'); var q=qText(inp.value); var box=document.getElementById('aqQ-'+id); if(box){ box.className='aq-q '+(q.cls||''); box.textContent=q.txt; } }; });
}
function card(r){
  var f=r.fields, id=r.id, di=dueInfo(f), q=qText(f.DOB), s=sel(f.Status)||'⏳ Due';
  var stOpts=STATUSES.map(function(x){ return '<option'+(x===s?' selected':'')+'>'+esc(x)+'</option>'; }).join('');
  var dirOnly = isDir
    ? '<div><label>Child (first + last initial)</label><input class="aq-inp" id="aqChild-'+id+'" value="'+esc(f.Child||'')+'"></div>'
      +'<div><label>SR start date</label><input type="date" class="aq-inp" id="aqStart-'+id+'" value="'+esc((f['SR Start Date']||'').slice(0,10))+'"></div>'
      +'<div><label>Due date (start + 45 days)</label><input type="date" class="aq-inp" id="aqDue-'+id+'" value="'+esc((f['Due Date']||'').slice(0,10))+'"></div>'
    : '';
  return '<div class="aq-card '+di.cls+(openId===id?' open':'')+'" data-id="'+id+'">'
    +'<div class="aq-head"><div><span class="aq-name">'+esc(f.Child||'(no name)')+'</span>'
    +' <span class="aq-meta">'+esc(f.Room||'')+(f.Room?' · ':'')+esc(sel(f.Reason)||'')+'</span></div>'
    +'<div><span class="aq-pill st">'+esc(s)+'</span><span class="aq-pill '+di.cls+'">'+esc(di.txt)+'</span></div></div>'
    +'<div class="aq-next">'+esc(nextStep(f))+'</div>'
    +'<div class="aq-body">'
    +'<div class="aq-q '+(q.cls||'')+'" id="aqQ-'+id+'">'+esc(q.txt)+'</div>'
    +'<div class="aq-grid">'
    + dirOnly
    +'<div><label>Date of birth (ProCare)</label><input type="date" class="aq-inp aq-dob" data-id="'+id+'" id="aqDob-'+id+'" value="'+esc((f.DOB||'').slice(0,10))+'"></div>'
    +'<div><label>Room</label><input class="aq-inp" id="aqRoom-'+id+'" value="'+esc(f.Room||'')+'" placeholder="e.g. Twos"></div>'
    +'<div><label>Status</label><select class="aq-sel" id="aqSt-'+id+'">'+stOpts+'</select></div>'
    +'<div><label>Submitted to ELC on</label><input type="date" class="aq-inp" id="aqSub-'+id+'" value="'+esc((f['Submitted Date']||'').slice(0,10))+'"></div>'
    +'<div><label>Summary letter posted on</label><input type="date" class="aq-inp" id="aqLet-'+id+'" value="'+esc((f['Letter Posted Date']||'').slice(0,10))+'"></div>'
    +'<div><label>Completed by</label><input class="aq-inp" id="aqBy-'+id+'" value="'+esc(f['Completed By']||myName())+'" placeholder="Your name"></div>'
    +'</div>'
    +'<div style="margin-top:8px"><label style="font-size:.72rem;font-weight:800;color:#9b8576">Notes</label><textarea class="aq-inp" id="aqNotes-'+id+'" style="width:100%;box-sizing:border-box;min-height:54px">'+esc(f.Notes||'')+'</textarea></div>'
    +'<button class="aq-save" data-id="'+id+'">Save</button>'
    +'</div></div>';
}
function v(id){ var e=document.getElementById(id); return e ? e.value.trim() : ''; }
async function save(id){
  var fields={
    'Room': v('aqRoom-'+id),
    'DOB': v('aqDob-'+id) || null,
    'Status': v('aqSt-'+id),
    'Submitted Date': v('aqSub-'+id) || null,
    'Letter Posted Date': v('aqLet-'+id) || null,
    'Completed By': v('aqBy-'+id),
    'Notes': v('aqNotes-'+id)
  };
  var q=qText(fields.DOB); if(q.short) fields['Questionnaire']=q.short;
  if(fields.Status==='✅ Submitted to ELC' && !fields['Submitted Date']) fields['Submitted Date']=iso(today());
  if(isDir){
    fields['Child']=v('aqChild-'+id);
    fields['SR Start Date']=v('aqStart-'+id) || null;
    var due=v('aqDue-'+id);
    if(!due && fields['SR Start Date']) due=addDays(fields['SR Start Date'],45);
    fields['Due Date']=due || null;
  }
  if(fields['Completed By']) localStorage.setItem('hiveName', fields['Completed By']);
  var res=await api({action:'update', table:T, recordId:id, fields:fields});
  if(res && res.error){ toast('Could not save: '+res.error); return; }
  toast('Saved ✓'); openId=id; refresh();
}
async function addChild(){
  var sc=await getSchool(); if(!sc){ toast('No school found'); return; }
  var child=v('aqNewChild'), start=v('aqNewStart'), dob=v('aqNewDob');
  if(!child || !start){ toast('Child and SR start date, please'); return; }
  var fields={'Child':child, 'Room':v('aqNewRoom'), 'Reason':v('aqNewReason')||'New SR enrollment', 'SR Start Date':start, 'Due Date':addDays(start,45), 'Status':'⏳ Due', 'Coalition': sc==='Sanford'?'ELC Seminole':'ELC Flagler & Volusia', 'Source':'Added in the Hive by director'};
  if(dob){ fields.DOB=dob; var q=qText(dob); if(q.short) fields.Questionnaire=q.short; }
  var res=await api({action:'create', table:T, fields:fields});
  if(res && res.error){ toast('Could not add: '+res.error); return; }
  ['aqNewChild','aqNewStart','aqNewDob','aqNewRoom'].forEach(function(i){ var e=document.getElementById(i); if(e) e.value=''; });
  toast('Added ✓'); refresh();
}

function boot(){
  if(!document.querySelector('nav') || !document.querySelector('main')) { return setTimeout(boot, 300); }
  var guide='<div class="aq-guide"><b>🧩 ASQ Screenings.</b> Every School Readiness child needs an ASQ-3 and an ASQ:SE-2 within <b>45 days</b> of starting SR (and again at redetermination). Tap a child to see which age questionnaire to use.'
    +'<ol><li>Get the parent\'s consent.</li><li>Complete the screening <b>online</b> through the ELC link (Provider Portal → Incomplete Queue) and mark it <b>Submitted</b>.</li><li>When the Summary Result Letter shows up in ShareFile, mark <b>Summary letter posted</b>.</li><li>The parent signs it and gets the ASQ activities within <b>10 days</b>.</li><li>Upload the signed letter to ShareFile, then mark <b>Complete</b>.</li></ol>'
    +'<div class="aq-links" id="aqLinks"></div></div>';
  var top = isTeach
    ? '<div class="aq-top"><span class="aq-meta">Your school</span><select class="aq-sel" id="aqSchool"><option value="">— pick —</option><option>Sanford</option><option>DeLand 2</option></select><span class="aq-meta">Your name</span><input class="aq-inp" id="aqMyName" placeholder="First Last"></div>'
    : '<details style="margin:0 0 12px"><summary style="font-weight:900;cursor:pointer">➕ Add a child who needs an ASQ</summary><div class="aq-grid" style="margin-top:8px">'
      +'<div><label>Child (first name + last initial)</label><input class="aq-inp" id="aqNewChild" placeholder="e.g. Josiah M."></div>'
      +'<div><label>Room</label><input class="aq-inp" id="aqNewRoom" placeholder="e.g. Twos"></div>'
      +'<div><label>Date of birth (ProCare)</label><input type="date" class="aq-inp" id="aqNewDob"></div>'
      +'<div><label>SR start date</label><input type="date" class="aq-inp" id="aqNewStart"></div>'
      +'<div><label>Reason</label><select class="aq-sel" id="aqNewReason"><option>New SR enrollment</option><option>Redetermination</option><option>Transfer / re-enrollment</option></select></div>'
      +'</div><button class="aq-save" id="aqAddBtn">Add child</button></details>';
  addPanel('asq', guide + top + '<div id="aqArea" class="aq-empty">Loading… 🧩</div>');
  addTab('🧩 ASQ Screenings', 'linear-gradient(90deg,#9b6bff,#ff6b9d)', 'asq', function(){ refresh(); });
  if(isDir){ var b=document.getElementById('aqAddBtn'); if(b) b.onclick=addChild; }
  if(isTeach){
    var s=document.getElementById('aqSchool'); s.value=localStorage.getItem('hiveSchool')||''; s.onchange=function(){ localStorage.setItem('hiveSchool',s.value); openId=null; refresh(); };
    var n=document.getElementById('aqMyName'); n.value=myName(); n.onchange=function(){ localStorage.setItem('hiveName',n.value.trim()); };
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
