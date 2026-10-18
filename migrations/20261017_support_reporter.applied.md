# 20261017_support_reporter — 운영 적용 완료 (2026-10-17 16:2x KST)

사용자 «지금 적용»(2026-10-17) 뒤, Claude 가 Supabase 연결 도구(execute_sql, 역할 `postgres`)로 프로젝트 `jvtajoeptzfsdwizxejg` 에 실행했다.
보낸 SQL 은 저장소 파일과 같다(9300바이트, SHA-256 `2e94c5c27b5f7439…`). 지우는 문장이 없어 도구에서 멈추지 않았다.

적용 전 확인: 운영의 `ps_support_inbox` · `ps_support_get` 정의가 저장소(20261014 · 20260915 판)와 같았다(pg_get_functiondef 비교).

## 확인(verify)
`reporter true · wired_inbox true · wired_get true · auth_reporter false · anon_reporter false · auth_inbox true · auth_get true · anon_inbox false · secdef true · marker 1 · triage_marker 5`

## 실제 호출(거래 안에서 부르고 ROLLBACK)
- 관리자(5eddb429…)로 `ps_support_inbox(5)`: `is_admin true` · 5줄 모두 `reporter`(이름 · 이메일 · 팀 1개).
- 제보자(33a9d4e2…)로 앱과 같은 호출 `ps_support_list(p_limit=>20,p_before=>null)`: 자기 제보 10건 · `is_admin false` · counts 없음 ·
  `reporter` 칸 0줄. 같은 계정의 `ps_support_get` 답에도 `reporter` · `reporter_id` 없음.

되돌리기: `20261017_support_reporter.rollback.sql`.
