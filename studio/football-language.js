/* PROCESS STUDIO — 글로벌 표준 축구 용어(1.914)
   영문은 FIFA Football Language(2023)·FIFA Enhanced Football Intelligence(EFI) 지표·UEFA 지도자 교육에서 통용되는 표기.
   한글 이름·설명은 PROCESS가 현장 학습용으로 풀어쓴 번역(비공식). 한 항목 = {id, cat, ko, en, def, cue}
   cat: state 경기 상태 · poss 볼 소유 · outp 볼 비소유 · trans 전환 · set 세트피스 · space 공간·구조 · action 개인 행동 · metric 분석 지표
   팀은 이 표준 개념 위에 "우리 말"(cs_terms_v1, std=id)을 얹는다 — 표준은 사전, 팀 언어는 그 사전을 우리 식으로 부르는 방법. */
(function(){
  var C={state:'경기 상태',poss:'볼 소유',outp:'볼 비소유',trans:'전환',set:'세트피스',space:'공간·구조',action:'개인 행동',metric:'분석 지표'};
  function T(id,cat,ko,en,def,cue){return {id:id,cat:cat,ko:ko,en:en,def:def,cue:cue||''};}
  var L=[
    // ── 경기 상태(FIFA phases of play)
    T('in_possession','state','볼 소유','In possession','우리 팀이 공을 통제하고 있는 상태.','“소유에서 먼저 전진 옵션을 봐.”'),
    T('out_possession','state','볼 비소유','Out of possession','상대가 공을 통제해 우리 팀이 수비 역할을 하는 상태.','“비소유엔 중앙부터 닫아.”'),
    T('in_contest','state','경합 중','In contest','어느 팀도 통제된 소유를 갖지 못한 상태 — 세컨드 볼 국면.','“경합이야, 세컨드 볼 준비.”'),
    T('attacking_transition','state','공격 전환','Attacking transition','공을 되찾은 직후 수비→공격 역할로 바뀌는 짧은 국면.','“되찾자마자 앞부터 봐.”'),
    T('defensive_transition','state','수비 전환','Defensive transition','공을 잃은 직후 공격→수비 역할로 바뀌는 짧은 국면.','“잃었다, 5초 안에 되찾거나 정렬.”'),
    T('set_play','state','세트 플레이','Set play','코너킥·프리킥·스로인·PK 등 정해진 재시작으로 시작되는 국면.','“세트 플레이 역할 확인.”'),
    T('team_shape','state','팀 대형','Team shape','소유·비소유에서 선수들이 함께 만드는 전체 위치 구조.','“대형 앞뒤 간격 다시.”'),
    // ── 볼 소유(빌드업 → 전진 → 파이널 서드)
    T('build_up','poss','빌드업','Build-up','자기 진영에서 공을 소유하며 전진의 출발점을 만드는 국면.','“빌드업은 GK부터 침착하게.”'),
    T('opposed_build_up','poss','압박받는 빌드업','Opposed build-up','상대의 압박을 받는 상태의 빌드업.','“압박 오면 세 번째 선수 찾아.”'),
    T('unopposed_build_up','poss','압박 없는 빌드업','Unopposed build-up','상대가 물러서 압박하지 않는 상태의 빌드업.','“안 오면 끌어내고 전진.”'),
    T('progression','poss','전진','Progression','중원을 거쳐 상대 진영으로 공을 옮겨 가는 국면.','“전진은 라인 하나씩 깨며.”'),
    T('final_third','poss','파이널 서드','Final third','상대 골문 쪽 마지막 1/3 — 마무리를 만드는 구역.','“파이널 서드에선 과감하게.”'),
    T('penetrative_action','poss','관통 행동','Penetrative action','패스·드리블·달리기로 상대 라인을 넘어가는 행동.','“관통이 목적, 소유는 수단.”'),
    T('line_breaking_pass','poss','라인 브레이킹 패스','Line-breaking pass','상대 수비 라인(전방·중원·최종) 하나를 통과하는 패스.','“라인 사이로 찔러.”'),
    T('switch_of_play','poss','전환 패스(사이드 체인지)','Switch of play','상대가 몰린 쪽에서 반대편으로 공격 방향을 크게 바꾸는 패스.','“몰렸다, 반대로.”'),
    T('third_man','poss','서드맨(제3자 연결)','Third-man combination','A→B 패스 뒤 B가 C에게 연결해 직선 패스가 막힌 C를 살리는 3인 조합.','“직선 막히면 벽 → 셋째.”'),
    T('wall_pass','poss','월패스(원투)','Wall pass / One-two','주고 곧바로 되받으며 상대를 지나가는 2인 조합.','“원투로 지나가.”'),
    T('overlap','poss','오버랩','Overlap','공 가진 동료의 바깥쪽 뒤에서 앞으로 겹쳐 뛰는 달리기.','“밖으로 겹쳐!”'),
    T('underlap','poss','언더랩','Underlap','공 가진 동료의 안쪽으로 겹쳐 뛰는 달리기.','“안으로 겹쳐!”'),
    T('cut_back','poss','컷백','Cut-back','엔드라인 근처에서 뒤쪽 페널티 지역 안으로 되돌려 주는 낮은 패스.','“파고들면 컷백 자리 채워.”'),
    T('cross','poss','크로스','Cross','측면에서 페널티 지역 안으로 보내는 패스.','“니어·PK·파 세 자리.”'),
    T('long_ball','poss','롱볼','Long ball','상대 라인 여러 개를 한 번에 넘기는 긴 패스.','“앞이 열렸으면 길게.”'),
    T('counter_attack','poss','역습','Counter-attack','되찾은 직후 상대가 정렬되기 전에 빠르게 골문으로 가는 공격.','“상대 정렬 전에 끝내.”'),
    T('possession_control','poss','소유 통제','Ball possession control','상대 압박 아래서 공을 잃지 않고 통제하는 팀의 능력.','“서두르지 말고 통제.”'),
    T('rest_defence','poss','레스트 디펜스','Rest defence','공격 중에도 역습에 대비해 남겨 두는 수비 구조(보통 2+1·3+1).','“공격 중에도 뒤에 셋.”'),
    T('overload','poss','오버로드(수적 우위)','Overload','한 구역에서 상대보다 많은 수를 만들어 우위를 얻는 것.','“한쪽에 모아 오버로드.”'),
    T('underload','poss','언더로드(반대편 비우기)','Underload','오버로드로 상대를 끌어들여 반대편을 의도적으로 비워 두는 것.','“반대편 1v1 준비.”'),
    T('tempo','poss','템포','Tempo','패스·움직임의 속도 — 원터치·투터치로 상대 정렬을 흔든다.','“템포 올려.”'),
    // ── 볼 비소유(압박·블록·수비 행동)
    T('high_press','outp','하이 프레스','High press','상대 진영 깊숙한 곳에서 시작하는 압박.','“앞에서부터 잡아.”'),
    T('mid_press','outp','미드 프레스','Mid press','중원 높이에서 시작하는 압박.','“중원 라인에서 걸어.”'),
    T('low_press','outp','로우 프레스','Low press','자기 진영 낮은 곳에서 시작하는 압박.','“낮게, 골문 앞만 닫아.”'),
    T('high_block','outp','하이 블록','High block','상대 진영에 형성한 수비 대형.','“라인 올려, 하이 블록.”'),
    T('mid_block','outp','미드 블록','Mid-block','중원에 형성한 수비 대형.','“미드 블록, 중앙 촘촘히.”'),
    T('low_block','outp','로우 블록','Low block','자기 진영 깊숙이 형성한 수비 대형.','“로우 블록, 박스 앞 두 줄.”'),
    T('counter_press','outp','카운터 프레스(역압박)','Counter-press','공을 잃은 직후 그 자리에서 즉시 되찾으려는 압박.','“잃자마자 다시!”'),
    T('pressing_trigger','outp','압박 트리거','Pressing trigger','압박을 시작하는 신호 — 백패스·등지고 받기·긴 터치·터치라인 쪽 패스 등.','“백패스가 트리거야.”'),
    T('cover_shadow','outp','커버 섀도','Cover shadow','압박하는 선수가 몸으로 뒤쪽 패스 길을 가리는 것.','“뒤 옵션 몸으로 가리고 가.”'),
    T('compactness','outp','컴팩트니스(밀집)','Compactness','대형의 가로·세로 간격을 좁혀 사이 공간을 없애는 것.','“앞뒤 25m, 좌우 35m.”'),
    T('defensive_line','outp','수비 라인','Defensive line','최종 수비수들이 만드는 가로선 — 높이가 팀 대형을 결정한다.','“라인 함께 올리고 내려.”'),
    T('recovery_run','outp','리커버리 런(복귀 달리기)','Recovery run','공보다 뒤로 빠르게 돌아가 골문 쪽 수비 위치를 되찾는 달리기.','“골문 쪽으로 먼저 뛰어.”'),
    T('delay','outp','딜레이(지연)','Delay','되찾기 어려울 때 상대의 전진을 늦춰 동료가 정렬할 시간을 버는 수비.','“못 뺏으면 늦춰.”'),
    T('jockeying','outp','조키(간격 유지 대응)','Jockeying','달려들지 않고 거리와 몸 각을 유지하며 상대를 유도하는 1v1 수비.','“들어가지 말고 따라가.”'),
    T('zonal_marking','outp','지역 방어','Zonal marking','선수가 아니라 구역을 맡아 그 안에 들어온 상대를 상대하는 수비.','“사람 말고 구역.”'),
    T('man_marking','outp','대인 방어','Man-marking','특정 상대 선수를 따라다니며 막는 수비.','“네 사람 놓치지 마.”'),
    T('screening','outp','스크리닝(차단 위치)','Screening','상대와 공 사이(또는 골문 사이)에 서서 패스 길을 막는 위치 잡기.','“패스 길 앞에 서.”'),
    T('tracking_runner','outp','러너 추적','Tracking the runner','뒤로 침투하는 상대를 따라 붙어 수비 라인 뒤를 지키는 것.','“뒤로 뛰는 놈 따라가.”'),
    T('offside_line','outp','오프사이드 라인','Offside line','최종 수비 라인을 함께 밀어 올려 상대 침투를 오프사이드로 만드는 것.','“같이 올려!”'),
    T('second_ball','outp','세컨드 볼','Second ball','긴 공·경합 뒤 떨어지는 공 — 먼저 잡는 쪽이 국면을 가진다.','“세컨드 볼 먼저.”'),
    // ── 전환
    T('transition_5s','trans','5초 룰','5-second rule','공을 잃은 뒤 5초 안에 되찾거나, 실패하면 정렬로 전환한다는 원칙.','“5초 안에.”'),
    T('first_pass_forward','trans','첫 패스는 앞으로','First pass forward','되찾은 직후 첫 선택은 전진 — 상대가 정렬되기 전 공간을 쓴다.','“첫 패스 앞으로.”'),
    T('secure_possession','trans','소유 안정화','Secure possession','역습이 안 되면 공을 지키며 대형을 회복하는 선택.','“안 되면 붙잡아.”'),
    // ── 세트피스
    T('set_att','set','공격 세트피스','Attacking set piece','코너킥·프리킥·스로인에서 미리 정한 움직임으로 득점을 노리는 상황.','“역할대로 첫 움직임.”'),
    T('set_def','set','수비 세트피스','Defending set piece','상대 세트피스에서 지역·대인·혼합 방식으로 골문을 지키는 상황.','“니어 포스트, 세컨드 볼.”'),
    T('throw_in','set','스로인','Throw-in','터치라인 재시작 — 소유 유지와 빠른 재시작이 목적.','“빨리 던지고 움직여.”'),
    // ── 공간·구조
    T('half_space','space','하프스페이스','Half-space','중앙과 측면 사이의 세로 통로 — 각도가 열려 위험한 구역.','“하프스페이스에서 받아.”'),
    T('between_lines','space','라인 사이','Between the lines','상대 중원 라인과 수비 라인 사이의 공간.','“라인 사이로 들어가.”'),
    T('in_behind','space','수비 뒤 공간','In behind','상대 최종 수비 라인 뒤의 공간.','“뒤 공간 열렸다.”'),
    T('width','space','폭','Width','대형을 가로로 넓혀 상대 수비를 벌리는 것.','“폭 벌려.”'),
    T('depth','space','깊이','Depth','대형을 세로로 늘려 앞뒤 옵션을 만드는 것.','“깊이 만들어.”'),
    T('zone_14','space','존 14','Zone 14','페널티 지역 바로 앞 중앙 구역 — 결정적 패스가 가장 많이 나오는 곳.','“존 14 채워.”'),
    T('lanes_5','space','5레인','Five lanes','피치를 세로 다섯 통로(측면2·하프스페이스2·중앙1)로 나눈 틀.','“같은 레인에 둘 서지 마.”'),
    T('thirds','space','3분할','Thirds','피치를 수비·중원·공격 세로 1/3로 나눈 틀.','“어느 서드인지 보고 결정.”'),
    T('positional_play','space','포지션 플레이','Positional play','서로 다른 높이·레인을 차지해 삼각형과 우위를 계속 만드는 소유 원칙.','“높이 다르게 서.”'),
    // ── 개인 행동
    T('scanning','action','스캐닝(미리 보기)','Scanning','공을 받기 전 고개를 돌려 주변을 확인하는 것.','“받기 전에 두 번 봐.”'),
    T('body_orientation','action','몸 방향','Body orientation','받을 때 다음 플레이가 가능하도록 몸을 열어 두는 것.','“열고 받아.”'),
    T('half_turn','action','하프턴 받기','Receiving on the half-turn','반쯤 돌아선 자세로 받아 바로 전진할 수 있게 하는 첫 터치.','“반 돌아서.”'),
    T('first_touch','action','퍼스트 터치','First touch','받는 순간의 첫 터치 — 다음 행동의 방향과 속도를 정한다.','“첫 터치 앞으로.”'),
    T('support_angle','action','지원 각','Support angle','공 가진 동료가 바로 줄 수 있도록 상대 뒤·옆으로 각을 만든 위치.','“각 만들어 줘.”'),
    T('offering_receive','action','받기 제안','Offering to receive','움직임·몸짓으로 “나에게 줄 수 있다”를 보이는 것.','“나 여기!”'),
    T('movement_receive','action','받기 위한 움직임','Movement to receive','상대의 시야·마크에서 벗어나 공을 받으러 가는 움직임.','“마크 떼고 움직여.”'),
    T('in_to_out','action','안→밖 움직임','In-to-out movement','안쪽에서 시작해 바깥쪽으로 나가며 받는 움직임.','“안에서 밖으로.”'),
    T('out_to_in','action','밖→안 움직임','Out-to-in movement','바깥쪽에서 시작해 안쪽으로 들어오며 받는 움직임.','“밖에서 안으로.”'),
    T('run_in_behind','action','뒤로 침투','Run in behind','수비 라인 뒤 공간으로 뛰어드는 달리기.','“패스 나가기 전에 출발.”'),
    T('dribble_commit','action','상대 고정(끌어내기)','Commit / Fix a defender','공을 몰고 상대에게 다가가 끌어낸 뒤 비워진 동료에게 주는 것.','“끌어내고 줘.”'),
    T('1v1_att','action','1v1 공격','1v1 attacking','수비수 한 명을 개인 기술로 제치는 상황.','“1v1이면 가.”'),
    T('1v1_def','action','1v1 수비','1v1 defending','공격수 한 명을 혼자 막는 상황 — 거리·각·타이밍.','“들어갈 타이밍 봐.”'),
    T('press_ball','action','볼 압박','Pressure on the ball','공 가진 상대에게 시간·공간을 뺏는 접근.','“공 가진 놈 붙어.”'),
    T('block_shot','action','슛 차단','Blocking the shot','슛 각을 몸으로 막는 수비 행동.','“슛 각 몸으로.”'),
    T('interception','action','인터셉트','Interception','패스 길을 읽고 공을 가로채는 것.','“읽고 끊어.”'),
    // ── 분석 지표(EFI)
    T('m_line_breaks','metric','라인 브레이크 수','Line breaks','상대 라인을 통과한 패스·운반·달리기의 횟수 — 전진의 질.','“오늘 라인 브레이크 몇 번?”'),
    T('m_receptions_between','metric','라인 사이 받기 수','Receptions between the lines','상대 중원과 수비 라인 사이에서 받은 횟수.','“사이에서 몇 번 받았나.”'),
    T('m_receptions_behind','metric','수비 라인 뒤 받기 수','Receptions in behind','상대 최종 라인 뒤에서 받은 횟수.','“뒤에서 받은 게 있었나.”'),
    T('m_final_third_entries','metric','파이널 서드 진입 수','Final third entries','상대 파이널 서드로 공이 들어간 횟수.','“진입은 많았는데 마무리는?”'),
    T('m_ball_recovery_time','metric','볼 회수 시간','Ball recovery time','공을 잃은 뒤 되찾기까지 걸린 시간 — 역압박의 효과.','“회수까지 몇 초 걸렸나.”'),
    T('m_forced_turnovers','metric','강제 턴오버 수','Forced turnovers','압박으로 상대의 소유를 끊어 낸 횟수.','“압박으로 몇 개 뺏었나.”'),
    T('m_def_line_height','metric','수비 라인 높이','Defensive line height','최종 수비 라인의 평균 높이 — 블록의 위치.','“라인 높이 평균 어디였나.”'),
    T('m_team_length','metric','팀 길이·폭','Team length & width','대형의 앞뒤 길이와 좌우 폭 — 밀집도의 실측.','“길이 얼마였나.”'),
    T('m_phases_time','metric','국면별 시간','Time in phases of play','빌드업·전진·파이널 서드·압박·블록 등 각 국면에 머문 시간.','“어느 국면에 오래 있었나.”'),
    T('m_ppda','metric','PPDA(압박 허용 패스 수)','PPDA','수비 행동 1회당 상대에게 허용한 패스 수 — 낮을수록 강한 압박.','“PPDA 낮게.”'),
    T('m_xg','metric','기대 득점','xG (Expected goals)','슛의 위치·상황으로 계산한 득점 확률의 합.','“xG 대비 몇 골.”')
  ];
  window.PS_FOOTBALL_LANGUAGE={version:1,cats:C,list:L,
    byId:function(id){for(var i=0;i<L.length;i++)if(L[i].id===id)return L[i];return null;},
    /* 팀 언어(cs_terms_v1)와 이어 주는 갈래 매핑 — 표준 → 팀 갈래 기본값 */
    layerOf:function(t){ if(!t)return 'concept'; if(t.cat==='action')return 'action'; if(t.cat==='metric'||t.cat==='state'||t.cat==='space')return 'concept'; return 'signal'; }
  };
})();
