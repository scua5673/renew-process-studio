/* 교과서도 기존 board.html의 렌더러·스냅·재생기를 그대로 사용한다.
   별도 편집기는 만들지 않으며 community_view의 읽기 전용·저장 차단을 유지한다. */
(function(){
 'use strict';
 const q=new URLSearchParams(location.search);
 if(q.get('textbook_view')!=='ch10'||q.get('community_view')!=='1'||window.parent===window)return;
 const allowed=/^(choice|carry|direct|secure|follow(?:_fail|_coach)?|drill[123](?:_fail|_coach)?)$/;
 const origin=location.origin;
 let catalog=null,active='',last='',mounted=false;
 function post(d){parent.postMessage(Object.assign({source:'textbook-native'},d),origin);}
 function notify(){
  if(!active)return;
  const progress=animPlaying?animPauseState:animPaused;
  const idx=progress?Math.min(anim.frames.length-1,progress.s+(progress.phase==='move'?1:0)):Math.max(0,animActive);
  const d={type:'state',scene:active,index:idx,playing:!!animPlaying},sig=JSON.stringify(d);
  if(sig!==last){last=sig;post(d);}
 }
 function choose(key){
  if(!catalog||!allowed.test(key)||!Object.prototype.hasOwnProperty.call(catalog,key))return;
  const item=catalog[key];stopAnim();active=key;last='';
  loadSnap(item.frames[0].snap);window.__animLoad(item.frames);animHold=2.1;
  applyView();document.getElementById('board').setAttribute('aria-label',item.label);
  notify();
 }
 function pause(){
  if(!animPlaying)return;
  if(animPauseState)animPaused=animPauseState;
  animPlaying=false;if(animRaf)cancelAnimationFrame(animRaf);animRaf=null;updatePlayUI();
 }
 window.addEventListener('message',e=>{
  const d=e.data||{};
  if(e.origin!==origin||e.source!==parent||d.source!=='textbook-chapter'||d.type!=='native-board'||!mounted)return;
  if(d.action==='scene'){choose(d.scene);return;}
  if(d.scene!==active)return;
  const idx=animPlaying&&animPauseState?animPauseState.s:Math.max(0,animActive);
  if(d.action==='prev'||d.action==='next'){selectAnimFrame(Math.max(0,Math.min(anim.frames.length-1,idx+(d.action==='prev'?-1:1))));}
  else if(d.action==='play'){if(animPlaying)pause();else playAnim();}
  else if(d.action==='stop')pause();
  notify();
 });
 async function init(){
  try{
   const response=await fetch('textbook/packs/ch10-scenes.json',{credentials:'same-origin',redirect:'error'});
   if(!response.ok)throw Error('catalog');catalog=await response.json();
   let tries=0;
   function mount(){
    if(!window.__boardReady){if(++tries<80){setTimeout(mount,100);return;}post({type:'error'});return;}
    document.documentElement.classList.add('textbook-native');
    document.documentElement.classList.remove('comm-boot');
    document.body.classList.add('comm-viewing','vcreating');
    // 원래 판의 SVG 자체를 문서용 창으로 옮긴다. 전술 기호와 애니메이션 함수는 그대로다.
    const host=document.createElement('main');host.id='textbookNativeHost';document.body.appendChild(host);
    host.appendChild(document.getElementById('board'));
    const nativeView=applyView;
    applyView=function(){nativeView();if(active&&catalog[active])svg.setAttribute('viewBox',catalog[active].viewport.join(' '));};
    autoOrient=false;window.__vaultReadOnly=true;
    mounted=true;choose(allowed.test(q.get('scene')||'')?q.get('scene'):'choice');
    new ResizeObserver(()=>applyView()).observe(host);
    setInterval(notify,120);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();notify();}});
    post({type:'ready'});
   }
   mount();
  }catch(_){post({type:'error'});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
