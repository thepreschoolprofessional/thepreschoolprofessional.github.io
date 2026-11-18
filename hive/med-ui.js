/* Medication log (11/17/26). Classroom: give a dose and sign. Office: add an order from the parent's signed form. Director: approve, stop, print the 12-month log. */
(function(){
var CSS='.mu{font-family:inherit}.mu .box{background:#fff;border:1px solid #e3d9c4;border-radius:16px;padding:16px;margin:0 0 14px}.mu h2{margin:0 0 6px;font-size:20px}.mu .sub{color:#6b6252;font-size:14px;margin:0 0 10px}.mu label{display:block;font-weight:700;font-size:14px;margin:12px 0 4px}.mu input[type=text],.mu input[type=date],.mu select,.mu textarea{width:100%;font:inherit;font-size:16px;padding:11px;border:1px solid #cdbf9f;border-radius:10px;box-sizing:border-box;background:#fff}.mu textarea{min-height:60px}.mu .btn{font:inherit;font-weight:800;font-size:16px;border:0;border-radius:12px;padding:13px 20px;background:#e8730c;color:#fff;cursor:pointer;margin:6px 6px 0 0}.mu .btn.g{background:#2e8b57}.mu .btn.s{background:#efe6d2;color:#3a2f1c}.mu .btn.r{background:#b3261e}.mu .btn.big{display:block;width:100%;margin:12px 0 0}.mu .row{display:flex;gap:10px;flex-wrap:wrap}.mu .row>*{flex:1;min-width:140px}.mu .err{color:#b3261e;font-weight:700;margin:10px 0}.mu .ok{color:#1d7a43;font-weight:700;margin:10px 0}.mu .st{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:3px 10px;background:#fde7b0;color:#7a5200}.mu .st.c{background:#d6f0de;color:#1d6a3d}.mu .it{border:1px solid #e3d9c4;border-radius:14px;padding:12px 14px;margin:0 0 10px;background:#fffdf7}.mu .it p{margin:5px 0 0;font-size:14px}.mu canvas.sg{width:100%;height:140px;border:2px dashed #cdbf9f;border-radius:12px;background:#fff;touch-action:none;display:block}.mu .chk{display:flex;gap:10px;align-items:center;margin:12px 0}.mu .chk input{width:24px;height:24px}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fdate(d){if(!d)return '';var p=String(d).split('-');return p.length===3?(+p[1])+'/'+(+p[2])+'/'+p[0]:d}
function now12(){var d=new Date(),h=d.getHours(),m=d.getMinutes();return (h%12||12)+':'+('0'+m).slice(-2)+' '+(h>=12?'PM':'AM')}
window.MedUI={mount:function(el,o){
 if(!document.getElementById('mu-css')){var s=document.createElement('style');s.id='mu-css';s.textContent=CSS;document.head.appendChild(s)}
 var isDir=function(){return !!(o.dtok&&o.dtok())},classroom=!!o.room;
 var D={orders:[],doses:[]},KIDS=[],msg='';
 function api(a,x){x=x||{};x.act=a;x.r=o.room||'';if(o.dtok&&o.dtok())x.dtok=o.dtok();return o.post(x)}
 function root(h){el.innerHTML='<div class="mu">'+h+'</div>'}
 function load(){root('<div class="box">Loading...</div>');api('med_list').then(function(r){if(r.error){root('<div class="box err">'+esc(r.error)+'</div>');return}D.orders=r.orders||[];D.doses=r.doses||[];list()}).catch(function(){root('<div class="box err">Could not load. Check your connection.</div>')})}
 function dosesFor(oid){return D.doses.filter(function(d){return d.order===oid||false})}
 function list(){
  var h='';
  if(msg){h+='<div class="ok">'+esc(msg)+'</div>';msg=''}
  if(classroom){
   h+='<div class="box"><h2>Medicine today</h2><div class="sub">Only approved medicine for children in this room shows here. Give it, then sign. The parent signs at the sign-out screen.</div>';
   if(!D.orders.length)h+='<div class="sub">No medicine is ordered for this room today.</div>';
   D.orders.forEach(function(x,i){var gv=D.doses.filter(function(d){return d.child===x.child&&d.med===x.med});
    h+='<div class="it"><b>'+esc(x.child)+'</b> &middot; '+esc(x.med)+' &middot; '+esc(x.dose)+'<p>'+esc(x.how)+(x.times?' &middot; When: '+esc(x.times):'')+(x.reason?' &middot; For: '+esc(x.reason):'')+'</p>'+(x.notes?'<p>'+esc(x.notes)+'</p>':'')
    +gv.map(function(d){return '<p>&#10003; Given '+esc(d.time)+' ('+esc(d.dose)+') by '+esc(d.by)+' &middot; <span class="st '+(d.status==='Signed'?'c':'')+'">'+(d.status==='Signed'?'Parent signed':'Waiting for parent')+'</span></p>'}).join('')
    +'<button class="btn g" data-give="'+i+'">Give a dose</button></div>'});
   h+='</div>';
  }else{
   h+='<div class="box"><h2>Medication orders</h2><div class="sub">Add an order only after the parent has signed the medication form. '+(isDir()?'As director you can approve or stop an order.':'A director approves it before the classroom can give it.')+'</div><button class="btn g" id="mu-add">Add a medication order</button>';
   if(isDir())h+='<button class="btn s" id="mu-hist">Print a child\'s 12-month log</button>';
   h+='</div>';
   var wait=D.orders.filter(function(x){return x.status==='Needs Director'}),act=D.orders.filter(function(x){return x.status==='Active'});
   function card(x){var i=D.orders.indexOf(x);return '<div class="it"><b>'+esc(x.child)+'</b> ('+esc(x.room)+') &middot; '+esc(x.med)+' &middot; '+esc(x.dose)+' <span class="st '+(x.status==='Active'?'c':'')+'">'+(x.status==='Active'?'Approved':'Waiting for director')+'</span><p>'+esc(x.how)+' &middot; '+esc(x.times)+(x.reason?' &middot; For: '+esc(x.reason):'')+'</p><p>'+fdate(x.start)+(x.end?' to '+fdate(x.end):' (no end date)')+' &middot; Parent form signed by '+esc(x.auth)+' &middot; Entered by '+esc(x.by)+'</p>'
    +(isDir()?(x.status==='Needs Director'?'<button class="btn g" data-dec="ok" data-i="'+i+'">Approve</button>':'')+'<button class="btn r" data-dec="stop" data-i="'+i+'">Stop this order</button>':'')+'</div>'}
   h+='<div class="box"><h2>Waiting for a director ('+wait.length+')</h2>'+(wait.length?wait.map(card).join(''):'<div class="sub">None.</div>')+'</div>';
   h+='<div class="box"><h2>Approved orders ('+act.length+')</h2>'+(act.length?act.map(card).join(''):'<div class="sub">None.</div>')+'</div>';
   var tdy=D.doses;h+='<div class="box"><h2>Given today ('+tdy.length+')</h2>'+(tdy.length?tdy.map(function(d){return '<div class="it"><b>'+esc(d.child)+'</b> &middot; '+esc(d.med)+' '+esc(d.dose)+' at '+esc(d.time)+' by '+esc(d.by)+' &middot; <span class="st '+(d.status==='Signed'?'c':'')+'">'+(d.status==='Signed'?'Parent signed':'Waiting for parent')+'</span></div>'}).join(''):'<div class="sub">Nothing yet.</div>')+'</div>';
  }
  root(h);
  [].forEach.call(el.querySelectorAll('[data-give]'),function(b){b.onclick=function(){give(D.orders[+b.getAttribute('data-give')])}});
  [].forEach.call(el.querySelectorAll('[data-dec]'),function(b){b.onclick=function(){var x=D.orders[+b.getAttribute('data-i')],st=b.getAttribute('data-dec');if(st==='stop'&&!confirm('Stop this medicine order for '+x.child+'?'))return;api('med_order_decide',{id:x.id,decision:st,name:'Director'}).then(function(r){if(r.ok){msg=st==='stop'?'Order stopped.':'Order approved.';load()}else alert(r.error||'Did not save.')})}});
  var a=el.querySelector('#mu-add');if(a)a.onclick=addForm;var hb=el.querySelector('#mu-hist');if(hb)hb.onclick=histForm;
 }
 function give(x){
  root('<div class="box"><h2>Give medicine: '+esc(x.child)+'</h2><div class="sub">'+esc(x.med)+' &middot; ordered dose: '+esc(x.dose)+' &middot; '+esc(x.how)+' &middot; '+esc(x.times)+'</div>'
  +'<div class="row"><div><label>Your name</label><input type="text" id="g-n" maxlength="60"></div><div><label>Time given</label><input type="text" id="g-t" maxlength="20" value="'+now12()+'"></div></div>'
  +'<label>Dose actually given</label><input type="text" id="g-d" maxlength="80" value="'+esc(x.dose)+'"><label>Note (optional)</label><input type="text" id="g-o" maxlength="160" placeholder="Example: took it well">'
  +'<label>Your signature (finger)</label><canvas class="sg" id="g-sg"></canvas><div><a href="#" id="g-c">Clear</a></div><div class="err" id="g-e"></div><button class="btn g big" id="g-go">Save and sign</button><button class="btn s" id="g-b">Cancel</button></div>');
  var pad=IncidentUI.Pad(el.querySelector('#g-sg'));el.querySelector('#g-c').onclick=function(e){e.preventDefault();pad.clear()};el.querySelector('#g-b').onclick=function(){load()};
  el.querySelector('#g-go').onclick=function(){var b=this,v=function(i){return el.querySelector('#'+i).value.trim()},sig=pad.get(),er=el.querySelector('#g-e');er.textContent='';
   if(!v('g-n')||!v('g-t')||!v('g-d')||!sig){er.textContent='Type your name, the time, the dose, and sign in the box.';return}
   b.disabled=true;api('med_give',{id:x.id,name:v('g-n'),time:v('g-t'),dose:v('g-d'),note:v('g-o'),sig:sig}).then(function(r){if(r.ok){msg='Saved. The parent will sign it at sign-out.';load()}else{b.disabled=false;er.textContent=r.error||'Did not save.'}}).catch(function(){b.disabled=false;er.textContent='No connection. Try again.'})};
 }
 function addForm(){
  root('<div class="box" id="mu-l">Loading children...</div>');
  var go=KIDS.length?Promise.resolve():api('ph_kids').then(function(r){KIDS=r.kids||[]});
  go.then(function(){
   root('<div class="box"><h2>New medication order</h2><div class="warn" style="background:#fdf0cf;border-radius:10px;padding:10px;font-size:14px">Only enter this after the parent has signed the medication form (paper, or sent as a photo with Photo &amp; Allergy Card). Label must match the order.</div>'
   +'<label>Child</label><select id="a-c"><option value="">Pick a child</option>'+KIDS.map(function(k){return'<option>'+esc(k.n)+'</option>'}).join('')+'</select>'
   +'<label>Medicine name</label><input type="text" id="a-m" maxlength="100"><div class="row"><div><label>Dose</label><input type="text" id="a-d" maxlength="80" placeholder="Example: 5 ml"></div><div><label>How given</label><input type="text" id="a-h" maxlength="80" placeholder="By mouth, cream, inhaler"></div></div>'
   +'<label>When it is given</label><input type="text" id="a-t" maxlength="120" placeholder="Example: 12:00 PM with lunch, or as needed"><label>What it is for</label><input type="text" id="a-r" maxlength="120">'
   +'<div class="row"><div><label>First day</label><input type="date" id="a-s" value="'+esc(o.today||'')+'"></div><div><label>Last day (blank if ongoing)</label><input type="date" id="a-e"></div></div>'
   +'<label>Other notes (storage, side effects)</label><textarea id="a-n" maxlength="400"></textarea>'
   +'<label>Parent who signed the form</label><input type="text" id="a-p" maxlength="80"><div class="chk"><input type="checkbox" id="a-f"><label style="margin:0">The signed medication form is on file</label></div>'
   +'<label>Your name</label><input type="text" id="a-y" maxlength="60"><div class="err" id="a-e2"></div><button class="btn g big" id="a-go">Save order</button><button class="btn s" id="a-b">Cancel</button></div>');
   el.querySelector('#a-b').onclick=load;
   el.querySelector('#a-go').onclick=function(){var b=this,v=function(i){return el.querySelector('#'+i).value.trim()};
    b.disabled=true;api('med_order_add',{child:v('a-c'),med:v('a-m'),dose:v('a-d'),how:v('a-h'),times:v('a-t'),reason:v('a-r'),start:v('a-s'),end:v('a-e'),notes:v('a-n'),auth:v('a-p'),form:el.querySelector('#a-f').checked,name:v('a-y')}).then(function(r){if(r.ok){msg=r.status==='Active'?'Saved and approved.':'Saved. A director needs to approve it.';load()}else{b.disabled=false;el.querySelector('#a-e2').textContent=r.error||'Did not save.'}}).catch(function(){b.disabled=false;el.querySelector('#a-e2').textContent='No connection.'})};
  }).catch(function(){root('<div class="box err">Could not load the children.</div>')});
 }
 function histForm(){
  var go=KIDS.length?Promise.resolve():api('ph_kids').then(function(r){KIDS=r.kids||[]});
  go.then(function(){root('<div class="box"><h2>Print a 12-month medication log</h2><label>Child</label><select id="h-c"><option value="">Pick a child</option>'+KIDS.map(function(k){return'<option>'+esc(k.n)+'</option>'}).join('')+'</select><div class="err" id="h-e"></div><button class="btn g" id="h-go">Open the log</button><button class="btn s" id="h-b">Back</button></div>');
   el.querySelector('#h-b').onclick=load;
   el.querySelector('#h-go').onclick=function(){var c=el.querySelector('#h-c').value,er=el.querySelector('#h-e');if(!c){er.textContent='Pick a child.';return}er.textContent='Loading...';
    api('med_history',{child:c}).then(function(r){if(!r.ok){er.textContent=r.error||'Could not load.';return}er.textContent='';var w=window.open('','_blank');if(!w){er.textContent='Allow pop-ups to print.';return}
     var rows=r.doses.map(function(d){return '<tr><td>'+fdate(d.date)+'</td><td>'+esc(d.time)+'</td><td>'+esc(d.med)+'</td><td>'+esc(d.dose)+'</td><td>'+esc(d.by)+(d.staffSig?'<br><img src="'+esc(d.staffSig)+'" style="height:28px">':'')+'</td><td>'+(d.parent?esc(d.parent)+'<br>':'')+(d.parentSig?'<img src="'+esc(d.parentSig)+'" style="height:28px">':'<i>not signed</i>')+'</td></tr>'}).join('')||'<tr><td colspan=6>No doses recorded.</td></tr>';
     w.document.write('<html><head><title>Medication log</title><style>body{font-family:Arial;margin:24px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #777;padding:5px;text-align:left;vertical-align:top}</style></head><body><h2>Medication Administration Log - '+esc(c)+'</h2><div>'+esc(o.school||'')+' &middot; last 12 months</div><br><table><tr><th>Date</th><th>Time</th><th>Medicine</th><th>Dose</th><th>Given by</th><th>Parent signature</th></tr>'+rows+'</table></body></html>');w.document.close();setTimeout(function(){w.print()},400)})}});
 }
 load();
}};
})();
