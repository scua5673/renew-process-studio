/* PROCESS STUDIO — 개인 노트 «내보내기»(3.265).
   코치 질문 «맥북에서 개인 노트(훈련 메모)를 파일로 저장해서 프린트할 수 있나요?» — 이미지 저장 · A4 인쇄는 있었지만 넓은 화면에선
   «노트 선택 ▾» 팝오버 맨 아래(1.909)에만 있어 못 찾았고, 파일로 남기려면 인쇄 창에서 «PDF로 저장»을 따로 골라야 했다.
   목업 A안(사용자 «A안으로»): 위쪽 막대의 제목 오른쪽에 «내보내기 ▾» — 작전판 위쪽 막대(3.115)와 같은 이름.
   · PDF로 저장 — 모든 페이지(양식 · 가져온 PDF · 보관함 훈련 그림 · 손글씨)를 note.html 의 pageCanvas 그대로 JPEG 로 찍어
     PSPdfExport.jpegPagesToPdf(일정 PDF 와 같은 조립)로 A4 파일을 바로 받는다. 노트 한 장은 1000×1414(√2)라 A4 에 꼭 맞는다.
   · 인쇄 · 이미지 저장 — 원래 단추(#printB · #pngB)를 누른다(동작 그대로).
   «노트 선택» 팝오버의 같은 두 항목은 숨긴다(1.909 «중복 없이»). 메모 보기(body.memo-mode)에서는 단추를 숨긴다. 폰(≤767)은 아이콘만.
   저장하는 것 없음 — 읽기만 한다. */
(function(root,factory){
  var P=(root&&root.PSPdfExport)||(typeof require==='function'?require('./pdf-export.js'):null);
  var api=factory(P);if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSNoteExport=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window!=='undefined'?window:null,function(P){
'use strict';
var ITEMS=[['pdf','PDF로 저장','모든 페이지 · 손글씨 포함 · 파일로 바로'],['print','인쇄','A4 · 모든 페이지'],['png','이미지 저장','지금 페이지 한 장 · PNG']];
var CLICK={print:'printB',png:'pngB'};
var Q=0.9;   /* JPEG 품질 — 손글씨 가는 선이 뭉개지지 않게 */
var CSS='.ps-nx{order:99;margin-left:2px}'
  +'.ps-nx-btn{display:inline-flex;align-items:center;gap:6px;font-weight:var(--fw-strong,700)}'
  +'.ps-nx-btn[aria-busy="true"]{opacity:.62;pointer-events:none}'
  +'.ps-nx-menu{min-width:236px}'
  +'.ps-nx-menu .btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;height:auto;min-height:0;line-height:1.25;padding:9px 12px}'
  +'.ps-nx-menu .btn b{font-size:var(--fs-sub,13px);font-weight:var(--fw-strong,700)}'
  +'.ps-nx-menu .btn span{font-size:var(--fs-caption,11px);color:var(--dim)}'
  +'body.memo-mode .ps-nx{display:none!important}'
  +'.tplp-act[data-click="pngB"],.tplp-act[data-click="printB"]{display:none!important}'
  /* 폰 — 제목 줄(mobile-polish 가 제목을 한 줄 전체로) 오른쪽 끝에 아이콘만. 따로 한 줄을 차지하면 메뉴가 화면 왼쪽 밖으로 열렸다 */
  +'@media (max-width:767px){.ps-nx-btn .ps-nx-lb,.ps-nx-btn .ps-nx-caret{display:none}.ps-nx-btn{padding:0 10px}'
  +'html.ps-page-note .bar>.ps-nx:not(#_){order:4!important;margin-left:0}'
  +'html.ps-page-note body.note-dock .bar>#nTitle:not(#_){flex:1 1 calc(100% - 64px)!important;width:auto!important;min-width:0!important}}';   /* 기본 폭을 0 으로 주면 제목이 첫 줄로 끼어 눌린다 */
var ICON='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function fileName(title){var t=String(title||'').trim()||'훈련노트';return ((P&&P.safeName)?P.safeName(t):t.replace(/[\\/:*?"<>|]/g,'_').slice(0,80))+'.pdf';}
function menuHTML(){return ITEMS.map(function(it){return '<button type="button" class="btn" role="menuitem" data-nx="'+it[0]+'"><b>'+esc(it[1])+'</b><span>'+esc(it[2])+'</span></button>';}).join('');}
/* 찍은 JPEG 들 → PDF(Blob). pages = [{data:Uint8Array, w, h}] · land = 노트 방향 */
function pdfFrom(pages,land){if(!P||typeof P.jpegPagesToPdf!=='function')throw Error('pdf');return P.jpegPagesToPdf(pages.map(function(p){return {data:p.data,w:p.w,h:p.h,land:!!land};}),!!land);}
function cur(){try{return (typeof note!=='undefined')?note:null;}catch(_){return null;}}
/* 한 장 → JPEG. JPEG 엔 투명이 없어 흰 종이 위에 얹는다(빈 곳이 검게 나오지 않게) */
function jpegOf(win,canvas){
  return new Promise(function(res,rej){
    var c=win.document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
    var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(canvas,0,0);
    c.toBlob(function(b){if(!b)return rej(Error('jpeg'));b.arrayBuffer().then(function(buf){res({data:new Uint8Array(buf),w:c.width,h:c.height});},rej);},'image/jpeg',Q);
  });
}
async function makePdf(win){
  var n=cur();if(!n||!Array.isArray(n.pages)||!n.pages.length)throw Error('empty');
  if(typeof win.loadBgs==='function')await win.loadBgs();
  var pages=[];
  for(var i=0;i<n.pages.length;i++){pages.push(await jpegOf(win,win.pageCanvas(i)));await new Promise(function(r){setTimeout(r,0);});}   /* 장마다 숨 — 화면이 멈추지 않게 */
  /* 이름은 제목 칸에 보이는 글 — note.title 은 입력 뒤 saveSoon 이 저장할 때에야 바뀐다(치자마자 내보내면 옛 이름) */
  var ti=win.document.getElementById('nTitle'),t=(ti&&ti.value.trim())||n.title;
  return {blob:pdfFrom(pages,n.orient==='l'),name:fileName(t),count:pages.length};
}
function save(win,blob,name){
  var d=win.document,a=d.createElement('a'),u=win.URL.createObjectURL(blob);
  a.href=u;a.download=name;d.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){win.URL.revokeObjectURL(u);},60000);
}
function say(win,t){if(typeof win.toast==='function')win.toast(t);}
function install(win){
  var d=win&&win.document;if(!d||win.__psNoteExport)return false;
  var bar=d.querySelector('.bar');if(!bar||!d.getElementById('nTitle'))return false;
  win.__psNoteExport=true;
  var st=d.createElement('style');st.id='psNoteExportCss';st.textContent=CSS;(d.head||d.documentElement).appendChild(st);
  var w=d.createElement('div');w.className='filewrap ps-nx';w.id='nxWrap';
  w.innerHTML='<button type="button" class="btn ps-nx-btn" id="nxBtn" aria-haspopup="true" aria-expanded="false" aria-label="내보내기" title="내보내기 — PDF로 저장 · 인쇄 · 이미지 저장">'+ICON+'<span class="ps-nx-lb">내보내기</span><span class="ps-nx-caret">▾</span></button>'
    +'<div class="filemenu ps-nx-menu" id="nxMenu" role="menu">'+menuHTML()+'</div>';
  bar.appendChild(w);
  var btn=w.querySelector('#nxBtn'),lb=w.querySelector('.ps-nx-lb'),busy=false;
  function close(){w.classList.remove('open');btn.setAttribute('aria-expanded','false');}
  btn.addEventListener('click',function(e){e.stopPropagation();if(busy)return;var on=!w.classList.contains('open');w.classList.toggle('open',on);btn.setAttribute('aria-expanded',on?'true':'false');});
  d.addEventListener('click',function(e){if(w.classList.contains('open')&&!w.contains(e.target))close();});
  d.addEventListener('keydown',function(e){if(e.key==='Escape'&&w.classList.contains('open'))close();});
  w.querySelector('#nxMenu').addEventListener('click',function(e){
    var it=e.target.closest('[data-nx]');if(!it)return;var k=it.getAttribute('data-nx');close();
    if(CLICK[k]){var t=d.getElementById(CLICK[k]);if(t)t.click();return;}
    if(k!=='pdf'||busy)return;
    busy=true;btn.setAttribute('aria-busy','true');var old=lb.textContent;lb.textContent='PDF 만드는 중…';
    makePdf(win).then(function(r){save(win,r.blob,r.name);say(win,'PDF로 저장했어요 · '+r.count+'쪽');},function(err){say(win,err&&err.message==='empty'?'저장할 페이지가 아직 없어요':'PDF를 만들지 못했어요 — 다시 시도해 주세요');})
      .then(function(){busy=false;btn.removeAttribute('aria-busy');lb.textContent=old;});
  });
  return true;
}
return {ITEMS:ITEMS,fileName:fileName,menuHTML:menuHTML,pdfFrom:pdfFrom,install:install,CSS:CSS};
});
