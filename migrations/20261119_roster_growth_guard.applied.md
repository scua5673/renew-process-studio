# 20261119_roster_growth_guard — 운영 적용 기록

- 적용: 2026-11-19 17:28:23 KST, Supabase 프로젝트 `jvtajoeptzfsdwizxejg`, 소유자 «A 로 진행해줘» 뒤 연결 도구(SQL 실행)로 `.sql` 을 글자 그대로 한 번.
- 무엇: 함수 `public.ps_kv_shape_guard()` 본문만 다시 만듦. 표 · 정책 · 트리거 · 권한 · 자료 변경 없음. 앱 판 3.332 그대로.

## 사전 점검(적용 전 조회)
| 항목 | 값 |
|---|---|
| body_md5 | `fd40ab18d81f34de23f9dd578724c7ee`(기준본과 같음) |
| 트리거 | `ps_00b_shape_guard_t BEFORE UPDATE ON public.ps_kv FOR EACH ROW` |
| growth_denials_30d | 15줄 · 10팀 |

## 적용 뒤 확인
| 항목 | 값 |
|---|---|
| body_md5 | `f22408fca66fdc49063a4cb09c2655e4`(verify.sql 기대값 · 이 PR 의 기준본과 같음) |
| SECURITY DEFINER · search_path | 참 · `{search_path=public}` |
| 권한 | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`(그대로) |
| 트리거 켜짐 | `O` |

## 지켜본 것(17:30 KST 무렵)
- 제보 팀: 서버 명단은 아직 옛 14명(`cs_squad_v1` 14 · `scout_tool_v1` 14 · 선수 행 14줄). 제보자 기기는 16:21 뒤 접속 기록이 없다 — 대기 62건을 가진 데스크톱(6dfd74fe)이 앱을 다시 열어야 올라간다. **아직 «풀렸다»고 확인하지 못했다.**
- 적용 뒤 «불어나는» 거부 새 줄 0.

## 남은 일
- 그 기기가 다시 접속한 뒤 `ps_kv`(선수 수) · `ps_sync_reports`(`pending_team`)로 확인. 안 올라가면 거부된 본문 뒤에 줄 선 선수 행(`sq:*`) 길을 본다.
- `node scripts/schema-baseline.mjs` 로 기준본을 다시 받아 이 PR 의 손 편집과 차이가 없는지 확인(이 세션에는 그 스크립트가 쓰는 연결이 없다).
