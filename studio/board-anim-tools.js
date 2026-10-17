/* 작전판 장면 도구 — 장면 이동 속도를 «이 장면만 / 모든 장면에 적용»으로 고르고, 새 장면이 앞 장면 속도를 이어받는다.
   장면 그림(썸네일)을 늦게 채울 때 고른 토큰이 풀리지 않게 id 로 기억했다 되찾는다.
   장면 배열(anim.frames)만 고친다. 되돌리기 기록(pushUndo) · 저장(boardSaveLive)은 부르는 쪽(board.html)이 한다. 따로 저장소는 없다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSBoardAnimTools=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var ALL='all:';
  /* 속도 목록 값 — '1.5' 는 고른 장면만, 'all:1.5' 는 모든 장면. 이상한 값은 1× */
  function speedChoice(value){
    var s=String(value==null?'':value),all=s.indexOf(ALL)===0,n=+(all?s.slice(ALL.length):s);
    return {all:all,speed:(n>0&&isFinite(n))?n:1};
  }
  /* 장면 속도를 바꾸고 바뀐 장면 수를 돌려준다. 모든 장면이면 마지막 장면에도 넣는다(그 뒤에 장면을 더해도 같은 속도) */
  function setSpeed(frames,active,value){
    var c=speedChoice(value),n=0;
    var put=function(f){ if(!f||typeof f!=='object')return; if(f.moveSpeed!==c.speed)n++; f.moveSpeed=c.speed; };
    if(Array.isArray(frames)){ if(c.all)frames.forEach(put); else put(frames[active]); }
    c.changed=n; return c;
  }
  /* 새 장면은 앞 장면의 이동 속도를 이어받는다(모든 장면에 맞춘 속도가 새 장면에서 1× 로 돌아가지 않게) */
  function inheritSpeed(prev,next){
    var v=prev?+prev.moveSpeed:0;
    if(next&&typeof next==='object'&&v>0&&isFinite(v)&&v!==1)next.moveSpeed=v;
    return next;
  }
  /* 고른 것을 id 로 기억한다 — 장면 그림을 만들려고 판을 잠깐 바꿨다 되돌리면(loadSnap) 고른 것이 풀리므로 되돌린 판에서 다시 찾는다.
     토큰 리셋이 뒤 장면 그림을 지우면 곧바로 다시 그리는데, 그때 고른 토큰과 정보 창이 저절로 닫혔다 */
  function selKeys(sel,multi,typeOf){
    var key=function(o){ var t=o&&typeOf?typeOf(o):null; if(!t)return null; var id=t==='ball'?'ball':o.id; return id==null?null:{t:t,id:id}; };
    var one=sel&&sel.ref?key(sel.ref):null; if(one)one.type=sel.type;
    return {one:one,many:(multi||[]).map(key).filter(Boolean)};
  }
  function selFind(keys,st){
    var find=function(k){ if(!k||!st)return null; if(k.t==='ball')return st.ball||null;
      var arr=k.t==='player'?st.players:k.t==='equip'?st.equipment:k.t==='drawing'?st.drawings:null;
      for(var i=0;arr&&i<arr.length;i++)if(arr[i]&&arr[i].id===k.id)return arr[i];
      return null; };
    var one=keys&&keys.one?find(keys.one):null;
    return {sel:one?{type:keys.one.type,ref:one}:null,multi:((keys&&keys.many)||[]).map(find).filter(Boolean)};
  }
  function group(doc,label,opts,prefix){
    var g=doc.createElement('optgroup');g.label=label;
    opts.forEach(function(o){
      if(prefix==null){ g.appendChild(o); return; }
      var c=o.cloneNode(true);c.removeAttribute('selected');c.selected=false;c.value=prefix+o.value;g.appendChild(c);
    });
    return g;
  }
  /* 속도 목록을 두 묶음으로 — 위 «이 장면만»(예전 그대로), 아래 «모든 장면에 적용»(값 앞에 'all:'). 한 번만 */
  function groupSpeedSelect(sel){
    if(!sel||sel.__psGrouped||!sel.ownerDocument)return false;
    var doc=sel.ownerDocument,cur=sel.value,opts=[].slice.call(sel.querySelectorAll('option'));
    if(!opts.length)return false;
    sel.appendChild(group(doc,'이 장면만',opts));
    sel.appendChild(group(doc,'모든 장면에 적용',opts,ALL));
    sel.value=cur;sel.__psGrouped=true;
    sel.title='선택한 장면에서 다음 장면까지 움직이는 속도 · 목록 아래 «모든 장면에 적용»에서 고르면 모든 장면이 같은 속도';
    return true;
  }
  /* 유지 시간은 원래 모든 장면 공통 — 목록 머리에 그렇다고 적는다 */
  function groupHoldSelect(sel){
    if(!sel||sel.__psGrouped||!sel.ownerDocument)return false;
    var cur=sel.value,opts=[].slice.call(sel.querySelectorAll('option'));
    if(!opts.length)return false;
    sel.appendChild(group(sel.ownerDocument,'모든 장면 공통',opts));
    sel.value=cur;sel.__psGrouped=true;
    return true;
  }
  function mount(doc){
    if(!doc||!doc.getElementById)return;
    groupSpeedSelect(doc.getElementById('animSpeedSel'));
    groupHoldSelect(doc.getElementById('animHoldSel'));
  }
  var api={speedChoice:speedChoice,setSpeed:setSpeed,inheritSpeed:inheritSpeed,selKeys:selKeys,selFind:selFind,groupSpeedSelect:groupSpeedSelect,groupHoldSelect:groupHoldSelect,mount:mount};
  /* 작전판에서는 목록 칸(장면 줄)보다 뒤에 읽히므로 바로 붙이고, 앞에 읽혀도 되게 DOMContentLoaded 에 한 번 더(두 번째는 그냥 지나간다) */
  if(typeof document!=='undefined'){
    try{ mount(document); if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ mount(document); }); }catch(_){}
  }
  return api;
});
