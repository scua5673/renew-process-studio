# CLAUDE.md — 작업 세션이 먼저 읽는 한 장

자세한 것은 `docs/OPERATIONS.md`. 여기는 매 세션 지켜야 할 것만 적는다.

## 앱

축구 코치용 정적 PWA(빌드 없음). 셸 `studio/app.html` 이 화면마다 iframe(`board.html` · `scout.html` · `process.html` · `idp.html` …)을 띄운다.
저장은 `studio/storage.js`(IndexedDB 정본), 동기화는 `studio/sync.js`, 서버는 Supabase(`migrations/`).
⚠ 로컬 · testprocess 도 **운영 Supabase** 에 붙는다. 실제 팀 자료로 시험하지 않는다.

## 가지와 배포

- 작업 가지는 `origin/staging` 에서 따고, PR 은 **base `staging`** 으로 낸다(→ testprocess).
- `staging` → `main` 승격(→ processstudio 실사용)은 **사람이 정한 날(화 · 금 오전)에만**. 세션이 스스로 승격 PR 을 만들거나 합치지 않는다.
- 예외는 **급한 고침**뿐 — 자료가 사라짐 · 로그인 · 저장 · 동기화가 안 됨. 그 밖(화면 깨짐 · 특정 기기 강제 종료 등)은 staging 에 쌓는다.
  애매하면 «사용자가 지금 앱을 아예 못 쓰나?»로 판단하고, 그래도 애매하면 사람에게 묻는다.
- 급한 고침을 main 에 합쳤으면 staging 이 따라오게 한다(`docs/OPERATIONS.md` §2 «급한 고침»).
- 승격 PR 본문에는 실기기 점검 표가 필수다(`docs/device-checklist.md`). 기기로 확인하지 않았으면 «기기 없음»이라 적고 통과로 적지 않는다.

## 판 번호 (실행 파일을 바꿨을 때만)

- `sw.js` 의 `const CACHE = 'process-3.xxx'` 와 `studio/app.html` 의 `window.PS_BUILD='3.xxx'` 를 같은 번호로.
- `studio/app.html` 의 `?v=<판>` 을 같이 올린다.
- 사용자 화면이 바뀌면 `studio/release-notes.js` 맨 앞에 한 항목. 관리자 화면 · 시험 · 문서만 바뀌면 넣지 않는다.
- 시험 · 문서만 바꿨으면 판을 올리지 않는다. 번호가 다른 PR 과 겹치면 늦게 합치는 쪽이 뒤로 민다.

## 코드 규칙

- 새 저장 키는 `studio/storage-keys.js` 표에 먼저 한 줄.
- 큰 페이지(`board.html` · `scout.html` · `idp.html` · `process.html` · `app.html`)는 더 키우지 않는다. 새 기능은 `studio/<기능>.js` 모듈(UMD)로 쓰고 페이지는 부르기만 한다.
- 색 · 글자 · 모서리 값은 `vendor/tokens.css` 의 `--c-*` · `--t-*` · `--sp-*` · `--r-*` 만 쓴다.
- 서버를 바꾸면 `migrations/<날짜>_<이름>.*` 한 묶음(preflight · sql · verify · rollback · runbook · local-test). 운영 적용은 사람이 한다.
- 시험은 행동을 본다(모듈을 `require` 해서 돌린다). 주석이나 판 번호를 기준점으로 삼는 시험은 늘리지 않는다.

## 시험 (PR 전에)

```bash
npm ci
npm test
npm run test:sql
PS_TEST_GROUP=board PS_BROWSER_ENGINE=chromium node tests/browser/run-critical.mjs   # 건드린 묶음만
```

CI 는 데스크톱 브라우저에서만 돈다. 아이폰 · 아이패드의 메모리 · 강제 종료 문제는 실기기에서만 드러나므로,
그런 고침은 «CI 초록 = 해결»로 보지 않고 PR 본문에 «실기기 확인 필요»라고 적는다.

## 세션 습관

- 세션 하나에 주제 하나. 끝은 staging PR 까지.
- 같은 폴더를 다른 세션이 쓰면 `git worktree add` 로 따로 연다.
- 자료 사고(«자료가 사라졌어요»)는 `docs/OPERATIONS.md` §4 순서를 건너뛰지 않는다 — 실계정 기기 저장소를 지우지 않는다.
