# 20260930_staff_view_only — 실행 순서

앞의 두 변경(`20260930_role_default_player` · `20260930_idp_pub_write`)이 운영에 있어야 한다(확인 파일이 둘 다 통과해야 한다).

1. 사전 점검(읽기 전용): 바꿀 줄(`if r = 'staff' then return true; end if;`)과 끼울 자리(`scl := pj->'members'->(auth.uid()::text)->'scopes';`)가 각각 정확히 한 번, 표식 `ps-20260930-staff-view` 없음.
2. `20260930_staff_view_only.sql` 실행. 정의가 다르면 예외로 멈추고 아무것도 바꾸지 않는다. 표식이 있으면 건너뛴다.
3. `20260930_staff_view_only.verify.sql` 실행 → `staff_view_only_verified`.
4. 문제가 있으면 `20260930_staff_view_only.rollback.sql`.

로컬 시험: `node migrations/20260930_staff_view_only.local-test.cjs` (또는 `npm run test:sql`).
