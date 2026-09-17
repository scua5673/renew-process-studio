# 관리자 콘텐츠 작성자 조회 운영 적용

2026-09-17, 운영 프로젝트 `jvtajoeptzfsdwizxejg`의 로그인된 Supabase SQL 편집기에서 적용했다.

- 사전 카탈로그 확인: `ps_library.workspace_id/owner_id uuid`, `lib_id text`, `deleted_at bigint`, `ps_members.name text`, 인증 계정 `email varchar`, `raw_user_meta_data jsonb`.
- 기존 `ps_admin_library(uuid,boolean)`는 콘텐츠 작성자가 아닌 워크스페이스 소유자의 이메일을 반환하고 있었다. 기존 함수는 변경하지 않았으며, 새 웹 화면이 별도의 작성자 메타데이터를 결합한다.
- 새 `ps_admin_content_owners(uuid,boolean)`만 설치했다. 고정 `search_path=pg_catalog`, STABLE SECURITY DEFINER, `auth.uid()` 및 기존 `ps_is_admin()` 검사를 적용했다. 익명/PUBLIC 실행을 허용하지 않으며, 인증된 서비스 관리자만 결과를 받는다.
- `20260917_admin_content_owners.verify.sql` 실행 결과: `admin_content_owners_verified`.
- 격리 PGlite SQL 검사 26개 통과. 실제 작성자 연결, 다른 공간의 동일 콘텐츠 ID, 이름 대체 순서, 누락·삭제 계정, 삭제 콘텐츠 범위, 익명·일반 사용자 거부, 관리자 권한 회수, 기존 데이터·권한·RLS·함수 보존을 확인했다.
- 사용자 행, 콘텐츠 본문, 작성자 ID, 기존 함수, 테이블 권한, RLS 정책을 수정하지 않았다. 새 함수의 실행 권한과 PostgREST 스키마 갱신만 적용했다. 운영 사용자 이름·이메일·본문·토큰을 기록하지 않았다.

설치 전 집계는 삭제 항목을 포함하여 총 1,483행이었다. 1,092행에는 작성자 ID가 있고 모두 해당 인증 계정의 이름이 있었다. 391행은 작성자 ID 자체가 없어 추측 없이 미확인으로 남긴다. 이 숫자는 당시 집계이며 이후 운영 데이터 변화에 따라 달라질 수 있다.

SQL SHA-256: `707d3f1295dbf9a11e1afb32c6fd7085cfd6ed83c5b9fd10c365e86f760bd865`

웹의 최종 반영 및 로그인된 관리자 화면 검증은 프런트엔드 배포 기록을 따른다.
