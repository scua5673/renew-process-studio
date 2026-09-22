/* PROCESS STUDIO — 현재 앱의 변경 안내. 업데이트 다운로드·새로고침·사용자 자료와 독립적이다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSReleaseNotes=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var STORAGE_KEY='ps_release_notes_hidden_v1',WEEK_MS=7*24*60*60*1000;
  var DEFAULT_ENTRIES=[{
    id:'2026-09-22-v2-886-match-dock',date:'2026-09-22',title:'v2.886 · 경기준비의 그리기 도구줄을 숨겼습니다',
    changes:['경기준비 보드 아래에 추가했던 그리기 도구줄을 숨겼습니다.','기존 보드·선수 배치·그림과 페이지 편집·PDF 내보내기는 유지됩니다.']
  },{
    id:'2026-09-22-v2-885-match-board',date:'2026-09-22',title:'v2.885 · 경기 보드에 그리기 도구와 PDF 저장을 추가했습니다',
    changes:['페이지 탭에서 바로 이름을 수정하거나 복제합니다.','하단 도크에서 공·훈련 장비·화살표·도형·텍스트를 추가하고 페이지별로 저장합니다.','내보내기에서 현재 페이지를 가로·세로 PDF로 저장합니다.']
  },{
    id:'2026-09-22-v2-884-availability',date:'2026-09-22',title:'v2.884 · 가용인원 조회와 기본 참여 처리를 개선했습니다',
    changes:['가용인원 집계에서 같은 팀 일정을 반복해서 읽는 작업을 줄였습니다.','체크하지 않은 날은 기본 참여로 계산합니다. 오늘 수정한 상태는 다시 수정할 때까지 유지됩니다. 과거 날짜 정정과 OFF 일정은 보존합니다.']
  },{
    id:'2026-09-22-v2-883-session-team',date:'2026-09-22',title:'v2.883 · 세션 추가에서 참여 팀을 선택합니다',
    changes:['세션 추가에서 A팀·B팀 등 참여 팀을 선택한 뒤 세션을 만듭니다. 여러 팀을 함께 선택할 수 있습니다.','별도의 조별 훈련/OFF 설정 버튼을 정리했습니다. 기존 세션과 팀별 휴식 설정은 보존합니다.']
  },{
    id:'2026-09-22-v2-882-boot',date:'2026-09-22',title:'v2.882 · 다시 열 때 보드 준비 화면을 개선했습니다',
    changes:['보드 준비가 늦어질 때 빈 운동장이나 정리되지 않은 도구가 먼저 표시되지 않도록 시작 화면을 유지합니다.','준비가 오래 걸리면 안내와 다시 열기 버튼을 표시하며, 다시 열기 전에 저장 상태를 확인합니다.']
  },{
    id:'2026-09-22-v2-881-depth',date:'2026-09-22',title:'v2.881 · 입체모드 드래그 위치를 바로잡았습니다',
    changes:['입체모드에서 화면 방향이나 운동장 설정을 바꾼 뒤에도 공과 토큰이 마우스를 정확하게 따라가도록 좌표 보정을 유지합니다.']
  },{
    id:'2026-09-21-v2-880-library',date:'2026-09-21',title:'v2.880 · 팀 등록 메뉴와 명단 저장을 개선했습니다',
    changes:['보관함·게임모델·개인 노트에서 팀 등록 메뉴 이름을 통일했습니다.','팀 명단을 기기에 저장한 뒤 실제 저장 결과를 확인합니다. 다시 열 때 남아 있는 저장본을 불러오고, 저장 실패 시 입력을 유지합니다.','계정 전환과 다른 화면의 수정으로 기존 명단이 덮이는 것을 막고, 작전판에서도 같은 저장 명단을 읽습니다.']
  },{
    id:'2026-09-21-v2-879-update',date:'2026-09-21',title:'v2.879 · 새 버전 알림과 다시 열기를 개선했습니다',
    changes:['새 버전 알림에서 나중에를 누르면 같은 화면에서 반복 표시하지 않습니다.','다시 열기를 누르면 저장 확인 상태와 보류 이유를 안내합니다. 저장 확인이 늦어져도 작성 내용을 버리고 새로고침하지 않습니다.']
  },{
    id:'2026-09-21-v2-878-schedule',date:'2026-09-21',title:'v2.878 · 일정 저장과 조별 집계를 개선했습니다',
    changes:['주가 바뀐 뒤 일정 저장 확인이 반복 보류될 수 있던 경로를 수정했습니다. 기존 일정 날짜와 동시 편집 보호는 유지합니다.','조별 훈련·경기·휴식 집계를 분리하고 공통 훈련이 포함된 개수를 표시합니다.','월간·연간·일간·인쇄에서도 선택한 조의 일정과 OFF를 반영합니다. 다른 조의 경기를 숨긴 상태에서 잘못 변경하는 경로를 막았습니다.']
  },{
    id:'2026-09-21-v2-877-board-ime',date:'2026-09-21',title:'v2.877 · 작전판 한글 이름 입력을 개선했습니다',
    changes:['선수 이름 입력 중 한글을 확정하는 Enter가 편집을 조기에 종료하지 않도록 수정했습니다.','선수 번호 입력에도 같은 보호를 적용했습니다. 한글 입력을 확정한 뒤 Enter를 누르면 편집을 마칩니다.']
  },{
    id:'2026-09-19-v2-876-schedule-settings',date:'2026-09-19',title:'v2.876 · 조별 일정과 팀 설정 저장을 개선했습니다',
    changes:['주간 일정에서 경기 상대 팀명을 입력하면 바로 반영합니다.','같은 날짜에 A팀 OFF, B팀 훈련처럼 조별로 지정할 수 있습니다. OFF로 바꿔도 기존 훈련 자료는 보존합니다.','엠블럼·팀 색상이 오래된 선수단 사본으로 덮이는 경로와 플레이북 입력 중 화면이 다시 그려지는 경로를 보완했습니다. 개인 게임모델은 기기에 남은 저장본을 먼저 확인합니다.']
  },{
    id:'2026-09-18-v2-875-equipment-volume',date:'2026-09-18',title:'v2.875 · 모든 장비에 형태별 입체 표현을 적용했습니다',
    changes:['입체 보기에서 콘·마커·돔·골대·미니골·더미·폴·사다리·허들·깃발·타이어를 각각의 높이와 두께가 있는 형태로 표시합니다.','골대에는 깊이 있는 그물과 기둥을, 허들에는 지지대와 가로봉을 표현하며 장비 색상과 회전도 반영합니다.','장비 이동과 수동 저장을 유지하고, 평면 보기와 이미지 내보내기는 기존 평면 형태를 사용합니다.']
  },{
    id:'2026-09-18-v2-874-token-drag',date:'2026-09-18',title:'v2.874 · 평면·입체에서 선수·공·장비 이동을 개선했습니다',
    changes:['평면 보기에서도 연속된 이동 입력을 화면 갱신 주기에 맞춰 처리해 반복 계산과 그리기를 줄였습니다.','선수뿐 아니라 공·골대·콘·마커·더미·폴·사다리·허들 등 모든 장비에 같은 이동 처리를 적용합니다.','평면·입체 모두 손을 놓는 최종 위치, 다중 이동과 실행 취소를 유지하며 저장 버튼으로 저장합니다.']
  },{
    id:'2026-09-18-v2-873-depth-drag',date:'2026-09-18',title:'v2.873 · 입체 보기에서 토큰 이동을 더 부드럽게 개선했습니다',
    changes:['입체 보기에서 연속된 이동 입력을 화면 갱신 주기에 맞춰 처리해 불필요한 반복 그리기를 줄였습니다.','운동장 모양이 같을 때 좌표 변환 계산을 재사용하고, 화면 크기·방향이 바뀌면 다시 계산합니다.','손을 놓는 순간의 최종 위치와 여러 토큰 이동·실행 취소를 유지합니다. 보드는 기존처럼 저장 버튼을 눌러 저장합니다.','선수단 평가표를 처음 정리할 때 아직 준비되지 않은 후보 자료까지 저장하려던 문제를 수정했습니다.']
  },{
    id:'2026-09-18-v2-872-loading',date:'2026-09-18',title:'v2.872 · 팀 자료를 받는 동안 화면이 오래 가려지는 문제를 개선했습니다',
    changes:['여러 탭을 함께 열었을 때 팀 자료 수신 대기 화면이 남을 수 있던 문제를 수정했습니다.','전체 대기 화면은 최대 5초 뒤 작은 안내로 바뀌며, 확인된 자료를 보면서 새 자료를 계속 받을 수 있습니다.','다시 시도할 때도 대기 시간을 제한하고, 연결 지연·오프라인 상태를 안내합니다. 계정·팀 확인과 자료 저장 보호는 유지됩니다.']
  },{
    id:'2026-09-18-v2-871-error-recovery',date:'2026-09-18',title:'v2.871 · 저장 오류 복구와 관리자 오류 조회를 개선했습니다',
    changes:['브라우저 저장소 연결이 닫힌 뒤에도 저장을 다시 시도할 수 있도록 복구 처리를 보강했습니다.','저장 기준 사본이 다를 때는 확인된 기준본으로 다시 맞추며, 확인할 수 없는 원문은 보존합니다.','팀 전환·새 편집으로 보류된 작업과 실제 저장 실패를 구분해 안내합니다.','관리자 오류 목록이 1,000건에서 누락되던 문제와 표 정렬을 수정하고, 오류 발생 위치를 확인할 수 있도록 했습니다.']
  },{
    id:'2026-09-18-v2-870-tablet-gamemodel',date:'2026-09-18',title:'v2.870 · 태블릿 보드와 게임모델 입력을 안정화했습니다',
    changes:['태블릿에서 선수를 짧게 눌러 선택할 수 있고, 선수 이동 중 화면이 함께 스크롤되는 문제를 수정했습니다.','가로 화면에서도 색상 선택과 삭제 메뉴를 스크롤해 사용할 수 있습니다.','게임모델 저장 확인 중 입력칸이 다시 그려지던 문제를 줄이고, 기기에 남아 있는 저장 자료를 먼저 불러오도록 했습니다.']
  },{
    id:'2026-09-18-v2-869-board-manual-save',date:'2026-09-18',title:'v2.869 · 보드는 저장 버튼을 눌러 저장합니다',
    changes:['토큰을 옮길 때마다 저장하지 않고, 보드의 저장 버튼을 눌렀을 때 저장합니다. 보관함에서 연 작전판은 저장하고 나가기를 사용합니다.','저장하지 않은 변경을 화면에 표시하고, 새로고침으로 나갈 때 확인합니다.','이미 저장한 자료의 오프라인 전송은 연결이 돌아오면 다시 시도합니다.']
  },{
    id:'2026-09-18-depth-save',date:'2026-09-18',title:'입체 토큰과 보드 저장을 개선했습니다',
    changes:['입체 보기에서 선수·사진·공·장비에 높이와 그림자를 표현하고, 화이트·훈련 피치의 골대를 선명하게 표시합니다.','미리보기와 이미지 내보내기가 선택 중인 보드를 다시 그리지 않도록 바꾸고, 저장 준비가 실패하면 마지막 저장본을 보존합니다.','업데이트 중인 편집 화면은 기존 버전을 유지하고, 저장을 마친 뒤 새 버전으로 전환합니다.']
  },{
    id:'2026-09-18-selection-freeze',date:'2026-09-18',title:'여러 토큰을 선택할 때 멈추는 문제를 수정했습니다',
    changes:['페이지가 여러 개일 때 다중 선택 후 저장과 미리보기 생성이 반복 호출되던 문제를 해결했습니다.','드래그 선택은 선택 테두리만 갱신하고, 미리보기 처리 중에도 선택 상태를 유지합니다.']
  },{
    id:'2026-09-18-team-roster-import',date:'2026-09-18',title:'팀 등록 메뉴와 명단 입력을 개선했습니다',
    changes:['팀 등록에서도 보관함 상단 메뉴를 같은 모양으로 유지하고 탭 이동을 통일했습니다.','등번호·이름·포지션 명단을 엑셀에서 복사하거나 쉼표로 구분해 붙여넣고, 확인 후 한 번에 추가할 수 있습니다.']
  },{
    id:'2026-09-18-pitch-ipad',date:'2026-09-18',title:'골대·워터마크와 아이패드 도크를 정리했습니다',
    changes:['평면 보기의 골대를 평면으로 표시하고, 운동장 5개 배치에서는 왼쪽 큰 운동장에만 골대를 둡니다.','여러 운동장에서도 워터마크를 전체 배치 양 끝에 표시하며 입체 보기에서 도구 막대에 가리지 않도록 맞춥니다.','아이패드 하단 도크 높이를 108px에서 96px로 줄이고 버튼 간격과 여백을 정리했습니다.']
  },{
    id:'2026-09-18-board-stability',date:'2026-09-18',title:'입체 보기와 사진 애니메이션을 안정화했습니다',
    changes:['입체 보기에서 운동장 위치가 흔들리지 않도록 반복 갱신을 없애고 화면 크기가 바뀔 때만 맞춥니다.','애니메이션 도착 장면의 사진·이름·번호·포지션과 삭제된 토큰을 정확히 반영합니다.','토큰 사진을 제거하면 현재 장면에도 바로 저장됩니다.']
  },{
    id:'2026-09-17-board-animation-perspective',date:'2026-09-17',title:'보드 애니메이션과 입체 보기를 개선했습니다',
    changes:['현재 장면의 토큰 위치·이름·번호·포지션을 이후 장면에 적용하고, 페이지 복제 시 애니메이션도 함께 복제합니다. 재생 속도는 최대 4배입니다.','입체 보기의 골대를 바로 세우고 주변 배경을 자연스럽게 채웠습니다. 영상은 평면으로 내보내며 잔디와 PROCESS STUDIO 워터마크를 함께 표시합니다.','사진 토큰의 영역을 조절하고 사진만 표시할 수 있습니다. 공중볼은 높이 1·2·3과 그림자로 표현합니다.']
  },{
    id:'2026-09-17-team-library',date:'2026-09-17',title:'팀 명단과 유니폼을 저장하고 보드에서 불러오세요',
    changes:['보관함의 분석 공간을 팀·선수 등록 전용 페이지로 정리했습니다. 기존 분석 저장 자료는 보존됩니다.','팀 엠블럼과 필드·GK 유니폼 색상·무늬를 저장할 수 있습니다.','보드 설정 → 선수 → 저장 팀 불러오기에서 명단을 선택하면 유니폼도 함께 적용됩니다.']
  },{
    id:'2026-09-17-board-default-settings',date:'2026-09-17',title:'새 보드를 기본 세팅으로 시작할 수 있습니다',
    changes:['보드 설정에서 현재 보드를 기본 세팅으로 저장하면 새 보드를 만들 때 포메이션·표시 방식·운동장 디자인을 이어서 시작합니다.','장비와 그린 선·도형 같은 작업 내용은 기본 세팅에 섞이지 않도록 비워 둡니다.']
  },{
    id:'2026-09-17-meeting-portrait-text',date:'2026-09-17',title:'세로형 미팅의 텍스트를 위로 옮겼습니다',
    changes:['세로형 미팅은 텍스트 위·보드 아래로 표시하며 PDF에도 같은 배치를 적용합니다.','미팅 페이지 오른쪽 상단의 슬라이드 안내 문구를 제거했습니다.']
  },{
    id:'2026-09-17-meeting-page-editor',date:'2026-09-17',title:'미팅 페이지를 바로 편집하고 PDF로 저장하세요',
    changes:[
      '미팅에서 가로형·세로형을 선택하고 화면과 같은 배치로 PDF를 내보낼 수 있습니다.',
      '제목·메모·상단 문구를 눌러 바로 수정하고 글자 크기·굵기·색상을 바꿀 수 있습니다. 가로형은 오른쪽에 긴 메모를 이어서 작성합니다.',
      '커뮤니티에서 보는 보드는 읽기 전용으로 보호합니다. 보관함에 담은 사본은 편집할 수 있습니다.'
    ]
  },{
    id:'2026-09-17-availability-meeting-pdf',date:'2026-09-17',title:'가용인원과 미팅 PDF를 개선했습니다',
    changes:[
      '참여 화면을 가용인원으로 통일했습니다. 오늘의 선수 상태와 명단·인원 집계가 함께 반영되며 과거 기록은 유지됩니다.',
      '미팅을 A4 세로·가로 PDF로 내보낼 수 있습니다. 보드는 여백을 채우고 가로형에서는 운동장도 가로로 출력됩니다.',
      '제목과 메모는 페이지당 최대 4줄로 표시하며 긴 내용은 다음 페이지로 이어집니다.'
    ]
  },{
    id:'2026-09-17-ipad-board-pitch-options',date:'2026-09-17',title:'아이패드 보드와 피치 선택을 개선했습니다',
    changes:[
      '아이패드의 보드 도구를 데스크톱과 같은 배치로 정리하고, 보드 설정 글자를 줄였습니다.',
      '잔디·딥그린·네이비·화이트·훈련 배경과 직접 색 선택을 모두 사용할 수 있습니다. 처음 사용하는 보드는 네이비로 시작합니다.',
      '저장된 보드의 배경은 그대로 불러오며, 새 페이지와 새 보드를 만들 때도 현재 배경을 유지합니다.'
    ]
  },{
    id:'2026-09-17-board-scene-click',date:'2026-09-17',title:'장면 번호를 클릭해 바로 이동하세요',
    changes:[
      '새 장면을 추가한 뒤 다른 장면 번호를 마우스로 눌러도 이동하지 않던 문제를 수정했습니다. 키보드 이동과 장면 메뉴도 함께 사용할 수 있습니다.',
      '운동장 왼쪽 위와 오른쪽 아래 코너 바깥에 작은 PROCESS 워터마크를 넣었습니다.'
    ]
  },{
    id:'2026-09-17-scout-identity-popup',date:'2026-09-17',title:'선수 기본 정보를 한 번에 수정합니다',
    changes:[
      '스카우트 명단에서 이름을 누르면 이름·출신 팀·등번호를 함께 수정할 수 있습니다. 저장하면 함께 반영되고 취소하면 기존 정보를 유지합니다.',
      '이름 아래의 팀명과 등번호를 같은 글자 형태로 정리했습니다.'
    ]
  },{
    id:'2026-09-17-vault-training-description',date:'2026-09-17',title:'보관함 훈련 설명을 열 때도 이어서 보여줍니다',
    changes:[
      '보관함 오른쪽 미리보기에는 보이던 설명이 실제 훈련 보기·편집 화면에서 빈 칸처럼 보이던 호환 문제를 수정했습니다.',
      '예전 설명·진행·준비 필드는 현재 훈련 방법 칸으로 이어서 열리고, 코칭 포인트는 그대로 유지됩니다.'
    ]
  },{
    id:'2026-09-17-scout-mobile-origin',date:'2026-09-17',title:'모바일 출신 팀명과 등번호를 붙였습니다',
    changes:[
      '스카우트 명단에서 출신 팀명 바로 옆에 등번호를 표시합니다. 팀명을 수정해도 간격이 따라 바뀝니다.'
    ]
  },{
    id:'2026-09-17-scout-board-size',date:'2026-09-17',title:'스카우팅 보드와 명단 편집을 다듬었습니다',
    changes:[
      '스카우팅 운동장과 카드 폭·여백·선수 행 높이를 선수단 보드 기준으로 통일했습니다.',
      '우리팀과 후보는 모두 표시하며, 선수 수에 따라 운동장 자체가 커지지 않습니다.',
      '명단의 이름을 눌러 바로 수정할 수 있고, 행 끝의 화살표 버튼에서 프로필을 편집할 수 있습니다. 이름 아래에 출신 팀과 등번호를 모아 작은 화면에서도 이름을 읽기 편하게 했습니다.'
    ]
  },{
    id:'2026-09-17-scout-alignment',date:'2026-09-17',title:'스카우트 명단 정렬과 카드 크기를 다듬었습니다',
    changes:[
      '등번호와 평가 배지를 가운데로 맞추고, 데스크톱의 팀명 입력 칸을 줄였습니다.',
      '보드 카드에서 우리팀과 스카우트 후보를 모두 펼쳐 보여줍니다. 선수 수에 따라 카드 높이가 늘어나며 카드 내부 스크롤은 없어집니다.'
    ]
  },{
    id:'2026-09-16-scout-single-row',date:'2026-09-16',title:'스카우트 명단을 한 줄씩 확인하세요',
    changes:[
      '스카우트 후보를 모바일에서도 팀·배번·이름·상태·프로필·평가·＋메모 순서로 한 줄에 표시합니다.',
      '＋메모를 누르면 여러 메모를 추가·수정하거나 후보를 보관할 수 있습니다.',
      '스카우팅 운동장에는 우리팀과 후보를 함께 표시하며, 선수가 많은 포지션 카드는 안에서 스크롤할 수 있습니다.'
    ]
  },{
    id:'2026-09-16-match-gk-lineup',date:'2026-09-16',title:'경기별 GK 지정과 우리 11 배치를 개선했습니다',
    changes:[
      '운동장 선수를 누른 뒤 ‘이 경기 역할’에서 GK를 선택하면 골키퍼 유니폼으로 바뀝니다. 필드로 되돌릴 수도 있습니다.',
      '같은 경기의 준비·상대 분석과 모든 페이지에 적용되며, 선수단의 기본 포지션과 등번호는 유지합니다.',
      '상대 분석 ‘우리 11’은 경기 준비의 선발 위치를 우선 가져옵니다. 준비된 배치가 없으면 포지션에 맞는 자리만 채워 임의 배치를 방지합니다.'
    ]
  },{
    id:'2026-09-16-match-squad-above-pitch',date:'2026-09-16',title:'선발·리저브를 운동장 위에서 확인하세요',
    changes:[
      '경기 준비와 상대 분석에서 선발·리저브를 운동장 바로 위의 짧은 이름표로 표시합니다.',
      '나머지 선수 명단은 왼쪽 폭을 줄여 운동장을 더 넓게 볼 수 있습니다.',
      '왼쪽 명단과 선발·리저브 사이 이동, 운동장 배치와 명단 순서 변경은 그대로 사용할 수 있습니다.'
    ]
  },{
    id:'2026-09-16-match-roster-left',date:'2026-09-16',title:'명단을 작게 보고, 경기 준비 페이지를 자유롭게 추가하세요',
    changes:[
      '경기 준비와 상대 분석의 왼쪽 명단에서 이름·등번호와 간격을 줄여 더 많은 선수를 볼 수 있습니다.',
      '경기 준비에서 ＋ 페이지를 누르면 현재 배치를 그대로 복사합니다. 이름도 자유롭게 바꿀 수 있습니다.',
      '기존 페이지 이름과 배치는 유지하며, 복사한 페이지는 따로 수정할 수 있습니다.'
    ]
  },{
    id:'2026-09-16-training-viewer-pause',date:'2026-09-16',title:'훈련 보기 화면에 일시정지를 추가했습니다',
    changes:[
      '보관함과 커뮤니티에서 훈련을 열어 보는 화면의 움직임 재생 컨트롤을 재생·일시정지·정지로 분리했습니다.',
      '일시정지는 현재 장면을 그대로 유지하고, 정지는 재생 전 화면으로 돌아갑니다.'
    ]
  },{
    id:'2026-09-16-training-preview-pause',date:'2026-09-16',title:'훈련 애니메이션 일시정지 추가',
    changes:[
      '보관함과 커뮤니티 훈련 미리보기에서 정지와 일시정지를 분리했습니다.',
      '일시정지는 현재 장면에 그대로 멈추고, 정지는 기존처럼 미리보기를 닫아 처음 화면으로 돌아갑니다.'
    ]
  },{
    id:'2026-09-16-save-conflict',date:'2026-09-16',title:'반복 저장 충돌과 경기 확인을 개선했습니다',
    changes:[
      '서버에 같은 내용이 저장됐는데도 재시도가 반복되던 경우를 다시 확인해 마무리합니다.',
      '서버 목록에서 자료가 빠졌을 때 해당 자료를 직접 확인하고 동기화를 이어갑니다.',
      '경기 자료의 확인이 끝났으면 다른 자료의 저장 오류가 경기 화면을 다시 막지 않도록 수정했습니다.'
    ]
  },{
    id:'2026-09-15-private-board-storage',date:'2026-09-15',title:'개인 보드 저장과 복구 사본 관리를 개선했습니다',
    changes:[
      '저장 충돌이 반복돼도 같은 편집 창의 복구 사본이 계속 늘어나지 않도록 수정했습니다.',
      '기존 복구 사본은 원문을 확인한 뒤 큰 저장소로 옮기며, 개인 보드 사본을 백업 파일에도 포함합니다.',
      '보드를 불러오지 못했을 때 현재 화면을 빈 보드로 바꾸지 않습니다.'
    ]
  },{
    id:'2026-09-15-match-lineup',date:'2026-09-15',title:'경기 준비 선수 이동과 세로 보기를 개선했습니다',
    changes:[
      '저장 중에도 선수를 다시 잡아 옮길 수 있도록 수정했습니다.',
      '경기장 위 가로·세로 버튼으로 배치를 그대로 바꿔 볼 수 있습니다.',
      '세로 경기장에서도 선수를 추가하고 위치를 옮길 수 있습니다.'
    ]
  },{
    id:'2026-09-15-folder-intermediate',date:'2026-09-15',title:'폴더 목록의 반복 저장을 보완했습니다',
    changes:[
      '폴더가 추가된 중간 목록 때문에 저장이 반복 대기하는 경우를 수정했습니다.',
      '기기에만 있는 폴더나 삭제는 자동으로 덮지 않습니다.',
      '서버에서 바뀐 폴더 목록도 현재 화면에 반영합니다.'
    ]
  },{
    id:'2026-09-15-update-transition-wait',date:'2026-09-15',title:'팀 전환 중 자동 업데이트가 기다립니다',
    changes:[
      '자동 업데이트의 새로고침이 팀 전환을 중간에 끊지 않도록 수정했습니다.',
      '전환과 기기 저장이 끝난 뒤 새 버전을 적용합니다.',
      '중단된 전환 표시가 남아 다음 작업을 막는 경우를 복구합니다.'
    ]
  },{
    id:'2026-09-15-idp-read-state',date:'2026-09-15',title:'IDP의 불필요한 저장 대기를 줄였습니다',
    changes:[
      '작성 내용은 같은데 공지 읽은 시각만 달라 저장이 막히던 경우를 자동으로 맞춥니다.',
      '개인 이미지 노트는 기기에 유지하고, 실제 작성 내용이 다르면 기존 보호 절차를 따릅니다.'
    ]
  },{
    id:'2026-09-15-folder-save-convergence',date:'2026-09-15',title:'보관함 폴더의 반복 저장을 수정했습니다',
    changes:[
      '두 기기 저장소 중 한쪽에 이미 같은 내용이 반영됐을 때, 나머지 저장도 정상적으로 마무리합니다.',
      '저장 도중 새로 편집한 내용은 그대로 보호합니다.'
    ]
  },{
    id:'2026-09-15-data-stability',date:'2026-09-15',title:'저장과 팀 전환의 반복 오류를 수정했습니다',
    changes:[
      '팀 전환이 취소돼도 그 사이 완료된 저장 기록을 유지합니다.',
      '연속 저장을 검증 실패로 잘못 표시하던 문제를 수정했습니다.',
      '저장 이력에서 정확한 기준본을 확인할 수 있는 IDP 자료는 자동으로 동기화를 재개합니다.'
    ]
  },{
    id:'2026-09-15-workspace-save-wait',date:'2026-09-15',title:'작업 공간 전환의 저장 대기를 개선했습니다',
    changes:[
      '자료 확인이 진행 중인데도 개인 작업과 팀 사이의 전환이 일찍 취소되는 문제를 줄였습니다.',
      '저장 확인이 끝난 뒤 전환하며, 확인에 실패하면 현재 자료를 유지합니다.'
    ]
  },{
    id:'2026-09-15-quiet-save-footer',date:'2026-09-15',title:'저장 상태를 오른쪽 아래로 옮겼습니다',
    changes:[
      '저장 상태를 화면 오른쪽 아래에 작게 표시하고 깜빡임을 없앴습니다.',
      '하단 도구와 겹치지 않으며, 저장 상태가 바뀌어도 화면 위치를 유지합니다.',
      '저장 오류나 별도 보관된 변경은 같은 자리에서 확인할 수 있습니다.'
    ]
  },{
    id:'2026-09-15-stable-save-status',date:'2026-09-15',title:'저장 중에도 화면 위치를 유지합니다',
    changes:[
      '저장 상태 표시의 높이를 고정해 보관함과 보드 화면이 위아래로 움직이지 않도록 했습니다.',
      '표시가 잠시 숨겨져도 보고 있던 화면의 위치와 높이를 유지합니다.'
    ]
  },{
    id:'2026-09-15-autosave-record-recovery',date:'2026-09-15',title:'멈춰 있던 저장 재시도를 고쳤습니다',
    changes:[
      '이전 저장 기록이 남아 있을 때 재시도가 멈추던 문제를 고쳤습니다.',
      '기존 기록을 보존하며, 서버에서 저장된 내용을 확인한 뒤 저장 완료로 표시합니다.',
      '오류 안내에서 기기 저장과 서버 확인 문제를 구분합니다.'
    ]
  },{
    id:'2026-09-15-private-working-board',date:'2026-09-15',title:'작업 중인 보드를 개인 공간으로 분리했습니다',
    changes:[
      '작업 중인 보드는 내 계정에 저장되며, 다른 코치의 보드는 자동으로 열리지 않습니다.',
      '같은 계정은 팀을 바꿔도 내 보드를 이어서 사용합니다.',
      '보관함에 저장한 자료는 기존 공유 설정을 유지합니다.'
    ]
  },{
    id:'2026-09-15-roster-server-confirmation',date:'2026-09-15',title:'선수 삭제와 저장 확인을 보강했습니다',
    changes:[
      '선수단에서 삭제한 기록을 보존하는 처리를 보강했습니다.',
      '선수 변경은 서버에 저장된 내용까지 확인한 뒤 저장 완료로 표시합니다.',
      '삭제 확인 중 계정·팀이나 선수 정보가 달라지면 이전 요청을 적용하지 않습니다.'
    ]
  },{
    id:'2026-09-15-roster-save-coordination',date:'2026-09-15',title:'선수단 저장 안정성을 높였습니다',
    changes:[
      '선수별 저장은 실제로 수정한 선수만 반영하도록 정리했습니다.',
      '저장 대기 중인 선수 변경은 이 기기에 보관하고, 다시 열었을 때 이어서 저장합니다.',
      '계정·팀 전환 중 늦게 도착한 명단이 현재 편집을 덮지 않도록 보강했습니다.'
    ]
  },{
    id:'2026-09-15-help-web-pages',date:'2026-09-15',title:'사용법을 웹페이지로 모았습니다',
    changes:[
      '앱 설정의 사용법 탭에서 앱·팀 운영·IDP·설치 안내와 전체 설명서를 찾습니다.',
      '모든 안내는 새 웹페이지로 열립니다. 앱 사용법은 기존 6개 언어를 지원합니다.'
    ]
  },{
    id:'2026-09-15-compact-participation',date:'2026-09-15',title:'선수별 누적을 한 줄 목록으로',
    changes:[
      '선수 이름·번호·포지션과 누적 일수를 한 줄로 정리해 더 많은 선수를 한눈에 봅니다.',
      '휴대폰에서도 운동·쉼·부상·재활·미기록을 나란히 확인하고, 이름을 누르면 상세 기록이 열립니다.'
    ]
  },{
    id:'2026-09-15-participation-history',date:'2026-09-15',title:'날짜별 참여 기록과 선수별 누적 현황',
    changes:[
      '참여 화면에서 날짜를 누르면 그날 선수 명단과 기록을 확인하고 수정할 수 있습니다.',
      '선수별로 운동한 날과 쉰 날, 부상·재활 일수를 한눈에 확인합니다.',
      '오늘 부상으로 바꾼 상태는 복귀 전까지 주말을 포함해 누적하며, 지난 날짜의 정정은 그날에만 반영합니다.'
    ]
  },{
    id:'2026-09-15-automatic-save',date:'2026-09-15',title:'자동 저장과 기기 간 자료 맞추기 개선',
    changes:[
      '저장 중·저장됨 상태를 화면에서 간단히 확인합니다.',
      '서로 다른 항목의 수정은 자동으로 합치며, 겹친 원문은 이 기기에 별도 보관합니다.',
      '보관한 원문은 앱 설정 → 데이터 → 고급 → 최근 변경 복구에서 확인하고 내려받을 수 있습니다.'
    ]
  },{
    id:'2026-09-15-admin-support',date:'2026-09-15',title:'오류 제보와 관리자 답변 연결',
    changes:[
      '앱에서 보낸 오류 제보가 관리자 접수함에 연결됩니다.',
      '운영자가 남긴 답변을 오류 제보의 내 제보와 답변에서 확인할 수 있습니다.'
    ]
  },{
    id:'2026-09-15-save-review-support',date:'2026-09-15',title:'저장 안내와 문의 기능 개선',
    changes:[
      '저장할 내용 선택 화면을 간결하게 정리했습니다. 복구와 점검은 앱 설정에서 열 수 있습니다.',
      '앱에서 오류나 불편한 점을 문의하고 답변을 확인할 수 있습니다.',
      '문의에 필요한 오류 기록을 복사할 수 있습니다.'
    ]
  }];
  function text(value){return typeof value==='string'?value:'';}
  function entries(value){
    return (Array.isArray(value)?value:[]).filter(function(x){return x&&typeof x==='object'&&text(x.id)&&text(x.title);}).map(function(x){
      return {id:text(x.id),date:text(x.date),title:text(x.title),changes:(Array.isArray(x.changes)?x.changes:[]).filter(function(s){return typeof s==='string'&&!!s;})};
    });
  }
  /* 전체 표시 내용을 그대로 비교한다. 해시 충돌이나 버전 번호 재사용으로 새 안내가 숨겨지지 않는다. */
  function revision(value){return 'release-notes-v1:'+JSON.stringify(entries(value));}
  function validTime(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0;}
  function makeHidden(input){
    input=input||{};
    if(!validTime(input.now)||!entries(input.entries).length)return null;
    return {revision:revision(input.entries),from:input.now,until:input.now+WEEK_MS};
  }
  function shouldShow(input){
    input=input||{};
    if(!entries(input.entries).length)return false;
    var h=input.hidden,now=input.now;
    if(!h||typeof h!=='object'||h.revision!==revision(input.entries)||!validTime(now)||
       !validTime(h.from)||!validTime(h.until)||h.until-h.from!==WEEK_MS)return true;
    /* 시계가 뒤로 이동했거나 저장 값이 미래를 가리키면 안내를 영구적으로 숨기지 않는다. */
    return now<h.from||now>=h.until;
  }
  function readHidden(win){
    try{var raw=win.localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null;}catch(_){return null;}
  }
  var CSS=[
    '.ps-release-notes{flex:0 0 auto;min-width:0;background:var(--bar,#fff);color:var(--txt,#14161a);border-bottom:1px solid var(--line,#e3e6ea);font:inherit}',
    'body.fmdark .ps-release-notes{--bar:#1b1e23;--bar2:#23272d;--line:#2e333a;--txt:#f2f3f5;--dim:#a9afb8;--blue:#6f94f5}',
    '.ps-release-notes[hidden],.ps-release-notes [hidden]{display:none!important}',
    '.ps-release-notes *{box-sizing:border-box}',
    '.ps-release-notes .psrn-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;padding:9px 16px}',
    '.ps-release-notes .psrn-summary{flex:1 1 250px;min-width:0}',
    '.ps-release-notes .psrn-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;font-size:12px;line-height:1.45}',
    '.ps-release-notes .psrn-label{color:var(--blue,#3a6df0);font-weight:800}',
    '.ps-release-notes .psrn-meta{color:var(--dim,#646a73);font-size:11px}',
    '.ps-release-notes .psrn-title{margin-top:2px;font-size:12px;line-height:1.45;overflow-wrap:anywhere}',
    '.ps-release-notes .psrn-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
    '.ps-release-notes button{appearance:none;min-height:32px;padding:5px 9px;border:1px solid var(--line,#e3e6ea);border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:600;line-height:1.4;cursor:pointer}',
    '.ps-release-notes button:hover{background:var(--bar2,#f1f2f4)}',
    '.ps-release-notes button:focus-visible{outline:2px solid var(--blue,#3a6df0);outline-offset:2px}',
    '.ps-release-notes .psrn-details{padding:0 16px 12px;max-height:220px;max-height:min(32dvh,220px);overflow:auto;overscroll-behavior:contain}',
    '.ps-release-notes .psrn-entry{padding-top:10px;border-top:1px solid var(--line,#e3e6ea)}',
    '.ps-release-notes .psrn-entry+.psrn-entry{margin-top:10px}',
    '.ps-release-notes h3{margin:0;font-size:12px;font-weight:800;line-height:1.5;overflow-wrap:anywhere}',
    '.ps-release-notes ul{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.65}',
    '.ps-release-notes li{overflow-wrap:anywhere}',
    '.ps-release-notes .psrn-notice{margin:0;padding:0 16px 10px;font-size:12px;line-height:1.5;color:var(--dim,#646a73)}',
    '@media(max-width:480px){.ps-release-notes .psrn-row{padding:8px 12px;gap:7px}.ps-release-notes .psrn-summary{flex-basis:100%}.ps-release-notes .psrn-details{padding:0 12px 10px}.ps-release-notes .psrn-notice{padding:0 12px 9px}}'
  ].join('\n');
  function mount(options){
    options=options||{};
    var win=options.window||(typeof window!=='undefined'?window:null),host=options.host;
    if(!win||!win.document||!host)return null;
    if(host.__psReleaseNotes&&host.__psReleaseNotes.destroy)host.__psReleaseNotes.destroy();
    var doc=win.document,current=entries(options.entries===undefined?DEFAULT_ENTRIES:options.entries),timer=null,disposed=false,expanded=false;
    var now=typeof options.now==='function'?options.now:function(){return Date.now();};
    if(!doc.getElementById('psReleaseNotesStyle')){
      var style=doc.createElement('style');style.id='psReleaseNotesStyle';style.textContent=CSS;(doc.head||doc.documentElement).appendChild(style);
    }
    host.classList.add('ps-release-notes');host.setAttribute('role','region');host.setAttribute('aria-label','최근 업데이트');
    function el(tag,cls,label){var node=doc.createElement(tag);if(cls)node.className=cls;if(label!==undefined)node.textContent=label;return node;}
    var row=el('div','psrn-row'),summary=el('div','psrn-summary'),heading=el('div','psrn-heading');
    var label=el('span','psrn-label','최근 업데이트'),meta=el('span','psrn-meta'),title=el('div','psrn-title');
    heading.appendChild(label);heading.appendChild(meta);summary.appendChild(heading);summary.appendChild(title);row.appendChild(summary);
    var actions=el('div','psrn-actions'),toggle=el('button','','내용 보기'),hide=el('button','','일주일간 안 보기');
    toggle.type=hide.type='button';toggle.setAttribute('aria-expanded','false');
    actions.appendChild(toggle);actions.appendChild(hide);row.appendChild(actions);
    var detail=el('div','psrn-details'),notice=el('p','psrn-notice');detail.hidden=true;notice.hidden=true;notice.setAttribute('role','status');
    if(host.id){detail.id=host.id+'Details';toggle.setAttribute('aria-controls',detail.id);}
    host.replaceChildren(row,detail,notice);
    function clearTimer(){if(timer!==null){win.clearTimeout(timer);timer=null;}}
    function render(){
      title.textContent=current.length?current[0].title:'';
      meta.textContent=[win.PS_BUILD?'v'+String(win.PS_BUILD):'',current.length?current[0].date:''].filter(Boolean).join(' · ');
      detail.replaceChildren();
      current.forEach(function(entry){
        var article=el('section','psrn-entry'),name=el('h3','',entry.title),date=el('div','psrn-meta',entry.date),list=el('ul');
        article.appendChild(name);article.appendChild(date);
        entry.changes.forEach(function(change){list.appendChild(el('li','',change));});
        article.appendChild(list);detail.appendChild(article);
      });
    }
    function refresh(nextEntries){
      if(disposed)return;
      if(Array.isArray(nextEntries)){current=entries(nextEntries);render();}
      clearTimer();
      var at=now(),hidden=readHidden(win),visible=shouldShow({entries:current,hidden:hidden,now:at});
      host.hidden=!visible;
      if(!visible&&current.length&&hidden&&hidden.until>at){
        timer=win.setTimeout(function(){timer=null;refresh();},Math.min(hidden.until-at,2147483647));
      }
    }
    function showDetails(){expanded=!expanded;detail.hidden=!expanded;toggle.textContent=expanded?'내용 접기':'내용 보기';toggle.setAttribute('aria-expanded',String(expanded));}
    function hideWeek(){
      var value=makeHidden({entries:current,now:now()}),stored=false;
      if(value)try{
        var raw=JSON.stringify(value);win.localStorage.setItem(STORAGE_KEY,raw);
        stored=win.localStorage.getItem(STORAGE_KEY)===raw;
      }catch(_){}
      if(!stored){notice.textContent='설정을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.';notice.hidden=false;host.hidden=false;return;}
      notice.textContent='';notice.hidden=true;refresh();
    }
    function onStorage(event){if(!event||event.key===null||event.key===STORAGE_KEY)refresh();}
    function onVisible(){if(!doc.hidden)refresh();}
    toggle.addEventListener('click',showDetails);hide.addEventListener('click',hideWeek);
    win.addEventListener('storage',onStorage);win.addEventListener('focus',onVisible);doc.addEventListener('visibilitychange',onVisible);
    var controller={refresh:refresh,destroy:function(){
      if(disposed)return;disposed=true;clearTimer();
      toggle.removeEventListener('click',showDetails);hide.removeEventListener('click',hideWeek);
      win.removeEventListener('storage',onStorage);win.removeEventListener('focus',onVisible);doc.removeEventListener('visibilitychange',onVisible);
      host.replaceChildren();host.hidden=true;if(host.__psReleaseNotes===controller)delete host.__psReleaseNotes;
    }};
    host.__psReleaseNotes=controller;render();refresh();return controller;
  }
  return {STORAGE_KEY:STORAGE_KEY,WEEK_MS:WEEK_MS,entries:function(){return entries(DEFAULT_ENTRIES);},revision:revision,makeHidden:makeHidden,shouldShow:shouldShow,mount:mount};
});
