# PROCESS STUDIO 운영 문서

처음 합류한 사람이 이 한 장으로 구조를 이해하고, 배포하고, 장애에 대응할 수 있게 쓴다. 작업 이력은 문서 저장소(`process-studio`)의 `AGENTS.md` 에, 판별 변경은 `sw.js` 머리 주석과 커밋에 있다.

## 1. 구조

| 층 | 무엇 | 어디 |
|---|---|---|
| 앱 | 빌드 없는 정적 PWA. 셸 `studio/app.html` 이 화면마다 iframe(작전판 `board.html`, 팀 운영 `scout.html`·`process.html`, IDP `idp.html`, 학습 `learning.html` …)을 띄운다 | 이 저장소 |
| 오프라인 | `sw.js` — HTML 은 **캐시 우선**. `const CACHE` 이름이 바뀌어야 사용자가 새 판을 받는다 | `sw.js` |
| 기기 저장 | `studio/storage.js` — IndexedDB 가 정본, localStorage 는 화면용 거울. 공유 문서는 키별 쓰기 대기열 | `storage.js` |
| 동기화 | `studio/sync.js` — 45초(실시간 연결 중 3분) 주기 + Realtime 핑(`ps_kv_ping`)으로 바로 받기. 문서 단위 3-way 병합, 서버 판본(`cupd`) 확인 | `sync.js` |
| 서버 | Supabase(Pro, 프로젝트 `jvtajoeptzfsdwizxejg`). 팀 문서 `ps_kv`(워크스페이스·키), 보관함 `ps_library`, 그림 `ps_blob`, 판 역사 `ps_kv_history`(90일), 이벤트 `ps_events`(7일), 사용 핑 `ps_usage`. 권한은 RLS 와 함수(`ps_can_write_key`·`ps_key_scope`·`ps_team_role`) | `migrations/` + `00000000_baseline.*` |
| 배포 | GitHub `scua5673/renew-process-studio` — **`staging` → testprocess**(점검용) · **`main` → processstudio**(실사용). 2026-10-07 전까지는 둘 다 main 이었다 | `netlify.toml` |
| 관리자 | `admin.html` — 운영 홈·사용 방식·오류·백엔드 건강·사람·팀 | `admin.html` |

비밀값: Supabase **publishable** 키만 코드(`studio/app.html` 의 `PS_SYNC`)에 있다. secret 키는 어디에도 두지 않는다. 운영 DB 를 스크립트로 읽을 때는 사람이 만든 개인 접근 토큰 `~/.supabase-pat` 만 쓴다.

## 2. 판 올리기와 배포

흐름(2026-10-07~): **가지 → PR(base `staging`) → testprocess 에서 확인 → 승격 PR(`staging` → `main`) → processstudio**.
`main` 에 합치는 것이 곧 실사용 배포다 — 실기기 확인 없이 `main` 으로 바로 가지 않는다(급한 고침은 아래 «급한 고침»).

1. `git fetch origin && git switch -c <가지> origin/staging`. 같은 폴더를 다른 세션이 쓰고 있으면 `git worktree add` 로 따로 연다(브랜치 전환이 서로를 밟는다).
2. 판 번호를 올린다 — `sw.js` 의 `const CACHE = 'process-2.xxx'`, `studio/app.html` 의 `window.PS_BUILD` 와 `?v=` 일곱 곳. 사용자 화면이 바뀌면 `studio/release-notes.js` 맨 앞에 안내 한 항목(관리자 화면·테스트만 바뀌면 넣지 않는다 — 넣으면 모두에게 «최근 업데이트» 띠가 다시 뜬다). 테스트·문서만이면 판을 올리지 않는다.
3. `npm ci` → `npm test` · `npm run test:sql` · 필요하면 `node tests/browser/run-critical.mjs`(`PS_TEST_GROUP=board|board2|identity|storage|idp`).
4. PR(`gh pr create --repo scua5673/renew-process-studio --base staging`). CI 16개(회귀 1 + 브라우저 4묶음×2엔진 + 배포 미리보기).
5. 합치면 testprocess 가 빌드하며 **그 커밋의 `release-gate` CI 가 초록이 될 때까지 최대 12분** 기다린다(`scripts/verify-release.mjs`). 빨강이면 게시를 멈춘다(«Build script returned non-zero exit code: 2»).
6. testprocess(<https://testprocess.netlify.app>)에서 확인한다. 저장·동기화·로그인·셸을 건드렸으면 `docs/device-checklist.md` 를 실기기로 돈다.
7. 승격: `gh pr create --repo scua5673/renew-process-studio --base main --head staging --title "배포: staging → main (2.xxx~2.yyy)"`. 본문에 실기기 확인 결과를 적는다. 합치면 processstudio 가 같은 방식으로 게시한다. 승격 뒤 `staging` 과 `main` 은 같은 커밋을 가리킨다.
8. 확인: `npx netlify-cli api listSiteDeploys --data '{"site_id":"…"}'` 에서 `context:"production"` 의 `state:"ready"` 와 커밋(PS_BUILD 만 보면 «빌드 중»과 «실패»가 구분되지 않는다), 그리고 `curl https://processstudio.netlify.app/studio/app.html | grep PS_BUILD`.

사이트 ID: processstudio `51517b22-e1df-493a-ad81-5204303ded1b` · testprocess `52c8c8c7-f3ae-41e0-95ae-19233921a900`.

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

`migrations/<날짜>_<이름>.*` 한 묶음으로 만든다: `preflight.sql`(읽기 전용 사전 점검) · `.sql`(멱등, 예상과 다르면 예외로 멈춤) · `verify.sql` · `rollback.sql` · `runbook.md` · `local-test.cjs`(PGlite, `scripts/test-sql.cjs` 목록에 추가). 운영 적용은 Supabase SQL 편집기에서 runbook 순서대로 하고, 결과를 `.applied.md` 로 남긴다. 적용 뒤 `node scripts/schema-baseline.mjs` 로 기준본을 새로 받아 같은 PR 에 넣는다. RLS 함수는 앱의 권한 규칙(`studio/perms.js`, `sync.js` 의 `canW`/`keyScope`)과 **같은 판정**이어야 한다 — 어긋나면 403 이 되풀이된다.

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
