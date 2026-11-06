/* Fills the official Bear Phonics Academy Registration Packet (FL rev 10-2026, pages 1-12) with a family's answers and signatures.
   Page images are in files/packet/p1..p12.jpg (rendered from the real PDF). Coordinates are PDF points (612 x 792), top-left origin.
   PKT.render(D, sigs, photo) -> canvases; PKT.pdf(canvases) -> Uint8Array. Same spec drives the on-screen preview and the final PDF. */
(function(){
var IMG={};
function loadImg(p){return IMG[p]||(IMG[p]=new Promise(function(res,rej){var i=new Image();i.onload=function(){res(i)};i.onerror=function(){rej(new Error('Could not load packet page '+p))};i.src='files/packet/p'+p+'.jpg?v=1';}));}
/* [page, kind, x, y, key, width]  kinds: t text, c check (key=value test 'k=v' or 'k'), i initials, d date, s signature, n name-as-text */
var T=function(p,x,y,k,w,sz){return {p:p,k:'t',x:x,y:y,key:k,w:w,sz:sz||9};};
var C=function(p,x,y,test){return {p:p,k:'c',x:x,y:y,test:test};};
var I=function(p,x,y){return {p:p,k:'i',x:x,y:y};};
var S=function(p,x,y,dx,dy,w){return {p:p,k:'s',x:x,y:y,dx:dx,dy:dy,w:w||190};};
var SPEC=[
/* ---- page 1 Registration Form ---- */
T(1,134,217,'cname',270),T(1,461,217,'dob',120),T(1,122,237,'nick',130),
C(1,304,233,'gender=Male'),C(1,348,233,'gender=Female'),C(1,401,233,'gender=Prefer not to say'),
T(1,104,251,'addr',360),T(1,483,251,'zip',60),
T(1,141,289,'p1name',170),T(1,410,289,'p2name',190),T(1,96,304,'p1rel',215),T(1,366,304,'p2rel',235),
T(1,130,318,'p1addr',180),T(1,398,318,'p2addr',200),T(1,89,332,'p1cell',85),T(1,228,332,'p1work',85),T(1,359,332,'p2cell',80),T(1,497,332,'p2work',100),
T(1,70,346,'p1email',240),T(1,339,346,'p2email',260),T(1,85,361,'p1emp',225),T(1,354,361,'p2emp',245),
T(1,71,453,'k0n',200),T(1,331,453,'k0r',90),T(1,457,453,'k0p',140),T(1,71,467,'k1n',200),T(1,331,467,'k1r',90),T(1,457,467,'k1p',140),T(1,71,481,'k2n',200),T(1,331,481,'k2r',90),T(1,457,481,'k2p',140),
T(1,142,517,'allergies',450),C(1,43,533,'h_asthma'),C(1,99,533,'h_conv'),C(1,214,533,'h_diab'),C(1,274,533,'h_heart'),C(1,360,533,'h_bleed'),T(1,71,550,'h_other',520),
S(1,43,671,0,0),{p:1,k:'d',x:422,y:671},
/* ---- page 2 Authorization for Medical Treatment ---- */
T(2,174,272,'p1name',125),T(2,390,272,'cname',200),T(2,141,293,'physician',210),T(2,451,293,'physPhone',140),T(2,149,314,'hospital',200),T(2,446,314,'dentist',150),T(2,155,335,'insurance',195),T(2,448,335,'policy',145),
S(2,43,377,0,0),{p:2,k:'d',x:424,y:377},
/* ---- page 3 All About Me ---- */
T(3,118,156,'cname',215),T(3,416,156,'dob',70),T(3,524,156,'age',60),
C(3,277,208,'cared=home'),C(3,411,208,'cared=center'),C(3,43,235,'cared=daycare'),C(3,186,235,'cared=relative'),
C(3,162,262,'lives=Mom & Dad'),C(3,265,262,'lives=Mom'),C(3,328,262,'lives=Dad'),C(3,387,262,'lives=Other'),T(3,448,262,'livesOther',70),
T(3,228,290,'sibs',360),C(3,441,310,'dayType=Structured'),C(3,296,337,'dayType=Flexible'),T(3,205,344,'lang',78),T(3,235,364,'newSit',350),
C(3,141,415,'appetite=Yes'),C(3,195,415,'appetite=No'),C(3,341,415,'feeds=Yes'),C(3,395,415,'feeds=No'),C(3,446,415,'feeds=With help'),
T(3,126,443,'favFoods',460),T(3,173,463,'dislikes',415),T(3,414,483,'allergies',175),
C(3,43,504,'h_asthma'),C(3,123,504,'h_conv'),C(3,286,504,'h_diab'),C(3,371,504,'h_heart'),C(3,43,531,'h_bleed'),T(3,80,558,'h_other',510),
T(3,78,609,'naps',14),T(3,198,609,'napFrom',62),T(3,290,609,'napTo',75),T(3,502,609,'bedtime',85),T(3,213,629,'comfort',380),T(3,185,650,'rest',405),T(3,272,701,'activities',320),T(3,398,721,'learning',195,8),
/* ---- page 4 All About Me (continued) ---- */
{p:4,k:'dev'},
C(4,150,520,'potty=Yes'),C(4,198,520,'potty=No'),C(4,243,520,'potty=In progress'),C(4,485,520,'asks=Yes'),C(4,533,520,'asks=No'),
T(4,225,542,'toiletWords',365),T(4,180,587,'goals1',405),T(4,50,608,'goals2',540),T(4,370,623,'describe',220),T(4,189,641,'friends',400),T(4,289,659,'anything1',300),T(4,50,680,'anything2',540),
C(4,103,697,'vol_read'),C(4,210,697,'vol_share'),C(4,350,697,'vol_help'),C(4,43,721,'vol_field'),
/* ---- page 5 Emergency Data Card ---- */
T(5,118,197,'cname',125),T(5,275,197,'age',30),T(5,382,197,'dob',85),T(5,93,217,'addrFull',360),
T(5,147,237,'p1name',105),T(5,286,237,'p1cell',160),T(5,78,257,'p1work',145),T(5,267,257,'p1home',190),
T(5,147,277,'p2name',105),T(5,286,277,'p2cell',160),T(5,78,297,'p2work',145),T(5,267,297,'p2home',190),
T(5,80,371,'k0n',135),T(5,291,371,'k0r',45,8),T(5,366,371,'k0p',90),T(5,534,371,'k0o',60,8),
T(5,80,391,'k1n',135),T(5,291,391,'k1r',45,8),T(5,366,391,'k1p',90),T(5,534,391,'k1o',60,8),
T(5,80,411,'k2n',135),T(5,291,411,'k2r',45,8),T(5,366,411,'k2p',90),T(5,534,411,'k2o',60,8),
T(5,80,432,'k3n',135),T(5,291,432,'k3r',45,8),T(5,366,432,'k3p',90),T(5,534,432,'k3o',60,8),
T(5,180,482,'allergies',400),
C(5,43,523,'h_asthma'),C(5,122,523,'h_conv'),C(5,284,523,'h_diab'),C(5,368,523,'h_heart'),C(5,43,550,'h_bleed'),T(5,80,576,'h_other',510),
T(5,147,596,'physPhone2',205),T(5,458,596,'hospital',135),{p:5,k:'photo'},
S(5,43,705,0,0,150),{p:5,k:'d',x:230,y:705},
/* ---- page 7 Nutrition policy ---- */
S(7,43,720,0,0),{p:7,k:'d',x:423,y:720},
/* ---- page 8 Photo release ---- */
T(8,55,186,'p1name',205),T(8,45,204,'cname',205),C(8,43,289,'photo=yes'),C(8,195,289,'photo=class'),C(8,43,315,'photo=no'),
S(8,43,360,0,0),{p:8,k:'d',x:424,y:360},
/* ---- page 9 Food-related activities ---- */
T(9,56,245,'p1name',215),T(9,202,264,'cname',215),
{p:9,k:'init',x:68,y:360,test:'food=1'},{p:9,k:'init',x:68,y:394,test:'food=2'},{p:9,k:'init',x:68,y:446,test:'food=3'},{p:9,k:'init',x:68,y:499,test:'food=4'},
T(9,270,532,'foodList',320),S(9,43,701,0,0),{p:9,k:'d',x:424,y:701},
/* ---- page 10 Financial agreement (initial each) ---- */
I(10,64,182),I(10,64,227),I(10,64,271),I(10,64,314),I(10,64,359),I(10,64,419),I(10,64,462),I(10,64,491),I(10,64,535),I(10,64,595),I(10,64,638),
S(10,43,728,0,0,170),{p:10,k:'d',x:230,y:728},
/* ---- page 11 Handbook receipt ---- */
T(11,53,126,'p1name',145),T(11,290,126,'cname',145),S(11,43,184,0,0),{p:11,k:'d',x:423,y:184},
{p:11,k:'t',x:75,y:235,key:'cname',w:150,sz:9},{p:11,k:'t',x:446,y:235,key:'today',w:90,sz:9},
/* ---- page 12 Flu acknowledgment (year 1) ---- */
T(12,171,242,'p1name',130),T(12,388,242,'cname',190),{p:12,k:'t',x:178,y:293,key:'today',w:80,sz:8},S(12,266,309,0,0,120)
];
var DEVX=[320,382,449,527],DEVY=[211,237,262,288,313,339,364,390,415,441,467];
var DEVOPT=['Confident','Learning','Needs help','Not yet / N/A'];
function today(){var d=new Date();return (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();}
function initials(n){return String(n||'').split(/\s+/).filter(Boolean).map(function(w){return w[0].toUpperCase();}).join('').slice(0,3);}
function val(D,k){return k==='today'?today():(D[k]==null?'':String(D[k]));}
function test(D,t){var i=t.indexOf('=');if(i<0)return !!D[t];return String(D[t.slice(0,i)]||'')===t.slice(i+1);}
function fit(x,txt,w,sz,S){var s=sz;x.font=(s*S)+'px Arial';while(s>6&&x.measureText(txt).width>w*S){s-=0.5;x.font=(s*S)+'px Arial';}return s;}
function loadSig(png){return new Promise(function(res){if(!png)return res(null);var i=new Image();i.onload=function(){res(i)};i.onerror=function(){res(null)};i.src=png;});}
async function renderPage(p,D,sigs,photo,W){
  var img=await loadImg(p),S=W/612,c=document.createElement('canvas');c.width=W;c.height=Math.round(792*S);var x=c.getContext('2d');
  x.drawImage(img,0,0,c.width,c.height);x.fillStyle='#10307a';x.textBaseline='alphabetic';
  var ini=initials(D.p1name);
  for(var n=0;n<SPEC.length;n++){var f=SPEC[n];if(f.p!==p)continue;
    if(f.k==='t'){var t=val(D,f.key);if(!t)continue;fit(x,t,f.w,f.sz,S);x.fillText(t,f.x*S,(f.y+10)*S);}
    else if(f.k==='c'){if(!test(D,f.test))continue;x.font='bold '+(11*S)+'px Arial';x.fillText('X',(f.x+2.8)*S,(f.y+9.6)*S);}
    else if(f.k==='i'){x.font='italic '+(10*S)+'px Arial';x.fillText(ini,f.x*S,(f.y+10)*S);}
    else if(f.k==='init'){if(!test(D,f.test))continue;x.font='italic '+(10*S)+'px Arial';x.fillText(ini,f.x*S,(f.y+10)*S);}
    else if(f.k==='d'){if(!sigs[p])continue;x.font=(9*S)+'px Arial';x.fillText(today(),f.x*S,(f.y-3)*S);}
    else if(f.k==='s'){var sg=sigs[p];if(!sg)continue;var im=await loadSig(sg);if(!im)continue;var bw=f.w,bh=bw*im.height/im.width;if(bh>26){bh=26;bw=26*im.width/im.height;}x.drawImage(im,(f.x+f.dx)*S,(f.y+(f.dy||0)-bh+2)*S,bw*S,bh*S);}
    else if(f.k==='dev'){x.font='bold '+(11*S)+'px Arial';DEVY.forEach(function(y,i){var o=DEVOPT.indexOf(D['dev'+i]);if(o>=0)x.fillText('X',(DEVX[o]-3)*S,(y+14)*S);});}
    else if(f.k==='photo'){if(!photo)continue;var pi=await loadSig(photo);if(!pi)continue;var bx=438,by=162,bw2=126,bh2=146,r=Math.min(bw2/pi.width,bh2/pi.height);x.drawImage(pi,(bx+(bw2-pi.width*r)/2)*S,(by+(bh2-pi.height*r)/2)*S,pi.width*r*S,pi.height*r*S);}
  }
  return c;
}
window.PKT={pages:[1,2,3,4,5,7,8,9,10,11,12],signPages:[1,2,5,7,8,9,10,11,12],reqPages:[1,2,5,10,11],
 renderPage:renderPage,
 render:async function(D,sigs,photo,W){var out=[];for(var i=0;i<PKT.pages.length;i++)out.push(await renderPage(PKT.pages[i],D,sigs||{},photo,W||1100));return out;},
 pdf:async function(cvs){var doc=await PDFLib.PDFDocument.create();for(var i=0;i<cvs.length;i++){var j=cvs[i].toDataURL('image/jpeg',.82).split(',')[1],bin=atob(j),u=new Uint8Array(bin.length);for(var k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);var im=await doc.embedJpg(u),pg=doc.addPage([612,792]);pg.drawImage(im,{x:0,y:0,width:612,height:792});}return doc.save();}
};
})();
