# 20261119_roster_growth_guard — 명단이 «갑자기 불어나는» 저장 거부를 실제 중복일 때만

제보 d543557f(11/19 «기존 등록된 명단 삭제가 안되요»).

## 무슨 일이 있었나
- `ps_kv_shape_guard`(트리거 `ps_00b_shape_guard_t`, `ps_kv` BEFORE UPDATE)는 `cs_squad_v1` · `scout_tool_v1` 의 선수 수가 **10명 이상에서 1.6배 넘게** 늘면 옛 값으로 되돌리고 `ps_kv_denied` 에 이유만 남긴다. 옛 판이 거울에서 선수를 새 id 로 한 벌 더 만든 «2배» 사고를 막는 규칙이다.
- 그 팀 주인은 옛 선수 14명을 지우고(삭제 기록 `cs_player_del_v1` 은 서버에 왔다) 새 명단을 넣었다. 서버는 «14명 → 59명 · 중복 의심»으로 `cs_squad_v1` 저장을 거부했고, 서버 명단 세 곳에는 지운 14명이 남았다. 기기에는 올라가지 못한 팀 변경 62건.
- 같은 문구의 거부 줄은 최근 30일 15줄 · 10팀(11/19 조회. `ps_kv_denied` 는 (팀, 사람, 키)마다 마지막 한 줄만 남으므로 실제 횟수는 더 많을 수 있다).

## 무엇을 바꾸나
- 함수 `public.ps_kv_shape_guard()` 본문의 그 가지에 조건 하나: 새 명단에서 **같은 (이름, 등번호)가 되풀이된 수**(`n − distinct(lower(trim(name)), trim(num))`)가 **늘어난 수의 절반 이상**일 때만 막는다. 이름 없는 줄은 서로 같은 것으로 센다. 셈이 실패하면 예전처럼 막는다.
- 그대로: 경기 점수 규칙 · «전부 사라지는 저장» · 거부 기록과 문구 · 트리거 · 권한 · SECURITY DEFINER · search_path. 표 · 정책 · 자료는 건드리지 않는다. 앱 코드 변경 없음.
- 알고 받아들인 것: 서로 다른 이름을 지어 넣은 가짜 불리기는 이 가드가 막지 않는다(예전에도 1.6배 이하로 나눠 넣으면 통과했다 — 이 가드는 사고 막이지 권한 장치가 아니다).

## 순서
1. `20261119_roster_growth_guard.preflight.sql` — 예외 없이 표 하나. 기대: `already_applied=false` · `body_md5=fd40ab18d81f34de23f9dd578724c7ee` · `guard_enforce=true`.
2. `20261119_roster_growth_guard.sql` — 한 트랜잭션. 본문이 기준본과 다르거나 트리거가 다르면 예외로 멈춘다(아무것도 안 바뀜).
3. `20261119_roster_growth_guard.verify.sql` — `ok` · `body_md5=f22408fca66fdc49063a4cb09c2655e4`.
4. 지켜보기(읽기 전용):
   - 그 팀: `select k, jsonb_array_length(v::jsonb->'players'), updated_at from ps_kv where workspace_id=… and k in ('cs_squad_v1','scout_tool_v1')` 가 새 명단으로 바뀌는지 · `ps_sync_reports` 의 `pending_team` 이 줄어드는지. 기기가 다시 올려야 하므로 제보자가 그 PC 에서 앱을 열어야 한다.
   - 전체: `select workspace_id, k, reason, at from ps_kv_denied where reason like '%불어나는%' order by at desc` — 적용 뒤 새 줄은 실제 중복뿐이어야 한다.
5. 결과를 `20261119_roster_growth_guard.applied.md` 에 남긴다. 기준본(`00000000_baseline.sql`)은 이 PR 이 같은 본문으로 고쳐 두었다 — `node scripts/schema-baseline.mjs` 로 다시 받아 차이가 없는지 본다.

## 되돌리기
`20261119_roster_growth_guard.rollback.sql` — 함수 본문을 기준본(md5 `fd40ab18…`)으로. 그 사이 통과한 저장은 되돌리지 않는다(정상 저장이다).

## 로컬 시험
`node migrations/20261119_roster_growth_guard.local-test.cjs`(PGlite · 기준본 위) — 적용 전에는 14 → 새 59명이 막히고, 적용 뒤에는 통과 · «2배» · 3배 · 이름 없는 줄 · 깨진 줄 · 0명 · 경기 점수는 그대로 막힘 · 두 번 적용 · 되돌리기 · 다시 적용 · 예상과 다른 운영에서 멈춤.
