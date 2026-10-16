# PROCESS STUDIO

축구 코치를 위한 앱 — 작전판 · 훈련 · 경기 준비 · 선수단 · IDP(선수 성장) · 학습 · 커뮤니티.
빌드 없는 정적 PWA(`studio/app.html` 셸 + 화면마다 iframe)와 Supabase(동기화 · 권한)로 되어 있다.

- 실사용: <https://processstudio.netlify.app> (`main`) · 점검용: <https://testprocess.netlify.app> (`staging`)
- 지금 판: `studio/app.html` 의 `window.PS_BUILD`(= `sw.js` 의 `CACHE`). 판마다 바뀐 점은 `studio/release-notes.js` 와 커밋 기록.
  (`package.json` 의 version 은 쓰지 않는다 — 0.0.0)

## 로컬에서 열기

```bash
npm ci
python3 -m http.server 8080        # 또는 npx serve .  — 저장소 뿌리에서
# http://localhost:8080/studio/app.html
```

⚠ 로컬 · testprocess 도 **운영 Supabase** 에 붙는다(`studio/app.html` 의 `PS_SYNC`). 실제 팀 자료로 시험하지 말고 시험 계정 · 시험 팀을 쓴다.
서버 없이 화면만 보려면 브라우저 시험의 가상 팀 픽스처(`tests/fixtures/team-app.mjs`)를 쓴다.

## 시험

```bash
npm test                 # 단위 시험(node --test tests/*.test.cjs)
npm run test:sql         # migrations/*.local-test.cjs 전부(PGlite, 가상 DB)
PS_TEST_GROUP=board PS_BROWSER_ENGINE=chromium node tests/browser/run-critical.mjs   # 브라우저 묶음(board · board2 · boardperf · identity · storage · idp · entry · records)
```

## 배포 · 운영

`docs/OPERATIONS.md` 한 장 — 구조, 판 올리기, 배포 열차(주 2회), 급한 고침, 서버(SQL) 바꾸기, 장애 대응, CSP, 정기 점검.
배포 전 실기기 점검은 `docs/device-checklist.md`. 2.886 까지의 옛 변경 기록은 `docs/changelog-until-2.886.md`.
