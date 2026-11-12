# 20261110_invite_hardening — 운영 적용 기록

- 적용: 2026-11-11, Supabase 대시보드 SQL 편집기, 소유자가 직접 실행(«돌렸어»). 검증은 같은 날 읽기 전용 조회로.
- 무엇: 초대 코드 · 합류 · 멤버 이메일(보안 점검 1 · 2 · 3번) — 함수 아홉 개 다시 만듦 · 새 함수 셋 · 표 `ps_join_attempts` · 정책 `inv_sel`.
- 앱 판: 실서버 3.280(이 묶음은 앱 코드를 바꾸지 않는다).

## 사전 점검(적용 전, `20261110_invite_hardening.preflight.sql` — 2026-11-10)
| 항목 | 값 |
|---|---|
| guard_enforce | true |
| inv_sel | `ps_is_member(workspace_id)` |
| applied_functions | 0 |
| live_codes | 13 |
| live_staff_exec_codes(이 적용에서 만료될 수) | 0 |
| codes_without_expiry | 0 |
| live_short_codes(옛 8자) | 13 |
| live_codes_new_join_cannot_match | 0 |
| teams_without_perms_doc | 97 |
| teams_default_role_not_player | 5 |
| member_email_differs_from_auth | 48 |
| member_email_is_a_name | 206 |
| perms_denials_30d | 48 |

`response.status`(PostgREST 가 400 을 내보내는가)는 적용 전에 임시 함수(`_ps_status_probe_20261110`, anon 실행 · `set_config('response.status','400',true)` · `return null`)를 만들어
publishable 키로 불러 확인했다 — HTTP 400 · 본문 `null`. 임시 함수는 확인 뒤 지웠다(남은 것 0).

## 적용 · 확인
- `20261110_invite_hardening.sql` 실행 — 오류 없음.
- 함수 열두 개의 `md5(prosrc)` 가 저장소 파일의 본문과 모두 같다(붙여 넣다 잘린 곳 없음).
- 적용 뒤: `applied_functions 12` · `inv_sel ps_is_owner(workspace_id)` · `ps_join_attempts` 있음(RLS 켬 · authenticated 읽기 불가) · 안쪽 함수 `ps_invite_code` anon 실행 불가 ·
  `ps_join` · `ps_bootstrap` · `ps_create_team` · `ps_get_or_create_role_invite` authenticated 실행 가능 · `codes_without_expiry 0` · `live_codes 13` · `live_staff_exec_codes 0` ·
  가드 강제 모드 그대로 · 가드 트리거 둘 켜짐 · 새 코드 모양 `^[0-9A-HJKMNP-TV-Z]{12}$`.
- 동작(한 트랜잭션 · ROLLBACK): 가짜 계정(`request.jwt.claims.sub`)으로 `ps_join('ZZZZZZZZZZZZ')` → `null` · `response.status 400` · `ps_join_attempts.fails 1`. 되돌린 뒤 `ps_join_attempts` 0줄.
- 적용 뒤 30분: `ps_kv_denied`(권한 문서) 0줄 · `sync_failed` / `workspace_switch_failed` 0줄.

## 하지 못한 것
- runbook 5단계의 앱 확인(시험 계정 둘로 초대 코드 만들기 · 틀린 코드 · 맞는 코드 · 선수 계정으로 `ps_invites` 읽기 `[]`)은 시험 계정이 없어 하지 않았다 — 위 SQL 확인으로 대신했다.
- 기준본(`00000000_baseline.sql`) 갱신: `node scripts/schema-baseline.mjs` 는 `~/.supabase-pat` 이 필요해 이 환경에서 못 돌렸다. **다음 일** — 토큰이 있는 기기에서 받아 PR 로.
  그 전까지 기준본은 이 묶음 이전 모습이다(둘째 묶음 `20261110_privacy_limits` 의 사전 점검은 운영 본문을 직접 보므로 영향 없음).
- 다음 날 볼 것(runbook 6): `select count(*), max(at) from ps_kv_denied where k='cs_perms_v1' and reason like '권한은 운영진만%' and at > now() - interval '1 day';`
  · `select count(*) filter (where locked_until > now()) locked, count(*) rows from ps_join_attempts;`

## 되돌리기
`20261110_invite_hardening.rollback.sql`(함수 아홉 · 정책을 기준본 글자 그대로, 새 함수 셋 · `ps_join_attempts` 삭제). `20261110_privacy_limits` 가 적용돼 있으면 그 묶음을 먼저 되돌린다.
