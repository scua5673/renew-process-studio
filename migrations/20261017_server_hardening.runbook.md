# 20261017 — 서버 문 잠그기 (Supabase 보안 · 성능 경고 넷)

## 왜

2026-10-17 Supabase 경고(Advisors)와 읽기 전용 조회로 확인한 것 가운데, **앱 동작은 그대로 두고 문만 잠그는** 넷이다.

| # | 경고 | 운영 상태(조회) | 위험 |
|---|---|---|---|
| ① | `function_search_path_mutable` 6 | `ps_build_lt` · `ps_key_scope` · `ps_kv_noop_guard` · `ps_request_build` · `ps_touch` · `ps_try_jsonb` 에 search_path 설정 없음 | 낮음 — 모두 SECURITY INVOKER, 본문은 내장 함수만. 경고 정리 |
| ② | `anon_security_definer_function_executable` | `ps_kv_note_denied(uuid,uuid,text,text)` 는 SECURITY DEFINER 인데 PUBLIC · anon · authenticated 가 실행 가능, **권한 확인 없음** | 중간 — publishable 키만 있으면 아무 팀 · 아무 사람 이름으로 «저장 거절» 기록(`ps_kv_denied`)을 쓰거나 덮을 수 있다. 관리자 «막힌 기기» · 사고 장부(20261007)가 이 표를 읽는다 |
| ③ | 같은 경고 30 | 관리자 RPC 29개(`ps_admin_*`) + `ps_audit_log()`(트리거 함수)를 anon 이 실행 가능 | 낮음 — 본문이 모두 관리자 확인(`ps_event_is_admin` 등)을 한다(2026-10-17 본문 확인). 문 앞에서 한 번 더 막는 이중 잠금 |
| ④ | `duplicate_index` | `ps_usage_day_user_feature_uidx` = `ps_usage_pkey` 와 같은 열 `(day,user_id,feature)` | 낮음 — 쓰기마다 색인 둘을 고친다 |

`ps_kv_note_denied` 를 부르는 곳(운영 조회): `ps_1644_lineage_guard` · `ps_kv_team_guard` · `ps_kv_build_guard` · `ps_kv_shape_guard` · `ps_kv_scout_record_guard` — 모두
SECURITY DEFINER · 소유자 postgres. 앱(`studio/*`)은 이 RPC 를 부르지 않는다(`ps_kv_denied` 는 읽기만). 그래서 클라이언트 역할의 실행 권한을 거둬도 거절 기록은 그대로 남는다.
관리자 화면(`admin.html` · `studio/admin-*.js`)은 로그인한 세션으로만 관리자 RPC 를 부른다 — authenticated 실행 권한은 그대로 둔다(명시 GRANT).

## 무엇을

- ① 여섯 함수에 `SET search_path = public`. 본문 · 권한 · 휘발성은 그대로.
- ② `ps_kv_note_denied` 에서 `PUBLIC` · `anon` · `authenticated` 실행 권한 회수, `service_role` 은 유지.
- ③ 목록의 30개에서 `PUBLIC` · `anon` 회수, `authenticated` · `service_role` 명시 GRANT(적용 전에도 모두 실행 가능했다 — 사전 점검이 확인).
  목록 밖 `ps_admin_*` 가 새로 anon 에게 열려 있으면 NOTICE 로 알리기만 한다.
- ④ `DROP INDEX ps_usage_day_user_feature_uidx`. `ON CONFLICT (day,user_id,feature)` 는 기본 키로 그대로 맞는다.

안 하는 것(따로 할 일): RLS 정책 24개의 `auth.uid()` → `(select auth.uid())`(정책 판정을 다시 시험해야 해서 별도 묶음), `ps_kv_history_hold_2948` ·
`ps_kv_restore_backup_2948`(2948 사고 증거 — 보관 기한을 정한 뒤), 그 밖의 SECURITY DEFINER 함수의 anon 권한(`ps_is_member` 처럼 RLS 정책 안에서 쓰는 것이 있어
하나씩 봐야 한다), 새 함수의 기본 권한(Supabase 기본값은 anon 에게도 준다 — 새 SECURITY DEFINER 함수는 만들 때 `REVOKE … FROM PUBLIC, anon` 을 같이 쓴다).

## 적용 (SQL 편집기, 사람이)

1. `20261017_server_hardening.preflight.sql` — 기대: `search_path_open 6 · note_denied_client_exec true · note_callers_not_definer 0 · admin_anon_exec 30 · admin_auth_exec 30 · dup_index_same_as_pkey true`.
   다르면 멈추고 무엇이 바뀌었는지 본다.
2. `20261017_server_hardening.sql` 전체 실행. 예상과 다르면 예외로 멈추고 아무것도 바뀌지 않는다(한 트랜잭션).
   `ps_usage` 색인 삭제가 그 표를 아주 잠깐 잠근다 — 사용 핑이 한순간 기다릴 뿐이다.
3. `20261017_server_hardening.verify.sql` — 기대: `server_hardening_verified`.
4. Advisors(Security · Performance)를 다시 읽어 위 경고가 빠졌는지 본다.
5. 관리자 화면(`admin.html`)을 로그인해 열고 운영 홈 · 오류 · 백엔드 건강 · 사람 탭이 뜨는지.
6. 다음 날: 관리자 «막힌 기기»와 `ps_kv_denied` 에 새 거절 기록이 평소처럼 쌓이는지(가드가 계속 기록한다는 확인):
   `select reason, count(*), max(at) from ps_kv_denied where at > now() - interval '1 day' group by 1;`
7. `.applied.md` 를 남기고 `node scripts/schema-baseline.mjs` 로 기준본을 새로 받아 같은 PR 에 넣는다.

앱 판과 순서는 상관없다 — 앱 코드는 바뀌지 않는다.

## 대시보드에서 (SQL 아님, 같은 날)

- Authentication › Sign In / Providers › Email › **Prevent use of leaked passwords** 켜기(`auth_leaked_password_protection`). 기존 비밀번호에는 영향 없고, 새로 정하거나 바꿀 때만 HaveIBeenPwned 로 확인한다.
- (선택) Database › Settings › Auth 연결 수를 고정 10 → 비율로(`auth_db_connections_absolute`). 인스턴스 크기를 올릴 때 같이.

## 되돌리기

`20261017_server_hardening.rollback.sql` — 적용 전 권한(일곱 함수만 PUBLIC 에도 열려 있었다) · search_path · 색인을 그대로 되살린다. 데이터는 건드리지 않는다.

## 시험

`migrations/20261017_server_hardening.local-test.cjs`(합성 PGlite — 운영과 같은 ACL 모양, 여섯 함수는 운영 원문):
적용 전 anon 이 관리자 RPC 본문까지 닿고 거절 기록을 꾸밀 수 있음 · 적용 뒤 anon 은 문 앞에서 거절 · 로그인한 관리자는 30개 모두 그대로 · 비관리자는 안쪽 확인에서 멈춤 ·
SECURITY DEFINER 가드는 계속 거절을 기록 · 여섯 함수의 결과와 트리거 동작 그대로 · upsert 그대로 · 두 번 실행 안전 · 되돌리기는 권한 · 설정 · 색인을 바이트까지 같게 ·
예상과 다른 운영 넷(정의자 아닌 호출자 · 다른 search_path · authenticated 가 못 부르는 관리자 함수 · 같지 않은 «중복» 색인)에서는 아무것도 바꾸지 않고 멈춤.
`npm run test:sql` 에 포함.
