# e6fc5d26 — 선수 추가 저장 보관 경로 점검

담당 제보: `e6fc5d26-2059-4481-aec1-acb2e32c858d` — 「선수단 추가중 저장이 되지 않는 오류」, 2026-11-03 09:49 접수.

첨부 진단은 09:44:33에 수집되었으며 당시 실행 판은 **3.240**, Chrome 155 / macOS, 1440×862, 온라인이다. 기기 요약의 별도 최신 판은 3.243이다. 11월 2일 20:10 quota 한 건은 실패 키가 확인되지 않았고, 09:30–09:44 `sync_local_changed` / `items-write` 다섯 건과의 인과관계도 아직 모른다. 실제 계정의 자료 유실이나 3.244 해결을 주장하지 않는다.

이 작업은 main `e9d2babca609315bd3f565107db37739da1bc4b2` (tree `7d1a5bc11f8deff280593035efd301a9efdb0e9e`)에서 시작한다. 런타임 수정 전에 이 문서로 담당을 명시하고 staging 대상 draft PR을 만든다.

## 조사 범위

합성 계정의 실제 선수 추가 UI에서 첫 `ps_roster_pending_v1:` batch 쓰기만 quota로 거절한다. 선수 추가 → 원문 보관 → MAIN / SQ 저장 → 새 페이지 읽기까지 실패 전후 원문과 저장 장벽을 확인한다. 아직 실행하지 않은 가설은 첫 보관 실패가 MAIN·SQ 쓰기 전에 중단되지만 같은 화면의 메모리에는 신규 행을 남긴다는 것이다.

재현되면 소유자·권한·전환 장벽과 outbox·이전 원문을 보존하는 좁은 고침만 만든다. MAIN 저장을 무조건 진행하는 우회나 저장소 두 곳의 실패를 성공으로 표시하는 길은 허용하지 않는다. 실제 계정·운영 DB·제보 답글·제보 상태에는 쓰지 않는다.

## 재현 전후 계약

런타임 변경 전 claim `954b86617eb010eaf8bba7ab19a7e1bffbec19c7`에서 실제 합성 Chromium의 `tmAdd` 단추와 이름·번호 입력 시트로 재현했다. 첫 pending batch에 quota를 한 번 주입하자 메모리에는 새 선수가 있었지만 LS batch·IDB pending은 모두 0이었다. MAIN의 LS·IDB와 서버 원문은 전과 같았고 `store_ready:scout_tool_v1` 장벽은 거절했다. 강제 재열기 뒤 새 행이 없어서 원문 보존 단정이 실패했다. 기준 소스·원문 JSON·스크린샷·실패 로그는 `/tmp/ps-roster-e6fc5d26-before/`와 `/tmp/ps-roster-e6fc5d26-before.log`에 보존했다.

실행 판 3.240의 배포 커밋 `ad5d7c160cab1acd5263ab8ea640c054187fe9fe`에서도 같은 추가 호출과 `rosterPersist`의 stage 실패 후 즉시 중단 경로를 읽어 확인했다. 당시와 기준 main의 `roster-outbox.js` blob은 모두 `d75e68388afbc23d4bb85cfaaf884f067093bbfb`다. 이는 당시 판에도 합성 재현 경로가 존재했다는 증거이며 실제 제보의 실패 키를 특정하지 않는다.

고침은 실패한 immutable batch의 같은 key·token·seq·raw를 IDB에서 검증 보존한다. 보존 중이거나 아직 native LS에 승격하지 못한 동안에는 저장 실패·pending과 MAIN·SQ·ACK 차단을 유지한다. 재열기에서는 해당 계정·팀의 원문을 먼저 수화해 읽기 overlay로 보여 준다. 같은 원문을 같은 LS key에 저장·되읽고 IDB 원문을 조건부 제거·부재 확인한 뒤에만 원래 native 저장·ACK 경로를 재개한다. IDB 사본을 남긴 채 LS ACK만 정리하여 원문이 부활하는 길은 허용하지 않는다.

## 검증

초기 구현 `6ba44fdb9beb715fc04c6f5847955481c274dc2c`에서 관련 unit 175/175가 통과했다. 독립 코드 검토에서 발견한 비동기 peek 뒤 foreign LS 덮어쓰기와 같은 owner의 epoch/권한 갱신 장벽은 `6f786636286cbc397986409cdb868064cfa739a5`에 고쳤다. 변경된 모듈의 관련·음성 unit 27/27을 다시 통과했다. 다른 통과 검사는 반복하지 않았다.

`6f786636286cbc397986409cdb868064cfa739a5`의 실제 Chromium·WebKit 회귀가 모두 통과했다. 실제 추가 UI에서 quota를 주입해 원문 보존·강제 재열기 동일 선수·미완료 장벽을 확인했고, quota 해제 뒤 exact LS 승격·IDB 원문 제거·기존 MAIN/SQ 기기 저장을 검증했다. 실제 재열기의 fresh live-key scan 뒤 합성 서버의 SQ 행도 확인했다. 완료 후 재열기에서 ACK 원문이 부활하지 않았고, 두 저장소가 모두 실패하면 MAIN/SQ/서버는 진행하지 않은 채 실패·pending·업데이트 장벽을 유지했다. 새 선수와 기존 선수 원문을 합성 데이터로만 검사했다.

기기 저장 장벽은 서버 저장 완료가 아니다. 첫 브라우저 검사는 기기 SQ 저장 직후 한 회차로 서버 행까지 단정하여 실패했다. 진단용 `99b19bc`에서 실제 IDB SQ 원문과 오류 없는 네 회차를 기록했고, 기존 `idbRefreshLive`의 1분 live-key 캐시가 새 SQ 키를 아직 조회하지 않는 경계임을 읽어 확인했다. 캐시·시계를 바꾸지 않고 실제 재열기의 fresh scan 뒤 동일 서버 단정을 검증하도록 시험을 고쳤다. 원 실패 로그와 원문은 그대로 보존했다.

증거:

- 최초 관련 unit: `/tmp/ps-roster-e6fc5d26-unit-6ba44fd.log`
- 독립 검토 보강 unit: `/tmp/ps-roster-e6fc5d26-unit-review-fixes.log`
- 원 브라우저 실패: `/tmp/ps-roster-e6fc5d26-{chromium,webkit}-6ba44fd.log`
- 진단 회차: `/tmp/ps-roster-e6fc5d26-after-99b19bc/chromium-native-rounds.json`
- 통과 브라우저 로그: `/tmp/ps-roster-e6fc5d26-{chromium,webkit}-6f78663.log`
- 최종 합성 원문·스크린샷: `/tmp/ps-roster-e6fc5d26-after-6f78663/`

실제 계정 원문 복구·운영 반영·제보 응답은 이 작업 범위 밖이다. 제보 당시의 quota 실패 키와 `items-write` 경합의 인과관계는 여전히 확인하지 못했다.
