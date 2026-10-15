-- 20261015_share_get — 링크 공유(ps_share)를 «아는 id 한 건»으로만 읽게 한다
-- ---------------------------------------------------------------------------
-- 문제: 짧은 공유 링크(/s/<id>)는 익명 키로 테이블을 직접 읽었다(app.html __shareBoot: GET /rest/v1/ps_share?id=eq.<id>).
--       RLS 조건은 요청의 id 필터를 볼 수 없으므로, 익명이 한 행을 읽을 수 있으면 같은 키로 필터 없이 **모든 공유본**을 내려받을 수 있었다
--       (2026-10-14 보안 점검 SEC-4). 팀이 «링크를 아는 사람만»으로 보낸 작전판·훈련·주간 일정이 공개 목록이 된다.
-- 고침: ① ps_share_get(p_id) — id 형식(소문자·숫자 6~16자)을 검사하고 그 한 건의 v 만 돌려준다(SECURITY DEFINER · search_path 고정).
--       ② 테이블 SELECT 를 anon·authenticated 에서 회수한다. 올리기(INSERT, Prefer: return=minimal)는 SELECT 가 필요 없어 그대로 된다.
--       3.051 앱은 RPC 를 먼저 부르고, 함수가 없을 때(이 파일 적용 전)만 옛 GET 으로 돌아간다 — 적용 순서와 상관없이 링크가 열린다.
-- 하지 않은 것: 만료·작성자 삭제(테이블 열이 저장소에 없다 — 운영 열을 확인한 뒤 따로). 런북 참고.
-- 재실행 안전. 되돌리기: 20261015_share_get.rollback.sql
-- ---------------------------------------------------------------------------
BEGIN;

DO $pre$
BEGIN
  IF to_regclass('public.ps_share') IS NULL THEN RAISE EXCEPTION '20261015_share_get: public.ps_share 가 없습니다 — 아무것도 바꾸지 않았습니다'; END IF;
END $pre$;

CREATE OR REPLACE FUNCTION public.ps_share_get(p_id text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE out_v text;
BEGIN
  IF p_id IS NULL OR p_id !~ '^[a-z0-9]{6,16}$' THEN RETURN NULL; END IF;
  SELECT s.v INTO out_v FROM public.ps_share s WHERE s.id = p_id LIMIT 1;
  RETURN out_v;
END
$fn$;
REVOKE ALL ON FUNCTION public.ps_share_get(text) FROM PUBLIC;
DO $grant$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ps_share_get(text) TO anon';
    EXECUTE 'REVOKE SELECT ON TABLE public.ps_share FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ps_share_get(text) TO authenticated';
    EXECUTE 'REVOKE SELECT ON TABLE public.ps_share FROM authenticated';
  END IF;
END $grant$;
REVOKE SELECT ON TABLE public.ps_share FROM PUBLIC;

COMMIT;
