# 관리자 콘텐츠 작성자 조회

`ps_admin_content_owners(p_wid uuid DEFAULT NULL, p_include_deleted boolean DEFAULT false)`는 JSON 배열을 반환한다.
각 행은 `workspace_id`, `lib_id`, `owner_id`, `owner_name`, `owner_email`만 포함한다. 사용자 본문은 반환하지 않는다.

작성자는 `ps_library.owner_id`로만 연결한다. 이름은 같은 공간의 같은 사용자 `ps_members.name`, 인증 계정의 `name`, `full_name`, `nickname`, `display_name` 순으로 읽는다. 이메일은 인증 계정 이메일만 사용한다. 빈 값은 null이며, 계정이나 작성자 정보가 없을 때 공간 소유자를 대신 표시하지 않는다.

2026-09-17 운영 카탈로그에서 기존 `ps_admin_library`가 `auth.users.id = ps_workspaces.owner_id`로 이메일을 조회하는 것을 확인했다. 따라서 화면은 새 메타데이터의 `(workspace_id, lib_id)` 복합 키로 **모든** 작성자 필드를 덮어써야 한다. null도 유효한 결과이며 기존 이메일을 보존하면 안 된다. 조회 실패 시 작성자 확인이 안 된 상태를 표시한다.

## 적용

1. 운영 프로젝트 `jvtajoeptzfsdwizxejg`의 승인된 SQL 편집기에서 `20260917_admin_content_owners.preflight.sql`을 실행한다. 카탈로그와 집계만 출력한다.
2. 로컬 격리 PGlite에서 `node migrations/20260917_admin_content_owners.local-test.cjs`를 실행한다. `PGLITE_MODULE`로 설치 경로를 지정할 수 있다. 테스트는 실제 계정·네트워크·본문을 사용하지 않는다.
3. `20260917_admin_content_owners.sql`을 한 트랜잭션으로 실행한다. 새 함수 정의·함수의 EXECUTE 권한·스키마 갱신만 변경한다. 기존 함수, 테이블, RLS, 트리거, 권한, 사용자 데이터는 변경하지 않는다.
4. `20260917_admin_content_owners.verify.sql`을 실행한다. 새 함수의 관리자 제한·권한·고정 검색 경로를 확인한다.
5. 웹 관리자 화면에서 새 메타데이터 조회를 확인한다. 실제 이름·이메일·본문은 운영 기록에 복사하지 않는다.

권한은 기존 `ps_is_admin()`에 따르며, 인증된 서비스 관리자만 메타데이터를 받을 수 있다. 일반 로그인·팀 관리자·익명 계정은 거부한다. 기존 콘텐츠 목록과 동일한 워크스페이스 존재 및 삭제 범위를 유지한다. 계정 연결이 없는 과거 행은 추측이나 데이터 수정 없이 미확인으로 남긴다.

## 되돌리기

먼저 웹에서 새 호출을 중단한 다음, 이 마이그레이션 표식이 일치하는 경우에 한해 새 함수 `public.ps_admin_content_owners(uuid,boolean)`만 제거하고 PostgREST 스키마를 갱신한다. 기존 조회 함수로 돌아가더라도 해당 이메일을 콘텐츠 작성자로 표시해서는 안 된다. 사용자 행을 되돌리는 절차는 필요 없다.
