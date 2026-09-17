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
