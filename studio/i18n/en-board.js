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
"만들던 작전판을 되살렸어요 · «저장»을 누르면 보관함에 담겨요":"Restored the board you were making · press «Save» to keep it in the Library"
},{
"보관함에서 만들던 {}이 있어요{} · {}":"An unsaved {} from the Library is on this device{} · {}",
"{} (되살림)":"{} (restored)"
},{});

/* 3.294 — 팀 추가(board-teams.js): 팀 5 ~ 10 · «팀 추가» */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"팀 5":"Team 5",
"팀 6":"Team 6",
"팀 7":"Team 7",
"팀 8":"Team 8",
"팀 9":"Team 9",
"팀 10":"Team 10",
"팀 추가":"Add team"
},{
"팀 {} 추가":"Add Team {}"
},{});

/* 3.297 — 앱을 열면 «불러오기» 창(board-open-chooser.js) */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"빈 보드로 시작":"Start with an empty board",
"운동장만 있어요":"Only the pitch",
"이어서":"Continue",
"작업 보드":"Working board",
"마지막에 보던 판 그대로":"Right where you left off",
"지금은 열 수 없어요 — 보관함에서 열어 주세요":"Can't open it right now — open it from the Library",
"폰에서는 보기로 열어요":"On a phone, boards open in view mode",
"어느 작전판으로 시작할까요?":"Which board would you like to start with?",
"닫기 · 이어서":"Close · Continue",
"새 보드":"New board",
"빈 운동장에서 시작":"Start from an empty pitch",
"보관함 작전판":"Library boards",
"이름으로 찾기":"Search by name",
"작전판 이름으로 찾기":"Search boards by name",
"이 폴더에 작전판이 없어요":"No boards in this folder",
"앱을 열 때 이 창 보기":"Show this when the app opens",
"· 바깥 누르기 = 이어서":"· click outside = Continue",
"앱을 열 때":"When the app opens",
"불러오기 창":"Open dialog",
"앱을 열면 작업 보드 위에 보관함 작전판을 고르는 창이 떠요":"When the app opens, a dialog over the working board lets you pick a Library board",
"바로 보드":"Straight to the board",
"앱을 열면 마지막 작업 보드가 바로 보여요":"When the app opens, the last working board shows right away"
},{
"{}개 · 최근 저장 순":"{} · newest first",
"«{}» 이름의 작전판이 없어요":"No boards named “{}”"
},{});

/* 3.299 — 보관함↔보드 다리: 편집 띠 말 하나 · 빵부스러기 · «편집 중» 칩 · 초안 띠 «돌아가기 · 저장하고 닫기» · 불러오기 «이어서» */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"돌아가기":"Go back",
"저장하고 닫기":"Save and close",
"편집 중":"Editing",
"보관함 ›":"Library ›",
"저장하지 않은 변경 사항을 버리고 닫을까요?":"Discard unsaved changes and close?",
"열려 있는 편집을 닫은 뒤 «돌아가기»를 눌러 주세요":"Close the open editor, then press «Go back»"
},{
"편집 중 · 보관함 › {} · 저장 안 한 변경 · {}":"Editing · Library › {} · unsaved changes · {}",
"«{}»을 다시 열었어요 · 저장 안 한 변경이 그대로 있어요":"Reopened «{}» · your unsaved changes are still here",
"보관함 · 저장 안 한 변경{}":"Library · unsaved changes{}",
"보관함 › {} ›":"Library › {} ›"
},{});
