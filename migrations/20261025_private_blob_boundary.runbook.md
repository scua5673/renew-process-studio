# privacy-blob-boundary — 원문과 사진의 접근 범위 일치

이 묶음은 운영 미적용 상태다. `20261025_library_recovery` 다음에 적용한다. 앱 판 번호와 관계없이 기존 REST wire 형식은 유지한다. 기존 `ps_kv`, `ps_library`, 역사 원문, `ps_blob` 바이트·시각을 수정하거나 지우지 않는다. 새 표는 참조 인덱스와 잠깐의 업로드 증명뿐이다.

## 근거와 보장

기존 `ps_blob_sel`은 membership만 검사한다. 합성 actual authenticated SQL 역할로 다음을 재현한다: private library 원문 0행/사진 1행, player의 `scout_tool_v1` 원문 0행/사진 1행, personal workspace에 잘못 membership이 있는 다른 사람의 private-board 원문 0행/직접·legacy 참조 사진 1행. 현재 정상 private-board writer는 사진을 일반 `blobPrepRows`로 분리하지 않으므로 마지막 경우를 현재 정상 UI의 업로드 경로라고 주장하지 않는다. 현재 `libShareCopy`는 사진을 제거하며, private library media는 기존·직접 참조와 후속 private media 보존 writer까지 보호하는 범위다.

- SELECT는 기존 membership 조건에 더해 실제 현재 원문 RLS로 읽을 수 있는 참조가 있어야 한다. 현재 KV·보관함, KV 역사 RPC, 소유자 전용 보관함 역사가 대상이다. 다른 팀·퇴단자·다른 소유자·학생의 비공개 원문 접근을 넓히지 않는다.
- `ps_blob_reader_v1`은 로그인·superuser·BYPASSRLS·역할 관리 권한이 없다. authenticated를 상속하지만 반대 방향으로 부여하지 않는다. reader가 소유한 읽기 함수는 archive SECURITY DEFINER 안에서도 RLS를 적용한다. 논슈퍼유저 관리자의 소유자 이전은 원자 DO 안에서만 public CREATE와 필요한 SET 권한을 잠깐 부여한다. PG16+ 임시 membership은 INHERIT FALSE이며 ACL·COMMENT는 reader로 SET LOCAL ROLE하여 적용하고, 기존 grantor별 ADMIN/INHERIT/SET 세 옵션을 그대로 복원한다. 새 임시 membership 행은 완전히 제거한다.
- 원문에 **새로 붙는** 참조는 이미 읽을 수 있던 사진 또는 방금 같은 바이트를 업로드한 증명이 필요하다. 기존 참조는 변경 없이 유지한다. archive RPC는 untrusted snapshot에 `ps_blob_assert_refs_v1(wid,item,NULL)`을 호출해야 한다. 이전 원문 인수를 클라이언트 입력으로 만들어 넘기면 안 된다.
- 기존 클라이언트는 `GET ps_blob?select=h` → `INSERT ... ON CONFLICT DO NOTHING` → 부모 저장 순서다. GET은 사진 SELECT와 같은 정책이다. 업로드 trigger만 30분 증명을 발급하며 공개 stage RPC는 실행할 수 없다. proof는 SHA-256(바이트)에 묶이고 같은-h 업로드는 advisory transaction lock 뒤 기존 바이트와 비교한다. 같은 사진을 가진 다른 소유자의 정상 dedup은 허용하며, 다른 바이트는 PT409로 거절한다.
- PostgreSQL은 ON CONFLICT에서도 SELECT RLS를 평가한다. 그래서 본인이 정확한 바이트를 올린 30분 동안은 해당 사진만 SELECT할 수 있다. 해시만 아는 사람은 증명을 얻을 수 없다. 이 증명 확인 함수의 VOLATILE은 BEFORE trigger에서 방금 쓴 proof를 같은 INSERT가 보기 위해 필요하다.
- 고아·잘못된 JSON·유실된 사진을 삭제하지 않는다. 신규 무단 참조는 실패하고 현재 원문은 남는다. 이미 다른 사용자의 기기에 정당하게 내려간 사진을 서버 정책으로 회수할 수는 없다. 앱 로컬 캐시는 별도의 uid/workspace 격리가 필요하다.

## 적용 전

1. 별도 stage Supabase 프로젝트에서 먼저 적용하고 실제 stage 로그인/REST 저장을 확인한다. testprocess 앱의 API 대상도 해당 stage 프로젝트인지 확인한다. 운영 계정이나 실제 팀을 시험 자료로 쓰지 않는다.
2. `20261025_private_blob_boundary.preflight.sql`을 실행한다. 카탈로그만 읽는다. RLS·기존 정책·함수·역할을 검토한다. `ps_blob_sel`이 리뷰한 membership 정책과 다르거나 새 이름이 이미 있으면 설치는 멈춘다.
3. `20261025_private_blob_boundary.dryrun.sql`을 실행한다. 표별 행 수·원문 총 문자 수·참조 후보 수·blob 총 문자 수만 출력하고 원문·해시·계정 식별자는 출력하지 않는다. 물리 백업의 최신 상태와 적용 담당자를 확인한다.
4. library recovery migration과 owner-only history RLS가 먼저 있어야 한다. 원문 파싱·참조 backfill 동안 관련 다섯 표 쓰기를 잠근다. 조용한 시간에 실행한다. 잠금 대기 5초 또는 문장 2분을 넘으면 트랜잭션 전체가 실패하여 기존 보호/원문이 유지된다. timeout을 무작정 올리지 말고 추정 크기·부하·실패 위치를 확인한다.

## 적용과 확인

1. `.sql` 한 파일을 관리 SQL 세션에서 실행한다. 첫 설치 전용이며 재실행은 이름 충돌로 안전하게 멈춘다. 예상치 못한 기존 객체를 덮지 않는다.
2. `.verify.sql`을 실행한다. 카탈로그와 합성 literal만 읽는다. 정책·reader role·함수 권한·trigger·parser를 검사한다. 실제 팀 내용을 확인하는 대체 검증은 아니다.
3. stage 테스트 계정으로 owner/staff/player/다른 팀/탈퇴의 원문과 직접 사진 GET을 함께 확인한다. private→shared→private 전환, cold cache, 동일 사진 다른 private owner dedup, 업로드 후 부모 저장 실패·재시도, own-history 복구, 다른 owner archive/hash 주입 거부를 확인한다. 다른 기기에 이미 있던 사본은 별도로 취급한다.
4. `pg_cron`이 있으면 시간당 `ps-blob-upload-proof-trim`이 만료 proof를 지운다. 없어도 만료 proof는 권한을 주지 않으며 업로드 때 본인 만료 proof를 정리한다. 운영 적용 전 scheduler 존재와 실패 관측을 확인한다. proof에는 사진 바이트가 없다.
5. 운영 적용은 stage 검증과 승인 뒤 별도로 수행한다. `.applied.md`에 프로젝트·시각·verify 결과·원문 불변 확인 결과를 남기고, 운영 기준본은 추출 도구로 갱신한다. 기준본을 손으로 수정하지 않는다.

## 새 프로젝트 복구

이번 변경의 `00000000_baseline.catalog.sql`은 **managed reader 한 역할의 속성·authenticated 상속·안전한 함수 소유자·ACL·COMMENT를 보존**한다. 원본 또는 대상 역할이 위험하면 복원을 거부한다. 실제 history/privacy migration → 읽기 전용 catalog 반출 → 빈 DB의 논슈퍼유저 관리자 복원 왕복은 `20261025_private_reader_restore.local-test.cjs`에서 검증한다. 이것은 실제 백업 복원 훈련을 대신하지 않는다.

이 문서를 작성할 때 저장소의 `00000000_baseline.sql`은 2026-10-23 추출본이며 새 migration이 아직 포함되지 않았다. 그 기존 기준본으로 빈 프로젝트를 준비한다면 library recovery → 본 forward migration 순으로 **추가 적용**해야 한다. 운영 적용 뒤에는 새 catalog 추출기로 실제 기준본을 다시 받아 갱신한다. 갱신된 기준본에 본 객체가 들어 있으면 역할·함수 소유자 복원 블록을 포함해 복원하며 본 forward migration을 다시 실행하지 않는다. 이름 충돌을 무시하거나 함수를 postgres 소유로 바꿔 통과시키지 않는다. 어느 경로든 verify와 actual-role 원문/사진 판정 동일성 확인이 완료 조건이다.

## 로컬 시험

`node migrations/20261025_private_blob_boundary.local-test.cjs`는 연결 문자열 인자가 없는 메모리 PGlite 시험이다. 기준본의 실제 권한 함수/정책과 library recovery migration을 사용한다. 원정책 노출 재현, 원문·바이트 불변, role/tenant/source/history 제한, 신규 참조 세탁·definer 우회·공개 proof 선점 거부, 업로드 순서·dedup·내용 충돌·proof 만료와 retry, 공유 취소·membership 취소·역사 trim, 원문+세 종류 사진 참조 복구·missing-media 원자적 실패, rollback을 확인한다.

## 되돌리기

먼저 호환성 실패를 구체적으로 확인하고 가능하면 forward fix한다. `.rollback.sql`은 이 묶음의 참조 표·proof·정책·trigger·함수·reader만 제거하며 기존 원문/사진을 수정하지 않는다. **기존 membership-only 사진 정책이 다시 열리므로 private 사진 경계가 되돌아간다.** 별도 승인과 사고 기록 없이 운영 rollback하지 않는다. library recovery archive/restore RPC는 assert helper가 없어지면 실패하여 자료를 보존한다. unknown dependency는 CASCADE 없이 멈춘다.
