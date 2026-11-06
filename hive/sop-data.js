/* Hive SOP: default content (from Mrs. Bear's SOP-26 DeLand 2 / SOP-27 Sanford) + shared helpers.
   Saved edits live in the private vault (files-api.php sop_get / sop_save) and replace these defaults piece by piece. */
(function(){
var DAYS=['','Mon','Tue','Wed','Thu','Fri'];
function T(s,e,t,f){return {s:s,e:e,t:t,f:f?1:0};}
var AGE={
 infant:{label:'Infant',ratio:4,blocks:[T('08:30','09:00','Arrival, Health Check & Feeding'),T('09:00','09:15','Tummy Time / Sensory / Sign'),T('09:15','09:30','Outside Play',1),T('09:30','09:45','Diaper Rotation & Wash Up'),T('09:45','10:15','Individual Nap / Floor Play'),T('10:15','10:45','Table Food / Bottle Window'),T('10:45','14:00','Individual Nap Rotation'),T('14:00','14:30','Afternoon Bottle / Snack'),T('14:30','15:15','Sensory Play & Music'),T('15:15','15:45','Outside Play',1),T('15:45','16:30','Individual Feeding / Story'),T('16:30','17:15','Free Floor Play'),T('17:15','17:30','Wind-Down & Goodbye')],lunch:['11:00','12:15']},
 ones:{label:'Ones (1 yr)',ratio:6,blocks:[T('08:30','08:40','Arrival'),T('08:40','08:45','Greeting'),T('08:45','08:50','Morning Meeting'),T('08:50','09:00','Music & Movement'),T('09:00','09:10','Circle Time'),T('09:10','09:15','Cleanup'),T('09:15','09:30','Outside Play',1),T('09:30','09:45','Wash Up'),T('09:45','10:15','Centers - Craft'),T('10:15','10:45','Lunch',1),T('10:45','14:00','Quiet Time / Nap'),T('14:00','14:30','Snack'),T('14:30','14:45','Afternoon Circle'),T('14:45','15:30','Centers #1'),T('15:30','16:00','Outside Play',1),T('16:00','16:45','Centers #2'),T('16:45','17:15','Centers #3'),T('17:15','17:30','Wind-Down & Goodbye')],lunch:['12:15','13:15']},
 twos:{label:'Twos (2 yr)',ratio:11,blocks:[T('08:30','08:45','Arrival'),T('08:45','08:50','Greeting'),T('08:50','09:00','Morning Meeting'),T('09:00','09:15','Music & Movement'),T('09:15','09:25','Circle Time'),T('09:25','09:30','Cleanup'),T('09:30','10:00','Outside Play',1),T('10:00','10:30','Wash Up / Transition'),T('10:30','11:00','Lunch',1),T('11:00','14:00','Quiet Time'),T('14:00','14:30','Snack'),T('14:30','14:45','Afternoon Circle'),T('14:45','15:30','Centers #1'),T('15:30','16:00','Outside Play',1),T('16:00','16:45','Centers #2'),T('16:45','17:15','Centers #3'),T('17:15','17:30','Wind-Down & Goodbye')],lunch:['13:15','14:15']},
 threes:{label:'Threes (3 yr)',ratio:15,blocks:[T('08:30','09:00','Centers & Morning Work'),T('09:00','09:10','School Parade'),T('09:10','09:15','Arrival & Affirmation'),T('09:15','09:20','Morning Meeting'),T('09:20','09:35','Circle / Math Circle'),T('09:35','09:50','Music & Movement'),T('09:50','10:00','Cleanup'),T('10:00','10:30','Outside Play',1),T('10:30','11:00','Lunch',1),T('11:00','14:00','Quiet Time'),T('14:00','14:30','Snack'),T('14:30','14:45','Afternoon Math Review'),T('14:45','15:30','Centers #1 - Craft'),T('15:30','16:00','Outside Play',1),T('16:00','16:45','Centers #2 - Reading'),T('16:45','17:15','Centers #3 - STREAM'),T('17:15','17:30','Class Meeting / Wind-Down')],lunch:['14:15','14:45']},
 fours:{label:'Fours / Fives',ratio:20,blocks:[T('08:30','09:00','Centers & Morning Work'),T('09:00','09:10','School Parade'),T('09:10','09:15','Arrival & Affirmation'),T('09:15','09:20','Morning Meeting'),T('09:20','09:35','Circle / Math Circle'),T('09:35','09:50','Music & Movement'),T('09:50','10:00','Cleanup'),T('10:00','10:30','Outside Play',1),T('10:30','11:00','Lunch',1),T('11:00','14:00','Quiet Time'),T('14:00','14:30','Snack'),T('14:30','14:45','Afternoon Math Review'),T('14:45','15:30','Centers #1 - Craft'),T('15:30','16:00','Outside Play',1),T('16:00','16:45','Centers #2 - Reading'),T('16:45','17:15','Centers #3 - STREAM'),T('17:15','17:30','Class Meeting / Wind-Down')],lunch:null}
};
var LETTER=['This schedule exists for one reason: so we can run this school in excellence, together.','When we are transparent about our schedules and our timing, we get to understand each other\'s days, and that understanding turns into empathy. We stop guessing and start supporting. If you see a teammate carrying more than their share, you can step in. If someone is new or needs a hand, you will be able to see it and help, because the whole day is laid out in front of you: not just your own classroom, but how the entire school moves together.','I do not want us to be a team where people do not communicate, do not share information, or do not understand what everyone else is carrying. I want the opposite: a team that shows each other grace, because we can see, in black and white, that everyone here is working. That is what accountability really looks like: not pressure, but clarity.','When we stay on schedule and help each other, the children get order and consistency. And when the children have that, our stress goes down: we stop reinventing the day every single day. Preschool runs on repetition, and repetition is a gift, not a grind. The more we practice something, the better we get, and the greater we become at the exact same tasks, done with more heart and more skill every time.','I believe in this team. I believe we can send children into kindergarten ready, because of the excellence we practiced with them here, every single day. Above everything else, we do this for the children. Their best interest comes first, always.'];
var RULES=[
 ['Arrival procedure (all staff)','Every staff member, when they arrive for their shift, signs in on the tablet AND in the sign-in book, and takes a walkie-talkie from the front office. This keeps everyone able to reach each other all day. It is not optional.'],
 ['Customer service (opening procedure)','From the moment the opener unlocks the door at 6:30 AM, and at every drop-off and pickup all day: greet every parent ("good morning" or "hello"), greet the child too, and say "have a great day" when they leave. Non-negotiable.'],
 ['Headcounts and ratios','Take a headcount at every combine point (outside time, lunch, nap) and write down how many children of each age group are in a combined room. DCF will ask for this breakdown. Ratio math is by headcount, not by "feels full," and must check out on paper.'],
 ['Meal-room setup','For lunch and snack, pre-set the next meal room DURING quiet time so that when the children wake they get up, line up, and walk straight over. No bed-breaking or gear-packing for the children.'],
 ['Cleaning and safety','Never use bleach or mop while children are in the room. Change mop water during quiet time if it sits long enough to smell. Wipe down the staff bathroom during quiet time or at the end of the day. From about 4:30 PM, start closing your room down: tidy and leave 2-3 centers out.'],
 ['Cleaning charts','Cleaning charts are completed on the teacher portal during quiet time. Do not just hit submit: walk the room. Check cubbies (inside them and the blankets), the tops of the walls, and that bathrooms are truly wiped down before you check it off.'],
 ['Teacher cart (daily reset)','Each room\'s cart lives outside its door, stocked with spoons, bowls, plates, paper towels, trash bags and gloves. Restock when you close each day so no one leaves the room mid-day hunting for supplies.']
];
var CLOSING=['End-of-day inspection completed on the teacher portal.','Teacher carts restocked and staged outside each classroom door.','Classrooms tidy, 2-3 centers left out, the rest put away.','Staff bathroom wiped down (if not already done at quiet time).','Mop bucket emptied, not left sitting.','All lights off except the front.','AC off; thermostat to 79 F overnight (72 F at opening if it is hot).'];
var RATIOS=[['Infant','1 : 4','5th infant in the room needs a 2nd teacher.'],['Ones','1 : 6','7th child needs a 2nd teacher.'],['Twos','1 : 11','12th child needs a 2nd teacher.'],['Threes','1 : 15','16th child needs a 2nd teacher.'],['Fours / Fives','1 : 20','21st child needs a 2nd teacher.']];
function W(i,o,b){var w={};for(var d=1;d<=5;d++)w[d]={in:i,out:o};return w;}
function WK(i,o,off){var w=W(i,o);delete w[off];return w;}
var DEF={
 'DeLand 2':{
  signedBy:'Miss Honey',
  rooms:{'Infant/Toddler':{tpl:'infant'},'Honey Bees - Tod. Front':{tpl:'ones'},"Three's - Honey Combs":{tpl:'threes'},"Four's - Honey Combs":{tpl:'fours'}},
  standing:[{rooms:["Three's - Honey Combs","Four's - Honey Combs"],s:'08:30',e:'17:30'}],
  staff:[
   {name:'Mrs. Bear',role:'Owner / opener (no set schedule)',room:'',week:W('06:30','12:30'),brk:null,note:'Opens at 6:30 AM'},
   {name:'Miss Demaury',role:'Infant/Toddler',room:'Infant/Toddler',week:WK('07:00','17:30',4),brk:{s:'12:00',e:'13:00'},note:'Lunch window 12:00-2:30 (confirm length)'},
   {name:'Miss Gul',role:'Toddler classroom',room:'Honey Bees - Tod. Front',week:WK('08:00','17:30',3),brk:{s:'12:00',e:'13:00'},note:'1-hour break between 12 and 2, usually 12:00'},
   {name:'Miss Honey',role:'Lunch/snack lead, office',room:"Four's - Honey Combs",week:WK('08:30','16:30',5),brk:null,note:'Straight shift'},
   {name:'Miss Angelina',role:'Older classroom lead',room:"Three's - Honey Combs",week:WK('09:00','17:30',1),brk:{s:'14:30',e:'15:00'},brkDay:{3:{s:'13:30',e:'14:00'}},note:'Break 2:30 (Wed 1:30)'},
   {name:'Miss Emily',role:'Older classroom / flex',room:"Three's - Honey Combs",week:WK('09:30','17:30',2),brk:null,note:'Can work a straight shift to 5:30'}
  ],
  timeline:[
   ['06:30','','Miss Angelina (opener)','Unlock and open. Sign in on the tablet AND the book; take a walkie-talkie. Lights on, soft music. Greet every parent and child by name. If no children yet, start breakfast prep (menu on the fridge).'],
   ['07:00','08:00','Angelina / Emily','Early arrivals may get a simple in-room bite (cereal and milk). Full breakfast service starts at 8:00.'],
   ['07:30','','Miss Emily','Emily signs in and takes a walkie-talkie; opens ALL attendance binders (correct date, every child on the right sheet). Angelina leaves to take her son to school (back at 8:00).'],
   ['08:00','','Miss Demaury','Signs in; opens the Infant/Toddler room (up to 4 infants, or up to 6 toddlers if no infants). Angelina returns.'],
   ['08:00','08:30','Miss Honey','Signs in. Flexible: finish lunch prep (if Emily has not) or assist in the front office. If VPK finish eating before 8:30, walk them to the small classroom by the office for morning work.'],
   ['08:30','','Miss Gul','Signs in; takes over the Toddler classroom. Demaury returns to Infant. All rooms move into Centers per each room\'s own Daily Routine.'],
   ['08:30','10:00','All classrooms','Follow each classroom\'s individual Daily Routine (times and activities already built).'],
   ['10:00','10:25','Threes + Fours/Fives','Combine and go outside (if combined headcount is 20 or under). Twos come inside; tabletop toys while Emily preps the nap/quiet room.'],
   ['10:15','','Miss Honey','Serves lunch to Infants/Toddlers, then presets Angelina\'s classroom for lunch (2 tables, 8-10 children each). Quiet room nearly set up.'],
   ['10:30','','Miss Emily (Twos)','Walk over to eat lunch in the combined room with Fours/Fives on a combined day.'],
   ['10:45','11:00','Honey / Emily / Angelina','Children move to the quiet room: blackout curtains down, music on, tiptoe expectation. Honey starts settling to sleep. Emily and Angelina team-clean the lunch room.'],
   ['11:00','11:30','Miss Emily','Moves to the quiet room to help finish settling children to sleep. Angelina starts the staff break rotation.'],
   ['11:30','12:00','Miss Honey','Children asleep: clean the kitchen and catch up on tasks.'],
   ['12:00','14:00','All staff (quiet time)','Breaks continue. Lesson-plan review, next week\'s crafts and materials, and cleaning charts on the teacher portal. Honey verifies every teacher\'s cleaning chart was actually completed and does the outdoor playground inspection (director portal).'],
   ['14:00','14:15','Angelina / Honey / Emily','Fours/Fives snack together in the pre-set room. Honey and Emily break down quiet-room beds and blankets.'],
   ['14:15','14:45','Honey (or Emily)','Honey covers the combined classroom on a normal day. If Twos+Threes+Fours are ALL combined, Emily covers. Angelina out 2:15-2:45 (picks up her sons).'],
   ['14:45','15:30','Miss Honey','Preps the VPK room for the next day (full reset), office work, assesses what else needs doing before close.'],
   ['15:30','16:30','Remaining staff','Angelina leaves at 3:30; her remaining children move to the small room by the office. Combine classrooms as headcounts drop and begin end-of-day cleaning.'],
   ['16:30','17:30','All classrooms','Start closing down your room: tidy, leave 2-3 centers available.'],
   ['17:30','','Closing','All lights off except the front. AC off, thermostat 79 F overnight (72 F at opening if hot).']
  ]
 },
 'Sanford':{
  signedBy:'Miss Sheena',
  rooms:{'Honeybees - Tod./Inf.':{tpl:'ones'},'VPK/Pre-School (Pollen-Jocks)':{tpl:'fours'},'Schoolagers (Worker Bees)':{tpl:'fours'}},
  staff:[
   {name:'Miss Sheena',role:'VPK lead / opener',room:'VPK/Pre-School (Pollen-Jocks)',week:{1:{in:'06:30',out:'15:30'},2:{in:'06:30',out:'15:00'},3:{in:'06:30',out:'14:00'},4:{in:'06:30',out:'15:30'},5:{in:'06:30',out:'15:30'}},brk:{s:'08:30',e:'09:00'},note:'Afternoon break 1:30-2:00 Mon/Thu/Fri'},
   {name:'Miss Madiha',role:'VPK teacher',room:'VPK/Pre-School (Pollen-Jocks)',week:W('08:30','17:30'),brk:{s:'12:30',e:'13:30'}},
   {name:'Miss Bri',role:'Toddler teacher / bus',room:'Honeybees - Tod./Inf.',week:W('07:45','17:15'),brk:{s:'11:00',e:'12:30'},note:'Before-school bus 7:45; starts afternoon bus 2:30 (1:30 Wed)'},
   {name:'Miss Ashyia',role:'Afterschool teacher',room:'Schoolagers (Worker Bees)',week:{1:{in:'14:30',out:'17:30'},2:{in:'14:30',out:'17:30'},3:{in:'13:30',out:'17:30'},4:{in:'14:30',out:'17:30'},5:{in:'14:30',out:'17:30'}},brk:null}
  ],
  timeline:[
   ['06:30','','Miss Sheena (opener)','Unlock and open. Sign in on the tablet AND the book; take a walkie-talkie. Greet every parent and child. Before-School children sit in the VPK room with Sheena until the 7:45 bus.'],
   ['07:45','','Miss Bri','Signs in; runs the Before-School bus.'],
   ['08:30','','Miss Madiha','Signs in; VPK teacher. Sheena morning break 8:30-9:00.'],
   ['11:00','12:30','Miss Bri (break)','Break covered by Miss Sheena.'],
   ['12:30','13:30','Miss Madiha (break)','Lunch break.'],
   ['14:30','','Miss Ashyia / Miss Bri','Ashyia takes the Toddler room; Bri starts the bus and lets it idle about 15 minutes before the 2:45 run (1:45 Wednesday). Back with the afterschoolers around 3:30.'],
   ['17:30','','Closing','Close the building. More Sanford timeline steps and Wednesday early-release details will be added from SOP-27.']
  ]
 }
};
window.SOP={DAYS:DAYS,AGE:AGE,LETTER:LETTER,RULES:RULES,CLOSING:CLOSING,RATIOS:RATIOS,DEF:DEF};
SOP.toMin=function(t){if(!t)return null;var p=String(t).split(':');return (+p[0])*60+(+p[1]||0);};
SOP.fmt=function(t){if(!t)return '';var p=String(t).split(':'),h=+p[0],m=p[1]||'00',ap=h>=12?'PM':'AM';h=h%12;if(h===0)h=12;return h+':'+m+ap.slice(0,0)+' '+ap;};
SOP.norm=function(s){return String(s||'').toLowerCase().replace(/\b(miss|mrs|ms|mr)\b\.?/g,'').replace(/[^a-z]+/g,' ').trim();};
/* merge saved data over defaults for a school */
SOP.merge=function(school,saved){
 var d=JSON.parse(JSON.stringify(SOP.DEF[school]||{rooms:{},staff:[],timeline:[]}));saved=saved||{};
 var out={rooms:d.rooms,staff:d.staff,timeline:d.timeline.map(function(r,i){return {id:'t'+i,s:r[0],e:r[1],who:r[2],what:r[3]};}),days:{},signedBy:d.signedBy,standing:d.standing||[]};
 ['rooms','staff','timeline','days'].forEach(function(k){if(saved[k]!==undefined&&saved[k]!==null&&!(Array.isArray(saved[k])&&k==='rooms'))out[k]=saved[k];});
 if(Array.isArray(out.days))out.days={};
 Object.keys(out.rooms).forEach(function(r){var o=out.rooms[r];if(!o.blocks){o.blocks=JSON.parse(JSON.stringify((AGE[o.tpl]||{blocks:[]}).blocks));}});
 return out;
};
SOP.dow=function(ymd){var p=ymd.split('-'),d=new Date(+p[0],+p[1]-1,+p[2],12).getDay();return d;};
/* who is working on a date, with day overrides */
SOP.effective=function(D,ymd){
 var dw=SOP.dow(ymd),day=(D.days||{})[ymd]||{},out=[];
 (D.staff||[]).forEach(function(s){var w=(s.week||{})[dw];out.push({name:s.name,role:s.role,room:s.room,in:w?w.in:'',out:w?w.out:'',off:!w,brk:(s.brkDay&&s.brkDay[dw])||s.brk||null,sub:false,note:s.note||''});});
 (day.staff||[]).forEach(function(o){var f=out.filter(function(x){return x.name===o.name;})[0];
  if(f){if(o.off){f.off=true;f.offWhy=o.note||'';}else{f.off=false;if(o.in)f.in=o.in;if(o.out)f.out=o.out;if(o.room)f.room=o.room;if(o.brk!==undefined)f.brk=o.brk;f.changed=true;}}
  else if(!o.off)out.push({name:o.name,role:o.role||'Substitute',room:o.room||'',in:o.in||'',out:o.out||'',off:false,brk:o.brk||null,sub:true,note:o.note||''});});
 return out;
};
})();
