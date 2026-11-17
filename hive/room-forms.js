/* Bear Classroom Pack: official forms for the last 2 months (11/17/26). The stamping code below is copied from the Director Portal's Official Forms (dcf.js) so the printed
   forms look exactly the same. Public, read-only: reads the same posted-chart data the room page already has. No signatures are printed. */
(function(){
var S={school:''}, RNG={from:'0000-00-00',to:'9999-99-99'}, SUBS=[];
var RM_LEGACY={'Sanford':{'Ones':'Honeybees - Tod./Inf.','Fours / VPK':'VPK/Pre-School (Pollen-Jocks)','School Age':'Schoolagers (Worker Bees)'},'DeLand 2':{'Infant Room':'Infant/Toddler','Ones':'Honey Bees - Tod. Front','Twos':'Honey Bees - Tod. Front','Threes':"Three's - Honey Combs"}};
function subsOf(fk,room,from,to){ var f=from<RNG.from?RNG.from:from, t=to>RNG.to?RNG.to:to; return SUBS.filter(function(x){ return x.fk===fk && x.room===room && x.fields.Date>=f && x.fields.Date<=t; }); }
function d2(s){ var p=s.split('-'); return new Date(+p[0],+p[1]-1,+p[2],12); }
function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(s,n){ var d=d2(s); d.setDate(d.getDate()+n); return iso(d); }
function dow(s){ return d2(s).getDay(); }
function monday(s){ var d=dow(s); return addDays(s, d===0?-6:1-d); }
function monthStart(s){ return s.slice(0,8)+'01'; }
function monthEnd(s){ var d=d2(s); return iso(new Date(d.getFullYear(), d.getMonth()+1, 0, 12)); }
var BEE_ROWS=[88.6,106.3,119.1,131.9,144.6,157.5,170.3,195.4,208.2,221.1,233.9,246.8,271.8,284.7,297.5,310.3,323.1,335.9,348.8,361.6,374.3,390.2,405.9,421.6,437.4,453.2,468.9,484.7,500.4,516.2,531.9,547.7,563.5];
var BEE_COLS=[289.3,307.3,323.4,345.9,363.5,380.4,402.2,419.8,442.3,460.0,477.0,498.7,516.4,539.0,556.7,573.7,595.4,613.2,635.7,653.5,670.3,692.1,709.9,732.5,750.2,767.1];
var BEE_ITEM_ROWS={"wipe door knobs":4,"clean cubbies":5,"sanitize cots cribs tables high chairs":6,"sanitize bottles cups":7,"sanitize toys":8,"clean sinks":9,"clean refrigerator":10,"clean bathroom changing table diaper can":11,"mop":12,"take garbage out sanitize trash can":13,"deep clean language center":15,"deep clean writing center":16,"deep clean math center":18,"deep clean music center":19,"deep clean dramatic play":21,"deep clean art center":22,"deep clean cars blocks center":24,"deep clean lego table":25,"deep clean discovery center":27,"wash trash cans":28};
var BATH_ROWS=[203.6,219.4,235.5,251.6,267.6,283.8,299.9,316.0,332.1,348.2];
var BATH_DAY_X=[183,207,227,254,278,300,323,344,371,395,416,440,461,488,512,533,557,578,605,629,650,674,695,722,746];
var BATH_ITEM_ROWS={"8 00 am cleaning":3,"10 00 am cleaning":4,"12 00 pm cleaning":5,"2 00 pm cleaning":6,"4 00 pm cleaning":7,"6 00 pm cleaning":8};
var IND_ROWS=[65.0,84.6,98.3,112.1,125.7,139.5,153.1,180.0,206.9,220.6,247.5,274.4,301.2,328.1,341.8,355.5,369.2,396.0,409.7,423.4,450.3,477.2,517.3,544.1,571.0,584.9,611.7,638.6,665.5,679.2,706.1,732.9];
var IND_DAY_COLS=[[320.2,358.9],[369.7,408.8],[419.6,472.8],[483.6,528.2],[539.0,570.5]];
var IND_ITEMS=["all entrances exits are kept clear of clutter","hallways and tops of walls are kept clean and clutter free","bathrooms are clean and well stocked with toilet paper soap and paper towels","staff purses and personal items are locked out of reach of children","cell phones are not in classroom","hands are washed by staff and children upon arrival to classroom","each child has brief health check by classroom teacher includes parent caregiver communication","all hygiene supplies are available soap paper towels toilet paper lined garbage can warm water","all areas are clean and clutter free garbage emptied floors swept toys and workspace bathroom clean","all chemicals are locked out of reach of children","air fresheners are not used","all electrical outlets are covered","furniture and equipment is in good repair check for broken toys accessories wrinkled disrepair rugs carpet","heavy toys items are stored on lowest shelf","window cords are adjusted to prevent strangulation","children s personal nap items are kept separated use of cubbies bags or storage containers","tables and chairs are not stacked while children are present","diapering supplies are gathered and within reach before beginning including a lined and covered foot operated garbage can","changing table is clean and free of any obstructions only changing pad","first aid kit is available in each room appropriately stocked","bottles sippy cups are labeled with first and last name","infants always placed on their back to sleep in cribs pack n plays","infant room all bottles have full name date and refrigerated immediately","cribs are free of soft bedding bumper pads pillows and stuffed toys","cribs have tight fitting mattress and a secure fitted sheet","highchairs are in good repair and cleaned and sanitized before after use","safety restraints are used on infant seats swings strollers and highchairs"];
function mid(a,b){return (a+b)/2;}
function norm(s){ s=String(s||'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ').trim(); return s.replace(/\s+/g,' '); }
function bestMatch(label,cands){ var n=norm(label); if(cands.indexOf(n)>=0) return n; var head=n.split(' ').slice(0,5).join(' '); for(var i=0;i<cands.length;i++){ var c=cands[i]; if(c.indexOf(head)===0 || n.indexOf(c.split(' ').slice(0,5).join(' '))===0) return c; } return null; }
function clean(s){ return String(s||'').replace(/[^\x20-\x7E -ÿ–—’‘“”·]/g,'').replace(/\s{2,}/g,' ').trim(); }
function items(text){ var out=[]; String(text||'').split(/\r?\n/).forEach(function(l){ l=l.trim(); if(!l) return; var flag=/^(⚠|❌|🚨)/.test(l); out.push([l.replace(/^[^\w]+/,''),flag?'flag':'ok']); }); return out; }
function wdi(s){ return (d2(s).getDay()+6)%7; }
function blockOf(d,ms){ var fm=addDays(ms,-wdi(ms)), m=addDays(d,-wdi(d)); return Math.round((d2(m)-d2(fm))/604800000); }
function fmtUS(s){ var p=s.split('-'); return p[1]+'/'+p[2]+'/'+p[0]; }
function mkCtx(page,font,bold,doc,collect){
  var H=page.getHeight(), rgb=PDFLib.rgb;
  var c={page:page,H:H,doc:doc,texts:[]};
  c.check=function(cx,top,st,size){ if(st==='flag') return; var cy=H-top, s=(size||8)*0.5, col=rgb(.05,.45,.15);
    page.drawLine({start:{x:cx-s,y:cy},end:{x:cx-s*.25,y:cy-s*.7},thickness:1.4,color:col,lineCap:1}); page.drawLine({start:{x:cx-s*.25,y:cy-s*.7},end:{x:cx+s,y:cy+s*.8},thickness:1.4,color:col,lineCap:1}); };
  c.box=function(x,top,w,h){ page.drawRectangle({x:x,y:H-top-h,width:w,height:h,color:rgb(1,1,1)}); };
  c.text=function(x,top,s,size,b,color,center,maxw){ s=clean(s); if(!s) return; size=size||8; var f=b?bold:font; if(maxw){ while(f.widthOfTextAtSize(s,size)>maxw&&size>5) size-=.5; } var w=f.widthOfTextAtSize(s,size); var px=center?x-w/2:x; if(collect){ c.texts.push({x:px,top:top,s:s,size:size,b:!!b,color:color||[0,0,0]}); return; } page.drawText(s,{x:px,y:H-top,size:size,font:f,color:rgb.apply(null,color||[0,0,0])}); };
  return c;
}
function stampBee(c,room,ms){
  var R=subsOf('cls',room,ms,monthEnd(ms));
  c.text(110,mid(BEE_ROWS[1],BEE_ROWS[2])+4,d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),10,true);
  c.text(108,mid(BEE_ROWS[2],BEE_ROWS[3])+4,room+'  ·  '+S.school,10,true,null,false,175);
  R.forEach(function(s){ var d=s.fields.Date, b=blockOf(d,ms), w=wdi(d); if(w>4||b<0||b>4) return; var col=b*5+w;
    items(s.fields.Items).forEach(function(it){ var key=bestMatch(it[0],Object.keys(BEE_ITEM_ROWS)); if(!key) return; var r=BEE_ITEM_ROWS[key]; c.check(mid(BEE_COLS[col],BEE_COLS[col+1]),mid(BEE_ROWS[r],BEE_ROWS[r+1]),it[1],8); }); });
}
function stampBath(c,room,ms){
  var R=subsOf('bath',room,ms,monthEnd(ms));
  c.text(100,mid(BATH_ROWS[0],BATH_ROWS[1])+4,room,9,true,null,false,75);
  c.text(80,mid(BATH_ROWS[1],BATH_ROWS[2])+4,d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),9,true);
  R.forEach(function(s){ var d=s.fields.Date, b=blockOf(d,ms), w=wdi(d); if(w>4||b<0||b>4) return; var col=b*5+w;
    items(s.fields.Items).forEach(function(it){ var key=bestMatch(it[0],Object.keys(BATH_ITEM_ROWS)); if(!key) return; var r=BATH_ITEM_ROWS[key]; c.check(BATH_DAY_X[col]+4.5,mid(BATH_ROWS[r],BATH_ROWS[r+1]),it[1],8); }); });
}
function stampWeekly(c,fk,room,mon,ROWS,COLS,LIST,dateRow,firstRow,withInit){
  var days=[0,1,2,3,4].map(function(i){return addDays(mon,i);});
  c.text(36,38,S.school,11,true); c.text(36,52,(fk==='ind'?'Room: '+room+'   ':'Playground   ')+'Week of '+fmtUS(mon),10,true,null,false,225);
  days.forEach(function(d,i){ c.text(mid(COLS[i][0],COLS[i][1]),mid(ROWS[dateRow],ROWS[dateRow+1])+3,d.slice(5).replace('-','/'),9,true,null,true); });
  subsOf(fk,room,mon,addDays(mon,4)).forEach(function(s){ var i=wdi(s.fields.Date); if(i>4) return;
    items(s.fields.Items).forEach(function(it){ var key=bestMatch(it[0],LIST); if(!key) return; var r=firstRow+LIST.indexOf(key); c.check(mid(COLS[i][0],COLS[i][1]),mid(ROWS[r],ROWS[r+1]),it[1],8); });
    if(withInit) c.text(mid(COLS[i][0],COLS[i][1]),mid(ROWS[25],ROWS[26])+3,String(s.fields['Staff Name']||'').slice(0,12),7,false,null,true); });
}
var PLAY_ROWS=[102.9,119.9,124.3,130.9,158.1,192.1,245.3,272.2,287.2,302.1,329.0,343.8,370.7,385.6,412.5,439.4,454.3,481.2,496.0,522.9,549.8,564.7,579.6,594.5,609.3,624.3,639.2];
var PLAY_DAY_COLS=[[287.0,345.3],[345.3,404.1],[404.1,463.7],[463.7,522.4],[522.4,569.5]];
var PLAY_ITEMS=["surfacing is free from broken glass nails trash and animal excrement","there are no visible cracks bending or warping rusting or breakage of any equipment","toys are clean and in good repair","there are no worn swing hangers or chains","there are no missing damaged or loose swing seats","there are no broken supports or anchors","there are no cement support footings that are exposed cracked or loose in the ground","there are no accessible sharp edges or points","there are no protruding bolt ends that have lost caps or covers","there are no loose bolts nuts and so forth that require tightening","there are no nails that have become loose","there are no splintered cracked or otherwise deteriorating wood","there is no chipped or peeling paint","trees shade covering maintained and in good repair","play areas free of foreign objects that may injure children","no unsafe equipment","ground cover adequate in play areas","ground free from debris litter rusted equipment","area free of any insect nest or infestation","equipment age appropriate and accessible"];
var EOD_ROWS=[194.9,210.4,225.9,241.5,257.0,272.5,287.9,303.4,318.9,334.4,349.8,365.3,380.9,396.4,411.9,427.4,442.9,458.3,473.8,489.3,504.8,520.4,535.9,551.4,566.8,582.3,597.8,613.3,634.5,650.0,665.5,681.0,696.4];
var EOD_COLS=[36.3,86.4,288.9,437.4,575.8];
function stampEod(c,ms){
  var R=subsOf('eod',null,ms,monthEnd(ms)).sort(function(a,b){ return a.fields.Date<b.fields.Date?-1:1; });
  c.text(165,152,S.school,11,true); c.text(480,152,d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),11,true);
  var by={}, order=[]; R.forEach(function(s){ var d=s.fields.Date; if(!by[d]){ by[d]=[]; order.push(d); } by[d].push(s); });
  order.forEach(function(d,k){ var r=k+1; if(r>=EOD_ROWS.length-1) return; var ty=mid(EOD_ROWS[r],EOD_ROWS[r+1])+3, st=[]; by[d].forEach(function(s){ var n=String(s.fields['Staff Name']||'').trim(); if(n&&st.indexOf(n)<0) st.push(n); });
    c.text(mid(EOD_COLS[0],EOD_COLS[1]),ty,d.slice(5).replace('-','/'),7,false,null,true); if(st[0]) c.text(EOD_COLS[1]+4,ty,st[0],7,false,null,false,195); if(st[1]) c.text(EOD_COLS[2]+4,ty,st[1],7,false,null,false,140); });
}
function tripsOf(mon){ var we=addDays(mon,4); return S.trips.filter(function(t){ return t.fields.Date>=mon&&t.fields.Date<=we&&t.fields.Destination; }); }
var LOGNAMES={san:'Sanitation & Safety Log',tmp:'Temperature Log (fridge / freezer / water)',sec:'Security & Sign-in Log',drl:'Fire & Emergency Drill Log'};
function stampLog(c,fk,ms){
  var R=subsOf(fk,fk==='tmp'?'Kitchen':'(building)',ms,monthEnd(ms)).sort(function(a,b){ return a.fields.Date<b.fields.Date?-1:1; });
  c.text(36,40,'Kid City USA - '+S.school,13,true); c.text(36,58,LOGNAMES[fk]+'   '+d2(ms).toLocaleDateString('en-US',{month:'long',year:'numeric'}),11,true);
  c.text(40,84,'Date',9,true); c.text(100,84,'What was recorded',9,true); c.text(640,84,'Completed by',9,true);
  var y=100; R.forEach(function(s){ if(y>560) return; var its=items(s.fields.Items).map(function(x){ return (x[1]==='flag'?'NEEDS ATTENTION: ':'')+x[0]; }).join('; ');
    c.text(40,y,fmtUS(s.fields.Date).slice(0,5),8); c.text(100,y,its,8,false,null,false,520); c.text(640,y,String(s.fields['Staff Name']||''),8,false,null,false,120); y+=16; });
}
var BLANK=null, LIBS=null;
function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=function(){ rej(new Error('Could not load the form tools. Check your connection.')); }; document.head.appendChild(s); }); }
function loadAll(){
  LIBS=LIBS||(window.PDFLib?Promise.resolve():loadScript('pdf-lib.min.js?v=117'));
  return LIBS.then(function(){ if(BLANK) return BLANK; return fetch('files/facility-forms-blank.pdf?v=1').then(function(r){ if(!r.ok) throw new Error('The blank forms file could not be found.'); return r.arrayBuffer(); }).then(function(b){ BLANK=b; return b; }); });
}
var KEY={classroom:'cls',bathroom:'bath',indoor:'ind',play:'out',eod:'eod',san:'san',tmp:'tmp',sec:'sec'};
/* D = room page data, from/to = ISO dates, forms = ['bee','bath','ind'] */
window.RoomForms={
 build:function(D,from,to,forms){
  S.school=D.school; RNG={from:from,to:to}; SUBS=[];
  var map=RM_LEGACY[D.school]||{};
  Object.keys(KEY).forEach(function(k){ (D.charts[k]||[]).forEach(function(c){ var room=map[c.room]||c.room; if(KEY[k]==='eod') room=null; else if(KEY[k]==='out') room='Playground'; else if(KEY[k]==='san'||KEY[k]==='sec') room='(building)'; else if(KEY[k]==='tmp') room='Kitchen';
    SUBS.push({fk:KEY[k],room:room,fields:{Date:c.date,'Staff Name':c.by||'',Items:(c.items||[]).map(function(i){ return (i.ok?'':'⚠ ')+i.t; }).join('\n')}}); }); });
  var plan=[]; // {form,room,key}
  function rooms(fk){ var seen={},out=[]; SUBS.forEach(function(x){ if(x.fk===fk && x.fields.Date>=from && x.fields.Date<=to && !seen[x.room]){ seen[x.room]=1; out.push(x.room); } }); return out.sort(); }
  var ms=monthStart(from), me=monthStart(to);
  var months=[]; for(var m=ms; m<=me; m=monthStart(addDays(monthEnd(m),1))) months.push(m);
  var mons=[]; for(var w=monday(from); w<=to; w=addDays(w,7)) mons.push(w);
  if(forms.indexOf('bee')>=0) rooms('cls').forEach(function(r){ months.forEach(function(m){ if(subsOf('cls',r,m,monthEnd(m)).length) plan.push({form:'bee',room:r,key:m}); }); });
  if(forms.indexOf('bath')>=0) rooms('bath').forEach(function(r){ months.forEach(function(m){ if(subsOf('bath',r,m,monthEnd(m)).length) plan.push({form:'bath',room:r,key:m}); }); });
  if(forms.indexOf('ind')>=0) rooms('ind').forEach(function(r){ mons.forEach(function(mo){ if(subsOf('ind',r,mo,addDays(mo,4)).length) plan.push({form:'ind',room:r,key:mo}); }); });
  if(forms.indexOf('out')>=0) mons.forEach(function(mo){ if(subsOf('out','Playground',mo,addDays(mo,4)).length) plan.push({form:'out',room:'Playground',key:mo}); });
  if(forms.indexOf('eod')>=0) months.forEach(function(m){ if(subsOf('eod',null,m,monthEnd(m)).length) plan.push({form:'eod',room:null,key:m}); });
  ['san','tmp','sec'].forEach(function(fk){ if(forms.indexOf(fk)>=0) months.forEach(function(m){ if(subsOf(fk,fk==='tmp'?'Kitchen':'(building)',m,monthEnd(m)).length) plan.push({form:fk,room:null,key:m}); }); });
  if(!plan.length) return Promise.resolve({pages:0});
  var PG={bee:0,bath:1,ind:2,out:3,eod:4};
  return loadAll().then(function(){ return PDFLib.PDFDocument.load(BLANK); }).then(function(src){
    return PDFLib.PDFDocument.create().then(function(out){ return out.embedFont(PDFLib.StandardFonts.Helvetica).then(function(font){ return out.embedFont(PDFLib.StandardFonts.HelveticaBold).then(function(bold){
      var p=Promise.resolve();
      plan.forEach(function(it){ p=p.then(function(){ return (PG[it.form]===undefined?Promise.resolve([out.addPage([792,612])]):out.copyPages(src,[PG[it.form]]).then(function(pg){ out.addPage(pg[0]); return pg; })).then(function(){ var page=out.getPage(out.getPageCount()-1), c=mkCtx(page,font,bold,out,false);
        if(it.form==='bee') stampBee(c,it.room,it.key); else if(it.form==='bath') stampBath(c,it.room,it.key); else if(it.form==='out') stampWeekly(c,'out','Playground',it.key,PLAY_ROWS,PLAY_DAY_COLS,PLAY_ITEMS,3,5,true); else if(it.form==='eod') stampEod(c,it.key); else if(it.form==='ind') stampWeekly(c,'ind',it.room,it.key,IND_ROWS,IND_DAY_COLS,IND_ITEMS,2,4,false); else stampLog(c,it.form,it.key); }); }); });
      return p.then(function(){ return out.save(); }).then(function(bytes){ return {pages:plan.length,bytes:bytes}; });
    }); }); });
  });
 }
};
})();
