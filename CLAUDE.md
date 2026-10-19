# PROCESS STUDIO — 작업 기억

Claude 가 이 저장소에서 일할 때 먼저 읽는 파일이다. 배운 규칙 · 함정을 여기에 쌓는다(한두 줄씩, 판 번호와 함께). 운영 절차의 원본은 `docs/OPERATIONS.md`.

## 사용자와 일하는 법
- 한국어로, 쉬운 말로. 결론을 맨 앞에.
- 바꾼 화면은 **미리보기 스크린샷을 먼저** 보여 준다. push · PR 합치기는 사용자의 **«올려»** 뒤에만.
- 실서버(main → processstudio) 승격은 **«배포해줘»** 뒤에만. 사용자는 빠른 배포를 원한다 — 승인받으면 바로 진행.
- 오류 제보 답변은 초안을 보여 주고 게시한다.

## 오류 제보 처리 기준 (사용자 10/18 «무조건 다 들어줄 수 없다»)
- 다 들어주지 않는다. 네 갈래로 나눈다.
  ① 고장(자료가 사라짐 · 안 열림 · 저장 안 됨) → 바로 고친다. 답: 사과 · 원인 · 고친 판.
  ② 다듬기(있는 기능을 조금 · 화면 한 곳) → 모아서 다음 묶음 판에. 답: «다음 묶음에 넣겠습니다».
  ③ 새 기능 → 바로 만들지 않는다. 다른 팀도 원하거나 방향에 맞을 때만, 한 달에 한 번 골라서. 답: 지금 할 수 있는 방법 + «모아서 살펴보겠습니다». 날짜 · 판은 약속하지 않는다.
  ④ 안 함(방향이 다름 · 비용이 큼) → 정중히 거절 + 대안.
- 새 기능을 고를 때 묻는다: 다른 팀도 쓰나? 단추 · 설정을 늘리지 않고 기본 동작을 바꿔 풀 수 있나? 작전판 용량 · 동기화 · 시험 비용은?
- 같은 뿌리의 요청은 한 번에 푼다 — «모든 장면» · «모든 페이지» · «모든 슬라이드»처럼 «전체에 적용» 단추를 하나씩 더하지 말고 기본을 «판 전체»로.
- 이미 있는 기능을 찾는 제보는 쓰는 방법만 안내한다(3.085 «토큰만 리셋»은 2.975 부터 있었다).
- 답변은 최대한 겸손하게. 고쳐서 답한 제보는 관리자 «오류 제보»에서 «고친 판»을 적고 닫는다 — 열린 제보만 할 일이다.
- 한 세션만 맡는다. 고치기 전에 열린 PR · staging 커밋에서 같은 제보 ID 를 찾는다(10/17 #480 과 #468 이 같은 6건을 따로 고쳤다).

## 배포
- 가지 → PR(`staging`) → CI «Storage safety» → 합치면 testprocess.netlify.app. 승격 PR `staging` → `main` → processstudio.netlify.app.
- Netlify 는 그 커밋의 `release-gate` 가 초록이 될 때까지 최대 12분 기다린다(`scripts/verify-release.mjs`). main 합친 뒤 실서버까지 보통 8~10분.
- 확인: `curl -s https://processstudio.netlify.app/sw.js | grep -o "process-3\.[0-9]*"` (testprocess 도 같이).
- 3.084 — GitHub 가 승격 PR 을 «충돌»로 보이는데 로컬 합치기는 깨끗하면: 공통 조상이 둘(엇갈린 합치기)이다. main 을 staging 에 되합치는 PR(트리 그대로)로 푼다.
- 합쳐진 가지에 새 일을 할 때는 origin/staging 에서 가지를 다시 잡는다(`git checkout -B <가지> origin/staging`).
- 3.104~3.108(10/18) — PR 로 올라가지 못한 가지가 쌓인다. 열린 PR 만 보지 말고 «합쳐진 PR 의 머리에 들지 않은 가지»를 찾는다: `git fetch origin '+refs/pull/*/head:refs/remotes/pr/*'` 뒤 가지 끝마다 `git for-each-ref --contains <끝> refs/remotes/pr/`. 22개 중 7개가 진짜 빠져 있었다(커뮤니티 XSS · 코치 피드백 덮어쓰기 · 재생 중 페이지 섞임 …). 같은 판 번호를 다른 세션이 다른 방법으로 다시 만든 것이 많으니 «같은 동작이 staging 에 있나»를 읽어 가른다. 옮길 땐 판 번호를 새로 매긴다.

## 판 번호 (실행 파일을 바꾸면 늘)
- `sw.js` CACHE `process-3.xxx` · `studio/app.html` 의 `PS_BUILD` 와 `?v=` 일곱 곳 · 사용자 화면이 바뀌면 `studio/release-notes.js` 맨 앞 항목. 안 올리면 `scripts/release-guard.mjs` 가 막는다.
- 새 파일은 `git add` 해야 배포 묶음에 들어간다 — `scripts/package-site.mjs` 는 `git ls-files` 로 고른다(3.085 에 빠질 뻔).

## 작전판(studio/board.html)
- **크기 예산 2,560,000 바이트**(시험이 막는다). 3.113 기준 남은 몫 73 바이트(3.105 · 3.112 · 3.113 에 옛 주석의 실측 숫자를 줄여 자리를 만들었다 — 시험이 잘라 쓰는 주석은 남긴다) — 새 기능은 `studio/board-*.js` UMD 모듈로 만들고 `<script>` 한 줄 + `sw.js` CORE 에 넣는다.
- 본문의 `function` 선언은 window 속성이라 모듈에서 감쌀 수 있다(`renderTokens` · `applyView` · `boardImageXML` · `setView` · `lookApply` …). 내부 호출도 전역 이름으로 찾으므로 감싼 것을 지난다.
- `let`/`const` 전역(`state` · `anim` · `animActive` · `tokShape` · `M` …)은 **window 속성이 아니다** — 모듈에서 `typeof state !== 'undefined' ? state : null` 처럼 이름으로 읽는다(3.086 에 `win.state` 로 읽어 실패).
- 보드 복원(`restoreLiveBoard`)은 본문 스크립트가 도는 중에 바로 돈다. 복원 값을 받아야 하는 모듈은 본문보다 **먼저** 읽히게 두고 window 접근자로 받는다(예: `board-name-font.js` 의 `__nameFont`).
- 보드마다 저장되는 새 설정은 board.html 을 고치지 않는다(3.087): 모듈이 `window.__psLookExt.<키> = {def, ok}` 로 알리고 값은 `window.__<키>`(접근자)로 오간다. `lookKeys` · `_lookCode` · `_lookOk` · `lookNow` · `lookApply` 가 읽는다. 그 모듈은 본문 스크립트보다 먼저 읽혀야 한다(예: `board-name-font.js` 의 nameFont · tagSize). 새 보드 기본값은 `lookDefault` 가 저장된 기본 보드에서 바로 읽는다.
- 보드 설정의 기본값을 바꿀 때: 예전 판이 «안 바꾼 보드»에도 옛 기본값을 적어 두었으면, 그 값을 새 기본으로 읽고 «일부러 고른 같은 값»은 다른 모양으로 적어 가른다(3.089 실제 크기: '1|1' → 새 기본 '1.5|6', 일부러 실제 크기는 '1.0|1.0'). 크기는 2.977 `tokV` 표식과 같은 생각.
- 보드 설정 창 모양은 `studio/board-settings-skin.js`(3.087). 줄(`.menurow`)의 `display` 는 건드리지 않는다 — 탭 · 조건(밝기 · 훈련 격자 · 3D 줄 …)이 `display:none` 으로 숨긴다. 한 번 `display:grid` 를 걸었다가 모든 탭의 줄이 다 보였다.
- 보드 설정 창의 줄 차례는 board.html 의 `PLAN`(id 목록). 줄을 더하면 `tests/board-settings-3010.test.cjs` 와 `tests/browser/board-settings-hierarchy.mjs` 의 목록도 고친다.
- 3.087 — 커뮤니티 뷰어(`body.comm-viewing`): 떠 있는 도크 · 만들기 틀 규칙은 id 를 열 개 넘게 붙여 보드의 감춤을 이긴다 — 뷰어에서 감출 것은 그 파일 안에서 더 센 선택자로. 보기 전용 막이(`communityBoardReadOnly` 의 guard)가 판을 누른 pointerdown · click 을 window 에서 맨 먼저 멈춘다 — 판 바깥 누름을 알아야 하면 pointerup 을 본다. 뷰어 «보기» 고르개는 `board-comm-look.js`(3.087 board.html 남은 몫 약 1.4KB).
- `applyView` 는 판(svg)의 너비 · 높이를 지운다. 중계 카메라가 판을 잡고 있으면 `board-broadcast.js` 의 `hold` 가 지킨다(3.086 깜빡임).
- 3.096 — 3D «중계» 카메라(`cam:'tv'`)를 뺐다(사용자 «중계화면으로 애니메이션하면 라인이 벗어나» → «중계화면은 빼자»): `TILT_CAM.tv` · 보드 설정 «카메라 › 중계» · 위쪽 «중계» 단추를 걷었고, 저장된 tv 는 «보통»으로 읽힌다. `board-broadcast.js` 의 `camera()` · `tv()` 는 남았지만 켜지지 않는다(`__tvOn` 늘 거짓). 경기 모드 옆 막대의 옛 «중계캠»(`bcCamBtn`)은 다른 기능이라 그대로.
- 3.102 — 피치는 판 전체(제보 934aaa3e): 사람이 피치를 바꾸면(`_viewScenesMatch("pitch")` — 피치 단추 · 색 고르개만 부른다) `board-tweaks.js` 가 작전판의 모든 페이지(`__psPages.pg()` · 지금 페이지는 `book.idx()`) · 미팅의 모든 슬라이드(`anim.slides`, 먼저 `__meetSyncCur({thumb:true})`)와 그 장면에 넣는다. 알림의 «이 페이지만»이 되돌린다. 운동장 사진(`@photo:`)은 페이지 내용이라 퍼뜨리지도 덮지도 않는다. 열린 PR #425(«모든 슬라이드에» 단추)는 이 방식이 대신한다.
- 3.112 — 로그인하지 않은 기기의 «저장»은 `board-guest.js` 가 기기 칸 `ps_board_guest_v1`(동기화 키 아님)에 둔다. 게스트 판정은 perms.js `guestOpen` 과 같다(세션 · `ps_cache_owner_v1` · `ps_active_ws` 가 없을 때만). 로그인한 기기는 감싼 저장 함수가 원래 함수를 그대로 부른다. `PSBoardGuest.mount(window)` 는 부팅 `restoreLiveBoard()` 바로 앞 — 그 줄을 옮기지 않는다.
- 3.113 — 보관함 «변경 있음»은 `board-vault-browse.js` 가 항목 전체 지문으로 가른다(`__vaultHydrating` 접근자 · `__vaultEditSig` 를 이 모듈이 갖는다). 페이지 · 장면을 옮기는 새 함수는 `restoreAnimBeforeCapture` 또는 `selectAnimFrame` 를 지나야 둘러보기로 친다(아니면 «변경 있음» — 묻는 쪽으로 틀린다). 저장이 쓰는 칸을 늘리면 지문(`itemSig`)에도 넣는다 — 빠지면 고친 것을 묻지 않고 잃는다. 나가는 새 단추는 `exitCheck` 의 선택자에 더한다.
- 3.102 — 다른 슬라이드 · 페이지 그림(`__snapToThumb` — 하나에 판을 두 번 갈아 끼운다)을 한 번에 그리지 않는다: 9장이면 화면이 몇 초 멈추고 WebKit CI 에서 알림이 10초 안에 안 떴다. 하나씩 나눠 그리고(`queueThumbs`) 재생 · 끌기 · 편집 중엔 기다린다. 6초짜리 알림을 시험이 확인할 땐 MutationObserver 로 붙는 순간을 적는다.
- 내보내기(그림 · GIF · 영상)는 판을 SVG 그림(`data:image/svg+xml`)으로 그린다 — 페이지 글꼴 · CSS 를 못 본다. 글꼴은 SVG 안에 넣어야 한다.

## 폰 강제 종료 · 메모리
- 서버 기록: `ps_events` 의 `boot_after_crash`(meta.stage · age · standalone · ua · crumb). age 5 · stage `loadw0` = 켜진 뒤 몇 초 만에 아이폰이 앱을 끔(메모리).
- 3.095 — 설치 앱이 열 때마다 5초에 꺼졌다: 보관함(`cs_drill_lib_v1`)은 목록 한 덩어리라 한 번 읽을 때마다 통째(그 팀 21MB 글 · 해석 41MB)가 생긴다. 숨은 작전판이 그리기마다 따로 읽어 10초에 24번(크로미움 0.9GB). 그리기 읽기는 `psVaultRenderRead`(같은 때 줄 선 것은 하나 — `_libTurnTail` 이 그대로일 때만), 숨은 틀은 `board-vault-lazy.js`(보일 때 그림). 보관함을 통째로 읽는 코드를 더하면 부팅 중 몇 번 도는지 센다(`tests/browser/phone-boot-vault.mjs`).
- 메모리 재기: fixture `fx.lib` 에 큰 자료를 넣고 폰 크기로 띄워 CDP `HeapProfiler.startSampling`(만든 양) · `collectGarbage` 뒤 `JSHeapUsedSize`(남는 양)를 본다. 그냥 최고치는 크로미움이 쓰레기를 늦게 치워 들쭉날쭉하다.
- sync.js 지문(`libHash`)은 replacer 로 옛 글(`JSON.stringify(libShareCopy(it))`)과 똑같은 글을 만든다(3.095). 글이 한 글자라도 바뀌면 모든 자료가 «바뀜»으로 다시 올라간다 — 고치면 `tests/lib-hash-3095` 로 견준다. sync.js 예산 832KB, 3.108 기준 남은 몫 52 바이트(3.104 · 3.108 에 옛 실측 숫자 주석을 줄여 자리를 만들었다).

## 일정(studio/process.html) PDF
- 3.091 — 일정 PDF 는 `studio/pdf-export.js`(`PSPdfExport.open`) 창으로 연다: «PDF 내려받기»는 미리보기 종이를 SVG foreignObject → JPEG → PDF 로 찍는다(작전판 `_ppbSavePdf` 와 같은 방법). 종이 그림은 페이지 글꼴을 못 보므로 쓰인 글자의 Pretendard 조각을 data: 로 넣는다. 여러 장 문서는 `#printDoc .ponepage` 마다 한 쪽.
- 주간 · 월간 «깔끔하게» 모양은 `studio/schedule-poster.js`(CSS 는 `#printDoc.poster` 에만). «자세히»가 예전 문서. 사용자는 «최대한 담백하게» — 색 면 · 띠 · 그래프를 다시 넣지 않는다.
- 인쇄 문서(`__buildPrintDoc`)는 process.html 의 `<style>` 만 모아 싣는다 — 모듈의 인쇄 CSS 는 `<style>` 로 붙여야 들어간다.
- 3.094 — 선수 문서(scout.html `printStandalone` · `profile-sheet.js` `preview`)도 같은 창(`pdfxOpen`). 장이 문서 몸에 바로 놓인 문서는 `pages:{sel, land(el)}` 로 장마다 따로 찍는다(이력서 세로 + 세부평가 가로 → PDF 쪽도 장마다 방향). 문서 색은 검정 · 회색 · 가는 선(보라 · 남색 띠 · 금색 없음).
- 3.094 — 선수 문서는 장을 꽉 채운다(사용자 «여백이 최소화 되게»): 장 높이를 고정하고 줄이 flex 로 늘되 `max-height`(줄 수는 `:has(>:nth-child(n))` 로 셈 · 카드는 인라인 계산)에서 멈춘다. 같은 줄의 칸끼리는 `grid-template-rows:auto repeat(N,1fr)` 로 행 높이를 맞춘다. 인쇄 문서 CSS 는 `.js` 모듈에 둔다 — `.html` 의 px 글자 크기 · hex 개수는 스타일 래칫(`tests/design-tokens-3044`)이 센다.

## 업데이트(새 판 받기)
- 3.098 — 진행 카드는 `studio/update-progress.js` 하나(사용자 «막 깜박이고 그냥 막 나가지면 불안»): 받기 0~60 · 저장 확인 60~80 · 새 판이 열리며 80~100%. 카드는 늘 화면 아래 가운데 — 단계마다 자리를 옮기지 않는다. 보이는 화면에서 스스로 바꿀 땐 `PSUpdProg.gate` 가 5초 센다(누른 것 · 숨은 탭은 바로). 새 판은 `ps_upd_cont_v1`(sessionStorage) 로 같은 카드를 이어 그린다.
- 앱이 열릴 때 검은 «PROCESS STUDIO» 덮개(app.html, z-index 2147483646)가 맨 위에 깔린다 — 그 위에 보여야 하는 것은 2147483647.

## 함정
- 3.100 — 판 번호가 3.0xx 를 넘는다. 시험 · 코드에서 `3\.0\d\d` 처럼 0 을 박지 말고 `3\.\d{3}` 로(`safe-mode-3036` 이 걸렸다). 판을 숫자로 견줄 땐 `release-notes.js` 의 `versionNo`(3.100 → 3100) 처럼.
- MutationObserver 안에서 없는 class 를 `classList.remove` 해도 속성 바뀜으로 잡혀 끝없이 돈다(3.084 보드가 안 열렸다). `contains` 로 확인한 뒤 바꾼다.
- 비동기로 걷히는 화면(폰 빈 판 안내 «보관함 열기» 등)을 시험이 곧바로 재면 느린 WebKit 에서 남아 있는 것을 잡는다 — `waitForFunction` 으로 걷힐 때까지 기다린 뒤 잰다(3.086 board-savebar).
- 3.097 — 판은 프레임과 상관없이 다시 놓인다(시작 타이머 · `psSelBarLayout` → MutationObserver `fix` → `applyView`). 화면→판 좌표(CTM · 3D 행렬)를 재 두고 쓰려면 **그 이벤트 안에서만**(`Promise.resolve().then` 으로 지운다) — 다음 프레임까지 두면 느린 WebKit 에서 다음 이벤트의 점이 옛 판 자리로 간다(board-pencil 2) 가끔 실패). 시험은 `await Promise.resolve()` 뒤 무대 `padding-bottom` + `applyView()` 로 프레임 없이 판을 옮겨 본다(board-pencil 2b).
- 3.101 — 판에 손대는 시험은 보드가 내 작업판을 다 불러온 뒤에(`__boardReady && __boardRestoreDone && _boardPrivateLoaded && boardPrivateCurrent(_boardPrivateOwner)`). 불러오는 중(주인 확인 전 · 기기 읽기 중 — WebKit 은 첫 IndexedDB 열기가 몇 초 멈춘다)의 변경은 `boardSaveLive` 가 세지 않아 늦게 끝난 불러오기가 판을 저장본으로 바꾼다 — anim-erase-export 화살표가 첫 진짜 마우스 입력(획) 때 사라졌다(차가운 WebKit 27줄 0 !== 1). `__boardRestoreDone` 만으로는 모자란다(주인을 모를 때도 켜진다).
- 2026-10-18 — 빈 보관함을 처음 그리면 예시 다섯이 «읽고 → 쓰기»(libTurn)로 담기고 «프로세스» 폴더가 열린다(`vxSeedRun`). 시험이 `libWrite` 로 자료를 바로 쓰면 그 사이에 끼어 덮인다(save-status-layout WebKit 393px 이 «카드 5장»에서 멈춤). 보관함 자료를 직접 넣는 시험은 사용자를 `ps_vault_px_v1` 로 «예시 이미 받음»으로 둔다(`team-app.mjs` 기본).
- 시험 픽스처 서버(`tests/fixtures/team-app.mjs`)는 브라우저가 끊은 요청에 죽지 않게 본문 읽기를 try 로 감쌌다(3.086 invite-link-export ECONNRESET).
- `pgrep -f "<이름>"` 으로 기다리는 셸 반복은 자기 자신의 명령줄에 걸린다 — 출력 파일을 grep 해서 기다린다.
- 설정 창 단추 규칙이 `!important` 라 단추 글꼴 같은 것은 인라인 `style.setProperty(…, 'important')` 로만 이긴다.
- 고정 폭이 아닌 숫자(«1 / 7» → «2 / 7»)는 폭이 바뀌어 도크 크기 감시 → `applyView` 를 부른다. 바뀌는 숫자에는 `font-variant-numeric:tabular-nums`(font 축약형 **뒤에**).

## 글꼴 · 보안
- 앱 글꼴은 Pretendard 하나(`vendor/fonts.css`). «PROCESS STUDIO» 로고 글자만 Jost. SVG `font-family` 속성 · canvas `font` 도 Pretendard 가 먼저(`tests/font-unify-3085` · `board-name-pos-3086`).
- CSP `font-src 'self' data:` — 글꼴은 자체 호스팅. 이름표 글꼴은 `vendor/name-fonts/<글꼴>/`(SIL OFL, unicode-range 조각).
- 새 localStorage 키는 `studio/storage-keys.js` 에 적는다.
- 3.105 — 커뮤니티 글의 JSON 은 로그인한 누구나 표에 직접 쓸 수 있고, 다른 팀 · 로그아웃 방문자가 같은 사이트 화면에서 읽는다(CSP 는 inline 스크립트를 막지 않는다). 글의 값(좌표 · 수 · 이름 · 주소 · 색)은 `esc` 나 숫자로만 HTML 에 넣는다. 썸네일 SVG 를 innerHTML 로 넣을 땐 `PSSafe.svg`(storage.js — `tests/svg-guard-3105` 가 날것의 자리를 센다). 다른 출처 postMessage 는 storage.js 의 첫 리스너가 막는다 — 새 화면은 storage.js 를 메시지 리스너보다 먼저 읽는다.

## 시험
- 단위: `npm test`(`tests/*.test.cjs`, 3.096 기준 3,837개).
- 브라우저(이 컨테이너): `PS_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright PS_BROWSER_ENGINE=chromium PS_CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/browser/<이름>.mjs`. 묶음 목록은 `tests/browser/run-critical.mjs`.
- 여기서는 WebKit 이 없다(`PS_SIZE=ipad` 는 WebKit 을 띄워 실패). `anim-all-pages` · `anim-export-fit` 은 영상 녹화 때문에 손대지 않은 코드에서도 여기서 실패한다 — CI 가 판단한다.
- CI 는 Chromium · WebKit 둘 다 돈다. 느린 WebKit 에서 «다음 프레임» 을 기다리는 시험은 `waitForFunction` 으로 기다린다(3.084 shaper-ball).
- 미리보기 그림의 한글 글자: `/usr/share/fonts/opentype/unifont/unifont.otf`.

## Supabase
- 프로젝트 `jvtajoeptzfsdwizxejg`. 오류 제보 `ps_support_reports` · 답변 `ps_support_replies`(관리자 답 `author_role='admin'`). 앱 오류 · CSP 보고 `ps_events`.
- 비밀 키는 저장소에 두지 않는다(publishable 키만 `studio/app.html`).
