/* PROCESS STUDIO 영어 사전 — 팀 운영(scout.html · scouting.html · match-* · player-* · roster-*)
   영어(cs_lang==='en')일 때만 i18n.js 가 받는다. 용어는 studio/i18n/GLOSSARY.md 를 따른다.
   D: 한국어 원문(공백은 한 칸으로) → 영어.  T: 구멍({})이 든 틀 → 영어 틀({} 차례대로, 차례를 바꾸려면 {1} {2}).
   C: CSS 선택자 → {원문: 영어} — 그 자리에서만 다른 말(없으면 {}).
   사용자 내용(선수 · 팀 이름 · 메모)은 넣지 않는다. 재기: node scripts/i18n-coverage.mjs --missing team */
(function(w,D,T,C){D["평가 · 기록"]="Evaluation · records";T["{} 평가 · 기록 보기"]="View {} evaluation and records";
var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{},{},{});
/* 3.281 — 가용인원 기록 창의 까닭 문장(scout.html avSaveReason) */
(function(w,D,T){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
})(window,{
"선수단 자료":"Squad data",
"기록하지 못했습니다. 입력은 남아 있습니다. 다시 시도하거나 창을 닫고 최신 기록을 확인해 주세요.":"The record could not be saved. Your entry is still here. Try again, or close this window and check the latest record."
},{
"선수 {}":"Player {}"
});
/* 3.283 — 가용인원 «학년 나누기» · 선수 추가 시트 · 선수 편집 창의 조 · 학년(roster-audience.js) */
(function(w,D,T,C){D["학년 나누기"]="Split by year group";D["학년 미지정"]="No year group";D["조"]="Group";D["학년"]="Year group";D["없음"]="None";D["미지정"]="Unassigned";D["1학년"]="Year 1";D["2학년"]="Year 2";D["3학년"]="Year 3";
T["{}학년"]="Year {}";T["가능 {} / {}명"]="{} of {} available";T["{}명"]="{} players";
var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{},{},{});
/* 3.287 — 경기 정보 «대회 이름»(구분에 «대회»가 생겨 이름 칸과 가른다 · match-kind.js) */
(function(w,D,T,C){D["대회 이름"]="Competition name";
var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{},{},{});
/* 3.339 — 선수단 명단 표에서 바로 넣기 · 여러 명 빼기 · 조 바꾸기 · 스카우팅에서 불러오기(player-workspace.js) */
(function(w,D,T,C){
D["방금 추가"]="Just added";D["⇣ 스카우팅에서 불러오기"]="⇣ Import from scouting";D["스카우팅에서 불러오기"]="Import from scouting";D["스카우팅에서"]="From scouting";
D["· 체크해서 비교 · 조 바꾸기 · 빼기"]="· tick to compare · change group · remove";D["· 최대 3명 비교"]="· compare up to 3";D["보이는 선수 모두 선택"]="Select all shown players";
D["새 선수 바로 넣기"]="Quick add player";D["새 선수 등번호"]="New player number";D["이름 치고 Enter"]="Type a name, press Enter";D["새 선수 이름"]="New player name";D["새 선수 포지션"]="New player position";D["새 선수 조"]="New player group";
D["비교는 3명까지"]="Compare up to 3";D["조 바꾸기"]="Change group";D["명단에서 빼기"]="Remove from squad";
D["명단이 바뀌었어요. 선수를 다시 골라 주세요"]="The squad changed. Please select the players again";D["조가 바뀌었어요. 다시 골라 주세요"]="The groups changed. Please choose again";
D["삭제 기록을 남기지 못해 명단을 그대로 두었어요 · 자료 확인에서 확인해 주세요"]="The delete record could not be written, so the squad stays as it was · Check it in Data check";
D["삭제 저장 확인이 필요합니다 · 자료 확인에서 확인하세요"]="The delete needs a save check · Check it in Data check";
D["스카우팅은 운영진만 볼 수 있어요"]="Only staff can see scouting";D["스카우팅 자료를 확인하는 중이에요 · 잠시 뒤 다시 열어 주세요"]="Checking scouting data · Please open it again in a moment";
D["포지션 미정"]="Position not set";D["· 이미 명단에 있어요"]="· already on the squad";D["· 같은 이름이 명단에 있어요"]="· same name on the squad";
D["조건에 맞는 후보가 없어요"]="No candidates match";D["스카우팅에 등록한 후보가 없어요"]="No scouting candidates yet";
D["명단에 넣기"]="Add to squad";D["후보 검색"]="Search candidates";D["넣을 조"]="Group to add to";
D["고른 후보를 우리 팀 명단에 새 선수로 넣어요. 이름 · 포지션 · 등번호 · 주발 · 소속팀 · 프로필을 옮기고, 후보와 그 평가 기록은 스카우팅에 그대로 남아요."]="Selected candidates join our squad as new players. Name, position, number, foot, club and profile come across; the candidate and their scouting notes stay in scouting.";
D["팀 또는 편집 권한이 바뀌었어요. 창을 다시 열어 주세요."]="The team or edit permission changed. Please open this again.";
D["고른 후보가 그사이 명단에 들어왔어요. 창을 다시 열어 주세요."]="The selected candidates joined the squad in the meantime. Please open this again.";
T["{}명 명단에 넣기"]="Add {} to squad";T["{} 명단에 넣기"]="Add {} to squad";T["{}명을 명단에 넣었어요"]="Added {} to the squad";
T["{}명을 명단에서 삭제할까요? {} 평가 기록도 함께 지워져요."]="Remove {} from the squad? {} Their evaluations are removed too.";
T["{}명을 명단에서 지웠어요 · 팀 반영은 동기화 상태에서 확인할 수 있어요"]="Removed {} from the squad · Check the team update in sync status";
T["{}명을 지웠어요 · 나머지는 삭제 기록을 남기지 못해 그대로 두었어요"]="Removed {} · The rest stay because their delete record could not be written";
T["{}명 · 조 바꾸기"]="{} · change group";T["{}은 이미 명단에 있어요"]="{} is already on the squad";T["외 {}명"]="and {} more";
T["· {}명은 이미 명단에 있어 건너뜀"]="· {} already on the squad, skipped";
var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{},{},{});
