/* 3.329 — 일정에 가져온 작전판(보관함 type:"board") 줄에도 ▶ (제보 5d215b74 «만들어 둔 작전판을 새 일정에» · 10/20 bf084b34 에 한 약속).
   2.946 의 훈련 ▶ 와 같은 규칙: 일정 문서에는 장면을 복사하지 않고, 줄이 카드의 «몇 번째»인지만 안다.
   작전판은 페이지마다 훈련 줄이 하나씩 생긴다(process.html wkbdSetLibItem 1.900) — 줄 ↔ 페이지는 번호(libIdx, 3.329 부터 페이지 번호) · 이름(페이지 이름 또는 «페이지 N»)으로 맞춘다.
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
  /* 3.379 — 그림만 있는 줄(장면 하나)도 그 그림으로 바로(제보 c1bad13d «이미지만 넣으면 … 클릭하면 바로 이미지로»).
     ▶ 자리에 «그림 보기» — 같은 문(보기 전용)을 재생 없이 두드린다(process.html wksAnimPlay(di,ti,1) → reason 'pic').
     훈련 · 세트피스 · 작전판 줄 모두(r = wksLibTrainOf 의 답). 그림이 있는지는 일정 줄의 thumb/snap · 보관함 사본의 그 훈련(페이지) thumb/snap 으로 본다.
     process.html 은 크기 예산(820KB)에 닿아 있어 버튼 글은 여기서 만든다. */
  function hasPic(card,td,r){
    if(!r)return false;
    if(td&&(td.thumb||td.snap))return true;
    if(!card)return false;
    var arr=r.board?card.pages:card.trainings, one=Array.isArray(arr)?arr[r.idx]:null;
    if(one&&(one.thumb||one.snap))return true;
    return !!((!Array.isArray(arr)||arr.length<=1)&&(card.thumb||card.snap));
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var ICON='<svg viewBox="0 0 12 12" width="12" height="12" style="margin:0" aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.2 8.6l2.4-2.5 1.7 1.6 1.3-1.2 2.2 2.1" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';
  /* sheet = 훈련 칩 시트의 큰 버튼 · 아니면 줄 끝 동그란 버튼(.wks-play 모양 그대로 + .wks-pic). card 를 안 주면 일정의 wksLibCard 로 찾는다 */
  function picBtn(di,ti,td,name,cls,r,sheet,card){
    if(!r||r.scenes>1)return '';
    di=parseInt(di,10)||0; ti=parseInt(ti,10)||0;
    if(card===undefined){ try{ card=(typeof wksLibCard==='function')?wksLibCard(r.libId):null; }catch(_){ card=null; } }
    if(!hasPic(card,td,r))return '';
    var go='wksAnimPlay('+di+','+ti+',1)';
    if(sheet)return '<button class="btn solid" onclick="'+go+'">그림 보기</button>';
    return '<span class="'+esc(cls||'wks-play')+' wks-pic" role="button" tabindex="0" title="그림 보기" aria-label="'+esc(name)+' 그림 보기"'
      +' onclick="event.stopPropagation();'+go+'" onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();event.stopPropagation();'+go+'}">'+ICON+'</span>';
  }
  return {target:target,scenes:scenes,pageName:pageName,hasPic:hasPic,picBtn:picBtn};
});
