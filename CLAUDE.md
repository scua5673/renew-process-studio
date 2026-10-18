# PROCESS STUDIO — 작업 기억

Claude 가 이 저장소에서 일할 때 먼저 읽는 파일이다. 배운 규칙 · 함정을 여기에 쌓는다(한두 줄씩, 판 번호와 함께). 운영 절차의 원본은 `docs/OPERATIONS.md`.

## 사용자와 일하는 법
- 한국어로, 쉬운 말로. 결론을 맨 앞에.
- 바꾼 화면은 **미리보기 스크린샷을 먼저** 보여 준다. push · PR 합치기는 사용자의 **«올려»** 뒤에만.
- 실서버(main → processstudio) 승격은 **«배포해줘»** 뒤에만. 사용자는 빠른 배포를 원한다 — 승인받으면 바로 진행.
- 오류 제보 답변은 초안을 보여 주고 게시한다.

## 배포
- 가지 → PR(`staging`) → CI «Storage safety» → 합치면 testprocess.netlify.app. 승격 PR `staging` → `main` → processstudio.netlify.app.
- Netlify 는 그 커밋의 `release-gate` 가 초록이 될 때까지 최대 12분 기다린다(`scripts/verify-release.mjs`). main 합친 뒤 실서버까지 보통 8~10분.
- 확인: `curl -s https://processstudio.netlify.app/sw.js | grep -o "process-3\.[0-9]*"` (testprocess 도 같이).
- 3.084 — GitHub 가 승격 PR 을 «충돌»로 보이는데 로컬 합치기는 깨끗하면: 공통 조상이 둘(엇갈린 합치기)이다. main 을 staging 에 되합치는 PR(트리 그대로)로 푼다.
- 합쳐진 가지에 새 일을 할 때는 origin/staging 에서 가지를 다시 잡는다(`git checkout -B <가지> origin/staging`).

## 판 번호 (실행 파일을 바꾸면 늘)
- `sw.js` CACHE `process-3.xxx` · `studio/app.html` 의 `PS_BUILD` 와 `?v=` 일곱 곳 · 사용자 화면이 바뀌면 `studio/release-notes.js` 맨 앞 항목. 안 올리면 `scripts/release-guard.mjs` 가 막는다.
- 새 파일은 `git add` 해야 배포 묶음에 들어간다 — `scripts/package-site.mjs` 는 `git ls-files` 로 고른다(3.085 에 빠질 뻔).

## 작전판(studio/board.html)
- **크기 예산 2,560,000 바이트**(시험이 막는다). 3.089 기준 남은 몫 1,134 바이트 — 새 기능은 `studio/board-*.js` UMD 모듈로 만들고 `<script>` 한 줄 + `sw.js` CORE 에 넣는다.
- 본문의 `function` 선언은 window 속성이라 모듈에서 감쌀 수 있다(`renderTokens` · `applyView` · `boardImageXML` · `setView` · `lookApply` …). 내부 호출도 전역 이름으로 찾으므로 감싼 것을 지난다.
- `let`/`const` 전역(`state` · `anim` · `animActive` · `tokShape` · `M` …)은 **window 속성이 아니다** — 모듈에서 `typeof state !== 'undefined' ? state : null` 처럼 이름으로 읽는다(3.086 에 `win.state` 로 읽어 실패).
- 보드 복원(`restoreLiveBoard`)은 본문 스크립트가 도는 중에 바로 돈다. 복원 값을 받아야 하는 모듈은 본문보다 **먼저** 읽히게 두고 window 접근자로 받는다(예: `board-name-font.js` 의 `__nameFont`).
- 보드마다 저장되는 새 설정은 board.html 을 고치지 않는다(3.087): 모듈이 `window.__psLookExt.<키> = {def, ok}` 로 알리고 값은 `window.__<키>`(접근자)로 오간다. `lookKeys` · `_lookCode` · `_lookOk` · `lookNow` · `lookApply` 가 읽는다. 그 모듈은 본문 스크립트보다 먼저 읽혀야 한다(예: `board-name-font.js` 의 nameFont · tagSize). 새 보드 기본값은 `lookDefault` 가 저장된 기본 보드에서 바로 읽는다.
- 보드 설정의 기본값을 바꿀 때: 예전 판이 «안 바꾼 보드»에도 옛 기본값을 적어 두었으면, 그 값을 새 기본으로 읽고 «일부러 고른 같은 값»은 다른 모양으로 적어 가른다(3.089 실제 크기: '1|1' → 새 기본 '1.5|6', 일부러 실제 크기는 '1.0|1.0'). 크기는 2.977 `tokV` 표식과 같은 생각.
- 보드 설정 창 모양은 `studio/board-settings-skin.js`(3.087). 줄(`.menurow`)의 `display` 는 건드리지 않는다 — 탭 · 조건(밝기 · 훈련 격자 · 3D 줄 …)이 `display:none` 으로 숨긴다. 한 번 `display:grid` 를 걸었다가 모든 탭의 줄이 다 보였다.
- 보드 설정 창의 줄 차례는 board.html 의 `PLAN`(id 목록). 줄을 더하면 `tests/board-settings-3010.test.cjs` 와 `tests/browser/board-settings-hierarchy.mjs` 의 목록도 고친다.
- 3.087 — 커뮤니티 뷰어(`body.comm-viewing`): 떠 있는 도크 · 만들기 틀 규칙은 id 를 열 개 넘게 붙여 보드의 감춤을 이긴다 — 뷰어에서 감출 것은 그 파일 안에서 더 센 선택자로. 보기 전용 막이(`communityBoardReadOnly` 의 guard)가 판을 누른 pointerdown · click 을 window 에서 맨 먼저 멈춘다 — 판 바깥 누름을 알아야 하면 pointerup 을 본다. 뷰어 «보기» 고르개는 `board-comm-look.js`(3.087 board.html 남은 몫 약 1.4KB).
- `applyView` 는 판(svg)의 너비 · 높이를 지운다. 중계 카메라가 판을 잡고 있으면 `board-broadcast.js` 의 `hold` 가 지킨다(3.086 깜빡임).
- 내보내기(그림 · GIF · 영상)는 판을 SVG 그림(`data:image/svg+xml`)으로 그린다 — 페이지 글꼴 · CSS 를 못 본다. 글꼴은 SVG 안에 넣어야 한다.

## 일정(studio/process.html) PDF
- 3.091 — 일정 PDF 는 `studio/pdf-export.js`(`PSPdfExport.open`) 창으로 연다: «PDF 내려받기»는 미리보기 종이를 SVG foreignObject → JPEG → PDF 로 찍는다(작전판 `_ppbSavePdf` 와 같은 방법). 종이 그림은 페이지 글꼴을 못 보므로 쓰인 글자의 Pretendard 조각을 data: 로 넣는다. 여러 장 문서는 `#printDoc .ponepage` 마다 한 쪽.
- 주간 · 월간 «깔끔하게» 모양은 `studio/schedule-poster.js`(CSS 는 `#printDoc.poster` 에만). «자세히»가 예전 문서. 사용자는 «최대한 담백하게» — 색 면 · 띠 · 그래프를 다시 넣지 않는다.
- 인쇄 문서(`__buildPrintDoc`)는 process.html 의 `<style>` 만 모아 싣는다 — 모듈의 인쇄 CSS 는 `<style>` 로 붙여야 들어간다.
- 3.094 — 선수 문서(scout.html `printStandalone` · `profile-sheet.js` `preview`)도 같은 창(`pdfxOpen`). 장이 문서 몸에 바로 놓인 문서는 `pages:{sel, land(el)}` 로 장마다 따로 찍는다(이력서 세로 + 세부평가 가로 → PDF 쪽도 장마다 방향). 문서 색은 검정 · 회색 · 가는 선(보라 · 남색 띠 · 금색 없음).
- 3.094 — 선수 문서는 장을 꽉 채운다(사용자 «여백이 최소화 되게»): 장 높이를 고정하고 줄이 flex 로 늘되 `max-height`(줄 수는 `:has(>:nth-child(n))` 로 셈 · 카드는 인라인 계산)에서 멈춘다. 같은 줄의 칸끼리는 `grid-template-rows:auto repeat(N,1fr)` 로 행 높이를 맞춘다. 인쇄 문서 CSS 는 `.js` 모듈에 둔다 — `.html` 의 px 글자 크기 · hex 개수는 스타일 래칫(`tests/design-tokens-3044`)이 센다.

## 함정
- MutationObserver 안에서 없는 class 를 `classList.remove` 해도 속성 바뀜으로 잡혀 끝없이 돈다(3.084 보드가 안 열렸다). `contains` 로 확인한 뒤 바꾼다.
- 비동기로 걷히는 화면(폰 빈 판 안내 «보관함 열기» 등)을 시험이 곧바로 재면 느린 WebKit 에서 남아 있는 것을 잡는다 — `waitForFunction` 으로 걷힐 때까지 기다린 뒤 잰다(3.086 board-savebar).
- 시험 픽스처 서버(`tests/fixtures/team-app.mjs`)는 브라우저가 끊은 요청에 죽지 않게 본문 읽기를 try 로 감쌌다(3.086 invite-link-export ECONNRESET).
- `pgrep -f "<이름>"` 으로 기다리는 셸 반복은 자기 자신의 명령줄에 걸린다 — 출력 파일을 grep 해서 기다린다.
- 설정 창 단추 규칙이 `!important` 라 단추 글꼴 같은 것은 인라인 `style.setProperty(…, 'important')` 로만 이긴다.
- 고정 폭이 아닌 숫자(«1 / 7» → «2 / 7»)는 폭이 바뀌어 도크 크기 감시 → `applyView` 를 부른다. 바뀌는 숫자에는 `font-variant-numeric:tabular-nums`(font 축약형 **뒤에**).

## 글꼴 · 보안
- 앱 글꼴은 Pretendard 하나(`vendor/fonts.css`). «PROCESS STUDIO» 로고 글자만 Jost. SVG `font-family` 속성 · canvas `font` 도 Pretendard 가 먼저(`tests/font-unify-3085` · `board-name-pos-3086`).
- CSP `font-src 'self' data:` — 글꼴은 자체 호스팅. 이름표 글꼴은 `vendor/name-fonts/<글꼴>/`(SIL OFL, unicode-range 조각).
- 새 localStorage 키는 `studio/storage-keys.js` 에 적는다.

## 시험
- 단위: `npm test`(`tests/*.test.cjs`, 3.091 기준 3,8xx개).
- 브라우저(이 컨테이너): `PS_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright PS_BROWSER_ENGINE=chromium PS_CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/browser/<이름>.mjs`. 묶음 목록은 `tests/browser/run-critical.mjs`.
- 여기서는 WebKit 이 없다(`PS_SIZE=ipad` 는 WebKit 을 띄워 실패). `anim-all-pages` · `anim-export-fit` 은 영상 녹화 때문에 손대지 않은 코드에서도 여기서 실패한다 — CI 가 판단한다.
- CI 는 Chromium · WebKit 둘 다 돈다. 느린 WebKit 에서 «다음 프레임» 을 기다리는 시험은 `waitForFunction` 으로 기다린다(3.084 shaper-ball).
- 미리보기 그림의 한글 글자: `/usr/share/fonts/opentype/unifont/unifont.otf`.

## Supabase
- 프로젝트 `jvtajoeptzfsdwizxejg`. 오류 제보 `ps_support_reports` · 답변 `ps_support_replies`(관리자 답 `author_role='admin'`). 앱 오류 · CSP 보고 `ps_events`.
- 비밀 키는 저장소에 두지 않는다(publishable 키만 `studio/app.html`).
