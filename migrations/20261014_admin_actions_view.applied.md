# 20261014_admin_actions_view — 운영 적용 완료 (2026-10-14 22:3x KST)

같은 방법(execute_sql, `postgres`)으로 실행. 저장소 파일과 같다(4562바이트, SHA-256 `935c327f5824…`).
적용 직전 «커뮤니티 신고 닫음»도 글 제목을 대상으로 잡도록 한 줄 고친 판이다(PGlite 시험 18 통과 뒤).

## 확인(verify)
`fn true · secdef true · auth_exec true · anon_exec false · marker true`

## 실제 호출
관리자로 `ps_admin_actions_list(5)`: `rows [] · next_before null` — 기록 0건(아직 관리자 삭제 작업이 없었다).

되돌리기: `20261014_admin_actions_view.rollback.sql`(함수만 지운다).
