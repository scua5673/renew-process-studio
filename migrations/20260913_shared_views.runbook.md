# 선수 경기 화면 표시의 기기 보고

신규 `ps_shared_views`와 RPC 두 개만 추가한다. `20260913_admin_operations.sql`과 독립 적용 가능하며 기존 기록 테이블·RLS·트리거·권한 함수를 바꾸지 않는다. 이미 적용된 초기판에는 같은 멤버 관계만 검사하는 RPC가 있으므로, 이번 파일 전체를 다시 적용해 보고자의 코치 역할 조건을 추가한다. 기존 보고 행과 함수 소유 표식은 유지한다.

- `ps_shared_view_put(p_workspace_id uuid, p_subject_user_id uuid, p_view_kind text='player_matches')`는 로그인한 actor와 subject가 서로 다르고 같은 공간의 멤버이며, 기존 `ps_team_role(workspace_id)`가 actor를 `admin`, `executive`, `staff` 중 하나로 판정할 때만 최신 보고를 저장한다. 선수 역할의 직접 호출은 거부한다. actor UID와 received_at은 서버가 결정한다. 개별 경기 ID·리뷰·내용·기기 원문을 받지 않는다.
- `ps_admin_shared_views_list(p_user_id uuid, p_workspace_id uuid=null)`는 서비스 관리자만 호출한다. actor 또는 subject가 해당 사용자인 최근 30일 최신 행을 수신시각 내림차순으로 최대 100개 반환한다. 배열이 100개면 UI에는 ‘최근 100건까지 표시’ 안내를 한다. 100개가 전체 건수라고 단정하지 않는다. 목록 부재는 확인 불가이며 ‘상대가 읽지 않음’이 아니다.
- 의미는 **해당 선수의 경기 화면을 기기에서 표시했다는 보고**다. 개별 리뷰를 실제 읽었음·이해했음·서버가 열람을 독립 검증했음으로 표시하지 않는다. 사람 수나 열람 횟수가 아니라 actor/공간/subject/종류별 마지막 시점이다.
- 새 테이블에 RLS를 켜고 일반 클라이언트의 직접 읽기·DML을 모두 막는다. 저장 RPC는 현재 JWT·멤버 관계·코치 역할을, 조회 RPC는 기존 `ps_is_admin()`을 검사한다. 서비스 관리자여도 해당 공간의 멤버가 아니면 저장할 수 없다.
- 이 RPC는 화면 본문에 대한 열람 권한을 부여하지 않는다. 실제 화면의 기존 권한 검사를 통과하고 화면이 표시된 뒤에만 클라이언트가 호출해야 한다. 서버는 회원 관계와 역할을 확인해 보고를 접수하므로 값은 client-reported 신호로 사용한다. 역할 강등은 이후 보고와 수신시각 갱신을 막으며, 이전 보고는 당시의 기기 보고로 만료 시점까지 남는다.

적용 전에 운영 카탈로그로 `auth.uid() RETURNS uuid`, `ps_is_admin() RETURNS boolean`, `ps_is_member(uuid) RETURNS boolean`, `ps_team_role(uuid) RETURNS text`와 `ps_members(workspace_id,user_id)`의 UUID 형식을 확인한다. `.sql`의 preflight가 이 계약을 재확인한다. 2026-09-13 확인한 기존 팀 역할 함수는 `cs_perms_v1`의 개인 역할·기본 역할과 owner 예외를 사용한다. 멤버 검사를 별도로 유지하므로 함수의 개인 공간·누락 문서 시 admin 기본값만으로 외부인이 보고할 수 없다. 권한 함수 자체를 바꾸거나 기본 역할 정책을 재정의하지 않는다.

`.local-test.cjs`를 로컬 PGlite에서 실행하고, `.sql` 전체 재적용 후 `.verify.sql`로 검사한다. verify는 읽기 전용 카탈로그 검사로 역할 조건이 없는 초기 RPC도 거부하지만, 실제 역할별 호출 결과를 증명하는 검사는 아니다. 운영 적용과 필요한 합성 역할 검증은 root가 별도로 수행한다. `.rollback.sql`은 새 RPC 권한만 끄고 데이터는 보존한다.

로컬 검증은 55개 assertion을 통과했다. 격리 fixture가 확인된 팀 역할 함수와 권한 JSON을 사용하며 admin/executive/staff 허용, 선수 직접 RPC 거부, 역할 강등 시 기존 보고 보존, 재승격, 멤버 탈퇴, 기존 함수·RLS·grants 불변, 반복 적용·되돌리기를 확인했다. 이 결과는 운영 사용자 자료를 사용하지 않은 로컬 결과다. 실제 전송 어댑터와 화면 관측 모듈은 별도 71개 회귀에서 계정·팀·소유권·화면 변경 중 전송 차단과 오류 격리를 통과했다.

새 보고에서 본인의 30일 초과 행을 최대 100행 정리한다. 다시 접속하지 않은 계정의 보고는 서버 관리 스케줄러에 별도 일일 정리를 등록해야 물리적으로 만료된다. 이 마이그레이션은 cron을 자동 등록하지 않는다. 목록은 물리 정리 여부와 관계없이 최근 30일만 반환한다.

서버 관리 작업 예시(실제 등록은 별도 확인):

```sql
DELETE FROM public.ps_shared_views t USING (
  SELECT user_id,workspace_id,subject_user_id,view_kind FROM public.ps_shared_views
  WHERE received_at<clock_timestamp()-interval '30 days' ORDER BY received_at LIMIT 1000
) expired
WHERE t.user_id=expired.user_id AND t.workspace_id=expired.workspace_id
  AND t.subject_user_id=expired.subject_user_id AND t.view_kind=expired.view_kind
  AND t.received_at<clock_timestamp()-interval '30 days';
```

검증과 보고는 실제 사용자·팀 자료를 이용하지 않는다.
