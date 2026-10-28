# 적용 기록 · 2026-10-28 12:00 KST

사용자가 «너가 직접 전부 확인하고 진행해줘»로 승인한 뒤 운영 Supabase 프로젝트 jvtajoeptzfsdwizxejg 에 적용했다(Supabase MCP `apply_migration` · 이름 `admin_client_versions`, 바깥 `begin/commit` 은 도구가 트랜잭션을 감싸므로 뺐다).

- 사전 점검: `ps_is_admin()` · `ps_support_reporter(uuid)` · `ps_events(user_id, created_at)` 색인 존재. 같은 이름의 함수는 없었다(추가 전용).
- 결과: `{"success":true}`.
- 검증(`.verify.sql`):
  - 함수 둘 모두 `security definer` · `stable` · `search_path=pg_catalog`, 실행 권한은 `authenticated · service_role · postgres` 만(anon · public 없음).
  - 관리자 JWT(sub = 운영자 계정)로 `ps_admin_stale_clients(48,20)` → latest `3.197`, clients 60줄(상한). `ps_support_reporter_devices(<419fead1>,7)` → devices 20줄, 첫 줄 desktop · 3.197 · 이벤트 125 · sync_failed 8.
  - 관리자가 아닌 sub 로는 `42501 admin_required` 로 거부.
- 읽기 전용이라 어떤 표도 바뀌지 않았다. 운영 자료에 시험용 행을 넣지 않았다.
- 화면: admin.html 3.201 의 «제보자 기기 현황»(제보 상세) · «옛 판으로 도는 기기»(운영 홈)가 이 함수를 부른다. 함수가 없던 동안 두 칸은 조용히 숨었다.
- 되돌리기: `.rollback.sql`(함수 둘 drop). 화면은 함수가 없으면 숨기므로 앱 판을 되돌릴 필요가 없다.
