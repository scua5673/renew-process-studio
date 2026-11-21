# PROCESS STUDIO 협업 안내 — 가지 · 합치기 · 배포

2026-11-21 기준. 새로 합류한 사람과 그 사람의 코딩 에이전트(Codex 등)가 이 한 장으로 «어디서 가지를 따고, 어디에 합치고, 합치면 무엇이 나가는지» 알 수 있게 쓴다.
더 자세한 운영 문서는 앱 저장소 `docs/OPERATIONS.md`(특히 2절)에 있다. 두 문서가 다르면 코드(`netlify.toml` · `.github/workflows/storage-safety.yml` · `scripts/verify-release.mjs`)가 맞다.

## 1. 한눈에

| 무엇 | 값 |
|---|---|
| 앱 저장소 | GitHub `scua5673/renew-process-studio` (공개 · 기본 가지 `main`) |
| 점검 가지 | `staging` → <https://testprocess.netlify.app> |
| 실사용 가지 | `main` → <https://processstudio.netlify.app> |
| 배포 방식 | Netlify 가 가지에 push 된 커밋을 스스로 짓는다. 손으로 올리는 배포(ZIP · `netlify deploy`)는 쓰지 않는다 |
| CI | GitHub Actions «Storage safety» 하나 — PR 마다, 그리고 `main` · `staging` push 마다 |
| 서버 | Supabase 한 벌. **testprocess 와 PR 미리보기도 운영 DB 에 붙는다** |
| 앱 형태 | 짓는 단계 없는 정적 PWA(`studio/*.html` + 모듈 JS). 서비스워커가 HTML 까지 캐시 우선 |

```
작업 가지 ──PR──▶ staging ──승격 PR──▶ main
                    │                    │
                    ▼                    ▼
           testprocess.netlify.app   processstudio.netlify.app
              (점검 · 누구나)            (실사용 · 코치와 선수)
```

`main` 에 합치는 순간이 실사용 배포다. 작업 가지는 늘 `staging` 에서 따고 `staging` 으로 PR 한다.

## 2. 작업 순서

```bash
# 가지 따기 — 늘 최신 staging 에서
git fetch origin
git switch -c feat/<판>-<이름> origin/staging

# 시험
npm ci
npm test && npm run test:sql
PS_TEST_GROUP=board PS_BROWSER_ENGINE=chromium,webkit node tests/browser/run-critical.mjs   # 고친 화면의 묶음만

# PR — base 는 staging
gh pr create --repo scua5673/renew-process-studio --base staging
```

- 브라우저 묶음 이름: `selection` · `board` · `board2` · `boardperf` · `identity` · `storage` · `idp` · `entry` · `records`. 목록의 원본은 `tests/browser/run-critical.mjs`.
- 한 컴퓨터에서 에이전트 여럿이 같은 폴더를 쓰면 가지 전환이 서로를 밟는다. `git worktree add ../.wt-<이름> -b <가지> origin/staging` 으로 따로 연다.
- PR 본문은 `.github/pull_request_template.md` 양식을 채운다.

## 3. 판 번호

서비스워커가 캐시 우선이라, 판 번호가 그대로면 사용자 기기는 새 파일을 받지 않는다. 실행 파일(HTML · JS · CSS)을 하나라도 고치면 판을 올린다. 시험 · 문서만 고쳤으면 그대로 둔다.

올리는 자리(3.351 → 3.352 커밋 기준):

| 파일 | 자리 |
|---|---|
| `sw.js` | `const CACHE = 'process-3.xxx'` |
| `studio/app.html` | `window.PS_BUILD='3.xxx'` + `?v=3.xxx` 가 붙은 스크립트 · 스타일 줄 |
| `studio/board.html` | `?v=` 두 곳 |
| `studio/idp.html` · `playbook.html` · `process.html` · `scout.html` (+ `app.html`) | `team-mobile.css?v=` |
| `studio/release-notes.js` | 사용자 화면이 바뀔 때만 맨 앞에 한 항목. 넣으면 모두에게 «최근 업데이트» 띠가 뜬다 |
| `CLAUDE.md`(앱 저장소) | 그 판에서 무엇을 왜 바꿨는지 한 줄 |

가장 쉬운 방법은 지난 판 올림 커밋을 그대로 따라 하는 것이다: `git diff 3fe3ace2 de9c6475 --stat`.

**번호는 합치기 직전에 다시 정한다.** 여러 가지가 동시에 같은 번호를 잡는 일이 하루에도 몇 번 있다. 늦게 합치는 쪽이 `staging` 을 자기 가지에 합치고 번호를 뒤로 민다.

```bash
git fetch origin
git show origin/staging:studio/app.html | grep -o "PS_BUILD='[0-9.]*'"   # staging 의 지금 판
gh pr list --repo scua5673/renew-process-studio --state open              # 열린 PR 이 잡은 번호
```

## 4. 합치면 일어나는 일

### PR 을 열면

- CI «Storage safety» 가 돈다: `regression`(단위 시험 · SQL 복원 · 배포 묶음 짓기) + `browser`(9 묶음 × Chromium · WebKit = 18 잡) + `release-gate`(앞의 것이 모두 초록이어야 초록). 보통 13 ~ 18분, 실행기가 밀리면 20분 넘는다.
- Netlify 가 PR 미리보기 사이트를 만든다. 미리보기가 `ready` 인 것은 CI 통과와 상관없다.

### `staging` 에 합치면

1. `staging` push 로 CI 가 한 번 더 돈다.
2. testprocess 가 짓기 시작한다. 짓기 명령(`netlify.toml`):
   `npm test` → `npm run test:sql` → `verify-release` → `package-site` → `release-guard`
3. **`verify-release`(배포 문지기)**: 그 커밋의 `release-gate` 가 초록이 될 때까지 기다린다. 빨강이면 게시를 멈추고 옛 판이 남는다.
   - 합친 커밋의 파일 내용이 부모 커밋과 똑같고 그 부모의 CI 가 초록이면 기다림 없이 통과한다. 그래서 **PR 가지가 최신 `staging` 을 품은 채(«Update branch» 뒤 CI 초록) 합치면** 바로 게시된다.
   - 그렇지 않으면 새 CI 를 기다리는데, Netlify 짓기는 약 18분에 끊긴다. CI 가 그보다 늦으면 «Command did not finish within the time limit» 로 실패한다(5절).
4. **`release-guard`**: 지금 사이트와 새 묶음을 견준다. 실행 파일이 바뀌었는데 판 번호가 그대로거나, 번호가 낮아졌으면 게시를 멈춘다.
5. 통과하면 testprocess 에 새 판이 나간다.

### `main` 에 합치면(승격)

- `staging` → `main` 승격 PR 을 합친다. processstudio 가 위와 같은 순서로 짓고 게시한다.
- 사용자 기기는 다음에 앱을 열 때 새 서비스워커를 받고, 바뀐 파일만 내려받는다.
- 승격 뒤에는 `staging` 을 `main` 과 같은 커밋으로 맞춘다: `git push origin origin/main:staging`
- **승격은 저장소 주인이 정한다.** 주인의 «배포해줘» 뒤에, 주인 쪽 한 곳에서만 한다. 합류한 사람과 그 에이전트는 `staging` 까지만 올리고 승격을 부탁한다.

### 게시 확인

```bash
curl -s https://testprocess.netlify.app/sw.js   | grep -o "process-3\.[0-9]*"
curl -s https://processstudio.netlify.app/sw.js | grep -o "process-3\.[0-9]*"
```

## 5. 게시가 멈췄을 때

| 증상 | 까닭 | 할 일 |
|---|---|---|
| Netlify «Build script returned non-zero exit code: 2» | 그 커밋의 `release-gate` 가 빨강 | 실패한 시험을 본다. 흔들림이면 `gh run rerun <run-id> --failed --repo scua5673/renew-process-studio` → 초록 뒤 다시 짓기 |
| «Command did not finish within the time limit» | CI 가 18분 안에 안 끝남 | CI 초록을 기다린 뒤 다시 짓기 |
| «…판 번호는 3.xxx 그대로예요» | 판 번호를 안 올림 | 번호를 올린 커밋을 더한다 |
| `release-gate` 가 취소된 채 남음 | 같은 가지에 연달아 push 하면 앞 CI 가 취소된다(`cancel-in-progress`). 문지기는 그 커밋의 가장 새 run 하나만 본다 | 다음 커밋의 CI 가 초록이 되면 그 커밋으로 게시된다. 급하면 다시 짓기 |

다시 짓기는 Netlify 계정이 있는 쪽(주인)이 한다: Netlify 화면의 «Trigger deploy» 또는 `npx -y netlify-cli api createSiteBuild --data '{"site_id":"…"}'`(사이트 ID 는 `docs/OPERATIONS.md` 2절).

같은 시험이 두 번 연속 실패하면 흔들림이 아니라 회귀로 본다. 자주 흔들리는 시험 목록은 `docs/OPERATIONS.md` 와 문서 저장소 `AGENTS.md` «알려진 흔들림».

## 6. 함께 쓸 때 지킬 것

- **`main` · `staging` 에 직접 push 하지 않는다.** 두 가지 모두 GitHub 보호 규칙이 걸려 있지 않아 push 가 그대로 들어가고, 들어가는 즉시 사이트가 짓기 시작한다. 반드시 PR 로.
- **`gh pr merge --auto` 를 쓰지 않는다.** 보호 규칙이 없어서 «초록이면 합치기»가 아니라 그 자리에서 합쳐진다. 저장소의 자동 합치기도 꺼져 있다. CI 초록을 눈으로 본 뒤 손으로 합친다.
- **`staging` 에 연달아 합치지 않는다.** 앞 커밋의 CI 가 취소되어 게시가 꼬인다(5절). 앞 합침의 testprocess 게시를 본 뒤 다음 것을 합친다.
- **운영 DB 를 바꾸는 일은 사람이 한다.** 에이전트는 읽기(select)만. 서버를 바꿔야 하면 `migrations/` 에 한 묶음(.sql · verify · rollback · runbook)을 만들고, 주인이 SQL 편집기에서 실행한다.
- **testprocess 도 운영 DB 다.** 실제 계정으로 들어가 저장을 누르면 실제 팀 자료가 바뀐다. 재현과 시험은 합성 팀 fixture(`tests/fixtures/team-app.mjs`)나 로컬에서 한다.
- **비밀 키를 코드에 넣지 않는다.** 저장소는 공개다. 코드에 있는 것은 Supabase publishable 키뿐이다.
- **새 저장 키는 `studio/storage-keys.js` 표에 먼저 올린다.** 표에 없는 키를 쓰면 단위 시험이 멈춘다.
- **화면 구조가 바뀌는 작업은 목업을 먼저 보여 주고 고른 뒤 만든다.** 예시 문구의 팀 이름은 «프로세스FC».
- 옛 Codex 저장소(`process-studio-source`)는 1.76x 에서 멈춘 것이다. 거기서 고치면 사라진다.

## 7. 지금 상태 (2026-11-21 오후)

| | 커밋 | 판 |
|---|---|---|
| `main`(실사용) | `278f7a40` | 3.352 |
| `staging`(점검) | `7fbffe4d` | 3.353 — #934 합침 · 승격 전 |

- 열린 PR 없음.
- 원격 가지 146개(`codex/` 54 · `claude/` 47 · `fix/` 18 · `feat/` 15 …). 대부분 합쳐졌거나 닫힌 PR 의 흔적이다. 새 작업은 옛 가지를 이어 쓰지 말고 `origin/staging` 에서 새로 딴다.
- 다음 판 번호는 3.354 부터(합치기 직전에 다시 확인).
- 이 표는 금방 낡는다. 지금 값은 3절의 명령으로 본다.

## 8. 합류 전에 주인과 정할 것

1. **가지 이름** — 누가 만든 가지인지 보이게 접두사를 정한다(예: `<이름>/feat-…`). 지금은 `feat/` · `fix/` · `codex/` · `claude/` 가 섞여 있다.
2. **판 번호 조율** — 지금은 «늦게 합치는 쪽이 민다»뿐이다. 사람이 둘이면 번호를 잡을 때 서로 알릴 곳(메신저 방 하나)이 필요하다.
3. **누가 `staging` 에 합치나** — 각자 합칠지, 주인이 보고 합칠지.
4. **승격 박자** — `docs/OPERATIONS.md` 에는 «화 · 금 오전 주 2회»와 «보드 표현력 신규 작업 12/2 까지 동결»이 적혀 있지만, 요즘은 주인의 말에 따라 하루에도 여러 번 승격한다. 어느 쪽을 따를지 정한다.
5. **권한** — GitHub 쓰기 권한 · Netlify 접근(다시 짓기를 누가 하나) · Supabase 읽기 접근.
6. **작업 기록** — 판별 기록(`판-기록.md`) · `AGENTS.md` 는 별도의 문서 저장소 `scua5673/process-studio` 에 있다. 합류한 사람도 거기에 적을지, 앱 저장소의 `CLAUDE.md` 한 줄과 PR 본문으로 갈음할지.
