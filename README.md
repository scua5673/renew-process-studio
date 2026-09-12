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

## 저장 회귀 검증

Node.js 22 이상에서 별도 패키지 설치 없이 실행한다.

```bash
node --test tests/*.test.cjs
```

테스트는 현재 파일의 실제 함수를 읽어 가상 저장소·서버 응답에서 실행한다.
세션 내용 보존, 개인 자료의 두 기기 충돌, 비동기 기기 저장 완료/실패,
설정의 동기화 상태 표시, 복구 본문 유무, JavaScript 문법과 앱·서비스워커 버전 일치를 검사한다.
운영 계정이나 서버에 접속하지 않으며 실제 사용자 자료를 사용하지 않는다.
GitHub의 `Storage safety` 검사는 PR과 main 변경 때 같은 명령을 실행한다.
서버의 실제 권한·트리거와 실기기 사용 검증을 대체하지는 않는다.

Playwright와 Chromium이 있는 환경에서는 실제 브라우저 저장도 확인한다.

```bash
node tests/browser/storage-safety.mjs
```

필요하면 `PS_PLAYWRIGHT_MODULE`에 Playwright 모듈 경로,
`PS_CHROME_PATH`에 Chrome 실행 파일 경로를 지정한다.
375px 휴대폰, 1100px 터치 화면, 1280px 데스크톱을 새 브라우저 컨텍스트에서 검사하며,
로컬 테스트 서버 외 요청은 차단한다. 결과와 화면은 `test-results/storage-safety/`에 남는다.

사용법 6개 언어와 시작 안내·설명서의 화면 검증도 별도로 실행할 수 있다.

```bash
node tests/browser/guidance.mjs
```

375px·768px·1100px·1280px 화면에서 언어 전환, 도움말 열기/닫기,
목차 링크와 가로 넘침, JavaScript 예외를 확인한다. 같은 환경변수를 지원하며
결과는 `test-results/guidance/`에 남긴다. 두 브라우저 검사 모두 `PS_TEST_OUTPUT`으로 결과 폴더를 바꿀 수 있다.
