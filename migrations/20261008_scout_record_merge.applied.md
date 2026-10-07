# 20261008_scout_record_merge — 운영 적용 완료 (2026-10-07 23:4x KST)

PR #296 → main `259e198` 뒤, 사용자 «너가 직접해줘»에 따라 로그인된 Supabase SQL 편집기에서 Claude 가 실행했다.
편집기에 넣은 SQL 은 저장소 파일과 바이트 단위로 같음(11,580바이트, SHA-256 `bd320584…7f192d8`).
«Potential issue detected»(자기 트리거 `DROP TRIGGER IF EXISTS`) 확인 뒤 실행 → «Success. No rows returned».

## 확인(verify)
- `merge_trigger O`
- 순서 `ps_00_lineage_guard_1644_t < ps_00a_build_guard_t < ps_00b_shape_guard_t < ps_00c_noop_guard_t < ps_00c_scout_record_guard_t < ps_00d_scout_record_merge_t`
- `secdef true · pure_fns 6 · runs_lost 2 · days_lost 1 · inj_lost 1 · keep_null true`

## 적용 전 운영 이력 대조(읽기 전용)
14일 `scout_tool_v1` 저장 728번(상태 기록이 바뀐 것 31번) 중 이 트리거가 끼어들었을 저장 1번 = 10/2 18:25 한양중
(9/29 에 멈춘 사본이 선수 2명의 9/30~10/2·10/1 기록과 출석 2일을 지운 실제 손실). 정상 저장 727번은 바이트 그대로.

되돌리기: `20261008_scout_record_merge.rollback.sql`.
