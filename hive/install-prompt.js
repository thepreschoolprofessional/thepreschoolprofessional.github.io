/* Kid City parent portal: friendly "put this on your phone like an app" banner. One script line in parent.html loads this. */
(function(){
  try{
    var h=document.head;
    function add(tag,attrs){var e=document.createElement(tag);for(var k in attrs)e.setAttribute(k,attrs[k]);h.appendChild(e);}
    add('link',{rel:'manifest',href:'parent.webmanifest'});
    add('link',{rel:'apple-touch-icon',href:'apple-touch-icon.png'});
    add('meta',{name:'apple-mobile-web-app-capable',content:'yes'});
    add('meta',{name:'mobile-web-app-capable',content:'yes'});
    add('meta',{name:'apple-mobile-web-app-title',content:'Kid City'});
    add('meta',{name:'theme-color',content:'#5b7a3a'});
  }catch(e){}
  var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
  if(standalone)return;
  var until=0;try{until=+localStorage.getItem('kc_install_hide')||0;}catch(e){}
  if(Date.now()<until)return;
  var ua=navigator.userAgent||'';
  var isApple=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var isAndroid=/Android/.test(ua);
  if(!isApple&&!isAndroid)return; /* only on phones and tablets */
  function hide(days){try{localStorage.setItem('kc_install_hide',String(Date.now()+days*864e5));}catch(e){}var b=document.getElementById('kcInstall');if(b)b.remove();}
  function show(){
    var b=document.createElement('div');b.id='kcInstall';
    b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#fff;border:3px solid #d9a521;border-radius:18px;box-shadow:0 8px 28px rgba(0,0,0,.28);padding:16px;font-family:Arial,Helvetica,sans-serif;color:#4a3a30;max-width:520px;margin:0 auto';
    b.innerHTML='<div style="font-size:18px;font-weight:bold;color:#5b7a3a;margin-bottom:4px">Keep the Parent Portal on your phone</div>'+
      '<div style="font-size:15px;line-height:21px;margin-bottom:12px">Add it to your '+(isApple?'iPhone or iPad':'phone or tablet')+' home screen so it opens like an app. Nothing to download from an app store.</div>'+
      '<a href="install-app.html" style="display:block;text-align:center;background:#5b7a3a;color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:13px;border-radius:12px;margin-bottom:8px">Show me how</a>'+
      '<div style="display:flex;gap:8px"><button id="kcLater" style="flex:1;background:#f7f0dd;border:0;border-radius:10px;padding:11px;font-size:14px;color:#4a3a30">Not now</button><button id="kcNever" style="flex:1;background:#f7f0dd;border:0;border-radius:10px;padding:11px;font-size:14px;color:#4a3a30">Do not show again</button></div>';
    document.body.appendChild(b);
    document.getElementById('kcLater').onclick=function(){hide(7);};
    document.getElementById('kcNever').onclick=function(){hide(3650);};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(show,1200);});else setTimeout(show,1200);
})();
