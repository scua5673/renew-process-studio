-- 3.201 — 관리자 기기 현황 함수 둘 되돌리기. 자료 표는 건드리지 않았으므로 함수만 지운다.
-- admin.html 3.201 은 함수가 없으면 두 칸(«제보자 기기 현황» · «옛 판으로 도는 기기»)을 조용히 숨긴다 — 앱 판을 되돌릴 필요 없음.
begin;
drop function if exists public.ps_support_reporter_devices(uuid,integer);
drop function if exists public.ps_admin_stale_clients(integer,integer);
commit;
