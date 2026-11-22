# 20261122_support_context — 적용 순서

무엇: 관리자 «오류 제보» 화면용 읽기 전용 함수 둘. 표 변경 없음 · 추가 전용 · 멱등(`create or replace`).

- `ps_support_context(p_report_id, p_minutes)` — 제보 하나의 사정: 제보 앞뒤 기록 · 저장 대기 · 같은 오류를 겪은 사람 수 · «고친 판»을 받았는지.
- `ps_support_list_flags(p_ids)` — 목록 꼬리표: 제보 무렵의 판 · «고친 판»을 받았는지(마흔 개까지).

읽는 것: `ps_events` 의 시각 · 이벤트 이름 · 화면 · 기기 종류 · 판 번호 · 오류 이름 · 상태, `ps_sync_reports` 의 대기 수.
읽지 않는 것: `ps_events.meta` 본문, 팀 자료, IDP · 일지 · 보관함, 같은 오류를 겪은 다른 사람의 신원(수만 센다).

앱과의 순서: **어느 쪽이 먼저여도 안전하다.** 함수가 없으면 앱은 옆 칸의 그 상자와 목록 꼬리표를 숨긴다(제보 열기 · 답변 · 기기 현황은 그대로).

1. 사전 점검(읽기): `select proname from pg_proc where proname in ('ps_is_admin','ps_support_reporter_devices');` 둘 다 있어야 한다.
2. 적용: `20261122_support_context.sql` 전체를 SQL 편집기에서 실행(Supabase MCP `apply_migration` 으로 넣을 때는 바깥 `begin;`/`commit;` 을 뺀다).
3. 검증: `.verify.sql` ① 권한, ② 관리자 호출, ③ 비관리자 거부.
4. 화면 확인: 관리자 › 오류 제보 › 제보 하나 — 오른쪽 칸에 «제보 앞뒤 30분»이 보이고, «고친 판»을 적은 제보의 목록 줄에 «고친 판 받음» 또는 «아직 3.xxx»가 붙는다.
5. 되돌리기: `.rollback.sql`. 앱 판은 그대로 둔다.
6. `.applied.md` 를 남긴다.

속도: 두 함수 모두 제보자 한 사람의 `ps_events` 를 시각으로 좁혀 읽는다. «같은 오류» 집계만 모든 사람의 8일치 오류 줄(`status='error'`)을 오류 이름으로 읽는다 —
느리면(관리자 화면에서 옆 칸이 늦게 뜨면) `ps_events(error_code, created_at) where status='error'` 부분 색인을 따로 더한다(이 묶음에는 넣지 않았다 — 운영 크기를 재지 않았다).

local-test: `migrations/20261122_support_context.local-test.cjs`(기준본을 PGlite 에 올려 모양 · 권한 · 창 경계 · 고친 판 판정 · 되돌리기). `npm run test:sql` 에 저절로 들어간다.
