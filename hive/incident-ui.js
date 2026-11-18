/* THE HIVE: Accident / Incident reports (11/17/26). Shared by the classroom pack (teachers write the report and sign), the office pack and the Director Pack
   (director reviews, edits, signs, prints the official Kid City USA Accident/Incident Form, handles parent email-copy requests).
   One report per child. Two-child incidents are two separate reports that never name the other child. */
(function(){
var CSS='.iu{font-family:inherit}.iu .box{background:#fff;border:1px solid #e3d9c4;border-radius:16px;padding:16px;margin:0 0 14px}.iu h2{margin:0 0 6px;font-size:20px}.iu .sub{color:#6b6252;font-size:14px;margin:0 0 10px}'
+'.iu label{display:block;font-weight:700;font-size:14px;margin:12px 0 4px}.iu input[type=text],.iu input[type=date],.iu input[type=time],.iu select,.iu textarea{width:100%;font:inherit;font-size:16px;padding:11px;border:1px solid #cdbf9f;border-radius:10px;background:#fff;box-sizing:border-box}.iu textarea{min-height:84px}'
+'.iu .btn{font:inherit;font-weight:800;font-size:16px;border:0;border-radius:12px;padding:13px 20px;background:#e8730c;color:#fff;cursor:pointer}.iu .btn.g{background:#2e8b57}.iu .btn.s{background:#efe6d2;color:#3a2f1c}.iu .btn.big{display:block;width:100%;font-size:18px;padding:15px}'
+'.iu .row{display:flex;gap:10px;flex-wrap:wrap}.iu .row>*{flex:1;min-width:140px}.iu .pick{display:flex;gap:10px}.iu .pick button{flex:1;font:inherit;font-weight:800;font-size:17px;padding:14px;border-radius:12px;border:2px solid #cdbf9f;background:#fff;cursor:pointer}.iu .pick button.on{border-color:#e8730c;background:#fff1de}'
+'.iu .warn{background:#fdf0cf;border:1px solid #e8a317;color:#5a4a1c;border-radius:10px;padding:10px 12px;font-size:14px;margin:10px 0}.iu .err{color:#b3261e;font-weight:700;margin:10px 0}.iu .ok{color:#1d7a43;font-weight:700;margin:10px 0}'
+'.iu .st{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:3px 10px}.iu .st.a{background:#fde7b0;color:#7a5200}.iu .st.b{background:#d9e8fb;color:#1c4f8a}.iu .st.c{background:#d6f0de;color:#1d6a3d}'
+'.iu .it{border:1px solid #e3d9c4;border-radius:14px;padding:12px 14px;margin:0 0 10px;background:#fffdf7}.iu .it .t{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.iu .it p{margin:6px 0 0;font-size:14px;color:#4a4130}'
+'.iu canvas.sg{width:100%;height:140px;border:2px dashed #cdbf9f;border-radius:12px;background:#fff;touch-action:none;display:block}.iu .kid{border:2px solid #f0e2bd;border-radius:14px;padding:12px;margin:12px 0;background:#fffaf0}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fdate(d){if(!d)return '';var p=d.split('-');return (+p[1])+'/'+(+p[2])+'/'+p[0]}
function addCss(){if(document.getElementById('iu-css'))return;var s=document.createElement('style');s.id='iu-css';s.textContent=CSS;document.head.appendChild(s)}
/* ---- signature pad -> trimmed PNG data URL ---- */
function Pad(cv){
  var ctx,drawing=false,any=false;
  function size(){var r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;cv.width=Math.max(300,r.width*d);cv.height=Math.max(100,r.height*d);ctx=cv.getContext('2d');ctx.scale(d,d);ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#0a2a8a';any=false}
  function pos(e){var r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
  cv.addEventListener('pointerdown',function(e){e.preventDefault();drawing=true;try{cv.setPointerCapture(e.pointerId)}catch(x){}var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();any=true});
  cv.addEventListener('pointermove',function(e){if(!drawing)return;e.preventDefault();var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
  function up(){drawing=false}cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  size();
  return{clear:function(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);size()},
    get:function(){if(!any)return '';var w=cv.width,h=cv.height,im=ctx.getImageData(0,0,w,h).data,x0=w,y0=h,x1=0,y1=0;for(var y=0;y<h;y++)for(var x=0;x<w;x++)if(im[(y*w+x)*4+3]>10){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
      if(x1<=x0)return '';var pad=6,sx=Math.max(0,x0-pad),sy=Math.max(0,y0-pad),sw=Math.min(w-sx,x1-x0+2*pad),sh=Math.min(h-sy,y1-y0+2*pad);var k=Math.min(1,420/sw),o=document.createElement('canvas');o.width=Math.max(60,Math.round(sw*k));o.height=Math.max(30,Math.round(sh*k));var c=o.getContext('2d');c.drawImage(cv,sx,sy,sw,sh,0,0,o.width,o.height);return o.toDataURL('image/png')}};
}
/* ---- the official form, printed (same overlay positions as the paper form we filled by hand on 11/2) ---- */
var PDFLIB=null;
function loadPdfLib(){return new Promise(function(res,rej){if(window.PDFLib)return res();var s=document.createElement('script');s.src='pdf-lib.min.js?v=117';s.onload=function(){res()};s.onerror=function(){rej(new Error('Could not load the PDF tools.'))};document.head.appendChild(s)})}
var ADDR={'DeLand 2':['238 S Amelia Ave, DeLand, FL 32724','(386) 279-7553'],'Sanford':['1320 Hickory Ave, Sanford, FL 32771','(407) 942-3242']};
function build(rows,school,opts){
  opts=opts||{};
  return loadPdfLib().then(function(){return fetch('incident-form-bg.jpg?v=1').then(function(r){if(!r.ok)throw new Error('Form background missing.');return r.arrayBuffer()})}).then(function(bgb){
    var L=window.PDFLib;return L.PDFDocument.create().then(function(doc){return doc.embedJpg(bgb).then(function(bg){return doc.embedFont(L.StandardFonts.Helvetica).then(function(font){
      var pg=doc.addPage([612,792]),S=0.36,OFF=1035;pg.drawImage(bg,{x:0,y:0,width:612,height:792});
      var blue=L.rgb(0.05,0.1,0.6),black=L.rgb(0,0,0);
      var chain=Promise.resolve();
      rows.slice(0,2).forEach(function(d,idx){
        var o=idx?OFF:0;function Y(py){return 792-(py+o)*S}
        var bot=idx?217:212;
        pg.drawRectangle({x:1048*S,y:Y(bot),width:(1608-1048)*S,height:(bot-134)*S,color:L.rgb(1,1,1)});
        var a=ADDR[school]||['',''];
        function ctr(t,x,ly){var w=font.widthOfTextAtSize(t,9);pg.drawText(t,{x:x*S-w/2,y:Y(ly)+6,size:9,font:font,color:black})}
        ctr(a[0],1328,168);ctr(a[1],1328,192);
        function T(x,ly,s,size,maxw){s=String(s||'');size=size||9;if(maxw){while(size>5.5&&font.widthOfTextAtSize(s,size)>maxw)size-=0.5}pg.drawText(s,{x:(x+6)*S,y:Y(ly)+2.5,size:size,font:font,color:blue})}
        function wrap(s,w,size){var words=String(s||'').split(/\s+/),lines=[],cur='';words.forEach(function(wd){var t=cur?cur+' '+wd:wd;if(font.widthOfTextAtSize(t,size)>w&&cur){lines.push(cur);cur=wd}else cur=t});if(cur)lines.push(cur);return lines}
        /* fill 2 lines: first starts at x1, second at x2 (px). shrink the type until it fits */
        function two(s,x1,x2,ly1,ly2,right){s=String(s||'');if(!s)return;var w1=(right-x1-12)*S,w2=(right-x2-12)*S;
          for(var size=8.5;size>=5.5;size-=0.5){var l1=wrap(s,w1,size),first=l1[0]||'',rest=s.slice(first.length).trim(),l2=rest?wrap(rest,w2,size):[];
            if(l2.length<=1||size<=5.5){T(x1,ly1,first,size);if(l2.length)T(x2,ly2,l2.join(' '),size);return}}}
        T(245,385,d.child,9,150);T(675,385,d.teacher,9,100);T(1043,385,d.age,8,70);T(1365,385,fdate(d.date)+' '+(d.time||''),8,150);
        two(d.desc,487,65,440,494,1590);
        T(327,549,d.body,9,420);T(545,604,d.loc,9,300);
        two(d.nature,402,65,660,714,1590);two(d.treat,431,65,769,823,1590);
        T(251,880,d.action,8.5,420);
        if(d.contacted==='Yes')T(560,933,'X',10);else if(d.contacted==='No')T(645,933,'X',10);
        if(d.contacted==='Yes'){T(845,933,d.ctime,8.5,70);T(1144,933,d.chow,8.5,150)}
        /* signatures sit just above each signature line, dates to the right of the label */
        var sigs=[[d.staffSig,64,478,d.staffAt],[d.dirSig,594,1022,d.dirAt],[d.parentSig,1142,1594,d.parentAt]];
        sigs.forEach(function(sg){
          if(sg[3]){var dm=String(sg[3]).split(' ')[0].split('/'),dt=dm.length===3?(dm[0]+'/'+dm[1]+'/'+dm[2].slice(-2)):dm.join('/'),dw=font.widthOfTextAtSize(dt,7);pg.drawText(dt,{x:sg[2]*S-dw,y:Y(988)+2,size:7,font:font,color:blue})}
          if(sg[0]&&String(sg[0]).indexOf('data:image/png;base64,')===0){chain=chain.then(function(){return doc.embedPng(sg[0]).then(function(im){var maxw=(sg[2]-sg[1])*0.6*S,h=15,w2=im.width*(h/im.height);if(w2>maxw){w2=maxw;h=im.height*(maxw/im.width)}pg.drawImage(im,{x:sg[1]*S+4,y:Y(988)+2,width:w2,height:h})}).catch(function(){})})}
        });
      });
      return chain.then(function(){return doc.save()});
    })})});
  });
}
function openPdf(bytes){var u=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));window.open(u,'_blank')||(location.href=u)}
window.IncidentUI={build:build,openPdf:openPdf,Pad:Pad};

/* ---- the screen ---- */
window.IncidentUI.mount=function(el,o){
  addCss();
  var isDir=function(){return !!(o.dtok&&o.dtok())};
  var view='list',state={n:1,kids:[],roster:[],msg:''},LIST=[],busy=false;
  function api(a,x){x=x||{};x.act=a;x.r=o.room||'';if(o.dtok&&o.dtok())x.dtok=o.dtok();return o.post(x)}
  function root(h){el.innerHTML='<div class="iu">'+h+'</div>'}
  function chip(s){var c=s==='Complete'?'c':(s==='Needs Parent'?'b':'a'),t=s==='Needs Parent'?'Waiting for parent':(s==='Needs Director'?'Waiting for director':s||'');return '<span class="st '+c+'">'+esc(t)+'</span>'}
  function list(){
    root('<div class="box"><div class="msg" style="padding:14px;text-align:center;color:#6b6252">Loading...</div></div>');
    api('inc_list').then(function(r){LIST=r.list||[];if(r.error){root('<div class="box err">'+esc(r.error)+'</div>');return}drawList()}).catch(function(){root('<div class="box err">Could not load. Check your connection.</div>')});
  }
  function drawList(){
    var dir=isDir(),h='<div class="box"><h2>🩹 Accident / Incident Reports</h2><div class="sub">'+(dir?'Every report at this school. Review, sign, print the official form, and send email copies parents ask for.':'Reports for '+esc(o.roomLabel||'this room')+' from the last 2 months. Write a new one when a child is hurt or something happens.')+'</div><button class="btn big g" id="iu-new">＋ Write a new incident report</button></div>';
    var need=LIST.filter(function(x){return x.emailReq&&!x.emailSent});
    if(dir&&need.length)h+='<div class="warn"><b>'+need.length+' parent'+(need.length>1?'s':'')+' asked for an emailed copy.</b> Open the report and tap &ldquo;Mark email sent&rdquo; after you email it.</div>';
    if(!LIST.length)h+='<div class="box" style="text-align:center;color:#6b6252">No reports yet.</div>';
    h+=LIST.map(function(x,i){return '<div class="it"><div class="t"><b>'+esc(x.child)+'</b> &middot; '+fdate(x.date)+' '+esc(x.time)+'<span>'+chip(x.status)+(x.emailReq&&!x.emailSent?' <span class="st a">email copy asked</span>':'')+'</span></div><p>'+esc((x.desc||'').slice(0,160))+((x.desc||'').length>160?'...':'')+'</p>'+(dir?'<p><button class="btn s" data-i="'+i+'">Open</button></p>':'')+'</div>'}).join('');
    root(h);
    el.querySelector('#iu-new').onclick=function(){startNew()};
    el.querySelectorAll('button[data-i]').forEach(function(b){b.onclick=function(){review(LIST[+b.getAttribute('data-i')])}});
  }
  function startNew(){
    state={n:1,kids:[{},{}],roster:[],msg:''};root('<div class="box" style="text-align:center">Loading children...</div>');
    api('inc_kids').then(function(r){state.roster=r.kids||[];drawForm()}).catch(function(){root('<div class="box err">Could not load the children. Check your connection.</div>')});
  }
  function kidOpts(sel){return '<option value="">Pick a child</option>'+state.roster.map(function(k){return '<option'+(k.n===sel?' selected':'')+'>'+esc(k.n)+'</option>'}).join('')}
  function kidBlock(i){
    var k=state.kids[i]||{};
    return '<div class="kid"><b>'+(state.n===2?'Child '+(i+1):'The child')+'</b>'
    +'<label>Child</label><select data-k="'+i+'" data-f="child">'+kidOpts(k.child)+'</select>'
    +'<label>Girl or boy (for the form)</label><div class="pick" data-k="'+i+'" data-f="gender"><button type="button" data-v="F" class="'+(k.gender==='F'?'on':'')+'">Girl</button><button type="button" data-v="M" class="'+(k.gender==='M'?'on':'')+'">Boy</button></div>'
    +'<label>Body parts involved</label><input type="text" data-k="'+i+'" data-f="body" maxlength="100" value="'+esc(k.body||'')+'" placeholder="Example: Face (under the eye), or None">'
    +'<label>Nature of injury</label><input type="text" data-k="'+i+'" data-f="nature" maxlength="160" value="'+esc(k.nature||'')+'" placeholder="Example: Bruise under the eye, or No injury">'
    +'<label>Medical treatment given</label><input type="text" data-k="'+i+'" data-f="treat" maxlength="160" value="'+esc(k.treat||'')+'" placeholder="Example: Ice pack, or None needed">'
    +'<label>Action taken</label><input type="text" data-k="'+i+'" data-f="action" maxlength="160" value="'+esc(k.action||'')+'" placeholder="Example: Children separated. Child comforted.">'
    +'<label>Was the parent / guardian contacted?</label><div class="pick" data-k="'+i+'" data-f="contacted"><button type="button" data-v="Yes" class="'+(k.contacted==='Yes'?'on':'')+'">Yes</button><button type="button" data-v="No" class="'+(k.contacted==='No'?'on':'')+'">No</button></div>'
    +(k.contacted==='Yes'?'<div class="row"><div><label>Time contacted</label><input type="text" data-k="'+i+'" data-f="ctime" maxlength="20" value="'+esc(k.ctime||'')+'" placeholder="2:15 PM"></div><div><label>How</label><input type="text" data-k="'+i+'" data-f="chow" maxlength="80" value="'+esc(k.chow||'')+'" placeholder="Phone call, text, in person"></div></div>':'')
    +'</div>';
  }
  function now12(){var d=new Date(),h=d.getHours(),m=d.getMinutes();return (h%12||12)+':'+('0'+m).slice(-2)+' '+(h>=12?'PM':'AM')}
  function drawForm(){
    var s=state;
    root('<div class="box"><h2>New incident report</h2><div class="sub">'+esc(o.roomLabel||'')+'</div>'
    +'<label>How many children were involved?</label><div class="pick" id="iu-n"><button type="button" data-v="1" class="'+(s.n===1?'on':'')+'">One child</button><button type="button" data-v="2" class="'+(s.n===2?'on':'')+'">Two children</button></div>'
    +(s.n===2?'<div class="warn">Two children = <b>two separate reports</b>. Each parent will only ever see their own child, and the other child&rsquo;s name is never shown. Do not type either child&rsquo;s name below. Write &ldquo;another child&rdquo; or &ldquo;a friend&rdquo;.</div>':'')
    +'<div class="row"><div><label>Your name</label><input type="text" id="iu-by" maxlength="60" value="'+esc(s.by||'')+'"></div><div><label>Teacher who was with the children</label><input type="text" id="iu-te" maxlength="60" value="'+esc(s.teacher||'')+'" placeholder="Same as your name if you were"></div></div>'
    +'<div class="row"><div><label>Date</label><input type="date" id="iu-d" value="'+(s.date||o.today)+'" max="'+o.today+'"></div><div><label>Time it happened</label><input type="text" id="iu-t" maxlength="20" value="'+esc(s.time||now12())+'"></div></div>'
    +'<label>Where did it happen?</label><input type="text" id="iu-l" maxlength="100" value="'+esc(s.loc||'')+'" placeholder="Example: Learning playroom, playground">'
    +'<label>What happened? (short, facts only)</label><textarea id="iu-w" maxlength="340" placeholder="Example: While playing, a friend wanted the toy and hit the child in the face with her hand.">'+esc(s.desc||'')+'</textarea>'
    +'<div class="sub">Do not type any child&rsquo;s name here. About 2 sentences fits the official form.</div></div>'
    +[0,1].slice(0,s.n).map(kidBlock).join('')
    +'<div class="box"><label style="margin-top:0">Staff signature (sign with your finger)</label><canvas class="sg" id="iu-sg"></canvas><div><a href="#" id="iu-clr">Clear</a></div><div id="iu-er" class="err"></div><button class="btn big g" id="iu-go">Save and sign this report</button><p><button class="btn s" id="iu-back">Cancel</button></p></div>');
    var pad=Pad(el.querySelector('#iu-sg'));el.querySelector('#iu-clr').onclick=function(e){e.preventDefault();pad.clear()};
    function grab(){s.by=val('iu-by');s.teacher=val('iu-te');s.date=val('iu-d');s.time=val('iu-t');s.loc=val('iu-l');s.desc=val('iu-w')}
    function val(id){var e=el.querySelector('#'+id);return e?e.value.trim():''}
    el.querySelectorAll('#iu-n button').forEach(function(b){b.onclick=function(){grab();s.n=+b.getAttribute('data-v');drawForm()}});
    el.querySelectorAll('[data-k][data-f]').forEach(function(e){
      var i=+e.getAttribute('data-k'),f=e.getAttribute('data-f');
      if(e.tagName==='SELECT'||e.tagName==='INPUT'){e.onchange=e.oninput=function(){s.kids[i][f]=e.value}}
      else e.querySelectorAll('button').forEach(function(b){b.onclick=function(){grab();s.kids[i][f]=b.getAttribute('data-v');drawForm()}});
    });
    el.querySelector('#iu-back').onclick=function(){list()};
    el.querySelector('#iu-go').onclick=function(){
      grab();var er=el.querySelector('#iu-er'),sig=pad.get();er.textContent='';
      if(!s.by){er.textContent='Type your name.';return}
      if(!s.loc||!s.desc||!s.time){er.textContent='Fill in the time, where it happened and what happened.';return}
      var ks=s.kids.slice(0,s.n);
      for(var i=0;i<ks.length;i++){var k=ks[i];if(!k.child){er.textContent='Pick each child.';return}if(!k.contacted){er.textContent='Tell us if the parent was contacted ('+k.child+').';return}if(!k.nature||!k.action){er.textContent='Fill in the nature of injury and the action taken for '+k.child+' (write "No injury" if none).';return}}
      if(s.n===2&&ks[0].child===ks[1].child){er.textContent='Pick two different children.';return}
      if(!sig){er.textContent='Please sign in the box.';return}
      var b=this;b.disabled=true;b.textContent='Saving...';
      api('inc_add',{name:s.by,teacher:s.teacher||s.by,date:s.date,time:s.time,loc:s.loc,desc:s.desc,sig:sig,kids:ks}).then(function(r){
        if(r.ok){root('<div class="box" style="text-align:center"><h2>✅ Saved</h2><p>'+(s.n===2?'Two separate reports were saved.':'The report was saved.')+' It is waiting for the director. The parent will sign it at sign-in.</p><button class="btn big" id="iu-ok">Done</button></div>');el.querySelector('#iu-ok').onclick=list}
        else{b.disabled=false;b.textContent='Save and sign this report';er.textContent=r.error||'Did not save.'}
      }).catch(function(){b.disabled=false;b.textContent='Save and sign this report';er.textContent='Could not save. Check your connection.'});
    };
  }
  /* ---- director review ---- */
  function review(x){
    root('<div class="box" style="text-align:center">Loading...</div>');
    api('inc_get',{id:x.id,group:false}).then(function(r){if(!r.ok){root('<div class="box err">'+esc(r.error||'Could not open.')+'</div>');return}drawReview(r.rows[0])});
  }
  function fld(l,id,v,ta,locked){return '<label>'+l+'</label>'+(ta?'<textarea id="'+id+'" maxlength="340"'+(locked?' disabled':'')+'>'+esc(v)+'</textarea>':'<input type="text" id="'+id+'" value="'+esc(v)+'"'+(locked?' disabled':'')+'>')}
  function drawReview(x){
    var locked=!!x.parentAt;
    root('<div class="box"><h2>'+esc(x.child)+' &middot; '+fdate(x.date)+' '+esc(x.time)+'</h2><div class="sub">'+esc(x.room)+' &middot; Teacher: '+esc(x.teacher)+' &middot; Written by '+esc(x.by)+' &middot; '+chip(x.status)+'</div>'
    +(locked?'<div class="warn">The parent signed this report, so it can no longer be changed.</div>':'')
    +fld('What happened','rv-desc',x.desc,true,locked)+fld('Body parts involved','rv-body',x.body,false,locked)+fld('Where it happened','rv-loc',x.loc,false,locked)+fld('Nature of injury','rv-nat',x.nature,false,locked)+fld('Medical treatment','rv-trt',x.treat,false,locked)+fld('Action taken','rv-act',x.action,false,locked)
    +'<div class="row"><div>'+fld('Parent contacted (Yes or No)','rv-con',x.contacted,false,locked)+'</div><div>'+fld('Time','rv-ct',x.ctime,false,locked)+'</div><div>'+fld('How','rv-ch',x.chow,false,locked)+'</div></div>'
    +fld('Director notes (not printed)','rv-nt',x.notes,true,false)
    +'<div id="rv-er" class="err"></div><p><button class="btn s" id="rv-save">Save changes</button></p></div>'
    +'<div class="box"><h2>Signatures</h2><div class="sub">Staff: '+(x.staffAt?'signed '+esc(x.staffAt):'not signed')+' &middot; Director: '+(x.dirAt?esc(x.dirName)+' signed '+esc(x.dirAt):'not signed yet')+' &middot; Parent: '+(x.parentAt?esc(x.parentName)+' signed '+esc(x.parentAt):'not signed yet')+'</div>'
    +'<label>Your name (director)</label><input type="text" id="rv-dn" maxlength="60" value="'+esc(x.dirName||'')+'"><label>Sign here</label><canvas class="sg" id="rv-sg"></canvas><div><a href="#" id="rv-clr">Clear</a></div><div id="rv-er2" class="err"></div><button class="btn big g" id="rv-sign">'+(x.dirAt?'Sign again':'Sign as director')+'</button></div>'
    +'<div class="box"><h2>Print / email</h2>'+(x.emailReq?'<div class="warn"><b>The parent asked for an emailed copy</b> at '+esc(x.emailAddr)+(x.emailSent?'. Email sent '+esc(x.emailSent)+'.':'. Print or save the PDF, email it, then tap &ldquo;Mark email sent&rdquo;.')+'</div>':'<div class="sub">If a parent asks for an emailed copy, it will show here.</div>')
    +'<p><button class="btn" id="rv-pdf">Print the official form (this child only)</button></p>'+(x.group?'<p><button class="btn s" id="rv-pdf2">Print both children on one page (cut in half)</button></p>':'')+(x.emailReq&&!x.emailSent?'<p><button class="btn g" id="rv-em">Mark email sent</button></p>':'')
    +'<div id="rv-er3" class="err"></div><p><button class="btn s" id="rv-back">Back to the list</button></p></div>');
    var pad=Pad(el.querySelector('#rv-sg'));el.querySelector('#rv-clr').onclick=function(e){e.preventDefault();pad.clear()};
    function g(id){return el.querySelector('#'+id).value.trim()}
    el.querySelector('#rv-back').onclick=list;
    el.querySelector('#rv-save').onclick=function(){var er=el.querySelector('#rv-er');er.textContent='';var set={notes:g('rv-nt')};if(!locked){set.desc=g('rv-desc');set.body=g('rv-body');set.loc=g('rv-loc');set.nature=g('rv-nat');set.treat=g('rv-trt');set.action=g('rv-act');set.contacted=(g('rv-con')==='Yes'?'Yes':'No');set.ctime=g('rv-ct');set.chow=g('rv-ch')}
      var changed=!locked&&['desc','body','loc','nature','treat','action','contacted','ctime','chow'].some(function(k){var m={desc:x.desc,body:x.body,loc:x.loc,nature:x.nature,treat:x.treat,action:x.action,contacted:x.contacted,ctime:x.ctime,chow:x.chow};return (m[k]||'')!==set[k]});
      if(changed&&!confirm('Changing the report clears your director signature, so you will sign it again. Save?'))return;
      api('inc_update',{id:x.id,set:set}).then(function(r){if(r.ok)review(x);else er.textContent=r.error||'Did not save.'})};
    el.querySelector('#rv-sign').onclick=function(){var er=el.querySelector('#rv-er2'),sig=pad.get(),nm=g('rv-dn');er.textContent='';if(!nm||!sig){er.textContent='Type your name and sign in the box.';return}
      this.disabled=true;api('inc_dir_sign',{id:x.id,name:nm,sig:sig}).then(function(r){if(r.ok)review(x);else{el.querySelector('#rv-sign').disabled=false;er.textContent=r.error||'Did not save.'}})};
    function pdf(group){var er=el.querySelector('#rv-er3');er.textContent='Making the form...';api('inc_get',{id:x.id,group:group}).then(function(r){if(!r.ok)throw new Error(r.error||'Could not load.');
      var rows=r.rows.slice().sort(function(a,b){return a.child===x.child?-1:(b.child===x.child?1:0)});
      return build(rows,o.school,{})}).then(function(bytes){er.textContent='';openPdf(bytes)}).catch(function(e){er.textContent=e.message||'Could not make the form.'})}
    el.querySelector('#rv-pdf').onclick=function(){pdf(false)};var p2=el.querySelector('#rv-pdf2');if(p2)p2.onclick=function(){pdf(true)};
    var em=el.querySelector('#rv-em');if(em)em.onclick=function(){api('inc_emailed',{id:x.id}).then(function(r){if(r.ok)review(x)})};
  }
  list();
};
})();
