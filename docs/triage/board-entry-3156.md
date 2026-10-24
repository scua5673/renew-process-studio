# 3.156 보드 복원 후속 담당

PR #593 뒤 staging 4016477 / CI 40055012940 WebKit board-full-name 준비 대기 실패를 맡는다.

합성 fixture의 서버 보드 GET을 6.5초 지연시키고 초기 showApp('board')를 실행하면 내부 setView/loadSnap/renderTokens/boardSaveLive가 실제 사용자 편집 없이 dirty=true, base=false, players=[]를 만든다. 서버 보드 복원이 차단됨을 재현했다.

초기 화면 진입 렌더만 저장 잠금으로 감싸고, 지연 진입·실제 사용자 편집 보호 회귀 및 실패 진단을 추가한다. 소유자/세대/CAS 보호를 완화하거나 운영 자료를 수정하지 않는다. 기존 제보 e17cf3d7, ff4be8e0, ab62aaa3 개선은 #593에서 staging에 포함됐다. 모든 필수 CI, staging 공개 코드 검사 뒤에만 승인된 실사용 승격을 진행한다.

## 재현과 수정

초기 showApp의 boardShowDefault/setView 렌더를 복원 완료 전일 때만 기존 __capLock을 보존한 try/finally로 감쌌다. 서버 복원 완료 뒤의 저장은 그대로이며 기존 dirty/user 편집도 지우지 않는다. 동일 합성 지연 진입 검사는 수정 전 45초 준비 초과, 수정 후 Chromium/WebKit 375·393·768·1280에서 서버 선수·shirt/none 설정·정확한 원문 저장 통과. 기존 이름 입력/장면/내보내기/새로고침도 양쪽 엔진 네 폭 통과. 초기 잠금·실제 편집/예외 시 이전 잠금 복원·완료 후 일반 저장의 단위 회귀 포함 총 4245 통과. 실패 시 초기 dirty 호출stack과 owner/base/generation/GET 상태를 출력하되 준비 성공 조건이나 제한시간은 완화하지 않았다.

## 준비 표시 이후의 복원도 보호

더 긴 GET 지연에서 ready/done=true인데 base가 없는 상태와 showApp→renderDrawings→boardSaveLive의 거짓 편집도 확인했다. restoreLiveBoard는 실제 세대별 진행 표식을 finally에서 해제하고, 화면 진입/모바일 초기값은 진행 중 복원 및 개인 저장 기준 미확인 상태를 보호한다. 소유자가 없는 게스트는 정상 진입을 유지한다. 준비 제한시간·CAS·자료 보존 보호는 그대로다. fixture는 다른 개인 자료 조회와 구분해 cs_private_board_v1 GET만 지연한다. 이전 CI40056244400은 이 보강 전 취소했으며 통과로 세지 않는다.
