/* 3.288 — 장면별 썸네일 저장 다이어트(제보 de2e508c «오류가 점점 더 빈번 · 저장된 파일이 너무 많아서일까요?» — 맥 크롬 탭 종료).
   실측(11/14 · 그 사용자의 서버 보관함 34개 135MB): 페이지 장면의 썸네일 `pages[].anim.frames[1…].thumb` 가 103MB(76%) · 판 자체(frames[].snap)는 10MB.
   작전판은 2.559 부터 맨 위 `frames` 는 장면 0 의 썸네일만 저장했지만(_animToFrames), 여러 페이지 작전판의 `pages[].anim` 은 통째로 저장했다.
   보관함은 목록 한 덩어리 · 작업 보드 기록은 raw + base.raw(+ attempt · 초안 · 구조 사본)라 이 글자들이 읽기 · 쓰기 · 복사마다 몇 배로 불어난다.
   장면 썸네일은 장면 줄(__afWindow)이 보이는 칸만 `__snapToThumb` 로 다시 그리는 캐시다 — 저장하지 않아도 화면은 같다(장면 0 · 페이지 · 카드 그림은 남긴다).
   · 순수 규칙: has(it) · strip(it) — 맨 위 frames(3.005 와 같은 규칙) + pages[].anim.frames. 훈련(trainings) · 미팅 슬라이드는 건드리지 않는다.
   · 동기화(sync.js libDietHas · libDietItem · LIB_DIET 2): 이 기기 사본에서만 뗀다 — 올리지 않고 시각도 그대로(3.005 «기준 지문만 옮긴다» 길 그대로).
   · 작전판(mountBoard): 저장으로 나가는 사본만 뗀다 — `__psPages.forSave()`(보관함) · `liveVal()`(작업 보드 기록 · 초안 · 구조 사본). 화면의 페이지(메모리)는 그대로. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSLibDiet=api;try{if(root.document)root.document.addEventListener('DOMContentLoaded',function(){api.mountBoard(root);});}catch(_){}}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function fat(f){return obj(f)&&typeof f.thumb==='string'&&!!f.thumb;}
  /* 장면 1 부터 — 장면 0 의 그림은 남긴다(카드 · 목록이 쓴다) */
  function framesHas(fr){if(!Array.isArray(fr))return false;for(var i=1;i<fr.length;i++)if(fat(fr[i]))return true;return false;}
  function framesStrip(fr){var n=0;if(!Array.isArray(fr))return 0;for(var i=1;i<fr.length;i++)if(fat(fr[i])){delete fr[i].thumb;n++;}return n;}
  function pageFrames(p){var a=obj(p)?p.anim:null;return obj(a)?a.frames:null;}
  function pagesHas(pages){if(!Array.isArray(pages))return false;for(var i=0;i<pages.length;i++)if(framesHas(pageFrames(pages[i])))return true;return false;}
  function pagesStrip(pages){var n=0;if(!Array.isArray(pages))return 0;for(var i=0;i<pages.length;i++)n+=framesStrip(pageFrames(pages[i]));return n;}
  function has(it){return obj(it)&&(framesHas(it.frames)||pagesHas(it.pages));}
  function strip(it){return obj(it)?framesStrip(it.frames)+pagesStrip(it.pages):0;}
  /* 작전판: 저장으로 나가는 사본(깊은 사본)만 뗀다 — 원래 함수가 돌려준 것이 사본이라 화면의 페이지는 안 바뀐다 */
  function mountBoard(W){
    var P=W&&W.__psPages;if(!P||P.__psDiet)return false;
    var fs=P.forSave,lv=P.liveVal;
    if(typeof fs==='function')P.forSave=function(){var r=fs.apply(this,arguments);try{pagesStrip(r);}catch(_){}return r;};
    if(typeof lv==='function')P.liveVal=function(){var r=lv.apply(this,arguments);try{if(r)pagesStrip(r.pages);}catch(_){}return r;};
    P.__psDiet=true;return true;
  }
  return {has:has,strip:strip,framesHas:framesHas,framesStrip:framesStrip,pagesHas:pagesHas,pagesStrip:pagesStrip,mountBoard:mountBoard};
});
