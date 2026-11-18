/* Official daily Sign In / Sign Out sheet, view on screen (11/18/26). */
(function(){
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function t12(x){if(!x)return'';var m=/^(\d{1,2}):(\d{2})/.exec(x);if(!m)return esc(x);var h=+m[1],p=h>=12?'PM':'AM';h=h%12||12;return h+':'+m[2]+' '+p}
function add(s,n){var d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function nd(s){var p=s.split('-');return (+p[1])+'/'+(+p[2])+'/'+p[0]}
window.SignSheetUI={mount:function(el,o){
 var min=add(o.today,-62),st={from:add(o.today,-4),to:o.today,data:null,msg:'',busy:false};
 var dow=new Date(o.today+'T12:00:00').getDay();if(dow>=1&&dow<=5)st.from=add(o.today,-(dow-1));
 function sheet(d,kids){var rows=d.rows||{},here=kids.filter(function(k){return rows[k]});
  var h='<div class="chart" style="page-break-after:always"><div class="top"><span><b>Daily Sign In / Sign Out</b><br><small>'+esc(o.school)+' &middot; '+esc(o.roomLabel)+' &middot; '+nd(d.date)+'</small></span><span class="badge ok">'+here.length+' children</span></div>';
  if(!here.length)return h+'<div class="it">Nobody was signed in this day.</div></div>';
  h+='<table style="width:100%;border-collapse:collapse;font-size:14px"><tr style="text-align:left"><th style="border-bottom:2px solid var(--line);padding:4px">Child</th><th style="border-bottom:2px solid var(--line);padding:4px">Time in</th><th style="border-bottom:2px solid var(--line);padding:4px">Time out</th><th style="border-bottom:2px solid var(--line);padding:4px">Signed by</th></tr>';
  here.forEach(function(k){var r=rows[k];h+='<tr><td style="border-top:1px solid var(--sunk);padding:5px 4px"><b>'+esc(k)+'</b></td><td style="border-top:1px solid var(--sunk);padding:5px 4px">'+t12(r.in)+'</td><td style="border-top:1px solid var(--sunk);padding:5px 4px">'+t12(r.out)+'</td><td style="border-top:1px solid var(--sunk);padding:5px 4px;font-size:12px;color:var(--muted)">'+esc((r.inby||'').replace('Classroom QR: ',''))+(r.outby?' / '+esc(r.outby.replace('Classroom QR: ','')):'')+'</td></tr>'});
  return h+'</table></div>'}
 function draw(){
  var h='<div class="sec"><div class="noprint"><h2>✍️ Official Sign In / Sign Out Sheet</h2><div class="sub">'+esc(o.roomLabel)+'. Filled in from the sign-ins and sign-outs for this room. Last 2 months. Date only, no day of the week.</div>'
  +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0"><label style="flex:1;min-width:140px;font-weight:700">From<input type="date" id="ssf" value="'+st.from+'" min="'+min+'" max="'+o.today+'" style="display:block;width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px;margin-top:4px"></label><label style="flex:1;min-width:140px;font-weight:700">To<input type="date" id="sst" value="'+st.to+'" min="'+min+'" max="'+o.today+'" style="display:block;width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px;margin-top:4px"></label></div>'
  +'<button class="big" id="ssg">'+(st.busy?'Loading...':'Show the sheet')+'</button>'+(st.msg?'<div class="alert">'+esc(st.msg)+'</div>':'')+'</div>';
  if(st.data){h+=st.data.days.map(function(d){return sheet(d,st.data.kids)}).join('');h+='<div class="noprint"><button class="big" id="ssp" style="background:#555">Print this sheet</button></div>'}
  h+='</div>';el.innerHTML=h;
  el.querySelector('#ssg').onclick=function(){st.from=el.querySelector('#ssf').value;st.to=el.querySelector('#sst').value;st.msg='';st.busy=true;draw();
   o.post({act:'ss_get',r:o.room,from:st.from,to:st.to}).then(function(r){st.busy=false;if(r&&r.ok){st.data=r}else{st.data=null;st.msg=(r&&r.error)||'Could not load.'}draw()}).catch(function(){st.busy=false;st.msg='No connection. Try again.';draw()})};
  var p=el.querySelector('#ssp');if(p)p.onclick=function(){window.print()};
 }
 draw();
}};
})();
