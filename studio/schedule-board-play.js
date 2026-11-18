/* 3.325 — 일정에 가져온 작전판(보관함 type:"board") 줄에도 ▶ (제보 5d215b74 «만들어 둔 작전판을 새 일정에» · 10/20 bf084b34 에 한 약속).
   2.946 의 훈련 ▶ 와 같은 규칙: 일정 문서에는 장면을 복사하지 않고, 줄이 카드의 «몇 번째»인지만 안다.
   작전판은 페이지마다 훈련 줄이 하나씩 생긴다(process.html wkbdSetLibItem 1.900) — 줄 ↔ 페이지는 번호(libIdx, 3.325 부터 페이지 번호) · 이름(페이지 이름 또는 «페이지 N»)으로 맞춘다.
   장면 «수»는 일정이 들고 있는 줄인 사본에서 읽는다 — schedule-lib-slim.js 가 pages[].anim 을 떼며 animN 을 남긴다(떼지 않은 사본이면 anim 을 센다).
   여는 일은 작전판 쪽(board-sched-show.js)이 한다 — 보기 전용 슬라이드쇼. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSSchedBoardPlay=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function scenes(p){
    if(!p||typeof p!=='object')return 0;
    var an=p.anim,fr=Array.isArray(an)?an:((an&&Array.isArray(an.frames))?an.frames:null);
    return fr?fr.length:(Math.max(0,parseInt(p.animN,10)||0));
  }
  function pageName(p,i){ return String((p&&p.name)||'').trim()||('페이지 '+(i+1)); }
  /* card = 보관함 자료, td = 일정 줄의 trainData, name = 줄 이름. 맞추지 못하면 null(▶ 없음) */
  function target(card,td,name){
    if(!card||(card.type||'')!=='board'||!td||!td.fromLib)return null;
    var pg=Array.isArray(card.pages)?card.pages:[],nm=String(name||'').trim(),idx=-1;
    var li=(td.libIdx!=null)?parseInt(td.libIdx,10):NaN;
    if(pg.length>1){
      if(!isNaN(li)&&pg[li]&&pageName(pg[li],li)===nm)idx=li;                       // 번호와 이름이 같으면 그대로
      if(idx<0&&nm)for(var i=0;i<pg.length;i++){ if(pageName(pg[i],i)===nm){ idx=i; break; } }   // 옛 줄(번호가 모두 0) · 페이지 순서가 바뀐 자료 — 이름으로
      if(idx<0&&li>0&&pg[li])idx=li;                                                  // 일정에서 이름을 고친 줄 — 번호로(0 은 옛 줄과 구별이 안 돼 믿지 않는다)
      if(idx<0)return null;
      return {libId:td.fromLib,idx:idx,scenes:scenes(pg[idx]),board:true};
    }
    /* 페이지 하나짜리(또는 옛 저장본 — 장면이 최상위 frames) — 자료 이름 줄 하나 */
    var n=pg.length?scenes(pg[0]):0;
    if(!n&&Array.isArray(card.frames))n=card.frames.length;
    return {libId:td.fromLib,idx:0,scenes:n,board:true};
  }
  return {target:target,scenes:scenes,pageName:pageName};
});
