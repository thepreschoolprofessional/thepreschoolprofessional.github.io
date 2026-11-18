/* Child photo and allergy card sent from a phone or tablet (11/17/26). Shared by room.html and pack.html. Nothing is filed here: it goes to Parent Uploads for a director to check. */
(function(){
var CSS='.pu .box{background:#fff;border-radius:14px;padding:14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.12)}.pu label{display:block;font-weight:700;margin:10px 0 4px}.pu select,.pu input[type=text]{width:100%;font-size:18px;padding:10px;border:2px solid #bbb;border-radius:10px;box-sizing:border-box}.pu .pick{display:flex;gap:8px;flex-wrap:wrap}.pu .pick button{flex:1;min-width:130px;font-size:17px;font-weight:800;padding:14px 8px;border:2px solid #bbb;border-radius:12px;background:#f4f4f4}.pu .pick button.on{background:#2e7d4f;color:#fff;border-color:#2e7d4f}.pu .btn{border:0;border-radius:12px;padding:15px 18px;font-size:18px;font-weight:800;background:#355c9a;color:#fff;width:100%;margin-top:10px}.pu .btn.g{background:#2e7d4f}.pu .err{color:#b00;font-weight:700;min-height:22px}.pu .ok{color:#1b7a3d;font-weight:800}.pu img.pv{max-width:100%;border-radius:10px;margin-top:8px}.pu .sub{color:#555;font-size:14px}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
window.PhotoUI={mount:function(el,o){
 if(!document.getElementById('pu-css')){var s=document.createElement('style');s.id='pu-css';s.textContent=CSS;document.head.appendChild(s)}
 var st={kids:[],kind:'face',b64:'',msg:'',name:'',child:''};
 function api(a,x){x=x||{};x.act=a;x.r=o.room||'';return o.post(x)}
 function draw(){
  el.innerHTML='<div class="pu"><div class="box"><h2 style="margin:0 0 4px">Child photo and allergy card</h2><div class="sub">Take the picture with this phone or tablet. It goes to the director to check and file in the child\'s file.</div>'
  +'<label>Your name</label><input type="text" id="pu-n" maxlength="60" value="'+esc(st.name)+'">'
  +'<label>Child</label><select id="pu-c"><option value="">Pick a child</option>'+st.kids.map(function(k){return'<option'+(k.n===st.child?' selected':'')+'>'+esc(k.n)+'</option>'}).join('')+'</select>'
  +'<label>What are you sending?</label><div class="pick" id="pu-k"><button type="button" data-v="face" class="'+(st.kind==='face'?'on':'')+'">Child photo</button><button type="button" data-v="allg" class="'+(st.kind==='allg'?'on':'')+'">Allergy card</button><button type="button" data-v="medauth" class="'+(st.kind==='medauth'?'on':'')+'">Medication form</button></div>'
  +'<div class="sub" style="margin-top:6px">'+(st.kind==='face'?'A clear picture of the face, looking at the camera.':'Lay the paper flat, in good light, and make sure every word can be read.')+'</div>'
  +'<label>Take or choose the picture</label><input type="file" id="pu-f" accept="image/*"'+(st.kind==='face'?' capture="user"':' capture="environment"')+'>'
  +(st.b64?'<img class="pv" src="data:image/jpeg;base64,'+st.b64+'">':'')
  +'<div class="err" id="pu-e">'+esc(st.err||'')+'</div><div class="ok">'+esc(st.msg)+'</div>'
  +'<button class="btn g" id="pu-s">Send to the director</button></div></div>';
  function grab(){st.name=el.querySelector('#pu-n').value.trim();st.child=el.querySelector('#pu-c').value}
  [].forEach.call(el.querySelectorAll('#pu-k button'),function(b){b.onclick=function(){grab();st.kind=b.getAttribute('data-v');st.b64='';st.msg='';st.err='';draw()}});
  el.querySelector('#pu-f').onchange=function(){grab();var f=this.files&&this.files[0];if(!f)return;var im=new Image(),u=URL.createObjectURL(f);
   im.onload=function(){var M=1600,sc=Math.min(1,M/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*sc);cv.height=Math.round(im.height*sc);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);st.b64=cv.toDataURL('image/jpeg',0.82).split(',')[1];st.msg='';st.err='';draw()};
   im.onerror=function(){st.err='That picture could not be opened. Try again.';draw()};im.src=u};
  el.querySelector('#pu-s').onclick=function(){grab();var b=this;st.err='';
   if(!st.name){st.err='Type your name.'}else if(!st.child){st.err='Pick the child.'}else if(!st.b64){st.err='Take the picture first.'}
   if(st.err){draw();return}
   b.disabled=true;b.textContent='Sending...';
   api('ph_send',{name:st.name,child:st.child,kind:st.kind,b64:st.b64}).then(function(r){if(r&&r.ok){st.b64='';st.msg='Sent. The director will check it and file it. You can send another.';st.err='';st.child=''}else{st.err=(r&&r.error)||'Did not send. Try again.'}draw()}).catch(function(){st.err='No connection. Try again.';draw()})};
 }
 el.innerHTML='<div class="pu"><div class="box">Loading children...</div></div>';
 api('ph_kids').then(function(r){st.kids=r.kids||[];draw()}).catch(function(){el.innerHTML='<div class="pu"><div class="box err">Could not load the children. Check your connection.</div></div>'});
}};
})();
