# 20261007_incident_ledger — 운영 적용 완료 (2026-10-07 23:3x KST)

사용자 «너가 직접해줘»(2026-10-07) 뒤, 로그인된 Supabase SQL 편집기(프로젝트 `jvtajoeptzfsdwizxejg`)에서 Claude 가 실행했다.
편집기에 넣은 SQL 은 저장소 파일과 **바이트 단위로 같음**을 확인했다(14,597바이트, SHA-256 `4b65852a…392c020`).
«Potential issue detected»(파괴적 작업 — REVOKE·CREATE OR REPLACE) 확인 뒤 실행 → «Success. No rows returned».

## 확인(verify)
`rls true · policies 0 · auth_select false · anon_select false · functions 5 · admin_secdef true · seeded 3`
심은 사고: loss 10/5 21:51(풋볼A) · restore 10/6 13:38(풋볼A) · restore 10/7 00:07(팀 없음).

## 화면
관리자(processstudio.netlify.app/admin.html, 판 2.959) 백엔드 탭: «0 일 / 56일 · 마지막 사고 10/7 00:07 뒤».
자동 감지 후보(14일): 풋볼A 10/6·10/5·10/2(복구한 사고) · 한양중 10/2(복구한 사고) · 김포축구센터 U-18 9/28(복구한 사고) ·
대구TDN_U9 9/27 선수 38→23→10 — **사고 아님**: 같은 시간대 선수 삭제 묘비 28개(코치 두 명의 의도한 명단 정리).

## 같은 자리에서 함께 한 것 (runbook 2·3)
- `update public.ps_guard_mode set enforce = true where id = 1` → `enforce now: true`
- `update public.ps_app_policy set min_build = '2.940', note = '2026-10-07 유료 전 문턱 — 2.941 이전 갇힘 판 차단' where id = 1` → `min_build now: 2.940`
- 직후 20분 거부 기록: 새 가드·판 하한에 걸린 사람 0. 원래 있던 «경기 날짜·상대가 최신 일정과 다름» 보류 2건(풋볼A u15·대구TDN_U9 기기, 10분 간격)만.

되돌리기: `20261007_incident_ledger.rollback.sql` · `update public.ps_guard_mode set enforce = false where id = 1;` · `update public.ps_app_policy set min_build = '2.880' where id = 1;`
