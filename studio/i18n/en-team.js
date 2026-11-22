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
/* 시즌별 선수단(roster-season.js · player-workspace.js) */
(function(w,D,T,C){
D["졸업"]="Graduated";D["현재 명단으로"]="Back to current squad";D["졸업 처리"]="Mark graduated";D["졸업생 명단"]="Graduates";D["지난 시즌 명단 · 보기 전용"]="Past season squad · view only";D["지금 시즌으로"]="Back to this season";D["· 지금"]="· now";D["시즌 고르기"]="Choose season";D["명단에서 뺀 선수예요"]="This player was removed from the squad";D["그날의 번호 · 조 · 학년 그대로 · 이름을 누르면 프로필"]="Number, group and year as they were · tap a name for the profile";D["이어짐"]="Continued";D["명단에서 뺌"]="Removed";D["다음 시즌"]="Next season";D["이 시즌에 적힌 선수가 없어요"]="No players recorded for this season";D["· 저장 확인이 필요해요"]="· please check that it saved";D["현재 명단으로 돌렸지만 저장 확인이 필요해요"]="Moved back to the current squad, but please check that it saved";D["그대로 둬요"]="Stays as is";D["기록과 함께 졸업생으로 남아요"]="Kept as graduates with their records";D["한 학년 위로"]="Up one year";D["그대로"]="As is";D["→ 졸업"]="→ Graduated";D["학년을 적은 선수가 아직 없어요. 선수 프로필에 학년을 적으면 졸업과 진급을 한 번에 넘겨요."]="No players have a school year yet. Add it in the player profile to graduate and promote in one step.";D["명단이 그사이 바뀌었어요. 창을 다시 열어 주세요."]="The squad changed in the meantime. Please reopen this window.";D["졸업생 전체"]="All graduates";D["＋ 선수 ▾"]="＋ Player ▾";D["명단 출력"]="Print squad";D["배치 · 명단 편집"]="Edit placement · squad";D["배치 · 명단 편집 닫기"]="Close placement · squad editing";D["조 이름 바꾸기"]="Rename groups";D["조 추가"]="Add group";D["편집 권한"]="Edit permission";D["새 시즌 시작…"]="Start new season…";D["시즌 미리 만들기"]="Plan a season";D["바로 넣기"]="Add inline";D["여러 명 붙여 넣기"]="Paste several";D["프로필까지 적어 추가"]="Add with full profile";D["선수 넣는 방법"]="How to add players";D["선수 넣기"]="Add players";D["시즌 옮기기"]="Move season";D["미리 만든 시즌 · 예상 명단"]="Planned season · projected squad";D["· 지난"]="· past";D["· 미리"]="· planned";D["예상"]="projected";D["담아 둔"]="saved";D["선수단은 넘겼어요 · 스카우팅 목록은 스카우팅에서 «시즌 옮기기»로 넘겨 주세요"]="The squad moved on · move the scouting list with «Move season» in Scouting";D["시즌을 만들었지만 저장 확인이 필요해요"]="Season created, but please check that it saved";D["스카우팅을 보는 임원이 지울 수 있어요"]="An executive who can see scouting can delete this";D["시즌을 지웠지만 저장 확인이 필요해요"]="Season deleted, but please check that it saved";D["지금 명단으로 셈한 예상이에요"]="Projected from the current squad";D["이 시즌 지우기"]="Delete this season";D["예상 학년"]="Projected year";D["팀 · 예상 학년"]="Group · projected year";D["이 시즌까지 이어지는 선수가 아직 없어요"]="No current players continue into this season yet";D["지난 시즌 스카우팅"]="Past season scouting";D["미리 만든 시즌"]="Planned season";D["체크해서 «시즌 옮기기»"]="Tick, then «Move season»";D["명단에 넣음"]="Joined the squad";D["다른 시즌 목록에서 후보를 체크하고 «시즌 옮기기»로 담아요."]="Tick candidates in another season and use «Move season» to put them here.";D["옮길 시즌이 아직 없어요 · 시즌 칩에서 «시즌 미리 만들기»를 눌러 주세요"]="No other season yet · use «Plan a season» in the season chip";D["옮길 시즌"]="Move to season";D["새 시즌 명단에 1학년으로 넣어요"]="Added to the new season squad as year 1";D["새 시즌 명단에 넣어요"]="Added to the new season squad";D["· 영입대상"]="· target";D["＋ 신입"]="＋ New";D["스카우팅 후보"]="Scouting candidates";
T["{} 졸업"]="Graduated {}";T["↗ {} 시즌 시작…"]="↗ Start {} season…";T["{}명을 졸업 처리할까요? {} 프로필 · 평가 · 기록은 그대로 남아요. 가용인원 · 작전판 불러오기는 현재 선수만 보여요."]="Mark {} players as graduated? {} Profiles, evaluations and records stay. Availability and board import show current players only.";T["졸업 처리 · 시즌 칩의 «졸업생 전체»에서 봐요{}"]="marked graduated · see «All graduates» in the season chip{}";T["{}명을 현재 명단으로 돌렸어요"]="Moved {} back to the current squad";T["{}명은 {}학년 그대로"]="{} stay in year {}";T["{}학년 선수"]="Year {} players";T["{}학년 넘기기"]="Move year {} on";T["{}학년 {}명"]="Year {} · {} players";T["학년 없음 {}명은 그대로 둬요."]="{} players without a school year stay as they are.";T["{} 시즌 시작"]="Start {} season";T["{} 시즌 {}명에서 이어 가요. 이름을 눌러 끄면 그 선수는 지금 학년에 남아요."]="Continuing from {} season, {} players. Tap a name to keep that player in the same year.";T["{} 시즌 {}명"]="{} season · {} players";T["· 졸업 {}명 · {} 시즌 명단은 그대로 남아요"]="· {} graduating · the {} season squad is kept";T["{} 시즌"]="{} season";T["시작 · 졸업 {}명 · 진급 {}명{}"]="started · {} graduated · {} moved up{}";T["{} 시즌 명단으로 돌렸어요"]="Back to the {} season squad";T["＋ {} 시즌 미리 만들기"]="＋ Plan {} season";T["담아 둔 {}명으로 시작해요."]="starts with the {} saved candidates.";T["스카우팅 후보 {}명은 {} 시즌 목록으로 넘어가요. {} 시즌 스카우팅은 {}"]="{} scouting candidates move to the {} season list. {} season scouting {}";T["· 졸업 {}명{} · {} 시즌 명단은 그대로 남아요"]="· {} graduating{} · the {} season squad is kept";T["· 스카우팅 {}명은 {} 시즌 목록으로"]="· {} scouting candidates to the {} season list";T["미리 만든 시즌은 {}개까지예요"]="Up to {} planned seasons";T["{} 시즌을 만들었어요"]="{} season created";T["이 시즌에 담아 둔 스카우팅 후보 {}명을 먼저 옮겨 주세요"]="Move the {} scouting candidates saved in this season first";T["{} 시즌을 지웠어요"]="{} season deleted";T["/ 예상 {}명"]="/ {} projected";T["포지션 미지정 {}"]="No position {}";T["그 전에 졸업 {}명"]="{} graduate before then";T["이 시즌 스카우팅 후보 {}명"]="{} scouting candidates for this season";T["{}명을 {} 후보로 옮겼어요"]="Moved {} to {} candidates";T["{}명 · 시즌 옮기기"]="{} · move season";T["스카우팅에서 {}명"]="{} from scouting";T["{} · 후보와 평가는 스카우팅에 그대로"]="{} · candidates and evaluations stay in scouting";T["· 신입 {}명"]="· {} new";
/* 3.354 — 목록에서 바로(조별 묶음 · 조/학년 칸 · 줄 더 보기) · 학년 «신입생» */
D["신입생"]="New intake";D["조 · 학년"]="Group · Year";D["프로필 수정"]="Edit profile";D["학년 바꾸기"]="Change year";D["조 없음"]=D["조 없음"]||"No group";D["1학년이 돼요"]="Moves to Year 1";D["학년 미지정"]=D["학년 미지정"]||"Year not set";D["학년을 바꿨지만 저장 확인이 필요해요"]="Year changed, but the save needs checking";
/* 3.359 — 학교급(초 · 중 · 고 · 대 · 성인팀) */
D["학교급"]="School level";T["학교급 · {}"]="School level · {}";D["학교급 고르기"]="Choose school level";D["학교급 →"]="School level →";D["정하지 않음"]="Not set";D["정하지 않음 · 3학년까지"]="Not set · up to Year 3";T["{}학년까지"]="up to Year {}";D["학년 없음"]=D["학년 없음"]||"No years";D["초등학교"]="Primary school";D["중학교"]="Middle school";D["고등학교"]="High school";D["대학교"]="University";D["성인팀"]="Senior team";T["{}학년이 졸업 학년입니다"]="Year {} is the graduating year";D["학년 없이 씁니다"]="Runs without years";D["이름을 눌러 끄면 그 선수는 지금 학년에 남아요."]="Tap a name to switch it off and that player stays in the current year.";D["성인팀은 명단 그대로 새 시즌으로 넘어갑니다."]="A senior team moves to the new season with the roster as it is.";T["{} 시즌 {}명에서 이어 가요. {}"]="Continuing from {} season with {} players. {}";
var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{},{},{});
