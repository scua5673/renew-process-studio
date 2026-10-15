# 20261015 — 선수에게 팀원의 일일 몸 상태를 내려 주지 않기 (cs_idp_daily_v1 · cs_idp_pub_v1)

## 왜

`ps_can_read_key` 는 «선수가 못 보는 키»를 **차단목록**으로 든다(선수단 · 스쿼드 · 미팅 · 경기 · 경기 명단).
코치가 적는 선수별 부상·재활·불참 상태 `cs_idp_daily_v1` 은 그 목록에 없어, 선수 계정이 평소 동기화만으로
**팀원 전체의 몸 상태**를 받았다(2026-10-14 보안 점검 SEC-3 — 로컬 PGlite 로 확인). 미성년 선수의 건강 정보이고,
`security.html` 의 «선수끼리는 서로 볼 수 없음»과 어긋난다. 접미사 없는 옛 `cs_idp_pub_v1` 도 같은 이유로 열려 있었다.

## 무엇을

- 라이브 `ps_can_read_key(uuid,text)` 정의를 읽어 차단목록에 `'cs_idp_daily_v1','cs_idp_pub_v1'` 두 키만 더한다(표식 `ps-20261015-player-daily-blind`).
- 함수의 다른 줄·SECURITY DEFINER·search_path·GRANT·소유자·정책·데이터는 그대로다.
- 앱(3.038)의 같은 목록 `studio/sync.js PLAYER_BLIND` 에도 `cs_idp_daily_v1` 을 더했다 — 선수 기기는 이 키를 받지도, 갖고 있지도 않는다.
  (`cs_idp_pub_v1` 은 앱이 동기화하지 않는 옛 키라 서버 목록에만 넣는다.)
- 선수 화면도 이 키의 **본인 칸**을 읽는다 — IDP 일정의 «코치 확인 · 부상/재활…» 표시(`idp.html` rCal → coachStatus).
  그래서 같은 마이그레이션이 `ps_idp_daily_mine(wid)` 를 만든다: 같은 문서에서 `auth.uid()` 칸만 `{v:1,days:{날짜:{uid:기록}}}` 로 돌려준다
  (SECURITY DEFINER · search_path 고정 · PUBLIC/anon 회수 · authenticated 만). 3.038 앱은 선수일 때 `PSSync.idpDailyMine()` 으로 부르고,
  그 결과만 이 기기의 `cs_idp_daily_mine_v1`(동기화하지 않는 키)에 둔다. 키를 다시 여는 쪽으로 가지 않는다.

## 적용 (SQL 편집기, 사람이)

1. `20261015_player_daily_blind.sql` 전체 실행. «차단목록이 예상과 다릅니다»로 멈추면 운영 정의가 저장소 원문과 달라진 것이다 —
   `select pg_get_functiondef(to_regprocedure('public.ps_can_read_key(uuid,text)'))` 를 읽고 이 파일의 `p_list` 를 맞춘 뒤 다시 실행한다. 멈춘 경우 아무것도 바뀌지 않았다.
2. `20261015_player_daily_blind.verify.sql` — 기대: `player_daily_blind_verified`.
3. 선수 계정으로 로그인한 기기에서 앱 설정 › 데이터 › 저장 확인이 깨끗한지(선수 기기가 이 키를 올리려던 적은 없다 — 쓰기 가드가 먼저 막는다).
4. 다음 날: 관리자 오류 탭에 `sync_server_rejected` 가 `cs_idp_daily_v1` 로 늘지 않았는지.

순서: **서버를 먼저 적용한다**(3.038 를 main 에 올리기 전). 앱이 먼저 깔리면 선수 기기는 `ps_idp_daily_mine` 이 없어(404) 그동안 «코치 확인» 표시만 빠진다 — 오류 띠는 뜨지 않는다.
옛 판(3.033 이하) 앱이 남아 있어도 된다 — RLS 는 행을 조용히 걸러 낼 뿐 오류를 내지 않는다. 옛 판 선수 기기에 남은 사본은 3.038 가 깔리면
`PLAYER_BLIND` 정리가 지운다.

되돌리기: `20261015_player_daily_blind.rollback.sql`(표식이 붙은 두 키만 뺀다, 데이터 그대로).

## 시험

`migrations/20261015_player_daily_blind.local-test.cjs`(합성 PGlite, 20260930 운영 함수 원문 픽스처 · 실제 `authenticated` 역할과 JWT 문맥):
적용 전 선수가 팀원 몸 상태를 읽음 · 적용 뒤 못 읽음 · 공지·경기는 그대로 · 코칭스태프·임원·소유자 그대로 · 비구성원 그대로 ·
ACL·SECURITY DEFINER·search_path 그대로 · 다른 함수 바이트 그대로 · 되돌리기는 원문 그대로 · 예상과 다른 정의는 건드리지 않음.
`npm run test:sql` 에 포함.
