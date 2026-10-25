# 백엔드 환경 분리

환경은 Netlify의 `SITE_ID` + `CONTEXT` + `BRANCH`와 명시적 `PS_BACKEND_ROLE`을 함께 확인한다. `testprocess`도 Netlify의 production context를 사용하므로 context 이름 하나로 운영 여부를 정하지 않는다.

| 사이트·context·가지 | 역할 | 백엔드 |
|---|---|---|
| processstudio / production / main | production | 기존 운영 프로젝트 고정 |
| testprocess / production / staging | test | 별도 시험 프로젝트 필수 |
| 두 사이트의 deploy-preview 또는 branch-deploy | test | 별도 시험 프로젝트 필수 |
| 로컬·합성 CI | synthetic | loopback 또는 `.invalid`, 운영 연결 금지 |

Netlify build scope에 역할을 문맥별로 설정한다. 시험 환경에는 `PS_TEST_SUPABASE_URL`, `PS_TEST_SUPABASE_PUBLISHABLE_KEY`도 필요하다. publishable 키나 role=anon JWT만 브라우저에 포함할 수 있다. 관리 토큰·DB 비밀번호·service_role/secret 키는 넣지 않는다. 값이 없거나 시험 URL이 운영 프로젝트이면 빌드 첫 단계에서 실패하며 운영 값으로 돌아가지 않는다. 운영 빌드에는 `PS_BACKEND_ROLE=production`을 명시해야 한다. 실제 시험 프로젝트와 인증 설정은 별도로 준비해야 하며 이 코드가 프로젝트나 비용을 만들지 않는다.

`scripts/backend-config.mjs`가 설정을 검증한다. `package-site.mjs`는 같은 설정으로 `backend-config.js`와 기존 `storage.js` 앞부분을 만들고 CSP의 HTTP·Realtime 대상을 바꾼 다음 전체 manifest를 계산한다. 이미 storage.js를 먼저 읽는 standalone/frame에도 동일한 설정과 네트워크 경계가 적용된다. 소스의 모든 storage.js 진입 화면도 중앙 모듈을 먼저 읽는다. 소스에는 합성 기본값만 있으므로 로컬 파일을 열었다고 운영에 접속하지 않는다.

같은 커밋도 환경 설정 때문에 manifest 해시가 다르다. 검증은 **같은 커밋 + 같은 build role/project + 같은 환경 변수**로 만든 dist와 해당 환경의 공개 manifest를 비교한다. 서로 다른 환경의 전체 파일 해시가 같아야 한다고 검사하지 않는다. manifest의 `backend.environment`·`backend.project`에는 공개 식별자만 기록한다.

기존 브라우저의 `ps_sync_cfg`, 저장된 세션 JWT 발급 프로젝트, OAuth callback 토큰을 확인한다. 다른 프로젝트가 남아 있거나 판별할 수 없으면 API/Realtime을 차단하고 기존 자료를 지우거나 새 백엔드에 이관하지 않는다. 요청 헤더·refresh body와 Realtime access_token도 선택 프로젝트에 묶고, 설정이 비어 생기는 상대 API 주소도 차단한다. JWT 발급자 판별은 환경 경계이며 서명 인증은 백엔드가 한다. 최초 시험은 전용 브라우저 프로필 또는 격리 fixture에서 한다. 같은 오리진의 실계정 저장소를 초기화해 해결하지 않는다.

OAuth는 시험 프로젝트의 Site URL/Redirect URLs에 시험 사이트 및 두 사이트의 필요한 PR preview 주소만 등록한다. Google·카카오 공급자의 callback 주소도 새 프로젝트의 `/auth/v1/callback`과 맞춰야 한다. 운영 프로젝트의 기존 인증 설정은 유지한다. 제보/첨부 RPC, ps_blob, 공유 링크·공유 화면 관측, 관리자 기능도 동일한 선택 백엔드를 사용하며 운영 데이터 복제 없이 합성 사용자·팀·자료로 시험한다.

로컬 fixture는 중앙 설정 모듈 응답을 명시적으로 synthetic/loopback으로 바꾸며 나머지 외부 요청은 기존처럼 차단한다. 배포에는 이 경로가 없다. CSP 시험은 선택 프로젝트의 HTTPS·WSS만 허용하는지 함께 확인한다.

Netlify의 읽기 전용 메타데이터 정의: https://docs.netlify.com/build/configure-builds/environment-variables/
