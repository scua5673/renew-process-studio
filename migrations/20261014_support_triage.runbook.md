# 20261014 — 오류 제보 처리 상태 (SQL 편집기에서 실행)

## 왜

2026-10-14 기준 제보 30건이 모두 `status = 'open'` 이다. 30건 모두 운영자 답변이 달려 있지만 닫는 길이 없었다.
새 제보 · 답변만 한 제보 · 고쳐서 배포한 제보가 구분되지 않아, 답변 안 한 1건(`fffaeba4`)을 SQL 로 찾아야 했다.

## 바뀌는 것

- `ps_support_reports` 에 칸 두 개: `fixed_in`(고친 판, `3.029` 꼴) · `closed_at`. 기존 행은 둘 다 비어 있다.
- `ps_support_list(p_limit, p_before, p_filter)` — 옛 `(p_limit, p_before)` 를 지우고 셋째 인자(기본 NULL)를 단 판으로 바꾼다.
  앱(support.js)은 이름 인자 `p_limit · p_before` 로 부르므로 그대로 된다. 줄마다 `stage`(needs · answered · closed) ·
  `has_admin_reply` · `last_role` · `fixed_in` · `closed_at` 이 붙고, 관리자에게는 `counts`(단계별 수)가 붙는다.
- `ps_support_set_status(p_report_id, p_status, p_fixed_in)` — 관리자만. 바뀐 경우에만 `ps_admin_actions` 에 `support_status` 로 남긴다.
- `ps_support_reply` — 제보자가 닫힌 제보에 글을 쓰면 다시 연다. 그 밖의 동작은 같다.
- 제보 본문 · 진단 · 답변 내용은 건드리지 않는다.

## 실행 순서

1. `20261014_support_triage.sql` 전체 실행 → «Success».
2. `20261014_support_triage.verify.sql` 실행. 기대:
   `cols 2 · chk true · list_new true · list_old false · set_status true · stage true · auth_list true · auth_set true · auth_stage false · anon_list false · anon_set false · secdef true · marker 4`
3. 읽기 확인(관리자 화면 대신):
   ```sql
   select (select public.ps_support_stage(id,status)->>'stage') stage, count(*) from public.ps_support_reports group by 1;
   ```
   2026-10-14 읽기 전용 실측(같은 판정을 SQL 로): `answered 30` — 30건 모두 마지막 글이 운영자다. 그 뒤 새 제보가 들어왔으면 그만큼 `needs`.
4. 관리자 화면 «오류 제보»: «답변 필요 · 답변함 · 닫힘 · 전체» 탭과 줄마다 상태 글자. 이미 고쳐 배포한 제보는
   열어서 고친 판을 적고 «닫기».

클라이언트(admin.html · studio/admin-support.js)는 SQL 이 없으면 예전 접수함 그대로다 — SQL 을 먼저 깔아도, 나중에 깔아도 된다.

## 되돌리기

`20261014_support_triage.rollback.sql` — 목록 · 답변 함수를 20260915 판으로, 상태 바꾸기 · 단계 함수는 지운다.
`fixed_in · closed_at` 칸과 값은 남긴다(옛 함수는 읽지 않는다). 칸까지 지우는 줄은 파일 맨 아래 주석에 있다.
