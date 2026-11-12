/* Parent Portal: "Send Us a Document" card + pop-up. Sends to files-api.php (pp_doc_send). Parent-only; the director checks it in Parent Uploads. */
(function(){
  var TYPES=[['imm','Immunization record (DH 680 / 681)'],['phys','Physical exam (DH 3040)'],['pid','Parent ID copy'],['allg','Allergy / special needs care plan'],['dmed','Medical statement / dietary request'],['medauth','Medication authorization'],['elcpay','ELC / School Readiness payment certificate'],['elc','Other ELC / 4C paperwork'],['fr','Free & reduced meal application'],['cust','Custody / court papers'],['other','Something else']];
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var box=document.getElementById('docsBox'); if(!box) return;
  var pin=sessionStorage.getItem('hivePin')||'';
  var STAFF=['director','teacher','owner'].indexOf(sessionStorage.getItem('hiveRole')||'')>-1;
  box.innerHTML='<div class="result" style="border-top-color:#00838f"><h2>📤 Send Us a Document</h2>'+
    '<div class="note">Need to get us a form, a doctor\'s paper, or a copy of an ID? Send it here and it goes straight to the director to put in your child\'s file. You can take a photo with your phone or choose a file.</div>'+
    '<button class="go g1" id="docOpen" style="border:0;cursor:pointer;width:100%">📎 Send a document</button>'+
    (STAFF?'<div class="note" style="margin-top:10px">Staff view: families see the same button. Uploads are reviewed in Parent Uploads on the director dashboard.</div>':'')+
    '<div class="note" style="margin-top:12px;font-size:.9rem">Please do not send anything through the portal that is not for your own child. Documents are private and only the school director can see them.</div></div>';
  function close(){var m=document.getElementById('docModal'); if(m) m.remove();}
  var REQ=null;
  function open(rq){
    REQ=(rq&&rq.id)?rq:null; close();
    var m=document.createElement('div'); m.id='docModal';
    m.style.cssText='position:fixed;inset:0;background:rgba(40,30,20,.6);z-index:9998;display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto';
    var opts=TYPES.map(function(t){return '<option value="'+t[0]+'">'+esc(t[1])+'</option>';}).join('');
    var lbl='display:block;font-weight:800;margin:12px 0 4px;color:#4a3a30';
    m.innerHTML='<div style="background:#fff;border-radius:20px;max-width:480px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.35);font-family:inherit;max-height:96vh;overflow:auto">'+
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;color:#00838f">📤 Send a Document</h2><button id="dmX" style="border:0;background:#eee;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer" aria-label="Close">✕</button></div>'+
      '<div id="dmForm">'+
      '<label style="'+lbl+'">Your name</label><input class="inp" id="dmParent" autocomplete="name">'+
      '<label style="'+lbl+'">Your child\'s name</label><input class="inp" id="dmChild" placeholder="First and last name">'+
      '<label style="'+lbl+'">Which document is it?</label><select class="inp" id="dmDoc">'+opts+'</select>'+
      '<div id="dmOtherWrap" style="display:none"><label style="'+lbl+'">What is it called?</label><input class="inp" id="dmOther" placeholder="Example: doctor\'s note"></div>'+
      '<label style="'+lbl+'">Take a photo or choose a file</label><input type="file" id="dmFile" accept="image/*,application/pdf" style="width:100%;padding:10px;border:3px dashed #00838f;border-radius:14px;background:#f2fafb">'+
      '<div class="note" style="font-size:.85rem;margin-top:6px">A photo (JPG or PNG) or a PDF. For several pages, send one page at a time.</div>'+
      '<div id="dmErr" style="color:#b71c1c;font-weight:800;margin-top:8px"></div>'+
      '<button class="go g1" id="dmSend" style="border:0;cursor:pointer;width:100%;margin-top:10px">Send to the school</button></div>'+
      '<div id="dmDone" style="display:none;text-align:center;padding:10px 0"><div style="font-size:3rem">✅</div><h3 style="color:#2e7d32;margin:6px 0">We got it. Thank you!</h3><div class="note">The director will check it and put it in your child\'s file.</div>'+
      '<button class="go g1" id="dmMore" style="border:0;cursor:pointer;width:100%;margin-top:10px">Send another page</button><button id="dmClose" style="border:0;background:#eee;border-radius:12px;padding:12px;width:100%;margin-top:8px;font-weight:800;cursor:pointer">Done</button></div></div>';
    document.body.appendChild(m);
    var $=function(i){return document.getElementById(i);};
    try{var w=JSON.parse(localStorage.getItem('pl_who')||'{}'); if(w.parent)$('dmParent').value=w.parent; if(w.child)$('dmChild').value=w.child;}catch(e){}
    $('dmX').onclick=close; $('dmClose').onclick=close;
    m.addEventListener('click',function(e){if(e.target===m)close();});
    $('dmDoc').onchange=function(){$('dmOtherWrap').style.display=this.value==='other'?'block':'none';};
    $('dmMore').onclick=function(){$('dmDone').style.display='none';$('dmForm').style.display='block';$('dmFile').value='';$('dmErr').textContent='';};
    $('dmSend').onclick=function(){send();};
    if(REQ){ $('dmChild').value=REQ.child; $('dmChild').readOnly=true; $('dmDoc').innerHTML='<option value="'+esc(REQ.doc)+'">'+esc(REQ.label)+'</option>'; $('dmDoc').disabled=true; }
  }
  function toB64(file){
    return new Promise(function(res,rej){
      if(/^image\//.test(file.type)){
        var img=new Image(), u=URL.createObjectURL(file);
        img.onload=function(){var max=2200,w=img.width,h=img.height,k=Math.min(1,max/Math.max(w,h));var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.85).split(',')[1]);};
        img.onerror=function(){URL.revokeObjectURL(u);rej(new Error('We could not read that photo. Please take it again, or send a PDF.'));};
        img.src=u;
      } else if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
        var r=new FileReader(); r.onload=function(){res(String(r.result).split(',')[1]);}; r.onerror=function(){rej(new Error('We could not read that file.'));}; r.readAsDataURL(file);
      } else rej(new Error('Please choose a photo or a PDF.'));
    });
  }
  async function send(){
    var $=function(i){return document.getElementById(i);}, err=$('dmErr'); err.textContent='';
    var parent=$('dmParent').value.trim(), child=$('dmChild').value.trim(), doc=$('dmDoc').value, other=($('dmOther')||{value:''}).value.trim(), f=$('dmFile').files[0]; if(REQ){other='x';}
    if(!parent){err.textContent='Please type your name.';return;} if(!child){err.textContent='Please type your child\'s name.';return;}
    if(doc==='other'&&!other){err.textContent='Please type what the document is called.';return;} if(!f){err.textContent='Please choose a file or take a photo.';return;}
    var btn=$('dmSend'); btn.disabled=true; btn.textContent='Sending…';
    try{
      var b64=await toB64(f);
      var r=await fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin,action:'pp_doc_send',parent:parent,child:child,doc:doc,other:other,req:(REQ?REQ.id:''),b64:b64,name:f.name})});
      var j=await r.json(); if(j.error) throw new Error(j.error);
      try{localStorage.setItem('pl_who',JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('pl_who')||'{}'),{parent:parent,child:child})));}catch(e){}
      $('dmForm').style.display='none'; $('dmDone').style.display='block'; if(REQ&&window.PP_REQ_REFRESH) setTimeout(window.PP_REQ_REFRESH,300);
    }catch(e){err.textContent=e.message||'Something went wrong. Please try again.';}
    btn.disabled=false; btn.textContent='Send to the school';
  }
  document.getElementById('docOpen').onclick=function(){open();};
  async function loadReqs(){
    if(STAFF) return;
    try{
      var r=await fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin,action:'pp_req_list'})}); var j=await r.json(); if(j.error||!j.requests) return;
      var old=document.getElementById('reqBanner'); if(old) old.remove(); if(!j.requests.length) return;
      var d=document.createElement('div'); d.id='reqBanner'; d.style.cssText='max-width:820px;margin:10px auto;padding:14px 16px;background:#fff6e0;border:3px solid #d9a521;border-radius:16px;color:#3a2600';
      d.innerHTML='<div style="font-weight:800;font-size:1.1rem">📄 The office needs a document from you</div><div style="margin:4px 0 8px;font-size:.95rem">Please upload it here. Tap the one for your child.</div>'+j.requests.map(function(q,i){return '<button type="button" data-i="'+i+'" style="display:block;width:100%;text-align:left;margin:6px 0;padding:12px 14px;border:0;border-radius:12px;background:#d9a521;color:#3a2600;font-weight:800;font-size:1rem;cursor:pointer">'+esc(q.child)+': '+esc(q.label)+(q.note?'<span style="display:block;font-weight:400;font-size:.85rem">'+esc(q.note)+'</span>':'')+' &rarr; Upload</button>';}).join('');
      var host=document.querySelector('.sub'); (host&&host.parentNode?host.parentNode:document.body).insertBefore(d,host?host.nextSibling:document.body.firstChild);
      d.querySelectorAll('button').forEach(function(b){b.onclick=function(){open(j.requests[+b.getAttribute('data-i')]);};});
    }catch(e){}
  }
  setTimeout(loadReqs,600); window.PP_REQ_REFRESH=loadReqs;
})();
