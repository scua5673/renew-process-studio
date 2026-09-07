/* PROCESS STUDIO — 평가 표준 v1 (1.974)  ·  한 벌로 팀 평가표 · IDP 셀프평가 · 코치 평가를 통일한다.
   뼈대: FIFA Talent Identification Guide 의 Holistic Player Profile 5차원(Technical·Tactical·Physical·Psychological·Social)
        + FIFA Football Language(2023) 개인 행동 용어 + FA 4 Corner("어느 코너도 따로 보지 않는다").
   2.111: 문장을 **질문**으로 다시 썼다(72개). 한 문장이 두 가지를 묻던 것 47개가 가장 큰 문제였다 —
        "회복하고, 통증은 바로 알린다" 처럼. 규칙: ① 한 문장 = 한 행동 ② 눈으로 본 것만 ③ 긍정문
        ④ 척도에 맞는 동사 ⑤ 한 줄(평균 37자 → 21자). 근거·검토표는 `평가질문-재작성-2026-08-21.html`.
        선수 톤 자리(index 4)가 **질문**, 코치 톤 자리(index 5)가 **관찰 포인트**로 뜻이 바뀌었다 —
        선수와 코치가 **같은 질문**을 읽어야 셀프 vs 코치 대조가 맞다.
   규칙: ① 영역 5개 = 전술·기술·체력·심리·태도(사회)  ② 항목 = 관찰 가능한 행동 문장(라벨은 태그)
        ③ 한 항목은 한 가지만(중복 없음, 옛 44 → 20 → 2.026 24: 공간 인식·볼 운반·책임·회복 추가) + 포지션별 8문항×6그룹(2.026)  ④ 척도 = 성장 단계 1~5(시작·배우는 중·할 수 있음·안정적·강점)  ⑤ 같은 항목, 두 톤(선수 1인칭 행동문 / 코치 관찰문)
   세트피스는 표준에서 뺐다(팀 기준·포지션 역할로). 이 파일은 사전이다 — 화면 문구를 바꾸려면 여기만 고친다. */
(function(){
  var CATS=[["tac","전술"],["tech","기술"],["fit","체력"],["psy","심리"],["att","태도"]];
  /* [id, cat, 라벨, en, 선수 문장(셀프평가·"~한다"), 코치 문장(관찰)] */
  var ITEMS=[
    ["ps_t_scan","tac","스캔·판단","Scanning → decision","공을 받기 전에 고개를 돌려 주변을 확인하나요?","받기 전 스캔이 있고, 첫 선택이 빠르고 상황에 맞는다"],
    ["ps_t_poss","tac","공 있을 때 움직임","In possession — offering / support","공이 없을 때도 받을 수 있는 자리로 움직이나요?","지원 각·받기 제안·뒤 침투로 항상 옵션이 된다"],
    ["ps_t_outp","tac","공 없을 때 압박·커버","Out of possession — press / cover","압박할지 물러설지를 동료와 맞춰 움직이나요?","압박 타이밍·간격·커버 위치가 팀 구조에 맞는다"],
    ["ps_t_trans","tac","전환 반응","Transition (att / def)","공이 넘어간 직후 3초 안에 반응하나요?","잃은 뒤 즉시 역압박/정렬, 되찾은 뒤 즉시 전진 선택"],
    ["ps_t_space","tac","공간 인식","Space recognition (between lines / in behind)","열린 공간을 찾아 들어가나요?","열린 공간 인식·선택(사이 받기 vs 뒤 침투), 타이밍"],   /* 2.026 */
    ["ps_k_touch","tech","퍼스트 터치","First touch / body orientation","첫 터치를 다음 플레이 방향으로 놓나요?","몸 방향·터치 방향이 다음 플레이를 연다"],
    ["ps_k_pass","tech","패스","Passing (short / long)","동료가 편하게 받을 발에 알맞은 세기로 주나요?","정확도·세기·타이밍, 약발 포함"],
    ["ps_k_1v1a","tech","1대1 공격","1v1 attacking / dribble","1대1에서 상대를 벗겨 내나요?","상대 고정(commit)·돌파 성공, 볼 유지"],
    ["ps_k_finish","tech","슛·마무리","Finishing","슛 기회에서 골문 안으로 차나요?","박스 안·중거리·헤더 마무리의 결정과 정확도"],
    ["ps_k_1v1d","tech","1대1 수비","1v1 defending / interception","드리블해 오는 상대를 막아 내나요?","거리 조절·타이밍·인터셉트, 슛 차단"],
    ["ps_k_carry","tech","볼 운반","Ball carrying","앞이 열리면 공을 몰고 전진하나요?","운반 거리·머리 들기·상대 고정 후 패스 타이밍"],   /* 2.026 */
    ["ps_p_speed","fit","스피드","Speed / acceleration","짧은 거리 경쟁에서 상대보다 먼저 닿나요?","가속·최고 속도, 첫 3~5m"],
    ["ps_p_endur","fit","지구력·반복","Endurance / repeated sprint","경기 끝까지 처음과 같은 강도로 뛰나요?","고강도 반복 유지·회복 속도"],
    ["ps_p_agile","fit","민첩·균형","Agility / balance","몸이 부딪혀도 균형을 유지하나요?","방향 전환·접촉 후 자세 유지"],
    ["ps_p_duel","fit","몸싸움·공중볼","Strength / aerial duel","몸싸움과 공중볼 경합에서 버티나요?","지상·공중 경합 승률(힘·점프·타이밍)"],
    ["ps_m_brave","psy","자신감·용기","Confidence / bravery","어려운 플레이를 먼저 시도하나요?","위험 감수·전진 선택·공 요구"],
    ["ps_m_focus","psy","집중력","Concentration","공이 먼 순간에도 자기 위치를 지키나요?","경기 후반·공 먼 상황에서도 위치·마킹 유지"],
    ["ps_m_calm","psy","침착함·회복","Composure / resilience","실수한 다음 플레이를 평소처럼 하나요?","실수 후 반응 시간, 압박 상황 수행 유지"],
    ["ps_m_lead","psy","책임·리더십","Responsibility / leadership","어려운 순간에 공을 달라고 요구하나요?","책임 있는 선택·소리·기준 세우기(완장과 무관)"],   /* 2.026 */
    ["ps_s_team","att","소통·팀워크","Communication / teamwork","경기 중 동료에게 말로 알려 주나요?","지시·격려 언어, 팀 우선 행동"],
    ["ps_s_effort","att","훈련 태도","Training attitude","훈련 처음부터 끝까지 같은 강도로 하나요?","강도 유지·경쟁심·규칙 준수"],
    ["ps_s_self","att","자기 관리","Self-management","약속한 시간과 잠·식사를 스스로 지키나요?","지각·컨디션·부상 예방 습관"],
    ["ps_s_learn","att","배움·피드백","Learning / feedback","들은 피드백을 다음 훈련에서 해 보나요?","피드백 수용 → 행동 변화가 관찰됨"],
    ["ps_s_recover","att","회복·부상 관리","Recovery / injury care","아픈 곳을 바로 알리나요?","회복 습관 이행·통증 보고·재활 성실"]   /* 2.026 */
  ];
  /* 2.025 — 척도 말(사용자 확정, 조건형): 그 행동이 어떤 상황에서 나오나 — 1 아직 · 2 훈련에서 · 3 경기에서 · 4 압박에서도 · 5 내 무기.
     (1.988 성장 단계 '시작·배우는 중·할 수 있음·안정적·강점' 대체. 숫자는 그대로라 기존 점수 유지) */
  var SCALE=[[1,"아직"],[2,"훈련에서"],[3,"경기에서"],[4,"압박에서도"],[5,"내 무기"]];
  /* ⚠ 2.124 — 2.123 에서 단계마다 한 줄 뜻(SCALE_D·SCALE_BD·scaleDesc)을 넣었다가 **뺐다**.
     사용자: "척도에는 설명이 필요없지, 최대한 단순하게 해야지."
     설명이 필요한 곳은 척도가 아니라 **항목 라벨**이었다 — '안쪽 지원(인버티드)' 이 무슨 말인지 모르는 사람이 많다.
     그래서 설명은 항목 쪽(coach 문장)으로 옮겼다(속성표·갭·유형 지도 칩). */
  /* ══ 2.111 · 척도 두 벌 — 하나로 억지로 맞추지 않는다 ═══════════════════════════════
     A 전이 척도(기본, 67문항) : 배운 것이 훈련 → 경기 → 압박으로 **어디까지 옮겨 갔나**.
       전술·기술·체력·심리·포지션. **경기 안에서 관찰되는 행동**에만 쓴다.
     B 빈도 척도(태도 5문항)   : **얼마나 자주 하나**. 전이 사다리를 태도에 대면 뜻이 무너진다 —
       "훈련 처음부터 끝까지 같은 강도로 하나요?" 에 **'압박에서도'** 는 답이 될 수 없다.
     ⚠ 가운데 셋(가끔·보통·자주)은 **스카우팅 포인트와 같은 말**이다
        (scouting.html 은 거의 없음·가끔·보통·자주·항상). 1·5 만 다른 것은 **일부러**다 —
        남의 선수는 사실대로('거의 없음'), 우리 선수는 자랄 여지를 두고('아직') 적는다.
     ⚠ **저장 값은 양쪽 다 1~5.** 자리 요구·자리 적합·아키타입 보정·팀 갭·인쇄 문서가 전부 숫자만 읽으므로
        척도를 갈라도 그 계산들은 한 줄도 안 바뀐다. 바뀌는 것은 **버튼에 붙는 말**뿐이다. */
  var SCALE_B=[[1,"아직"],[2,"가끔"],[3,"보통"],[4,"자주"],[5,"늘"]];
  var SCALE_B_CATS={att:1};   /* 태도만 빈도 — 늘리려면 여기만 고친다 */
  /* 2.112 — 영역을 **물음**으로 부른다. 한 화면에 한 영역만 두면 이 문장이 화면 제목이 되고,
     그 아래 질문들이 그 물음의 갈래로 읽힌다(위계 1층). 팀이 평가표를 직접 만든 경우엔
     여기 없는 id 라 빈 문자열이 오고, 화면은 원래 영역 이름으로 되돌아간다. */
  var CAT_ASK={tac:"경기를 읽는가",tech:"공을 다루는가",fit:"몸이 버티는가",psy:"흔들리지 않는가",
    att:"함께하고 배우는가",pos:"이 자리의 일을 하는가"};
  /* 2.025 — 포지션별 추가 문항(사용자): 기본 20은 모두 공통, 여기 4개는 선수의 포지션 그룹에 따라 자동으로 붙는다. 같은 척도·같은 두 톤 */
  var POS_GROUPS=[["GK","골키퍼"],["CB","센터백"],["FB","풀백·윙백"],["MF","중앙 미드필더"],["W","윙어·측면 미드필더"],["ST","스트라이커"]];
  var POS_ITEMS=[
    /* GK — 8 : 슛·박스·배급·스위핑·1v1·빌드업 참여·조직·세트피스 */
    ["ps_g_shot","GK","슛 막기","Shot stopping","슛을 골문 밖으로 막아 내나요?","세트 포지션·핸들링·리바운드 처리·2차 반응"],
    ["ps_g_cross","GK","크로스·박스 지배","Crosses / commanding the box","박스로 오는 크로스를 직접 처리하나요?","판단 속도·타이밍·콜·펀칭 방향"],
    ["ps_g_dist","GK","배급","Distribution","잡은 뒤 안전한 동료에게 정확히 주나요?","빌드업 첫 패스·롱킥 정확도·던지기·속도 선택"],
    ["ps_g_sweep","GK","뒤 공간 정리","Sweeping","라인 뒤로 넘어온 공에 먼저 나가 처리하나요?","시작 위치·라인 뒤 커버·발 처리·판단"],
    ["ps_g_1v1","GK","1v1 대응","1v1 situations","1대1에서 각을 좁히며 다가가나요?","각 줄이기·타이밍·몸 크게·손 위치"],
    ["ps_g_build","GK","빌드업 참여","Building with the feet","센터백 사이에서 받아 빌드업에 참여하나요?","발밑 안정·압박 아래 선택·전환 패스"],
    ["ps_g_organise","GK","수비 조직·소통","Organising the defence","라인과 마크를 소리로 지시하나요?","지시 내용·타이밍·볼륨·라인 관리"],
    ["ps_g_set","GK","세트피스 수비","Set-piece defending","세트피스에서 벽과 마크를 세우나요?","벽 세우기·시작 위치·첫 스텝·공중볼 결정"],
    /* CB — 8 */
    ["ps_c_air","CB","공중볼","Aerial duels","공중볼 경합에서 먼저 따내나요?","공중 경합 승률·타이밍·헤더 방향·착지 후 대응"],
    ["ps_c_line","CB","라인·커버","Line & cover","짝 센터백과 라인을 맞춰 움직이나요?","라인 유지·커버 깊이·오프사이드 관리·동시 이동"],
    ["ps_c_build","CB","첫 패스","First pass / build-up","압박 속에서도 첫 패스를 안전하게 시작하나요?","빌드업 첫 패스·라인 브레이크 패스·약발"],
    ["ps_c_duel","CB","1v1 수비","1v1 defending","등지거나 돌아서는 공격수를 막아 내나요?","거리 조절·타이밍·파울 없이·측면 몰기"],
    ["ps_c_carry","CB","볼 운반·전진","Stepping in with the ball","공을 몰고 나가 상대를 끌어내나요?","운반 판단·머리 들기·끌어낸 뒤 패스"],
    ["ps_c_step","CB","전진 수비·차단","Stepping out to intercept","사이로 오는 패스에 먼저 나가 끊나요?","예측·인터셉트·나갔다 복귀 속도"],
    ["ps_c_box","CB","박스 수비·블록","Box defending / blocks","박스 안에서 마크와 공을 같이 보나요?","마크 유지·시야·블록·클리어 방향"],
    ["ps_c_setatt","CB","세트피스 공격","Set-piece attacking","세트피스 공격에서 마크를 떼고 들어가나요?","블록/스크린·타이밍·헤더 정확도"],
    /* FB — 8 */
    ["ps_f_1v1","FB","측면 1v1","Wide 1v1","윙어의 돌파를 바깥으로 몰아 늦추나요?","몸 방향·거리·회복 속도·크로스 블록"],
    ["ps_f_over","FB","오버랩·폭","Overlap / width","타이밍에 맞춰 밖으로 오버랩하나요?","폭 제공·오버랩 타이밍·언더랩 판단"],
    ["ps_f_cross","FB","크로스·컷백","Crossing / cut-back","달리면서 정확한 크로스나 컷백을 주나요?","크로스 질·얼리/컷백 선택·약발"],
    ["ps_f_recover","FB","전환 복귀","Recovery run","공을 잃으면 안쪽 경로로 빠르게 돌아오나요?","회복 스프린트·안쪽 경로·뒤 공간 인지"],
    ["ps_f_build","FB","빌드업 받기","Receiving in build-up","압박받는 빌드업에서 열린 자세로 받나요?","받는 자세·선택 속도·라인 통과 패스"],
    ["ps_f_inside","FB","안쪽 지원(인버티드)","Inverted / inside support","안으로 들어와 6번 옆에서 받나요?","안쪽 위치 판단·중앙 보호·역할 전환"],
    ["ps_f_cover","FB","커버·라인 맞추기","Cover & line","반대편 공격 때 안쪽으로 좁혀 커버하나요?","밸런스 위치·좁히기·라인 동시 이동"],
    ["ps_f_duel","FB","경합·공중볼","Duels","측면 경합에서 세컨드 볼을 먼저 잡나요?","경합 승률·세컨드 볼 반응"],
    /* MF — 8 */
    ["ps_m_receive","MF","라인 사이 받기","Receiving between lines","라인 사이에서 열린 자세로 받나요?","받는 자세·전진 첫 터치·스캔"],
    ["ps_m_tempo","MF","템포 조절","Tempo control","빠르게 갈 때와 지킬 때를 나눠 패스하나요?","리듬 조절·리스크 판단·스위치"],
    ["ps_m_screen","MF","스크린·차단","Screening","수비 앞에서 중앙 패스 길을 막나요?","위치·인터셉트·경합·6번 다리 역할"],
    ["ps_m_b2b","MF","박스 투 박스","Box-to-box","수비 가담 뒤에도 박스까지 침투하나요?","왕복 러닝·침투 타이밍·후반 유지"],
    ["ps_m_break","MF","라인 브레이크 패스","Line-breaking pass","라인 사이·뒤로 들어가는 패스를 넣나요?","관통 패스 시도·성공·약발"],
    ["ps_m_third","MF","제3자 움직임","Third-man movement","동료가 받는 순간 다음 공간으로 미리 뛰나요?","업-백-스루 인식·타이밍"],
    ["ps_m_press","MF","압박·커버 판단","Press or cover","동료가 압박 나가면 커버로 자리를 메우나요?","역할 판단·간격·트리거 반응"],
    ["ps_m_cpress","MF","역압박","Counter-press","공을 잃은 5초 안에 다시 뺏으러 가나요?","반응 속도·방향·팀과 동시"],
    /* W — 8 */
    ["ps_w_1v1","W","1v1 돌파","1v1 dribbling","풀백을 정면으로 마주 보고 지나가나요?","돌파 성공·양발·속도 변화"],
    ["ps_w_width","W","폭·안쪽 움직임","Width / inside runs","터치라인에 붙어 상대를 벌리나요?","폭 유지·인→아웃/아웃→인 타이밍"],
    ["ps_w_final","W","마무리 가담","Arriving in the box","반대편 크로스에 먼 쪽 포스트로 들어가나요?","박스 진입 타이밍·득점 관여"],
    ["ps_w_press","W","첫 압박·복귀","Press & track back","공을 잃으면 상대 풀백을 먼저 막나요?","압박 방향·수비 가담·트래킹"],
    ["ps_w_behind","W","뒤 공간 침투","Runs in behind","패스 순간 풀백 뒤로 대각선으로 뛰나요?","타이밍·오프사이드 관리·대각 러닝"],
    ["ps_w_cross","W","크로스·마지막 패스","Crossing / final pass","마지막 패스로 컷백·크로스 중 나은 것을 고르나요?","선택·정확도·약발"],
    ["ps_w_combi","W","연계·2대1","Combination play","풀백·8번과 짧게 주고받아 벗겨 내나요?","벽패스·움직임 연결"],
    ["ps_w_shot","W","슛","Cutting in & shooting","안으로 잘라 들어와 슛하나요?","슛 선택·정확도·반대 발"],
    /* ST — 8 */
    ["ps_s_finish","ST","마무리","Finishing","박스에서 빠르고 정확하게 마무리하나요?","결정력·다양한 마무리·침착함"],
    ["ps_s_run","ST","뒤 공간 침투","Runs in behind","패스 순간 수비 뒤로 뛰나요?","타이밍·오프사이드 관리·러닝 모양"],
    ["ps_s_hold","ST","홀드업·연계","Hold-up / link play","등진 채 공을 지켜 동료에게 내주나요?","몸싸움·레이오프·재침투"],
    ["ps_s_press","ST","첫 수비수","First defender","빌드업을 한쪽으로 모는 첫 압박을 하나요?","압박 각도·트리거 반응·지속"],
    ["ps_s_box","ST","박스 안 움직임","Movement in the box","크로스 순간 마크를 떼고 들어가나요?","마크 떼기·자리 선택·재조정"],
    ["ps_s_air","ST","공중볼·헤더","Aerial / heading","공중볼을 따내거나 헤더로 마무리하나요?","공중 승률·헤더 방향·타이밍"],
    ["ps_s_press2","ST","역압박·수비 가담","Counter-press / defensive work","잃은 직후 역압박에 참여하나요?","역압박 참여·6번 가리기·지속"],
    ["ps_s_create","ST","창출·연결","Creating for others","더 좋은 동료가 있으면 내주나요?","이타적 선택·끌어내기·어시스트"]
  ];
  var POS_MAP={GK:"GK",CB:"CB",LCB:"CB",RCB:"CB",SW:"CB",LB:"FB",RB:"FB",WB:"FB",LWB:"FB",RWB:"FB",DM:"MF",CM:"MF",AM:"MF",CDM:"MF",CAM:"MF",LM:"W",RM:"W",LW:"W",RW:"W",WF:"W",SMF:"W",ST:"ST",CF:"ST",SS:"ST",FW:"ST"};
  var POS_KO=[["골키퍼","GK"],["키퍼","GK"],["센터백","CB"],["중앙 수비","CB"],["풀백","FB"],["사이드백","FB"],["윙백","FB"],["측면 수비","FB"],["윙","W"],["측면","W"],["미드","MF"],["스트라이커","ST"],["공격수","ST"],["포워드","ST"]];
  /* 옛 id → 새 id. 팀 평가표 44(b_*)·IDP 개인 기본표 15(fifa_*)·더 옛 개인표(d_*). 세트피스(b_te_set)는 대응 없음(팀 기준으로). */
  var LEGACY={
    b_tac_read:"ps_t_scan",b_tac_dec:"ps_t_scan",b_tac_off:"ps_t_poss",b_tac_press:"ps_t_outp",b_tac_ta:"ps_t_trans",b_tac_td:"ps_t_trans",
    b_te_first:"ps_k_touch",b_te_ctrl:"ps_k_touch",b_te_short:"ps_k_pass",b_te_long:"ps_k_pass",b_te_cross:"ps_k_pass",b_te_weak:"ps_k_pass",
    b_te_1v1a:"ps_k_1v1a",b_te_finish:"ps_k_finish",b_te_shot:"ps_k_finish",b_te_heada:"ps_k_finish",
    b_te_1v1d:"ps_k_1v1d",b_te_tackle:"ps_k_1v1d",b_te_headd:"ps_k_1v1d",b_te_duel:"ps_p_duel",
    b_fi_accel:"ps_p_speed",b_fi_speed:"ps_p_speed",b_fi_endur:"ps_p_endur",b_fi_rsa:"ps_p_endur",b_fi_recov:"ps_p_endur",
    b_fi_agil:"ps_p_agile",b_fi_bal:"ps_p_agile",b_fi_jump:"ps_p_duel",
    b_ps_conf:"ps_m_brave",b_ps_brave:"ps_m_brave",b_ps_focus:"ps_m_focus",
    b_ps_calm:"ps_m_calm",b_ps_emo:"ps_m_calm",b_ps_press:"ps_m_calm",b_ps_resil:"ps_m_calm",
    b_at_team:"ps_s_team",b_at_lead:"ps_s_team",b_at_train:"ps_s_effort",b_at_comp:"ps_s_effort",
    b_at_self:"ps_s_self",b_at_time:"ps_s_self",b_at_grow:"ps_s_learn",b_at_feed:"ps_s_learn",
    fifa_scan:"ps_t_scan",fifa_space:"ps_t_poss",fifa_decision:"ps_t_scan",fifa_offer:"ps_t_poss",fifa_body:"ps_k_touch",fifa_progress:"ps_k_pass",
    fifa_pressure:"ps_t_outp",fifa_cover:"ps_t_outp",fifa_react:"ps_t_trans",fifa_accel:"ps_p_speed",fifa_repeat:"ps_p_endur",fifa_balance:"ps_p_duel",
    fifa_communicate:"ps_s_team",fifa_recover:"ps_m_calm",fifa_learn:"ps_s_learn",
    d_pos:"ps_t_poss",d_scan:"ps_t_scan",d_dec:"ps_t_scan",d_run:"ps_t_poss",d_defw:"ps_t_outp",d_touch:"ps_k_touch",d_pass:"ps_k_pass",d_drib:"ps_k_1v1a",d_shot:"ps_k_finish",d_head:"ps_k_finish",
    d_spd:"ps_p_speed",d_sta:"ps_p_endur",d_str:"ps_p_duel",d_agi:"ps_p_agile",d_conf:"ps_m_brave",d_foc:"ps_m_focus",d_brave:"ps_m_brave"
  };
  var byId={}; ITEMS.forEach(function(a){ byId[a[0]]={id:a[0],cat:a[1],name:a[2],en:a[3],player:a[4],coach:a[5]}; });
  var posById={}; POS_ITEMS.forEach(function(a){ posById[a[0]]={id:a[0],grp:a[1],name:a[2],en:a[3],player:a[4],coach:a[5]}; byId[a[0]]=posById[a[0]]; });
  /* 2.125 — 이름 → 항목. 팀이 만든 평가표(id 가 팀 것)에 문장을 빌려 줄 때만 쓴다 */
  var byName={};
  Object.keys(byId).forEach(function(k){ var it=byId[k]; var nm=String(it.name||"").replace(/\s+/g," ").trim(); if(nm&&!byName[nm])byName[nm]=it; });   /* 2.025 — 포지션 문항도 sentence()/label() 로 읽힌다 */
  var catName={}; CATS.forEach(function(c){ catName[c[0]]=c[1]; });
  var STD={
    id:"process-std-v2", name:"PROCESS 표준 v1", version:1,
    cats:CATS.map(function(c){return {id:c[0],name:c[1]};}),
    items:ITEMS.map(function(a){return byId[a[0]];}),
    scale:SCALE.map(function(s){return {v:s[0],label:s[1]};}),
    legacy:LEGACY,
    byId:byId,
    /* IDP 세트 형식: [{cat:'전술', items:[[id,라벨],...]}] — 라벨을 넣는다(문장은 sentence()로 따로) */
    groups:function(){ return CATS.map(function(c){ return {cat:c[1], items:ITEMS.filter(function(a){return a[1]===c[0];}).map(function(a){return [a[0],a[2]];})}; }); },
    isStdId:function(id){ return !!byId[id]&&!posById[id]; },
    /* 2.025 — 포지션 문항 */
    posGroups:POS_GROUPS,
    posItems:function(grp){ return POS_ITEMS.filter(function(a){return a[1]===grp;}).map(function(a){return posById[a[0]];}); },
    posGroupOf:function(code){ var c=String(code||"").trim(); if(!c)return ""; var u=c.toUpperCase().replace(/[^A-Z]/g,""); if(POS_MAP[u])return POS_MAP[u]; for(var i=0;i<POS_KO.length;i++){ if(c.indexOf(POS_KO[i][0])>=0)return POS_KO[i][1]; } var m=u.match(/GK|CB|LB|RB|WB|DM|CM|AM|LM|RM|LW|RW|ST|CF|FW/); return m&&POS_MAP[m[0]]?POS_MAP[m[0]]:""; },
    posGroupName:function(grp){ var g=POS_GROUPS.filter(function(x){return x[0]===grp;})[0]; return g?g[1]:""; },
    isPosId:function(id){ return !!posById[id]; },
    /* 문장 — tone 'player'(1인칭 행동) | 'coach'(관찰). 표준 항목이 아니면 '' */
    sentence:function(id,tone){ var it=byId[id]; if(!it)return ""; return tone==="coach"?it.coach:it.player; },
    label:function(id){ var it=byId[id]; return it?it.name:""; },
    /* ══ 2.125 · 이름으로 표준 항목 찾기 ═══════════════════════════════════════════
       팀이 자기 평가표를 만들면 항목 id 가 `tamt2f63l0lmn4` 처럼 팀이 지은 것이다(evalMode "team").
       그러면 `question()`·`sentence()`·`watch()` 가 전부 빈 값이 되어 평가 화면에 **이름만 두 번** 찍혔다.
       이름이 표준과 같으면(대개 표준을 복사해 쓴다) 그 문장을 빌려 온다.
       ⚠ **표시에만 쓴다** — 점수·저장·요구는 팀 항목 id 그대로다. 이름이 다르면 아무것도 안 붙는다(억지로 맞추지 않는다). */
    stdIdByName:function(name){
      var k=String(name||"").replace(/\s+/g," ").trim(); if(!k)return "";
      var hit=byName[k]; return hit?hit.id:"";
    },
    resolveId:function(id,name){ return byId[id]?id:STD.stdIdByName(name); },
    /* 2.111 — 항목마다 척도가 다를 수 있다. id 를 안 주면 예전처럼 전이 척도(부르는 옛 코드가 안 깨진다) */
    scaleB:SCALE_B.map(function(s2){return {v:s2[0],label:s2[1]};}),
    scaleOf:function(id){ var it=byId[id]; return (it&&it.cat&&SCALE_B_CATS[it.cat])?"B":"A"; },
    scaleSet:function(id){ return STD.scaleOf(id)==="B"?SCALE_B:SCALE; },
    scaleLabel:function(v,id){ var t=STD.scaleSet(id); for(var i=0;i<t.length;i++)if(t[i][0]===+v)return t[i][1]; return ""; },
    /* 2.111 — 문장이 두 갈래로 갈렸다: question 은 **선수·코치가 같이 읽는 질문**,
       watch 는 옛 코치 톤(관찰 포인트 — 무엇을 보고 판단하나). 답 아래 회색 줄이 그 자리다.
       ⚠ sentence(id,tone) 은 남겨 둔다 — 인쇄 문서·셀프평가가 아직 그 이름으로 부른다. */
    catAsk:function(cid){ return CAT_ASK[cid]||""; },   /* 2.112 */
    question:function(id){ var it=byId[id]; return it?it.player:""; },
    watch:function(id){ var it=byId[id]; return it?it.coach:""; },
    /* 옛 점수 → 새 점수 초기값 제안: 같은 새 항목으로 모이는 옛 점수의 평균(반올림). 새 항목에 이미 값이 있으면 건드리지 않는다. */
    migrateLevels:function(levels){
      var out={}, acc={};
      if(!levels)return out;
      Object.keys(levels).forEach(function(k){
        var v=+levels[k]; if(!v)return;
        if(byId[k]){ out[k]=v; return; }
        var nid=LEGACY[k]; if(!nid)return;
        (acc[nid]=acc[nid]||[]).push(v);
      });
      Object.keys(acc).forEach(function(nid){ if(out[nid])return; var a=acc[nid]; out[nid]=Math.max(1,Math.min(5,Math.round(a.reduce(function(s,x){return s+x;},0)/a.length))); });
      return out;
    },
    /* 옛 id 목록(팀 attrs)이 옛 표준인지 — b_* 가 하나라도 있고 ps_* 는 없으면 옛 것 */
    isLegacyAttrs:function(attrs){ var old=false,neu=false; (attrs||[]).forEach(function(a){ var id=a&&a.id||a; if(byId[id])neu=true; else if(LEGACY[id])old=true; }); return old&&!neu; }
  };
  window.PS_EVAL_STD=STD;
})();
