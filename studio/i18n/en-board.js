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

/* 3.300 — 휴대폰 빠른 보드(board-quick-depth.js · board-phone-view.js «＋ 빠른 보드») */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"왼쪽 풀백":"Left back",
"오른쪽 풀백":"Right back",
"왼쪽 센터백":"Left centre-back",
"오른쪽 센터백":"Right centre-back",
"왼쪽 윙백":"Left wing-back",
"오른쪽 윙백":"Right wing-back",
"왼쪽 수비형 미드필더":"Left defensive midfielder",
"오른쪽 수비형 미드필더":"Right defensive midfielder",
"수비형 미드필더":"Defensive midfielder",
"왼쪽 중앙 미드필더":"Left central midfielder",
"오른쪽 중앙 미드필더":"Right central midfielder",
"중앙 미드필더":"Central midfielder",
"공격형 미드필더":"Attacking midfielder",
"왼쪽 미드필더":"Left midfielder",
"오른쪽 미드필더":"Right midfielder",
"왼쪽 윙":"Left winger",
"오른쪽 윙":"Right winger",
"왼쪽 스트라이커":"Left striker",
"오른쪽 스트라이커":"Right striker",
"픽소":"Fixo",
"왼쪽 아라":"Left ala",
"오른쪽 아라":"Right ala",
"피보":"Pivot",
"왼쪽 수비":"Left defence",
"오른쪽 수비":"Right defence",
"수비형 미드":"Defensive mid",
"중앙 미드":"Central mid",
"공격형 미드":"Attacking mid",
"빠른 보드":"Quick board",
"＋ 빠른 보드":"＋ Quick board",
"고치기":"Edit",
"토큰 표시":"Token shows",
"이 자리에 이미 있는 이름이에요":"That name is already in this position",
"포메이션 자리로":"Back to formation",
"포메이션 자리로 돌렸어요":"Positions are back on the formation",
"보드 이름":"Board name",
"선수단 순서로 채우기":"Fill in squad order",
"이름 쓰고 ↵ · 계속 이어서":"Type a name, press ↵ · keep going",
"이름 넣기":"Add names",
"붙여 넣을 명단":"List to paste",
"GK 윤태오, 서지안 CB 오세찬, 장하율, 임준서 골키퍼 윤태오 서지안":"GK Taylor, Brooks CB Ellis, Moore, Grant",
"선수단에서":"From squad",
"붙여넣기":"Paste",
"비우기":"Clear",
"보기 전용":"View only",
"넣기":"Add",
"‹ 이전 자리":"‹ Previous",
"한 줄에 한 자리 · 자리 이름 뒤에 이름을 쉼표로":"One position per line · names after the position, separated by commas",
"메모에 적어 둔 명단을 그대로 붙여 넣어도 돼요. CB처럼 두 자리면 번갈아 들어가요. 적지 않은 자리는 그대로 둬요.":"You can paste a list straight from your notes. Positions with two places, like CB, take names in turn. Positions you leave out stay as they are.",
"고친 내용을 버리고 닫을까요?":"Discard your changes and close?",
"보관함의 보드는 그대로예요":"The board in the Library stays as it was",
"계속 고치기":"Keep editing",
"버리고 닫기":"Discard and close",
"＋ 이름":"＋ Name",
"포메이션 바꾸기":"Change formation",
"넣은 이름은 같은 자리로 따라가요":"Names move to the same positions",
"포메이션을 고르면 자리가 놓여요":"Pick a formation to place the positions",
"쓰던 보드 이어서":"Continue your board",
"처음 채우기":"Start with",
"선수단 확인 중…":"Checking the squad…",
"팀 운영 › 선수단을 읽을 수 없어요":"Can't read Team › Squad",
"빈 자리로 시작":"Start empty",
"이름을 직접 넣어요":"Type the names yourself",
"선수단을 읽지 못해 빈 자리로 시작했어요":"Couldn't read the squad, so the board starts empty",
"아직 비어 있어요":"Still empty",
"주전":"Starter",
"선수단을 다 넣었어요":"The whole squad is on the board",
"이 자리 선수단은 다 넣었어요":"All squad players for this position are on the board",
"이 자리 선수만 보기":"Show this position only",
"다른 자리 선수도 보기":"Show other positions too",
"다음 자리 ›":"Next ›",
"붙여 넣은 내용이 없어요":"Nothing was pasted",
"보기 권한이라 보관함에 담을 수 없어요":"You have view-only access, so you can't save to the Library",
"이름을 하나 이상 넣어 주세요":"Add at least one name",
"빠른 보드를 고쳤어요":"Quick board updated",
"보관함 › 보드에 저장했어요":"Saved to Library › Boards",
"보관함을 쓰려면 먼저 로그인해 주세요":"Log in first to use the Library",
"이 보드를 보관함에서 찾지 못했어요 — 지워졌거나 아직 이 기기에 오지 않았어요":"Couldn't find this board in the Library — it was deleted or hasn't reached this device yet",
"만든 사람만 고칠 수 있어요":"Only the person who made it can edit it",
"저장하지 못했어요 — 이름은 그대로 있어요. 다시 눌러 주세요":"Couldn't save — your names are still here. Tap again",
"쓰던 빠른 보드는 남겨 뒀어요 — «＋ 빠른 보드»에서 이어서":"Your quick board is kept — continue from «＋ Quick board»",
"팀 운영 › 선수단을 읽지 못했어요 — 팀 자료가 준비된 뒤 다시 눌러 주세요":"Couldn't read Team › Squad — tap again once team data is ready",
"선수단 뎁스 순서로 채웠어요":"Filled in squad depth order",
"모든 자리를 비웠어요":"Cleared every position"
},{
"{} 뎁스 · {}":"{} depth · {}",
"보기 전용 · {}":"View only · {}",
"{}/{}자리 · 이름 {}":"{}/{} positions · {} names",
"{} · 이름 {}개":"{} · {} names",
"선수단 {}명 · 포지션별 순서 그대로":"{} squad players · in order by position",
"{}에 없는 자리({})는 뺐어요":"Positions not in {} ({}) were removed",
"{}로 바꿨어요":"Changed to {}",
"{}명 · 위가 주전":"{} players · top is the starter",
"{}번째":"No. {}",
"{} 한 칸 위로":"Move {} up",
"{} 빼기":"Remove {}",
"{}에서 옮기기":"Move from {}",
"한 자리에 {}명까지 넣을 수 있어요":"Up to {} names per position",
"자리를 못 찾았어요: {}":"Position not found: {}",
"· 못 찾은 자리 {}":"· not found: {}",
"이름 {}개를 넣었어요{}":"Added {} names{}",
"{} 자리를 옮겼어요":"Moved {}",
"{} ↔ {} 이름을 맞바꿨어요":"Swapped the names at {} and {}",
"토큰을 누르거나 위의 «{}»에서 바꿔요":"Tap a token, or use «{}» above"
},{});
/* 3.302 — 훈련 편집기: 격자에 붙기가 기본(board-training-edit.js) */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"훈련 격자 칸에 맞춰 놓여요 — ⌘/Ctrl 을 누른 채 끌면 자유롭게 · 끄기는 보드 설정 › 끌기 자석":"Items land on the training grid — hold ⌘/Ctrl while dragging to place freely · turn it off in Board settings › Drag snap",
"훈련 격자 칸에 맞춰 놓여요 — 끄기는 보드 설정 › 끌기 자석":"Items land on the training grid — turn it off in Board settings › Drag snap",
"훈련 편집기는 격자 칸에 붙는 것이 기본이에요 · ⌘/Ctrl 을 누르면 잠깐 풀려요":"In the training editor items snap to the grid by default · hold ⌘/Ctrl to place freely once",
"훈련 편집기는 격자 칸에 붙는 것이 기본이에요":"In the training editor items snap to the grid by default",
"훈련 편집기 자석 켬 — 놓거나 끌면 격자 칸에 붙어요":"Training editor snap on — dropped or dragged items land on the grid",
"훈련 편집기 자석 끔 — ⌘/Ctrl 로는 언제든 붙어요":"Training editor snap off — ⌘/Ctrl still snaps any time",
"훈련 편집기 자석 끔 — 자유롭게 놓여요":"Training editor snap off — items go where you put them",
"방향 표식 — 한 번 더 누르면 시야 부채꼴 · 노란 손잡이로 돌려요":"Direction mark — press again for the vision cone · turn it with the yellow handle",
"누를 때마다 방향 표식 → 시야 부채꼴 → 끔":"Each press: direction mark → vision cone → off",
"도구 · 단추를 모두 접어 운동장만 보이게 — 다시 펴기: 아래 가운데 손잡이 · Esc":"Fold away every tool and button so only the pitch shows — bring them back with the small handle at the bottom centre or Esc"
},{},{});
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"선 스타일 열기·닫기":"Open · close line style",
"선 모양 — 점선 ↔ 실선":"Line shape — dashed ↔ solid",
"패스 — 로빙 ↔ 땅볼":"Pass — lob ↔ ground",
"선수 놓기 열기·닫기":"Open · close player palette",
"저장 팀 불러오기":"Load saved team",
"이 장면의 그림 모두 지우기":"Clear every drawing in this scene",
"이 장면의 그림을 모두 지웠어요 — 되돌리기는 ⌘Z":"Cleared every drawing in this scene — undo with ⌘Z",
"점선으로 그려요 · 고른 그림도 점선":"New lines are dashed · selected drawings too",
"점선으로 그려요":"New lines are dashed",
"실선으로 그려요 · 고른 그림도 실선":"New lines are solid · selected drawings too",
"실선으로 그려요":"New lines are solid",
"로빙 패스로 그려요 · 고른 패스도 로빙":"New passes are lobbed · selected passes too",
"로빙 패스로 그려요":"New passes are lobbed",
"땅볼 패스로 그려요 · 고른 패스도 땅볼":"New passes are on the ground · selected passes too",
"땅볼 패스로 그려요":"New passes are on the ground",
"그림 모두 지우기":"Clear all drawings",
"이 장면의 선 · 화살표 · 구역 · 글을 모두 지웁니다 · 선수는 그대로":"Clears every line · arrow · zone · text in this scene · players stay",
"없음":"None"
},{},{});
/* 3.312 — 명단 불러오기 창(board-scout-import.js): 조건 칩 · 훈련 인원 카드의 빠른 칩 */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"A팀":"Team A",
"B팀":"Team B",
"C팀":"Team C",
"팀의 선수단과 권한을 확인 중입니다.":"Checking the team roster and your permissions.",
"명단 자료를 다시 불러와 주세요.":"Please reload the roster data.",
"명단이 바뀌었습니다. 창을 닫고 다시 열어 주세요.":"The roster changed. Close this window and open it again.",
"명단 불러오기":"Import roster",
"선수단 명단 불러오기":"Import the team roster",
"스카우팅 명단 불러오기":"Import the scouting list",
"등록된 모든 선수를 팀 1 에 올리고 인원을 채웁니다 — 부상 · 재활 · 불참을 뺄지는 «고르기…»의 상태 조건을 따라요":"Puts every registered player on Team 1 and fills the headcount — whether injured, rehab and absent players are left out follows the status condition in «Choose…»",
"스카우팅 후보를 모두 팀 1 에 올립니다":"Puts every scouting candidate on Team 1",
"고르기…":"Choose…",
"출처 · 조 · 상태 · 포지션 · 학년을 골라 불러옵니다":"Pick source, group, status, position and year, then import",
"스카우팅 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 눌러 주세요.":"Couldn't check the scouting list. Try again once the team data is ready.",
"선수단 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 눌러 주세요.":"Couldn't check the team roster. Try again once the team data is ready.",
"스카우팅에 등록된 후보가 없어요":"No candidates registered in scouting",
"선수단에 선수가 없어요 — 팀 탭에서 선수를 추가하세요":"The roster is empty — add players in the Team tab",
"훈련 가능한 선수가 없어요 — «고르기…»에서 상태를 «전부»로 두면 모두 올라와요":"No players available for training — set status to «All» in «Choose…» to bring everyone",
"팀 · 권한 또는 명단이 바뀌어 불러오지 않았어요. 다시 눌러 주세요.":"The team, permissions or roster changed, so nothing was imported. Please try again.",
"명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 열어 주세요.":"Couldn't check the roster. Open it again once the team data is ready.",
"배치할 팀":"Place on team",
"명단 불러오기 닫기":"Close roster import",
"이름·소속팀·등번호 검색":"Search name, club or number",
"명단 검색":"Search roster",
"모두":"All",
"작업 보드 · 상태는 오늘 가용인원 기준":"Work board · status follows today's availability",
"체크한 명단으로 훈련 인원을 채웁니다 — 조건 안에서 체크하지 않은 선수는 재활 · 부상·불참으로 셉니다. 보드의 선택한 팀 자리에 이름 · 등번호를 입히고, 자리가 부족하면 대기 줄에 둡니다.":"Fills the training headcount with the checked players — unchecked players within the conditions count as rehab or injured/absent. Names and numbers go onto the chosen team's existing spots on the board; extra players wait on the bench line.",
"선택한 팀의 기존 자리에 이름 · 등번호를 입힙니다. 자리가 부족하면 대기 줄에 두고, 기존 선수 불러오기처럼 다른 장면 · 페이지에도 반영됩니다.":"Names and numbers go onto the chosen team's existing spots. Extra players wait on the bench line, and other scenes and pages follow as with the existing player import.",
"출처":"Source",
"그날 가용인원 기준":"by that day's availability",
"둘 다":"Both",
"가능만 — 부상 · 재활 · 불참 제외":"Available only — no injured, rehab or absent",
"전부":"All",
"이름 미등록":"No name",
"후보":"Candidate",
"조건에 맞는 선수가 없어요.":"No players match the conditions.",
"등록된 선수가 없어요.":"No players registered.",
"팀·권한 또는 명단이 바뀌어 불러오기 창을 닫았어요. 다시 열어 주세요.":"The team, permissions or roster changed, so the import window was closed. Please open it again.",
"지금은 이 보드를 편집할 수 없어요.":"This board can't be edited right now.",
"명단을 다시 열어 주세요.":"Please open the roster again."
},{
"{}월 {}일":"{}/{}",
"{} 선수를 팀 1 에 올리고 인원을 채웁니다":"Puts the {} players on Team 1 and fills the headcount",
"{}에 등록된 선수가 없습니다":"No players registered in {}",
"{} 선수가 없어요 — 팀 탭에서 조를 지정하세요":"No {} players — assign groups in the Team tab",
"{} 훈련 · 상태는 그날 가용인원 기준":"{} training · status follows that day's availability",
"· 조건 밖 {}명은 체크 해제됨":"· {} outside the conditions unchecked",
"{}명 선택 / 전체 {}명{}":"{} selected / {} total{}",
"{}명 불러오기":"Import {}",
"{} 선택":"Select {}",
"· 대기 {}명":"· {} on the bench",
"· 제외 {}명":"· {} left out",
"{} · {}명 불러옴{}{}":"{} · {} imported{}{}"
},{});

/* 3.317 — 보관함↔보드 다리: 편집 띠 말 하나 · 빵부스러기 · «편집 중» 칩 · 초안 띠 «돌아가기 · 저장하고 닫기» · 불러오기 «이어서» */
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

/* 3.326 — 잔디 무늬(board-mow.js): 보드 설정 › 운동장 › 바탕의 여덟 칸 · 평면과 3D 가 같이 쓴다 */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"잔디 무늬":"Grass pattern",
"띠":"Stripes",
"넓은 띠":"Wide stripes",
"바둑판":"Checkerboard",
"사선":"Diagonal",
"다이아":"Diamond",
"5레인":"5 lanes",
"줄 없이 한 색":"One colour, no stripes",
"골라인과 나란한 띠(약 4m)":"Stripes parallel to the goal line (about 4 m)",
"굵은 띠(약 9.5m)":"Wide stripes (about 9.5 m)",
"띠 위로 한 번 더 가로질러 깎은 칸":"Squares cut across the stripes a second time",
"비스듬한 띠":"Slanted stripes",
"사선을 엇갈려 깎은 마름모":"Diamonds from two crossed diagonal cuts",
"센터 서클에서 퍼지는 동심원":"Rings spreading out from the centre circle",
"터치라인과 나란한 다섯 길(측면 · 하프스페이스 · 중앙)":"Five lanes parallel to the touchline (wide · half-space · centre)"
},{
"잔디 무늬 {}":"Grass pattern {}"
},{});

/* 3.327 — 폰보드(board-phone-board.js · board-phone-nav.js): 폰 아래 메뉴 탭 · 목록 · 새 폰보드 · 편집 도구 · 저장 알림 */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"폰보드":"Phone",
"폰보드 이름":"Phone board name",
"세로 운동장":"Portrait pitch",
"＋ 작전판":"＋ Tactics board",
"＋ 뎁스 차트":"＋ Depth chart",
"새 작전판":"New tactics board",
"우리 팀 포메이션":"Our formation",
"상대 포메이션":"Opponent formation",
"저장하지 않은 판이 있어요":"This board is not saved",
"버리기":"Discard",
"계속 만들기":"Keep editing",
"폰보드는 세로로만 써요. 폰을 세로로 돌려 주세요.":"Phone board works in portrait only. Turn your phone upright.",
"보관함을 읽지 못했어요. 로그인되어 있는지 확인해 주세요.":"Could not read the library. Check that you are signed in.",
"다시 불러오기":"Reload",
"아직 없어요. 위에서 작전판이나 뎁스 차트를 골라 첫 판을 만들어 보세요.":"Nothing yet. Pick a tactics board or a depth chart above to make your first one.",
"빈 판":"Empty board",
"옮기기":"Move",
"놓기":"Place",
"화살":"Arrow",
"이동":"Run",
"끌어서 옮기고, 선수를 한 번 누르면 번호 · 이름을 고쳐요.":"Drag to move. Tap a player once to edit the number and name.",
"지울 것을 눌러요. 잘못 지웠으면 위의 되돌리기.":"Tap what you want to erase. Use Undo above if you erase by mistake.",
"판에 선수나 콘을 하나 이상 놓아 주세요":"Place at least one player or cone on the board",
"폰보드를 고쳤어요":"Phone board updated",
"보관함에 저장했어요 · 폰보드":"Saved to the library · Phone board",
"이 판을 보관함에서 찾지 못했어요. 지워졌거나 아이패드 · 컴퓨터에서 바뀌었어요":"This board was not found in the library. It was deleted or changed on an iPad or computer",
"저장하지 못했어요. 판은 그대로 있어요. 다시 눌러 주세요":"Could not save. Your board is still here. Tap again",
"이 판은 아이패드 · 컴퓨터에서 열어 주세요":"Open this board on an iPad or computer",
"만든 사람만 고칠 수 있어요. 보기로 열었어요":"Only the person who made it can edit. Opened for viewing",
"아이패드 · 컴퓨터에서 손본 판이라 폰에서는 보기만 돼요":"This board was edited on an iPad or computer, so it is view-only on the phone",
"«버리기»를 누르면 이 판은 사라져요.":"If you tap «Discard», this board is gone.",
"뎁스 차트":"Depth chart",
"뎁스 차트를 열지 못했어요. 잠시 뒤 다시 눌러 주세요":"Could not open the depth chart. Try again in a moment",
"쓰던 뎁스 차트는 남겨 뒀어요 — «＋ 뎁스 차트»에서 이어서":"Your depth chart draft is kept — continue from «＋ Depth chart»"
},{
"내 폰보드 {}개":"My phone boards · {}",
"콘은 {}개까지 놓을 수 있어요":"You can place up to {} cones",
"선수는 {}명까지 놓을 수 있어요":"You can place up to {} players",
"화살은 {}개까지 그릴 수 있어요":"You can draw up to {} arrows"
},{});

/* 3.332 — 잔디결 간격(board-mow.js): «잔디 무늬»의 «띠»를 고르면 나오는 간격 칸(3 · 4 · 5 · 6 · 8 · 10m)과 아래 한 줄 */
(function(w,D,T,C){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),R=w.PS_I18N_RULES_EXTRA||(w.PS_I18N_RULES_EXTRA=[]),k;
for(k in D)(E[k]||(E[k]={})).en=D[k];
for(k in T)(function(k,n){R.push([new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\}/g,'(.{1,80}?)')+'$'),{en:T[k].replace(/\{\}/g,function(){return '$'+(++n);}).replace(/\{(\d)\}/g,'$$$1')}]);})(k,0);
for(k in C)(function(m,o,j){for(j in C[k])o[j]={en:C[k][j]};(w.PS_I18N_CTX_EXTRA||(w.PS_I18N_CTX_EXTRA=[])).push([k,o]);})(C[k],{});
})(window,{
"결 간격":"Stripe width",
"골라인과 나란한 띠 · 간격은 아래에서":"Stripes parallel to the goal line · set the width below"
},{
"{}m 간격":"{} m apart",
"결 간격 · 판 가운데에서 {}m씩":"Stripe width · every {} m from the centre",
"결 간격 · 하프라인에서 {}m씩 · 한쪽 {}결 + 골라인 앞 {}m":"Stripe width · every {} m from the halfway line · {} stripes each half + {} m before the goal line",
"결 간격 · 하프라인에서 {}m씩 · 한쪽 {}결 · 골라인에 딱 맞음":"Stripe width · every {} m from the halfway line · {} stripes each half · ends on the goal line"
},{});

/* 3.340 — 운동장 여럿 새 배치(board.html __setPitchN): 같은 개수를 다시 눌러 옛 판을 새 배치로 바꿀 때의 알림 */
(function(w,D){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),k;for(k in D)(E[k]||(E[k]={})).en=D[k];})(window,{
"운동장을 새 배치로 바꿨어요 · 선수는 그 자리 그대로 · 되돌리기로 이전 배치":"Pitches now use the new layout · players stay where they are · undo for the previous layout"
});

/* 3.347 — 보드 설정 «움직임» 탭(board-motion-marks.js installTab): 공 · 팀마다 잔상 길이 · 공 보기 */
(function(w,D,T){var E=w.PS_I18N_EXTRA||(w.PS_I18N_EXTRA={}),k;for(k in D)(E[k]||(E[k]={})).en=D[k];if(T&&w.PS_I18N_TEMPLATES)for(k in T)w.PS_I18N_TEMPLATES[k]=T[k];})(window,{
"움직임":"Motion",
"재생할 때의 잔상 · 시선을 묶음마다 한 번에":"Trails and gaze for playback, one group at a time",
"잔상 · 지난 장면 수":"Trail · scenes kept",
"공 보기":"Watch ball",
"선수나 공을 놓으면 여기서 잔상 · 시선을 켤 수 있어요":"Place players or the ball to set trails and gaze here",
"토큰 하나만 다르게는 «잔상» «시선» 단추":"For a single token, use its «Trail» «Gaze» buttons",
"누르면 이 보드의 토큰에 바로 들어가요":"Applies to this board's tokens right away"
},{
"잔상 {}단계 · {}":"Trail {} · {}",
"잔상 끔 · {}":"Trail off · {}",
"공 보기 · {} · 공이 움직여도 따라 봐요":"Watch ball · {} · follows the ball as it moves",
"시선 끔 · {}":"Gaze off · {}"
});
