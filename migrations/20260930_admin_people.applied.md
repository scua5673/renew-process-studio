# 20260930_admin_people — 운영 적용 기록

- 적용: 2026-09-30, Supabase 대시보드 SQL 편집기(postgres), 사용자 승인 뒤(«설치하고 배포»).
- 무엇: 관리자 전용 읽기 함수 `public.ps_admin_people()` 하나 새로 만듦. 표·행·권한(RLS)·다른 함수는 건드리지 않음.

## 사전 점검(읽기 전용, `20260930_admin_people.preflight.sql`)
| 항목 | 값 |
|---|---|
| auth.uid · ps_is_admin | 있음 · 있음 |
| 함수 이름 비어 있음 | 예 |
| 기대 열 | 8/8 |
| 계정 | 731 (이메일 없음 248 · 카카오 584) |
| 권한 문서 cs_perms_v1 | 54 (깨진 것 2 — 함수가 건너뜀) |
| 선수 항목 행 sq:* | 1,218 |
| 계정 메타 키 | 731 전원 `name`·`full_name` 있음 |

## 적용 · 확인
- `20260930_admin_people.sql` 실행 — 오류 없음.
- `20260930_admin_people.verify.sql` — `admin_people_verified` (SECURITY DEFINER · STABLE · search_path=pg_catalog · 표식 · anon 실행 불가 · authenticated 실행 가능 · JWT 없으면 42501).
- 관리자 신분 읽기 전용 확인(개수만, ROLLBACK): 사람 731 · 이름 있음 731 · 이름·이메일 둘 다 없음 0 · 팀 소속 365 · 연결 선수 193 · 팀 역할 있음 267 · 응답 429 kB.

## 되돌리기
`20260930_admin_people.rollback.sql`(표식 확인 뒤 DROP). 화면(admin.html)은 함수가 없으면 예전 `ps_admin_users` 목록으로 돌아간다.
