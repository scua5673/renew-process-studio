# 20261014 — 관리자 작업 기록 보기 (SQL 편집기에서 실행)

## 왜

운영 함수를 열어 보니(2026-10-14) 팀 삭제 · 멤버 내보내기 · 콘텐츠 삭제/복구는 이미 `ps_admin_log` 로 `ps_admin_actions` 에 남기고 있었다.
기록이 0건인 것은 그런 작업을 아직 한 적이 없어서다. 빠진 것은 **읽는 곳** — 관리자 화면에서 «누가 언제 무엇을»을 볼 수 없었다.

## 바뀌는 것

- 읽기 함수 하나: `ps_admin_actions_list(p_limit, p_before_id)` — 관리자만. 최신순 50건씩.
  관리자 메일 · 작업 · 팀 이름(지운 팀은 기록 당시 이름) · 대상 이름(콘텐츠 · 제보 제목 · 커뮤니티 글 제목 · 내보낸 사람 메일, 80자) · meta.
- 표 · 기존 함수는 건드리지 않는다. 쓰기 없음.

## 실행 순서

1. `20261014_admin_actions_view.sql` 실행 → «Success».
2. `20261014_admin_actions_view.verify.sql` — 기대: `fn true · secdef true · auth_exec true · anon_exec false · marker true`.
3. 관리자 화면 «백엔드» 탭 «관리자 작업 기록» 판. 지금은 «아직 기록된 관리자 작업이 없어요».

## 되돌리기

`20261014_admin_actions_view.rollback.sql` — 함수만 지운다. 기록 표는 그대로.
