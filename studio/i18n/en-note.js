/* PROCESS STUDIO 영어 사전 — 개인 노트(note.html · note-*.js)
   영어(cs_lang==='en')일 때만 i18n.js 가 받는다. 용어는 studio/i18n/GLOSSARY.md 를 따른다.
   D: 한국어 원문(공백은 한 칸으로) → 영어.  T: 구멍({})이 든 틀 → 영어 틀({} 차례대로, 차례를 바꾸려면 {1} {2}).
   C: CSS 선택자 → {원문: 영어} — 그 자리에서만 다른 말(없으면 {}).
   사용자 내용(선수 · 팀 이름 · 메모)은 넣지 않는다. 재기: node scripts/i18n-coverage.mjs --missing note */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
 "그림 넣기": "Insert picture",
 "PDF · 이미지 파일에서": "From a PDF or image file",
 "보드에서 내보낸 훈련 PDF 도 돼요": "A training PDF exported from the board works too",
 "보관함 훈련에서": "From a Vault session",
 "훈련을 고르면 첫 쪽이 그림으로 들어가요": "Pick a session — its first page goes in as a picture",
 "넣은 그림 고치기": "Edit pictures",
 "옮기기 · 크기 · 지우기": "Move · resize · delete",
 "넣을 칸을 끌어서 정해 주세요 — 그림이 그 칸에 맞춰 들어가요": "Drag to mark the box — the picture is fitted inside it",
 "취소": "Cancel",
 "완료": "Done",
 "그림을 끌어 옮기고, 모서리로 크기를 바꿔요": "Drag a picture to move it; use the corner to resize",
 "이 쪽에 넣은 그림이 없어요": "No pictures on this page",
 "그림을 넣었어요 ✓": "Picture added ✓",
 "문서 보관함 용량이 찼어요 — 그림을 넣지 못했어요": "Document storage is full — the picture wasn't added",
 "그림을 읽을 수 없어요": "Couldn't read that picture",
 "보관함 훈련을 고르면 이 쪽에 그림으로 넣어요": "Pick a Vault session to place it on this page as a picture",
 "그림 지우기": "Delete picture",
 "크기 바꾸기": "Resize"
 },{},{});
