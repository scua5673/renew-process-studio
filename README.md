# PROCESS STUDIO 앱

https://processstudio.netlify.app — 코치·선수용 축구 PWA (정적 HTML/JS, 빌드 없음).

## 배포
- `main` 에 머지되면 Netlify 가 자동으로 배포한다 (GitHub ↔ Netlify 연결, `netlify.toml`).
- 작업은 브랜치에서 모아 PR 로 올리고, 확인 후 한 번에 머지한다. PR 마다 deploy preview 주소가 생긴다.
- 판 번호: `sw.js` 의 `CACHE='process-X.XXX'` 와 `studio/app.html` 의 `window.PS_BUILD` 를 같이 올린다.

## 키
- Supabase **publishable** 키는 `studio/app.html` 의 `window.PS_SYNC` 에 있다. RLS 전제의 브라우저 공개용 키라 저장소에 있어도 된다.
- secret(service_role) 키는 서버 전용 — 이 저장소·Netlify·GitHub 어디에도 넣지 않는다.

설계 문서·SQL·과거 기록은 `scua5673/process-studio` 에 있다.
