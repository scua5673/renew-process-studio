# 2.792 운영 적용 기록

2026-09-13 12:49 UTC 기준. 운영 프로젝트 jvtajoeptzfsdwizxejg의 로그인된 SQL 편집기에서 적용했다. 사용자 본문·토큰을 조회하거나 테스트 기록을 운영에 생성하지 않았다.

- 사전 카탈로그: auth.uid UUID, ps_is_admin/ps_is_member boolean, ps_team_role text, 신규 객체 이름 충돌 없음, anon/authenticated 모두 superuser·RLS 우회 권한 없음.
- 관리자 운영 테이블 3개와 공유 표시 테이블 1개 설치 후 각 verify.sql 성공.
- 공유 보고 함수의 코치 역할 검사 보강본 재적용 후 admin_2792_coach_role_verified 확인.
- PostgREST 스키마 갱신 통지 실행.
- 익명 실제 HTTP 조회 3종은 모두 401 / SQL 42501로 거부됨.
- 로컬 격리 SQL 검사: 운영 메모·보고 107개, 공유 표시 55개 통과.
- 로컬 앱 회귀 1009개, WebKit/Chromium 각 390·1024·1440px 관리자 흐름 통과.

## 적용 SQL SHA-256

- 20260913_admin_operations.sql: `5e996e1d063a1baa026c207e80e6f51760d86ebc08465941db0778db3507c375`
- 20260913_shared_views.sql: `62f79f1e9df642b730f0cddc078492cde973d53661712fd56706ac35736424a1`

SQL 설치는 실제 사용자 기기 사용 검증과 별개다. 새 보고는 업데이트 이후 사용분부터 수집되며 과거 기록은 소급 생성하지 않는다. 기기 보고는 전체 저장 성공이나 개별 경기 읽음 증명이 아니다.
