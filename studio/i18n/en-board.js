/* PROCESS STUDIO 영어 사전 — 작전판 · 보관함(board.html · analysis.html · board-*.js)
   영어(cs_lang==='en')일 때만 i18n.js 가 받는다. 용어는 studio/i18n/GLOSSARY.md 를 따른다.
   D: 한국어 원문(공백은 한 칸으로) → 영어.  T: 구멍({})이 든 틀 → 영어 틀({} 차례대로, 차례를 바꾸려면 {1} {2}).
   C: CSS 선택자 → {원문: 영어} — 그 자리에서만 다른 말(없으면 {}).
   사용자 내용(선수 · 팀 이름 · 메모)은 넣지 않는다. 재기: node scripts/i18n-coverage.mjs --missing board */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"되살리기":"Restore",
"만들던 작전판 초안을 버렸어요":"Discarded the board draft you were making",
"열려 있는 편집을 닫은 뒤 «되살리기»를 눌러 주세요":"Close the open editor, then press «Restore»",
"지금은 되살릴 수 없어요 — 초안은 그대로 있어요":"Can't restore right now — the draft is still on this device",
"만들던 작전판을 되살렸어요 · «저장하기»를 누르면 보관함에 담겨요":"Restored the board you were making · press «Save» to keep it in the Library"
},{
"보관함에서 만들던 {}이 있어요{} · {}":"An unsaved {} from the Library is on this device{} · {}",
"{} (되살림)":"{} (restored)"
},{});
