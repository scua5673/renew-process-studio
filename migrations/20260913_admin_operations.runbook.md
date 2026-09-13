# 관리자 운영 메모와 기기 상태 보고

이 변경은 신규 운영 메타데이터만 추가한다. 기존 `ps_kv`, `ps_events`, 관리자/멤버 판정 함수, 사용자 기록, 기존 정책과 트리거는 수정하지 않는다. 준비·로컬 검증과 운영 적용은 별개다.

## 적용 전후

1. `.preflight.sql`로 기존 관리자/멤버 함수와 참조 ID 형식, 새 이름 충돌을 확인한다. 예상 함수는 `auth.uid()`, `ps_is_admin()`, `ps_is_member(uuid)`이다. 기존 함수를 바꾸어 새 기능을 맞추지 않는다.
2. `.local-test.cjs`를 PGlite에서 실행한다. 운영 DB에 `local-fixture.sql` 또는 테스트 러너를 연결하지 않는다.
3. 확인된 운영 프로젝트에서 `.sql` 전체를 한 트랜잭션으로 적용한다. 신규 테이블 3개, 인덱스 3개, 제한된 RPC·내부 검증 함수를 만든다.
4. `.verify.sql`로 신규 RLS·ACL·함수 고정 검색 경로를 검증한다. 관리자 읽기와 실제 사용자 보고의 연결은 별도 제품 검증에서 확인한다. 로컬 검사는 운영 계정 검증을 대신하지 않는다.
5. 실패하면 `.rollback.sql`로 새 RPC 접근을 끈다. 테이블·메모·변경 감사·보고는 지우지 않는다. 재적용하면 접근이 복구된다. 이름의 소유 표식이 다르면 설치와 롤백 모두 중단한다.

로컬 실행:

```sh
node migrations/20260913_admin_operations.local-test.cjs
```

## API 계약

모든 RPC는 JSON 값을 직접 반환한다. 목록은 JSON 배열이며 0행은 `[]`다. 조회 권한·호출 오류를 빈 목록으로 바꾸면 안 된다. 일반 클라이언트에는 테이블 SELECT/DML 권한이 없다. 서버 관리자 검사는 매 요청 실행한다.

- `ps_admin_followups_list(p_user_id uuid = null, p_workspace_id uuid = null)`: 관리자 전용, 두 필터가 있으면 AND 조건. 수정 시각 내림차순.
- `ps_admin_followup_save(p_id uuid, p_expected_version integer, p_fields jsonb)`: 관리자 전용, **전체 필드 스냅샷**. 생성은 ID null/버전 0, 서버가 UUID·버전 1을 만든다. 수정은 기존 ID·현재 버전 필수다. 작성자·수정자·시각·버전은 서버가 결정한다. 충돌은 `PT409`, 없는 항목은 `PT404`다. 응답이 불확실한 생성 요청은 자동 재전송하지 말고 목록에서 생성 여부를 먼저 확인한다.
- `ps_sync_report_put(p_device_id uuid, p_workspace_id uuid, p_report_seq bigint, p_fields jsonb)`: 인증된 본인이 멤버인 공간에만 최신 보고를 쓴다. UID는 JWT에서 결정한다. 동일/이전 순서는 `PT409`로 거부한다. 순서는 계정·기기·공간별로 단조 증가시킨다. 계정·공간이 바뀐 후 이전 보고를 새 UID로 재전송하지 않는다.
- `ps_admin_sync_reports_list(p_user_id uuid = null, p_workspace_id uuid = null)`: 관리자 전용, 수신 시각 내림차순. 목록에는 각각의 서버 수신 시각 `received_at`을 포함한다.

입력 오류는 `22023`, 인증·권한 오류는 `42501`이다. 알려지지 않은 필드, 다른 자료 본문, 임의 UID·서버 시각 필드는 거부한다. 보고의 계수는 null 또는 0~100000 정수다. null은 미확인을 뜻하며 0으로 바꾸지 않는다. 시간은 시간대가 있는 ISO 8601 문자열 또는 null이다.

`error_code`는 null 또는 다음 값만 허용한다: `sync_offline`, `sync_auth`, `sync_permission`, `sync_storage`, `sync_network`, `sync_timeout`, `sync_server`, `sync_rate_limit`, `sync_conflict`, `sync_server_rejected`, `sync_confirm_missing`, `sync_unexpected`.

## 해석과 보관

- `ps_sync_reports`는 **클라이언트가 보고한 상태**다. `last_round_ack_at`도 클라이언트가 주장한 마지막 회차 확인 시각이며 해당 문서의 독립적인 서버 검증이나 상대방 열람 증거가 아니다.
- `received_at`은 서버가 보고를 받은 시각이다. 늦거나 끊긴 기기의 마지막 행을 현재 정상 상태로 표시하지 않는다. 연결이 끊겨 새 보고를 못 보내는 기기를 목록 부재만으로 정상 처리하지 않는다.
- 기기 ID는 설치/프로필별 임의 UUID이고 하드웨어 ID가 아니다. 다른 브라우저·재설치로 바뀔 수 있으며 사용자 수로 세지 않는다.
- 보고에는 본문, 제목, 선수 평가, 키·몸무게, 오류 메시지, 토큰을 담지 않는다. 운영 메모는 담당·지원 상태·후속 확인을 위한 짧은 메모만 수동 작성한다.
- 변경 감사에는 변경 필드명·작성자·버전·시각만 남는다. 과거 메모 본문을 복구하는 이력 기능이 아니다. 종료는 삭제 대신 `closed` 상태로 남긴다.
- 정상 보고 수신 시 해당 계정의 30일 초과 보고를 최대 100행 정리한다. 다시 접속하지 않는 계정의 보고까지 30일 안에 정리하려면 아래 작업을 신뢰할 수 있는 서버 관리 스케줄러에 **별도로 등록**해야 한다. 이 마이그레이션은 cron이나 기존 야간 작업을 변경하지 않는다.

서버 관리 스케줄러용 일일 정리 SQL(한 실행 최대 1000행, 실제 운영 등록은 별도 확인):

```sql
DELETE FROM public.ps_sync_reports t
USING (
  SELECT user_id, device_id, workspace_id
  FROM public.ps_sync_reports
  WHERE received_at < clock_timestamp() - interval '30 days'
  ORDER BY received_at
  LIMIT 1000
) expired
WHERE t.user_id=expired.user_id
  AND t.device_id=expired.device_id
  AND t.workspace_id=expired.workspace_id
  AND t.received_at < clock_timestamp() - interval '30 days';
```

소프트웨어 출시만으로 데이터가 모두 측정된다고 표시하지 않는다. 새 수집 시작일·미측정·조회 실패를 구분한다.
