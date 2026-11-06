/* Parent portal pieces: menu, newsletter, lesson plans, message board, handbook guides and Parent Training.
   Content for the guides and training comes from the Kid City USA Parent Handbook, checked against the Employee Handbook 2026-27 and its training.
   Loaded by parent.html (and used read-only by staff who preview the portal). */
(function(){
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]});};
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function monthName(m){var p=(m||'').split('-');return p.length===2?MONTHS[+p[1]-1]+' '+p[0]:'';}
var PP=null,BLOBS={};
function pin(){return sessionStorage.getItem('hivePin');}
function school(){return window.PP_SCHOOL?window.PP_SCHOOL():'';}
async function call(action,extra){
  var r=await fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({pin:pin(),action:action,school:school()},extra||{}))});
  return r.json();
}
async function load(force){
  if(PP&&!force&&PP._s===school())return PP;
  var j=await call('pp_list'); if(j&&!j.error){j._s=school();PP=j;} else {PP=null; throw new Error((j&&j.error)||'Could not load');}
  return PP;
}
async function blobUrl(file){
  if(BLOBS[file])return BLOBS[file];
  var j=await call('pp_get',{name:file}); if(j.error)throw new Error(j.error);
  var bin=atob(j.b64),u8=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  var ext=(file.split('.').pop()||'').toLowerCase();var type=ext==='pdf'?'application/pdf':(ext==='png'?'image/png':'image/jpeg');
  BLOBS[file]=URL.createObjectURL(new Blob([u8],{type:type}));return BLOBS[file];
}
function best(kind){
  var L=(PP.items||[]).filter(function(x){return x.kind===kind});
  L.sort(function(a,b){return (b.month||'').localeCompare(a.month||'')||(b.at||'').localeCompare(a.at||'');});
  return L[0]||null;
}
function stale(it){return it&&it.month&&it.month!==PP.month;}
function needSchool(box){box.innerHTML='<div class="empty">Pick your school first (tap the card for Documents &amp; Registration, then choose a school).</div>';}
function fallbackLink(re){
  var L=(window.PP_RESOURCES&&window.PP_RESOURCES())||[];
  for(var i=0;i<L.length;i++){var t=(L[i].Title||'');if(re.test(t)&&L[i].URL)return L[i];}
  return null;
}
function docHtml(it,id){
  if(it.form)return newsletterHtml(it);
  return '<div id="'+id+'"><div class="empty">Opening… 🐝</div></div>';
}
async function mountFile(it,id){
  var box=document.getElementById(id);if(!box)return;
  try{
    var u=await blobUrl(it.file);
    var open='<a class="go g1" style="display:block;margin:10px 0" href="'+u+'" target="_blank" rel="noopener">Open full screen / print →</a>';
    box.innerHTML=(it.ext==='pdf'?'<iframe src="'+u+'" style="width:100%;height:78vh;border:2px solid #eadfce;border-radius:14px;background:#fff"></iframe>':'<img src="'+u+'" alt="'+esc(it.title)+'" style="width:100%;border-radius:14px;box-shadow:0 4px 14px rgba(74,58,48,.15)">')+open;
  }catch(e){box.innerHTML='<div class="empty">Could not open this file right now.</div>';}
}
function newsletterHtml(it){
  var f=it.form||{},h='<div class="result" style="border-top-color:#1d7fd1"><h2>📰 '+esc(it.title)+'</h2><div class="note">'+esc(monthName(it.month))+'</div>';
  if(f.welcome)h+='<p style="line-height:1.5;margin-bottom:14px">'+esc(f.welcome).replace(/\n/g,'<br>')+'</p>';
  if((f.dates||[]).length){h+='<div class="section">📅 Important dates</div><div class="reslist">'+f.dates.map(function(d){return '<div class="rescard" style="cursor:default"><div class="em">📌</div><div class="txt"><h3>'+esc(d[0])+'</h3><p>'+esc(d[1])+'</p></div></div>';}).join('')+'</div>';}
  if((f.reminders||[]).length){h+='<div class="section">✅ Reminders</div><ul style="margin:0 0 10px 22px;line-height:1.55">'+f.reminders.map(function(r){return '<li>'+esc(r)+'</li>';}).join('')+'</ul>';}
  if((f.news||[]).length){h+='<div class="section">🐝 News from the classrooms</div>'+f.news.map(function(n){return '<div class="rescard" style="cursor:default;display:block"><h3>'+esc(n[0]||'Our school')+'</h3><p style="font-size:.92rem;color:var(--ink);margin-top:4px">'+esc(n[1]).replace(/\n/g,'<br>')+'</p></div>';}).join('');}
  if(f.birthdays)h+='<div class="section">🎂 Birthdays</div><p style="line-height:1.5">'+esc(f.birthdays).replace(/\n/g,'<br>')+'</p>';
  if(f.thanks)h+='<div class="section">💛 Thank you</div><p style="line-height:1.5">'+esc(f.thanks).replace(/\n/g,'<br>')+'</p>';
  return h+'</div>';
}
async function showDoc(kind,boxId,label,re){
  var box=document.getElementById(boxId);if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  try{
    await load(true);var it=best(kind),h='';
    if(it){
      if(stale(it))h+='<div class="note" style="background:#fff3d6;border-left:5px solid #ffb13d;padding:10px 14px;border-radius:10px;color:var(--ink);font-weight:700">This is the '+esc(monthName(it.month))+' '+esc(label)+'. The new one will be posted soon.</div>';
      h+=docHtml(it,boxId+'_f');box.innerHTML=h;if(it.file)mountFile(it,boxId+'_f');return;
    }
    var fb=re?fallbackLink(re):null;
    box.innerHTML=fb?'<div class="note" style="background:#fff3d6;border-left:5px solid #ffb13d;padding:10px 14px;border-radius:10px;color:var(--ink);font-weight:700">The newest '+esc(label)+' is being posted. Here is the last one we have.</div><a class="go g1" style="display:block" href="'+esc(fb.URL)+'">'+esc(fb.Title)+' →</a>':'<div class="empty">The '+esc(label)+' will be posted here soon. 🐝</div>';
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
}
async function showBoard(){
  var box=document.getElementById('boardBox');if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  try{
    await load(true);var h='';
    var B=PP.board||[];
    h+='<div class="section">📌 Messages from your school</div>';
    h+=B.length?B.map(function(b){return '<div class="rescard" style="display:block;cursor:default;'+(b.pinned?'border-left:6px solid #e0457b;':'')+'"><h3>'+(b.pinned?'📌 ':'')+esc(b.title)+'</h3><p style="font-size:.92rem;color:var(--ink);margin:6px 0">'+esc(b.message).replace(/\n/g,'<br>')+'</p><p style="font-size:.78rem">'+esc((b.at||'').slice(0,10))+(b.by?' · '+esc(b.by):'')+'</p></div>';}).join(''):'<div class="empty">No new messages right now.</div>';
    var F=(PP.items||[]).filter(function(x){return x.kind==='flyer'});
    if(F.length){h+='<div class="section">🖼️ Flyers</div><div class="reslist">'+F.map(function(x){return '<a class="rescard" href="javascript:void(0)" onclick="PPA.openFile(\''+esc(x.file)+'\')"><div class="em">🖼️</div><div class="txt"><h3>'+esc(x.title)+'</h3><p>'+(x.expires?'Until '+esc(x.expires):'Tap to open')+'</p></div><div class="arrow">→</div></a>';}).join('')+'</div>';}
    box.innerHTML=h;
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
}
/* ---------- handbook guides ---------- */
var G={
bring:{h:'🎒 What to Bring',intro:'From the Kid City USA Parent Handbook. Please label everything with your child\'s first and last name.',
 s:[
 {t:'Every month',p:['160 wipes and a box of tissues for each child. $5.00 is added to your account for the month if wipes and tissues are not received.']},
 {t:'Every day',p:['The Kid City USA uniform shirt. If your child arrives without it, we give them one and $18 is charged to your account.','Play-friendly clothes your child can dress in alone, especially while potty training. Closed-toe shoes only, no open-toed shoes.','Bring a few changes of seasonal clothes for emergencies.']},
 {t:'Change of clothes (labeled)',p:['Infants and toddlers: 3 changes of clothes.','Preschoolers: 2 changes of clothes.','School-aged children do not need to leave a change of clothes.','When soiled clothes are sent home, bring a replacement on your child\'s next school day.']},
 {t:'Infants and toddlers',p:['Diapers: one week\'s worth at minimum.','A fitted crib sheet. A small receiving-type blanket is allowed for children 1 year and up, NEVER for infants.','Infant cribs stay free of soft toys, bumpers, boppies, jewelry, amber beads, bibs and pacifier attachments. If your baby must sleep sitting up, a doctor\'s note must be on file.']},
 {t:'Nap time',p:['A fitted sheet for the cot (labeled).','Nap bedding goes home every Friday to be washed and comes back on Monday.']},
 {t:'Sunscreen, bug spray and diaper ointment',p:['Please put sunscreen and insect repellent on before you arrive.','If we need to apply more, bring it in the original container labeled with your child\'s first and last name, and complete a Medication Authorization form. Diaper ointment needs the form too.']},
 {t:'Please leave at home',p:['Toys from home, unless the teacher asks for them.','Diaper bags, backpacks and bags of any type. They cannot be brought in or stored, for safety and security.','Outside food. Sealed, store-bought treats for a special occasion are welcome, but call the center first and complete the Food-Related Activities permission form.']},
 {t:'School-aged children',p:['A summer camp shirt for field trips. There is a $40 annual Summer Camp Activity and Shirt Fee for school-aged children.']}
 ],note:'Not sure about something? Ask your director. Supplies can change, and your school will tell you if anything is different.'},
fees:{h:'💵 Tuition, Fees & Holidays',intro:'From the Kid City USA Parent Handbook.',
 s:[
 {t:'Tuition',p:['Tuition is due Friday for the upcoming week. Put your child\'s name at the bottom of any check.','If tuition is not paid by close of business Monday, a $25.00 late fee is added and your child may not attend until it is paid in full.','A child cannot stay in care if payment is more than five business days behind.']},
 {t:'Other fees',p:['$1.00 per minute per child after closing time. It is due at pick-up or before your child attends the next day.','$5.00 for every 15 minutes past the one hour you have to pick up an ill child.','$25.00 for a returned check. After the first returned check, no more checks are accepted.','$18 if your child comes without the uniform shirt. $5.00 a month if wipes and tissues are not received. $40 annual summer camp fee (school-aged only).','Registration fees are due when your child enrolls.']},
 {t:'Holidays and vacation',p:['Closed: New Year\'s Day, Good Friday, Memorial Day, Fourth of July, Labor Day, Thanksgiving Thursday and Friday, and December 24, 25 and 26. On New Year\'s Eve we close at 5:00 pm.','A holiday on Saturday is observed the Friday before. A holiday on Sunday is observed the Monday after.','No tuition credit is given for holidays or vacation time. This is built into our prices. See the Closures card for this year\'s exact dates.']},
 {t:'Absences and leaving',p:['If your child will be absent, call the center within 1 hour of their scheduled arrival time.','If your child is sick or in the hospital for a long time, talk to your director. Help is decided case by case.','Please give two (2) weeks\' notice before withdrawing your child.']},
 {t:'Hours',p:['Open Monday through Friday, 6:30 AM to 5:30 PM. Children must be picked up by closing time. If you will be late, please call the center.']}
 ],note:'Amounts above are from the Parent Handbook. Your director can answer any question about your account.'},
sick:{h:'🤒 When Your Child Is Sick',intro:'From the Kid City USA Parent Handbook. One sick child puts every child at risk, so thank you for helping.',
 s:[
 {t:'Please keep your child home for',p:['Fever of 101 degrees or higher, vomiting, diarrhea, rashes or bumps nobody can explain, pink eye, colored nasal discharge, head lice, stiff neck.','Severe coughing, difficult or rapid breathing, yellowish skin or eyes, unusually dark urine or grey or white stool, or COVID-19.','A child sent home from public school for illness may not attend our center that day.']},
 {t:'If your child gets sick here',p:['We call you right away. You must pick up within one hour. After that, $5.00 is charged for every 15 minutes.','Please keep your phone numbers current so we can always reach you.']},
 {t:'Coming back',p:['Your child must be symptom free for 24 hours. In some cases a doctor\'s note is needed.','Head lice: your child must be checked at the front office and be completely nit free (no eggs).']},
 {t:'Medicine',p:['A Medication Authorization form must be filled out before we can give any medicine. Medicine stays at the front desk, locked up.','We do not give over-the-counter medicine. If a prescription can be given at home, please give it before you sign your child in.']},
 {t:'Allergies',p:['Give your director a written notice and a doctor\'s note: the allergy, how to avoid it, and the doctor\'s order for medicine. We train staff on your child\'s plan.']}
 ],note:'We report certain infectious diseases to the Health Department as the law requires.'},
pick:{h:'🚪 Drop-Off, Pick-Up & Safety',intro:'From the Kid City USA Parent Handbook and our staff training.',
 s:[
 {t:'Drop-off',p:['Carry or walk your child inside, sign them in with their first and last name, and walk them into their classroom with a teacher.','A sleeping child is woken up on arrival.']},
 {t:'Pick-up',p:['Sign your child out every time. We release a child only to an adult on the authorized pick-up list who shows photo ID, every time.','To add or remove someone from the list, meet with the director in person. We cannot change the list by phone.','Anyone not on the list needs your written permission. If someone not listed tries to pick up, we will not release your child and the director calls you right away.','We cannot release a child to anyone who appears impaired. If there is a custody order, bring a copy to the director.']},
 {t:'Keeping everyone safe',p:['Our front door has a keypad and cameras. Please never share the code with your child or anyone outside.','Parents may visit any time during the center\'s hours (open-door policy), unless a court order says otherwise.','Children are always supervised, with head counts at every move and a sweep of each area children leave.','Please drive slowly in the parking lot and watch for little ones.']},
 {t:'Photos and privacy',p:['Staff never post photos or names of children on personal accounts. Photos are shared only through approved school channels and only with a signed photo release.']}
 ],note:'Questions about pick-up? Ask your director before the day it matters.'}
};
function guide(key){
  var g=G[key],box=document.getElementById('g_'+key);if(!g||!box)return;
  box.innerHTML='<div class="result" style="border-top-color:#ef6c00"><h2>'+g.h+'</h2><div class="note">'+esc(g.intro)+'</div>'+g.s.map(function(s){return '<div class="section">'+esc(s.t)+'</div><ul style="margin:0 0 8px 22px;line-height:1.55">'+s.p.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';}).join('')+(g.note?'<div class="note" style="margin-top:14px;font-weight:700">'+esc(g.note)+'</div>':'')+'</div>';
}
/* ---------- Parent Training ---------- */
var LM=[
{id:'welcome',t:'Welcome to Kid City USA',c:'#1565c0',pts:['We are "Where Kids Can BEE Kids": a safe, healthy, structured place filled with love and encouragement, in a homelike setting.','We care for children from 6 weeks to 12 years old, Monday to Friday, 6:30 AM to 5:30 PM.','Everyone on our team is background screened and has CPR, First Aid and ongoing early childhood training.','We respect every family\'s customs and beliefs and do not discriminate. Our door is open: you may visit your child any time during our hours.','Every child wears the Kid City USA uniform shirt daily.'],qs:[{q:'What are our hours?',o:['6:30 AM to 5:30 PM, Monday to Friday','8:00 AM to 4:00 PM','Open on weekends'],a:0},{q:'Can parents visit during the day?',o:['Yes, we have an open-door policy','Only with a month\'s notice','Never'],a:0}]},
{id:'learning',t:'How Your Child Learns',c:'#2e8b57',pts:['Our hands-on, literacy-rich program uses B.E.A.R. Phonics and Bear Math, plus character, writing, science, art, music and movement. B.E.A.R. Phonics is free for every family on YouTube (see the Bear Phonics card).','Teachers guide with encouragement. When an answer is not right, we say "Not quite yet" and try again together. We never shame a child.','Weekly lesson plans for every age group are posted for families. Find them on the Lesson Plans card.','A developmental screening is done within 45 days of enrollment. Teachers complete progress reports, and conferences are held twice a year. You can ask for a conference any time. The learning block begins at about 9:00 AM, so arriving before then helps your child settle in.','Potty training works best as a partnership between home and school.'],qs:[{q:'When an answer is not right, what do teachers say?',o:['Not quite yet. Let\'s try again.','That is wrong.','Nothing'],a:0},{q:'Where can you see what your child is learning this month?',o:['The Lesson Plans card','The Closures card','Nowhere'],a:0}]},
{id:'arrival',t:'Drop-Off and Pick-Up',c:'#1976d2',pts:['Carry or walk your child in, sign in with first and last name, and hand them to a teacher in their classroom.','Sign out at pick-up. We release only to authorized adults with photo ID, every time.','Changes to the authorized list are made in person with the director, never by phone.','Never share the keypad code. Cameras and the keypad protect your child.'],qs:[{q:'How do you change who may pick up your child?',o:['Meet with the director in person','Text a teacher','Tell the next person at the door'],a:0},{q:'Does an authorized adult need photo ID?',o:['Yes, every time','Only the first time','Never'],a:0}]},
{id:'health',t:'Health and Medicine',c:'#c62828',pts:['Please keep your child home with a fever of 101 or higher, vomiting, diarrhea, pink eye, head lice, or any of the symptoms on the "When Your Child Is Sick" card.','Your child must be symptom free for 24 hours before returning.','If we call you, you have one hour to pick up. After that, $5.00 per 15 minutes is charged.','Medicine needs a signed Medication Authorization form and stays locked at the front desk. We do not give over-the-counter medicine.','Immunization and physical records must be current and on file.'],qs:[{q:'How long must a child be symptom free before coming back?',o:['24 hours','1 hour','No wait'],a:0},{q:'Can we give over-the-counter medicine?',o:['No','Yes, if you ask','Yes, always'],a:0}]},
{id:'meals',t:'Meals, Snacks and Allergies',c:'#d9822b',pts:['Kid City USA serves USDA-approved breakfast, lunch and snack at no extra cost. Menus are on the Menu card.','Tell your director and teacher about any allergy or special diet, and give a doctor\'s note. We train our staff on your child\'s plan and keep the allergy food away.','We prefer children eat the meals we serve. For celebrations, bring sealed, store-bought treats only, after calling the center, and complete the food permission form.'],qs:[{q:'Can you bring homemade treats to share?',o:['No. Only sealed, store-bought treats, after calling the center','Yes, anything','Yes, if it is a secret'],a:0},{q:'What do you give us for a food allergy?',o:['A written notice and a doctor\'s note','Nothing','A text'],a:0}]},
{id:'supplies',t:'Supplies and Uniform',c:'#ef6c00',pts:['Every month: 160 wipes and a box of tissues for each child. $5.00 is added if not received.','Label everything with your child\'s first and last name. Bring changes of clothes (3 for infants and toddlers, 2 for preschoolers; school-aged children do not need them).','The uniform shirt is required daily. A forgotten shirt costs $18.','No diaper bags, backpacks or bags of any kind, and no toys from home. Nap bedding goes home Fridays and returns Mondays.'],qs:[{q:'What do you bring every month?',o:['160 wipes and a box of tissues','A new backpack','Nothing'],a:0},{q:'Can children bring backpacks?',o:['No, bags of any type stay home','Yes','Only on Fridays'],a:0}]},
{id:'fees',t:'Tuition, Fees and Closures',c:'#8d5524',pts:['Tuition is due Friday for the next week. A $25 late fee is added if it is not paid by close of business Monday.','Late pick-up is $1.00 per minute per child.','We are closed on the listed holidays and some other days. No tuition credit is given for holidays or vacation. Check the Closures card.','Call within 1 hour if your child will be absent. Give two weeks\' notice before withdrawing.'],qs:[{q:'When is tuition due?',o:['Friday for the upcoming week','The 1st of the month','Sunday'],a:0},{q:'What is the late pick-up fee?',o:['$1.00 per minute per child','$100','None'],a:0}]},
{id:'behavior',t:'Behavior and Respect',c:'#6a1b9a',pts:['We guide behavior with praise, hugs, stickers and calm redirection. We never use corporal punishment, and discipline is never tied to food, outdoor play or toileting.','Biting is normal at some ages. We respond with observation, teaching and changes to the room, and we file a report when it happens.','Please do not correct or discipline a child who is not yours. Bring any concern to the management team.','Our code of conduct protects everyone: no threats, hitting, yelling or confrontations with staff or families, and respect for other families\' privacy. Serious or repeated violations can end enrollment.'],qs:[{q:'If another child upsets you, what should you do?',o:['Tell the director or management team','Correct the child yourself','Tell other parents'],a:0},{q:'Is corporal punishment allowed?',o:['Never','Sometimes','Yes'],a:0}]},
{id:'together',t:'Safety, Communication and Getting Involved',c:'#00838f',pts:['Staff are mandated reporters and trained every year to report suspected abuse or neglect.','Children are never left alone. We do head counts at every transition and sweep rooms and playgrounds.','Stay informed: talk with your teacher, read daily notes and ProCare messages, and check the Message Board and Newsletter cards here.','In severe weather we follow the county school board closing decision. No tuition credit is given for a closure.','Families are welcome to volunteer. Volunteers must be 16 or older with ID, TB test, physical and background check on file.'],qs:[{q:'Where do you find school announcements and flyers?',o:['The Message Board card','Nowhere','Only by phone'],a:0},{q:'Who can volunteer?',o:['People 16 or older with ID, TB test, physical and background check on file','Anyone at all','Nobody'],a:0}]}
];
function lsget(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsset(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function renderLearn(open){
  var box=document.getElementById('learnBox');if(!box)return;
  var done=LM.filter(function(m){return lsget('pl_'+m.id)==='1'}).length;
  var h='<div class="result" style="border-top-color:#6a1b9a"><h2>🎓 Parent Orientation</h2><div class="note">Short lessons from the Parent Handbook so you know how our school works. Open a lesson, read it, and answer the quick check. You have finished <b>'+done+' of '+LM.length+'</b>.</div></div>';
  h+=LM.map(function(m){var ok=lsget('pl_'+m.id)==='1';
    return '<details class="pl" '+(open===m.id?'open':'')+' style="background:#fff;border-radius:16px;margin:10px 0;box-shadow:0 4px 12px rgba(74,58,48,.08);border-left:8px solid '+m.c+'"><summary style="padding:14px 16px;font-weight:900;cursor:pointer">'+(ok?'✅ ':'📘 ')+esc(m.t)+'</summary><div style="padding:0 16px 14px"><ul style="margin:0 0 10px 20px;line-height:1.55">'+m.pts.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul>'
    +m.qs.map(function(q,i){return '<div style="margin:10px 0"><b>'+esc(q.q)+'</b>'+q.o.map(function(o,j){return '<label style="display:block;font-weight:600;margin:4px 0"><input type="radio" name="q_'+m.id+'_'+i+'" value="'+j+'"> '+esc(o)+'</label>';}).join('')+'</div>';}).join('')
    +'<button type="button" class="go g1" style="margin-top:6px;width:auto;padding:10px 18px" onclick="PPA.check(\''+m.id+'\')">Check my answers</button> <span id="r_'+m.id+'" style="font-weight:800"></span></div></details>';}).join('');
  if(done===LM.length)h+='<div class="result" style="border-top-color:#46c97f"><h2>🎉 You finished Parent Orientation!</h2><div class="note">Thank you for learning how Kid City USA works. Please sign below to show you completed orientation.</div>'+(lsget('pl_signed')?'<div style="font-weight:800;color:#2e8b57">✅ Signed by '+esc(lsget('pl_signed'))+'. Thank you!</div>':(window.PP_ROLE_STAFF&&window.PP_ROLE_STAFF()?'<div class="note">Parents sign here after finishing. (Staff preview)</div>':'<label style="display:block;font-weight:800;margin:6px 0">Your full name<input id="oriP" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem"></label><label style="display:block;font-weight:800;margin:6px 0">Your child\'s name<input id="oriC" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem"></label><label style="display:block;margin:6px 0"><input type="checkbox" id="oriK"> I went through Parent Orientation and understand how Kid City USA works.</label><button type="button" class="go g1" style="width:auto;padding:10px 18px" onclick="PPA.sign()">✍️ Sign orientation</button> <span id="oriR" style="font-weight:800"></span>'))+'</div>';
  box.innerHTML=h;
}
function check(id){
  var m=LM.filter(function(x){return x.id===id})[0],ok=true,all=true;
  m.qs.forEach(function(q,i){var s=document.querySelector('input[name="q_'+id+'_'+i+'"]:checked');if(!s){all=false;return;}if(+s.value!==q.a)ok=false;});
  var out=document.getElementById('r_'+id);
  if(!all){out.style.color='#c62828';out.textContent='Please answer every question.';return;}
  if(ok){lsset('pl_'+id,'1');out.style.color='#2e8b57';out.textContent='All correct! 🎉';setTimeout(function(){renderLearn();},900);}
  else{out.style.color='#c62828';out.textContent='Not quite yet. Read the lesson again and try once more.';}
}
window.PPA={show:function(w){
  if(w==='menu')showDoc('menu','menuBox','menu',/^Menu/i);
  else if(w==='news')showDoc('newsletter','newsBox','newsletter',/^Newsletter/i);
  else if(w==='lessons')showDoc('lessons','lessonBox','lesson plans',/^Lesson Plans/i);
  else if(w==='board')showBoard();
  else if(G[w])guide(w);
  else if(w==='learn')renderLearn();
 },
 openFile:async function(f){try{var u=await blobUrl(f);window.open(u,'_blank');}catch(e){alert('Could not open that file right now.');}},
 check:check, sign:async function(){var a=document.getElementById('oriP').value.trim(),c=document.getElementById('oriC').value.trim(),r=document.getElementById('oriR');if(!document.getElementById('oriK').checked||a.length<3||c.length<2){r.style.color='#c62828';r.textContent='Type both names and check the box.';return;}try{var j=await call('pp_orient_sign',{parent:a,child:c});if(!j||!j.ok)throw 0;lsset('pl_signed',a);renderLearn();}catch(e){r.style.color='#c62828';r.textContent='Could not save right now. Please try again.';}}, reset:function(){PP=null;}};
})();
