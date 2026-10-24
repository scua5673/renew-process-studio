# 0c4599ff 관련 보드 복원 검사 · 초기 이미지 렌더

담당: 현재 Codex 대화. 권한 필터 #598/#599 배포 검증 중 발견한 별도 복원 경로.

main CI40068308018의 WebKit board-full-name(제보0c4599ff 회귀) 393px에서 실제 진단을 확보했다. `ready=false`, `loaded=true`, `user=false`인데 `edit=1`, `dirty=true`, `base=false`였다. 최초 변경 스택은 공 이미지 `onload` → `renderTokens` → `boardSaveLive`다. 서버 조회 중 이 변경이 생기면 실제 사용자 초안 보호 조건이 복원을 중단한다.

공 이미지 지원 여부가 뒤늦게 확인되는 것은 화면 다시 그리기이며 사용자 편집이 아니다. 이 콜백의 렌더만 기존 캡처 잠금으로 감싸고 `finally`에서 원래 잠금을 복구한다. 실제 편집·기존 dirty·소유자/세대/서버 비교 조건은 유지한다. 지연 이미지와 지연 서버 GET을 합성 fixture에서 제어해 수정 전 실패/수정 후 복원·저장 성공을 확인한다. 실제 iPad 종료의 완전 해결로 주장하지 않는다.
