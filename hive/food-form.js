/* THE HIVE: Food Program weekly Attendance & Meal Count form for the QR packs (11/17/26).
   Same form as the Rooms board / DCF Binder, built from the Rooms board's sign-ins and meals. Last 2 months only.
   FoodForm.mount(el, {school, today, rooms:[room names], post:function(o){return Promise}, allowAll:true|false}) */
(function(){
var FC_REPH={'DeLand 2':{name:'Kid City USA Deland 2 Inc (573)',phone:'(386) 279-7553',sponsor:'Child Care of Southwest Florida (U-2677)',sphone:'(239) 936-0899'},
 'Sanford':{name:'Kid City USA Sanford',phone:'(407) 942-3242',sponsor:'Community Coordinated Child Care (4C)',sphone:'(407) 522-2252'}};
var FC_ROWS=22, FC_DN=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function pad(n){return String(n).padStart(2,'0')}
function add(ds,n){var d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function monday(ds){var d=new Date(ds+'T12:00:00'),w=d.getDay();d.setDate(d.getDate()-(w===0?6:w-1));return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function md(ds,yy){var p=ds.split('-');return (+p[1])+'/'+(+p[2])+(yy?'/'+p[0].slice(2):'')}
function full(ds){var p=ds.split('-');return p[1]+'/'+p[2]+'/'+p[0]}
var st=document.createElement('style');st.textContent='.fcw{overflow-x:auto;background:#fff;border:1px solid #ccc;border-radius:10px;padding:8px;margin-top:8px}'
 +'.fcp{position:relative;width:1060px;margin:0 auto 14px;font:11px Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:6px 10px 4px 30px}'
 +'.fcp .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;min-height:50px}.fcp .hl{width:32%;font-size:10px}.fcp .hl b{font:700 17px Georgia,serif;display:block;margin-top:6px}.fcp .hl i{font:12px Georgia,serif;font-style:normal;display:block}'
 +'.fcp .hc{width:36%;text-align:center}.fcp .hc b{font:700 19px Georgia,serif;text-decoration:underline}.fcp .hc div{font-size:14px;margin-top:2px}.fcp .hr{width:32%;text-align:right}.fcp .hr b{font:700 14px Georgia,serif}.fcp .hr i{font:12px Georgia,serif;font-style:normal;display:block}'
 +'.fcp table{border-collapse:collapse;width:100%;table-layout:fixed;border:2px solid #000}.fcp td,.fcp th{border:1px solid #000;padding:0;text-align:center;font-weight:400;overflow:hidden;white-space:nowrap}.fcp .dg{border-left:2px solid #000}'
 +'.fcp th.dayh{font:13px Georgia,serif;line-height:1.25;height:38px}.fcp th.dayh small{display:block;font-size:12px}.fcp .cl{text-align:left;font:13px Georgia,serif;padding:0 4px;height:38px;vertical-align:bottom}.fcp .sh th{font:11px Georgia,serif;height:19px}'
 +'.fcp tr.kid td{height:19px;font-size:11px}.fcp td.nm{text-align:left;padding-left:3px;font:12px Georgia,serif}.fcp td.age{font-size:10px;text-align:left;padding-left:2px}.fcp td.x{font-weight:700;font-size:12px}.fcp td.dsh{font-size:10px}'
 +'.fcp .lab{text-align:left;font:12px Georgia,serif;padding:0 4px}.fcp .labr{text-align:right;font:13px Georgia,serif;padding-right:8px}.fcp tr.tot td{height:24px;font-weight:700;font-size:11px}'
 +'.fcp .ft{margin-top:6px;font:10.5px Georgia,serif;line-height:1.3}.fcp .pg{text-align:right;font:11px Arial}'
 +'.ffc{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.ffc label{flex:1;min-width:150px;font-weight:700;font-size:14px}.ffc select{display:block;width:100%;font:inherit;padding:11px;border:1px solid #e6dcc6;border-radius:10px;margin-top:4px;background:#fff}'
 +'@media print{@page{size:letter landscape;margin:.3in}body.pf>*:not(main):not(script){display:none!important}body.pf main>*:not(#app){display:none!important}body.pf .tiles,body.pf .noprint{display:none!important}body.pf .sec{border:0!important;padding:0!important;margin:0!important}body.pf .fcw{border:0;padding:0;overflow:visible;margin:0}body.pf .fcp{width:100%;margin:0;page-break-after:always;break-after:page}body.pf .fcp:last-child{page-break-after:auto;break-after:auto}}';
document.head.appendChild(st);
function pages(o){ /* o: school, room, mon, kids[{n,age}], rows{date:{lowername:{att,b,l,p}}} */
  var mon=o.mon, days=[0,1,2,3,4].map(function(i){return add(mon,i)}), H=FC_REPH[o.school]||FC_REPH['Sanford'], sat=add(mon,5), sun=add(mon,6), kids=o.kids||[], n=Math.max(1,Math.ceil(kids.length/FC_ROWS)), h='';
  for(var p=0;p<n;p++){
    var pk=kids.slice(p*FC_ROWS,(p+1)*FC_ROWS);
    h+='<div class="fcp"><div class="hd"><div class="hl"><b>'+esc(H.name)+'</b><i>'+esc(H.phone)+'</i></div><div class="hc"><b>Weekly Attendance &amp; Meal Count Report</b><div>Week Of: '+md(mon,1)+'-'+md(sat,1)+' (Mon '+md(mon)+'-Sun '+md(sun)+')</div></div><div class="hr"><b>Sponsor: '+esc(H.sponsor)+'</b><i>'+esc(H.sphone)+'</i></div></div>';
    h+='<table><colgroup><col style="width:5%"><col style="width:4%"><col style="width:20%">';for(var c=0;c<35;c++)h+='<col>';h+='</colgroup>';
    h+='<tr><th colspan="3" class="cl">CLASSROOM #: &nbsp; <span style="font:14px Georgia">'+esc(o.room)+'</span></th>';days.forEach(function(d,i){h+='<th colspan="7" class="dayh dg">'+full(d)+'<small>'+FC_DN[i]+'</small></th>'});h+='</tr>';
    h+='<tr class="sh"><th>AGE</th><th>NBR</th><th>CHILD NAME</th>';days.forEach(function(){['Att','B','','L','P','',''].forEach(function(t,j){h+='<th'+(j===0?' class="dg"':'')+'>'+t+'</th>'})});h+='</tr>';
    var tot=days.map(function(){return{a:0,b:0,l:0,p:0}});
    for(var q=0;q<FC_ROWS;q++){
      var k=pk[q];h+='<tr class="kid"><td class="age">'+(k?esc(k.age||''):'')+'</td><td></td><td class="nm">'+(k?esc(String(k.n).toUpperCase())+(k.diet?' *':''):'')+'</td>';
      days.forEach(function(d,i){var m=k&&o.rows[d]?o.rows[d][String(k.n).trim().toLowerCase()]:null;if(m&&m.att)tot[i].a++;if(m&&m.b)tot[i].b++;if(m&&m.l)tot[i].l++;if(m&&m.p)tot[i].p++;
        h+='<td class="x dg">'+(m&&m.att?'X':'')+'</td><td class="x">'+(m&&m.b?'X':'')+'</td><td class="dsh">-</td><td class="x">'+(m&&m.l?'X':'')+'</td><td class="x">'+(m&&m.p?'X':'')+'</td><td class="dsh">-</td><td class="dsh">-</td>'});
      h+='</tr>';
    }
    var dl=pk.filter(function(k){return k.diet}).map(function(k){return k.n+': '+k.diet}).join(';  ');
    h+='<tr><td colspan="3" class="lab" style="height:24px;border-top:2px solid #000">* Special Diet</td><td colspan="35" class="dg" style="border-top:2px solid #000;text-align:left;white-space:normal;font:10px Georgia,serif;padding:2px 5px;line-height:1.25">'+esc(dl)+'</td></tr>';
    h+='<tr class="tot"><td colspan="3" class="labr">Daily Totals:</td>';days.forEach(function(d,i){var t=tot[i],has=pk.length&&(t.a||t.b||t.l||t.p);[t.a,t.b,'',t.l,t.p,'',''].forEach(function(v,j){h+='<td'+(j===0?' class="dg"':'')+'>'+(v===''?'':(has?v:''))+'</td>'})});h+='</tr></table>';
    h+='<div class="ft">I certify that the information on this form is true and correct to the best of my knowledge and that I will claim reimbursement only for eligible meals served to eligible participants. The director signs and dates the official weekly copy in the DCF Binder.</div><div class="pg">Page '+(p+1)+' of '+n+'</div></div>';
  }
  return h;
}
function weeks(today){var m=monday(today),o=[];for(var i=0;i<9;i++){o.push(add(m,-7*i))}return o}
function mount(el,cfg){
  var rooms=cfg.rooms||[],ST={room:rooms.length===1||!cfg.allowAll?rooms[0]:'ALL',mon:monday(cfg.today),busy:false,html:'',msg:''},ws=weeks(cfg.today);
  function ui(){
    var sel=rooms.length>1?'<label>Room<select id="ffr">'+(cfg.allowAll?'<option value="ALL"'+(ST.room==='ALL'?' selected':'')+'>All rooms</option>':'')+rooms.map(function(r){return '<option'+(ST.room===r?' selected':'')+'>'+esc(r)+'</option>'}).join('')+'</select></label>':'';
    var h='<div class="sec"><div class="noprint"><h2>🍎 Food Program Attendance</h2><div class="sub">The Weekly Attendance &amp; Meal Count form, filled in from the sign-ins and meals on the Rooms board. Pick the week, then print. The last 2 months are shown.</div>'
     +'<div class="ffc">'+sel+'<label>Week<select id="ffw">'+ws.map(function(w){return '<option value="'+w+'"'+(ST.mon===w?' selected':'')+'>Week of '+md(w)+' - '+md(add(w,4))+'</option>'}).join('')+'</select></label></div>'
     +'<button class="big" id="ffp"'+(ST.busy||!ST.html?' disabled':'')+' style="'+(ST.busy||!ST.html?'opacity:.5':'')+'">🖨️ Print this form</button>'+(ST.msg?'<div class="msg">'+ST.msg+'</div>':'')+'</div>'
     +(ST.html?'<div class="fcw">'+ST.html+'</div>':(ST.busy?'<div class="msg">Loading the form...</div>':''))+'</div>';
    el.innerHTML=h;
    var r=document.getElementById('ffr'),w=document.getElementById('ffw'),p=document.getElementById('ffp');
    if(r)r.onchange=function(){ST.room=this.value;load()};
    w.onchange=function(){ST.mon=this.value;load()};
    p.onclick=function(){document.body.classList.add('pf');var dn=function(){document.body.classList.remove('pf');window.removeEventListener('afterprint',dn)};window.addEventListener('afterprint',dn);setTimeout(function(){window.print()},60)};
  }
  function one(room){return cfg.post({act:'food',room:room,mon:ST.mon}).then(function(d){if(d.error)throw new Error(d.error);return pages({school:d.school,room:d.room,mon:d.mon,kids:d.kids,rows:d.rows})})}
  function load(){
    ST.busy=true;ST.msg='';ST.html='';ui();var list=ST.room==='ALL'?rooms:[ST.room],out=[],i=0;
    (function nx(){if(i>=list.length){ST.busy=false;ST.html=out.join('');ui();return}
      one(list[i]).then(function(h){out.push(h);i++;nx()}).catch(function(e){ST.busy=false;ST.html='';ST.msg=esc(e.message||'Could not load the form.');ui()})})();
  }
  load();
}
window.FoodForm={mount:mount,pages:pages};
})();

/* ---- Allergy list + add (classroom, kitchen, office, director) ---- */
(function(){
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function mount(el,cfg){
  var ST={list:null,kids:null,msg:'',busy:false};
  function who(){try{return localStorage.getItem('bearRoomBy')||''}catch(e){return ''}}
  function load(){
    Promise.all([cfg.post({act:'allergies',r:cfg.room||''}),cfg.post({act:'kids',r:cfg.room||''})]).then(function(a){
      if(a[0].error||a[1].error){ST.msg=esc(a[0].error||a[1].error);ST.list=[];ST.kids=[]}else{ST.list=a[0].list;ST.kids=a[1].kids}ui()}).catch(function(){ST.msg='Could not load. Please try again.';ST.list=[];ST.kids=[];ui()});
  }
  function ui(){
    if(ST.list===null){el.innerHTML='<div class="sec"><div class="msg">Loading allergies...</div></div>';return}
    var dir=cfg.dtok&&cfg.dtok();
    var l=ST.list.map(function(x){var p=x.status==='Pending';
      return '<div class="it" style="'+(p?'background:#fff6dc;border-radius:8px;padding:8px':'')+'"><b>'+esc(x.child)+'</b> &mdash; '+esc(x.allergy)+(x.plan?' <small>('+esc(x.plan)+')</small>':'')+(p?' <span style="background:#e8a317;color:#fff;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:700">Waiting for director</span>':'')
       +(dir?'<div style="margin-top:6px">'+(p?'<button data-id="'+x.id+'" data-d="Approved" style="font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;background:#2f8a4f;color:#fff;margin-right:6px">Approve</button>':'')+'<button data-id="'+x.id+'" data-d="Removed" style="font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;background:#c2372f;color:#fff">Remove</button></div>':'')+'</div>'}).join('')||'<div class="sub">No allergies on the list.</div>';
    var opts='<option value="">Pick the child</option>'+ST.kids.map(function(k){return '<option>'+esc(k.n)+'</option>'}).join('');
    el.innerHTML='<div class="sec"><h2>⚠️ Allergies</h2><div class="sub">'+(cfg.roomLabel?esc(cfg.roomLabel)+'. ':'')+'First name and last initial only. New ones wait for the director to approve them.</div>'+l+'</div>'
     +'<div class="sec"><h2>Add an allergy</h2><label class="lbl" style="font-weight:700;font-size:14px">Your name</label><input class="inp" id="alwho" value="'+esc(who())+'" placeholder="Type your name" autocomplete="off" style="display:block;width:100%;font:inherit;padding:11px;border:1px solid #e6dcc6;border-radius:10px;margin:4px 0 10px">'
     +'<label class="lbl" style="font-weight:700;font-size:14px">Child</label><select class="inp" id="alkid" style="display:block;width:100%;font:inherit;padding:11px;border:1px solid #e6dcc6;border-radius:10px;margin:4px 0 10px;background:#fff">'+opts+'</select>'
     +'<label class="lbl" style="font-weight:700;font-size:14px">Allergy</label><input class="inp" id="alal" placeholder="Example: peanuts" autocomplete="off" style="display:block;width:100%;font:inherit;padding:11px;border:1px solid #e6dcc6;border-radius:10px;margin:4px 0 10px">'
     +'<label class="lbl" style="font-weight:700;font-size:14px">Reaction / plan (optional)</label><input class="inp" id="alpl" autocomplete="off" style="display:block;width:100%;font:inherit;padding:11px;border:1px solid #e6dcc6;border-radius:10px;margin:4px 0 10px">'
     +(ST.msg?'<div class="msg" style="padding:8px">'+ST.msg+'</div>':'')+'<button class="big" id="aladd" style="display:block;width:100%;font:inherit;font-weight:800;font-size:18px;border:0;border-radius:14px;padding:15px;background:#2f8a4f;color:#fff;margin:10px 0;cursor:pointer">'+(ST.busy?'Saving...':'Add allergy')+'</button></div>';
    document.getElementById('aladd').onclick=function(){
      var n=document.getElementById('alwho').value.trim(),c=document.getElementById('alkid').value,a=document.getElementById('alal').value.trim(),p=document.getElementById('alpl').value.trim();
      if(!n||!c||!a){ST.msg='Please type your name, pick the child and type the allergy.';ui();return}
      try{localStorage.setItem('bearRoomBy',n)}catch(e){}
      ST.busy=true;ST.msg='';ui();
      cfg.post({act:'allergy_add',name:n,child:c,allergy:a,plan:p,r:cfg.room||'',src:cfg.src||'Classroom QR'}).then(function(r){ST.busy=false;
        if(r.ok){ST.msg='Saved. It shows as waiting for the director to approve.';load()}else{ST.msg=esc(r.error||'Did not save.');ui()}}).catch(function(){ST.busy=false;ST.msg='Could not save. Check your connection.';ui()});
    };
    [].forEach.call(el.querySelectorAll('button[data-id]'),function(b){b.onclick=function(){b.disabled=true;
      cfg.post({act:'allergy_decide',id:b.getAttribute('data-id'),decision:b.getAttribute('data-d'),by:'Director',dtok:cfg.dtok()}).then(function(r){if(r.ok){ST.msg='';load()}else{b.disabled=false;ST.msg=esc(r.error||'Did not save.');ui()}})}});
  }
  load();
}
window.AllergyUI={mount:mount};
})();
