# 후보 쓰기 권한 보완 — 운영 적용 완료

이 보완은 후보 원본 보존용 `20260913_scout_registry_guard.sql`과 별개다. 원본 보호 장치는 DELETE 정책을 바꾸지 않는다. **이 추가 보완은 authenticated 역할의 후보 INSERT·UPDATE·DELETE를 제한한다.** 2026-09-13 명시 승인 후 운영에 설치했으며, 카탈로그와 실제 authenticated 역할/JWT 문맥의 합성 검증 15개를 통과했다. 앱 로그인 토큰·REST 전송과 실물 기기 현장 검증은 이 결과에 포함하지 않는다.

## 확인된 범위

2026-09-13 읽기 전용 운영 catalog에서 `cs_scout_targets_v1`의 읽기는 `ps_is_member(wid)`와 역할 `executive/admin`으로 제한되지만, 쓰기 helper는 스태프 또는 `scout` 범위가 있는 멤버를 허용할 수 있음을 확인했다. TKEY의 실제 scope는 `scout`이다. 새 행의 plain INSERT는 읽기 권한 없이 성공할 수 있으므로 RETURNING이 붙은 요청의 거부만으로 안전하다고 판단하지 않는다.

새 정책 세 개는 기존 permissive 정책 결과에 AND로 적용되는 RESTRICTIVE 정책이다. 다른 키는 true를 반환한다. 후보에만 기존 `ps_can_read_key(workspace_id,k)`를 재사용하며, 기존 함수·정책·테이블 GRANT를 수정하거나 RLS를 비활성화하지 않는다. UPDATE는 기존 행의 USING과 새 행의 WITH CHECK를 모두 제한한다.

권한 기준은 현재 읽기 helper에 의존한다. 나중에 그 helper의 TKEY 분기가 바뀌면 쓰기 제한도 함께 바뀌므로 재검증해야 한다. 기존 helper가 권한 문서 미존재를 admin으로 취급하는 부트스트랩 규칙은 이번 보완에서 변경하지 않는다. 테이블 소유자·service role의 기존 RLS 우회 권한이나 팀 삭제 FK cascade도 새로 제한하지 않는다.

## 승인 후 적용 순서

1. 대상 프로젝트 ref `jvtajoeptzfsdwizxejg`와 승인 범위를 확인한다. 실제 관리 권한으로 실행한다. API 키를 조회·출력할 필요는 없다.
2. `20260913_scout_write_scope.sql`을 실행한다. 테이블 RLS 상태·authenticated 역할·기존 read helper·정책 이름 표식을 확인하고, 짧은 테이블 잠금 안에서 정책 세 개만 설치한다. 권한 변경 범위는 후보 쓰기의 축소다.
3. `20260913_scout_write_scope.verify.sql`로 정책 개수·명령·RESTRICTIVE 속성·authenticated 대상·표식과 실제 조건을 확인한다. 이 단계는 catalog 검사이므로 실제 RLS 저장 결과의 대체 증거가 아니다.
4. 승인받은 뒤 `20260913_scout_write_scope.synthetic-verify.sql`을 하나의 트랜잭션으로 실행한다. 아래 합성 시험 범위와 결과를 확인한다. 원본 보존 guard의 별도 검증도 마친다.
5. 앱 admin/executive 양성 대조와 제한 대상의 거부, 다른 키 저장이 확인된 뒤 새 후보 클라이언트를 배포한다. 저장 거부와 양성 대조 실패를 혼동하지 않는다. 실패 시 SQLSTATE와 합성 결과를 검토하고 그 결과에 맞춰 수정한다.

## 합성 운영 시험

운영용 SQL을 명시 승인 후 실행했으며 15개 기대 결과가 일치했다. 마지막 ROLLBACK 이후 가상 워크스페이스 잔여 수 0을 별도 조회로 확인했다. 확인된 스키마에는 사용자 FK가 없어 **auth.users를 만들지 않는다.** 매 케이스마다 새 UUID의 workspace·member·권한 문서만 생성한다. 관련 workspace/member 사용자 트리거가 없고 KV의 감사·이력·거부·핑 호출 체인은 DB 내부 쓰기뿐이며, 이 보조 테이블들에 추가 사용자 트리거/FK가 없다는 catalog 확인을 전제로 한다.

관리자 연결은 합성 자료 준비와 결과 확인에만 사용한다. 시험 쓰기는 `SET LOCAL ROLE authenticated`로 실행하며, 실제 `current_user`, `auth.uid()`, `auth.role()`, `auth.jwt()`가 합성 행위자와 일치하는지 검사한다. individual/plural JWT GUC를 모두 같은 합성 값으로 설정한다. 실제 인증 토큰을 사용하지 않는다.

- 앱 admin/executive 양성 대조를 먼저 확인한다. 이 쓰기도 DB authenticated 역할에서 실행한다.
- 스태프, 선수, `scout` 범위가 있는 선수, 비멤버의 후보 plain INSERT를 RETURNING 없이 실행한다. UPDATE/UPSERT/범위를 한정한 DELETE를 별도로 확인한다.
- 동일 `team` 범위이며 경기 lineage 검사와 무관한 `cs_team_notice_v1`을 다른 키 대조로 사용한다.
- SQLSTATE 42501, 내용 guard의 23514, FK/NOT NULL 같은 준비 실패를 구분한다. 영향 행수와 관리자 문맥에서 읽은 **해당 합성 UUID+키**의 실제 값으로 판단한다. 성공 응답이나 UPDATE 0행만으로 권한이 검증됐다고 말하지 않는다.
- 운영 SQL의 DELETE/UPDATE는 모두 합성 UUID+키로 제한한다. WHERE에서 열을 참조하면 SELECT 정책도 관여할 수 있으므로 이 scoped DELETE를 blind DELETE의 단독 증거로 삼지 않는다. WHERE/RETURNING 없는 blind DELETE는 격리 로컬 DB에서만 시험한다. 운영 `ps_kv`에 무조건 DELETE를 실행하지 않는다.

마지막 ROLLBACK으로 합성 workspace/member/KV와 트리거가 쓴 감사·이력·핑·거부 행을 남기지 않는다. 보조 테이블이 시퀀스 ID를 사용한다면 소비된 번호는 롤백되지 않을 수 있다. 정책·GRANT·트리거를 바꾸거나 임시로 꺼서 시험하지 않는다. DB 안의 인증 문맥/RLS/트리거 검증이며 실제 REST 전송과 로그인 토큰 발급 전체의 대체 시험은 아니다.

## 로컬 검증과 되돌리기

`20260913_scout_write_scope.local-fixture.sql`은 비어 있는 격리 PGlite 전용이다. 운영 catalog에서 확인한 membership/owner/team-role/read/write helper와 비IDP permissive 정책 네 개를 재현한다. `ps_key_scope`는 시험하는 TKEY=`scout`, 공지=`team` 두 분기만 포함하며, 무관한 IDP 정책·운영 데이터·운영 트리거를 복제했다고 주장하지 않는다. 이 파일을 운영 DB에 실행하면 안 된다.

```sh
PGLITE_MODULE=/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite \
  node migrations/20260913_scout_write_scope.local-test.cjs
```

최종 로컬 결과: **134개 검사·역할별 동작 100회 통과**. 기존 정책의 스태프 blind INSERT/DELETE와 `scout` 범위가 있는 선수의 blind INSERT를 재현하고, 새 정책에서 차단됨을 확인했다. executive/admin/owner 정상 동작, 다른 키의 역할별 결과 불변, 원정책·함수·GRANT 보존, 표식 충돌, 반복 설치·되돌리기도 확인했다. 운영용 합성 SQL 자체는 같은 로컬 엔진에서 **15개 기대 결과 일치 및 workspace/member/KV 전체 롤백**을 확인했다. 이는 운영 서버에서 실행했다는 뜻이 아니다.

`20260913_scout_write_scope.rollback.sql`은 이 마이그레이션 표식이 있는 세 정책만 제거한다. 기존 함수·정책·GRANT와 데이터는 유지하지만 이전 후보 쓰기 허점이 다시 열린다. 예상된 권한 거부를 없애기 위한 임시 우회로 사용하지 않는다.
