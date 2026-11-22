-- 20261122_support_context 되돌리기 — 읽기 전용 함수 둘을 지운다. 자료는 바뀌지 않는다.
-- 앱은 함수가 없으면 옆 칸의 «앞뒤 기록 · 같은 오류 · 고친 뒤» 상자와 목록 꼬리표를 조용히 숨긴다(제보 열기 · 답변은 그대로).
begin;
drop function if exists public.ps_support_context(uuid,integer);
drop function if exists public.ps_support_list_flags(uuid[]);
commit;
