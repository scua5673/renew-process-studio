/* PROCESS STUDIO — 인쇄 미리보기의 «넣을 훈련» 줄(3.381 · 사용자 11/26 «보관함에서 훈련만들고 페이지별로 원하는 페이지만 골라서 인쇄»
   → 문서 저장소 목업 `UI-보관함-훈련-골라인쇄-목업-2026-11-26.html` A안 «훈련 고르기»).

   훈련이 2개 이상인 보관함 파일(현장 시트)을 PDF · 인쇄로 열면 미리보기 위에 칩 줄이 선다. 칩 하나 = 훈련 탭 하나.
   끈 훈련은 종이에서 빠지고 남은 훈련끼리 «한 장에 N개»로 다시 앉는다(그리기는 board.html vaultPrintSpec · buildFieldSheetDoc —
   opts.pick = 남길 칸 번호 · 번호는 파일 순서 그대로). 인쇄 · PDF 내려받기 · 개인 노트로 셋 다 미리보기 문서를 쓰므로 같은 결과.

   ⚠ 고른 것은 저장하지 않는다 — 창을 열 때마다 전부 켜진 채(board.html printStandaloneB 가 opts.pick=null 로 연다).
   ⚠ 마지막 하나는 끌 수 없다(빈 종이). «모두»는 다시 전부.
   ⚠ 여기엔 상태가 없다 — 목록 · opts 는 board.html 이 쥐고 mount 의 get() 으로 그때그때 읽는다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPrintPick=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var CSS=[
    '#printPrevB .ppb-pick{flex:0 0 auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;row-gap:6px;padding:8px 14px;background:var(--panel);border-bottom:1px solid var(--line)}',
    '#printPrevB .ppb-pick[hidden]{display:none}',
    '#printPrevB .ppb-pl{flex:0 0 auto;font-size:12px;font-weight:600;color:var(--txt-dim);margin-right:2px}',
    '#printPrevB .ppb-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:5px 10px 5px 6px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--txt-dim);font-size:12px;font-weight:600;line-height:1;cursor:pointer;white-space:nowrap}',
    '#printPrevB .ppb-chip b{font-weight:700}',
    '#printPrevB .ppb-nm{max-width:180px;overflow:hidden;text-overflow:ellipsis}',
    '#printPrevB .ppb-mn{font-weight:500}',
    '#printPrevB .ppb-ck{flex:0 0 auto;width:16px;height:16px;border-radius:999px;box-shadow:inset 0 0 0 1.5px var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:transparent}',
    '#printPrevB .ppb-ck::after{content:"\\2713"}',
    '#printPrevB .ppb-chip.on{border-color:var(--blue);color:var(--txt)}',
    '#printPrevB .ppb-chip.on .ppb-ck{background:var(--blue);box-shadow:none;color:#fff}',
    '#printPrevB .ppb-chip[aria-disabled="true"]{cursor:default}',
    '#printPrevB .ppb-cnt{flex:0 0 auto;font-size:12px;font-weight:500;color:var(--txt-dim);margin-left:4px;font-variant-numeric:tabular-nums}',
    '#printPrevB .ppb-all{flex:0 0 auto;border:0;background:none;color:var(--blue);font-size:12px;font-weight:600;padding:6px 4px;cursor:pointer}',
    /* 폰(≤640 — 인쇄 미리보기 막대가 줄바꿈되는 폭): 칩은 번호 · 분만, 줄은 옆으로 민다 */
    '@media (max-width:640px){#printPrevB .ppb-pick{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:8px 10px}#printPrevB .ppb-nm{display:none}}'
  ].join('\n');
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function on(opts,i){var p=opts&&opts.pick;return !Array.isArray(p)||p.indexOf(i)>=0;}
  function html(list,opts){
    if(!Array.isArray(list)||list.length<2)return '';
    var flags=list.map(function(_,i){return on(opts,i);}),n=flags.filter(Boolean).length,min=0;
    list.forEach(function(t,i){if(flags[i])min+=(+(t&&t.min)||0);});
    return '<span class="ppb-pl">넣을 훈련</span>'+list.map(function(t,i){
        var nm=esc(t&&t.name),last=flags[i]&&n<=1,mn=(+(t&&t.min)||0)+'분';
        return '<button type="button" class="ppb-chip'+(flags[i]?' on':'')+'" data-pi="'+i+'" aria-pressed="'+(flags[i]?'true':'false')+'"'
          +(last?' aria-disabled="true" title="하나 이상 골라야 인쇄합니다"':' title="'+nm+'"')
          +'><span class="ppb-ck" aria-hidden="true"></span><b>'+(i+1)+'</b><span class="ppb-nm">'+nm+'</span><span class="ppb-mn">'+mn+'</span></button>';
      }).join('')
      +'<span class="ppb-cnt">'+n+'/'+list.length+' · '+min+'분</span>'
      +(n<list.length?'<button type="button" class="ppb-all" data-pall="1">모두</button>':'');
  }
  /* 누름 하나 → opts.pick 을 고친다. 바뀌었으면 true(그때만 다시 그린다). */
  function tap(list,opts,target){
    if(!Array.isArray(list)||!opts||!target||!target.closest)return false;
    if(target.closest('[data-pall]')){if(opts.pick==null)return false;opts.pick=null;return true;}
    var b=target.closest('[data-pi]');if(!b)return false;
    var i=+b.getAttribute('data-pi'),cur=[];list.forEach(function(_,k){if(on(opts,k))cur.push(k);});
    var at=cur.indexOf(i);
    if(at>=0){if(cur.length<=1)return false;cur.splice(at,1);}else{if(!(i>=0&&i<list.length))return false;cur.push(i);cur.sort(function(x,y){return x-y;});}
    opts.pick=cur.length===list.length?null:cur;return true;
  }
  function paint(box,list,opts){
    if(!box)return;var h=html(list,opts);
    box.hidden=!h;box.innerHTML=h;
  }
  /* get() → {list, opts, refresh} — board.html 의 지금 값 */
  function mount(box,get){
    if(!box||box.__psPick)return;box.__psPick=1;
    var doc=box.ownerDocument;
    if(doc&&!doc.getElementById('ps-print-pick-css')){var st=doc.createElement('style');st.id='ps-print-pick-css';st.textContent=CSS;(doc.head||doc.documentElement).appendChild(st);}
    box.addEventListener('click',function(e){
      var g=get&&get();if(!g)return;
      if(tap(g.list,g.opts,e.target)){paint(box,g.list,g.opts);if(typeof g.refresh==='function')g.refresh();}
    });
  }
  return {CSS:CSS,on:on,html:html,tap:tap,paint:paint,mount:mount};
});
