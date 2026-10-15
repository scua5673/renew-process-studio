## 무엇을 · 왜

<!-- 사용자 말 · 오류 제보 · 피드백 ID(예: UX-1)와 함께 -->

## 판

- [ ] 실행 파일을 바꿨으면 판 번호를 올렸다 — `sw.js` CACHE · `studio/app.html` PS_BUILD · `?v=` 일곱 · 사용자 화면이 바뀌면 `studio/release-notes.js`
      (안 올리면 배포 때 `scripts/release-guard.mjs` 가 멈춘다)
- [ ] 서버를 바꿨으면 `migrations/` 한 묶음(.sql · verify · rollback · runbook · local-test)과 적용 순서를 아래에 적었다

## 시험

- [ ] `npm test` · `npm run test:sql`
- [ ] 브라우저 묶음(필요한 것) — CI 가 Chromium · WebKit 둘 다 돈다

## 승격 PR(`staging` → `main`)만 — 실기기 점검 (필수)

<!-- docs/device-checklist.md 의 다섯 흐름. 기기가 없으면 «기기 없음»(통과로 적지 않는다). 배포 열차: 화 · 금(docs/OPERATIONS.md §2) -->

| 흐름 | 아이폰 | 아이패드 | 안드로이드 |
|---|---|---|---|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |
| 4 |  |  |  |
| 5 |  |  |  |
