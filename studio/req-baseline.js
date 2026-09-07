/* PROCESS STUDIO — 자리 요구 기본값 v1 (2.080)
   "우리 팀 게임모델이 이 자리에 무엇을 얼마나 요구하는가" 의 **시작점**.

   왜 스타일 하나를 고르게 하지 않았나
     실제 유소년 팀은 대부분 혼합형이다 — "압박은 세게 하는데 공격은 길게 보낸다".
     스타일 4택 1 은 그런 팀을 표현하지 못하고, 무엇보다 **왜 이 숫자인지 설명이 안 된다.**
     그래서 게임모델의 4국면마다 한 가지씩 묻고, 항목마다 **그 항목을 지배하는 국면의 답**에서 값을 가져온다.
     어느 답이 그 숫자를 만들었는지 화면에 그대로 적을 수 있다 — 코치가 납득 못 하는 숫자는 안 쓰인다.

   출처
     · 공통 24항목 4스타일 값 = `processstudio-문서/idp-content/archetypes-and-baseline.json`
       (병렬 에이전트 + 적대적 검증 2라운드를 통과한 값. 그대로 옮겼다)
     · 포지션 문항 8×6군 4스타일 값 = 2.080 에서 새로 채웠다(json 에는 공통 24만 있었다).
       아키타입의 핵심 4항목이 포지션 문항을 많이 가리키므로, 이게 없으면 유형 보정이 걸릴 자리가 비어 있다.

   규칙
     ① 이 값은 **제안이다.** 코치가 확인 버튼을 눌러야 저장된다(자동으로 깔지 않는다).
     ② 기본은 "비어 있는 항목만" — 코치가 이미 매긴 숫자를 덮지 않는다.
     ③ 저장되는 곳은 그대로 `scout_tool_v1.positions[].req` — 새 저장소를 만들지 않는다.
     ④ 답은 게임모델(`cs_gamemodel_v1.style`)에 산다. 요구는 게임모델에서 나온다는 뜻이다.
     ⑤ 4국면을 다 답해야 제안한다 — 반만 답한 게임모델로 요구를 깔면 틀린 기준이 조용히 생긴다. */
(function(){
  /* 4국면 × 양자택일 — 게임모델의 moments(ao·do·dt·at) 와 같은 키를 쓴다 */
  var MOMENTS=[
    {key:'ao',name:'공격 조직',tag:'IN POSSESSION',q:'공을 가졌을 때 우리는',
     opts:[{v:'short',label:'짧게 쌓아 올린다',one:'뒤에서부터 연결해 상대를 끌어내고 라인을 깬다',style:'positional'},
           {v:'direct',label:'길게 보내고 세컨드볼',one:'앞으로 먼저 보내고 떨어지는 공을 먼저 잡는다',style:'direct'}]},
    {key:'do',name:'수비 조직',tag:'OUT OF POSSESSION',q:'공이 상대에게 있을 때 우리는',
     opts:[{v:'high',label:'높게 압박한다',one:'상대 진영에서 가두고 수비 라인을 높게 둔다',style:'vertical'},
           {v:'compact',label:'내려서 컴팩트하게',one:'블록을 좁게 유지하고 우리 진영을 지킨다',style:'compact'}]},
    {key:'dt',name:'공 → 수 전환',tag:'TRANSITION −',q:'공을 잃은 순간 우리는',
     opts:[{v:'press',label:'즉시 역압박',one:'5초 안에 가장 가까운 선수가 다시 뺏으러 간다',style:'vertical'},
           {v:'drop',label:'후퇴 · 재정비',one:'공보다 뒤로 먼저 돌아가 대형을 다시 세운다',style:'compact'}]},
    {key:'at',name:'수 → 공 전환',tag:'TRANSITION +',q:'공을 되찾은 순간 우리는',
     opts:[{v:'fast',label:'빠른 역습',one:'무너진 상대 대형으로 즉시 달려 나간다',style:'compact'},
           {v:'settle',label:'점유 안정화',one:'일단 안전하게 잡고 다시 판을 만든다',style:'positional'}]}
  ];
  var STYLE_NAME={positional:'짧게 쌓기',vertical:'높은 라인 · 압박',compact:'컴팩트 · 역습',direct:'다이렉트'};
  /* ⚠ 항목마다 **어느 국면이 그 값을 지배하는가**. 이게 없으면 관계없는 답이 근거로 붙는다 —
     '빠른 역습' 을 골랐다는 이유로 센터백 공중볼 요구가 5 가 되는 식(스타일 이름만 같고 국면이 다르다).
     여기 적힌 국면의 답만 그 항목의 요구를 정한다. 두 국면이 걸리면 **더 높은 쪽**을 쓴다.
     비어 있는 항목(심리·태도)은 국면과 무관하다 — 4스타일 값이 거의 같아 어느 답을 봐도 결과가 같다. */
  var OWN={
    ps_t_scan:['ao'], ps_t_poss:['ao'], ps_t_space:['ao'], ps_t_outp:['do'], ps_t_trans:['dt','at'],
    ps_k_touch:['ao'], ps_k_pass:['ao'], ps_k_1v1a:['ao'], ps_k_finish:['ao'], ps_k_carry:['ao'], ps_k_1v1d:['do'],
    ps_p_speed:['do','at'], ps_p_endur:['do','dt'], ps_p_agile:['ao','do'], ps_p_duel:['ao','do'],
    /* GK */ ps_g_shot:['do'], ps_g_cross:['do'], ps_g_dist:['ao','at'], ps_g_sweep:['do'],
    ps_g_1v1:['do'], ps_g_build:['ao'], ps_g_organise:['do'], ps_g_set:['do'],
    /* CB */ ps_c_air:['do','ao'], ps_c_line:['do'], ps_c_build:['ao'], ps_c_duel:['do'],
    ps_c_carry:['ao'], ps_c_step:['do'], ps_c_box:['do'], ps_c_setatt:['ao'],
    /* FB */ ps_f_1v1:['do'], ps_f_over:['ao'], ps_f_cross:['ao'], ps_f_recover:['dt'],
    ps_f_build:['ao'], ps_f_inside:['ao'], ps_f_cover:['do'], ps_f_duel:['do','ao'],
    /* MF */ ps_m_receive:['ao'], ps_m_tempo:['ao'], ps_m_screen:['do'], ps_m_b2b:['ao','do'],
    ps_m_break:['ao'], ps_m_third:['ao'], ps_m_press:['do'], ps_m_cpress:['dt'],
    /* W  */ ps_w_1v1:['ao'], ps_w_width:['ao'], ps_w_final:['ao'], ps_w_press:['do'],
    ps_w_behind:['ao','at'], ps_w_cross:['ao'], ps_w_combi:['ao'], ps_w_shot:['ao'],
    /* ST */ ps_s_finish:['ao'], ps_s_run:['ao','at'], ps_s_hold:['ao'], ps_s_press:['do'],
    ps_s_box:['ao'], ps_s_air:['ao'], ps_s_press2:['dt'], ps_s_create:['ao']
  };
  var BASE={
    GK:{positional:{"ps_t_scan":4,"ps_t_poss":4,"ps_t_outp":3,"ps_t_trans":3,"ps_t_space":4,"ps_k_touch":5,"ps_k_pass":5,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":4,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":2,"ps_p_agile":4,"ps_p_duel":3,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":5,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_g_shot":4,"ps_g_cross":3,"ps_g_dist":5,"ps_g_sweep":4,"ps_g_1v1":3,"ps_g_build":5,"ps_g_organise":4,"ps_g_set":3},vertical:{"ps_t_scan":4,"ps_t_poss":3,"ps_t_outp":4,"ps_t_trans":4,"ps_t_space":5,"ps_k_touch":3,"ps_k_pass":4,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":5,"ps_k_carry":2,"ps_p_speed":4,"ps_p_endur":3,"ps_p_agile":4,"ps_p_duel":3,"ps_m_brave":5,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_g_shot":4,"ps_g_cross":3,"ps_g_dist":4,"ps_g_sweep":5,"ps_g_1v1":5,"ps_g_build":4,"ps_g_organise":5,"ps_g_set":4},compact:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":3,"ps_t_trans":4,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":4,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":5,"ps_k_carry":2,"ps_p_speed":2,"ps_p_endur":2,"ps_p_agile":5,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":5,"ps_m_calm":4,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_g_shot":5,"ps_g_cross":5,"ps_g_dist":4,"ps_g_sweep":3,"ps_g_1v1":5,"ps_g_build":3,"ps_g_organise":5,"ps_g_set":5},direct:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":3,"ps_t_trans":4,"ps_t_space":3,"ps_k_touch":2,"ps_k_pass":5,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":4,"ps_k_carry":2,"ps_p_speed":3,"ps_p_endur":2,"ps_p_agile":4,"ps_p_duel":5,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_g_shot":4,"ps_g_cross":4,"ps_g_dist":5,"ps_g_sweep":3,"ps_g_1v1":4,"ps_g_build":2,"ps_g_organise":4,"ps_g_set":4}},
    CB:{positional:{"ps_t_scan":5,"ps_t_poss":4,"ps_t_outp":3,"ps_t_trans":3,"ps_t_space":4,"ps_k_touch":4,"ps_k_pass":5,"ps_k_1v1a":2,"ps_k_finish":1,"ps_k_1v1d":4,"ps_k_carry":4,"ps_p_speed":3,"ps_p_endur":3,"ps_p_agile":3,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":5,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_c_air":3,"ps_c_line":4,"ps_c_build":5,"ps_c_duel":4,"ps_c_carry":4,"ps_c_step":3,"ps_c_box":3,"ps_c_setatt":3},vertical:{"ps_t_scan":4,"ps_t_poss":3,"ps_t_outp":5,"ps_t_trans":4,"ps_t_space":5,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":4,"ps_k_carry":3,"ps_p_speed":5,"ps_p_endur":4,"ps_p_agile":4,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":4,"ps_c_air":4,"ps_c_line":5,"ps_c_build":3,"ps_c_duel":4,"ps_c_carry":3,"ps_c_step":5,"ps_c_box":4,"ps_c_setatt":3},compact:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":4,"ps_t_trans":3,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":5,"ps_k_carry":2,"ps_p_speed":3,"ps_p_endur":3,"ps_p_agile":3,"ps_p_duel":5,"ps_m_brave":4,"ps_m_focus":5,"ps_m_calm":4,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_c_air":5,"ps_c_line":5,"ps_c_build":3,"ps_c_duel":5,"ps_c_carry":2,"ps_c_step":4,"ps_c_box":5,"ps_c_setatt":3},direct:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":4,"ps_t_trans":5,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":4,"ps_k_1v1a":1,"ps_k_finish":1,"ps_k_1v1d":4,"ps_k_carry":2,"ps_p_speed":3,"ps_p_endur":3,"ps_p_agile":3,"ps_p_duel":5,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_c_air":5,"ps_c_line":3,"ps_c_build":3,"ps_c_duel":4,"ps_c_carry":2,"ps_c_step":4,"ps_c_box":4,"ps_c_setatt":4}},
    FB:{positional:{"ps_t_scan":4,"ps_t_poss":5,"ps_t_outp":3,"ps_t_trans":3,"ps_t_space":4,"ps_k_touch":5,"ps_k_pass":4,"ps_k_1v1a":3,"ps_k_finish":1,"ps_k_1v1d":3,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":4,"ps_p_agile":3,"ps_p_duel":3,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":4,"ps_m_lead":3,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_f_1v1":3,"ps_f_over":4,"ps_f_cross":4,"ps_f_recover":3,"ps_f_build":5,"ps_f_inside":5,"ps_f_cover":4,"ps_f_duel":3},vertical:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":4,"ps_t_trans":5,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":3,"ps_k_finish":2,"ps_k_1v1d":4,"ps_k_carry":4,"ps_p_speed":4,"ps_p_endur":5,"ps_p_agile":4,"ps_p_duel":3,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":3,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":4,"ps_s_learn":3,"ps_s_recover":4,"ps_f_1v1":4,"ps_f_over":5,"ps_f_cross":4,"ps_f_recover":5,"ps_f_build":3,"ps_f_inside":3,"ps_f_cover":4,"ps_f_duel":3},compact:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":4,"ps_t_trans":4,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":2,"ps_k_finish":1,"ps_k_1v1d":5,"ps_k_carry":3,"ps_p_speed":4,"ps_p_endur":4,"ps_p_agile":4,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":5,"ps_m_calm":3,"ps_m_lead":3,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_f_1v1":5,"ps_f_over":3,"ps_f_cross":3,"ps_f_recover":4,"ps_f_build":3,"ps_f_inside":3,"ps_f_cover":5,"ps_f_duel":4},direct:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":4,"ps_t_trans":4,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":4,"ps_k_1v1a":3,"ps_k_finish":1,"ps_k_1v1d":4,"ps_k_carry":4,"ps_p_speed":4,"ps_p_endur":5,"ps_p_agile":3,"ps_p_duel":5,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":3,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":4,"ps_f_1v1":4,"ps_f_over":4,"ps_f_cross":5,"ps_f_recover":4,"ps_f_build":3,"ps_f_inside":2,"ps_f_cover":4,"ps_f_duel":5}},
    MF:{positional:{"ps_t_scan":5,"ps_t_poss":4,"ps_t_outp":3,"ps_t_trans":3,"ps_t_space":4,"ps_k_touch":5,"ps_k_pass":5,"ps_k_1v1a":2,"ps_k_finish":2,"ps_k_1v1d":3,"ps_k_carry":4,"ps_p_speed":2,"ps_p_endur":4,"ps_p_agile":4,"ps_p_duel":3,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":4,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_m_receive":5,"ps_m_tempo":5,"ps_m_screen":3,"ps_m_b2b":3,"ps_m_break":5,"ps_m_third":5,"ps_m_press":4,"ps_m_cpress":4},vertical:{"ps_t_scan":4,"ps_t_poss":3,"ps_t_outp":5,"ps_t_trans":5,"ps_t_space":4,"ps_k_touch":4,"ps_k_pass":3,"ps_k_1v1a":2,"ps_k_finish":2,"ps_k_1v1d":4,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":5,"ps_p_agile":4,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":4,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":4,"ps_m_receive":4,"ps_m_tempo":3,"ps_m_screen":4,"ps_m_b2b":5,"ps_m_break":4,"ps_m_third":4,"ps_m_press":5,"ps_m_cpress":5},compact:{"ps_t_scan":4,"ps_t_poss":2,"ps_t_outp":4,"ps_t_trans":4,"ps_t_space":5,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":2,"ps_k_finish":2,"ps_k_1v1d":4,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":4,"ps_p_agile":3,"ps_p_duel":4,"ps_m_brave":3,"ps_m_focus":5,"ps_m_calm":4,"ps_m_lead":4,"ps_s_team":5,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_m_receive":3,"ps_m_tempo":3,"ps_m_screen":5,"ps_m_b2b":4,"ps_m_break":3,"ps_m_third":3,"ps_m_press":5,"ps_m_cpress":3},direct:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":4,"ps_t_trans":5,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":2,"ps_k_finish":2,"ps_k_1v1d":4,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":5,"ps_p_agile":4,"ps_p_duel":5,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":3,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_m_receive":3,"ps_m_tempo":2,"ps_m_screen":4,"ps_m_b2b":4,"ps_m_break":3,"ps_m_third":2,"ps_m_press":4,"ps_m_cpress":3}},
    W:{positional:{"ps_t_scan":4,"ps_t_poss":4,"ps_t_outp":3,"ps_t_trans":3,"ps_t_space":4,"ps_k_touch":4,"ps_k_pass":4,"ps_k_1v1a":5,"ps_k_finish":4,"ps_k_1v1d":2,"ps_k_carry":4,"ps_p_speed":4,"ps_p_endur":3,"ps_p_agile":4,"ps_p_duel":2,"ps_m_brave":5,"ps_m_focus":3,"ps_m_calm":4,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_w_1v1":5,"ps_w_width":5,"ps_w_final":4,"ps_w_press":3,"ps_w_behind":3,"ps_w_cross":4,"ps_w_combi":5,"ps_w_shot":4},vertical:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":5,"ps_t_trans":5,"ps_t_space":4,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":4,"ps_k_finish":4,"ps_k_1v1d":3,"ps_k_carry":4,"ps_p_speed":5,"ps_p_endur":4,"ps_p_agile":4,"ps_p_duel":2,"ps_m_brave":4,"ps_m_focus":3,"ps_m_calm":3,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":4,"ps_w_1v1":4,"ps_w_width":4,"ps_w_final":4,"ps_w_press":5,"ps_w_behind":5,"ps_w_cross":3,"ps_w_combi":3,"ps_w_shot":4},compact:{"ps_t_scan":3,"ps_t_poss":2,"ps_t_outp":4,"ps_t_trans":5,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":4,"ps_k_finish":3,"ps_k_1v1d":3,"ps_k_carry":5,"ps_p_speed":5,"ps_p_endur":4,"ps_p_agile":4,"ps_p_duel":2,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_w_1v1":4,"ps_w_width":3,"ps_w_final":4,"ps_w_press":5,"ps_w_behind":5,"ps_w_cross":3,"ps_w_combi":2,"ps_w_shot":4},direct:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":4,"ps_t_trans":4,"ps_t_space":3,"ps_k_touch":3,"ps_k_pass":5,"ps_k_1v1a":4,"ps_k_finish":3,"ps_k_1v1d":3,"ps_k_carry":4,"ps_p_speed":5,"ps_p_endur":4,"ps_p_agile":3,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":3,"ps_m_calm":3,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_w_1v1":4,"ps_w_width":4,"ps_w_final":4,"ps_w_press":4,"ps_w_behind":5,"ps_w_cross":5,"ps_w_combi":2,"ps_w_shot":3}},
    ST:{positional:{"ps_t_scan":4,"ps_t_poss":4,"ps_t_outp":3,"ps_t_trans":3,"ps_t_space":4,"ps_k_touch":5,"ps_k_pass":4,"ps_k_1v1a":3,"ps_k_finish":5,"ps_k_1v1d":2,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":3,"ps_p_agile":4,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":4,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_s_finish":5,"ps_s_run":3,"ps_s_hold":5,"ps_s_press":3,"ps_s_box":5,"ps_s_air":3,"ps_s_press2":4,"ps_s_create":4},vertical:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":5,"ps_t_trans":4,"ps_t_space":5,"ps_k_touch":3,"ps_k_pass":3,"ps_k_1v1a":3,"ps_k_finish":4,"ps_k_1v1d":2,"ps_k_carry":3,"ps_p_speed":4,"ps_p_endur":5,"ps_p_agile":4,"ps_p_duel":3,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":3,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":4,"ps_s_finish":4,"ps_s_run":5,"ps_s_hold":3,"ps_s_press":5,"ps_s_box":4,"ps_s_air":3,"ps_s_press2":5,"ps_s_create":3},compact:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":3,"ps_t_trans":5,"ps_t_space":4,"ps_k_touch":4,"ps_k_pass":3,"ps_k_1v1a":4,"ps_k_finish":5,"ps_k_1v1d":2,"ps_k_carry":4,"ps_p_speed":5,"ps_p_endur":4,"ps_p_agile":3,"ps_p_duel":4,"ps_m_brave":4,"ps_m_focus":4,"ps_m_calm":4,"ps_m_lead":2,"ps_s_team":3,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":3,"ps_s_finish":5,"ps_s_run":5,"ps_s_hold":3,"ps_s_press":4,"ps_s_box":4,"ps_s_air":3,"ps_s_press2":4,"ps_s_create":3},direct:{"ps_t_scan":3,"ps_t_poss":3,"ps_t_outp":3,"ps_t_trans":4,"ps_t_space":3,"ps_k_touch":4,"ps_k_pass":3,"ps_k_1v1a":2,"ps_k_finish":4,"ps_k_1v1d":2,"ps_k_carry":3,"ps_p_speed":3,"ps_p_endur":4,"ps_p_agile":3,"ps_p_duel":5,"ps_m_brave":5,"ps_m_focus":3,"ps_m_calm":3,"ps_m_lead":2,"ps_s_team":4,"ps_s_effort":4,"ps_s_self":3,"ps_s_learn":3,"ps_s_recover":4,"ps_s_finish":4,"ps_s_run":5,"ps_s_hold":5,"ps_s_press":3,"ps_s_box":4,"ps_s_air":5,"ps_s_press2":3,"ps_s_create":3}}
  };
  var NOTES={"GK|positional":"우리 팀 첫 패스가 골키퍼 발에서 시작하므로, 압박이 와도 터치와 배급이 흔들리지 않아야 한다.","GK|vertical":"수비 라인을 높이 올리는 팀이라 골키퍼가 뒷공간을 미리 읽고 먼저 나와 끊어줘야 한다.","GK|compact":"공이 우리 진영에 오래 머무니 박스 안 선방과 크로스 처리, 오래 기다리다 한 번에 반응하는 집중이 핵심이다.","GK|direct":"골키퍼의 긴 킥이 공격의 출발점이라 킥 정확도와 공중볼 처리가 먼저다.","CB|positional":"상대 공격수가 달려들어도 고개를 들고 전진 패스를 넣어야 우리 공격이 열린다.","CB|vertical":"라인을 높이 두고 앞으로 나가 끊는 자리라 배후 공간 판단과 되돌아가는 속도가 생명이다.","CB|compact":"박스 앞을 오래 지키는 자리라 1대1 저지와 몸싸움, 90분 내내 흔들리지 않는 집중이 먼저다.","CB|direct":"길게 보낸 뒤 떨어지는 두 번째 공을 먼저 잡아야 하니 경합과 즉시 반응이 핵심이다.","FB|positional":"폭을 잡거나 안으로 들어와 줄을 만드는 자리라 좁은 곳에서 받는 첫 터치와 위치잡기가 먼저다.","FB|vertical":"빼앗자마자 측면을 끝까지 올라갔다 다시 내려오는 자리라 전환 반응과 반복 달리기가 조건이다.","FB|compact":"측면을 내주고 지키는 팀이라 윙어와의 1대1을 버티고 자리를 이탈하지 않는 집중이 먼저다.","FB|direct":"측면에서 떨어지는 공을 몸으로 이겨내고 계속 올라가야 해서 경합과 지구력이 조건이다.","MF|positional":"등 뒤 상대를 미리 보고 압박 속에서 몸을 돌려 앞으로 연결해야 하는 자리다.","MF|vertical":"압박의 방아쇠를 당기고 뺏은 즉시 앞으로 나가야 해서 압박·커버와 전환, 반복 능력이 먼저다.","MF|compact":"블록 안 간격을 지키며 패스 길을 막는 자리라 공간 인식과 집중, 옆 동료와의 소통이 핵심이다.","MF|direct":"길게 보낸 공이 떨어지는 지점을 예측해 먼저 잡는 회수 담당이라 전환 반응·경합·지구력이 조건이다.","W|positional":"폭을 잡고 수비수와 1대1로 맞서 먼저 시도해야 상대 블록이 벌어진다.","W|vertical":"앞에서 상대 수비를 몰아 가두고, 뺏자마자 배후로 달려 나가는 자리다.","W|compact":"내려와 지키다가 한 번에 공을 몰고 혼자 멀리 달려야 하니 전환·운반·속도가 먼저다.","W|direct":"배후로 먼저 달려 공을 살리고 질 좋은 크로스로 마무리를 만들어야 한다.","ST|positional":"등지고 받아 지키다 연결하고, 어렵게 온 한 번의 기회를 넣어야 하는 자리다.","ST|vertical":"압박의 첫 스위치를 켜고 상대 빌드업 각을 지우며, 뒤로도 반복해 달려야 한다.","ST|compact":"기회가 몇 번뿐이라 전환 순간 먼저 달려 나가고 그 한 번을 넣어야 한다.","ST|direct":"긴 공을 몸으로 받아내고 수비수와 부딪히면서 버텨줘야 팀이 앞에서 산다."};
  function optOf(mk,v){ var m=null; MOMENTS.forEach(function(x){ if(x.key===mk)m=x; }); if(!m)return null;
    var o=null; m.opts.forEach(function(x){ if(x.v===v)o=x; }); return o?{mo:m,opt:o}:null; }
  var API={
    version:1,
    moments:MOMENTS,
    styleName:function(st){ return STYLE_NAME[st]||st; },
    note:function(grp,st){ return NOTES[grp+'|'+st]||''; },
    ownerOf:function(id){ return (OWN[id]||[]).slice(); },
    /* ══ 2.109 · 매뉴얼 5.5 의 축(볼 소유 시 / 비소유 시)으로 항목을 가른다 ══
       ⚠ 우리 4국면과 **축이 다르다.** 매뉴얼에서 전환은 별도 국면이 아니라 각 축의 첫 항목이다:
          at(되찾은 순간) → O.1 볼 탈환 직후 = **소유** · dt(잃은 순간) → D.1 볼 상실 직후 = **비소유**.
          그래서 ps_p_endur(['do','dt']) 는 둘 다 비소유라 **한 칸**이고, ps_t_trans(['dt','at']) 만 두 칸이다.
       '' = 국면 무관(심리·태도) — 쪼개지 않는다. 자리마다 두 칸이 실제로 갈리는 항목은 4~5개뿐이다. */
    axisOf:function(id){
      var own=OWN[id]||[]; if(!own.length)return '';
      var o=(own.indexOf('ao')>=0||own.indexOf('at')>=0), d=(own.indexOf('do')>=0||own.indexOf('dt')>=0);
      return (o&&d)?'both':(o?'o':(d?'d':''));
    },
    /* 한쪽 축의 제안값 + 근거 — suggest() 와 **같은 표**를 쓰되 그 축에 걸린 국면만 본다.
       suggest() 는 검증을 거친 값이라 건드리지 않는다(여기서 다시 계산할 뿐 표는 하나다) */
    suggestSide:function(grp,ans,id,side){
      var tbl=BASE[grp]; if(!tbl||!API.complete(ans))return null;
      var pk=API.picked(ans), byKey={}; pk.forEach(function(x){ byKey[x.key]=x; });
      var keys=(side==='o')?['ao','at']:['do','dt'], own=OWN[id]||[], best=0, src=null;
      own.forEach(function(mk){ if(keys.indexOf(mk)<0)return; var x=byKey[mk]; if(!x)return;
        var v=+((tbl[x.style]||{})[id]||0); if(v>best){ best=v; src=x; } });
      return best?{v:best,by:src}:null;
    },
    /* 4국면을 다 답했는가 */
    complete:function(ans){ return MOMENTS.every(function(m){ return !!optOf(m.key,(ans||{})[m.key]); }); },
    /* 고른 답 요약 — [{mo,label,style}] */
    picked:function(ans){
      var out=[]; MOMENTS.forEach(function(m){ var h=optOf(m.key,(ans||{})[m.key]);
        if(h)out.push({key:m.key,mo:m.name,label:h.opt.label,one:h.opt.one,style:h.opt.style}); });
      return out;
    },
    /* 제안 = 항목을 지배하는 국면의 답이 가리키는 값. 두 국면이면 더 높은 쪽 + 그 답을 근거로 적는다 */
    suggest:function(grp,ans){
      var tbl=BASE[grp]; if(!tbl||!API.complete(ans))return null;
      var pk=API.picked(ans), byKey={}; pk.forEach(function(p){ byKey[p.key]=p; });
      var all=[]; pk.forEach(function(p){ if(all.indexOf(p.style)<0)all.push(p.style); });
      var ids={}; all.forEach(function(st){ Object.keys(tbl[st]||{}).forEach(function(id){ ids[id]=1; }); });
      var req={}, why={};
      Object.keys(ids).forEach(function(id){
        var own=OWN[id], best=0, src=null;
        if(own&&own.length){
          own.forEach(function(mk){ var p=byKey[mk]; if(!p)return;
            var v=+((tbl[p.style]||{})[id]||0); if(v>best){ best=v; src=p; } });
        }else{
          /* 국면 무관(심리·태도) — 답에 따라 흔들리면 안 된다. 4스타일 값 중 **가장 흔한 값**을 쓴다(자리 기본) */
          var cnt={}, top=0;
          ['positional','vertical','compact','direct'].forEach(function(st){ var v=+((tbl[st]||{})[id]||0); if(!v)return; cnt[v]=(cnt[v]||0)+1; });
          Object.keys(cnt).forEach(function(v){ if(cnt[v]>top||(cnt[v]===top&&+v<best)){ top=cnt[v]; best=+v; } });
        }
        if(best>=1&&best<=5){ req[id]=best; why[id]={v:best,by:src}; }
      });
      return {req:req,why:why,picked:pk};
    }
  };
  window.PS_REQ=API;
})();
