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
  var r=await fetch('files-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({pin:pin(),action:(!pin()&&(action==='pp_orient_sign'||action==='pp_orient_start')?action.replace('pp_','wl_'):action),school:school()},extra||{}))});
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
function nlIcon(t){t=(t||'').toLowerCase();return /closed|break|holiday|christmas|thanksgiving|veterans|new year|juneteenth|memorial|presidents|good friday|king/.test(t)?'🏫':/friendsgiving|party|picnic|celebrat|event|sign.?up/.test(t)?'🍂':/early|5 pm/.test(t)?'⏰':'📅';}
function nlKindIcon(k){return k==='Things to do'?'🌳':k==='Teddy Bear Talk'?'🧸':k==='Quote'?'💬':'📣';}
function nlSec(ic,t,body,bg){return '<div style="margin:16px 0;background:'+(bg||'#fff')+';border:2px solid #f1e3c8;border-radius:16px;padding:14px 16px"><div style="font-weight:800;font-size:1.05rem;color:var(--ink);margin-bottom:8px">'+ic+' '+t+'</div>'+body+'</div>';}
function newsletterHtml(it){
  var f=it.form||{},h='<div style="border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(74,58,48,.12);background:#fffaf0">';
  h+='<div style="background:linear-gradient(135deg,#ffb13d,#ffd36e);padding:20px 18px;text-align:center"><div style="font-size:2rem">🐻🍯</div><div style="font-size:1.35rem;font-weight:800;color:#4a3a30">'+esc(it.title)+'</div><div style="color:#6b4f2a;font-weight:700;margin-top:2px">'+esc(monthName(it.month))+'</div></div><div style="padding:6px 14px 14px">';
  if(f.welcome)h+='<p style="line-height:1.55;margin:14px 2px">'+esc(f.welcome).replace(/\n/g,'<br>')+'</p>';
  (f.weekly||[]).filter(function(w){return w.kind!=='Monday Overview'&&w.kind!=='Friday Briefing';}).forEach(function(w){h+=nlSec(nlKindIcon(w.kind),esc(w.title||w.kind),'<div style="line-height:1.55">'+esc(w.body).replace(/\n/g,'<br>')+'</div>','#fff6e0');});
  if((f.dates||[]).length){h+=nlSec('📅','Important dates','<div>'+f.dates.map(function(d){return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed #efe2c9"><div style="font-size:1.2rem">'+nlIcon(d[1])+'</div><div><b>'+esc(d[0])+'</b><br><span style="color:var(--ink)">'+esc(d[1])+'</span></div></div>';}).join('')+'</div>');}
  if(f.lessonsMonth)h+=nlSec('📚','Lesson plans','<div style="line-height:1.5">This month\'s lesson plans for every classroom are in the Parent Portal under <b>Lesson Plans</b>. Ask your child about their letter, color and story of the week!</div>','#eef7ff');
  if(f.birthdays)h+=nlSec('🎂','Birthdays this month','<div style="line-height:1.7">'+esc(f.birthdays).replace(/\n/g,'<br>')+'</div>','#fff0f5');
  if((f.reminders||[]).length)h+=nlSec('🧺','Good to remember','<ul style="margin:0 0 0 20px;line-height:1.6">'+f.reminders.map(function(r){return '<li>'+esc(r)+'</li>';}).join('')+'</ul>');
  if((f.news||[]).length)h+=f.news.map(function(n){return nlSec('🐝',esc(n[0]||'Our school'),'<div style="line-height:1.55">'+esc(n[1]).replace(/\n/g,'<br>')+'</div>');}).join('');
  if(f.quote)h+='<div style="margin:16px 0;text-align:center;font-style:italic;color:#6b4f2a;padding:14px;background:#fdf1d4;border-radius:16px">“'+esc(f.quote)+'”</div>';
  if(f.thanks)h+='<p style="text-align:center;line-height:1.5;margin:10px 0 0">💛 '+esc(f.thanks)+'</p>';
  return h+'</div></div>';
}

var AUTO=null;
async function auto(){
  if(AUTO&&AUTO._s===school())return AUTO;
  var j=await call('pp_auto'); if(!j||j.error)throw new Error((j&&j.error)||'Could not load'); j._s=school();AUTO=j;return j;
}
function linkCard(em,t,sub,u){return '<a class="rescard" style="text-decoration:none;color:inherit" href="'+esc(u)+'" target="_blank" rel="noopener"><div class="em">'+em+'</div><div class="txt"><h3>'+esc(t)+'</h3><p>'+esc(sub||'')+'</p></div></a>';}
async function showLessons(){
  var box=document.getElementById('lessonBox');if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  try{
    var a=await auto(),h='<h2>🍎 Lesson Plans</h2>';
    if(a.lessons.length){
      h+='<div class="note">'+esc(a.monthName)+' lesson plans. Pick your child\'s age group.</div><div class="reslist">'+a.lessons.map(function(x){return linkCard('🍎',x.age||x.plan,x.month,x.link);}).join('')+'</div>';
    } else h+='<div class="empty">The '+esc(a.monthName)+' lesson plans are not ready yet. Please check back soon.</div>';
    var other={};a.allLessons.forEach(function(x){if(!a.lessons.some(function(c){return c.link===x.link;})){(other[x.month]=other[x.month]||[]).push(x);}});
    var ks=Object.keys(other);
    if(ks.length){h+='<div class="section">Other months</div>'+ks.map(function(k){return '<details style="margin:6px 0"><summary style="cursor:pointer;font-weight:800;padding:8px 0">'+esc(k)+'</summary><div class="reslist">'+other[k].map(function(x){return linkCard('📘',x.age||x.plan,'',x.link);}).join('')+'</div></details>';}).join('');}
    box.innerHTML=h;
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
}
async function showForms(){
  var box=document.getElementById('formsBox');if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  try{
    var a=await auto(),h='<h2>🥗 Food Program Forms</h2><div class="note">Print, fill out and return these to the office. Ask us if you need help.</div>';
    if(!a.forms.length)h+='<div class="empty">No forms are posted yet.</div>';
    else{var cat='';a.forms.forEach(function(f){if(f.cat!==cat){cat=f.cat;h+='<div class="section">'+esc(cat||'Forms')+'</div>';}h+=linkCard('📄',f.doc,'',f.link);});}
    box.innerHTML=h;
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
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
    if(kind==='newsletter'){try{var a=await auto();box.innerHTML='<div class="note" style="background:#e8f3ff;border-left:5px solid #1d7fd1;padding:10px 14px;border-radius:10px;color:var(--ink);font-weight:700">Your '+esc(a.monthName)+' newsletter</div>'+newsletterHtml(a.newsletter)+(a.lessons.length?'<a class="go g1" style="display:block;margin:10px 0" href="#" onclick="show(\'lessons\',null);PPA.show(\'lessons\');return false">See the '+esc(a.monthName)+' lesson plans →</a>':'');return;}catch(e){}}
    var fb=re?fallbackLink(re):null;
    box.innerHTML=fb?'<div class="note" style="background:#fff3d6;border-left:5px solid #ffb13d;padding:10px 14px;border-radius:10px;color:var(--ink);font-weight:700">The newest '+esc(label)+' is being posted. Here is the last one we have.</div><a class="go g1" style="display:block" href="'+esc(fb.URL)+'">'+esc(fb.Title)+' →</a>':'<div class="empty">The '+esc(label)+' will be posted here soon. 🐝</div>';
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
}
async function showWeekly(kind,boxId){
  var box=document.getElementById(boxId);if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  var T=kind==='Teddy Bear Talk'?{ic:'🧸',h:'Teddy Bear Talk',sub:'A little something to talk about with your child this week.',g:'linear-gradient(135deg,#ff8fb1,#ffb86b)',cols:['#e0457b','#ef6c00','#9b6bff','#2fc4b2'],em:['💬','🌈','💛','⭐']}:{ic:'🌳',h:'Things to Do This Weekend',sub:'Fun, family-friendly ideas close to home. Updated every week!',g:'linear-gradient(135deg,#46c97f,#5aa9ff)',cols:['#2e8b57','#1d7fd1','#ef6c00','#9b6bff','#e0457b'],em:['🎈','🎨','🍦','🚲','🎪']};
  try{
    var a=await auto(),W=(a.weekly||[]).filter(function(w){return w.kind===kind;});
    var h='<div style="border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(74,58,48,.15);background:#fffaf0"><div style="background:'+T.g+';padding:22px 16px;text-align:center;color:#fff"><div style="font-size:2.4rem">'+T.ic+'✨</div><div style="font-size:1.45rem;font-weight:800;text-shadow:0 1px 3px rgba(0,0,0,.25)">'+T.h+'</div><div style="font-weight:700;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,.25)">'+T.sub+'</div></div><div style="padding:10px 14px 16px">';
    if(!W.length)h+='<div class="empty" style="margin:16px 0">This week\'s '+esc(T.h)+' is being written. Check back soon! '+T.ic+'</div>';
    W.forEach(function(w,wi){
      var lines=String(w.body||'').split(/\n+/).map(function(s){return s.replace(/^\s*[-•*]\s*/,'').trim();}).filter(Boolean);
      h+='<div style="font-weight:800;font-size:1.15rem;color:var(--ink);margin:14px 2px 6px">'+esc(w.title)+'</div>';
      lines.forEach(function(l,i){var c=T.cols[i%T.cols.length],e=T.em[i%T.em.length];h+='<div style="display:flex;gap:12px;align-items:flex-start;background:#fff;border-left:7px solid '+c+';border-radius:14px;padding:12px 14px;margin:9px 0;box-shadow:0 2px 8px rgba(74,58,48,.08)"><div style="font-size:1.6rem">'+e+'</div><div style="line-height:1.5;color:var(--ink)">'+esc(l)+'</div></div>';});
    });
    h+='<div style="text-align:center;color:var(--soft);font-weight:700;margin-top:12px;font-size:.9rem">New one every week 🐝</div></div></div>';
    box.innerHTML=h;
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
}
function evWhen(e){try{var d=new Date(e.when+'T12:00');var t=(e.time||'').split(':'),h=+t[0],m=t[1]||'00';var tt=e.time?(' at '+((h%12)||12)+':'+m+(h>=12?' PM':' AM')):'';return d.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'})+tt;}catch(x){return e.when;}}
async function showEvents(){
  var box=document.getElementById('evBox');if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  try{
    var r=await call('pp_ev_list'),E=(r&&r.events)||[];
    var h='<div style="border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(74,58,48,.15);background:#fffaf0"><div style="background:linear-gradient(135deg,#9b6bff,#ff6b9d);padding:22px 16px;text-align:center;color:#fff"><div style="font-size:2.4rem">🎉✨</div><div style="font-size:1.45rem;font-weight:800;text-shadow:0 1px 3px rgba(0,0,0,.25)">Events &amp; Sign-Ups</div><div style="font-weight:700;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,.25)">Pick what you can bring. It comes off the list for everyone else, and your director sees it right away.</div></div><div style="padding:10px 14px 16px">';
    if(!E.length)h+='<div class="empty" style="margin:16px 0">No events need sign-ups right now. 🐝 Check back soon!</div>';
    E.forEach(function(e,ei){
      h+='<div data-ev="'+esc(e.id)+'" style="background:#fff;border-radius:16px;padding:14px;margin:12px 0;box-shadow:0 2px 8px rgba(74,58,48,.1);border-top:6px solid '+['#9b6bff','#ff6b9d','#2fc4b2','#ef6c00'][ei%4]+'"><div style="font-weight:800;font-size:1.2rem;color:var(--ink)">🍂 '+esc(e.title)+'</div><div style="color:var(--soft);font-weight:700;margin:2px 0 8px">'+esc(evWhen(e))+(e.rooms&&e.rooms.length?' · '+esc(e.rooms.join(', ')):'')+'</div>'+(e.note?'<div style="line-height:1.5;margin-bottom:10px;color:var(--ink)">'+esc(e.note)+'</div>':'');
      e.items.forEach(function(it,ii){var gone=it.left<1;h+='<label style="display:flex;gap:10px;align-items:center;padding:9px 10px;margin:6px 0;border-radius:12px;background:'+(gone?'#f2efea':'#fff8ec')+';border:1px solid #f1e3c8;'+(gone?'opacity:.55':'')+'"><input type="checkbox" value="'+esc(it.name)+'" '+(gone?'disabled':'')+' style="width:20px;height:20px"><span style="flex:1;line-height:1.35">'+esc(it.name)+'</span><b style="font-size:.85rem;color:'+(gone?'#9b8576':'#2e8b57')+'">'+(gone?'All taken':it.left+' left')+'</b></label>';});
      h+='<input data-o placeholder="Something else you would like to bring (optional)" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem;margin-top:8px"><input data-f placeholder="Your family last name" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem;margin-top:8px"><input data-k placeholder="Child first name and last initial (example: Mia R.)" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem;margin-top:8px"><button type="button" class="go g1" data-go style="margin-top:10px">🎉 Sign me up</button><div data-m style="font-weight:800;margin-top:8px"></div></div>';
    });
    box.innerHTML=h+'</div></div>';
    box.querySelectorAll('[data-go]').forEach(function(b){b.onclick=async function(){
      var c=b.closest('[data-ev]'),m=c.querySelector('[data-m]'),items=[].map.call(c.querySelectorAll('input[type=checkbox]:checked'),function(x){return x.value;}),o=c.querySelector('[data-o]').value.trim(),f=c.querySelector('[data-f]').value.trim(),k=c.querySelector('[data-k]').value.trim();
      m.style.color='#c62828';
      if(!items.length&&!o){m.textContent='Check at least one item, or type what you will bring.';return;}
      if(f.length<2||k.length<2){m.textContent='Please add your family name and your child\'s name.';return;}
      b.disabled=true;m.style.color='var(--ink)';m.textContent='Saving…';
      try{var rr=await call('pp_ev_claim',{event:c.getAttribute('data-ev'),items:items,other:o,family:f,kids:k});
        if(rr&&rr.ok){m.style.color='#2e8b57';m.textContent='Thank you! You are signed up for: '+(rr.claimed||[]).join(', ')+'.'+((rr.taken||[]).length?' (Already taken by someone else: '+rr.taken.join(', ')+')':'');setTimeout(showEvents,3500);}
        else{b.disabled=false;m.style.color='#c62828';m.textContent=(rr&&rr.error)||'Could not save. Please try again.';}
      }catch(x){b.disabled=false;m.style.color='#c62828';m.textContent='Could not save right now. Please try again in a minute.';}
    };});
  }catch(e){box.innerHTML='<div class="empty">Could not load events right now. Please try again in a moment.</div>';}
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
function who(){try{return JSON.parse(lsget('pl_who')||'null')}catch(e){return null}}
function whoForm(){
  var inp='width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem;margin-bottom:4px';
  return '<div class="result" style="border-top-color:#6a1b9a"><h2>🎓 Parent Orientation</h2><div class="note">Before you start, tell us who is taking orientation. This lets the school keep your completion in your child\'s file. It takes a minute, and then you can go through the '+LM.length+' short lessons.</div>'
  +'<label style="display:block;font-weight:800;margin:8px 0 2px">Your full name</label><input id="owP" style="'+inp+'" autocomplete="name">'
  +'<label style="display:block;font-weight:800;margin:8px 0 2px">Your relationship to the child</label><input id="owR" style="'+inp+'" placeholder="Mom, Dad, Grandma, guardian…">'
  +'<label style="display:block;font-weight:800;margin:8px 0 2px">Your child\'s full name</label><input id="owC" style="'+inp+'">'
  +'<label style="display:block;font-weight:800;margin:8px 0 2px">Your cell phone</label><input id="owT" type="tel" style="'+inp+'" autocomplete="tel">'
  +'<label style="display:block;font-weight:800;margin:8px 0 2px">Your email</label><input id="owE" type="email" style="'+inp+'" autocomplete="email">'
  +'<div style="margin-top:10px"><button type="button" class="go g1" style="width:auto;padding:10px 18px" onclick="PPA.begin()">Start orientation</button> <span id="owM" style="font-weight:800"></span></div></div>';
}
function lessonsDone(){return LM.filter(function(m){return lsget('pl_'+m.id)==='1'}).length;}
function report(){var w=who();if(!w)return;call('pp_orient_start',Object.assign({},w,{done:lessonsDone(),total:LM.length})).catch(function(){});}
function renderLearn(open){
  var box=document.getElementById('learnBox');if(!box)return;
  var W=who();if(!W){box.innerHTML=whoForm();return;}
  var done=LM.filter(function(m){return lsget('pl_'+m.id)==='1'}).length;
  var h='<div class="result" style="border-top-color:#6a1b9a"><h2>🎓 Parent Orientation</h2><div class="note">Short lessons from the Parent Handbook so you know how our school works. Open a lesson, read it, and answer the quick check. You have finished <b>'+done+' of '+LM.length+'</b>.<br>Taking orientation: <b>'+esc(W.parent)+'</b> (parent of '+esc(W.child)+'). <a href="#" onclick="PPA.changeWho();return false">Not you?</a></div></div>';
  h+=LM.map(function(m){var ok=lsget('pl_'+m.id)==='1';
    return '<details class="pl" '+(open===m.id?'open':'')+' style="background:#fff;border-radius:16px;margin:10px 0;box-shadow:0 4px 12px rgba(74,58,48,.08);border-left:8px solid '+m.c+'"><summary style="padding:14px 16px;font-weight:900;cursor:pointer">'+(ok?'✅ ':'📘 ')+esc(m.t)+'</summary><div style="padding:0 16px 14px"><ul style="margin:0 0 10px 20px;line-height:1.55">'+m.pts.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul>'
    +m.qs.map(function(q,i){return '<div style="margin:10px 0"><b>'+esc(q.q)+'</b>'+q.o.map(function(o,j){return '<label style="display:block;font-weight:600;margin:4px 0"><input type="radio" name="q_'+m.id+'_'+i+'" value="'+j+'"> '+esc(o)+'</label>';}).join('')+'</div>';}).join('')
    +'<button type="button" class="go g1" style="margin-top:6px;width:auto;padding:10px 18px" onclick="PPA.check(\''+m.id+'\')">Check my answers</button> <span id="r_'+m.id+'" style="font-weight:800"></span></div></details>';}).join('');
  if(done===LM.length)h+='<div class="result" style="border-top-color:#46c97f"><h2>🎉 You finished Parent Orientation!</h2><div class="note">Thank you for learning how Kid City USA works. Please sign below to show you completed orientation. Your name, phone and email are already saved; typing your name below is your signature.</div>'+(lsget('pl_signed')?'<div style="font-weight:800;color:#2e8b57">✅ Signed by '+esc(lsget('pl_signed'))+'. Thank you!</div>':(window.PP_ROLE_STAFF&&window.PP_ROLE_STAFF()?'<div class="note">Parents sign here after finishing. (Staff preview)</div>':'<label style="display:block;font-weight:800;margin:6px 0">Your full name<input id="oriP" value="'+esc(W.parent)+'" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem"></label><label style="display:block;font-weight:800;margin:6px 0">Your child\'s name<input id="oriC" value="'+esc(W.child)+'" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font-size:1rem"></label><label style="display:block;margin:6px 0"><input type="checkbox" id="oriK"> I went through Parent Orientation and understand how Kid City USA works.</label><button type="button" class="go g1" style="width:auto;padding:10px 18px" onclick="PPA.sign()">✍️ Sign orientation</button> <span id="oriR" style="font-weight:800"></span>'))+'</div>';
  box.innerHTML=h;
}
function check(id){
  var m=LM.filter(function(x){return x.id===id})[0],ok=true,all=true;
  m.qs.forEach(function(q,i){var s=document.querySelector('input[name="q_'+id+'_'+i+'"]:checked');if(!s){all=false;return;}if(+s.value!==q.a)ok=false;});
  var out=document.getElementById('r_'+id);
  if(!all){out.style.color='#c62828';out.textContent='Please answer every question.';return;}
  if(ok){lsset('pl_'+id,'1');report();out.style.color='#2e8b57';out.textContent='All correct! 🎉';setTimeout(function(){renderLearn();},900);}
  else{out.style.color='#c62828';out.textContent='Not quite yet. Read the lesson again and try once more.';}
}
async function showEmail(kind,boxId){
  var box=document.getElementById(boxId);if(!box)return;
  if(!school()){needSchool(box);return;}
  box.innerHTML='<div class="empty">Loading… 🐝</div>';
  try{
    var a=await auto(),dt=function(w){var m=String(w.title||'').split('—').pop();var t=Date.parse(m);return isNaN(t)?0:t;};
    var W=(a.weekly||[]).filter(function(w){return w.kind===kind;}).sort(function(x,y){return dt(y)-dt(x);}).slice(0,4);
    var srch='<div style="text-align:center;color:var(--soft);font-weight:700;font-size:.9rem;margin:12px 4px">We keep the last 4 here. Looking for an older one? Search your email for <b>&ldquo;Bear Line: '+esc(kind)+'&rdquo;</b>.</div>';
    if(!W.length){box.innerHTML='<div class="empty">This week\'s '+esc(kind)+' will show up here as soon as it is sent'+(kind==='Monday Overview'?' on Monday morning':' on Friday')+'. 🐝</div>'+srch;return;}
    var ic=kind==='Monday Overview'?'📬 ':'🎉 ';
    var chips=W.length>1?'<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 2px 10px">'+W.map(function(w,i){var lb=String(w.title||'').split('—').pop().trim().replace(/,\s*\d{4}$/,'');return '<button type="button" data-i="'+i+'" style="border:2px solid #5b7a3a;background:'+(i?'#fff':'#5b7a3a')+';color:'+(i?'#5b7a3a':'#fff')+';font-weight:800;border-radius:999px;padding:7px 14px;cursor:pointer">'+esc(lb)+(i?'':' · newest')+'</button>';}).join('')+'</div>':'';
    box.innerHTML=chips+'<div id="'+boxId+'_t" style="font-weight:800;font-size:1.1rem;color:var(--ink);margin:4px 2px 10px"></div><iframe id="'+boxId+'_if" title="'+esc(kind)+'" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" style="width:100%;border:0;border-radius:14px;min-height:600px;background:#eef1f6;display:block"></iframe>'+srch;
    var f=document.getElementById(boxId+'_if');
    f.onload=function(){try{var d=f.contentDocument;d.querySelectorAll('a').forEach(function(x){x.target='_blank';x.rel='noopener';});f.style.height=(d.documentElement.scrollHeight+24)+'px';}catch(e){}};
    var open=function(i){document.getElementById(boxId+'_t').textContent=ic+(W[i].title||kind);f.srcdoc=String(W[i].body||'');box.querySelectorAll('button[data-i]').forEach(function(b){var on=+b.getAttribute('data-i')===i;b.style.background=on?'#5b7a3a':'#fff';b.style.color=on?'#fff':'#5b7a3a';});};
    box.querySelectorAll('button[data-i]').forEach(function(b){b.onclick=function(){open(+b.getAttribute('data-i'));};});
    open(0);
  }catch(e){box.innerHTML='<div class="empty">Could not load right now. Please try again in a moment.</div>';}
}
window.PPA={show:function(w){
  if(w==='mon'){showEmail('Monday Overview','monBox');return;}
  if(w==='fri'){showEmail('Friday Briefing','friBox');return;}
  if(w==='menu')showDoc('menu','menuBox','menu',/^Menu/i);
  else if(w==='news')showDoc('newsletter','newsBox','newsletter',/^Newsletter/i);
  else if(w==='lessons')showLessons();
  else if(w==='todo')showWeekly('Things to do','todoBox');
  else if(w==='events')showEvents();
  else if(w==='tbt')showWeekly('Teddy Bear Talk','tbtBox');
  else if(w==='forms')showForms();
  else if(w==='board')showBoard();
  else if(G[w])guide(w);
  else if(w==='learn')renderLearn();
 },
 openFile:async function(f){try{var u=await blobUrl(f);window.open(u,'_blank');}catch(e){alert('Could not open that file right now.');}},
 begin:function(){var g=function(i){return document.getElementById(i).value.trim()},m=document.getElementById('owM'),w={parent:g('owP'),rel:g('owR'),child:g('owC'),phone:g('owT'),email:g('owE')};if(w.parent.length<3||w.child.length<2||w.phone.replace(/\D/g,'').length<7||w.email.indexOf('@')<0){m.style.color='#c62828';m.textContent='Please fill in every box (a real phone number and email).';return;}lsset('pl_who',JSON.stringify(w));lsset('pl_signed','');renderLearn();report();},
 changeWho:function(){if(!confirm('Start over as a different person? Your lesson progress on this device will be cleared.'))return;LM.forEach(function(m){lsset('pl_'+m.id,'')});lsset('pl_who','');lsset('pl_signed','');renderLearn();},
 check:check, sign:async function(){var a=document.getElementById('oriP').value.trim(),c=document.getElementById('oriC').value.trim(),r=document.getElementById('oriR');if(!document.getElementById('oriK').checked||a.length<3||c.length<2){r.style.color='#c62828';r.textContent='Type both names and check the box.';return;}try{var W=who()||{};var j=await call('pp_orient_sign',{parent:a,child:c,phone:W.phone,email:W.email,rel:W.rel,done:lessonsDone(),total:LM.length});if(!j||!j.ok)throw 0;lsset('pl_signed',a);renderLearn();}catch(e){r.style.color='#c62828';r.textContent='Could not save right now. Please try again.';}}, reset:function(){PP=null;}};
})();
