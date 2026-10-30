# 검색 노출 설정

- 검색 대표 문서(도메인 등록 후): https://studio.processfootball.com/landing.html
- 기존 `/` → `/studio/` → 앱 이동은 유지한다. 검색 방문자는 소개에서 앱 열기로 이동한다.
- 소개와 공개 안내 3개에 운영 canonical을 지정했다. sitemap.xml은 이 4개 공개 문서만 포함한다.
- robots.txt는 사이트맵을 알리고 관리자·공유 링크 경로의 수집을 제한한다. 접근권한 설정을 대체하지 않는다.
- package-site.mjs의 명시적 허용 목록에 sitemap.xml을 포함한다.
- Google/Naver 확인 HTML은 실제 검색 관리 도구에서 받은 파일이다. 확인 후에도 지우지 않는다.
- 구글 Search Console과 네이버 서치어드바이저의 소유확인, 사이트맵 제출, 소개 페이지 수집 요청은 운영에 파일이 올라간 다음 수행한다.
- 검색엔진의 실제 색인·노출 시점이나 순위는 보장할 수 없다.

## 확인

2026-10-30: 단위 검사 5,345개 통과. 로컬 소개 페이지 PC/390px 확인, 가로 넘침 없음. 1,923개 배포 파일 안에 robots.txt·sitemap.xml·확인 HTML 2개 포함. 소유확인 파일의 원문과 사본 일치. 앱·인증·저장·DB 동작 변경 없음. 실제 모바일 기기 검증은 수행하지 않았다.

## 도메인 연결

- 홈페이지 processfootball.com, 앱 studio.processfootball.com의 등록·DNS 연결·유효 HTTPS를 확인했다.
- Google은 processfootball.com 도메인 속성을 DNS TXT로 소유확인했다. Supabase 로그인 복귀 주소에 새 앱의 /studio/app.html을 추가하고 기존 4개 주소를 보존했다.
- 기존 processstudio.netlify.app 주소는 유지하고 호스트 강제 리다이렉트를 추가하지 않는다. 소개 하단에 기존 주소 링크도 둔다. 기기 전용 자료는 원래 origin에 남는다.
- 기존 Google/Naver 확인 파일은 보존한다. 새 앱의 실제 네이버 확인 파일 naver242deacd387076c4870d5f458f5c70cd.html을 추가했다. 운영 배포 뒤 소유확인·사이트맵 제출을 진행한다.
