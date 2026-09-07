/* PROCESS STUDIO — 포지션 유형(아키타입) 사전 v1 (2.078)
   "같은 센터백이라도 빌드업을 하는 센터백과 막는 센터백은 다른 선수다."
   포지션(어디에 서는가) 아래 한 층 — 유형(그 자리에서 무엇으로 사는가)을 6군 × 6유형 = 36개로 둔다.

   뼈대(국제적으로 통용되는 역할 이름을 모아 6군 체계에 맞췄다 — 공식 표준은 아니다):
     · Football Manager 역할 체계(Ball-Playing Defender · Mezzala · Sweeper Keeper · Wide Centre-Back …) — 코치·선수가 실제로 쓰는 말
     · Wyscout / Hudl · StatsBomb · Opta 의 데이터 기반 역할 분류(Progressive CB · Pressing Forward · Runner in behind …)
     · UEFA / FIFA Talent Development 의 포지션 프로파일 서술
   항목 id 는 eval-standard.js 의 표준 24 + 포지션 8×6 을 그대로 쓴다. **새 항목을 만들지 않는다.**

   규칙
     ① 유형은 **선수**에게 붙는다(`players[].arch`). 포지션에 붙이면 같은 자리 선수 전원이 한 유형이 돼
        "빌드업 CB 냐 수비형 CB 냐" 라는 질문 자체가 사라진다.
     ② 유형을 고르면 그 유형의 **핵심 4항목**의 자리 요구가 한 단계(+1, 5 상한) 올라간다.
        단 **이미 자리 요구가 정해진 항목만** 올린다 — 유형이 없던 요구를 만들어 내지 않는다.
     ③ 유형은 등급이 아니다. 유형끼리 우열이 없고, 총점·순위를 만들지 않는다(2.077 자리 적합과 같은 원칙).
     ④ 유소년은 유형이 바뀐다. 언제든 다시 고를 수 있고, 안 고르는 것도 정상이다. */
(function(){
  /* [key, grp, 이름, English, 한 줄(무엇으로 사는 선수인가), 핵심 4항목] */
  var A=[
    /* ══ GK — 골키퍼 ══════════════════════════════════════════ */
    ["gk_shotstopper","GK","슛 스토퍼","Shot-stopper",
      "골문 앞 반응으로 어려운 슛과 튕긴 두 번째 슛까지 막아 실점을 지운다.",
      ["ps_g_shot","ps_g_1v1","ps_p_agile","ps_m_focus"]],
    ["gk_sweeper","GK","스위퍼 키퍼","Sweeper-keeper",
      "높은 수비 라인 뒤로 넘어오는 공에 먼저 나가 발로 정리하고, 팀이 높게 설 수 있게 한다.",
      ["ps_g_sweep","ps_p_speed","ps_t_space","ps_t_trans"]],
    ["gk_builder","GK","빌드업 키퍼","Ball-playing goalkeeper",
      "센터백 사이에서 +1 로 받아 압박을 벗기고, 팀의 첫 패스를 발로 시작한다.",
      ["ps_g_build","ps_k_touch","ps_g_dist","ps_m_calm"]],
    ["gk_launcher","GK","롱 디스트리뷰터","Long distributor",
      "잡자마자 긴 킥과 빠른 던지기로 상대 뒤를 노려, 골키퍼가 공격의 출발점이 된다.",
      ["ps_g_dist","ps_k_pass","ps_t_trans","ps_t_scan"]],
    ["gk_commander","GK","박스 커맨더","Commanding keeper",
      "크로스와 세트피스에서 박스를 잡아내고, 가장 높은 곳에서 먼저 공에 닿는다.",
      ["ps_g_cross","ps_g_set","ps_p_duel","ps_m_brave"]],
    ["gk_organiser","GK","수비 조직형 키퍼","Organising keeper",
      "경기 내내 라인 높이와 마크를 소리로 세워, 슛이 오기 전에 상황을 지운다.",
      ["ps_g_organise","ps_m_lead","ps_s_team","ps_m_focus"]],

    /* ══ CB — 센터백 ══════════════════════════════════════════ */
    ["cb_stopper","CB","전진 스토퍼","Front-foot stopper",
      "상대 공격수 앞으로 먼저 나가 끊고, 몸싸움에서 이겨 위험을 우리 골문에서 밀어낸다.",
      ["ps_c_step","ps_c_duel","ps_k_1v1d","ps_m_brave"]],
    ["cb_ballplaying","CB","빌드업 센터백","Ball-playing centre-back",
      "압박 속에서도 첫 패스를 안전하게 시작하고, 열리면 상대 라인을 깨는 패스를 넣는다.",
      ["ps_c_build","ps_k_pass","ps_t_scan","ps_k_touch"]],
    ["cb_cover","CB","커버 센터백","Covering centre-back",
      "동료가 나가면 뒤를 덮고 라인 높이를 관리해, 뒷공간으로 넘어오는 공을 먼저 처리한다.",
      ["ps_c_line","ps_p_speed","ps_t_space","ps_m_focus"]],
    ["cb_aerial","CB","제공권 센터백","Aerial dominator",
      "롱볼·크로스·세트피스에서 공중볼을 먼저 따내 박스를 비워 낸다.",
      ["ps_c_air","ps_p_duel","ps_c_box","ps_c_setatt"]],
    ["cb_carrier","CB","운반형 센터백","Ball-carrying centre-back",
      "앞이 열리면 공을 몰고 라인을 넘어, 상대 미드필더를 끌어낸 뒤 내준다.",
      ["ps_c_carry","ps_k_carry","ps_t_poss","ps_m_brave"]],
    ["cb_wide","CB","와이드 센터백","Wide centre-back",
      "백3 의 바깥에서 측면 1대1 을 감당하고, 공을 잡으면 옆으로 올라가 한 명을 더 만든다.",
      ["ps_c_duel","ps_p_endur","ps_t_outp","ps_k_pass"]],

    /* ══ FB — 풀백·윙백 ═══════════════════════════════════════ */
    ["fb_overlap","FB","오버래핑 풀백","Overlapping full-back",
      "윙어가 안으로 들어가면 밖으로 돌아 올라가, 크로스와 컷백으로 마무리 장면을 만든다.",
      ["ps_f_over","ps_f_cross","ps_p_speed","ps_t_poss"]],
    ["fb_wingback","FB","윙백","Wing-back",
      "측면 한 줄을 혼자 맡아 끝까지 올라갔다 끝까지 돌아온다 — 90분 왕복이 조건이다.",
      ["ps_p_endur","ps_f_recover","ps_f_over","ps_f_1v1"]],
    ["fb_lockdown","FB","수비형 풀백","Defensive full-back",
      "측면 1대1 에서 안쪽을 막고 밖으로 몰아, 상대 윙어의 돌파와 크로스를 지운다.",
      ["ps_f_1v1","ps_f_cover","ps_k_1v1d","ps_m_focus"]],
    ["fb_inverted","FB","인버티드 풀백","Inverted full-back",
      "안쪽으로 들어와 중앙에서 한 명을 더 만들고, 공을 잃는 순간 중앙 길을 먼저 닫는다.",
      ["ps_f_inside","ps_t_scan","ps_k_touch","ps_m_calm"]],
    ["fb_builder","FB","빌드업 풀백","Build-up full-back",
      "낮고 넓게 서서 상대 압박을 벌리고, 열린 자세로 받아 안·앞·뒤 중 가장 빠른 길을 고른다.",
      ["ps_f_build","ps_k_pass","ps_t_scan","ps_t_poss"]],
    ["fb_physical","FB","경합형 풀백","Physical full-back",
      "측면 롱볼과 떨어지는 세컨드 볼을 몸으로 이겨 내고, 부딪히는 싸움에서 지지 않는다.",
      ["ps_f_duel","ps_p_duel","ps_f_recover","ps_p_endur"]],

    /* ══ MF — 중앙 미드필더 ═══════════════════════════════════ */
    ["mf_controller","MF","컨트롤러(레지스타)","Deep-lying playmaker",
      "받기 전에 보고 첫 터치로 방향을 정해, 팀의 템포와 공이 가는 방향을 결정한다.",
      ["ps_m_tempo","ps_m_break","ps_t_scan","ps_k_pass"]],
    ["mf_anchor","MF","앵커(볼 위너)","Anchor / ball-winner",
      "수비 라인 앞을 지키며 중앙 패스 길을 막고, 떨어지는 세컨드 볼을 먼저 먹는다.",
      ["ps_m_screen","ps_k_1v1d","ps_p_duel","ps_m_focus"]],
    ["mf_boxtobox","MF","박스 투 박스","Box-to-box",
      "수비 지원부터 박스 침투까지 왕복하며, 후반에도 같은 속도로 뛰어 경기를 밀어붙인다.",
      ["ps_m_b2b","ps_p_endur","ps_k_finish","ps_t_trans"]],
    ["mf_mezzala","MF","메자라","Mezzala",
      "하프스페이스 사이로 들어가 받고, 그대로 몰고 들어가 상대 수비 간격을 흔든다.",
      ["ps_t_space","ps_k_carry","ps_m_third","ps_k_1v1a"]],
    ["mf_advanced","MF","어드밴스드 플레이메이커","Advanced playmaker (No.10)",
      "라인 사이에서 돌아서서 받아, 마지막 패스로 동료의 마무리를 만든다.",
      ["ps_m_receive","ps_m_break","ps_k_touch","ps_m_brave"]],
    ["mf_presser","MF","압박형 미드필더","Pressing midfielder",
      "트리거가 보이면 가장 먼저 나가고, 잃은 순간 5초 안에 다시 뺏으러 간다.",
      ["ps_m_press","ps_m_cpress","ps_p_endur","ps_t_outp"]],

    /* ══ W — 윙어·측면 ════════════════════════════════════════ */
    ["w_dribbler","W","돌파형 윙어","Touchline winger",
      "풀백을 정면으로 마주 보고 지나가, 수적 우위와 슛·크로스 각을 직접 만든다.",
      ["ps_w_1v1","ps_k_1v1a","ps_p_agile","ps_m_brave"]],
    ["w_insideforward","W","인사이드 포워드","Inside forward",
      "안으로 잘라 들어와 직접 슛하고, 반대편 크로스에는 먼 포스트로 들어가 마무리한다.",
      ["ps_w_shot","ps_w_final","ps_k_finish","ps_t_space"]],
    ["w_provider","W","크로스형 윙어","Wide provider",
      "엔드라인까지 끌고 가 컷백·크로스·스루 중 가장 좋은 마지막 패스를 고른다.",
      ["ps_w_cross","ps_w_width","ps_k_pass","ps_w_combi"]],
    ["w_behind","W","배후 침투형 윙어","Runner in behind",
      "풀백 뒤 공간을 보고 패스 순간 대각선으로 뛰어, 한 번에 상대 라인을 넘어간다.",
      ["ps_w_behind","ps_p_speed","ps_t_trans","ps_k_carry"]],
    ["w_twoway","W","폭·복귀형 측면","Wide midfielder (two-way)",
      "측면 폭을 끝까지 유지해 상대를 벌리고, 잃는 순간 가장 먼저 돌아와 우리 측면을 지킨다.",
      ["ps_w_press","ps_w_width","ps_p_endur","ps_t_outp"]],
    ["w_combiner","W","연계형 윙","Combination winger",
      "짧게 주고받고 다시 들어가는 2대1 로 좁게 닫힌 측면을 벗겨 낸다.",
      ["ps_w_combi","ps_k_touch","ps_t_scan","ps_t_poss"]],

    /* ══ ST — 스트라이커 ══════════════════════════════════════ */
    ["st_target","ST","타깃형 스트라이커","Target man",
      "등지고 받아 공을 지키고 경합에서 버텨, 동료들이 올라올 시간을 만든다.",
      ["ps_s_hold","ps_s_air","ps_p_duel","ps_k_touch"]],
    ["st_poacher","ST","마무리형 스트라이커","Poacher",
      "박스 안에서 마크를 떼는 반 걸음으로 자리를 잡고, 한 번 온 기회를 골로 끝낸다.",
      ["ps_s_finish","ps_s_box","ps_m_focus","ps_p_agile"]],
    ["st_runner","ST","배후 침투형 스트라이커","Channel runner",
      "수비 라인 뒤로 계속 뛰어 상대 라인을 내리고, 한 번의 패스로 골문 앞에 선다.",
      ["ps_s_run","ps_p_speed","ps_t_space","ps_t_trans"]],
    ["st_presser","ST","압박형 스트라이커","Pressing forward",
      "상대 빌드업을 한쪽으로 몰아 팀 압박의 스위치가 되고, 잃으면 가장 앞에서 다시 뺏는다.",
      ["ps_s_press","ps_s_press2","ps_p_endur","ps_t_outp"]],
    ["st_false9","ST","폴스 나인","False 9",
      "수비 사이에서 내려와 받아 센터백을 끌어내고, 그 빈자리를 동료에게 내준다.",
      ["ps_s_create","ps_t_scan","ps_k_pass","ps_k_touch"]],
    ["st_complete","ST","컴플리트 포워드","Complete forward",
      "마무리·연계·침투를 다 맡는다 — 아직 한 유형으로 좁히지 않은 유소년의 기본값.",
      ["ps_s_finish","ps_s_hold","ps_s_run","ps_s_create"]]
  ];
  var LIST=A.map(function(a){ return {key:a[0],grp:a[1],name:a[2],en:a[3],one:a[4],keys:a[5].slice()}; });
  var BY={}; LIST.forEach(function(t){ BY[t.key]=t; });
  var GRP={}; LIST.forEach(function(t){ (GRP[t.grp]=GRP[t.grp]||[]).push(t); });

  function lv(levels,id){ var v=+((levels||{})[id]||0); return (v>=1&&v<=5)?v:0; }

  var API={
    version:1,
    list:LIST,
    /* 그 포지션군의 유형들 */
    byGroup:function(grp){ return (GRP[grp]||[]).slice(); },
    get:function(key){ return BY[key]||null; },
    name:function(key){ var t=BY[key]; return t?t.name:''; },
    /* 유형이 그 포지션군의 것인지 — 포지션을 바꾸면 유형도 함께 정리해야 한다 */
    fitsGroup:function(key,grp){ var t=BY[key]; return !!(t&&t.grp===grp); },
    /* 핵심 4항목 */
    keysOf:function(key){ var t=BY[key]; return t?t.keys.slice():[]; },
    isKeyItem:function(key,itemId){ var t=BY[key]; return !!(t&&t.keys.indexOf(itemId)>=0); },
    /* ② 유형 보정 — 자리 요구가 **이미 정해진** 핵심 항목만 한 단계(+1, 5 상한) 올린다.
       유형이 없던 요구를 만들어 내면 코치가 정하지 않은 기준이 조용히 생긴다. */
    applyReq:function(base,key){
      var out={}, b=base||{}; Object.keys(b).forEach(function(k){ out[k]=+b[k]||0; });
      var t=BY[key]; if(!t)return out;
      t.keys.forEach(function(id){ var v=+(out[id]||0); if(v>=1)out[id]=Math.min(5,v+1); });
      return out;
    },
    /* 이 항목이 유형 때문에 올라갔나 — 화면에 '유형 +1' 을 붙이려고 */
    boostedAt:function(base,key,itemId){
      var t=BY[key]; if(!t||t.keys.indexOf(itemId)<0)return 0;
      var v=+((base||{})[itemId]||0); return (v>=1&&v<5)?1:0;
    },
    /* ③ 지금 점수로 가까운 유형 — **개수로만 센다.** 핵심 4항목 가운데 몇 개가 '경기에서'(3) 이상인가.
       평균·백분율을 만들지 않는다(평균을 내면 잘하는 하나가 빈 하나를 가린다 — 2.077 과 같은 이유).
       아직 안 매긴 항목은 세지 않고 rated 로 따로 알려 준다. */
    near:function(grp,levels){
      return (GRP[grp]||[]).map(function(t){
        var hit=0,rated=0,sum=0,miss=[];
        t.keys.forEach(function(id){ var v=lv(levels,id); if(!v){ miss.push(id); return; }
          rated++; sum+=v; if(v>=3)hit++; });
        return {key:t.key,name:t.name,en:t.en,one:t.one,keys:t.keys.slice(),hit:hit,rated:rated,sum:sum,unrated:miss};
      }).sort(function(a,b){ return (b.hit-a.hit)||(b.sum-a.sum)||(b.rated-a.rated); });
    }
  };
  window.PS_ARCH=API;
})();
