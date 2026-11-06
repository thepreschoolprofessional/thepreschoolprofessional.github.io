/* Hive card home screen. Turns a portal's tab strip into big colored cards.
   Each page sets window.HIVE_CARDS = {prompt:'...', order:[{k:'text in the tab', s:'small caption', c:'#color'}]}
   then loads this file. Tabs not listed still get a card (at the end), so nothing is ever lost. */
(function(){
  var cfg=window.HIVE_CARDS; if(!cfg) return;
  var nav=document.querySelector('nav'); var main=document.querySelector('main');
  if(!nav||!main) return;
  var st=document.createElement('style');
  st.textContent=
   'nav,.biglink{display:none!important}'+
   'body.home main{display:none}'+
   'body:not(.home) #cardHome{display:none}'+
   '#cardHome{max-width:960px;margin:8px auto 24px;padding:0 14px}'+
   '#cardHome h2{text-align:center;font-size:1.05rem;color:#9b8576;margin:6px 0 14px;font-weight:800}'+
   '#cardGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}'+
   '#cardGrid button{border:0;border-radius:18px;padding:20px 10px 16px;color:#fff;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(74,58,48,.2);line-height:1.2;min-height:118px;transition:transform .12s}'+
   '#cardGrid button:active{transform:scale(.97)}'+
   '#cardGrid button{position:relative}#cardGrid button.alert{box-shadow:0 0 0 4px #e53935,0 6px 16px rgba(74,58,48,.25)}#cardGrid .bdg{position:absolute;top:-9px;right:-6px;background:#e53935;color:#fff;border-radius:14px;padding:3px 10px;font-size:.78rem;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,.3);animation:bp 1.6s infinite}@keyframes bp{50%{transform:scale(1.1)}}'+
   '#cardGrid .ic{display:block;font-size:2rem;margin-bottom:6px}'+
   '#cardGrid .tt{display:block;font-weight:900;font-size:1.02rem}'+
   '#cardGrid small{display:block;font-weight:500;opacity:.92;font-size:.78rem;margin-top:4px}'+
   '#cardGrid .lst{display:block;text-align:left;margin:8px 0 0;padding:8px 6px 0 6px;border-top:1px solid rgba(255,255,255,.4);font-size:.74rem;font-weight:500;line-height:1.35}#cardGrid .lst i{display:block;font-style:normal;padding-left:11px;text-indent:-11px}'+
   '#cardGrid .trn{display:block;margin-top:8px}#cardGrid .pill{display:block;margin:4px 0 0;background:rgba(255,255,255,.92);color:#4a3a30;border-radius:999px;padding:5px 8px;font-size:.72rem;font-weight:800;cursor:pointer}'+
   '#cardBack{display:none;position:sticky;top:0;z-index:60;background:rgba(255,247,239,.96);padding:8px 14px;border-bottom:1px solid #eadfce}'+
   'body:not(.home) #cardBack{display:block}'+
   '#cardBack button{border:0;border-radius:14px;padding:10px 18px;font-weight:900;font-size:.95rem;color:#fff;background:#4a3a30;cursor:pointer;font-family:inherit}';
  document.head.appendChild(st);
  document.body.classList.add('home');

  var tabs=[].slice.call(nav.querySelectorAll('.tab'));
  function label(t){return (t.textContent||'').replace(/\s+/g,' ').trim();}
  function bg(t){
    var cs=getComputedStyle(t);
    if(cs.backgroundImage&&cs.backgroundImage!=='none') return cs.backgroundImage;
    return cs.backgroundColor;
  }
  var used=[], cards=[];
  (cfg.order||[]).forEach(function(o){
    var t=tabs.filter(function(x){return used.indexOf(x)<0&&label(x).indexOf(o.k)>-1})[0];
    if(!t) return; used.push(t); cards.push({t:t,s:o.s||'',l:o.l||[],tr:o.t||[],c:o.c||bg(t),base:label(t)});
  });
  tabs.forEach(function(t){ if(used.indexOf(t)<0) cards.push({t:t,s:'',c:bg(t),base:label(t)}); });

  var home=document.createElement('div'); home.id='cardHome';
  home.innerHTML='<h2>'+(cfg.prompt||'What do you want to work on?')+'</h2><div id="cardGrid"></div>';
  var grid=home.querySelector('#cardGrid');
  function mk(cd){
    var m=label(cd.t).match(/^(\S+)\s+(.*)$/); var ic=m?m[1]:'', tt=m?m[2]:label(cd.t);
    var b=document.createElement('button'); b.type='button';
    b.style.background=cd.c;
    b.innerHTML='<span class="ic">'+ic+'</span><span class="tt"></span>'+(cd.s?'<small></small>':'');
    b.querySelector('.tt').textContent=tt; if(cd.s) b.querySelector('small').textContent=cd.s;
    if(cd.l&&cd.l.length){var ul=document.createElement('span');ul.className='lst';cd.l.forEach(function(x){var it=document.createElement('i');it.textContent='\u2022 '+x;ul.appendChild(it);});b.appendChild(ul);}
    if(cd.tr&&cd.tr.length){var tw=document.createElement('span');tw.className='trn';cd.tr.forEach(function(x){var p=document.createElement('span');p.className='pill';p.setAttribute('role','link');p.textContent=(/^https?:/.test(x[1])?'\uD83D\uDD0E ':'\uD83C\uDF93 ')+x[0];p.onclick=function(e){e.stopPropagation();if(/^https?:/.test(x[1]))window.open(x[1],'_blank','noopener');else location.href=x[1];};tw.appendChild(p);});b.appendChild(tw);}
    b.onclick=function(){cd.t.click();};
    cd.b=b; grid.appendChild(b);
    function mirror(){var sp=cd.t.querySelector('span[style*="e53935"]'); if(sp) setBadge(cd,sp.textContent.replace(/[^\w\s]/g,'').trim());}
    try{new MutationObserver(mirror).observe(cd.t,{childList:true,subtree:true,characterData:true});}catch(e){}
    mirror();
  }
  function ttl(cd){var m=label(cd.t).match(/^(\S+)\s+(.*)$/);return (m?m[2]:label(cd.t)).toLowerCase().replace(/[^a-z0-9 ]/g,'');}
  cards.sort(function(x,y){return ttl(x)<ttl(y)?-1:ttl(x)>ttl(y)?1:0;});
  cards.forEach(mk);
  function setBadge(cd,txt){
    var old=cd.b.querySelector('.bdg'); if(old) old.remove(); cd.b.classList.remove('alert');
    if(!txt) return;
    var e=document.createElement('span'); e.className='bdg'; e.textContent=txt; cd.b.appendChild(e); cd.b.classList.add('alert');
  }
  window.HiveCards={badge:function(key,txt){cards.forEach(function(cd){ if(cd.base.indexOf(key)>-1) setBadge(cd,txt); });}};
  /* tabs injected by other scripts after this one ran (e.g. transport.js) still get a card */
  function late(t){
    if(!t||!t.classList||!t.classList.contains('tab')) return;
    if(cards.some(function(c){return c.t===t;})) return;
    var l=label(t), o=(cfg.order||[]).filter(function(x){return l.indexOf(x.k)>-1})[0]||{};
    var cd={t:t,s:o.s||'',c:o.c||bg(t),base:l}; cards.push(cd); mk(cd);
  }
  try{new MutationObserver(function(ms){ms.forEach(function(m){[].forEach.call(m.addedNodes,late);});}).observe(nav,{childList:true});}catch(e){}
  nav.parentNode.insertBefore(home,nav);

  var back=document.createElement('div'); back.id='cardBack';
  back.innerHTML='<button type="button">← All cards</button>';
  back.firstChild.onclick=function(){document.body.classList.add('home');window.scrollTo(0,0);};
  main.parentNode.insertBefore(back,main);

  var orig=window.show;
  if(typeof orig==='function'){
    window.show=function(){var r=orig.apply(this,arguments);document.body.classList.remove('home');window.scrollTo(0,0);return r;};
  }
})();
