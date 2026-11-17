# 저장 계층 검사(문) — 2026-11-17 · 3.313 기준

저장 계층 정리 **0단계**(설계: 문서 저장소 `processstudio-문서/저장계층-정리-설계-2026-11-05.md` 6절)의 세 조각이 이 판으로 끝났다.
앱의 저장 형식 · 서버 스키마는 바꾸지 않았다. 사용자 화면 변화는 없다.

| 조각 | 무엇 | 어디 |
|---|---|---|
| ① 문 | 내용 자료의 직접 `localStorage.setItem` 과 빈 `catch` 가 파일마다 기준에서 **늘면 실패** | `scripts/storage-gate-scan.cjs` · `tests/storage-gate.test.cjs` · `tests/storage-gate.baseline.json` |
| ② 정본 목록 = 키 표 | 화면마다 따로 적은 «IndexedDB 에 사는 키» 목록 넷이 `studio/storage-keys.js` 와 같은 말을 한다(어긋남 0) | 같은 시험 · 키 표 |
| ③ 사용량 보고 | 로그인한 기기가 하루 한 번 `ps_events storage_usage` 에 «누가 얼마나»(키 표 이름 · KB) | `studio/storage.js` `usageReport` + 파일 끝 예약 · `tests/storage-usage-report.test.cjs` |

## 사용

- `node scripts/storage-gate-scan.cjs` — 지금 숫자와 기준의 차이, 정본 목록의 어긋남(막는다), 살펴볼 곳(막지 않는다).
- `node scripts/storage-gate-scan.cjs --write` — 줄어든 기준만 고쳐 쓴다. 한 파일이라도 늘었으면 종료 코드 1, 기준 파일은 그대로.
- `node --test tests/storage-gate.test.cjs` — 문 + 정본 목록 비교. 전체는 `npm test`.

## 세는 규칙

- **직접 쓰기(direct)**: `localStorage.setItem(` 가운데 키가 내용 자료(키 표 구실 data · draft · queue · recovery)이거나 모르는 것.
  키가 글자 그대로이거나, **같은 파일에서 한 값으로만 정한 대문자 상수**(`PREF` · `MEM` · `EDIT_SNAP` …)면 그 글자의 구실로 가른다(11/17 — 모듈이 설정 키를 상수에 담는 관례라 60곳이 오탐이었다).
  소문자 변수(`k` · `key` — 함수 인자일 때가 많다) · 두 값으로 정한 상수 · 접두사 + 변수는 모르는 것으로 보고 **센다**.
- **빈 catch(silent)**: `catch(e){}` · `.catch(function(){})` · `.catch(()=>{})`. 블록 주석 속 글자는 세지 않는다(주석을 넣어도 빈 catch 는 빈 catch 다 — 할 일을 코드로 적는다).
- 파일마다 견준다 — 다른 파일에서 줄인 수로 새 파일의 증가를 상쇄할 수 없다.
- 정규식이다. JavaScript 구문 분석기가 아니다.

## 기준의 역사

| 날 | 코드 | 직접 쓰기 | 빈 catch | 비고 |
|---|---|---:|---:|---|
| 11/5 | 3.262 | 209 | 6,277 | PR #777 첫 기준 |
| 11/9 | f480ed7b | 210 | 6,295 | staging 통합 — 7개 파일의 증가를 검토해 반영 |
| 11/17 | 3.313 | **160** | **6,572** | 검사기 상수 풀기(−60 오탐) · 8일 동안 들어온 코드(+289) |

### 11/17 재설정 — 11/9 이후 늘어난 것

PR #777 이 11/5 에 열린 채 합쳐지지 않아 **문이 없던 8일**(3.263 ~ 3.312) 동안 새 모듈 서른 남짓이 들어왔다.
그 사이 늘어난 빈 catch 는 **낱낱이 검토하지 않고 새 출발선으로** 받았다 — 문의 값은 앞으로 늘지 않게 하는 데 있고, 이미 실사용에 나간 6,500곳을 되돌아보는 것은 이 판의 일이 아니다(설계 6절: 빈 catch 는 손대는 함수에서 줄여 간다).
교훈: 문은 열자마자 합쳐야 한다. 열린 채 두면 그 사이 들어온 것이 전부 기준이 된다.

**직접 쓰기** — 검사기 오탐을 걷은 뒤 실제로 늘어난 것은 두 파일 네 곳:

| 파일 | 이전 | 지금 | 무엇 |
|---|---:|---:|---|
| `board-rescue.js` | 0 | 2 | 3.278 작업 보드 구조 사본 — IndexedDB 쓰기가 실패했거나 닫히는 중일 때 1.5MB 이하면 `localStorage` 에 한 벌(`ps_private_board_draft_v1:…:rescue:`) |
| `board-vault-draft.js` | 0 | 2 | 3.273 보관함 작전판 미저장 초안 — 수명 주기(pagehide)의 동기 사본 |

둘 다 «IndexedDB 가 못 받을 때의 마지막 사본»으로 일부러 둔 길이다. 2단계(거울 실패 시 IndexedDB 기준)에서 같이 본다.

검사기가 오탐으로 세던 곳(이제 안 센다): sync.js 71→47 · board.html 34→23 · scout.html 20→17 · storage.js 12→9 · process.html 12→10 · app.html 7→4 · community.html 4→0 · board-edit-view.js · install-door.js · release-notes.js · sync-stall-report.js 1→0.

**빈 catch** — 44파일 +289(파일 · 이전 · 지금):

| 파일 | 이전 | 지금 | | 파일 | 이전 | 지금 |
|---|---:|---:|---|---|---:|---:|
| board-vault-draft.js | 0 | 33 | | board-tv-fold.js | 0 | 4 |
| crash-breadcrumb.js | 0 | 27 | | data-lock-guard.js | 0 | 4 |
| board-rescue.js | 0 | 24 | | learning-off.js | 0 | 4 |
| i18n.js | 0 | 18 | | schedule-fill-team.js | 0 | 4 |
| board-quick-depth.js | 0 | 17 | | avail-table.js | 0 | 3 |
| board-motion-marks.js | 0 | 16 | | board-shortcuts.js | 0 | 3 |
| board-open-chooser.js | 0 | 16 | | lib-diet.js | 0 | 3 |
| note-picture.js | 0 | 11 | | profile-app.js | 0 | 3 |
| oauth-gate.js | 0 | 10 | | schedule-del-undo.js | 0 | 3 |
| scout.html | 762 | 769 | | schedule-syncline-steady.js | 0 | 3 |
| storage.js | 111 | 118 | | autosave-recovery.js | 3 | 5 |
| board-scout-import.js | 0 | 7 | | board-training-edit.js | 3 | 5 |
| board-teams.js | 0 | 7 | | board-vault-lazy.js | 7 | 9 |
| one-window.js | 0 | 7 | | board.html | 2365 | 2367 |
| schedule-lib-slim.js | 0 | 6 | | schedule-fill-autosave.js | 0 | 2 |
| board-phone-view.js | 5 | 10 | | board-dock-float.js | 8 | 9 |
| account-hygiene.js | 0 | 5 | | board-draft.js | 19 | 20 |
| elsewhere.html | 0 | 5 | | board-kit.js | 19 | 20 |
| board-topbar.js | 12 | 16 | | board-shape-menu.js | 9 | 10 |
| board-tweaks.js | 33 | 37 | | player-workspace.js | 8 | 9 |
| | | | | sync.js | 557 | 558 |
| | | | | items-stale-nudge.js · match-kind.js · profile.html | 0 | 1 |

줄어든 것: app.html 592→584 · board-dock-film.js 10→8 · community.html 61→59.

## ② 정본 목록 = 키 표 (11/17 끝)

11/5 에 어긋나 있던 여섯을 **표를 고쳐** 없앴다(시험의 `KNOWN` 은 비었다). 목록(app.html · scout.html · team-files.js)은 손대지 않았다.

- `sq:` — 선수별 행(선수 한 명이 IndexedDB 한 행 · sync.js `ITEMP` · ps_items 표)을 동기화 종류 `item` 으로 등록. 표에 없어 `fullName` 이 «other» 로 뭉치던 것이 `sq:` 로 보인다.
- `cs_board_stash_v1` · `cs_snap_match_v1` — 옛 키(device · idb · cache). 공간 전환 청소 목록(sync.js `IDB_CONTENT`)과 내보내기 목록(app.html)에만 남아 있다.
- `cs_editor_draft_v1` · `cs_editor_work_v1` · `training_session_cur_v1` — 표에 `ls` 로 적혀 있었는데 실제는 `boardStore`(IndexedDB 먼저 · localStorage 는 실패 때만, 거울 아님). `idb` 로.

«살펴볼 곳»(막지 않는다) 10줄이 남아 있다 — 표에서 «IndexedDB 정본 + 거울»인 키를 그 파일이 글자 그대로 다루는데 목록에는 없다. 읽기만일 수도 있고, 쓰는 곳이면 거울만 고치고 IndexedDB 를 건너뛰는 길이다(예: team-files.js `IDB_MIRROR` 에 `scout_tool_v1` · `cs_gamemodel_v1` 없음). **1단계의 일**이다.

## ③ 기기별 사용량 보고 (11/17 끝)

«저장공간 부족» 제보 넷(10/20 a4d77bba · 10/26 095358c2 · 10/28 419fead1 · 11/3 e6fc5d26)은 매번 작은 저장소를 채운 주인이 달랐다. `storage_full`(3.126)은 가득 찬 **뒤에야** 남아 «누가 채워 가는지»를 미리 볼 수 없었다.

- `studio/storage.js` `usageReport` — `storage_full` 과 **같은 셈**(`localSummary` — 키 표 이름 `fullName` 별 바이트 합)으로 `PSSync.event('storage_usage', {status:'ok', feature:'storage', meta})`.
  meta: `ls`(KB 전체) · `n`(키 수) · `k:<표 이름>`(가장 큰 여섯 · KB) · `useMb`/`quotaMb`(`navigator.storage.estimate` — 3초 안에 답이 없으면 빼고) · `standalone`.
  보내는 것은 `storage_full` 과 같다: **키 표의 이름과 KB 뿐**. 내용 · 키 전체 이름(선수 id · 계정 id)은 없다(접두사 키는 표의 이름으로 뭉친다 — `sq:` · `ps_private_board_draft_v1:unsaved`).
- 파일 끝 예약: 맨 위 창에서만(3.124 와 같은 까닭 — 화면마다 iframe 이 이 글을 읽는다) · 로그인한 기기만(`ps_sync_session` — ps_events 는 계정이 있어야 받는다, 세션이 없으면 표시도 안 적는다) · 부팅 20초 뒤 · 표시 `ps_storage_usage_at` 가 하루 안이면 안 보냄 · 표시를 못 적으면(가득 찬 기기) 안 보냄 — 그 기기는 `storage_full` 이 말한다.
- 새 키 `ps_storage_usage_at`(device · ls · diag)은 `warnFull` 의 예외(telemetry 표시가 저장 실패 경고를 걸지 않는다).

보는 법(운영 DB 읽기):

```sql
-- 최근 줄
select created_at, device, app_version, meta
from public.ps_events where event_name='storage_usage' order by created_at desc limit 50;

-- 주인별 — 기기마다 마지막 줄만(최근 7일): 몇 기기가 · 평균 · 최대 KB
select m.k, count(*) devices, round(avg(m.kb::int)) avg_kb, max(m.kb::int) max_kb, sum(m.kb::int) sum_kb
from (select distinct on (user_id, device) user_id, device, meta
      from public.ps_events where event_name='storage_usage' and created_at > now() - interval '7 days'
      order by user_id, device, created_at desc) e,
     jsonb_each_text(e.meta) as m(k, kb)
where m.k like 'k:%' group by m.k order by sum_kb desc;

-- 많이 찬 기기(3MB 넘게)
select user_id, device, app_version, (meta->>'ls')::int ls_kb, meta
from (select distinct on (user_id, device) * from public.ps_events where event_name='storage_usage' order by user_id, device, created_at desc) e
where (meta->>'ls')::int > 3072 order by ls_kb desc;
```

## 1단계 — IndexedDB 를 건너뛰는 쓰기 넷 (3.314)

조사(11/5 · 3.262)에서 `scout_tool_v1` 에 쓰는 함수 10개 · 파일 6개 가운데 셋이 IndexedDB 를 건너뛰었고, 작전판의 선수단 거울은 두 저장소에 따로 썼다. 넷 다 **정본을 먼저 읽고 공용 길(`psSaveSharedAsync` — 거울 + IndexedDB 확인)로 쓴다.**

| 자리 | 예전 | 지금 |
|---|---|---|
| `team-files.js` `IDB_MIRROR` | `scout_tool_v1` · `cs_gamemodel_v1` 이 없어 선수 · 스카우팅 · 게임모델 가져오기가 거울에만 썼다 | 목록에 더함 — `getRaw` 는 IndexedDB 먼저, `setRaw` 는 `psSaveSharedAsync` + 되읽기, 되돌리기는 IndexedDB 도 비운다 |
| `gamemodel.html` 포지션별 요구 `saveDoc` | 거울(`localStorage`)만 읽고 거울에만 썼다 | `saveIdeal(posId, field, value)` — IndexedDB 정본을 **`storage.peek`**(심지 않는 읽기)로 읽어 그 위에 고치고(낡은 거울의 옛 명단을 되살리지 않게) `psSaveSharedAsync`. 실패는 `console.warn` + `PSSaveState.fail('gm-ideal')`. 그리기(`render`)는 아직 거울(3단계) |
| `storage.js` `PSImg.migrate` | 셋 다 거울에서 읽어 사진을 참조로 바꾼 뒤 거울에만 썼다(`writeJSON`) | 키 표에서 IndexedDB 정본인 키(`scout_tool_v1` · `process_coach_v1`)는 정본에서 읽고(`storage.peek`) `psSaveSharedAsync` 로 쓴다. «같은 원문인가»(`current`)도 읽은 곳에서 본다. `cs_team_v1`(거울 정본) · 남의 IDP 는 그대로. 키 표가 없는 창은 예전 길 |
| `board.html` `squadLoad` · `squadSave` | 거울을 먼저 읽고(scout 와 반대) `boardStore` 와 `localStorage` 에 따로 썼다 | `boardStore`(IndexedDB) 먼저, 쓰기는 `psSaveSharedAsync` 하나(실패 `storeFailure`). 보기 전용은 `boardStore` 의 메모리 길 그대로 |

직접 쓰기 160 → 158(gamemodel 6→5 · board 23→22). 시험 `tests/storage-stage1-3314.test.cjs`(가짜 저장소 — 정본 · 거울이 다를 때 어느 쪽을 읽고 쓰는지 · 정본 읽기가 `get` 을 부르지 않는지).

**정본 읽기는 `window.storage.peek`** — `get` 은 IndexedDB 에 없고 거울에 있으면 거울 값을 IndexedDB 에 심는다(설계 2절 «읽는 함수가 쓴다» — 2단계가 없앨 길). 부팅 때 모든 창이 도는 `PSImg.migrate` 가 `get` 으로 읽으면 동기화의 CAS 쓰기와 경주한다. 새 정본 읽기는 `peek`(없으면 `get`).
**끝났다는 증거**(설계 6절): 선수 DB «사본 불일치» 이벤트(`roster_copies_differ` · `*_copies_differ`)가 줄어든다 — 승격 뒤 일주일을 본다.

아직 남은 «살펴볼 곳» 8줄(막지 않는다) — 전부 **백업 · 내보내기 목록**(app.html `KNOWN_IDB` · `MIRRORED_IDB` 에 `cs_drill_lib_v1` · `cs_perms_v1` · `scout_tool_v1` 없음 — 그 키는 다른 길(MERGED · restore 전용)로 다룬다)과 scout.html `SHARED_IDB`(`cs_drill_lib_v1` · `cs_gamemodel_v1` — 읽기만). 쓰기를 건너뛰는 길은 아니라 두었다.

## 다음(설계 6절)

- 2단계: 거울 쓰기가 실패하면 옛 거울을 지우고 IndexedDB 를 기준으로(일정의 `scheduleMirrorDrop` 을 거울 키 전체로) · `storage.get` 이 읽으면서 쓰는 것을 멈춘다. `board-rescue.js` · `board-vault-draft.js` 의 «마지막 사본» 길도 여기서 같이 본다.
- ③ 의 숫자를 본 뒤 3단계(거울 걷어내기)의 첫 키를 고른다 — 가장 큰 `k:` 부터. `gamemodel.html` 의 `render` · `board.html` 의 `loadTeamToBoard` 같은 «거울을 동기로 읽는 곳»이 그때 바뀐다.
- 실제 자료 복구 · 실기기 확인은 따로.
