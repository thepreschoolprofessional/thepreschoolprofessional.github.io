/* Rooms Paper Form — renders one room's day as a replica of the Kid City USA "ATTENDANCE ROSTER".
   Used by the Rooms board (DCF / Paper view, print) AND by the end-of-day PDF builder (Playwright).
   Pure functions, no network. Names are First name + last initial only (standing rule). */
(function(root){
'use strict';
var SLOTS = ['06:30','07:30','08:30','09:30','10:30','11:30','12:30','13:30','14:30','15:30','16:30','17:30','18:30'];
var SLOT_LABELS = ['630','730','830','930','1030','1130','1230','130','230','330','430','530','630'];

function esc(s){ return (s==null?'':(''+s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function fmt12(hm){ if(!hm) return ''; var p=hm.split(':'); var h=+p[0]; var ap=h>=12?'p':'a'; h=h%12||12; return h+':'+p[1]+ap; }
function monthsOld(dob, dateStr){
  if(!dob) return null;
  var d=new Date(dob+'T12:00:00'), t=new Date(dateStr+'T12:00:00');
  var m=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth());
  if(t.getDate()<d.getDate()) m--;
  return m;
}
function ageStr(dob, dateStr){
  var m=monthsOld(dob,dateStr); if(m==null) return '';
  if(m<24){ var y=(m/12).toFixed(1).replace(/\.0$/,''); return y.replace(/^0\./,'.'); }
  return ''+Math.floor(m/12);
}
function fmtDob(dob){ if(!dob) return ''; var p=dob.split('-'); return p[1]+'/'+p[2]+'/'+p[0]; }
/* Florida child-to-staff ratios by the YOUNGEST child in the group (months) */
function requiredRatio(minMonths){
  if(minMonths==null) return null;
  if(minMonths<12) return 4;
  if(minMonths<24) return 6;
  if(minMonths<36) return 11;
  if(minMonths<48) return 15;
  if(minMonths<60) return 20;
  return 25;
}
function presentAt(a, hm){ return !!(a && a.Arrival && a.Arrival<=hm && (!a.Departure || hm<a.Departure)); }
function staffAt(staff, hm){
  var n=0; Object.keys(staff||{}).forEach(function(k){ (staff[k]||[]).forEach(function(s){ if(s.in && s.in<=hm && (!s.out || hm<s.out)) n++; }); });
  return n;
}
/* Kid City rule: the ratio follows the MAJORITY age group in the room (not the youngest child).
   Age groups: under 1, 1s, 2s, 3s, 4s, 5+. On a tie the younger group (stricter ratio) wins. */
function ageBracket(m){ return m<12?0:m<24?1:m<36?2:m<48?3:m<60?4:5; }
var BRACKET_MIN=[0,12,24,36,48,60], BRACKET_NAME=['infants','1s','2s','3s','4s','5s+'];
/* children: [{name,dob}], att: {name: attRow}, staff: {teacher:[{in,out}]} -> {kids, staff, req, over, grp} at time hm */
function ratioAt(children, att, staff, hm, dateStr){
  var kids=0, cnt=[0,0,0,0,0,0];
  children.forEach(function(c){
    var a=att[c.name];
    if(presentAt(a,hm)){ kids++; var m=monthsOld(c.dob,dateStr); if(m!=null) cnt[ageBracket(m)]++; }
  });
  var best=-1;
  for(var i=0;i<6;i++){ if(cnt[i]>0 && (best<0 || cnt[i]>cnt[best])) best=i; }
  var st=staffAt(staff,hm), req=best<0?null:requiredRatio(BRACKET_MIN[best]);
  var over = (kids>0 && req!=null && (st===0 || kids/st>req));
  return {kids:kids, staff:st, req:req, over:over, grp:best<0?'':BRACKET_NAME[best]};
}

var CSS = ''
+ '.pf{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;width:100%;max-width:1100px;margin:0 auto 24px;padding:10px 12px;box-sizing:border-box;font-size:11px;}'
+ '.pf *{box-sizing:border-box;}'
+ '.pf table{border-collapse:collapse;width:100%;}'
+ '.pf td,.pf th{border:1.2px solid #111;padding:2px 4px;vertical-align:middle;}'
+ '.pf .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;}'
+ '.pf .logo{font-weight:900;font-size:15px;line-height:1.1;} .pf .logo small{display:block;font-weight:600;font-size:9px;font-style:italic;}'
+ '.pf .ttl{font-weight:900;font-size:16px;letter-spacing:.5px;align-self:center;}'
+ '.pf .box td{font-weight:800;font-size:12px;} .pf .box td.v{min-width:170px;}'
+ '.pf th{font-weight:800;font-size:9.5px;background:#fff;}'
+ '.pf .c{text-align:center;} .pf .nm{text-align:left;font-weight:700;white-space:nowrap;}'
+ '.pf .tick{font-weight:900;font-size:12px;}'
+ '.pf .sm{font-size:9px;} .pf .vis{font-style:italic;color:#555;font-size:9px;}'
+ '.pf .lp{padding:0;} .pf .lp div{display:flex;} .pf .lp span{flex:1;text-align:center;padding:2px 0;} .pf .lp span+span{border-left:1.2px solid #111;}'
+ '.pf .gap{height:8px;}'
+ '.pf .over{background:#ffd9d9;font-weight:900;}'
+ '.pf .notes{margin-top:8px;font-size:10px;line-height:1.35;} .pf .notes b{font-size:11px;}'
+ '.pf .hl{background:#fff36b;padding:0 2px;}'
+ '.pf .hc{margin-top:6px;font-size:10px;}'
+ '.pf .ft{margin-top:6px;font-size:9px;color:#666;}'
+ '@media print{ @page{size:landscape;margin:8mm;} body{background:#fff !important;} .pf{page-break-after:always;max-width:none;margin:0;padding:0;} .pf:last-child{page-break-after:auto;} .noprint{display:none !important;} }';

var NOTE_TEXT = 'ATTENDANCE IS DONE: 1. BEFORE YOU LEAVE TRANSITION AREA 2. BEFORE YOU HAVE CHILDREN GO INTO NEXT TRANSITION AREA. ONE "X" GOES BEFORE YOU LEAVE AND THE OTHER "X" BEFORE YOU RELEASE CHILDREN/CHILD. WRITE IN WHERE YOU ARE GOING UNDER "TRANSITION" (PLAYGROUND, ANOTHER CLASSROOM, X-TREAM ROOM, ETC). WRITE THE TIME YOU LEFT UNDER "OUT" AND THE TIME YOU RETURNED UNDER "IN". BRING WATER, CUPS AND YOUR OUTSIDE BAG BEFORE YOU LEAVE THE CLASSROOM.';

function longDate(ds){ var p=ds.split('-'); return +p[1]+'/'+(+p[2])+'/'+p[0]; }

/* opts: {school, room, date, teachers:[names], children:[{name,dob,visiting}], att:{name:row}, day:{staff,transitions,counts,mgmt}} */
function render(o){
  var day=o.day||{}; var staff=day.staff||{}; var trans=day.transitions||[]; var counts=day.counts||[]; var mgmt=day.mgmt||{};
  var teachers=(o.teachers||[]).slice();
  Object.keys(staff).forEach(function(k){ if(teachers.indexOf(k)<0) teachers.push(k); });
  while(teachers.length<3) teachers.push('');
  var h='<div class="pf">';
  h+='<div class="top"><div class="logo">Kid City USA<small>"Where Kids Can Bee Kids"</small></div><div class="ttl">ATTENDANCE ROSTER</div>'
   +'<table class="box" style="width:auto"><tr><td>Classroom</td><td class="v">'+esc(o.room)+'</td></tr><tr><td>Date</td><td class="v">'+esc(longDate(o.date))+'</td></tr></table></div>';
  // teachers
  h+='<table><tr><th style="width:26%">Teacher Name</th><th>Time In</th><th>Time Out</th><th>Time In</th><th>Time Out</th><th>Time In</th><th>Time Out</th></tr>';
  teachers.forEach(function(t){
    var s=(staff[t]||[]);
    h+='<tr><td class="nm">'+esc(t)+'</td>';
    for(var i=0;i<3;i++){ h+='<td class="c">'+esc(fmt12(s[i]&&s[i].in))+'</td><td class="c">'+esc(fmt12(s[i]&&s[i].out))+'</td>'; }
    h+='</tr>';
  });
  h+='</table><div class="gap"></div>';
  // children table
  var rows=o.children.length; var pad=Math.max(0,15-rows);
  var tcols=[0,1,2];
  h+='<table><tr><th rowspan="2" style="width:22px">#</th><th rowspan="2" style="width:15%">Child\'s Name</th><th rowspan="2">DOB</th><th rowspan="2">Age</th><th rowspan="2">Arrival</th><th rowspan="2">Departure</th><th rowspan="2" style="width:24px">B</th><th rowspan="2" style="width:56px">L / P</th><th rowspan="2" style="width:26px">WC</th><th rowspan="2" style="width:22px">IR</th><th rowspan="2" style="width:22px">AR</th>';
  tcols.forEach(function(i){ var t=trans[i]; h+='<th colspan="2">Transition #'+(i+1)+'<br><span class="vis">'+esc(t?t.dest:'')+'</span></th>'; });
  h+='</tr><tr>';
  tcols.forEach(function(i){ var t=trans[i]; h+='<th>OUT<br><span class="vis">'+esc(t?fmt12(t.out):'')+'</span></th><th>IN<br><span class="vis">'+esc(t&&t.in?fmt12(t.in):'')+'</span></th>'; });
  h+='</tr>';
  o.children.forEach(function(c,idx){
    var a=o.att[c.name]||{};
    var cell=function(v){ return '<td class="c tick">'+(v?'&#10003;':'')+'</td>'; };
    var present=!!a.Arrival;
    h+='<tr><td class="c">'+(idx+1)+'</td><td class="nm">'+esc(c.name)+(c.visiting?' <span class="vis">('+esc(c.visiting)+')</span>':'')+'</td><td class="c">'+esc(fmtDob(c.dob))+'</td><td class="c">'+esc(ageStr(c.dob,o.date))+'</td>'
     +'<td class="c">'+esc(fmt12(a.Arrival))+'</td><td class="c">'+esc(fmt12(a.Departure))+'</td>'
     +cell(a.B)+'<td class="lp"><div><span class="tick">'+(a.L?'&#10003;':'&nbsp;')+'</span><span class="tick">'+(a.P?'&#10003;':'&nbsp;')+'</span></div></td>'
     +'<td class="c sm">'+esc(fmt12(a.WC))+'</td><td class="c sm">'+(a.IR?'IR':'')+'</td><td class="c sm">'+(a.AR?'AR':'')+'</td>';
    tcols.forEach(function(i){
      var t=trans[i]; var wasOut=!!(t && t.kids && t.kids.indexOf(c.name)>-1);
      h+='<td class="c tick">'+(wasOut?'X':'')+'</td><td class="c tick">'+(wasOut&&t.in?'X':'')+'</td>';
    });
    h+='</tr>';
  });
  for(var p=0;p<pad;p++){
    h+='<tr><td class="c">'+(rows+p+1)+'</td><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td class="lp"><div><span>&nbsp;</span><span>&nbsp;</span></div></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  }
  // sweep rows
  h+='<tr><td colspan="11" style="border:none"></td>';
  tcols.forEach(function(i){ var t=trans[i]; h+='<td colspan="2" class="sm"><b>Sweep Count</b> '+(t?esc((t.outCount!=null?t.outCount:'')+(t.in?' / '+(t.inCount!=null?t.inCount:''):'')):'')+'</td>'; });
  h+='</tr><tr><td colspan="11" style="border:none"></td>';
  tcols.forEach(function(i){ var t=trans[i]; h+='<td colspan="2" class="sm"><b>Initial</b> '+(t?esc((t.outBy||'')+(t.in&&t.inBy?' / '+t.inBy:'')):'')+'</td>'; });
  h+='</tr></table><div class="gap"></div>';
  // ratio grid
  var kidsList=o.children.map(function(c){return {name:c.name,dob:c.dob};});
  h+='<table style="width:75%"><tr><th style="width:22%;text-align:left">Time</th>';
  SLOT_LABELS.forEach(function(l){ h+='<th>'+l+'</th>'; });
  h+='</tr><tr><td class="nm">Children : Staff Ratio</td>';
  SLOTS.forEach(function(s){
    var show = (o.asOf==null) || s<=o.asOf;
    var r=ratioAt(kidsList,o.att,staff,s,o.date);
    var txt = (show && (r.kids>0||r.staff>0)) ? (r.kids+':'+r.staff) : '';
    h+='<td class="c sm'+(txt&&r.over?' over':'')+'">'+txt+'</td>';
  });
  h+='</tr><tr><td class="nm">Management Initials</td>';
  SLOTS.forEach(function(s){ h+='<td class="c sm">'+esc(mgmt[s]||'')+'</td>'; });
  h+='</tr></table><div class="ft" style="margin-top:2px">Ratio limit follows the majority age group in the room (Kid City policy); a tie uses the younger group.</div>';
  // headcount log
  if(counts.length){
    h+='<div class="hc"><b>Headcounts / sweeps:</b> '+counts.map(function(c){ return esc(fmt12(c.t))+' &mdash; '+esc(c.count)+(c.kind==='sweep'?' (sweep)':'')+(c.by?' ('+esc(c.by)+')':''); }).join(' &nbsp;|&nbsp; ')+'</div>';
  }
  if(trans.length>3){
    h+='<div class="hc"><b>More transitions:</b> '+trans.slice(3).map(function(t,i){ return '#'+(i+4)+' '+esc(t.dest)+' out '+esc(fmt12(t.out))+(t.in?' in '+esc(fmt12(t.in)):''); }).join(' | ')+'</div>';
  }
  h+='<div class="notes"><b>NOTES:</b> <span class="hl">'+esc(NOTE_TEXT)+'</span><br><span class="hl">CALL FOR A "SWEEP" AFTER YOU LEAVE CLASSROOM AND AFTER YOU RETURN TO CLASSROOM</span><br><span class="hl">ALWAYS DO A HEAD COUNT EVERY 10 MINUTES TO MAKE SURE ALL CHILDREN ARE ACCOUNTED FOR.</span></div>';
  h+='<div class="ft">'+esc(o.school||'')+' &middot; Generated from The Hive Rooms board. Names shown as first name + last initial.</div>';
  h+='</div>';
  return h;
}

root.RoomsPaper = {SLOTS:SLOTS, SLOT_LABELS:SLOT_LABELS, CSS:CSS, render:render, fmt12:fmt12, ageStr:ageStr, monthsOld:monthsOld, requiredRatio:requiredRatio, presentAt:presentAt, staffAt:staffAt, ratioAt:ratioAt, esc:esc};
if(typeof module!=='undefined') module.exports=root.RoomsPaper;
})(typeof window!=='undefined'?window:globalThis);
