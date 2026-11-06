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
,school:{label:'Afterschool (School-Age)',ratio:25,blocks:[]}
};
var LETTER=['This schedule exists for one reason: so we can run this school in excellence, together.','When we are transparent about our schedules and our timing, we get to understand each other\'s days, and that understanding turns into empathy. We stop guessing and start supporting. If you see a teammate carrying more than their share, you can step in. If someone is new or needs a hand, you will be able to see it and help, because the whole day is laid out in front of you: not just your own classroom, but how the entire school moves together.','I do not want us to be a team where people do not communicate, do not share information, or do not understand what everyone else is carrying. I want the opposite: a team that shows each other grace, because we can see, in black and white, that everyone here is working. That is what accountability really looks like: not pressure, but clarity.','When we stay on schedule and help each other, the children get order and consistency. And when the children have that, our stress goes down: we stop reinventing the day every single day. Preschool runs on repetition, and repetition is a gift, not a grind. The more we practice something, the better we get, and the greater we become at the exact same tasks, done with more heart and more skill every time.','I believe in this team. I believe we can send children into kindergarten ready, because of the excellence we practiced with them here, every single day. Above everything else, we do this for the children. Their best interest comes first, always.'];
var RULES=[
 ['Arrival procedure (all staff)','Every staff member, when they arrive for their shift, signs in on the tablet, opens the Attendance Board (Rooms board; we no longer use a paper sign-in book), and takes a walkie-talkie from the front office. This keeps everyone able to reach each other all day. It is not optional.'],
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
function COMB(){return [T('08:30','09:00','Centers & Morning Work'),T('09:00','09:10','School Parade'),T('09:10','09:15','Arrival & Affirmation'),T('09:15','09:20','Morning Meeting'),T('09:20','09:35','Circle / Math Circle'),T('09:35','09:50','Music & Movement'),T('09:50','10:00','Cleanup'),T('10:00','11:00','Playroom or Outside Play (combined)',1),T('11:00','11:15','Come inside, Wash Up / Transition'),T('11:15','12:00','Lunch (served 11:15-11:30)',1),T('12:00','14:00','Quiet Time'),T('14:00','14:30','Snack'),T('14:30','14:45','Afternoon Math Review'),T('14:45','15:30','Centers #1 - Craft'),T('15:30','16:00','Outside Play',1),T('16:00','16:45','Centers #2 - Reading'),T('16:45','17:15','Centers #3 - STREAM'),T('17:15','17:30','Class Meeting / Wind-Down')];}
function TODD(){return [T('08:30','08:40','Arrival'),T('08:40','08:45','Greeting'),T('08:45','08:50','Morning Meeting'),T('08:50','09:00','Music & Movement'),T('09:00','09:10','Circle Time'),T('09:10','09:15','Cleanup'),T('09:15','09:30','Outside Play',1),T('09:30','09:45','Wash Up'),T('09:45','11:00','Centers - Craft'),T('11:00','11:30','Lunch (served by Miss Honey)',1),T('11:30','14:00','Quiet Time / Nap'),T('14:00','14:30','Snack'),T('14:30','14:45','Afternoon Circle'),T('14:45','15:30','Centers #1'),T('15:30','16:00','Outside Play',1),T('16:00','16:45','Centers #2'),T('16:45','17:15','Centers #3'),T('17:15','17:30','Wind-Down & Goodbye')];}
var DEF={
 'DeLand 2':{
  signedBy:'Miss Honey',
  rooms:{'Infant/Toddler':{tpl:'infant'},'Honey Bees - Tod. Front':{tpl:'ones',blocks:TODD()},"Three's - Honey Combs":{tpl:'threes',blocks:COMB()},"Four's - Honey Combs":{tpl:'fours',blocks:COMB()}},
  standing:[{rooms:["Three's - Honey Combs","Four's - Honey Combs"],s:'08:30',e:'17:30'}],
  staff:[
   {name:'Mrs. Bear',role:'Owner / opener (no set schedule)',room:'',week:W('06:30','12:30'),brk:null,note:'Opens at 6:30 AM'},
   {name:'Miss Demaury',role:'Infant/Toddler',room:'Infant/Toddler',week:WK('07:00','17:30',4),brk:{s:'12:00',e:'14:30'},note:'Lunch 12:00-2:30 (32-hour schedule)'},
   {name:'Miss Gul',role:'Toddler classroom',room:'Honey Bees - Tod. Front',week:WK('08:00','17:30',3),brk:{s:'12:00',e:'13:00'},note:'1-hour break between 12 and 2, usually 12:00'},
   {name:'Miss Honey',role:'Lunch/snack lead, office',room:"Four's - Honey Combs",week:WK('08:30','16:30',5),brk:null,note:'Straight shift'},
   {name:'Miss Angelina',role:'Older classroom',room:"Three's - Honey Combs",week:WK('09:00','17:30',1),brk:{s:'14:30',e:'15:00'},brkDay:{3:{s:'13:30',e:'14:00'}},note:'Break 2:30 (Wed 1:30)'},
   {name:'Miss Emily',role:'Float (no classroom)',room:'',week:WK('09:30','17:30',2),brk:null,note:'Can work a straight shift to 5:30'}
  ],
  timeline:[
   ['06:30','','Mrs. Bear (opener)','Unlock and open. Sign in on the tablet and open the Attendance Board (Rooms board). Take a walkie-talkie. Lights on, soft music. Greet every parent and child by name; children are signed in on the Attendance Board. If no children yet, start breakfast prep (menu on the fridge).'],
   ['07:00','','Miss Demaury','Signs in on the tablet; opens the Infant/Toddler room (up to 4 infants, or up to 6 toddlers if no infants). Early arrivals may get a simple in-room bite (cereal and milk). Full breakfast service starts at 8:00.'],
   ['07:30','','Mrs. Bear / first teacher in','Check the Attendance Board: every child who arrived is in the right room, and rooms are ready.'],
   ['08:00','','Miss Gul','Signs in; takes the Toddler classroom (Honey Bees - Tod. Front). Breakfast service starts.'],
   ['08:30','','Miss Honey','Signs in. Flexible: finish lunch prep or assist in the front office. If VPK finish eating before 8:30, walk them to the small classroom by the office for morning work. All rooms move into Centers per each room\'s own Daily Routine.'],
   ['08:30','10:00','All classrooms','Follow each classroom\'s individual Daily Routine (times and activities already built). Circle time starts at 9:00. Keep the Attendance Board current as children arrive.'],
   ['09:00','','Miss Angelina','Signs in; takes the classroom she is assigned for the day (normally the combined Three\'s and Four\'s).'],
   ['09:30','','Miss Emily','Signs in as the FLOAT. She is not assigned a classroom. She covers any teacher who is out, covers breaks, and goes wherever ratio needs her; the director tells her where each day.'],
   ['10:00','11:00','Three\'s + Four\'s (combined)','Go to the playroom or outside for the hour (if combined headcount is 20 or under). Staff in the room take a headcount at every move.'],
   ['11:00','','Miss Honey','Serves lunch to the Toddler class (Honey Bees - Tod. Front). Infants eat on their own individual schedule.'],
   ['11:00','11:15','Combined classroom','Come inside, wash hands and sit down for lunch.'],
   ['11:15','11:30','Miss Honey','Serves lunch to the combined classroom (Three\'s + Four\'s), who eat family style with their teachers (lunch starts 11:15).'],
   ['11:45','12:00','Honey / teachers','Children move to the quiet room: blackout curtains down, music on, tiptoe expectation. Team-clean the lunch room.'],
   ['12:00','14:30','Staff breaks','Breaks start at 12:00. Miss Gul 1 hour (usually 12:00). Miss Demaury lunch 12:00-2:30. Mrs. Bear is out by 12:30. Keep ratio at all times. Lesson-plan review, next week\'s crafts and materials, and cleaning charts on the teacher portal. Honey verifies every teacher\'s cleaning chart was actually completed and does the outdoor playground inspection (director portal).'],
   ['11:30','12:00','Miss Honey','Children asleep: clean the kitchen and catch up on tasks.'],
   ['14:00','14:15','Honey / assigned teachers','Fours/Fives snack together in the pre-set room. Break down quiet-room beds and blankets.'],
   ['14:30','15:00','Miss Angelina (break)','Half-hour break (1:30 on Wednesday). Honey or Emily covers her classroom.'],
   ['14:45','15:30','Miss Honey','Preps the VPK room for the next day (full reset), office work, assesses what else needs doing before close.'],
   ['15:30','16:30','Remaining staff','Combine classrooms as headcounts drop and begin end-of-day cleaning. Miss Honey leaves at 4:30.'],
   ['16:30','17:30','All classrooms','Start closing down your room: tidy, leave 2-3 centers available. Sign out children on the Attendance Board.'],
   ['17:30','','Closing','Make sure every child is signed out on the Attendance Board. All lights off except the front. AC off, thermostat 79 F overnight (72 F at opening if hot).']
  ]
 },
 'Sanford':{
  signedBy:'your director',
  ratios:[['Toddler (Ones)','1 : 6','7th child needs a 2nd teacher.'],['Twos','1 : 11','12th child needs a 2nd teacher. No standalone Twos room; this row applies to any combined room with 2-year-olds.'],['Threes','1 : 15','16th child needs a 2nd teacher. No standalone Threes room; applies to any combined room with 3-year-olds.'],['VPK (Fours / Fives)','1 : 20','21st child needs a 2nd teacher.'],['Afterschool (School-Age)','1 : 25','26th child needs a 2nd teacher.']],
  rules:[
   ['Arrival procedure (all staff)','Every staff member, when they arrive for their shift, signs in on the tablet, opens the Attendance Board (Rooms board; we no longer use a paper sign-in book), and takes a walkie-talkie from the front office. This keeps everyone able to reach each other all day. It is not optional.'],
   ['Customer service (opening procedure)','From the moment the opener unlocks the door at 6:30 AM, and at every drop-off and pickup all day: greet every parent ("good morning" or "hello"), greet the child too, and say "have a great day" when they leave. Non-negotiable.'],
   ['Headcounts','Take a headcount whenever a room\'s makeup changes (bus runs, outside time, homework rotation) and write down how many children are in each room. DCF will ask for this breakdown.'],
   ['Combined age groups (DCF)','When ages are combined in one room (for example 2-year-olds with 3-year-olds, or Toddler overflow sitting with VPK), the ratio for the WHOLE room is governed by the age group that has the MOST children in it. Every combined room needs a same-day breakdown by age group. Example: 15 children, 9 Twos and 6 Threes, uses the Twos ratio (1:11).'],
   ['Sleeping children','If children are asleep and a second teacher is somewhere in the building within sight and reach, only one teacher has to be physically in the room. The ratio math must still check out on paper.'],
   ['Weather','If the weather does not allow VPK\'s afternoon outside time or the Afterschool group\'s outside time, use one of the empty back classrooms instead.'],
   ['Cleaning and safety','Never use bleach or mop while children are in the room. Change mop water during quiet time if it sits long enough to smell. From about 4:30 PM each room starts closing down: tidy and leave 2-3 centers out.'],
   ['Cleaning charts','Cleaning charts are completed on the teacher portal during quiet time. Do not just hit submit: walk the room. Check cubbies (inside and the blankets), the tops of the walls, and that bathrooms are truly wiped down. A director verifies that every chart was actually completed. Miss Madiha does the outdoor playground inspection and verifies the end-of-day inspection before close.'],
   ['Teacher cart (daily reset)','Each room\'s cart lives outside its door, stocked with spoons, bowls, plates, paper towels, trash bags and gloves. Restock when you close each day.']
  ],
  rooms:{
   'Honeybees - Tod./Inf.':{tpl:'ones',blocks:[T('07:45','08:30','Open Toddler room (Bri takes toddlers from the opener)'),T('08:30','09:00','Arrival, Centers & Morning Work'),T('09:00','09:30','Morning Meeting / Circle'),T('09:30','10:00','Outside Play',1),T('10:00','10:15','Wash Up / Transition'),T('10:15','11:15','Lunch & Diaper Change',1),T('11:15','13:30','Quiet Time (lights low, music on)'),T('13:30','14:00','Wake-up & Snack (brought to the room)',1),T('14:00','15:00','Table Time / Centers'),T('15:00','15:15','Outside Play (2nd)',1),T('15:15','16:30','Centers, Reading & Table Time'),T('16:30','17:15','Close down room; combine into VPK as headcount drops'),T('17:15','17:30','Carpet time (combined)')]},
   'VPK/Pre-School (Pollen-Jocks)':{tpl:'fours',blocks:[T('06:30','08:30','Early arrivals and Before-School children wait here with the opener'),T('08:30','09:00','Centers & Morning Work'),T('09:00','09:30','Morning Meeting / Circle'),T('09:30','11:00','Lesson-plan centers, Music & Movement, Cleanup'),T('11:00','11:30','Outside Play (Madiha)',1),T('11:30','12:30','Lunch',1),T('12:30','14:30','Quiet Time / Nap'),T('14:30','15:00','Wake-up, Snack on the cafeteria side',1),T('15:00','15:30','Cafeteria-side tabletop (afterschool snack set on the classroom side)'),T('15:30','16:15','Outside Play with Juliana',1),T('16:15','17:15','Cafeteria-side tabletop (Madiha)'),T('17:15','17:30','Carpet time (combined with Afterschool)')]},
   'Schoolagers (Worker Bees)':{tpl:'school',blocks:[T('06:30','07:45','Before-School group sits in the VPK room'),T('07:45','08:00','Before-School bus run (Bri)'),T('15:30','16:15','Arrive on the bus, Snack & Homework help (Madiha)',1),T('16:15','17:15','Outside Play (Juliana, weather permitting)',1),T('17:15','17:30','Carpet time (combined with VPK)')]}
  },
  standing:[{rooms:['VPK/Pre-School (Pollen-Jocks)','Schoolagers (Worker Bees)','Honeybees - Tod./Inf.'],s:'17:15',e:'17:30'}],
  staff:[
   {name:'Miss Madiha',role:'VPK teacher',room:'VPK/Pre-School (Pollen-Jocks)',week:W('08:30','17:30'),brk:{s:'12:30',e:'13:30'},note:'Lunch break 12:30-1:30 (a director assigns who watches the VPK nap room). Playground inspection and end-of-day inspection.'},
   {name:'Miss Bri',role:'Toddler teacher / bus',room:'Honeybees - Tod./Inf.',week:W('07:45','17:15'),brk:{s:'11:00',e:'12:30'},note:'Before-school bus 7:45. Hands Toddlers to Juliana at 2:30, starts the bus (idle 15 min), afternoon run 2:45 (1:30 and 1:45 on Wednesday), back with the afterschoolers about 3:30.'},
   {name:'Miss Juliana',role:'Afterschool teacher',room:'Schoolagers (Worker Bees)',week:{1:{in:'14:30',out:'17:30'},2:{in:'14:30',out:'17:30'},3:{in:'13:30',out:'17:30'},4:{in:'14:30',out:'17:30'},5:{in:'14:30',out:'17:30'}},brk:null,note:'2:30-5:30 (Wednesday 1:30-5:30). Covers Toddlers 2:30 until Bri is back, then takes VPK outside 3:30-4:15 and the afterschoolers outside 4:15-5:15.'}
  ],
  timeline:[
   ['06:30','','Opener (director assigns)','Unlock and open. Sign in on the tablet and open the Attendance Board (Rooms board); take a walkie-talkie. Lights on, soft music. Greet every parent and child by name. Early arrivals and Before-School children wait in the VPK room until the 7:45 bus.'],
   ['07:45','','Miss Bri','Signs in. Runs the Before-School bus to the elementary school, then opens the Toddler room and takes over any toddlers already on site.'],
   ['08:30','','Miss Madiha','Signs in and joins the VPK room. A director assigns who covers any morning break.'],
   ['09:00','','VPK and Toddler','Morning Meeting: each room circles up in its own room.'],
   ['09:30','10:00','Toddler (Miss Bri)','Outside time.'],
   ['10:00','','Director / lead on duty','Confirm the day\'s headcount for every room (how many Ones, Twos, Threes, Fours, Fives are present, especially in any combined group) and check it against the ratio chart BEFORE any breaks start.'],
   ['10:15','11:15','Toddler (Miss Bri)','Lunch and diaper change. A helper assists with Toddler lunch, then preps the VPK room\'s lunch.'],
   ['11:00','12:30','Miss Bri (break)','Break. A director assigns who covers the Toddler room (lunch wrap-up, quiet-time settle, nap). Toddler quiet time begins 11:15: lights low, music on.'],
   ['11:00','11:30','VPK (Miss Madiha)','Outside play.'],
   ['11:30','12:30','VPK (Miss Madiha)','Lunch.'],
   ['12:30','13:30','Miss Madiha (lunch break)','Madiha\'s break while VPK is in quiet time/nap. A director assigns who watches the VPK nap room. Bri returns and resumes the Toddler room.'],
   ['12:30','14:30','VPK quiet time','Nap. Cleaning charts are completed on the teacher portal in this window (walk the room). Review lesson plans and prep next-day materials.'],
   ['13:30','','Toddler (Miss Bri)','Quiet time ends. Snack is brought TO the Toddler room, then table time.'],
   ['13:30','','WED ONLY - Miss Juliana','Signs in and takes the Toddler room from Bri, a full hour earlier than other days.'],
   ['13:30','','WED ONLY - Miss Bri','Starts the school bus and lets it idle about 15 minutes for the AC.'],
   ['13:30','14:00','WED ONLY - VPK','VPK wakes and puts mats and blankets away right away. Set the two big tables on each side (8 chairs each) for the afterschoolers. VPK has snack on the cafeteria side of the same room (ratio never changes).'],
   ['13:45','','WED ONLY - Miss Bri','Leaves for the afternoon bus run (an hour earlier than other days). Juliana keeps the Toddler room.'],
   ['14:00','14:15','WED ONLY - Toddler (Miss Juliana)','Outside time (2nd).'],
   ['14:00','14:30','WED ONLY - VPK','Wipe down the cafeteria side; tabletop activities there while the afterschoolers\' snack is set out on the classroom side.'],
   ['14:30','','WED ONLY - Bus returns','Bri goes back into Toddler. Juliana takes VPK outside 2:30-3:15. Afterschoolers put bags down and go to the VPK room for snack; Madiha settles them and helps with homework.'],
   ['15:15','','WED ONLY - Rotation','Juliana brings VPK back in (cafeteria-side tabletop) while Madiha resets the classroom side; Juliana takes the afterschoolers outside 3:15-4:15.'],
   ['16:15','17:30','WED ONLY - All combine','Afterschool comes in. Every child (VPK and Afterschool) goes to the carpet for a book, video or phonics activity until pickup.'],
   ['14:30','','Miss Juliana (Mon/Tue/Thu/Fri)','Signs in and takes the Toddler room from Bri. (Wednesday: 1:30.)'],
   ['14:30','','VPK wake-up (Mon/Tue/Thu/Fri)','Mats and blankets away right away. Set the two big tables on each side (8 chairs) for the afterschoolers. VPK snack 2:30-3:00 on the cafeteria side of the same room.'],
   ['14:30','','Miss Bri (Mon/Tue/Thu/Fri)','Starts the school bus and lets it idle about 15 minutes. Leaves on the afternoon run at 2:45.'],
   ['15:00','15:15','Toddler (Miss Juliana)','Outside time (2nd).'],
   ['15:00','15:30','VPK (Miss Madiha)','Wipe down the cafeteria side; tabletop activities there while afterschool snack is set out on the classroom side.'],
   ['15:30','','Bus returns with afterschoolers','Bri returns to the Toddler room. Juliana takes VPK outside 3:30-4:15. Afterschoolers put bags down and go straight to the VPK room for snack (already set out); Madiha settles them and helps with homework.'],
   ['16:15','','Rotation','Juliana brings VPK back in to the cafeteria side for tabletop while Madiha resets the classroom side (same room all day, ratio does not change). Juliana then takes the afterschoolers (homework done) outside 4:15-5:15; if it is too hot she can swap out with Madiha or Bri.'],
   ['16:30','','All classrooms','Start closing down your room: tidy and leave 2-3 centers available.'],
   ['17:15','','Miss Bri','Shift ends. Any remaining Toddlers (if not over ratio) combine into VPK.'],
   ['17:15','17:30','All classrooms combine','Carpet time: an educational book, video or phonics activity until pickup.'],
   ['17:30','','Closing','Make sure every child is signed out on the Attendance Board. All lights off except the front. AC off, thermostat 79 F overnight (72 F at opening if hot).']
  ]
 }
};
window.SOP={DAYS:DAYS,AGE:AGE,LETTER:LETTER,RULES:RULES,CLOSING:CLOSING,RATIOS:RATIOS,DEF:DEF};
SOP.COLORS=[['#ffd9d0','#c0392b'],['#d6ecff','#1565c0'],['#dff3d8','#2e7d32'],['#fff0b8','#b8860b'],['#ead9ff','#6a1b9a'],['#ffe0f0','#ad1457'],['#d3f4f1','#00796b'],['#ffe5c2','#e65100']];
SOP.color=function(D,name){var i=0,L=D.staff||[];for(var k=0;k<L.length;k++){if(L[k].name===name){i=k;break;}if(k===L.length-1)i=L.length+(name||'').length;}return SOP.COLORS[i%SOP.COLORS.length];};
SOP.toMin=function(t){if(!t)return null;var p=String(t).split(':');return (+p[0])*60+(+p[1]||0);};
SOP.fmt=function(t){if(!t)return '';var p=String(t).split(':'),h=+p[0],m=p[1]||'00',ap=h>=12?'PM':'AM';h=h%12;if(h===0)h=12;return h+':'+m+ap.slice(0,0)+' '+ap;};
SOP.norm=function(s){return String(s||'').toLowerCase().replace(/\b(miss|mrs|ms|mr)\b\.?/g,'').replace(/[^a-z]+/g,' ').trim();};
/* merge saved data over defaults for a school */
SOP.merge=function(school,saved){
 var d=JSON.parse(JSON.stringify(SOP.DEF[school]||{rooms:{},staff:[],timeline:[]}));saved=saved||{};
 var out={school:school,rooms:d.rooms,staff:d.staff,timeline:d.timeline.map(function(r,i){return {id:'t'+i,s:r[0],e:r[1],who:r[2],what:r[3]};}),days:{},signedBy:d.signedBy,standing:d.standing||[],ratios:d.ratios||null,rules:d.rules||null};
 ['rooms','staff','timeline','days'].forEach(function(k){if(saved[k]!==undefined&&saved[k]!==null&&!(Array.isArray(saved[k])&&k==='rooms'))out[k]=saved[k];});
 if(Array.isArray(out.days))out.days={};
 Object.keys(out.rooms).forEach(function(r){var o=out.rooms[r];if(!o.blocks){o.blocks=JSON.parse(JSON.stringify((AGE[o.tpl]||{blocks:[]}).blocks));}});
 return out;
};
SOP.dow=function(ymd){var p=ymd.split('-'),d=new Date(+p[0],+p[1]-1,+p[2],12).getDay();return d;};
/* who is working on a date, with day overrides */

/* School closure calendar 2026-27 (same dates both schools; from the posted closure flyers). all = closed for everyone; partial = VPK and school-age closed, preschool open; early = closes early. */
var CL_ALL={'2026-11-11':'Veterans Day','2026-11-26':'Thanksgiving','2026-11-27':'Day after Thanksgiving','2026-12-23':'Christmas Break','2026-12-24':'Christmas Break','2026-12-25':'Christmas Day','2027-01-01':"New Year's Day",'2027-01-18':'Martin Luther King Jr. Day','2027-03-26':'Good Friday','2027-05-31':'Memorial Day','2027-06-18':'Juneteenth'};
var CL_PART={'2026-11-23':'Thanksgiving Break','2026-11-24':'Thanksgiving Break','2026-11-25':'Thanksgiving Break','2026-12-21':'Winter Break','2026-12-22':'Winter Break','2026-12-28':'Winter Break','2026-12-29':'Winter Break','2026-12-30':'Winter Break','2026-12-31':"New Year's Eve (close early 5 PM)",'2027-01-04':'District holiday','2027-01-05':'District holiday (Sanford)','2027-02-15':"Presidents' Day",'2027-03-15':'Spring Break','2027-03-16':'Spring Break','2027-03-17':'Spring Break','2027-03-18':'Spring Break','2027-03-19':'Spring Break','2027-03-22':'District holiday'};
var CL_EARLY={'2026-12-31':'17:00'};
SOP.closure=function(ymd,school){var n=CL_ALL[ymd];if(n)return {type:'all',name:n};n=CL_PART[ymd];if(n){if(ymd==='2027-01-05'&&school==='DeLand 2')n=null;if(n)return {type:'partial',name:n,early:CL_EARLY[ymd]||''};}return null;};
SOP.effective=function(D,ymd){
 var dw=SOP.dow(ymd),day=(D.days||{})[ymd]||{},out=[];
 (D.staff||[]).forEach(function(s){var w=(s.week||{})[dw];out.push({name:s.name,role:s.role,room:s.room,in:w?w.in:'',out:w?w.out:'',off:!w,brk:(s.brkDay&&s.brkDay[dw])||s.brk||null,sub:false,note:s.note||''});});
 (day.staff||[]).forEach(function(o){var f=out.filter(function(x){return x.name===o.name;})[0];
  if(f){if(o.off){f.off=true;f.offWhy=o.note||'';}else{f.off=false;if(o.in)f.in=o.in;if(o.out)f.out=o.out;if(o.room)f.room=o.room;if(o.brk!==undefined)f.brk=o.brk;f.changed=true;}}
  else if(!o.off)out.push({name:o.name,role:o.role||'Substitute',room:o.room||'',in:o.in||'',out:o.out||'',off:false,brk:o.brk||null,sub:true,note:o.note||''});});
 var cl=SOP.closure(ymd,D.school||'');
 if(cl&&cl.type==='all'){out.forEach(function(x){x.off=true;x.offWhy='School closed: '+cl.name;x.closed=true;});}
 else if(cl&&cl.early){out.forEach(function(x){if(!x.off&&x.out&&SOP.toMin(x.out)>SOP.toMin(cl.early)){x.out=cl.early;x.changed=true;}});}
 return out;
};
})();
