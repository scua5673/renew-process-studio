# 20261110 — 멤버 이메일 · 그림 · 로그인 없는 쓰기 · 계정 삭제 · 권한 정리 (보안 점검 4~8번)

두 묶음 가운데 **둘째**다. 순서: `20261110_invite_hardening` → **`20261110_privacy_limits`**. 첫째가 없으면 사전 점검 · 적용 모두 멈춘다
(`ps_join_attempts` · `ps_perms_authorised_doc` 을 쓴다). 되돌릴 때는 이 묶음 먼저.
운영 DB 변경은 사람이 Supabase SQL 편집기(프로젝트 `jvtajoeptzfsdwizxejg`)에서 한다.

앱과의 순서: **SQL 먼저여도, 앱 먼저여도 안전하다.** 앱 변경은 계정 삭제 거절 문구 하나(`studio/account-delete.js`)다 —
옛 앱 + 새 SQL 이면 소유자 차단이 «서버에서 지우지 못했어요 … 인터넷 연결을 확인» 으로 보일 뿐(아무것도 지워지지 않는다), 새 앱 + 옛 SQL 이면 거절이 없다.

## 왜 (2026-11-10 운영 읽기 전용 조회 + 기준본으로 PGlite 재현)

| # | 운영 상태 | 위험 |
|---|---|---|
| 4 | `ps_members_of` · `ps_members_of_v2` 와 정책 `mem_sel`(= `ps_is_member`)이 모든 팀원에게 모든 이메일을 준다 | 중간 — 선수(미성년 포함)가 코치 · 다른 선수 · 보호자 주소를 본다 |
| 5 | `ps_blob_sel` · `ps_blob_ins` = `ps_is_member` 뿐 — 선수가 해시를 몰라도 팀의 모든 그림을 훑고(비공개 보관함에서 떼어 낸 사진 포함), `created_by` 를 비운 채 2MB 그림을 끝없이 올린다 | 중간 |
| 6 | `ps_err`(anon, 길이 제한 없음 · 시각도 보낸 대로 · 운영 21,681줄) · `ps_comm_reports`(anon, `reporter` 를 보낸 대로 — 남의 이름으로 신고, `reason` 무제한) · `ps_events`(`meta` 무제한, `app_version` 자유 글 — `'99.999'` 한 줄이 `ps_admin_stale_clients` · `ps_support_reporter_devices` 의 «가장 새 판»이 되어 모든 기기가 옛 판으로 보인다) | 중간 — 저장 공간 · 관리자 화면 오염 |
| 7 | `ps_delete_my_data` 가 팀의 `cs_idp_v1_<uid>` · `cs_idp_pub_v1_<uid>` 와 그 판 역사, 권한 문서의 본인 항목(역할 · 선수 연결), `ps_events`, 제보 · 답글 · 첨부, 공유 링크, 보관함, 기기 보고, 지운 개인 공간의 판 역사를 남긴다. 소유자가 지우면 팀이 주인 없이 남는다(운영 18팀). `auth.users` 도 남는다 | 높음 — 개인정보처리방침 4절 «지체 없이 파기» |
| 8 | anon 이 모든 public 표에 ALL(TRUNCATE 포함 — TRUNCATE 는 RLS 를 타지 않는다). 소유자가 `ws_upd` 로 `kind` · `owner_id` 를 바꿀 수 있다(`kind='personal'` 이면 `ps_team_role` 이 누구에게나 admin) | 낮음(PostgREST 는 TRUNCATE 를 내보내지 않는다) — 이중 잠금 |

## 무엇을 · 왜 그렇게

### ④ 멤버 이메일
- `ps_members_of_v2` · `ps_members_of`: 이메일은 **소유자 · 임원(`ps_team_role in ('admin','executive')`)과 본인 줄**에만. 이름 · 역할 · 합류일은 그대로 모두에게.
  이름이 없는 사람은 앱이 이미 `uid 앞 8자…` · «이름 없는 계정»으로 그린다(`sync.js memberLabel` · 9794행). 이메일 앞부분을 이름 대신 내주지 않는다
  (사전 점검 `members_shown_without_name_to_players` 가 그런 사람 수 — 1.533 부터 합류할 때 이름을 올리므로 옛 멤버만 해당).
  옛 `ps_members_of` 의 `email` 칸은 이름표로도 쓰였으므로(주소 모양이 아니면 이름) 남에게는 이름(없으면 null)을 준다.
- `mem_sel`: **행 단위로 좁혔다** — 본인 줄, 또는 소유자 · 임원. 열 단위 권한(`email` 열만 회수)을 고르지 않은 까닭:
  기준본 추출이 열 권한을 담지 못하고(`00000000_baseline.sql` 17절 «column-grant 0 … 손으로 옮긴다»), `select=*` 가 통째로 실패로 바뀐다.
  행 단위는 앱이 표를 직접 읽지 않아 안전하다 — 직접 쓰는 곳은 소유자의 팀원 내보내기(`DELETE … select=user_id`) 하나고 소유자는 모든 줄이 보인다(시험).
  서버 함수는 모두 SECURITY DEFINER 라 이 정책을 타지 않는다(SECURITY INVOKER 로 `ps_members` 를 읽는 함수 0개 — 기준본 조회).
  ⚠ `ps_team_role` 은 개인 공간이면 멤버가 아니어도 `admin` 을 돌려준다 — 그래서 정책 · 함수 모두 **멤버 확인을 먼저** 한다(시험: 남의 개인 공간 0줄).

### ⑤ 그림(`ps_blob`)
- 넣은 것: 트리거 `ps_blob_guard_t` — `created_by` · `created_at` 은 서버가 적고, **한 사람 24시간 1,500개**를 넘으면 `42501`(HTTP 403).
  앱은 403 이면 그 세션에서 그림을 문서에 담아 보내는 옛 길로 물러선다(`sync.js blobDisable`) — 동기화가 멈추지 않는다. 색인 `ps_blob_created_by_at_idx`.
- **넣지 않은 것 — 읽기 제한(제안).** 앱은 그림을 `ps_blob?workspace_id=eq.…&h=in.(…)` 로 읽고(`sync.js` 3120 · 3153 · 3204행), 선수도 코치가 올린 일정 그림을 받아야 한다.
  역할이나 올린 사람으로 막으면 선수 일정 화면의 그림이 사라지고, «해시로만» 은 RLS 로 표현할 수 없다. 선수 흐름이 그대로라는 것을 증명할 수 없어 이번에는 넣지 않았다.
  하려면 앱과 함께:
  1. SQL — `ps_blob_get(p_wid uuid, p_h text[]) returns table(h text, v text)`(SECURITY DEFINER · `ps_is_member` · 한 번에 40개까지 · `where b.h = any(p_h)`), `ps_blob_have(p_wid, p_h) returns setof text`.
  2. 앱 — `sync.js` 의 `blob_have`(3120) · `blob_pull`(3153 · 3204) 세 요청을 `rpc('ps_blob_have'|'ps_blob_get', {p_wid:wid, p_h:ch})` 로. 404 면 지금 길로 물러서게(SQL · 배포 순서).
  3. 그 판이 `ps_app_policy.min_build` 가 된 뒤 — `ps_blob_sel` 을 `created_by = auth.uid() or ps_team_role(workspace_id) in ('admin','executive')` 로.
  해시가 16자 이상이라는 검사(`ps_blob_h_check`)뿐이라, 그때 해시가 추측 가능한 길이인지도 같이 본다.

### ⑥ 로그인 없는 쓰기 · 이벤트
- 길이 검사(`NOT VALID` 로 더하고, 어기는 옛 줄이 없으면 바로 `VALIDATE` — 있으면 NOTICE 로 알리고 그대로 둔다. 새 줄은 어느 쪽이든 지킨다):
  | 표 | 검사 | 앱이 실제로 보내는 것 |
  |---|---|---|
  | `ps_err` | kind ≤ 40 · msg ≤ 2000 · src ≤ 300 · page ≤ 300 · ua ≤ 400 | `storage.js` 1385~1407행: msg 300 · src 60 · page 파일 이름 · ua 120 |
  | `ps_comm_reports` | pub_id ≤ 120 · reason ≤ 500 | `community.html`: reason `''` |
  | `ps_events` | `octet_length(meta::text)` ≤ 8192 · app_version `^[A-Za-z0-9_.+-]{1,24}$` · workspace_id ≤ 64 | `sync.js safeEventMeta`: 12칸 · 글자 80~140 → 최대 약 2.3KB. `appVer()`: `PS_BUILD`(3.271) 또는 `unknown`, 24자 |
  `meta` 는 `pg_column_size` 대신 `octet_length(meta::text)` — 저장된 줄(압축)과 새 줄에서 같은 값이라 `VALIDATE` 와 새 줄 판정이 어긋나지 않는다.
- `ps_err`(늘 anon 키로 온다 — 사람을 가릴 수 없다): 시각이 서버 기준 +10분 · −30일 밖이면 지금으로 고치고, **하루 5,000줄**(모두 합쳐)을 넘으면 **조용히 버린다**.
  예외로 거절하면 앱이 같은 30줄 묶음을 오류가 날 때마다 다시 보낸다(`storage.js` 는 성공해야 비운다).
- `ps_comm_reports`: 앱은 **로그인 없이도 신고한다**(`reporter:(me&&me.uid)||null`) — 그래서 anon 을 정책에서 빼지 않았다. 대신 트리거가 `reporter := auth.uid()` 로 **덮어 쓴다**
  (남의 이름으로 신고 불가, anon 은 null) · `at` 은 서버 시각 · `resolved_*` 는 비운다. 로그인한 사람 하루 30건, 비로그인은 모두 합쳐 하루 300건 — 넘으면 조용히 버린다(앱은 응답을 보지 않는다).
- 셈은 `ps_rate_counters`(버킷 · 날짜 · 클라이언트는 못 닿는다). 8일 지난 줄은 새 버킷이 생길 때 걷는다(cron 없음).
- «가장 새 판»: `ps_latest_app_version(since)` — **서로 다른 3명 이상이 보낸 판 가운데 가장 큰 것**, 그런 판이 없으면(사람이 적은 시간대) 가장 많은 사람이 보낸 판(같으면 낮은 쪽).
  `ps_admin_stale_clients` · `ps_support_reporter_devices` 는 `max(app_version)` 한 줄만 이것으로 바꿨다. 새 판이 나온 직후 3명이 되기 전까지는 한 판 낮게 보일 수 있다(옛 판 목록이 잠깐 덜 잡힐 뿐).
- **보관 기한(`ps_err`)**: 이 SQL 은 지우지 않는다. 프로젝트는 pg_cron 을 쓴다(`ps-trim-nightly` 등 — 기준본 18절). 소유자가 정하면 아래 한 줄을 SQL 편집기에서 따로 실행한다(90일 예):
  ```sql
  select cron.schedule('ps-err-trim', '35 18 * * *', $$delete from public.ps_err where t < now() - interval '90 days'$$);
  ```
  먼저 `select count(*) from ps_err where t < now() - interval '90 days';`(사전 점검의 `err_rows_older_than_90d`)로 첫날 지워질 양을 본다. 되돌리기: `select cron.unschedule('ps-err-trim');`

### ⑦ 계정 삭제(`ps_delete_my_data`)
멈추는 경우(아무것도 지우지 않고 HTTP 409):
- `ps_delete_owner_blocked` — **다른 팀원이 남아 있는 팀의 소유자**(`ps_workspaces.owner_id` 또는 멤버 역할 `owner`). `details` = 팀 이름.
  앱은 «…팀을 넘기거나 삭제한 뒤 탈퇴해 주세요 — 팀원을 모두 내보내면 탈퇴할 때 팀도 함께 지워지고, 팀을 다른 사람에게 넘기려면 문의해 주세요» 를 보인다.
  (앱에는 팀 넘기기 · 팀 지우기 화면이 없다 — 넘기기는 아래 «팀 넘기기»를 관리자가 한다.)
- `ps_delete_admin_blocked` — 서비스 관리자(`ps_admins`). `ps_admin_actions.admin_id` 가 `auth.users` 를 가리켜 계정을 지울 수 없다 — 먼저 관리자에서 뺀다.
- `ps_delete_incomplete` — 권한 문서의 본인 항목을 쓰기 가드가 되돌렸다(예: `ps_app_policy.block_unversioned = true` — 계정 삭제 요청은 판 머리글을 보내지 않는다). «지웠다»고 답하지 않고 통째로 물린다.

표마다(«내 팀» = 삭제 시점에 멤버인 공간):
| 자료 | 처리 | 까닭 |
|---|---|---|
| 내가 주인이고 나만 있는 공간(개인 공간 · 혼자 쓰던 팀) | 공간 삭제 — 문서 · 보관함 · 그림 · 초대 · 멤버 행은 외래키로 | 남을 사람이 없다 |
| 그 공간의 `ps_kv_history`(· `_hold_2948` · `_restore_backup_2948`) · `ps_audit` · `ps_kv_denied` · `ps_kv_ping` | 삭제 | 외래키가 없어 예전엔 문서 내용이 판 역사에 90일 남았다 |
| 내 팀의 `…_<내 uid>` 문서(`cs_idp_v1_` · `cs_idp_pub_v1_` …)와 그 판 역사 · 감사 줄 | 삭제 | 나에 관한 자료(성장 기록 · 코치 피드백) |
| 내 팀 권한 문서의 내 항목(역할 · `playerId` 선수 연결) | 항목 삭제, 판 역사 속 같은 항목도 | 가드는 «이미 멤버가 아닌 본인의 항목 삭제»만 인정한다(`ps_perms_authorised_doc` ②) — 표식을 꾸며도 팀에 남은 채 제 항목을 지워 «팀 기본 역할»로 올라갈 수 없다 |
| `ps_members` | 삭제 | |
| 내 팀 보관함: 비공개(`private`) | 삭제 | 나만 보던 것 |
| 내 팀 보관함: 팀과 나눈 것 | **남기고 `owner_id = null`** | 팀이 쓰는 훈련 자료다. `owner_id` 는 NOT NULL 이 아니고, 주인 없는 줄은 코치(`ps_idp_can_view`)가 읽고 고친다(`lib_sel` · `lib_upd`) |
| `ps_blob`(내가 올린 그림) | **남기고 `created_by = null`** | 내용 주소라 팀 문서 · 남의 보관함과 같이 쓴다 — 어느 문서가 가리키는지 서버가 모른다 |
| `ps_events` · `ps_usage` · `ps_sync_reports` · `ps_shared_views`(양쪽) · `ps_kv_denied` · `ps_join_attempts` · `ps_letter_readers` · `ps_handles` · `ps_comm_likes` · `ps_community` | 삭제 | |
| 제보 `ps_support_reports`(+ 답글 · 첨부 그림) | 삭제 | 내 글 · 진단 · 화면 사진 |
| `ps_share`(내가 만든 공유 링크) | 삭제 | 링크가 죽는다 |
| `ps_invites`(내가 만든 코드) | 삭제 | |
| `ps_comm_reports.reporter` · `ps_kv_history.changed_by` · `ps_audit.user_id` | **null 로** | 신고 · 팀의 변경 기록은 남기고 누가 했는지만 지운다 |
| `auth.users`(로그인 계정 · 이메일) | **대기열 `ps_account_deletions` 에 한 줄** | 지우려면 service_role 이 필요하다 — 사용자가 부르는 SQL 로 하지 않는다(아래 «계정 삭제 처리») |

남는 것(알고 둔다): `ps_kv.updated_by`(팀 문서의 «마지막으로 고친 사람» uid — 지우려고 UPDATE 하면 그 문서들의 쓰기 가드가 돈다. 계정 · 멤버 행이 사라진 뒤에는 아무도 가리키지 않는 값이다),
관리자 메모 `ps_admin_followups.subject_user_id`(아래 처리 단계에서 닫는다), 지운 비공개 보관함 항목이 가리키던 `ps_blob` 줄(가리키는 문서를 서버가 몰라 남는다 — 그림 정리(GC)는 따로 할 일),
`ps_community.likes` 숫자, 팀 문서 본문 속에 다른 사람이 적은 내 이름.

### ⑧ 권한 · 워크스페이스
- anon · authenticated: 모든 public 표의 `TRUNCATE` · `REFERENCES` · `TRIGGER`(· PG17 `MAINTAIN`) 회수 — PostgREST 가 쓸 일이 없다.
- anon: `UPDATE` · `DELETE` 전부, `INSERT` 는 `ps_err` · `ps_comm_reports` 만 남긴다. 로그인 없는 흐름이 쓰는 것(사전 점검 ② 표가 운영 권한 옆에 보여 준다):
  `ps_err` INSERT(오류 기록) · `ps_comm_reports` INSERT(신고) · `ps_community` · `ps_comm_likes` · `ps_handles` SELECT(커뮤니티) · 나머지는 RPC(`ps_share_get` · `ps_letter_*` · `ps_comm_view/copied`).
  **anon 의 SELECT 는 건드리지 않았다** — RLS 가 0줄을 주던 요청이 401 로 바뀌어 로그아웃 상태 화면이 달라질 수 있다(따로 볼 일).
- `ps_workspaces`: 트리거 `ps_workspace_fixed_guard_t` — 로그인한 사람은 `id` · `kind` · `owner_id` · `created_at` 을 못 바꾼다(이름은 그대로). SQL 편집기 · service_role 은 영향 없다.
  `ps_workspaces` 를 UPDATE 하는 서버 함수는 없다(기준본 조회).

## 적용 (SQL 편집기, 사람이)

1. `20261110_invite_hardening` 이 적용돼 있는지: `select count(*) from pg_proc where prosrc like '%ps-20261110-invite%';` → 12.
2. `20261110_privacy_limits.preflight.sql` 전체 실행. 예외 없이 끝나야 한다 — 예외면 멈춘다(메시지가 까닭을 말한다. 예: «한 사람이 하루에 그림 N개를 올린 날이 있습니다(상한 1,500 의 절반 이상)» → 상한을 다시 정한다).
   결과 표 셋:
   - ① 숫자 한 줄 — 기대: `applied_functions 0` · `block_unversioned false` · `pg_cron_installed 1`. 적어 둔다: `members_shown_without_name_to_players` ·
     `teams_without_owner_member`(운영 조회 18) · `teams_whose_owner_id_is_not_a_member` · `teams_whose_owner_cannot_self_delete`(적용 뒤 소유자가 탈퇴하려면 팀원을 내보내거나 넘겨야 하는 팀 수) ·
     `err_rows`(약 21,681) · `err_max_per_day_30d`(< 2,500) · `err_rows_older_than_90d` · `blob_max_per_user_day_30d`(< 750) · `events_meta_max_bytes`(< 8192) ·
     `latest_version_plain_max` 와 `latest_version_3_users`(같거나 한두 판 차이여야 한다 — 크게 다르면 누가 큰 판 번호를 보낸 것이다).
     `block_unversioned` 가 true 면 적용은 되지만 팀에 속한 사람의 계정 삭제가 `ps_delete_incomplete` 로 멈춘다 — 그 설정을 끄거나 이 묶음을 미룬다.
   - ② anon 권한 표 — `used_without_login` 이 `INSERT`/`SELECT` 인 다섯 표 말고는 «없음»이어야 한다. `policies_that_include_anon` 에 처음 보는 정책(anon 에게 쓰기를 여는)이 있으면 멈추고 본다.
   - ③ 주인 없는 팀 목록(아래 «주인 없는 팀»). 0줄이어도 된다.
3. `20261110_privacy_limits.sql` 전체 실행. 한 트랜잭션 · `lock_timeout 5s`. 기대 NOTICE: `20261110_privacy: 적용`
   (옛 줄이 길이 검사를 어기면 `… 는 옛 줄 N개가 어겨 NOT VALID 로 둡니다` 가 같이 나온다 — 정상).
   `ps_blob` 색인을 만드는 동안 그 표 쓰기가 잠깐 기다린다. `lock timeout` 이면 잠시 뒤 다시.
4. `20261110_privacy_limits.verify.sql` — 기대: `privacy_limits_verified`.
5. 앱에서(시험 계정):
   1. 선수 계정: 팀 설정 › 팀원 — 이름은 보이고 이메일은 본인 것만. 일정의 그림 · 공지 · 내 IDP 가 평소처럼 뜬다.
   2. 소유자 · 임원 계정: 팀원 › 권한 관리 — 이메일이 그대로 보인다. 팀 이름 바꾸기가 된다.
   3. 코치 계정: 사진이 든 보관함 항목을 하나 저장 → 동기화 진단에 `blob-off` 가 없다.
   4. 로그아웃 상태: 커뮤니티가 열리고 신고가 조용히 지나간다. `select reporter, at from ps_comm_reports order by id desc limit 1;` → `reporter` null.
   5. 관리자 화면: 운영 홈 «옛 판으로 도는 기기» · 제보 상세 «제보자 기기 현황»이 뜨고 `latest` 가 실제 최신 판이다.
   6. 시험 계정으로 «내 데이터 삭제» → 끝나면 `select * from ps_account_deletions order by requested_at desc limit 1;` 에 그 계정. 아래 «계정 삭제 처리»로 마무리한다.
6. 다음 날: `select bucket, day, n from ps_rate_counters order by day desc, n desc limit 20;`(상한에 닿은 버킷이 있는가 — `err` 5,000 · `rep:anon` 300 · `rep:u:*` 30),
   `select count(*) from ps_events where event_name='app_error' and error_code='alert_fail' and meta->>'stage'='data_delete' and created_at > now() - interval '1 day';`(계정 삭제 실패),
   앱 오류 탭의 `blob-off` 진단(그림 상한 403)이 평소와 같은지.
7. `.applied.md` 를 남기고 `node scripts/schema-baseline.mjs` 로 기준본을 새로 받아 같은 PR 에 넣는다.

## 계정 삭제 처리 (관리자 — 요청이 오면 지체 없이)

`ps_delete_my_data` 는 자료를 지운 뒤 `ps_account_deletions` 에 줄을 남긴다. 로그인 계정(`auth.users` — 이메일이 든 곳)은 관리자가 지운다.

1. 대기 목록: `select user_id, requested_at from public.ps_account_deletions where done_at is null order by requested_at;`
2. 그 사람이 다시 로그인해 새 자료를 만들지 않았는지: `select count(*) from public.ps_members where user_id = '<uid>';` — 0 이어야 한다(개인 공간이 다시 생겼으면 본인에게 확인).
3. 관리자 메모를 닫는다: `select id, kind, status from public.ps_admin_followups where subject_user_id = '<uid>';` — 필요 없으면 관리자 화면에서 닫거나 지운다.
4. Supabase 대시보드 › Authentication › Users › 그 `user_id` › **Delete user**. (`ps_events.user_id` 는 외래키로 같이 지워진다. `ps_admin_actions` · `ps_admins` 가 가리키면 거절된다 — 관리자 계정은 애초에 `ps_delete_admin_blocked`.)
5. `update public.ps_account_deletions set done_at = now(), done_by = '<처리한 사람>' where user_id = '<uid>';`
6. 매주 점검에 한 줄 더: `select count(*), min(requested_at) from public.ps_account_deletions where done_at is null;` → 0.

제안(사람 손을 빼려면): service_role 로 도는 Edge Function `account-delete-sweep`(pg_cron 또는 Supabase Scheduled Function 하루 1번) —
`ps_account_deletions where done_at is null` 을 읽어 `auth.admin.deleteUser(user_id)` → `done_at`. secret 키가 Edge Function 환경에만 있고 저장소에는 없다(운영 문서 «비밀값» 규칙 그대로).

## 주인 없는 팀 (자동으로 지우지 않는다)

사전 점검 ③이 같은 목록을 준다. 따로 볼 때(읽기 전용):

```sql
select w.id, w.name, w.created_at, w.owner_id,
       (select count(*) from public.ps_members m where m.workspace_id = w.id)                      as members,
       exists (select 1 from public.ps_members m where m.workspace_id = w.id and m.role = 'owner') as has_owner_member,
       exists (select 1 from auth.users u where u.id = w.owner_id)                                 as owner_account_exists,
       (select count(*) from public.ps_kv k where k.workspace_id = w.id)                           as docs,
       (select count(*) from public.ps_library l where l.workspace_id = w.id)                      as library_items,
       (select max(k.updated_at) from public.ps_kv k where k.workspace_id = w.id)                  as last_write
  from public.ps_workspaces w
 where w.kind <> 'personal'
   and (not exists (select 1 from public.ps_members m where m.workspace_id = w.id and m.role = 'owner')
        or not exists (select 1 from public.ps_members m where m.workspace_id = w.id and m.user_id = w.owner_id))
 order by last_write desc nulls last;
```

읽는 법: `members 0` = 빈 팀(지워도 잃는 사람이 없다 — 관리자 화면 «팀 삭제» `ps_admin_delete_workspace`), `members > 0` · `owner_account_exists true` = 소유자가 팀에서만 나갔다
(본인이 초대 코드로 다시 들어오면 `ps_join` 이 소유자로 되돌린다 — 20261110_invite_hardening), `owner_account_exists false` = 넘길 사람을 팀과 정한다.

### 팀 넘기기 (관리자, SQL 편집기 — 한 트랜잭션)

```sql
begin;
update public.ps_workspaces set owner_id = '<새 소유자 uid>' where id = '<팀>';
update public.ps_members set role = 'member' where workspace_id = '<팀>' and role = 'owner';
update public.ps_members set role = 'owner'  where workspace_id = '<팀>' and user_id = '<새 소유자 uid>';   -- 1줄이어야 한다(새 소유자는 이미 팀원)
commit;
```
SQL 편집기는 로그인한 사람이 아니라서(`auth.uid()` null) `ps_workspace_fixed_guard_t` 에 걸리지 않는다. 관리자 화면에 넣는 것은 다음 할 일.

## 되돌리기

`20261110_privacy_limits.rollback.sql` — 함수 여섯을 적용 전 글자 그대로(기준본 · 20261028 · 20261110_invite_hardening — 시험이 md5 로 확인), `mem_sel`, 표 권한(기준본 13절 그대로),
새 트리거 · 함수 · 검사 · 색인 · 표 삭제. **처리하지 않은 계정 삭제 요청이 있으면 멈춘다**(대기열 표를 지우면 요청을 잃는다). 지운 자료 · 고쳐 적은 신고자 · 버린 줄은 돌아오지 않는다.
이 묶음을 되돌린 뒤에야 `20261110_invite_hardening.rollback.sql` 을 돌릴 수 있다.

## 위험과 한계

- 상한(그림 1,500/24시간 · 오류 5,000/일 · 신고 30/일)은 함수 본문의 상수다. 사전 점검이 «최근 30일 가장 많은 날 < 상한의 절반»을 확인하고 아니면 적용을 멈춘다(처음 적용할 때만).
  바꾸려면 그 함수만 `create or replace` 한다.
- `ps_err` 하루 상한은 모두 합친 것이라, 누가 일부러 채우면 그날의 진짜 오류 기록이 버려진다(표가 무한히 커지는 것보다 낫다고 봤다). 채워졌는지는 `ps_rate_counters` 의 `err`.
- 계정 삭제는 한 트랜잭션에서 여러 표를 지운다. 범위를 «내 팀»으로 좁혀 색인을 타게 했지만, `ps_usage` · `ps_share` · `ps_kv_ping` 은 사람 기준 색인이 없어 순차로 읽는다(예전 함수도 `ps_usage` 를 그렇게 지웠다).
  authenticated 의 문장 시간 제한(8초)에 걸리면 통째로 물리고 앱은 실패를 알린다 — 그때는 그 표에 `(user_id)` / `(created_by)` 색인을 더한다.
- `mem_sel` 은 줄마다 `ps_team_role` 을 부른다. 앱은 표를 직접 읽지 않으므로 보통 팀원 내보내기의 한 줄뿐이다.
- 예전에 나간 팀(지금은 멤버가 아닌 팀)의 권한 문서에 남은 옛 항목은 이 함수가 찾지 않는다(범위를 «내 팀»으로 잡았다).

## 시험

`migrations/20261110_privacy_limits.local-test.cjs`(115 검사 — 기준본 + 20261028 + 20261110_invite_hardening 을 PGlite 에 올린다):
- 적용 전: 선수가 함수 · 표로 남의 이메일을 읽음 · 그림을 통째로 훑고 올린 사람을 비움 · anon 이 2099년 날짜의 1MB 오류 줄, 소유자 이름으로 200KB 신고 ·
  `99.999` + 500KB meta 한 줄로 실제 기기 여섯이 모두 «옛 판» · 계정 삭제 뒤 IDP · 판 역사 · 권한 항목 · 이벤트 · 제보 · 공유 · 보관함 · 기기 보고가 남음 · 소유자가 지우면 팀이 주인 없이 남음 ·
  anon 의 TRUNCATE 성공 · 소유자가 `kind='personal'` 로 바꿈.
- 적용 뒤: 위가 모두 막힘. 그대로인 것 — 선수: 팀원 이름 · 내 이메일 · 팀 공간 · 공지 · 내 IDP · 해시로 그림 · `ps_bootstrap`; 코치: 중복 무시 올리기; 소유자 · 임원: 이메일 · 팀원 내보내기 · 이름 바꾸기;
  anon: 앱이 보내는 30줄 오류 묶음 · 신고 · 커뮤니티 읽기; 관리자 두 화면. 상한: 1,500번째 통과 · 1,501번째 거절 · 사람별 · 24시간 뒤 풀림 · 5,000줄 뒤 조용히 버림 · 신고 30/300.
  계정 삭제: 선수(강제 모드) 표마다 0줄 · 팀과 나눈 보관함은 주인만 비움 · 남의 자료 그대로 · 대기열 · 혼자인 소유자는 팀 · 개인 공간과 판 역사까지 · 막힌 소유자는 팀원을 내보낸 뒤 됨 · 꾸민 표식 거절.
- 두 번 적용 · 되돌리기(함수 md5 · 정책 · 권한 · 트리거 · 검사가 적용 전과 같음) · 다시 적용 · 첫째 묶음 없음 / 모르는 트리거 / 다른 정책 / 이미 상한 절반을 넘는 사용 / 긴 app_version 을 보내는 앱 / 손댄 함수에서는 멈춤 ·
  어기는 옛 줄이 있으면 그 검사만 NOT VALID.
`tests/account-delete.test.cjs` — 앱의 거절 문구. `npm run test:sql` · `npm test` 에 들어 있다.
