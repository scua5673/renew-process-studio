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
"이름 · 자리 고치기":"Edit names & spots",
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
"이름 · 자리는 위의 «{}»에서 바꿔요":"Change names and spots with «{}» above"
},{});
