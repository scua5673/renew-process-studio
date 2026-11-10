# 20261110 — 초대 코드 · 합류 · 멤버 이메일 (보안 점검 1 · 2 · 3번)

두 묶음 가운데 **첫째**다. 순서: `20261110_invite_hardening` → `20261110_privacy_limits`. 되돌릴 때는 거꾸로.
운영 DB 변경은 사람이 Supabase SQL 편집기(프로젝트 `jvtajoeptzfsdwizxejg`)에서 한다. testprocess · processstudio 는 같은 DB 라 한 번만 한다.
앱 판과 순서는 상관없다 — 이 묶음은 앱 코드를 바꾸지 않는다(새 12자 코드는 지금 앱의 코드 검사 `/^[A-Z0-9]{6,12}$/` · 입력 칸 `maxlength 12` 를 그대로 지난다).

## 왜 (2026-11-10 운영 읽기 전용 조회 + 기준본으로 PGlite 재현)

| # | 운영 상태 | 위험 |
|---|---|---|
| 1 | `ps_invites` 정책 `inv_sel` = `ps_is_member(workspace_id)` — 선수도 `GET /rest/v1/ps_invites?workspace_id=eq.<팀>` 으로 스태프 · 임원 코드를 읽는다. `ps_join` 은 받은 코드의 역할을 그대로 권한 문서에 쓴다 | 높음 — 지금은 가드(`ps_kv_team_guard`, `ps_guard_mode.enforce=true`)가 **부수 효과로** 되돌릴 뿐이다. 스위치를 끄면(20261007 runbook 의 되돌리기) 선수가 스태프 · 임원이 된다. 권한 문서가 아직 없는 팀은 지금도 그대로 들어간다(가드의 «최초 생성 허용») |
| 2 | 코드 = `upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))` — 8자 16진수(32비트), 30일 동안 여러 번 쓴다. `ps_join` 은 시도 제한이 없고 틀림(`invalid code`)과 만료(`expired`)를 다르게 답한다 | 중간 |
| 3 | `ps_join` · `ps_bootstrap` · `ps_create_team` 이 **보낸 사람이 적은** 이메일을 `ps_members.email` 에 넣고, `ps_members_of_v2` 는 그것을 `auth.users.email` 보다 먼저 보여 준다 | 중간 — 팀원 목록에 남의 주소로 보일 수 있다 |

### 지금 무엇이 깨져 있나 — «강제 모드에서 스태프 · 임원 초대 합류»

**예, 서버에서는 깨져 있다.** 기준본의 실제 함수 · 트리거로 재현했다(`local-test.cjs` 의 `before`):
권한 문서가 이미 있는 팀에 새 사람이 스태프 코드로 합류하면 `ps_join` 의 쓰기를 가드가 «운영진 아닌 사람의 권한 쓰기»로 보고
본인 항목을 팀 기본 역할로 고쳐 쓴다 → **선수**가 되고 `ps_kv_denied` 에 «권한은 운영진만…» 한 줄이 남는다(선수 코드 합류도 줄이 남는다).
권한 문서가 없는 팀의 **첫** 합류만 초대의 역할이 그대로 들어간다.

다만 지금 앱 화면에서는 드러나지 않는다 — 앱은 `ps_get_or_create_role_invite(…, 'player')` 만 부르고(`studio/sync.js` `uiInvite` · `uiPlayerInvite`),
초대 화면도 «이 코드로 들어온 팀원은 모두 선수로 시작합니다 … 권한 관리에서 바꿉니다»라고 말한다. 20261007 runbook 도 «합류는 계속 된다 — 역할은 팀 기본 역할로»라고 적었다.
그래도 RPC 는 `'staff'` · `'executive'` 코드를 만들고 옛 앱이 만든 코드가 남아 있을 수 있으므로, 이 묶음은 **초대의 역할이 가드를 약하게 하지 않고 제대로 들어가게** 고친다(아래 ②).
같은 이유로 `ps_claim_player`(앱이 부르지 않는 옛 RPC)의 본인 항목 쓰기도 강제 모드에서 되돌려진다 — 이 묶음은 건드리지 않는다.

또 하나: 임원 화면의 «선수 초대 링크»(3.052 `uiPlayerInvite`, `idpLinkCan()` 이 임원에게 연다)는 서버가 `owner only` 로 거절해 «초대 링크를 만들지 못했어요»가 뜬다.

## 무엇을

- ① `inv_sel` → `ps_is_owner(workspace_id)`. 앱 · 관리자 화면은 `ps_invites` 를 직접 읽지 않는다(`grep rest/v1/ps_invites` 0건 — `tests/invite-code-format.test.cjs`).
  **지금까지 모든 팀원에게 보였던 스태프 · 임원 코드는 이 적용에서 만료시킨다**(`expires_at = now()`, 처음 적용할 때 한 번만). ②로 그 코드가 실제 효력을 갖게 되기 때문이다.
  선수 코드는 그대로 둔다(이미 팀원인 사람에게만 보였다).
- ② `ps_join`:
  - 이미 팀원이면 어떤 코드로 다시 들어와도 **역할을 바꾸지 않는다**(비어 있던 이메일만 채운다). 가드 스위치와 상관없다.
  - 멤버 행이 없는 소유자(`ps_workspaces.owner_id`)는 소유자로 되돌린다 — 선수로 내리지 않는다.
  - 새 사람: 멤버 행을 만들고, 권한 문서에 «본인 항목 = 초대 행의 역할»을 쓴다. 이 쓰기는 트랜잭션 표식 `ps.invite_join`(코드)을 달고 가고,
    가드는 `ps_perms_authorised_doc` 으로 **직접 다시 확인**한다: 그 코드가 이 팀의 유효한 초대 행인가 · 이 사람의 멤버 행이 바로 이 트랜잭션에서 생겼는가(`joined_at = now()`) ·
    새 문서가 «옛 문서 + 그 한 항목»과 글자까지 같은가. 표식만으로는 아무것도 열리지 않는다(시험: 팀에 있는 선수가 표식과 유효한 스태프 코드를 꾸며도 거절).
  - 나갔다 돌아온 사람은 옛 항목이 아니라 **이번 초대의 역할**이 된다(옛 «임원» 항목이 선수 코드로 되살아나지 않는다).
  - 팀 기본 역할이 선수가 아닌 팀(`teams_default_role_not_player`)에서는 달라지는 점이 있다: 지금은 합류자가 «팀 기본 역할»이 되지만, 적용 뒤에는 **초대의 역할**(선수 코드면 선수)이 된다.
- ③ 새 코드: `ps_invite_code()` — 12자, Crockford 32글자(`0-9A-Z` 에서 `I L O U` 뺌), `extensions.gen_random_bytes(12)`, 60비트.
  다섯 생성 함수가 모두 이것을 쓴다. 옛 8자 코드는 만료일까지 그대로 통한다(`ps_get_or_create_*` 는 살아 있는 옛 코드를 계속 돌려준다 — 30일 안에 저절로 바뀐다).
  만료일이 없는 옛 코드는 30일 뒤로 둔다. 손 입력의 `O` → `0`, `I` · `L` → `1` 은 서버가 읽어 준다.
- ③-2 `ps_get_or_create_role_invite`: 소유자는 그대로. **임원은 `'player'` 코드만** 받는다(위 «선수 초대 링크»가 살아난다). 스태프 · 임원 코드와 코드 바꾸기(`ps_regenerate_*`) · 옛 `ps_create_invite` · `ps_get_or_create_invite` 는 소유자만.
- ④ 틀린 코드 · 만료 코드: 같은 답 — **예외가 아니라 `null` + HTTP 400**(`set_config('response.status','400',true)`). 예외는 트랜잭션을 되돌려 실패 횟수를 남길 수 없다.
  앱은 `r.ok` 가 아니면 실패로 보므로(`sync.js rpc()`) 지금처럼 «합류 실패 — 코드가 올바르지 않거나 만료됐어요»가 뜬다.
  실패는 `ps_join_attempts`(사람마다 한 줄 · 클라이언트는 못 읽는다)에 세고, **15분 안에 10번이면 15분 잠근다**(`PT429` → HTTP 429, 맞는 코드도 거절). 성공하면 지운다. 하루 지난 줄은 `ps_join` 이 걷는다(cron 없음).
- ⑤ `ps_join` · `ps_bootstrap` · `ps_create_team`: `p_email` 인자는 옛 앱 때문에 남기되 쓰지 않고 `auth.users.email` 을 적는다.
  **이미 들어 있는 값은 고치지 않는다**(소유자 결정) — 몇 줄이 다른지는 사전 점검이 센다.

안 하는 것: 멤버 이메일 백필, `ps_claim_player`, 가드의 다른 갈래, 초대 화면 문구(«8자리 코드» — 아래 «제안»).

## 적용 (SQL 편집기, 사람이)

1. `20261110_invite_hardening.preflight.sql` 전체 실행.
   - 예외 없이 끝나야 한다. 예외가 나면 멈춘다 — 메시지가 무엇이 다른지 말한다(예: `public.ps_join(text,text) 본문이 2026-10-27 기준본과 다릅니다`).
   - 결과 한 줄의 기대값: `guard_enforce true` · `inv_sel ps_is_member(workspace_id)` · `applied_functions 0` · `live_codes_new_join_cannot_match 0`.
   - 적어 둔다(`.applied.md` 에): `live_codes` · `live_staff_exec_codes`(이 적용에서 만료될 수) · `codes_without_expiry` · `live_short_codes` · `teams_without_perms_doc` ·
     `teams_default_role_not_player` · `member_email_differs_from_auth` · `member_email_is_a_name` · `perms_denials_30d`.
   - `live_staff_exec_codes` 가 0이 아니면: 그 코드를 받은 사람이 아직 합류 전인지 소유자에게 물을 수 없으므로(모든 팀원에게 보였던 코드다) 그대로 만료시키고, 필요하면 소유자가 새로 만든다.
2. `20261110_invite_hardening.sql` 전체 실행. 한 트랜잭션 · `lock_timeout 5s`. 기대 NOTICE: `20261110_invite: 적용 — 만료시킨 스태프 · 임원 코드 N · 만료일을 붙인 옛 코드 M`.
   예외로 멈추면 아무것도 바뀌지 않았다. `canceling statement due to lock timeout` 이면 잠시 뒤 다시 실행한다.
3. `20261110_invite_hardening.verify.sql` — 기대: `invite_hardening_verified`.
4. 사전 점검을 한 번 더: `applied_functions 12` · `inv_sel ps_is_owner(workspace_id)` · `live_staff_exec_codes 0` · `codes_without_expiry 0`.
5. 앱에서(시험 계정 둘 — 실제 팀을 쓰지 않는다):
   1. 소유자 계정: 팀 메뉴 › «초대 코드 만들기» → 코드가 뜬다(살아 있는 옛 코드면 8자, 없었으면 **12자**). «코드 바꾸기» → 12자.
   2. 다른 계정: «초대 코드로 합류»에 **틀린 코드** → «합류 실패 — 코드가 올바르지 않거나 만료됐어요». (HTTP 400 · 본문 `null` 이어야 한다 — 개발자 도구 Network 의 `rpc/ps_join`.
      200 이 오면 PostgREST 가 `response.status` 를 무시한 것이다 → **바로 되돌린다**: 옛 앱은 `null` 을 팀 id 로 알고 진행한다.)
   3. 같은 계정: 맞는 코드 → 합류, 권한 관리에서 «선수». `select reason, at from ps_kv_denied where k='cs_perms_v1' order by at desc limit 3;` 에 방금 시각의 줄이 **없어야** 한다.
   4. 그 선수 계정으로: `GET /rest/v1/ps_invites?select=code` → `[]`.
   5. (선택) 임원 계정: 명단의 선수 › «초대 링크» → 링크가 만들어진다(전에는 «초대 링크를 만들지 못했어요»).
6. 다음 날: `select count(*), max(at) from ps_kv_denied where k='cs_perms_v1' and reason like '권한은 운영진만%' and at > now() - interval '1 day';`
   — 합류가 만들던 줄이 사라져 평소(`perms_denials_30d`/30)보다 줄어야 한다. `select count(*) filter (where locked_until > now()) locked, count(*) rows from ps_join_attempts;` 로 잠긴 계정을 본다(정상이면 0에 가깝다).
7. `.applied.md` 를 남기고 `node scripts/schema-baseline.mjs` 로 기준본을 새로 받아 같은 PR 에 넣는다(기준본은 적용 뒤에만 바꾼다 — 이 PR 은 `00000000_baseline.sql` 을 고치지 않았다).

## 되돌리기

`20261110_invite_hardening.rollback.sql` — 함수 아홉 · 정책을 기준본 글자 그대로(시험이 md5 로 확인), 새 함수 셋 · `ps_join_attempts` 삭제.
`20261110_privacy_limits` 가 적용돼 있으면 멈춘다(그 묶음을 먼저 되돌린다). 되살리지 않는 것: 만료시킨 스태프 · 임원 코드, 붙인 만료일. 그 사이 만든 12자 코드는 옛 `ps_join` 도 받는다.
되돌린 뒤 다시 적용하면 그 사이 살아 있던 스태프 · 임원 코드를 또 만료시킨다(되돌린 동안 다시 모든 팀원에게 보였으므로).

## 위험과 한계

- `ps_kv_team_guard` 를 통째로 다시 만든다(본문은 기준본 + 넉 줄). 운영 본문의 md5 가 기준본과 다르면 적용이 멈춘다 — 그 사이 누가 가드를 고쳤다면 이 묶음을 그 본문 위에 다시 만든다.
- `response.status` 는 PostgREST 기능이라 PGlite 로는 «GUC 가 400 으로 놓였다»까지만 시험했다. 그래서 5-2 를 꼭 한다.
- 잠금은 계정 단위다 — 계정을 여러 개 만드는 공격은 막지 못한다(가입 자체의 속도 제한은 Supabase Auth 설정). 12자 코드(60비트)가 본 방어다.
- 앱 판 하한 가드(`ps_kv_build_guard`)가 옛 판의 `ps_join` 쓰기를 버리면 합류자는 지금처럼 팀 기본 역할이 된다(이 묶음이 바꾸지 않은 동작).

## 제안 (이 묶음에 넣지 않음)

- 초대 화면 문구: `studio/sync.js` 9317행 «팀 관리자에게 받은 8자리 코드를 입력하세요» → «…받은 초대 코드를…», 9318행 `placeholder:'예: A1B2C3D4'`. 동작에는 영향이 없다(칸은 12자를 받는다). 다음 판에 같이.
- 잠겼을 때(HTTP 429) «10번 틀려 15분 뒤 다시»라고 따로 안내 — 지금은 같은 «합류 실패» 문구.
- 멤버 이메일 백필: `update ps_members m set email = u.email from auth.users u where u.id = m.user_id and m.email like '%@%' and lower(m.email) is distinct from lower(u.email);` — 소유자 결정 뒤 별도 묶음으로(이름으로 쓰인 `email` 값은 건드리지 않는다).

## 시험

`migrations/20261110_invite_hardening.local-test.cjs`(95 검사 — 기준본 `00000000_baseline.sql` 을 PGlite 에 통째로 올린다: 실제 `ps_join` · `ps_kv_team_guard` · 정책 · 권한):
- 적용 전: 선수가 표에서 스태프 코드를 읽음 · 강제 모드에서 **정상** 스태프 초대 합류가 선수로 떨어짐(+거절 기록) · 스위치를 끄면 선수가 스태프가 됨 · 권한 문서 없는 팀은 그대로 들어감 ·
  꾸민 이메일이 저장되고 팀원에게 보임 · 틀림/만료가 다른 답 · 27번 틀려도 다음 시도가 통함 · 임원은 선수 코드를 못 받음.
- 적용 뒤: 위가 모두 막힘 · 소유자의 스태프/임원/선수 초대 → 새 사람이 그 역할로(권한 문서가 있든 없든, 강제 모드에서) · 옛 8자 코드 · 손 입력(O/I/L · 소문자 · 공백) ·
  이미 팀원 · 임원 · 소유자의 재합류는 역할 그대로(스위치 켜고 끄고 둘 다) · 꾸민 표식 거절 · 운영진의 권한 편집 그대로 · 같은 답(null · 400) · 10번 뒤 잠금 · 계정별 · 풀림 · 하루 지난 줄 걷기.
- 두 번 적용 · 되돌리기(md5 = 기준본) · 다시 적용 · 손댄 `ps_join` / 다른 정책 / 꺼진 가드 트리거에서는 아무것도 바꾸지 않고 멈춤.
`tests/invite-code-format.test.cjs` — 앱의 코드 검사 · 입력 칸이 12자 코드를 받는다. 둘 다 `npm run test:sql` · `npm test` 에 들어 있다.
