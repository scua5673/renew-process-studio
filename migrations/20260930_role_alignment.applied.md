# 역할 기본값·코치 피드백 쓰기 — 운영 적용 완료 (2026-09-30)

운영 프로젝트 `jvtajoeptzfsdwizxejg` 에 로그인된 Supabase SQL 편집기에서 적용했다(사용자 승인 «순서대로 해줘»·«로그인했어»).

## 사전 점검(읽기 전용) 결과
- 바꿀 줄이 모두 예상대로 정확히 한 번씩 있었다.
  - `ps_team_role`: staff 기본값 1 · 권한표 없음 admin 1
  - `ps_idp_can_view`: staff 기본값 1 · 권한표 없음 true 1
  - `ps_can_write_key`: 구성원 확인 줄 1
- 쓰기 가드 `ps_kv_team_guard` 에는 코치 피드백 전용 분기가 없고, 나머지 분기는 `ps_can_write_key(new.workspace_id, new.k)` 였다.
- 가드 모드 `enforce=false`(관찰 모드). 코치 피드백 키 거부 기록은 13행·1명, 마지막 2026-09-29.
- 권한 문서 54개 중 2개가 JSON 이 아니다(값 `undefined`). 서버 함수는 이 경우를 «권한표 없음»으로 처리한다.
- 팀 비소유 구성원 280명의 권한 상태:

  | 상태 | 인원 |
  |---|---|
  | 역할 명시 | 266 |
  | 팀 기본 역할 적용 | 3 |
  | 권한표에 역할도 기본값도 없음 | 0 |
  | 권한표 없음·깨짐(6개 팀) | 11 |

  마지막 11명이 변경 전 서버에서 관리자였고, 이번 변경으로 선수가 된다. 이 11명 중 최근 30일 안에 팀 자료를 쓴 사람은 0명이다.
- 팀 기본 역할(defaultRole) 분포: player 41 · staff 4 · 없음 8 · executive 1.

## 적용·확인
1. 적용 직전 운영 함수 원문을 기록했다(세 함수 `pg_get_functiondef`). 픽스처(`…local-fixture.sql`)에 그대로 옮겨 로컬 시험이 운영과 같은 글자에서 돈다.
2. `20260930_role_default_player.sql` → `Success` → `….verify.sql` → `role_default_player_verified`. 두 함수에서 기본값 두 줄만 바뀌고 표식이 둘씩 붙었다.
3. `20260930_idp_pub_write.sql` → `Success` → `….verify.sql` → `idp_pub_write_verified`. 구성원 확인 바로 뒤에 한 줄이 들어갔다.
4. 세 함수의 실행 권한은 적용 뒤에도 그대로다(`{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`). SECURITY DEFINER·search_path 도 유지된다.

정책·테이블·데이터·트리거는 바꾸지 않았다. 사용자 이름·이메일·본문은 기록하지 않았다.

## 적용하며 확인한 운영 사실 (이번 변경 범위 밖)
- 운영 `ps_can_write_key` 는 저장소 `supabase-staff-readonly.sql`(1.634)과 다르다. 개별 구역이 없는 스태프를 **쓰기 허용**으로 둔다(`if r = 'staff' then return true`). 곧 «코칭스태프는 보기 전용»은 서버가 아니라 앱(`sync.js canW`·`perms.js`)에서만 지켜진다.
- 쓰기 가드는 관찰 모드다(`enforce=false`).
- 권한 문서 2개가 `undefined` 로 깨져 있다. 소유자가 권한 화면에서 한 번 저장하면 복구된다.

## 되돌리기
역순으로 실행한다: `20260930_idp_pub_write.rollback.sql` → `20260930_role_default_player.rollback.sql`. 둘 다 표식이 붙은 줄만 원래대로 돌린다(로컬 시험에서 원문과 글자까지 같음을 확인).
