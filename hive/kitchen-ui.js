/* Kitchen sanitizer log and monthly menu chart (11/17/26). Shared by pack.html. */
(function(){
var CSS='.ku .box{background:#fff;border-radius:14px;padding:14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.12)}.ku label{display:block;font-weight:700;margin:10px 0 4px}.ku select,.ku input[type=text],.ku input[type=number],.ku input[type=time],.ku textarea{width:100%;font-size:18px;padding:10px;border:2px solid #bbb;border-radius:10px;box-sizing:border-box;font-family:inherit}.ku .pick{display:flex;gap:8px;flex-wrap:wrap}.ku .pick button{flex:1;min-width:130px;font-size:16px;font-weight:800;padding:12px 8px;border:2px solid #bbb;border-radius:12px;background:#f4f4f4}.ku .pick button.on{background:#2e7d4f;color:#fff;border-color:#2e7d4f}.ku .btn{border:0;border-radius:12px;padding:15px 18px;font-size:18px;font-weight:800;background:#355c9a;color:#fff;width:100%;margin-top:10px}.ku .btn.g{background:#2e7d4f}.ku .btn.s{background:#777;margin-top:6px;font-size:15px;padding:11px}.ku .err{color:#b00;font-weight:700;min-height:22px}.ku .ok{color:#1b7a3d;font-weight:800}.ku .sub{color:#555;font-size:14px}.ku .bad{background:#fde8e6;border:2px solid #d33;border-radius:10px;padding:8px;margin:8px 0;font-weight:700;color:#a11}.ku table{width:100%;border-collapse:collapse;font-size:14px}.ku td,.ku th{border:1px solid #ccc;padding:5px;text-align:left;vertical-align:top}.ku tr.o td{background:#fde8e6}.ku .day{border:2px solid #ddd;border-radius:12px;padding:10px;margin:8px 0}.ku .day.t{border-color:#355c9a}.ku .day h4{margin:0 0 6px}.ku .row2{display:flex;gap:8px;align-items:center}.ku .row2 input[type=checkbox]{width:26px;height:26px}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function css(){if(!document.getElementById('ku-css')){var s=document.createElement('style');s.id='ku-css';s.textContent=CSS;document.head.appendChild(s)}}
function now12(){var d=new Date(),h=d.getHours(),m=d.getMinutes();return(h%12||12)+':'+(m<10?'0':'')+m+' '+(h<12?'AM':'PM')}
function nice(d){var p=d.split('-');return +p[1]+'/'+(+p[2])+'/'+p[0]}
var RANGES={'Quat (quaternary ammonium)':[200,400],'Chlorine (bleach)':[50,100]};
window.KitchenUI={
mountSan:function(el,o){css();
 var st={type:'Quat (quaternary ammonium)',list:null,msg:'',err:'',inr:true};
 function ld(){o.post({act:'san_list'}).then(function(r){st.list=r.list||[];draw()}).catch(function(){st.list=[];draw()})}
 function draw(){
  var rg=RANGES[st.type],h='<div class="ku"><div class="box"><h3 style="margin:0 0 4px">Sanitizer test strip log</h3><div class="sub">Test the sanitizer water with a strip, then write the number here.</div>';
  h+='<label>Your name</label><input type="text" id="ksn" value="'+esc(st.name||'')+'">';
  h+='<label>Where did you test?</label><select id="ksa">'+['Kitchen sanitizer bucket','Three-compartment sink','Classroom spray bottle','Table-wipe bucket','Bathroom','Other'].map(function(a){return'<option'+(st.area===a?' selected':'')+'>'+a+'</option>'}).join('')+'</select>';
  h+='<label>Sanitizer</label><div class="pick">'+['Quat (quaternary ammonium)','Chlorine (bleach)','Other'].map(function(t){return'<button class="'+(st.type===t?'on':'')+'" data-t="'+esc(t)+'">'+esc(t)+'</button>'}).join('')+'</div>';
  if(rg)h+='<div class="sub" style="margin-top:6px">Safe range: '+rg[0]+' to '+rg[1]+' ppm</div>';
  else h+='<label>Safe range on the label</label><input type="text" id="ksr" placeholder="example: 100 to 200 ppm" value="'+esc(st.range||'')+'"><div class="row2" style="margin-top:8px"><input type="checkbox" id="ksi"'+(st.inr?' checked':'')+'><b>Reading is in the safe range</b></div>';
  h+='<label>Test strip reading (ppm)</label><input type="number" id="ksp" inputmode="numeric" value="'+esc(st.ppm||'')+'">';
  h+='<div id="ksw"></div><label>If it was off: what did you do?</label><input type="text" id="ksx" placeholder="remixed, tested again, now 250" value="'+esc(st.act||'')+'">';
  h+='<div class="err">'+esc(st.err)+'</div><div class="ok">'+esc(st.msg)+'</div><button class="btn g" id="kss">Save reading</button></div>';
  h+='<div class="box"><h3 style="margin:0 0 6px">Last 31 days</h3>';
  if(st.list===null)h+='<div class="sub">Loading...</div>';else if(!st.list.length)h+='<div class="sub">No readings yet.</div>';
  else{h+='<table><tr><th>Date</th><th>Time</th><th>Where</th><th>ppm</th><th>By</th></tr>'+st.list.map(function(x){return'<tr class="'+(x.ok?'':'o')+'"><td>'+nice(x.date)+'</td><td>'+esc(x.time)+'</td><td>'+esc(x.area)+'<br><span class="sub">'+esc(x.type)+'</span></td><td>'+esc(x.ppm)+(x.ok?'':'<br>OUT'+(x.action?': '+esc(x.action):''))+'</td><td>'+esc(x.by)+'</td></tr>'}).join('')+'</table>';h+='<button class="btn s" id="ksp2">Print this log</button>'}
  h+='</div></div>';el.innerHTML=h;
  var $=function(i){return el.querySelector('#'+i)};
  [].forEach.call(el.querySelectorAll('.pick button'),function(b){b.onclick=function(){keep();st.type=b.getAttribute('data-t');draw()}});
  function keep(){st.name=$('ksn').value;st.area=$('ksa').value;st.ppm=$('ksp').value;st.act=$('ksx').value;if($('ksr')){st.range=$('ksr').value;st.inr=$('ksi').checked}}
  var pp=$('ksp');pp.oninput=function(){var v=+pp.value,w=$('ksw');if(rg&&pp.value!==''&&(v<rg[0]||v>rg[1]))w.innerHTML='<div class="bad">Outside the safe range ('+rg[0]+' to '+rg[1]+'). Remix, test again and write what you did below.</div>';else w.innerHTML=''};pp.oninput();
  $('kss').onclick=function(){keep();st.err='';st.msg='';
   if(!st.name.trim()||st.ppm===''){st.err='Type your name and the strip reading.';draw();return}
   $('kss').disabled=true;$('kss').textContent='Saving...';
   o.post({act:'san_add',name:st.name,area:st.area,type:st.type,ppm:+st.ppm,time:now12(),action:st.act,range:st.range||'',inrange:st.inr?1:0}).then(function(r){
    if(r&&r.ok){st.msg=r.inrange?'Saved. In the safe range.':'Saved. Reading was outside the safe range.';st.ppm='';st.act='';ld()}else{st.err=(r&&r.error)||'Did not save.';}draw()}).catch(function(){st.err='No connection. Try again.';draw()})};
  var pr=$('ksp2');if(pr)pr.onclick=function(){var w=window.open('','_blank');if(!w)return;w.document.write('<html><head><title>Sanitizer Log</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:5px;font-size:12px}</style></head><body><h2>Sanitizer Test Strip Log</h2><table><tr><th>Date</th><th>Time</th><th>Where</th><th>Sanitizer</th><th>Range</th><th>ppm</th><th>In range</th><th>Action</th><th>By</th></tr>'+st.list.map(function(x){return'<tr><td>'+nice(x.date)+'</td><td>'+esc(x.time)+'</td><td>'+esc(x.area)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.range)+'</td><td>'+esc(x.ppm)+'</td><td>'+(x.ok?'Yes':'NO')+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.by)+'</td></tr>'}).join('')+'</table></body></html>');w.document.close();w.focus();w.print()};
 }
 draw();ld();
},
mountMenu:function(el,o){css();
 var d0=new Date(),st={month:d0.getFullYear()+'-'+('0'+(d0.getMonth()+1)).slice(-2),days:{},name:'',msg:'',err:''};
 function wk(m){var p=m.split('-'),y=+p[0],mo=+p[1]-1,out=[],n=new Date(y,mo+1,0).getDate();for(var i=1;i<=n;i++){var g=new Date(y,mo,i).getDay();if(g>0&&g<6)out.push(m+'-'+('0'+i).slice(-2))}return out}
 function shift(k){var p=st.month.split('-'),d=new Date(+p[0],+p[1]-1+k,1);st.month=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);ld()}
 function ld(){st.days=null;st.msg='';st.err='';draw();o.post({act:'menu_get',month:st.month}).then(function(r){st.days=(r&&r.days)||{};draw()}).catch(function(){st.days={};st.err='Could not load.';draw()})}
 function grab(){if(!st.days)return;[].forEach.call(el.querySelectorAll('.day'),function(c){var dt=c.getAttribute('data-d');st.days[dt]={b:c.querySelector('.b').value,l:c.querySelector('.l').value,s:c.querySelector('.s').value,served:c.querySelector('.sv').checked,chg:c.querySelector('.c').value}});var n=el.querySelector('#kmn');if(n)st.name=n.value}
 function mname(m){var p=m.split('-');return['January','February','March','April','May','June','July','August','September','October','November','December'][+p[1]-1]+' '+p[0]}
 function draw(){
  var today=d0.getFullYear()+'-'+('0'+(d0.getMonth()+1)).slice(-2)+'-'+('0'+d0.getDate()).slice(-2);
  var h='<div class="ku"><div class="box"><div class="row2"><button class="btn s" id="kmp" style="margin:0">&larr;</button><h3 style="margin:0;flex:1;text-align:center">'+mname(st.month)+' Menu</h3><button class="btn s" id="kmn2" style="margin:0">&rarr;</button></div>';
  if(st.days===null)h+='<div class="sub">Loading...</div>';else{
   h+='<div class="sub">Type what is planned for each day. After the meal, check Served as planned, or write what changed.</div><label>Your name</label><input type="text" id="kmn" value="'+esc(st.name)+'">';
   wk(st.month).forEach(function(dt){var x=st.days[dt]||{},p=dt.split('-'),w=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(+p[0],+p[1]-1,+p[2]).getDay()];
    h+='<div class="day'+(dt===today?' t':'')+'" data-d="'+dt+'"><h4>'+w+' '+(+p[1])+'/'+(+p[2])+(dt===today?' (today)':'')+'</h4><input type="text" class="b" placeholder="Breakfast" value="'+esc(x.b)+'" style="margin-bottom:6px"><input type="text" class="l" placeholder="Lunch" value="'+esc(x.l)+'" style="margin-bottom:6px"><input type="text" class="s" placeholder="Snack" value="'+esc(x.s)+'" style="margin-bottom:6px"><div class="row2"><input type="checkbox" class="sv"'+(x.served?' checked':'')+'><b>Served as planned</b></div><input type="text" class="c" placeholder="What changed (if anything)" value="'+esc(x.chg)+'" style="margin-top:6px"></div>'});
   h+='<div class="err">'+esc(st.err)+'</div><div class="ok">'+esc(st.msg)+'</div><button class="btn g" id="kms">Save this month</button><button class="btn s" id="kmpr">Print the menu chart</button>'}
  h+='</div></div>';el.innerHTML=h;
  el.querySelector('#kmp').onclick=function(){grab();shift(-1)};el.querySelector('#kmn2').onclick=function(){grab();shift(1)};
  var sv=el.querySelector('#kms');if(sv){sv.onclick=function(){grab();st.err='';st.msg='';if(!st.name.trim()){st.err='Type your name first.';draw();return}
   var arr=Object.keys(st.days).map(function(k){var x=st.days[k];return{date:k,b:x.b,l:x.l,s:x.s,served:x.served?1:0,chg:x.chg}});
   sv.disabled=true;sv.textContent='Saving...';
   o.post({act:'menu_save',month:st.month,name:st.name,days:arr}).then(function(r){if(r&&r.ok)st.msg='Saved '+r.n+' days.';else st.err=(r&&r.error)||'Did not save.';draw()}).catch(function(){st.err='No connection. Try again.';draw()})};
   el.querySelector('#kmpr').onclick=function(){grab();var w=window.open('','_blank');if(!w)return;
    w.document.write('<html><head><title>Menu</title><style>body{font-family:Arial;padding:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:5px;font-size:12px;vertical-align:top}</style></head><body><h2>'+esc(o.school||'')+' - '+mname(st.month)+' Menu</h2><table><tr><th>Date</th><th>Breakfast</th><th>Lunch</th><th>Snack</th><th>Served</th><th>Changes</th></tr>'+wk(st.month).map(function(dt){var x=st.days[dt]||{},p=dt.split('-');return'<tr><td>'+(+p[1])+'/'+(+p[2])+'</td><td>'+esc(x.b)+'</td><td>'+esc(x.l)+'</td><td>'+esc(x.s)+'</td><td>'+(x.served?'Yes':'')+'</td><td>'+esc(x.chg)+'</td></tr>'}).join('')+'</table></body></html>');w.document.close();w.focus();w.print()}}
 }
 ld();
}};
})();
