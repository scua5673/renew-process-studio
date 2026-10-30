# PROCESS STUDIO 운영 문서

처음 합류한 사람이 이 한 장으로 구조를 이해하고, 배포하고, 장애에 대응할 수 있게 쓴다. 작업 이력은 문서 저장소(`process-studio`)의 `AGENTS.md` 에, 판별 변경은 `studio/release-notes.js` 와 커밋에 있다(3.038 전 판은 옛 `sw.js` 머리 주석 — git 기록).

## 1. 구조

| 층 | 무엇 | 어디 |
|---|---|---|
| 앱 | 빌드 없는 정적 PWA. 셸 `studio/app.html` 이 화면마다 iframe(작전판 `board.html`, 팀 운영 `scout.html`·`process.html`, IDP `idp.html`, 학습 `learning.html` …)을 띄운다 | 이 저장소 |
| 오프라인 | `sw.js` — HTML 은 **캐시 우선**. `const CACHE` 이름이 바뀌어야 사용자가 새 판을 받는다 | `sw.js` |
| 기기 저장 | `studio/storage.js` — IndexedDB 가 정본, localStorage 는 화면용 거울. 공유 문서는 키별 쓰기 대기열. **키마다 어디에 사는지 · 동기화하는지 · 무슨 구실인지는 `studio/storage-keys.js` 한 표**(아래 «코드 규칙») | `storage.js` · `storage-keys.js` |
| 동기화 | `studio/sync.js` — 45초(실시간 연결 중 3분) 주기 + Realtime 핑(`ps_kv_ping`)으로 바로 받기. 문서 단위 3-way 병합, 서버 판본(`cupd`) 확인 | `sync.js` |
| 서버 | Supabase(Pro, 프로젝트 `jvtajoeptzfsdwizxejg`). 팀 문서 `ps_kv`(워크스페이스·키), 보관함 `ps_library`, 그림 `ps_blob`, 판 역사 `ps_kv_history`(90일), 이벤트 `ps_events`(7일), 사용 핑 `ps_usage`. 권한은 RLS 와 함수(`ps_can_write_key`·`ps_key_scope`·`ps_team_role`) | `migrations/` + `00000000_baseline.*` |
| 배포 | GitHub `scua5673/renew-process-studio` — **`staging` → testprocess**(점검용) · **`main` → processstudio**(실사용). 2026-10-07 전까지는 둘 다 main 이었다 | `netlify.toml` |
| 관리자 | `admin.html` — 운영 홈·사용 방식·오류·백엔드 건강·사람·팀 | `admin.html` |

비밀값: Supabase **publishable** 키만 코드(`studio/app.html` 의 `PS_SYNC`)에 있다. secret 키는 어디에도 두지 않는다. 운영 DB 를 스크립트로 읽을 때는 사람이 만든 개인 접근 토큰 `~/.supabase-pat` 만 쓴다.

### 코드 규칙 (3.053 · 피드백 16 — TD-1 · TD-2 · TD-3)

- **새 키는 표에 먼저** — `studio/storage-keys.js` 에 한 줄(동기화 · 정본 위치 · 구실 · 복구 사본이면 지키는 키 `of`). 표에 없는 키를 코드에 쓰면 `tests/storage-keys-registry.test.cjs` 가 멈춘다. 무엇이 걸렸는지는 `node scripts/storage-keys-scan.cjs`.
  팀과 맞추는 키는 `sync.js` `KEYS`(개인 공간만이면 `PERSONAL` 도)와 표가 같아야 하고, `ps_*` 키는 동기화하지 않는다.
- **페이지 저장소 이름은 뜻대로** — 작전판 `boardStore`(IndexedDB 정본), 팀 운영 `scoutStore`(localStorage 껍데기 — 공유 키는 `psSaveShared` 로 IndexedDB 에도), 커뮤니티 `libStore`(보관함). 예전엔 셋 다 `store` 라서 «IndexedDB 에 썼다고 믿은 값이 localStorage 에만» 있는 사고가 났다(scout.html 1.618).
- **큰 페이지는 더 키우지 않는다** — `tests/code-budget-3043.test.cjs` 의 바이트 예산. 새 기능은 `studio/<기능>.js` 모듈(UMD — `autosave-*.js` · `team-files.js` 모양)로 쓰고 페이지는 부르기만 한다.
- **색 · 글자 · 모서리 값은 `vendor/tokens.css` 한 곳**(3.054 · 피드백 17) — 라이트 `:root`, 다크 `body.fmdark`. `ui-grammar.css` 의 별칭(`--ink` · `--muted` · `--panel` …)은 `var(--c-*)` 로 가리키기만 한다. 새 CSS 는 hex · px 글자 크기 대신 `--c-*` · `--t-*` · `--sp-*` · `--r-*` 를 쓴다(`tests/design-tokens-3044.test.cjs` 래칫 — 반 픽셀 글자는 0). 두 파일을 고치면 모든 페이지의 `?v=` 를 같이 올린다.
  단추는 세 가지 — `ps-btn-primary`(주 행동) · `ps-btn-secondary`(다음 행동) · `ps-btn-text`(글자 링크). 알약 모양은 상태 표시 전용, 점선은 «비어 있음 → 채우기» 하나. 시트 순서는 fonts → tokens → mobile-polish → premium-ui → team-ui → design-v2 → figma-premium → ui-grammar(마지막).
- **시험은 행동을 본다** — 모듈은 `require` 해서 돌려 본다. 주석(`'/* 2.138'`)을 잘라내기 기준점으로 쓰거나 판 번호를 박는 시험은 늘리지 않는다(같은 시험의 래칫 — 줄였으면 상한도 내린다).

## 2. 판 올리기와 배포

흐름(2026-10-07~): **가지 → PR(base `staging`) → testprocess 에서 확인 → 승격 PR(`staging` → `main`) → processstudio**.
`main` 에 합치는 것이 곧 실사용 배포다 — 실기기 확인 없이 `main` 으로 바로 가지 않는다(급한 고침은 아래 «급한 고침»).

1. `git fetch origin && git switch -c <가지> origin/staging`. 같은 폴더를 다른 세션이 쓰고 있으면 `git worktree add` 로 따로 연다(브랜치 전환이 서로를 밟는다).
2. 판 번호를 올린다 — `sw.js` 의 `const CACHE = 'process-3.xxx'`(그 줄엔 판 번호만 — 판마다 머리에 쌓던 변경 기록은 3.038 에서 걷었다. 바뀐 점은 `release-notes.js` 와 커밋 메시지에), `studio/app.html` 의 `window.PS_BUILD` 와 `?v=` 일곱 곳. 사용자 화면이 바뀌면 `studio/release-notes.js` 맨 앞에 안내 한 항목(관리자 화면·테스트만 바뀌면 넣지 않는다 — 넣으면 모두에게 «최근 업데이트» 띠가 다시 뜬다). 테스트·문서만이면 판을 올리지 않는다.
3. `npm ci` → `npm test` · `npm run test:sql` · 필요하면 `node tests/browser/run-critical.mjs`(`PS_TEST_GROUP=selection|board|board2|boardperf|identity|storage|idp|entry|records`).
4. PR(`gh pr create --repo scua5673/renew-process-studio --base staging`). CI: 회귀 1 + 브라우저 9묶음(selection·board·board2·boardperf·identity·storage·idp·entry·records)×2엔진 + release-gate + 배포 미리보기. 묶음은 나란히 돌고, 묶음 목록은 `tests/browser/run-critical.mjs` 한 곳이다(3.012 — CI 밖 시험이 조용히 낡지 않게 브라우저 시험은 모두 여기에 둔다. 엔진과 상관없이 Chromium 을 직접 띄우는 시험은 `CHROMIUM_ONLY` 로 WebKit 잡에서 건너뛰고 로그에 `skipped` 로 적는다).
5. 합치면 testprocess 가 빌드하며 **그 커밋의 `release-gate` CI 가 초록이 될 때까지 최대 20분** 기다린다(`scripts/verify-release.mjs`). 빨강이면 게시를 멈춘다(«Build script returned non-zero exit code: 2»).
   확인은 GitHub API 로 한다 — **Netlify 환경 변수 `GITHUB_TOKEN`**(이 저장소 읽기 전용 fine-grained 토큰, 범위 Builds)을 두면 시간당 5,000번, 없으면 짓기 기계 IP 하나에 시간당 60번이다. 10/21 전엔 그 한도(403 «API rate limit exceeded»)에 걸리면 곧바로 멈췄다(3.137 · 3.141 실서버 게시 실패). 지금은 한도면 20분 안에서 다시 묻고, 20분 내내 한도면 «Add GITHUB_TOKEN» 으로 멈춘다.
   그다음 `scripts/package-site.mjs` 가 `dist/sw-manifest.json`(배포 파일마다 SHA-256)을 만들고, `scripts/release-guard.mjs` 가 지금 사이트의 목록과 견준다 —
   **실행 파일이 바뀌었는데 판 번호가 그대로면 게시를 멈춘다**(«…판 번호는 3.xxx 그대로예요»). 판 번호를 낮춰도 멈춘다. 이 목록으로 서비스워커는 바뀐 파일만 받는다
   (옛 판 캐시의 본문을 직접 해시해 같으면 옮겨 담는다 — `sw.js` «바뀐 파일만 받는다»). 지금 사이트에 목록이 없거나(첫 배포) 못 받으면 견주지 않고 지나간다.
6. testprocess(<https://testprocess.netlify.app>)에서 확인한다. 저장·동기화·로그인·셸을 건드렸으면 `docs/device-checklist.md` 를 실기기로 돈다.
   testprocess · PR 미리보기도 **운영 Supabase** 로 로그인한다. 로그인 뒤 돌아올 주소는 Supabase 대시보드 › Authentication › URL Configuration › Redirect URLs 에
   `https://testprocess.netlify.app/**` · `https://*--testprocess.netlify.app/**` 가 있어야 한다(2026-10-16 추가). 없으면 Supabase 가 Site URL(processstudio)로 돌려보내
   testprocess 에서는 로그아웃 상태로 남는다 — 로그인이 필요한 MP4 · GIF · PNG 내보내기 · 보관함을 점검할 수 없다. Site URL 은 processstudio 그대로 둔다.
7. 승격: `gh pr create --repo scua5673/renew-process-studio --base main --head staging --title "배포: staging → main (2.xxx~2.yyy)"`. 본문에 실기기 확인 결과를 적는다. 합치면 processstudio 가 같은 방식으로 게시한다. 승격 뒤 `staging` 과 `main` 은 같은 커밋을 가리킨다.
8. 확인: `npx netlify-cli api listSiteDeploys --data '{"site_id":"…"}'` 에서 `context:"production"` 의 `state:"ready"` 와 커밋(PS_BUILD 만 보면 «빌드 중»과 «실패»가 구분되지 않는다), 그리고 `curl https://processstudio.netlify.app/studio/app.html | grep PS_BUILD`.

사이트 ID: processstudio `51517b22-e1df-493a-ad81-5204303ded1b` · testprocess `52c8c8c7-f3ae-41e0-95ae-19233921a900`.

### 배포 열차 (2026-10-15~ · 피드백 «제품 1» · TD-4)

하루 4~6판이 실사용에 나가 기기마다 다시 받고(3.051 전엔 판마다 13.6MB), 판이 바뀌는 순간에 생긴 사고가 오류 제보의 큰 몫이었다.

- **`main` 승격은 주 2회 — 화 · 금 오전.** 그 사이 고친 것은 `staging`(testprocess)에 계속 쌓는다. 승격 PR 하나에 여러 판이 들어가도 된다.
- **급한 고침만 예외**(자료가 사라지거나 · 로그인 · 저장 · 동기화가 안 되는 장애). 아래 «급한 고침» 그대로.
- **보드 표현력 신규 작업은 12/2 까지 동결**(새 그리기 도구 · 3D 연출 · 칩 모양 등). 고침 · 피드백 우선순위 작업 · 성능은 계속한다.
- **승격 PR 본문에 실기기 점검 결과 칸이 필수**(`.github/pull_request_template.md` 의 «승격 PR» 칸 — `docs/device-checklist.md`).
- 판 번호가 겹치면(두 PR 이 같은 번호) 늦게 합치는 쪽이 staging 을 합치며 번호를 뒤로 민다 — 3.039 · #407 이 그렇게 했다. 판 번호를 CI 가 붙이는 것은 다음 할 일(아래).

다음 할 일(결정이 필요하다): 판 번호를 사람이 아니라 합칠 때 CI 가 붙이게 — PR 은 «다음 판»으로만 쓰고 staging 에 합치는 순간 번호 · CACHE · `?v=` 를 정하는
작업(봇 커밋이 staging 에 푸시한다). 봇 권한과 번호 규칙(합칠 때마다 +1 인가, 하루 한 번인가)을 정한 뒤 만든다. 그 전까지는 위 release-guard 가 «깜빡한 판 번호»를 막는다.

### 급한 고침 (실사용 장애)

`main` 으로 바로 PR 해도 된다. 합친 뒤 반드시 `staging` 을 따라오게 한다 — 안 그러면 다음 승격이 그 고침을 되돌리거나 충돌한다:

```bash
git fetch origin && git push origin origin/main:staging   # staging 이 main 의 조상일 때(빨리 감기). 거부되면 main 을 staging 에 merge 하는 PR
```

### CI 가 흔들려 배포가 멈췄을 때

브라우저 묶음은 가끔 환경 탓으로 실패한다(예: `scouting-integration` 192행 «0 !== 1», WebKit «access control checks»). 같은 커밋이 PR CI·로컬에서 통과했다면:

```bash
gh run rerun <run-id> --failed --repo scua5673/renew-process-studio
```

`release-gate` 가 초록이 되면 그 가지의 사이트(staging → testprocess, main → processstudio)에 새 빌드를 건다.

```bash
npx -y netlify-cli api createSiteBuild --data '{"site_id":"<site-id>"}'
```

같은 테스트가 **두 번 연속** 실패하면 흔들림이 아니라 회귀로 본다(2.936 교훈).

## 3. 서버(SQL) 바꾸기

`migrations/<날짜>_<이름>.*` 한 묶음으로 만든다: `preflight.sql`(읽기 전용 사전 점검) · `.sql`(멱등, 예상과 다르면 예외로 멈춤) · `verify.sql` · `rollback.sql` · `runbook.md` · `local-test.cjs`(PGlite — 3.051 부터 `scripts/test-sql.cjs` 가 `migrations/*.local-test.cjs` 를 전부 돈다. 목록에 따로 적지 않는다). 운영 적용은 Supabase SQL 편집기에서 runbook 순서대로 하고, 결과를 `.applied.md` 로 남긴다. 적용 뒤 `node scripts/schema-baseline.mjs` 로 기준본을 새로 받아 같은 PR 에 넣는다. RLS 함수는 앱의 권한 규칙(`studio/perms.js`, `sync.js` 의 `canW`/`keyScope`)과 **같은 판정**이어야 한다 — 어긋나면 403 이 되풀이된다.

## 4. 장애 대응

| 증상 | 먼저 볼 곳 | 조치 |
|---|---|---|
| 모든 요청이 402 | Supabase 조직 Billing — 비용 상한(spend cap)·유예 기간 | 상한이 켜져 있고 한도를 넘었으면 사람(결제 권한자)이 상한을 끈다. 이그레스 원인은 Usage › Egress per day |
| 앱이 안 열림·흰 화면 | 사용자 기기의 판 번호, 관리자 오류 탭 | 기기 사이트 데이터 삭제 전 반드시 «안 올라간 변경» 이 없는지 진단 시트로 확인 |
| 저장이 안 올라감 | 앱 설정 › 기기 › 동기화 진단 시트(대기 항목별 이유) · 관리자 «막힌 기기» · `ps_kv_denied` | 권한(403)·서버 거부·옛 판·저장 공간을 구분. 옛 판이면 «탭 완전히 닫고 다시 열기» |
| 자료가 사라졌다 | 앱 설정 › 팀 기록(판 역사, 운영진) · `ps_kv_history` | 직전 판으로 되돌리기. 일정은 일정 화면 «시점 복구». **실계정 앱 탭의 저장소를 지우지 말 것** |
| 새 판이 안 퍼짐 | 관리자 오류 탭 `update_deferred` 의 단계 코드 | 그 화면의 지연 저장·열린 시트를 고친다 |
| 배포 멈춤 | Netlify 배포 로그 «exit code 2» | 2절의 재실행·재빌드 |

### 자료 사고 대응 순서 (2.958)

«내 자료가 사라졌어요» 는 유료 고객에게 해지 사유다. 순서를 건너뛰지 않는다.

1. **멈춘다.** 그 팀 사람에게 «지금 그 화면에서 아무것도 고치지 말아 주세요» 한 줄. 새 저장이 쌓이면 되살릴 판이 밀린다.
   실계정 앱 탭의 저장소(localStorage·IndexedDB)를 지우지 않는다 — 2026-09-04 그 탭의 빈 부팅이 풋볼A 일정을 덮었다.
2. **서버를 기준으로 본다.** 기기 사본은 증거가 아니다(2026-08-07 교훈). SQL 편집기에서 읽기만:
   `select id, changed_at, changed_by, length(v) from ps_kv_history where workspace_id = '<팀>' and k = '<키>' order by changed_at desc limit 30;`
   관리자 백엔드 탭 «데이터 사고» 의 자동 감지 후보에 이미 떠 있는지도 본다(쓴 사람·줄어든 것).
3. **원인을 막고 나서 되살린다.** 같은 기기가 또 덮으면 복구가 지워진다(1.499 «펌프»). 옛 판이면 앱 판 하한(`ps_app_policy.min_build`)
   또는 그 기기를 닫게 한다. 서버 가드로 막을 수 있는 모양이면 가드를 먼저(예: 20261006_scout_record_guard).
4. **되살리기는 마이그레이션 묶음으로.** `migrations/<날짜>_restore_<무엇>.*` — 미리보기(`dryrun.sql`, 읽기 전용) → 고치기 전 문서를 백업 표에
   → 적용(cupd 를 지금 시각으로 올려 기기들이 새 판을 받게) → 다시 읽어 확인 → `.applied.md`. 본보기: `20261007_restore_2948_teams`.
   한 칸만 사라졌으면 그 칸만 되살린다(통째로 옛 판을 덮으면 그 사이 정상 편집이 사라진다).
5. **기록한다.** 관리자 백엔드 탭 «데이터 사고» 에 `loss`(사라짐·덮임) 와 `restore`(복구 작업)를 적는다. 이것이 유료 전환 문턱
   «8주 연속 사고 0건» 의 카운터다 — 적지 않은 사고는 문턱을 거짓으로 만든다.

백업 사실(2026-10-07 대시보드 확인): Supabase 물리 백업 **하루 1번 · 7일 보관**, 시점 복구(PITR)는 **꺼져 있다**(부가 상품).
백업 복원은 **프로젝트 전체를 그 시각으로 되돌린다** — 한 팀 사고에 쓰면 다른 모든 팀의 그 뒤 기록이 사라진다. 한 팀 자료는
`ps_kv_history`(90일, 30일 지나면 내용 비움)에서 되살리고, 그보다 오래된 것이 필요하면 «Restore to new project»(베타)로
**새 프로젝트에** 백업을 풀어 그 팀 행만 옮긴다.

## 5. 정기 점검

- 매주: 관리자 백엔드 탭 «데이터 사고»(마지막 사고 뒤 며칠 · 자동 감지 후보를 사고로 볼지 판정), 운영 홈(핵심 행동·주별 사용자), 오류 탭 되풀이, 막힌 기기.
- 매달: Supabase Usage(이그레스·로그 수집량 — 로그 수집은 2027년부터 20GB 초과 과금), DB 크기, `node scripts/schema-baseline.mjs --check`(운영 ≠ 기준본이면 누군가 운영에 손으로 적용한 것).
- 분기: 새 Supabase 프로젝트에 기준본 + 백업으로 되살려 보는 복구 훈련(`migrations/00000000_baseline.runbook.md`). 걸린 시간·막힌 곳을 기록한다.

## 6. CSP (콘텐츠 보안 정책)

- 막는 정책은 `_headers` 의 `Content-Security-Policy`(object-src · base-uri · frame-ancestors) 하나다. 3.039 부터 그 옆에 **보고 모드**
  `Content-Security-Policy-Report-Only` 가 있다 — 아무것도 막지 않고, 이 정책이었다면 막혔을 것을 브라우저가 알린다.
- 앱(`studio/app.html` 머리의 CSP 수집기)이 그 알림을 «지시어 + 출처(호스트까지)»로 묶어 한 창에 한 번씩 `app_error` · `csp_report` 로 올린다.
  관리자 오류 탭에서 `csp_report` 로 찾는다. 사용자 화면에는 아무것도 뜨지 않는다.
- 새 바깥 주소(API · CDN · 이미지 아닌 자료)를 쓰려면 **먼저** `_headers` 의 해당 지시어에 더한다. `tests/csp-report-only-3039`(주소 목록)와
  `tests/browser/csp-report-only`(탭을 돌며 위반 0건)가 지킨다. Supabase 주소를 바꾸면 connect-src 의 https · wss 두 줄도 같이.
- 막는 정책으로 옮기는 때: 운영(main)에서 `csp_report` 가 2주 동안 0건(또는 전부 확장 프로그램 같은 바깥 원인)일 때, 같은 값을
  `Content-Security-Policy` 로 옮긴다. `'unsafe-inline'`(인라인 스크립트 · 스타일)은 그때도 남는다 — 페이지마다 인라인 스크립트가 많아서,
  걷어 내는 것은 따로 할 일이다.
