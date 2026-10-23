# 이미지 첨부 서버 적용 확인

- 적용: 2026-10-23T13:48:17.855Z (UTC 확인 시각) · 프로젝트 jvtajoeptzfsdwizxejg.
- 사용자가 “너가 전부 직접해줘”로 준비된 SQL의 직접 실행을 명시 승인했다. 이 설치에 한해 기존 수동 적용 절차를 대신했다.
- 로그인된 Supabase SQL Editor에서 postgres 역할로 preflight → 설치 SQL 전체 → verify 실행. 결과: support-images-v1-ready.
- 설치 SQL SHA-256: a17a86e6ba615988d51721e03fa7bd367eff6feae3f71182c7a990560cab4f80.
- 별도 이미지 테이블/RLS/함수 권한/소유 표시를 운영 서버에서 검사했다. 기존 제보·답변·실계정 앱 저장소를 수정하거나 테스트 제보를 등록하지 않았다.
- 운영 카탈로그와 cron 정의는 읽기 전용으로 받아 00000000_baseline.sql에 보관했다. 계정/팀 행 데이터는 포함하지 않는다. 토큰·이메일·인증 문자열 검사를 통과했다.
- 기능 검증: 합성 SQL48검사, Chromium/WebKit 네 폭, 기존 제보·관리자 답변, 실제 셸 CSS 네 폭 통과. 최종 단위4,237건. 적용 전 커밋265cc50의 CI39953758031 전체18 success.
- 앱 배포는 별도 staging/production 절차에서 정확한 커밋·ready·공개 파일을 확인한다. 설치만으로 앱 배포 완료를 의미하지 않는다.
