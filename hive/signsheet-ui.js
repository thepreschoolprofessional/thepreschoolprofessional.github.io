/* The real Kid City "ATTENDANCE ROSTER" form for one classroom, filled in, to view on screen and print (11/18/26). Uses the same form layout as the Bear’s Den Rooms board paper form. */
(function(){
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function add(s,n){var d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function wkd(s){var w=new Date(s+'T12:00:00').getDay();return w>=1&&w<=5}
window.SignSheetUI={mount:function(el,o){
 var P=window.RoomsPaper;
 if(!document.getElementById('rpcss')&&P){var s=document.createElement('style');s.id='rpcss';s.textContent=P.CSS+'.pfscroll{overflow-x:auto;background:#fff;border:1px solid #ccc;border-radius:10px;padding:6px;margin-top:8px}.pfscroll .pf{min-width:1000px;margin:0}@media print{.pfscroll{border:0;padding:0;overflow:visible}.pfscroll .pf{min-width:0;zoom:1 !important}}';document.head.appendChild(s)}
 var min=add(o.today,-62),st={date:o.today,data:null,msg:'',busy:false};
 while(!wkd(st.date))st.date=add(st.date,-1);
 function load(){st.busy=true;st.msg='';draw();
  o.post({act:'roster_get',r:o.room,date:st.date}).then(function(r){st.busy=false;if(r&&r.ok){st.data=r}else{st.data=null;st.msg=(r&&r.error)||'Could not load.'}draw()}).catch(function(){st.busy=false;st.data=null;st.msg='Could not load. Check the connection.';draw()})}
 function step(n){var d=add(st.date,n);while(!wkd(d))d=add(d,n>0?1:-1);if(d>o.today||d<min)return;st.date=d;load()}
 function draw(){
  var h='<div class="sec"><div class="noprint"><h2>✍️ Official Attendance Roster (Sign In / Sign Out)</h2><div class="sub">'+esc(o.roomLabel)+'. This is the real classroom form, filled in from today\'s sign-ins, meals and transitions. Last 2 months. You can look at it on the screen; you do not have to print it.</div>'
  +'<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0"><button class="big" style="width:auto;padding:12px 16px" id="ssb">&#9664; Day before</button><label style="flex:1;min-width:150px;font-weight:700">Date<input type="date" id="ssf" value="'+st.date+'" min="'+min+'" max="'+o.today+'" style="width:100%;font:inherit;padding:10px;border-radius:10px;border:2px solid var(--line)"></label><button class="big" style="width:auto;padding:12px 16px" id="ssn">Day after &#9654;</button></div>'
  +'<button class="big" id="ssg">'+(st.busy?'Loading...':'Show the form')+'</button>'+(st.msg?'<div class="alert">'+esc(st.msg)+'</div>':'')+'</div>';
  if(!P)h+='<div class="alert">The form layout did not load. Refresh the page.</div>';
  if(st.data&&P){h+=st.data.rooms.map(function(r){var att={};Object.keys(r.att||{}).forEach(function(k){att[k]=r.att[k]});
    return '<div class="pfscroll">'+P.render({schoolAge:r.schoolAge,school:st.data.school,room:r.name,date:st.data.date,teachers:r.teachers||[],children:r.children||[],att:att,day:r.day||{},asOf:null})+'</div>'}).join('');
   h+='<div class="noprint"><button class="big" id="ssp" style="background:#555;margin-top:10px">Print this form</button></div>'}
  h+='</div>';el.innerHTML=h;
  var g=function(i){return el.querySelector(i)};
  g('#ssg').onclick=function(){var v=g('#ssf').value;if(v&&v>=min&&v<=o.today)st.date=v;load()};
  g('#ssb').onclick=function(){st.date=g('#ssf').value||st.date;step(-1)};g('#ssn').onclick=function(){st.date=g('#ssf').value||st.date;step(1)};
  var w=el.clientWidth-14,z=Math.max(.35,Math.min(1,w/1020));el.querySelectorAll('.pfscroll .pf').forEach(function(f){f.style.zoom=z});
  var p=g('#ssp');if(p)p.onclick=function(){window.print()};
 }
 draw();load();
}};
})();
