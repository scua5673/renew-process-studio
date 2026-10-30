# 419fead1 후속: 오래된 선수 저장 작업의 회차 차단

조사 기준은 3.213, `8a42d0f4d0927eaef048d245d2f92fd4c11bd314`입니다.
기존 자료 불러오기 제보의 후속 안정화이며, 이번 직접 증거는 별도 기기의
`items_write_stale_job` 진단입니다. 기존 제보자의 실제 원문이나 기기에서
같은 원인을 확정한 것은 아닙니다. 제보 답글·상태와 운영 자료는 변경하지 않습니다.

## 재현한 고장

실제 `PSItems.write`가 기준 A를 읽은 뒤 합성 행을 정상 IDB CAS로 B로
진전시키면, 첫 flush는 B를 덮지 않고 거부합니다. 그러나 새 입력 없이 공개
`PSSync.syncNow`를 두 번 호출해도 같은 옛 작업이 실패하여 KV 조회가 한 번도
시작되지 않고 다른 일정도 받지 못했습니다. 상태는 `ok`, `팀과 같아요`, pending 0이었습니다.

수정 전 Chromium 실행은 1회이며 결과 SHA-256은
`1e6e9be58de6296abf57f06266221340bf08badc74469a16cfc85b49c169ee9d`입니다.
당시 시험 원문 SHA-256은
`645a6ae67a66808c57dd58f7c46370e69ca5cb4633184cbb1786add8db08d59c`입니다.
두 원문과 실행 파일 지문은 별도 보존하며 이 결과의 passed는 결함 재현 성공을 뜻합니다.

## 3.214의 변경

- `sync-items-stale.js`는 작성 내용·예상 원문·CAS 계보·현재 기기사본과 정확한
  roster intent를 기존 journal에 불변 보관하고 readback합니다. 보관 실패는 계속 차단합니다.
- 보관이 확인된 작업은 배경 회차에서만 분리합니다. 해당 `sq:`와 명단 carrier는
  보류하고 다른 자료는 받습니다. 직접 flush와 상태는 미완료를 유지하며 reload에도 적용합니다.
- 진행 중인 보관과 최신 조회의 게시 순서를 지킵니다. 옛 조회는 최신 결과에 합류하며
  새 보관을 지우거나 정상 확인 창을 불필요하게 거절하지 않습니다.
- 보관 UI는 당시 기기사본을 서버본이라 표시하지 않습니다. 현재 사본을 다시 읽어
  보여주고 사용자가 명시적으로 선택한 경우에만 해당 보류를 해제합니다.
- 선택한 사본·원본·owner·권한·UI 선택을 확인하는 `storage.setIfValues`는
  같은 IDB transaction에서 조건 조회·해제 표식 쓰기·readback을 마칩니다.
  이전 입력과 원본 batch·ACK는 지우지 않습니다.
- `roster-outbox.settle/settled`는 정확히 확인한 source만 처리합니다. 열린 scout의
  실패 콜백이나 재시작이 옛 A를 다시 실행하지 않게 하며 새로운 C는 구분합니다.
- 서버 확인은 끝났지만 scout가 먼저 읽기를 마친 뒤 후속 갱신을 놓치던 경로도 고칩니다.
  최신 journal 준비 완료 알림과 정상 회차 완료 알림에서 기존 입력 지연·owner·confirmed
  projection 경로를 다시 실행합니다. BFCache 복귀와 중복 알림 합치기도 지킵니다.
- 미확인 입력을 서버 확인 계보에 넣거나 새 기준으로 자동 채택하지 않습니다.
  고정 진단 분류만 수집하며 선수 원문·식별값·임의 오류 문구는 보내지 않습니다.

## 검증 범위

`items-stale-quarantine.test.cjs`, `items-stale-round-block.mjs`,
`storage-conditional.mjs`가 새 경계를 검사합니다. 기존 partial-core 시험에는
실제 새 모듈과 누락된 journal/storage capability를 연결했으며 기존 CAS·ACK·
삭제·소유자·history 단정은 유지합니다. CI storage 묶음에서 양 엔진을 실행합니다.
로컬 최종 회귀는 5,327/5,327, SQL 전체 검사는 합성 DB에서 통과했습니다.
실제 Chromium·WebKit fixture는 각각 보류 UI·열린 scout 재시도·reload·B 자동 반영·
새 C 저장·입력 중 D 수신 지연·blur 후 자동 반영·원문 보존을 통과했습니다.
이 최종 실행의 source drift와 page error는 모두 0이며 이전 실패 원시는 별도 보존합니다.
동일 owner·권한에서 이미 검증한 journal의 순수 재조회는 기존 확인을 유지합니다.
최초 조회·owner/권한 변경·보관 진행·최신 I/O 실패의 차단은 유지하며,
`items-stale-readiness.test.cjs`가 실제 확인 모듈과 함께 검사합니다.
실패했던 기존 저장 표시 fixture도 원문 변경 없이 양 엔진에서 통과했습니다.
최종 CI·staging·production의 정확한 SHA와 공개 파일 검증은 PR 및 배포 기록에 남깁니다.

운영 DB·실계정 저장소·제보 쓰기는 없습니다. 서버 설치나 스키마 변경은 필요하지 않습니다.
실제 iPad OS 종료 원인의 입증이나 모든 기존 미확정 원문의 복구 완료를 뜻하지 않습니다.
