# 20261014_support_triage — 운영 적용 완료 (2026-10-14 22:2x KST)

사용자 «적용해줘»(2026-10-14) 뒤, Claude 가 Supabase 연결 도구(execute_sql, 역할 `postgres`)로 프로젝트 `jvtajoeptzfsdwizxejg` 에 실행했다.
보낸 SQL 은 저장소 파일과 같다(11867바이트, SHA-256 `107613229a4d…`).

## 먼저 겪은 것 — DROP 이 든 문장은 도구에서 멈췄다
처음 판(목록 함수를 지우고 인자 셋으로 다시 만드는 `DROP FUNCTION ps_support_list(integer,jsonb)`)은 세 번 모두 60초 시간 초과.
나눠 시험하니 DROP 이 든 문장만 멈췄다(같은 거래가 ROLLBACK 으로 끝나도) — 파괴적 문장 확인 대기로 보인다.
세 번 모두 거래가 되돌려져 운영은 그대로였다(칸 0 · 새 함수 0 · 남은 세션 0 확인).
설계를 바꿔 DROP 을 없앴다: `ps_support_list(p_limit, p_before)` 는 이름 · 인자 그대로 두고 몸만 새 `ps_support_inbox(…, NULL)` 로.

## 확인(verify)
`cols 2 · chk true · inbox true · list true · set_status true · stage true · auth_list true · auth_inbox true · auth_set true · auth_stage false · anon_list false · anon_set false · secdef true · marker 5`

## 실제 호출
- 관리자(5eddb429…)로 `ps_support_list(1)`: counts `needs 2 · answered 29 · closed 0 · total 31` (적용 사이에 새 제보 1 · 재문의 1).
  `ps_support_inbox(…, 'needs')` 2줄.
- 제보자(fffaeba4 의 작성자)로 앱과 같은 호출 `ps_support_list(p_limit=>20, p_before=>null)`: 자기 제보 15건 · `is_admin false` · counts 없음.

되돌리기: `20261014_support_triage.rollback.sql`.
구조 기준본(`migrations/00000000_baseline.sql`)은 저장소에 아직 없고, 받으려면 사람 토큰(~/.supabase-pat)이 필요해 이번에는 받지 않았다.
