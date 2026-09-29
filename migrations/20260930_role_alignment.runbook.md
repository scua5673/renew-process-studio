# 역할 기본값·코치 피드백 쓰기 — 서버를 앱과 같은 규칙으로 (2026-09-30)

두 변경은 서로 독립이다. 순서대로 적용한다: ① `20260930_role_default_player` → ② `20260930_idp_pub_write` → 앱 2.912 배포.

## ① 역할 기본값 = 선수 (`20260930_role_default_player`)

- **문제**: 앱(`perms.js myRole`, `sync.js`)은 권한표에 내 역할이 없고 `defaultRole` 도 없으면 선수로 본다. 팀 공간에 권한표가 아예 없으면 소유자 말고는 선수로 본다. 서버는 앞의 경우를 스태프(`ps_team_role`)·열람 가능(`ps_idp_can_view`)으로, 뒤의 경우를 관리자·열람 가능으로 봤다. 그래서 역할 없는 계정은 화면에서는 가려져도 네트워크로 다음을 받을 수 있었다.
  - 팀 민감 문서(`ps_can_read_key`)
  - 다른 선수의 개인 IDP·코치 피드백(`kv_sel_idp`·`kv_sel_pub`)
  - 비공개가 아닌 보관함(`ps_library`)
- **고침**: 라이브 정의를 `pg_get_functiondef` 로 읽어 두 줄만 바꿔 다시 만든다. 바꾸는 줄은 기본값 `'staff'`→`'player'`, 권한표 없음 `'admin'`/`true`→`'player'`/`false` 이다. 소유자·개인 공간·명시한 역할·`defaultRole` 은 그대로다. `CREATE OR REPLACE` 라 이름·인자·SECURITY DEFINER·search_path·GRANT·소유자도 유지된다. 정책·테이블·데이터는 건드리지 않는다.
- **안전장치**: 바꿀 줄이 함수마다 정확히 한 번씩 있어야 한다. 아니면 트랜잭션째 멈춘다. 표식 `ps-20260930-role-default` 가 있으면 건너뛴다(재실행 안전).

## ② 코치 피드백 쓰기 = IDP 열람 규칙 (`20260930_idp_pub_write`)

- **문제**: `cs_idp_pub_v1_<uid>` 쓰기는 세 곳의 규칙이 달랐다.
  - RLS(`kv_*_pub`): `ps_idp_can_view`
  - 쓰기 가드(`ps_kv_team_guard` 나머지 분기 → `ps_can_write_key` → `ps_key_scope` 가 실제 키를 `'board'` 로 봄)
  - 앱(`'team'` 구역)

  그래서 가드가 켜져 있으면 보기 전용 코칭스태프의 리뷰·♥·코치 목표가 서버에서 되돌려졌고, 앱은 애초에 올리지도 않았다.
- **고침**: `ps_can_write_key` 첫머리(구성원 확인 바로 뒤)에 한 줄을 넣는다. 이 키면 `ps_idp_can_view(wid)` 로 판정한다. 다른 키의 판정은 그대로다. `kv_*_nonidp` 는 이 키를 이미 제외하므로 정책 결과는 달라지지 않는다.
- **앱(2.912 `sync.js canW`)**: 같은 규칙이다 — 선수가 아니면 올린다. **서버 ② 적용 뒤에 배포한다.** 앞서 배포하면 가드가 되돌려 «서버 거부»가 쌓인다.

## 적용 순서 (운영 `jvtajoeptzfsdwizxejg`, 로그인된 SQL 편집기)

1. `20260930_role_alignment.preflight.sql`(읽기 전용)을 실행한다. 다음을 확인한다.
   - 세 함수가 모두 있다.
   - 줄 수: `ps_team_role` staff 1·admin 1, `ps_idp_can_view` staff 1·true 1, `ps_can_write_key` member_check 1.
   - 가드가 코치 피드백 키를 `ps_can_write_key` 로 보낸다.
   - 영향 인원(③)과 그중 최근 30일 쓰기 흔적(④), 코치 피드백 거부 기록(⑤)을 기록한다.
2. `20260930_role_default_player.sql` → `….verify.sql` 을 실행한다. 결과가 `role_default_player_verified` 여야 한다.
3. `20260930_idp_pub_write.sql` → `….verify.sql` 을 실행한다. 결과가 `idp_pub_write_verified` 여야 한다.
4. 앱 2.912 를 배포한다.
5. 되돌리기는 역순이다: `20260930_idp_pub_write.rollback.sql` → `20260930_role_default_player.rollback.sql`. 둘 다 표식이 붙은 줄만 원래대로 되돌린다.

## 로컬 검증

`node migrations/20260930_role_alignment.local-test.cjs`(`npm run test:sql` 에 포함)는 격리 메모리 PostgreSQL(PGlite)에서 매 동작마다 실제 `authenticated` 역할·JWT 문맥으로 확인한다. 확인 항목은 다음과 같다.
- 적용 전 문제 재현
- 적용 후 해결
- 다른 역할·함수·GRANT 유지
- 두 번 실행해도 안전함
- 정의가 예상과 다르면 아무것도 바꾸지 않고 멈춤
- 되돌리면 원래 정의와 글자까지 같음

픽스처(`…local-fixture.sql`)는 운영 카탈로그(2026-09-13)와 저장소 SQL 의 해당 함수·정책 모양을 재현한다. 가드는 판정 뼈대만 담았다. 운영 DB 에 실행하지 않는다.
