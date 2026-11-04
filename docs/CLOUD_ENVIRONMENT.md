# Codex 클라우드 작업 환경

대상 저장소: `scua5673/renew-process-studio`. Node 22, lockfile의 Playwright·PGlite를 사용한다. 운영 Supabase·Netlify 토큰은 코드 수정과 합성 시험에 필요하지 않다.

## 환경에 적용할 설정

- 이름: `process-studio-development`
- 저장소: `scua5673/renew-process-studio` 하나
- 공유: 개인용
- 런타임: Node 22 (`.nvmrc`)
- 설치: 아래 설치 스크립트
- 비밀 값: 없음
- 네트워크: 설정 화면의 패키지 관리자 기본 목록. Playwright 다운로드가 차단되면 실패 로그의 정확한 호스트만 확인해 추가한다. 무제한 인터넷·운영 서비스 접근을 설치의 전제로 삼지 않는다.

저장소에 이 파일들이 들어간 가지에서는:

```bash
bash scripts/setup-cloud.sh
```

아직 기본 가지에 이 파일들이 합쳐지지 않았다면 설정 대화에 아래 내용을 전달한다. 이 요청은 기존 `package.json`과 lockfile만으로 실행 가능하다:

> 프로세스 스튜디오 개발 환경을 준비해 주세요. Node 22를 선택하고 `npm ci --ignore-scripts --no-audit --no-fund`를 실행하세요. lockfile에 고정된 Playwright로 `./node_modules/.bin/playwright install --with-deps chromium webkit`을 실행하세요. `npm test`, `npm run test:sql`, `PS_TEST_GROUP=selection PS_BROWSER_ENGINE=chromium,webkit npm run test:browser`를 실행해 실제 결과를 기록하세요. 설치 과정과 새 작업 시작 방법을 Install script와 Start skill에 저장해 주세요. 시험은 기존 합성 계정·합성 DB를 사용하고 운영 DB나 실제 팀 자료를 수정하지 마세요. 저장소의 정적 파일을 브라우저로 바로 열면 운영 Supabase에 연결되므로 독립 시험 환경으로 간주하지 마세요. GitHub PR의 기본 대상은 staging입니다. 환경 공유는 개인용으로 유지하세요. 런타임 파일·서비스워커 버전은 환경 설정만을 위해 바꾸지 마세요. 필요한 접근이 막히면 실패 호스트·명령을 설명하고 무제한 권한으로 바꾸지 마세요.

Node 22 선택은 설치 명령 실행 전에 환경 설정 대화에서 처리한다. `setup-cloud.sh`는 다른 Node 주 버전이면 중단한다. 패키지 버전은 lockfile과 대조하고 PGlite의 메모리 DB에서 `select 1`까지 확인한다.

## Start skill에 넣을 지침

```text
저장소의 AGENTS.md, docs/OPERATIONS.md를 먼저 읽는다.
현재 Node 주 버전이 22이고 node_modules가 있는지 확인한다.
lockfile이 바뀌었으면 npm ci --ignore-scripts --no-audit --no-fund를 다시 실행한다.
작업의 기준 가지는 staging이며 운영 배포는 별도 사용자 승인 후 진행한다.
기본 상태에는 상주 서버나 실제 서비스 비밀 값이 필요하지 않다.
단위 시험은 npm test, SQL 시험은 npm run test:sql로 실행한다.
브라우저 회귀 시험은 tests/browser/run-critical.mjs의 관련 묶음을 골라 실행한다.
브라우저 시험은 자기 합성 서버를 시작하고 종료한다. 운영 계정으로 시험하지 않는다.
화면 수동 조작은 환경이 제공하는 도구로만 한다. 지원하지 않으면 미확인으로 보고한다.
출력은 변경 요약, 실행한 시험과 결과, 남은 제약, staging 대상 PR로 정리한다.
```

## 게시 완료의 기준

1. 설정 대화에서 위 설치·시험이 성공했는지 확인한다. 실패를 통과로 바꾸지 않는다.
2. 설정과 파일을 검토하고 저장한 뒤 Publish를 누른다.
3. `Environment published` 표시를 확인한다.
4. 새 클라우드 작업에서 저장소·Node 22·패키지 버전을 확인하고 작은 단위 시험을 실행해 게시된 환경을 검증한다.

로컬에서 파일을 준비하거나 PR을 만드는 것만으로 클라우드 환경이 게시된 것은 아니다. 실제 설정 대화와 게시 후 새 작업 확인 결과를 따로 남긴다.

공식 안내: <https://learn.chatgpt.com/docs/environments/cloud-environments>. 현재 안내에는 클라우드의 컴퓨터·브라우저 직접 조작이 미지원으로 표시되어 있다. 이 제약과 CI의 자동 브라우저 시험, 아이폰·아이패드 실기기 검증을 구분한다.
