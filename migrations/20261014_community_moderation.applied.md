# 20261014_community_moderation — 운영 적용 완료 (2026-10-14 22:3x KST)

같은 방법(execute_sql, `postgres`)으로 실행. 저장소 파일과 같다(10748바이트, SHA-256 `5117400907c3…`).
처음 판의 `DROP POLICY/CREATE POLICY` · `DROP TRIGGER/CREATE TRIGGER` 는 support_triage 와 같은 까닭으로
`ALTER POLICY` · `CREATE OR REPLACE TRIGGER`(Postgres 17.6)로 바꾼 뒤 실행했다.

## 확인(verify)
`cols 5 · trig true · sel_hides true · funcs 3 · secdef true · auth_exec true · anon_exec false · guard_exec false`
정책 `comm_sel` 역할 `{anon,authenticated}` 그대로.

## 실제 호출
- 비로그인(anon)으로 `ps_community where deleted=false`: 32 — 적용 전과 같다(숨긴 글 0).
- 관리자로 `ps_admin_comm_queue(50)`: `open_reports 2 · reported_posts 2 · hidden_posts 0`.

되돌리기: `20261014_community_moderation.rollback.sql`(정책을 예전으로 — 숨긴 글이 다시 보인다).
