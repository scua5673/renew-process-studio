# 선수단 기록 가드 — 운영 적용 완료 (2026-10-06 13:35 KST)

운영 프로젝트 `jvtajoeptzfsdwizxejg` 에 로그인된 Supabase SQL 편집기에서 적용했다(사용자 승인 «추천대로 둘 다 해줘»).

## 왜
사용자 «선수단 작전판에서 RW 로 몇 번을 바꿨는데 적용이 안 돼». 서버 이전 판(ps_kv_history)으로 확인한 사실:
RW 변경은 매번 서버까지 저장됐다(10/5 22:10 직전 판·10/6 13:02 직전 판에 RW 카드가 있다). 그 직후 **앱이 새 판으로 다시 열리며**
옛 판(2.947 이하)의 부팅 버그가 «아직 불러오지 않은 기본 문서»를 `scout_tool_v1` 로 통째로 올려 카드 배치(tbCards·tbXY)와
가용인원 기록(statusRuns·participationDays)을 지웠다. 앱은 2.948 에서 고쳤지만, 옛 판을 들고 있는 기기(이 계정의 아이폰 2.940·아이패드 2.935)는
열 때 옛 코드로 먼저 부팅한다 — 서버에서도 막는다.

## 무엇이 바뀌었나
함수 `ps_kv_scout_record_guard()` + 트리거 `ps_00c_scout_record_guard_t`(BEFORE UPDATE, `k='scout_tool_v1'` 만). 데이터·정책·다른 트리거는 그대로.
- R1 서버 판 meta 에 statusRuns·participationDays·injuryInfo 가 (비어 있지 않게) 있는데 새 판에 그 칸이 없으면 거부
- R2 서버 판에 평가표·포지션이 있는데 새 판에 둘 중 하나라도 없거나 비었으면 거부
- 거부 = `return old`(cupd 그대로 → 앱이 거부로 알아본다) + `ps_kv_denied` 사유. 2.681 모양 가드와 같은 방식.

## 사전 점검(읽기 전용)
- ps_kv BEFORE 트리거: `ps_00_lineage_guard_1644_t · ps_00a_build_guard_t · ps_00b_shape_guard_t · ps_00c_noop_guard_t` 다음에 선다. noop 가드는 같은 원문일 때 cupd 를 유지하고, `ps_kv_touch` 는 updated_at 만 바꾼다 — 거부 때 cupd 가 그대로라 앱이 알아본다.
- `ps_kv_note_denied(p_wid uuid, p_uid uuid, p_k text, p_reason text)` 있음 · `ps_kv.workspace_id` uuid.
- 풋볼A 서버 기록 200판(9/14~10/6)에 규칙을 견줌: 지움 일곱 번(9/15·9/18·9/21·10/2·10/3·10/5·10/6)만 걸리고 정상 저장은 0건.
- 판 하한(ps_app_policy.min_build)을 2.948 로 올리는 안은 버렸다 — 48시간 안에 2.940 을 쓴 사람이 82명이라 다른 팀 저장까지 막힌다.

## 적용·확인
1. `20261006_scout_record_guard.sql` → `Success. No rows returned`(편집기의 «파괴적 작업» 경고는 `drop trigger if exists` 때문 — 없던 트리거라 지운 것 없음).
2. 확인 질의 → 트리거 `ps_00c_scout_record_guard_t:O` · secdef true · note_fn 1.
3. 아래 복구 뒤 운영 문서로 실측(예외로 끝나 전부 되돌려지는 DO 블록): 기록 칸을 지운 저장 → `rejected=t runs_kept=t card2=pos_RW tbXY=1 record_days=12`.
4. 격리 PGlite 시험 28개(`20261006_scout_record_guard.local-test.cjs`, `npm run test:sql` 에 포함).

## 같이 한 복구(풋볼A, 1회성 — 저장소에 SQL 은 넣지 않음: 선수 부상 메모가 들어 있다)
2.948 복구 SQL(10/5 까지 다섯 판에서 모은 기록)을 보완해 한 번에 실행 — 서버 이전 판 111077(10/6 13:02 직전)의 오늘 기록 8명·출석 정정 1일,
작전판 카드 RW(CB 자리)와 좌표까지. 결과: statusRuns 71명 · 런 136개(중복 0) · 기록일 12 · 카드 2번째 `pos_RW` · 선수 47명 그대로 · cupd 13:38 KST.
⚠ 끊긴 날(9/16·9/19~21·10/3~4)은 원래 기록이 없어 «기본 참여»로 남는다.

## 되돌리기
`20261006_scout_record_guard.rollback.sql` — 트리거와 함수만 지운다.
