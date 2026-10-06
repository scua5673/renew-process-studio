-- 20261006_scout_record_guard 되돌리기 — 트리거와 함수를 지운다(데이터는 건드리지 않는다).
drop trigger if exists ps_00c_scout_record_guard_t on public.ps_kv;
drop function if exists public.ps_kv_scout_record_guard();
