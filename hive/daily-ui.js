/* Infant / toddler daily sheet, teacher side (11/17/26). */
(function(){
var CSS='.dsu .box{background:#fff;border-radius:14px;padding:14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.12)}.dsu label{display:block;font-weight:700;margin:10px 0 4px}.dsu select,.dsu input[type=text],.dsu textarea{width:100%;font-size:18px;padding:10px;border:2px solid #bbb;border-radius:10px;box-sizing:border-box;font-family:inherit}.dsu .k{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.dsu .k button{font-size:17px;font-weight:800;padding:14px 6px;border:2px solid #bbb;border-radius:12px;background:#f4f4f4}.dsu .k button.on{background:#2e7d4f;color:#fff;border-color:#2e7d4f}.dsu .btn{border:0;border-radius:12px;padding:15px 18px;font-size:18px;font-weight:800;background:#2e7d4f;color:#fff;width:100%;margin-top:10px}.dsu .err{color:#b00;font-weight:700;min-height:22px}.dsu .ok{color:#1b7a3d;font-weight:800}.dsu .sub{color:#555;font-size:14px}.dsu .it{border-top:1px solid #ddd;padding:6px 0}';
var KINDS=[['bottle','🍼 Bottle'],['food','🥣 Food'],['nap','😴 Fell asleep'],['wake','☀️ Woke up'],['diaper','🧷 Diaper'],['mood','😊 Mood'],['activity','🎨 Activity'],['other','📝 Other']];
var HINT={bottle:'how many oz',food:'what they ate and how much',nap:'',wake:'',diaper:'wet, BM, or both',mood:'happy, fussy, tired...',activity:'what they did',other:'what happened'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function now12(){var d=new Date(),h=d.getHours(),m=d.getMinutes();return(h%12||12)+':'+(m<10?'0':'')+m+' '+(h<12?'AM':'PM')}
window.DailyUI={KINDS:KINDS,mount:function(el,o){
 if(!document.getElementById('dsu-css')){var s=document.createElement('style');s.id='dsu-css';s.textContent=CSS;document.head.appendChild(s)}
 var st={kids:[],child:'',name:'',kind:'bottle',detail:'',time:'',ents:null,bear:'',parent:'',err:'',msg:''};
 function keep(){var g=function(i){var e=el.querySelector('#'+i);return e?e.value:null};var v;if((v=g('dsn'))!==null)st.name=v;if((v=g('dsc'))!==null)st.child=v;if((v=g('dsd'))!==null)st.detail=v;if((v=g('dst'))!==null)st.time=v;if((v=g('dsb'))!==null)st.bear=v}
 function ld(){if(!st.child){st.ents=null;draw();return}o.post({act:'ds_get',child:st.child}).then(function(r){st.ents=r.entries||[];st.bear=r.bear||'';st.parent=r.parent||'';draw()}).catch(function(){st.ents=[];draw()})}
 function draw(){
  var h='<div class="dsu"><div class="box"><h3 style="margin:0 0 4px">Daily sheet</h3><div class="sub">Parents see this at the Bear Line when they sign out.</div><label>Your name</label><input type="text" id="dsn" value="'+esc(st.name)+'"><label>Child</label><select id="dsc"><option value="">Pick a child</option>'+st.kids.map(function(k){return'<option'+(st.child===k.n?' selected':'')+'>'+esc(k.n)+'</option>'}).join('')+'</select></div>';
  if(st.child){
   h+='<div class="box"><div class="k">'+KINDS.map(function(k){return'<button data-k="'+k[0]+'" class="'+(st.kind===k[0]?'on':'')+'">'+k[1]+'</button>'}).join('')+'</div>';
   h+='<label>Details'+(HINT[st.kind]?' ('+HINT[st.kind]+')':'')+'</label><input type="text" id="dsd" value="'+esc(st.detail)+'"><label>Time (leave blank for right now)</label><input type="text" id="dst" placeholder="'+now12()+'" value="'+esc(st.time)+'"><div class="err">'+esc(st.err)+'</div><div class="ok">'+esc(st.msg)+'</div><button class="btn" id="dsa">Add to today</button></div>';
   h+='<div class="box"><h3 style="margin:0 0 6px">Today so far</h3>'+(st.ents===null?'<div class="sub">Loading...</div>':!st.ents.length?'<div class="sub">Nothing yet.</div>':st.ents.map(function(e){var kk=KINDS.filter(function(k){return k[0]===e.k})[0];return'<div class="it"><b>'+esc(e.t)+'</b> '+(kk?kk[1]:'')+' '+esc(e.d)+' <span class="sub">'+esc(e.by)+'</span></div>'}).join(''))+'</div>';
   h+='<div class="box"><h3 style="margin:0 0 4px">Bear Notes for the parent</h3><div class="sub">A short happy note about the day.</div><textarea id="dsb" style="min-height:80px">'+esc(st.bear)+'</textarea><button class="btn" id="dsbn" style="background:#355c9a">Save Bear Notes</button>'+(st.parent?'<div style="margin-top:10px;background:#fff6dc;padding:8px;border-radius:10px"><b>Parent wrote:</b> '+esc(st.parent)+'</div>':'')+'</div>'}
  h+='</div>';el.innerHTML=h;
  el.querySelector('#dsc').onchange=function(){keep();st.err='';st.msg='';ld()};
  [].forEach.call(el.querySelectorAll('.k button'),function(b){b.onclick=function(){keep();st.kind=b.getAttribute('data-k');draw()}});
  var a=el.querySelector('#dsa');if(a)a.onclick=function(){keep();st.err='';st.msg='';if(!st.name.trim()){st.err='Type your name first.';draw();return}
   a.disabled=true;a.textContent='Saving...';o.post({act:'ds_add',child:st.child,name:st.name,kind:st.kind,detail:st.detail,time:st.time.trim()||now12(),room:o.room||''}).then(function(r){if(r&&r.ok){st.msg='Added.';st.detail='';st.time='';ld()}else{st.err=(r&&r.error)||'Did not save.';draw()}}).catch(function(){st.err='No connection. Try again.';draw()})};
  var b=el.querySelector('#dsbn');if(b)b.onclick=function(){keep();if(!st.name.trim()){st.err='Type your name first.';draw();return}b.disabled=true;o.post({act:'ds_note',child:st.child,name:st.name,bear:st.bear,room:o.room||''}).then(function(r){st.msg=r&&r.ok?'Bear Notes saved.':((r&&r.error)||'Did not save.');draw()}).catch(function(){st.err='No connection.';draw()})};
 }
 draw();o.post({act:'inc_kids',all:1,r:o.room||''}).then(function(r){st.kids=r.kids||[];draw()});
}};
})();
