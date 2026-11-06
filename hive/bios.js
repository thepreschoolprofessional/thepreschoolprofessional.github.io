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
window.bioWrite=function(a,name,role,school){
 a=a||{};var out=[];
 var intro='Hello, families! I\'m '+name+(role?', a '+String(role).toLowerCase().replace(/^a /,''):'')+' at Kid City USA'+(school?' '+school:'')+'.';
 if(a.why)intro+=' Why early childhood? '+sent(a.why);
 out.push(intro);
 var c=[];
 if(a.edu){c.push('My education: '+a.edu+(a.edufield?' ('+a.edufield.replace(/[.]+$/,'')+')':'')+'.');}
 if(a.h45==='yes')c.push('I have completed my 45-hour child care training.');
 else if(a.h45==='progress')c.push('I am currently completing my 45-hour child care training.');
 var y=parseInt(a.years,10);if(y>0)c.push('I have '+y+' year'+(y===1?'':'s')+' of experience working with children.');
 if(c.length)out.push(c.join(' '));
 var m=[];
 if(a.fav)m.push('My favorite thing to do with the children: '+sent(a.fav));
 if(a.hobbies)m.push('Outside the classroom, I love: '+sent(a.hobbies));
 if(a.fun)m.push('A little more about me: '+sent(a.fun));
 if(m.length)out.push(m.join(' '));
 return out.join('\n\n');
};
var CSS='.bc{position:relative;max-width:720px;margin:14px auto;border-radius:22px;overflow:hidden;background:#FFF8E1;border:3px solid #E0A100;box-shadow:0 6px 18px rgba(120,80,0,.18);font-family:Georgia,"Times New Roman",serif;color:#4A2C0A;page-break-inside:avoid}'
+'.bc:before{content:"";position:absolute;inset:0;opacity:.55;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'97\' viewBox=\'0 0 56 97\'><path d=\'M28 2 L54 17 L54 47 L28 62 L2 47 L2 17 Z\' fill=\'none\' stroke=\'%23F2C14E\' stroke-width=\'2\'/><path d=\'M28 64 L28 95 M2 80 L28 95 L54 80\' fill=\'none\' stroke=\'%23F2C14E\' stroke-width=\'2\'/></svg>");background-size:56px 97px}'
+'.bc .bh{position:relative;height:96px;background:linear-gradient(135deg,#F5B400,#E08A00 60%,#C62F3A);}'
+'.bc .bh:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:22px;background:#FFF8E1;border-radius:60% 60% 0 0/100% 100% 0 0}'
+'.bc .bs{position:absolute;right:14px;top:10px;color:#fff;font:700 11px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,.3)}'
+'.bc .bp{position:relative;display:flex;justify-content:center;margin-top:-64px}'
+'.bc .bp .ph{width:140px;height:140px;border-radius:50%;border:6px solid #fff;outline:4px solid #E0A100;background:#F9E7A8 center/cover no-repeat;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:3rem}'
+'.bc .bb{position:relative;padding:10px 24px 24px;text-align:center}'
+'.bc h3{margin:8px 0 2px;font-size:1.7rem;color:#7a1f1f}'
+'.bc .br{display:inline-block;background:#C62F3A;color:#fff;font:700 12px Arial,sans-serif;padding:4px 12px;border-radius:99px;letter-spacing:.04em}'
+'.bc .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0}'
+'.bc .chip{background:#fff;border:2px solid #F2C14E;color:#6b3f00;border-radius:99px;padding:3px 11px;font:600 12px Arial,sans-serif}'
+'.bc .tx{text-align:left;font-size:1rem;line-height:1.55;background:rgba(255,255,255,.78);border-radius:14px;padding:14px 16px;border-left:5px solid #C62F3A}'
+'.bc .tx p{margin:0 0 10px}.bc .tx p:last-child{margin:0}'
+'@media print{.bc{box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
window.bioStyle=function(){if(document.getElementById('bioCss'))return;var s=document.createElement('style');s.id='bioCss';s.textContent=CSS;document.head.appendChild(s);};
window.bioCss=CSS;
window.bioCard=function(r,school){
 var a=r.a||{},chips=[];
 if(a.edu)chips.push('🎓 '+esc(a.edu));
 if(a.h45==='yes')chips.push('✅ 45-hour training complete');else if(a.h45==='progress')chips.push('📘 45-hour training in progress');
 var y=parseInt(a.years,10);if(y>0)chips.push('🧸 '+y+' year'+(y===1?'':'s')+' with children');
 var paras=String(r.bio||'').split(/\n\s*\n/).map(function(p){return '<p>'+esc(p)+'</p>';}).join('');
 return '<div class="bc"><div class="bh"><span class="bs">Kid City USA'+(school?' · '+esc(school):'')+'</span></div>'
 +'<div class="bp"><div class="ph"'+(r.photo?' style="background-image:url(data:image/jpeg;base64,'+r.photo+')"':'')+'>'+(r.photo?'':'🐝')+'</div></div>'
 +'<div class="bb"><h3>'+esc(r.name)+'</h3>'+(r.role?'<span class="br">'+esc(r.role)+'</span>':'')
 +(chips.length?'<div class="chips">'+chips.map(function(c){return '<span class="chip">'+c+'</span>';}).join('')+'</div>':'')
 +'<div class="tx">'+paras+'</div></div></div>';
};
})();
