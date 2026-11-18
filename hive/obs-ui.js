/* Child observations (11/17/26). Classroom pack. */
(function(){
var CSS='.ob .box{background:#fff;border-radius:14px;padding:14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.12)}.ob label{display:block;font-weight:700;margin:10px 0 4px}.ob select,.ob input[type=text],.ob textarea{width:100%;font-size:18px;padding:10px;border:2px solid #bbb;border-radius:10px;box-sizing:border-box;font-family:inherit}.ob textarea{min-height:90px}.ob .btn{border:0;border-radius:12px;padding:15px 18px;font-size:18px;font-weight:800;background:#2e7d4f;color:#fff;width:100%;margin-top:10px}.ob .err{color:#b00;font-weight:700;min-height:22px}.ob .ok{color:#1b7a3d;font-weight:800}.ob .sub{color:#555;font-size:14px}.ob .it{border-top:1px solid #ddd;padding:8px 0}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var DOM=['Social-Emotional','Language and Literacy','Math','Science','Fine Motor','Gross Motor','Art and Creativity','Self-Help','Other'];
window.ObsUI={mount:function(el,o){
 if(!document.getElementById('ob-css')){var s=document.createElement('style');s.id='ob-css';s.textContent=CSS;document.head.appendChild(s)}
 var st={kids:[],list:null,child:'',name:'',dom:DOM[0],obs:'',next:'',err:'',msg:''};
 function ld(){o.post({act:'obs_list'}).then(function(r){st.list=r.list||[];draw()}).catch(function(){st.list=[];draw()})}
 function keep(){var g=function(i){var e=el.querySelector('#'+i);return e?e.value:''};st.name=g('obn');st.child=g('obc');st.dom=g('obd');st.obs=g('obt');st.next=g('obx')}
 function draw(){
  var h='<div class="ob"><div class="box"><h3 style="margin:0 0 4px">New observation</h3><div class="sub">Write only what you saw and heard.</div><label>Your name</label><input type="text" id="obn" value="'+esc(st.name)+'"><label>Child</label><select id="obc"><option value="">Pick a child</option>'+st.kids.map(function(k){return'<option'+(st.child===k.n?' selected':'')+'>'+esc(k.n)+'</option>'}).join('')+'</select><label>Area</label><select id="obd">'+DOM.map(function(d){return'<option'+(st.dom===d?' selected':'')+'>'+d+'</option>'}).join('')+'</select><label>What did you see?</label><textarea id="obt">'+esc(st.obs)+'</textarea><label>Next step (optional)</label><input type="text" id="obx" value="'+esc(st.next)+'"><div class="err">'+esc(st.err)+'</div><div class="ok">'+esc(st.msg)+'</div><button class="btn" id="obs">Save observation</button></div>';
  h+='<div class="box"><h3 style="margin:0 0 6px">Recent observations</h3>';
  if(st.list===null)h+='<div class="sub">Loading...</div>';else if(!st.list.length)h+='<div class="sub">None yet.</div>';else h+=st.list.filter(function(x){return !st.kids.length||st.kids.some(function(k){return k.n===x.child})}).slice(0,40).map(function(x){return'<div class="it"><b>'+esc(x.child)+'</b> <span class="sub">'+esc(x.date)+' &middot; '+esc(x.domain)+' &middot; '+esc(x.by)+'</span><div>'+esc(x.obs)+'</div>'+(x.next?'<div class="sub">Next: '+esc(x.next)+'</div>':'')+'</div>'}).join('');
  h+='</div></div>';el.innerHTML=h;
  el.querySelector('#obs').onclick=function(){keep();st.err='';st.msg='';if(!st.name.trim()||!st.child||!st.obs.trim()){st.err='Name, child and what you saw are needed.';draw();return}
   var b=el.querySelector('#obs');b.disabled=true;b.textContent='Saving...';
   o.post({act:'obs_add',name:st.name,child:st.child,domain:st.dom,obs:st.obs,next:st.next,room:o.room||''}).then(function(r){if(r&&r.ok){st.msg='Saved.';st.obs='';st.next='';ld()}else{st.err=(r&&r.error)||'Did not save.'}draw()}).catch(function(){st.err='No connection. Try again.';draw()})};
 }
 draw();
 o.post({act:'inc_kids',all:1,r:o.room||''}).then(function(r){st.kids=r.kids||[];draw()});
 ld();
}};
})();
