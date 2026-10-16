# 20261017_server_hardening — 운영 적용 (2026-10-17 01:2x KST) · ①②③ 완료, ④ 남음

Supabase MCP `apply_migration`(`postgres`)으로 세 조각으로 나눠 실행했다. `execute_sql` 로 파일 전체를 한 번에 보내면 도구가 DB 에 닿기 전에
60초 시간 초과로 끊겼다(두 번 — 그때마다 운영 상태가 그대로인 것을 확인했다). `supabase_migrations` 에 이름 셋이 남는다:
`20261017_server_hardening_1_search_path` · `…_2_grants` · `…_3_dup_index`(③ 은 아래처럼 실행되지 않았다).
각 조각은 `20261017_server_hardening.sql` 의 같은 부분(확인 → 바꾸기)을 그대로 옮기고 `SET LOCAL lock_timeout = '5s'` 만 더했다.

## 사전 점검(preflight)
`search_path_open 6 · note_denied_client_exec true · note_callers_not_definer 0 · admin_anon_exec 30 · admin_auth_exec 30 · dup_index_same_as_pkey true` — 기대와 같다.

## 확인
- ① `search_path=public` 6/6. `ps_build_lt('3.9','3.10') = true` · `ps_key_scope('sq:x') = team` · `ps_try_jsonb('bad') = {}` — 결과 그대로.
- ② `ps_kv_note_denied`: anon · authenticated · PUBLIC 실행 false, service_role true. 가드 소유자(postgres)는 실행 가능.
- ③ 목록의 관리자 함수를 anon 이 실행할 수 있는 수 0(적용 전 30). authenticated 가 실행할 수 있는 `ps_admin_*` 42개(그대로).
- Advisors: `function_search_path_mutable` 사라짐, `anon_security_definer_function_executable` 72 → 41(관리자 · note_denied 0건).

## 실제 호출(트랜잭션 안에서, 끝나고 ROLLBACK)
- anon → `ps_admin_users()`: `permission denied for function ps_admin_users`
- anon → `ps_kv_note_denied(…)`: `permission denied for function ps_kv_note_denied`
- 로그인한 비관리자 → `ps_admin_users()`: `admin only`(안쪽 확인)
- 로그인한 비관리자 → `ps_kv_note_denied(…)`: `permission denied`
- 로그인한 관리자 → `ps_admin_health` · `ps_admin_users` · `ps_admin_workspaces` · `ps_admin_usage_summary` · `ps_admin_event_summary_v2`: 모두 통과

## 남은 것
- ④ `DROP INDEX public.ps_usage_day_user_feature_uidx` — 도구가 삭제 문장을 사람 확인 뒤에만 돌려 실행되지 않았다(운영 색인 그대로, 대기 작업 없음).
  사람이 SQL 편집기에서 `20261017_server_hardening.sql` 전체를 다시 실행하면 된다(①②③ 은 이미 된 상태라 그대로 지나가고 ④ 만 한다) → `verify.sql` → `server_hardening_verified`.
- 다음 날: `select reason, count(*), max(at) from ps_kv_denied where at > now() - interval '1 day' group by 1;` — 가드 거절 기록이 평소처럼 쌓이는지(적용 직전 하루 9건).
- 대시보드: Authentication › «Prevent use of leaked passwords» 켜기.
- 기준본: `migrations/00000000_baseline.sql` 은 아직 운영에서 받은 적이 없다(`~/.supabase-pat` 없음 — baseline runbook «기록»). 토큰이 생기면 `node scripts/schema-baseline.mjs`.

되돌리기: `20261017_server_hardening.rollback.sql`.
