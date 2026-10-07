# 20261007 — 유료 전환 문턱 서버 작업 세 가지 (사람이 SQL 편집기에서 실행)

Claude 의 운영 DB 쓰기는 권한 시스템이 막는다(«Modify Shared Resources»). 아래는 **읽기 전용으로 잰 근거**와 실행할 SQL 이다.
순서대로, 하나씩 실행하고 확인 줄을 본다. 셋 다 되돌릴 수 있다.

## 1. 데이터 사고 기록장 설치

`20261007_incident_ledger.sql` 전체를 붙여 실행 → `20261007_incident_ledger.verify.sql` 실행.

기대: `rls true · policies 0 · auth_select false · anon_select false · functions 5 · admin_secdef true · seeded 3`.
그 뒤 관리자 화면(admin.html) 백엔드 탭 맨 위에 «데이터 사고» 판이 뜬다(마지막 사고 10/7 00:07 뒤 며칠).
편집기의 «Potential issues» 확인창(새 표·RLS)이 뜨면 내용을 보고 실행한다. 되돌리기: `20261007_incident_ledger.rollback.sql`.

## 2. 팀 쓰기 가드 켜기 (관찰 모드 → 강제)

### 근거 (2026-10-07 읽기 전용 실측)

`ps_kv_denied` 에서 팀 쓰기 가드(`ps_kv_team_guard`)의 사유만:

| 기간 | 사유 | 역할 | 건 |
|---|---|---|---|
| 7일 | 권한은 운영진만 — 본인 등록만 반영 | 선수 | 5행 · 5명 · 풋볼A(10/5) |
| 7일 | 일정은 운영진만 | 스태프 | 1행 · JJFC(9/30, 실제 쓰기 0) |
| 30일 | 권한은 운영진만 | 선수 29 · 역할 없음 10 · 스태프 1 | 6팀 |
| 30일 | 일정은 운영진만 | 역할 없음 1 · 스태프 1 | |

- 9/30 기준선의 «코치 피드백 13» 은 사라졌다(20260930_idp_pub_write 이후 0).
- 선수 다섯의 권한 문서 쓰기는 대부분 **팀 합류 때 자기 등록**이었고, 관찰 모드라 서버에 그대로 들어갔다.
  그중 하나(10/5 20:57, 판 2.940)는 **자기 선수 연결(playerId)을 지운 채** 올렸다 — 소유자가 21:51 에 다시 이었다.
  강제 모드였다면 서버가 «옛 문서 + 자기 항목»만 남겨 연결이 지켜졌다.
- 스위치(`ps_guard_mode.enforce`)를 읽는 함수는 `ps_kv_team_guard` 하나다(`ps_1644_lineage_guard` 는 주석에만 나온다 —
  일정 권한은 이미 그쪽이 늘 막는다). 그러니 켜면 실제로 바뀌는 것은 **선수·스태프가 권한 문서의 남의 역할·연결을 바꾸는 쓰기**와
  운영진이 아닌 사람의 경기 담당 배정(`cs_assign_v1`)뿐이다. 합류(자기 등록)는 계속 된다 — 역할은 팀 기본 역할로.
- 운영 함수 확인: 길이 7542 · 강제 분기(`if enforcing then`·`new.v := merged_j`·`if not enforcing`) 있음 · 트리거 `ps_kv_team_guard_t`·`ps_kv_team_guard_insert_t` 켜짐.

### 실행

```sql
update public.ps_guard_mode set enforce = true where id = 1 returning enforce;
```

### 확인 (다음 날)

```sql
select k, left(reason,40) reason, count(*) rows, count(distinct user_id) users, max(at)
  from public.ps_kv_denied
 where at > now() - interval '1 day'
   and (reason like '권한은 운영진만%' or reason like '일정은 운영진만%' or reason like '이 자료를 편집할 권한%'
        or reason like '경기 담당은%' or reason like '다른 선수의 IDP%')
 group by 1, 2 order by 3 desc;
```

운영진·소유자가 걸려 있으면 바로 되돌린다:

```sql
update public.ps_guard_mode set enforce = false where id = 1;
```

## 3. 앱 판 하한 2.880 → 2.940

### 근거 (2026-10-07 읽기 전용 실측, 72시간 안 이벤트를 남긴 146명의 마지막 판)

| 판 | 사람 |
|---|---|
| 2.948 이상(2.948 부팅 버그 고친 판) | 85 |
| 2.940 ~ 2.947 | 41 |
| 2.940 미만 | 20 — 2.937·2.933·2.932·2.926·2.922·2.913·2.912·2.910·2.899·2.889·2.885·2.883·2.876·2.839·2.750·2.732·2.675 |

- 2.948 로 올리면 61명(42%)의 저장이 막힌다 — 아직 이르다. 판 기록은 «마지막 이벤트» 라 실제로는 이미 새 판인 사람도 섞여 있다.
- 2.940 으로 올리면 20명(14%). 이 판들은 하루 넘게 갇힌 기기(2.875·2.885·2.913 — 서버 거부 되풀이)와 2.941 이 고친
  «새 판 적용이 막히는» 버그를 가진 판이다. 막히면 저장 때 «앱을 완전히 닫았다가 다시 열면 새 판에서 저장돼요» 가 뜨고,
  그 기기의 고친 내용은 기기에 남는다(서버 판은 지켜진다).
- 2.948 이상이 90% 를 넘으면(관리자 백엔드 탭 «7일 판 분포») 2.948 로 한 번 더 올린다 — 서버 가드(20261006)가 지금은 막고 있지만
  옛 판 부팅 버그를 가진 기기가 남아 있는 한 같은 모양의 거부가 계속 난다.

### 실행

```sql
update public.ps_app_policy set min_build = '2.940', note = '2026-10-07 유료 전 문턱 — 2.941 이전 갇힘 판 차단' where id = 1 returning min_build;
```

되돌리기: `update public.ps_app_policy set min_build = '2.880' where id = 1;`
