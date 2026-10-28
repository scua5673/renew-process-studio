# 20261028_admin_client_versions — 적용 순서

무엇: 관리자 화면용 읽기 전용 함수 둘(`ps_support_reporter_devices` · `ps_admin_stale_clients`). `ps_events` 의 판 번호 · 기기 종류 · 이벤트 이름 · 횟수만 모아 준다. 표 변경 없음 · 추가 전용 · 멱등(`create or replace`).

1. 사전 점검(읽기): `select proname from pg_proc where proname in ('ps_is_admin','ps_support_reporter');` 둘 다 있어야 한다.
2. 적용: `20261028_admin_client_versions.sql` 전체를 SQL 편집기에서 실행(Supabase MCP `apply_migration` 으로 넣을 때는 바깥 `begin;`/`commit;` 을 뺀다 — 도구가 트랜잭션을 감싼다).
3. 검증: `.verify.sql` ① 권한, ② 관리자 호출, ③ 비관리자 거부.
4. 화면 확인: 관리자 › 운영 홈 «옛 판으로 도는 기기» 카드에 표가 보이고, 제보를 열면 «제보자 기기 · 최근 7일» 줄이 보인다. 함수가 없으면 두 칸은 숨는다(오류 없음).
5. 되돌리기: `.rollback.sql`. 앱 판은 그대로 둔다.

local-test: PGlite 묶음은 만들지 않았다 — 두 함수는 `auth.uid()` · `ps_is_admin()` 에 기대는 집계 쿼리라 운영 검증(위 ②③)으로 갈음했다. 다음에 같은 모양의 함수를 더하면 `tests/sql/` 에 집계 모양 시험을 함께 둔다.
