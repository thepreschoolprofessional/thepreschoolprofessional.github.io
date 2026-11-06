/* Who is taking this training? Per-person, tracked on the server. Shared by lessons.html and handbook training. */
(function(){
var PIN=sessionStorage.getItem('hivePin')||'',ROLE=sessionStorage.getItem('hiveRole')||'teacher',TSCH=sessionStorage.getItem('hiveSchool')||'';
var W=null;try{W=JSON.parse(sessionStorage.getItem('hiveWho')||'null')}catch(e){}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function api(a,x){var o={pin:PIN,action:a};for(var k in x)o[k]=x[k];return fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)}).then(function(r){return r.json()}).then(function(j){if(j.error)throw new Error(j.error);return j})}
var HW={certs:{},ready:false,
 get:function(){return W},
 set:function(w){W=w;HW.certs={};HW.ready=false;try{sessionStorage.setItem('hiveWho',JSON.stringify(w))}catch(e){}},
 clear:function(){W=null;HW.certs={};HW.ready=false;try{sessionStorage.removeItem('hiveWho')}catch(e){}},
 api:api,esc:esc,
 load:function(cb){if(!W){cb&&cb();return}api('cert_status',{school:W.school,id:W.id}).then(function(j){HW.certs={};(j.certs||[]).forEach(function(c){HW.certs[c.lesson]=c});HW.ready=true;if(j.name)W.name=j.name;cb&&cb()}).catch(function(){HW.ready=true;cb&&cb()})},
 done:function(id){return !!HW.certs[id]},
 submit:function(id,title,hrs){return api('cert_submit',{school:W.school,id:W.id,lesson:id,title:title,hrs:hrs}).then(function(j){var c=j.cert;c.signed=false;HW.certs[id]=c;return c}).catch(function(e){if(/already/i.test(e.message)){HW.certs[id]=HW.certs[id]||{lesson:id,title:title,hrs:hrs,date:new Date().toISOString().slice(0,10)};return HW.certs[id]}throw e})},
 /* the "who are you" picker; draws into el, calls cb when a person is chosen */
 gate:function(el,cb,why){
  el.innerHTML='<div class="card" style="background:#fffbea;border:2px solid #f0c040;border-radius:16px;padding:16px;margin:12px 0"><h2 style="margin:0 0 4px">Who is taking this training?</h2><div style="color:#9b8576;margin-bottom:8px">'+esc(why||'Pick your name first so your training and certificate go into YOUR staff file. Each person does their own.')+'</div>'
   +(TSCH?'':'<select class="fi hwfi" id="hw_s" style="width:100%;padding:10px;font-size:16px;margin:6px 0"><option value="">Which school?</option><option>Sanford</option><option>DeLand 2</option></select>')
   +'<select class="fi hwfi" id="hw_n" style="width:100%;padding:10px;font-size:16px;margin:6px 0"><option value="">'+(TSCH?'Loading names…':'Pick your school first')+'</option></select>'
   +'<div id="hw_new" style="display:none"><input id="hw_nn" maxlength="50" placeholder="First and last name, as it should appear on your certificate" style="width:100%;padding:10px;font-size:16px;margin:6px 0;border:1px solid #eadfce;border-radius:8px"></div>'
   +'<button id="hw_go" style="border:0;border-radius:12px;padding:10px 18px;font-weight:800;background:#2e8b57;color:#fff;font-size:1rem;cursor:pointer">Start my training</button><div id="hw_m" style="min-height:20px;font-weight:700;color:#c62828;margin-top:6px"></div></div>';
  var S=document.getElementById('hw_s'),N=document.getElementById('hw_n'),M=document.getElementById('hw_m');
  function sch(){return S?S.value:TSCH}
  function names(){var sc=sch();if(!sc){N.innerHTML='<option value="">Pick your school first</option>';return}
   N.innerHTML='<option value="">Loading names…</option>';
   api('staff_names',{school:sc}).then(function(j){N.innerHTML='<option value="">Pick your name</option>'+(j.staff||[]).map(function(p){return'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>'}).join('')+'<option value="__new">➕ My name is not here</option>'}).catch(function(e){N.innerHTML='<option value="">Could not load names</option>';M.textContent=e.message||''})}
  if(S)S.onchange=names;else names();
  N.onchange=function(){document.getElementById('hw_new').style.display=N.value==='__new'?'block':'none'};
  document.getElementById('hw_go').onclick=function(){M.textContent='';var sc=sch();if(!sc){M.textContent='Pick your school.';return}
   if(!N.value){M.textContent='Pick your name.';return}
   function fin(id,name){HW.set({school:sc,id:id,name:name});HW.load(function(){cb(W)})}
   if(N.value==='__new'){var nm=document.getElementById('hw_nn').value.trim();if(nm.length<3){M.textContent='Type your first and last name.';return}
    api('staff_add_pending',{school:sc,name:nm}).then(function(j){fin(j.id,j.name)}).catch(function(e){M.textContent=e.message||'Could not add the name.'})}
   else fin(N.value,N.options[N.selectedIndex].text)}},
 /* small "Training for: X  (not you? switch)" bar */
 bar:function(sw){if(!W)return'';return'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#eef6ff;border:1px solid #bcd6f5;border-radius:10px;padding:8px 12px;margin:8px 0"><span>Training for <b>'+esc(W.name)+'</b> · '+esc(W.school)+'</span><button onclick="'+sw+'" style="margin-left:auto;border:1px solid #bcd6f5;background:#fff;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer">Not me? Switch person</button></div>'},
 /* pop-up gate used by handbook modules inside other pages */
 modal:function(cb){if(W&&HW.ready){cb(W);return}if(W){HW.load(function(){cb(W)});return}
  var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:rgba(40,30,20,.55);z-index:9999;overflow:auto;padding:16px';var b=document.createElement('div');b.style.cssText='max-width:520px;margin:6vh auto;background:#fff;border-radius:16px;padding:6px 12px';o.appendChild(b);document.body.appendChild(o);
  HW.gate(b,function(w){o.remove();cb(w)});
  var x=document.createElement('button');x.textContent='Cancel';x.style.cssText='margin:0 0 12px 12px;border:1px solid #eadfce;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer';x.onclick=function(){o.remove()};b.appendChild(x)}
};
window.HW=HW;
})();
