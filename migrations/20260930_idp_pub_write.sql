-- 20260930_idp_pub_write — 코치 피드백 문서(cs_idp_pub_v1_<uid>) 쓰기는 IDP 열람 규칙으로
-- ---------------------------------------------------------------------------
-- 문제: 이 문서의 읽기·쓰기 RLS(kv_*_pub)는 ps_idp_can_view(코치·스태프·임원)로 판정한다.
--       그런데 쓰기 가드 트리거(ps_kv_team_guard)의 «나머지 팀 자료» 분기가 ps_can_write_key 를 부르고,
--       ps_key_scope 는 정확한 이름 'cs_idp_pub_v1' 만 알아서 실제 키(cs_idp_pub_v1_<uid>)를 'board' 로 본다.
--       그래서 가드가 켜져 있으면(ps_guard_mode.enforce) 보기 전용 코칭스태프의 코치 목표·반응·리뷰가
--       거부된다(UPDATE 는 서버 값으로 되돌림). 앱은 같은 키를 'team' 으로 봐서 규칙이 셋으로 갈라져 있었다.
-- 고침: ps_can_write_key 첫머리(구성원 확인 바로 뒤)에 한 줄 — 이 키면 ps_idp_can_view 로 판정한다.
--       RLS 와 가드가 같은 판정을 쓰게 된다. 다른 키의 판정은 한 글자도 안 바뀐다.
--       (kv_*_nonidp 정책은 이 키를 이미 제외하므로 정책 쪽 결과는 달라지지 않는다)
-- 안전장치: 끼울 자리(구성원 확인 줄)가 정확히 한 번이어야 한다. 표식 ps-20260930-idp-pub-write 가 있으면 건너뛴다.
-- 되돌리기: 20260930_idp_pub_write.rollback.sql
-- ---------------------------------------------------------------------------
BEGIN;
DO $migration$
DECLARE d text; nd text; n int;
  anchor constant text := $re$(if\s+not\s+public\.ps_is_member\s*\(\s*wid\s*\)\s+then\s+return\s+false\s*;\s*end\s+if\s*;)$re$;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'));
  IF d IS NULL THEN RAISE EXCEPTION '20260930 idp_pub: ps_can_write_key 가 없습니다'; END IF;
  IF to_regprocedure('public.ps_idp_can_view(uuid)') IS NULL THEN RAISE EXCEPTION '20260930 idp_pub: ps_idp_can_view 가 없습니다'; END IF;
  IF position('ps-20260930-idp-pub-write' in d) > 0 THEN RAISE NOTICE '20260930 idp_pub: 이미 적용됨 — 건너뜀'; RETURN; END IF;
  SELECT count(*) INTO n FROM regexp_matches(d, anchor, 'gi');
  IF n <> 1 THEN RAISE EXCEPTION '20260930 idp_pub: 끼울 자리가 %개입니다(1개여야 함) — 아무것도 바꾸지 않았습니다', n; END IF;
  nd := regexp_replace(d, anchor, E'\\1\n  if left(key,14) = ''cs_idp_pub_v1_'' then return public.ps_idp_can_view(wid); end if;  /* ps-20260930-idp-pub-write */', 'i');
  EXECUTE nd;
  RAISE NOTICE '20260930 idp_pub: 적용';
END
$migration$;
COMMIT;
