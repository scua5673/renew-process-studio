# 비공개 오류 제보와 답변

이 마이그레이션은 제보/답변 테이블 두 개와 RPC만 추가한다. 기존 선수 기록, 동기화 데이터, 멤버십, 관리자 판정 함수, 정책 및 트리거는 변경하지 않는다. **로컬 검증 완료와 운영 적용은 별개**다.

## 적용 순서

1. `.preflight.sql`로 `auth.uid()`의 UUID 반환형, `public.ps_is_admin()`의 boolean 반환형, 클라이언트 역할 및 새 객체 이름 충돌을 읽기 전용 확인한다. 팀 운영진 여부는 서비스 관리자 권한을 부여하지 않는다. 기존 판정 함수를 새로 정의하지 않는다.
2. 로컬 전용 `.local-test.cjs`를 실행한다. `.local-fixture.sql`은 PGlite의 빈 메모리 DB만 대상으로 하며 운영 DB에 실행하면 안 된다.
3. 운영 적용이 승인된 경우 대상 프로젝트를 확인하고 `.sql` 전체를 한 트랜잭션으로 적용한다. 대상 테이블은 `ps_support_reports`, `ps_support_replies`다. 이 파일은 기존 사용자 자료를 읽거나 수정하지 않는다.
4. `.verify.sql`로 RLS, 직접 테이블 접근 차단, API/내부 함수 ACL, 고정 `search_path=pg_catalog`를 확인한다. 기존 관리자 판정과 실제 JWT의 운영 통합은 별도 확인한다.
5. 문제가 있으면 `.rollback.sql`로 이 기능의 RPC 접근만 끈다. 제보, 답변, 시각, 함수, 테이블은 남긴다. 재적용하면 기존 내용을 유지하며 API를 다시 연다. 다른 마이그레이션의 소유 표식이 있으면 설치와 롤백 모두 중단한다.

```sh
node migrations/20260915_support_reports.local-test.cjs
```

PGlite 경로는 `PGLITE_MODULE`로 지정할 수 있다. 테스트 러너는 계정 정보나 앱 환경 파일을 읽지 않으며 네트워크를 사용하지 않는다.

## 접근 원칙

- 로그인한 제보자와 `public.ps_is_admin()`이 승인하는 서비스 관리자만 제보의 본문·진단·답변을 볼 수 있다. 팀 관리자, 같은 팀 선수 및 다른 계정에는 열리지 않는다.
- 제보는 계정에 속하며 팀 전환과 무관하게 유지된다. 본인 제보의 추가 설명과 운영자의 답변을 같은 대화에서 제공한다. 작성자 ID와 관리자 역할, 저장 시각은 서버가 정한다.
- 기본 테이블에는 RLS를 켜고 PUBLIC/anon/authenticated의 모든 권한을 회수한다. 클라이언트가 사용 가능한 것은 네 개 RPC뿐이다. 함수의 테이블 이름과 외부 보조 함수는 스키마를 명시한다.
- API 응답에는 계정 UUID를 반환하지 않는다. `is_own`과 `author_role`로 표시할 수 있다. 저장 테이블의 계정 UUID는 접근 판정에만 쓴다.
- 진단 자료는 사용자가 제보에 첨부했을 때만 저장한다. 본문·답변은 사용자가 직접 작성한 내용이다. 전체 콘솔, 원시 오류 메시지, 토큰, URL 쿼리, 선수 데이터 및 localStorage 원문은 진단 스키마에 포함하지 않는다.
- 자동 삭제·이메일·외부 알림·관리자 상태 수정 API는 추가하지 않는다. `status` 초기값은 `open`이며 이번 UI에서 상태를 임의로 바꾸지 않는다.

## RPC 계약

Supabase RPC는 JSON 값을 직접 반환한다. 오류를 빈 목록이나 성공으로 바꾸지 않는다. API 이름과 인자는 다음과 같다.

### `ps_support_list(p_limit integer = 20, p_before jsonb = null)`

`p_limit`은 1~50. 응답은 `{reports: [...], next_cursor: null|{created_at,id}, is_admin: boolean}`이다. 일반 계정은 자기 목록, 서비스 관리자는 전체 목록을 받는다.

각 메타데이터: `id`, `title`, `status`, `created_at`, `updated_at`, `is_own`, `reply_count`, `last_reply_at`. **본문, 진단 로그, 작성자 UUID는 목록에서 제외**한다. 최신 생성 시각/ID 내림차순이며 같은 시각도 ID로 구분한다. 다음 요청은 반환된 `next_cursor`를 그대로 전달한다. 답변으로 `updated_at`이 바뀌어도 생성 시각 정렬은 변하지 않는다.

### `ps_support_get(p_report_id uuid)`

응답 `{report, replies}`. `report`에는 목록의 공통 필드와 `body`, `diagnostics`가 있으며 `reply_count`/`last_reply_at`은 없다. `replies`는 오래된 시각/ID 순서이고 각 항목은 `id`, `report_id`, `body`, `author_role` (`reporter` 또는 `admin`), `is_own`, `created_at`이다. 진단 미첨부는 `{}`다.

### `ps_support_create(p_id uuid, p_title text, p_body text, p_diagnostics jsonb = '{}')`

새 제보의 UUID는 전송 전에 클라이언트가 만들고 미확인 응답 재시도에도 같은 값을 쓴다. 제목 1~120자, 본문 1~8000자. 앞뒤 공백은 정리된다. 반환 필드: `id`, `title`, `status`, `created_at`, `updated_at`, `is_own`.

동일 UUID·동일 작성자·동일 정규화된 제목/본문·동일 진단으로 재전송하면 기존 제보를 그대로 반환한다. 진단을 재수집해 시각을 바꾼 뒤 같은 UUID를 재사용하면 같은 요청이 아니므로 거부된다. **응답이 불확실하면 원래 요청의 UUID와 진단 스냅샷을 보존**한다. 다른 계정으로 전환한 뒤 이전 요청을 새 계정으로 재전송하지 않는다.

### `ps_support_reply(p_id uuid, p_report_id uuid, p_body text)`

답변 UUID도 전송 전에 만들고 재시도 시 유지한다. 본문 1~4000자. 제보자 본인 또는 서비스 관리자만 작성할 수 있다. 응답은 위 `replies`의 단일 항목이다. 동일 UUID·작성자·제보·정규화된 본문의 재시도는 중복 답변을 만들거나 마지막 수정 시각을 갱신하지 않는다. 변경된 내용으로 기존 UUID를 다시 쓰면 거부된다.

에러 코드: 인증/권한 `42501`, 입력 형식/길이 `22023`, 없거나 볼 수 없는 제보 `PT404`, 재사용 UUID의 요청 불일치 `PT409`. 제보 UUID만 알더라도 다른 계정은 존재 여부·본문을 조회하거나 답변할 수 없다.

## 진단 스키마

전체 JSON은 최대 49,152바이트다. 미첨부 `{}` 외에는 아래 필드가 모두 있어야 하고 알 수 없는 필드, null, 원시 메시지는 거부한다. 알 수 없는 문자열은 수집기가 정해진 안전 기본값으로 바꾼다.

- 최상위: `capturedAt` (시간대 포함 ISO 8601), `environment`, `logs`.
- `environment`: `appVersion` (숫자/점, 최대 24자 또는 빈 문자열), `browser` (Chrome/Edge/Firefox/Safari/SamsungInternet/Opera/WebView/unknown + 선택적 숫자 주/부 버전, 40자), `os` (Windows/macOS/iOS/Android/Linux/ChromeOS/unknown), `viewport`와 `screen` (각 `{width,height}`, 0~20000 정수), `language` (35자), `timeZone` (64자), `online` (boolean), `displayMode` (browser/standalone/fullscreen/minimal-ui/unknown), `path`.
- `logs`: 최대 40개. 각 항목은 `at`, `kind` (error/unhandledrejection/sync/storage), `name` (일반 오류 클래스와 승인된 저장소 오류 클래스), `code`, `stage` (각 ASCII 토큰 48자), `category` (javascript/network/storage/permission/authentication/conflict/timeout/unknown), `source`, `line`, `column`, `frames`.
- `frames`: 최대 5개 `{source,line,column}`. 줄/열은 0~10000000 정수. 함수명과 원시 스택 문자열은 받지 않는다.
- `path`와 `source`: 빈 문자열, `/studio/<안전한 파일명>.html|js|mjs|css`, `/sw.js`만 허용한다. 쿼리·해시·경로 이동 문자열·외부 주소는 거부한다. 수집기는 실제 정적 파일 목록으로 더 좁힌다.

시간은 40자 이하이고 실제로 해석 가능한 유한 시각이어야 한다. 이 환경/로그는 **클라이언트가 보고한 진단 자료**이며 서버의 독립적인 오류 판정은 아니다.
