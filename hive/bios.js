/* Hive staff bio cards: questions, bio writer, designer card. Shared by my-bio.html, files.html and parent.html */
(function(){
var EDU=['High school diploma / GED','Some college','CDA credential','Associate degree','Bachelor\'s degree','Master\'s degree or higher'];
var H45=[['yes','Yes, completed'],['progress','Working on it now'],['no','Not yet']];
window.BIOQ=[
 {k:'why',t:'Why did you choose early childhood education?',type:'area',ph:'What made you want to work with little ones?'},
 {k:'edu',t:'What is your highest level of education?',type:'select',opts:EDU,k2:'edufield',t2:'What did you study, and where? (optional)'},
 {k:'h45',t:'Have you completed your 45-hour child care training?',type:'h45',opts:H45},
 {k:'years',t:'How many years have you worked with children?',type:'num',ph:'e.g. 5'},
 {k:'hobbies',t:'What do you love to do outside of work?',type:'area',ph:'Hobbies, family, sports, cooking...'},
 {k:'fav',t:'What is your favorite thing to do with the children?',type:'area',ph:'A favorite activity, song, story or moment'},
 {k:'fun',t:'Tell families something fun about you.',type:'area',ph:'Languages you speak, a favorite book, anything you like!'}
];
function sent(t){t=String(t||'').trim();if(!t)return '';return /[.!?]$/.test(t)?t:t+'.';}
function lc(t){t=String(t||'').trim().replace(/[.!?]+$/,'');return t?t.charAt(0).toLowerCase()+t.slice(1):'';}
var EDUP={"High school diploma / GED":"","Some college":"college coursework","CDA credential":"a CDA credential","Associate degree":"an associate degree","Bachelor's degree":"a bachelor's degree","Master's degree or higher":"a master's degree or higher"};
window.bioWrite=function(a,name,role,school){
 a=a||{};var out=[];
 var intro='Hello, families! I\'m '+name+', and I\'m so happy to be part of the Kid City USA'+(school?' '+school:'')+' family.';
 if(a.why)intro+=' '+sent(a.why);
 out.push(intro);
 var y=parseInt(a.years,10),ed=EDUP[a.edu]!=null?EDUP[a.edu]:(a.edu||''),bits=[];
 if(y>0)bits.push(y+' year'+(y===1?'':'s')+' of experience working with children');
 if(ed)bits.push(ed+(a.edufield?' ('+a.edufield.replace(/[.]+$/,'')+')':''));
 if(a.h45==='yes')bits.push('my 45-hour child care training completed');
 else if(a.h45==='progress')bits.push('my 45-hour child care training underway');
 if(bits.length){var last=bits.pop();out.push('I bring '+(bits.length?bits.join(', ')+(bits.length>1?',':'')+' and ':'')+last+' to our classrooms every day.'+(a.fav?' My favorite thing to do with the children is to '+lc(a.fav)+'.':''));}
 else if(a.fav)out.push('My favorite thing to do with the children is to '+lc(a.fav)+'.');
 var m=[];
 if(a.hobbies)m.push('Outside the classroom, I love '+lc(a.hobbies)+'.');
 if(a.fun)m.push(sent(a.fun));
 if(m.length)out.push(m.join(' '));
 return out.join('\n\n');
};
var HEX="url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'><path d='M28 2 L54 17 L54 47 L28 62 L2 47 L2 17 Z' fill='none' stroke='%23F2C14E' stroke-width='2'/><path d='M28 64 L28 95 M2 80 L28 95 L54 80' fill='none' stroke='%23F2C14E' stroke-width='2'/></svg>\")";
var CSS='.bcs{max-width:760px;margin:0 auto;padding:4px 0 30px}'
+'.bc{position:relative;max-width:720px;margin:0 auto 34px;border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#FFF3C4 0%,#FFF8E1 38%,#FFFDF5 100%);border:3px solid #E0A100;box-shadow:0 10px 28px rgba(120,80,0,.22);font-family:Georgia,"Times New Roman",serif;color:#4A2C0A;page-break-inside:avoid}'
+'.bc:before{content:"";position:absolute;inset:0;opacity:.6;background-image:'+HEX+';background-size:56px 97px;pointer-events:none}'
+'.bc .bh{position:relative;height:118px;background:linear-gradient(135deg,#F5B400,#E08A00 55%,#C62F3A)}'
+'.bc .bh:before{content:"\\1F41D  \\2728  \\1F41D";position:absolute;left:18px;top:12px;font-size:20px;letter-spacing:6px;opacity:.9}'
+'.bc .bh:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:26px;background:#FFF3C4;border-radius:60% 60% 0 0/100% 100% 0 0}'
+'.bc .bs{position:absolute;right:16px;top:14px;color:#fff;font:700 11px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,.35)}'
+'.bc .bp{position:relative;display:flex;justify-content:center;margin-top:-78px}'
+'.bc .bp .ph{width:156px;height:156px;border-radius:50%;border:6px solid #fff;outline:4px solid #E0A100;background:#F9E7A8 center/cover no-repeat;box-shadow:0 6px 16px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-size:3.4rem}'
+'.bc .bb{position:relative;padding:12px 28px 30px;text-align:center}'
+'.bc .kick{font:700 12px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C62F3A;margin-top:10px}'
+'.bc h3{margin:4px 0 8px;font-size:2.1rem;line-height:1.1;color:#7a1f1f}'
+'.bc .br{display:inline-block;background:#C62F3A;color:#fff;font:700 12px Arial,sans-serif;padding:5px 14px;border-radius:99px;letter-spacing:.05em}'
+'.bc .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0 4px}'
+'.bc .chip{background:#fff;border:2px solid #F2C14E;color:#6b3f00;border-radius:99px;padding:4px 12px;font:600 12.5px Arial,sans-serif}'
+'.bc .dv{height:4px;width:96px;margin:18px auto;background:linear-gradient(90deg,#F5B400,#C62F3A);border-radius:4px}'
+'.bc .tx{text-align:left;font-size:1.06rem;line-height:1.7;background:rgba(255,255,255,.82);border-radius:18px;padding:20px 22px}'
+'.bc .tx p{margin:0 0 14px}.bc .tx p:last-child{margin:0}'
+'.bc .tx p:first-child{font-size:1.16rem;font-weight:700;color:#7a1f1f;line-height:1.5}'
+'@media(max-width:520px){.bc .bb{padding:10px 16px 24px}.bc h3{font-size:1.7rem}.bc .tx{padding:16px}}'
+'@media print{.bc{box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
window.bioStyle=function(){if(document.getElementById('bioCss'))return;var s=document.createElement('style');s.id='bioCss';s.textContent=CSS;document.head.appendChild(s);};
window.bioCss=CSS;
var ROLEN={Support:'Classroom Support',Teacher:'Teacher',Director:'Director'};
window.bioCard=function(r,school){
 var a=r.a||{},chips=[];
 if(a.edu)chips.push('🎓 '+esc(a.edu));
 if(a.h45==='yes')chips.push('✅ 45-hour training complete');else if(a.h45==='progress')chips.push('📘 45-hour training in progress');
 var y=parseInt(a.years,10);if(y>0)chips.push('🧸 '+y+' year'+(y===1?'':'s')+' with children');
 var paras=String(r.bio||'').split(/\n\s*\n/).map(function(p){return '<p>'+esc(p)+'</p>';}).join('');
 return '<div class="bc"><div class="bh"><span class="bs">Kid City USA'+(school?' · '+esc(school):'')+'</span></div>'
 +'<div class="bp"><div class="ph"'+(r.photo?' style="background-image:url(data:image/jpeg;base64,'+r.photo+')"':'')+'>'+(r.photo?'':'🐝')+'</div></div>'
 +'<div class="bb"><div class="kick">Meet your teacher</div><h3>'+esc(r.name)+'</h3>'+(r.role?'<span class="br">'+esc(ROLEN[r.role]||r.role)+'</span>':'')
 +(chips.length?'<div class="chips">'+chips.map(function(c){return '<span class="chip">'+c+'</span>';}).join('')+'</div>':'')
 +'<div class="dv"></div><div class="tx">'+paras+'</div></div></div>';
};
})();
