-- ════════════════════════════════════════════════════════════════════════
-- 20261006 · 선수단 기록 가드(ps_kv_scout_record_guard) — 서버 쪽 2.948
-- 왜: 옛 판 앱(2.947 이하)이 부팅할 때 «아직 불러오지 않은 기본 문서»를 선수단 본문(scout_tool_v1)으로 통째로 올려
--     가용인원 기록(statusRuns·participationDays)·작전판 카드 배치(tbCards·tbXY)가 지워졌다.
--     서버 이전 판 실측(풋볼A): 9/15·9/18·9/21·10/2·10/3·10/5·10/6 — 일곱 번, 전부 소유자 기기·앱이 새 판으로 다시 열리는 순간.
--     앱은 2.948 에서 막았지만, 아직 옛 판을 들고 있는 기기(아이폰·아이패드)는 열 때 옛 코드로 먼저 부팅한다.
-- 규칙(scout_tool_v1 의 UPDATE 만):
--   R1 기록 칸 — 서버 판의 meta 에 statusRuns·participationDays·injuryInfo 가 (비어 있지 않게) 있는데
--      새 판의 meta 에 그 칸 자체가 없으면 거부. 이 칸들은 앱에 지우는 경로가 없다 — 없어지는 것은 늘 사고다(2.948 앱 규칙과 같다).
--   R2 빈 뼈대 — 서버 판에 평가표(attrs)·포지션(positions)이 있는데 새 판에 둘 중 하나라도 없거나 비었으면 거부.
--   거부 = 서버 판을 그대로 둔다(return old) · 사유는 ps_kv_denied. 앱은 다음 회차에 서버 판을 받아 맞춘다(2.914).
-- 서버 기록 200판으로 미리 견줌: 위 일곱 번의 지움만 걸리고 정상 저장은 하나도 안 걸린다.
-- 재실행 안전. 끄기: 20261006_scout_record_guard.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.ps_kv_scout_record_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare o jsonb; n jsonb; k text; why text;
begin
  if new.k is distinct from 'scout_tool_v1' then return new; end if;
  begin o:=old.v::jsonb; n:=new.v::jsonb; exception when others then return new; end;
  if jsonb_typeof(o)<>'object' or jsonb_typeof(n)<>'object' then return new; end if;
  foreach k in array array['statusRuns','participationDays','injuryInfo'] loop
    if jsonb_typeof(o->'meta'->k)='object' and o->'meta'->k<>'{}'::jsonb
       and not (coalesce(n->'meta','{}'::jsonb) ? k) then
      why:='선수단 기록('||k||')이 빠진 저장을 막았어요 — 옛 판 앱이 부팅하며 빈 문서를 올린 것으로 보여요. 앱을 새로고침하면 팀 것으로 맞춰져요';
      exit;
    end if;
  end loop;
  /* 배열이 아니면 길이 0 으로 본다(jsonb_array_length 는 배열 아닌 값에서 오류를 낸다 — OR/AND 는 짧게 끊긴다는 보장이 없다) */
  if why is null
     and (case when jsonb_typeof(o->'attrs')='array' then jsonb_array_length(o->'attrs') else 0 end)>0
     and (case when jsonb_typeof(o->'positions')='array' then jsonb_array_length(o->'positions') else 0 end)>0
     and ((case when jsonb_typeof(n->'attrs')='array' then jsonb_array_length(n->'attrs') else 0 end)=0
          or (case when jsonb_typeof(n->'positions')='array' then jsonb_array_length(n->'positions') else 0 end)=0) then
    why:='평가표·포지션이 빈 선수단 저장을 막았어요 — 옛 판 앱이 부팅하며 빈 문서를 올린 것으로 보여요. 앱을 새로고침하면 팀 것으로 맞춰져요';
  end if;
  if why is null then return new; end if;
  begin perform public.ps_kv_note_denied(new.workspace_id, auth.uid(), new.k, why); exception when others then null; end;
  return old;
end $$;
drop trigger if exists ps_00c_scout_record_guard_t on public.ps_kv;
create trigger ps_00c_scout_record_guard_t before update on public.ps_kv
  for each row when (new.k = 'scout_tool_v1') execute function public.ps_kv_scout_record_guard();
