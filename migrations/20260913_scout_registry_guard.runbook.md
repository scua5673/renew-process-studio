# 후보 원본 보호 SQL — 운영 적용 완료

2026-09-13 사용자 명시적 승인 후 대상 운영 DB에 설치했다. 카탈로그·TEMP text/jsonb 검증과 별도 후보 쓰기 제한 정책의 실제 authenticated 역할 합성 검증 15개가 통과했다. 후보 통합을 활성화하기 전에 서버 스키마와 정책을 확인하고 아래 절차를 따른다. 기존 `ps_kv_build_guard` 또는 JSON helper의 설치를 가정하지 않으며, `min_build`를 변경하지 않는다.

## 적용 순서

1. Supabase 대시보드에서 선택한 프로젝트 ref가 앱 소스의 현재 대상 **`jvtajoeptzfsdwizxejg`**와 일치하는지 확인한다. API 키를 복사하거나 출력할 필요는 없다. 같은 데이터베이스의 관리 SQL 연결에서 `20260913_scout_registry_guard.preflight.sql`을 실행한다. 팀 행은 읽지 않고 열 타입·RLS·트리거 목록만 확인한다. 대상은 `public.ps_kv` 일반 테이블, `k`는 text/varchar, `v`는 text/jsonb여야 한다. 다른 타입이나 파티션 테이블이면 진행하지 않는다.
2. 기존 트리거 목록을 검토한다. 이 보호 장치는 기존 행 단위 BEFORE UPDATE 트리거 다음에 실행한다. 이름 충돌이나 더 뒤에 실행되는 트리거가 있으면 설치가 명확한 오류로 중단된다. 기존 트리거를 삭제하거나 임의로 이름을 바꾸지 않는다.
3. `20260913_scout_registry_guard.sql`을 실행한다. 설치 트랜잭션의 잠금 대기 제한은 5초이며, 전체 실행 제한은 30초다. 시간 초과 시 부분 설치되지 않는다. 기존 팀 행·테이블 권한·RLS는 변경하지 않는다.
4. 적용 직후 `20260913_scout_registry_guard.verify.sql`을 실행한다. 설치 카탈로그 확인, 순수 JSON 함수 검사, 같은 트리거 함수를 붙인 합성 TEMP 행의 text/jsonb 쓰기 검사 후 모든 임시 변경을 ROLLBACK한다. 실제 `public.ps_kv` 행은 수정하지 않는다. 실제 테이블의 다른 트리거와 함께 실행되는 동작, 운영 RLS·REST API 요청의 대체 검증은 아니다.
5. 새 후보 클라이언트의 배포 미리보기에서 별도의 합성 워크스페이스/테스트 계정으로 정상 편집, 구버전 players-only PATCH/UPSERT 거부, 거부 뒤 원본 유지, 별도 다른 키 저장, 실제 운영진/스태프/선수 접근 정책을 확인한다. 운영 팀 기록을 검증용으로 수정하지 않는다.
6. 위 검증이 통과하면 새 후보 클라이언트를 운영 배포하고 실제 서비스가 그 빌드를 제공하는지 확인한다. 보호 장치만 설치하고 클라이언트 배포를 장시간 미루지 않는다. 새 원본이 아직 없는 팀의 legacy→legacy 쓰기는 계속 허용되며, 해당 팀에 첫 registry가 저장된 이후부터 구버전 덮어쓰기 차단이 작동한다.

## 보장과 경계

- 이미 `scoutRegistry.v=1`인 후보 행을 UPDATE할 때만 보호한다. 레지스트리 제거, 기존 후보 ID 제거, 원본·점수·질문·관찰 및 기존 이력의 유실을 거부한다. 정상 수정은 이전 값을 해당 이력에 남기면 허용한다. 비어 있고 수정 도장이 없던 기본값의 첫 채움은 허용한다.
- 현재 후보 선택·이력 병합·경합의 승자 판정은 새 클라이언트가 계속 담당한다. 이 SQL이 임의 문서를 병합하거나 완전한 앱 스키마 검사를 대신하지 않는다. 후보를 처음 만드는 INSERT와 기존 legacy-only 문서의 변경은 기존 동작을 유지한다.
- **같은 SQL 문장은 원자적이다.** 구버전이 후보와 일지 등을 한 POST/UPSERT 묶음으로 보냈다면 후보 거부 시 그 문장 전체가 롤백된다. 별도의 다른 키 요청만 영향이 없다. 새 registry 생성 이후 이런 저장 실패가 생긴 구버전 기기는 입력을 보존한 채 새로고침/앱 업데이트하고, **새 클라이언트에서 서버 원본을 다시 읽어 합친 뒤 저장을 재시도**해야 한다. 403 위장이나 부분 성공 응답을 사용하지 않는다.
- DELETE/TRUNCATE 정책과 팀 삭제 cascade는 변경하지 않는다. 기존 정책이 허용하는 행 삭제, 관리자에 의한 트리거 비활성화/우회, 과거에 이미 유실된 원본의 복구까지 보장하지 않는다. DELETE까지 막으려면 계정·팀 삭제 흐름을 별도로 검토해야 한다.
- 순수 JSON 검사 함수 두 개에는 PUBLIC EXECUTE를 명시한다. 입력받은 JSON만 검사하고 팀 행을 읽거나 쓰지 않으며 SECURITY INVOKER로 실행한다. 이 명시적 권한은 DB의 강화된 기본 함수 ACL 때문에 정상 후보 저장이 막히지 않도록 한다. 트리거 함수 자체의 PUBLIC 실행 권한은 제거한다.
- 향후 BEFORE UPDATE 트리거를 추가/변경하면 verify SQL을 다시 실행한다. 서버 이력/백업 보관 기간은 이 파일 묶음으로 확인하지 않았다.

## 되돌리기

먼저 후보 통합 쓰기를 비활성화하거나 호환성 문제를 해결한다. `20260913_scout_registry_guard.rollback.sql`은 이 마이그레이션 표식이 있는 트리거와 함수만 제거하며 데이터와 RLS를 변경하지 않는다. 예상치 못한 의존성이 있으면 CASCADE 없이 중단한다. 제거 직후 구버전 덮어쓰기가 다시 가능해진다.

## 실제 테이블 결합 검증

2026-09-13 명시 승인 후 `20260913_scout_registry_guard.synthetic-verify.sql`을 운영에서 실행해 10개 결과가 모두 통과했다. 새 가상 UUID만 사용해 admin/executive 각각 정상 이력 보존 수정, 구버전 UPDATE·UPSERT와 혼합 UPSERT의 정확한 guard 23514 거부, 후보/공지 원문과 cupd 보존, 별도 공지 저장을 확인하고 전체 ROLLBACK했다. 실제 팀 자료와 auth.users는 수정하지 않았다. 사전 격리 검증은 `20260913_scout_registry_guard.synthetic-local-test.cjs`에 있다.

이 DB 검증은 실제 운영 트리거와 authenticated 권한을 함께 거친 결과이며, 브라우저 로그인 토큰 발급·REST 전송 전체와 실물 기기 검증은 별도다.

## 로컬 실행 기록

공식 npm `@electric-sql/pglite@0.5.8`을 `/private/tmp/process-scout-sql-runtime`에 설치해 메모리 안의 PostgreSQL에서 확인했다. 실제 계정·서버 연결 없이 현재 `studio/scouting-store.js`의 실제 helper가 만든 문서를 사용한다.

```sh
PGLITE_MODULE=/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite \
  node migrations/20260913_scout_registry_guard.local-test.cjs
```

검증 범위: text/jsonb, 사진 삭제·교체·중복 원문 정규화, 기본값 재가져오기, 점수 0과 수정, 질문 교체·삭제, 후보 보관·복원, 동시 새 배치 합치기, 관찰 이력, 구버전 UPDATE/UPSERT, 혼합 요청의 원자적 롤백, 기존 RLS·테이블 ACL 보존, 강화된 기본 함수 ACL, 기존 트리거 순서·이름 충돌, 타입 사전 검사, 반복 설치·검증·되돌리기. 결과는 최종 helper 기준 runner를 다시 실행해 확인한다.
