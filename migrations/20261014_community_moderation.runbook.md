# 20261014 — 커뮤니티 신고함 · 글 숨기기 (SQL 편집기에서 실행)

## 왜

앱의 «신고»는 `ps_comm_reports` 에 쌓이기만 했다(2026-10-14 기준 2건 — 8/2 «4vs4 halfspace game»(공개 중) 익명 1 · 7/14 이미 지운 글 1).
관리자 화면에서 읽는 곳도, 관리자가 글을 내릴 길도 없었다(지우기 정책은 글 주인만).

## 바뀌는 것

- `ps_community` 에 `hidden_at · hidden_by · hidden_reason`, `ps_comm_reports` 에 `resolved_at · resolved_by`. 기존 행은 모두 비어 있다.
- 읽기 정책 `comm_sel`: `NOT deleted` → `NOT deleted AND hidden_at IS NULL`. 숨긴 글은 모두에게(올린 사람 포함) 안 보인다.
- 트리거 `ps_comm_moderation_guard_t` — 숨김 칸은 관리자 함수만 바꾼다. 앱 계정의 PATCH(글 고치기) · INSERT(올리기)는 그 칸을 무시한다.
  조회 · 좋아요 · 담기 숫자 함수는 그대로 된다.
- 관리자 함수: `ps_admin_comm_queue` · `ps_admin_comm_hide` · `ps_admin_comm_resolve` → `ps_admin_actions` 에 남긴다.
- 신고 받기(`commrep_ins`)와 글 본문은 건드리지 않는다.

## 실행 순서

1. `20261014_community_moderation.sql` 실행 → «Success». 편집기의 «Potential issue»(정책 DROP/CREATE)는 내용을 보고 실행.
2. `20261014_community_moderation.verify.sql` — 기대:
   `cols 5 · trig true · sel_hides true · funcs 3 · secdef true · auth_exec true · anon_exec false · guard_exec false`
3. 앱의 커뮤니티를 한 번 열어 글이 그대로 보이는지(숨긴 글이 없으니 같아야 한다).
4. 관리자 화면 «커뮤니티» 탭: 열린 신고 2건. 공개 중인 글은 보고 «글 숨기기» 또는 «문제 없음 · 신고 닫기», 지운 글은 «신고 닫기».

## 되돌리기

`20261014_community_moderation.rollback.sql` — 정책을 예전으로(⚠ 숨긴 글이 다시 보인다), 트리거 · 함수를 지운다. 칸과 값은 남긴다.
