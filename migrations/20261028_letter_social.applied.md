# 적용 기록 · 2026-10-28 KST

사용자가 ‘실서버에 반영’을 승인한 뒤 운영 Supabase 프로젝트 jvtajoeptzfsdwizxejg에 적용했다.

- 사전 점검: auth.uid, anon, authenticated 준비. 새 표 두 개 모두 존재하지 않음.
- SQL 편집기 실행 결과: Success. No rows returned.
- 검증: issues 46, public_letters 46, 두 표 RLS true, 익명/로그인 사용자 모두 독자 식별자 직접 조회 금지 true, 공개 집계/반응 함수 실행 권한 true.
- 최초 독자 기록 0개. 공개 publishable key만 사용한 stats 요청 HTTP 200, 46개 레터 모두 읽음·좋았어요 0.
- 기능 시험: PGlite에서 중복·계정 병합·반응 취소·권한·멱등 적용·보존형 롤백 통과. Chromium/WebKit에서 로그인 없는 본문, 공유와 취소, 클립보드 대안, 관련 훈련 이동, API 장애, 375/1100/1280 폭 통과.
- 개인 훈련·팀 문서·커뮤니티 글은 변경하지 않았다. 운영 검증에 시험용 읽음/좋아요를 추가하지 않았다.

기준본은 저장소의 읽기 전용 카탈로그 쿼리를 SQL 편집기에서 실행해 원래 줄바꿈을 보존한 DOM 셀에서 수집했다. 개인 접근 토큰 파일이 없어 API 대신 같은 쿼리 결과를 사용했다.
