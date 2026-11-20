/* PROCESS STUDIO 영어 사전 — 일정(process.html · schedule-* · pdf-export.js)
   영어(cs_lang==='en')일 때만 i18n.js 가 받는다. 용어는 studio/i18n/GLOSSARY.md 를 따른다.
   D: 한국어 원문(공백은 한 칸으로) → 영어.  T: 구멍({})이 든 틀 → 영어 틀({} 차례대로, 차례를 바꾸려면 {1} {2}).
   C: CSS 선택자 → {원문: 영어} — 그 자리에서만 다른 말(없으면 {}).
   사용자 내용(선수 · 팀 이름 · 메모)은 넣지 않는다. 재기: node scripts/i18n-coverage.mjs --missing schedule */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"저장 창이 이미 열려 있어요 — 그 창에서 폴더를 고르세요":"The save window is already open — choose a folder there",
"창이 떴으면 그 창에서 폴더를 고르세요. 크롬이 창을 열지 않으면 다운로드 폴더로 받을 수 있어요.":"If the save window opened, choose a folder there. If Chrome doesn't open it, you can save to your Downloads folder instead.",
"이 브라우저에선 바로 저장이 안 돼요 — [인쇄]에서 'PDF로 저장'을 사용하세요":"This browser can't save directly — use Print and choose 'Save as PDF'",
"서버 저장 확인":"Saved to team",
"세션에 강도와 시간을 적으면 여기 부하 막대가 채워져요":"Set a session's intensity and time and the load bars fill in here",
"주간 부하":"Weekly load","빈 세션":"Incomplete sessions","가장 높은 날":"Highest day","RPE나 시간이 빈 세션":"Session missing RPE or time","분 –":"min –","회복":"Recovery",
"RPE × 분 · 경기 기준(MD)":"RPE × min · by match day (MD)","RPE × 분":"RPE × min","계획만":"Planned"
},{"부하 {}":"Load {}","낮음 ~{}":"Low ~{}","보통 {}–{}":"Moderate {}–{}","높음 {}–{}":"High {}–{}","매우 높음 {}+":"Very high {}+"},{});
