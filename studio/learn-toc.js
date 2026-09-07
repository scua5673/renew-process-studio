/* ══ 2.323 · 학습 목차(서가) — 학습 앱과 IDP 학습 탭이 **같이 읽는 한 파일** ═══════════════
   사용자: "학습 들어갔을 때 목차 만들어서 다양한 공부 할 수 있게 · IDP에서 학습 들어가도 똑같이".

   왜 한 파일인가: 학습은 지금 **두 곳에 따로** 있고 내용이 겹치지 않는다
   (학습 앱 = 『축구를 배우는 법』 21절 / IDP = 학습 과정 90모듈 · 전술 원칙 95원리 · 경기 읽기 · 개념 · 용어).
   목차를 두 벌 만들면 하루 만에 어긋난다. 글자·순서·진행 숫자까지 한 곳에서 나온다.

   ⚠ **이 파일은 아무것도 쓰지 않는다.** 두 저장소(`cs_learn_v1_*`·`cs_idp_v1_*`)를 **읽기만** 한다 —
      진행 숫자를 양쪽에서 똑같이 보여주려면 상대의 기록도 읽어야 하는데, 쓰기까지 열면
      "학습 앱과 IDP는 분리"라는 약속이 깨진다. 읽기 전용이 그 선이다.

   ⚠ 총 개수는 **살아 있는 데이터가 있으면 그것을** 쓰고, 없을 때만 아래 상수로 떨어진다.
      상수는 idp.html 의 `LR_COURSES`·`LR_TERMS` 와 **함께 고쳐야 한다**(그 둘은 idp.html 안에 인라인이라
      다른 화면에서 셀 수 없다). 숫자가 틀리면 목차가 거짓말을 한다.

   쓰는 법:
     var html = LR_TOC.render();              // 서가 HTML (진행은 스스로 읽어 계산)
     LR_TOC.bind(rootEl, function(id){ … });  // 카드 클릭 → 갈래 id
     LR_TOC.owner(id)                          // 'learn' | 'idp' — 그 갈래를 가진 화면
*/
(function(){
  'use strict';

  /* 살아 있는 데이터가 없을 때만 쓰는 총 개수(위 ⚠) */
  var FALLBACK={ mikl:21, gmhow:5, futsal:12, cur:90, principles:95, game:13, concepts:16, terms:35 };   /* 2.659 — futsal 폴백(IDP 는 learn-futsal.js 를 안 싣는다) */   /* 2.467 — gmhow 폴백: IDP는 learn-gamemodel.js를 안 실어 «0 절»로 거짓말했다(1판) */

  function ic(d){ return '<svg class="toc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'; }

  var ITEMS=[
    { id:'mikl', owner:'learn',
      ko:'축구를 배우는 법', en:'How football is learned', unit:'절',
      desc:'왜 배우는가 · 뇌는 어떻게 배우는가 · 코치와 선수 사이',
      chap:'A 왜 · B 학습이란 · D 상호작용',
      icon:ic('<path d="M12 6.5c-1.6-1.3-3.6-2-6-2H3v13h3c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2h3v-13h-3c-2.4 0-4.4.7-6 2z"/><path d="M12 6.5v13"/>') },
    /* 2.411 — 게임모델 만드는 법. **가르치는 것은 학습에, 만드는 것은 팀 운영 › 기준에.**
       기준 화면에는 설명을 두지 않기로 했으므로(사용자) 설명은 전부 이 갈래가 맡는다. */
    { id:'gmhow', owner:'learn',
      ko:'게임모델 만드는 법', en:'Building a game model', unit:'절',
      desc:'약속이 무엇인지부터 · 네 국면 · 원칙 3층 · 만드는 다섯 걸음',
      chap:'무엇인가 · 네 국면 · 세 층 · 다섯 걸음 · 흔한 실수',
      icon:ic('<path d="M3 20V6l9-3 9 3v14"/><path d="M3 10h18M9 20v-6h6v6"/>') },
    /* 2.659 — 풋살을 배우는 법. 풋살은 역할이 아니라 종목 — 칩이 아니라 책 한 권(사용자, 목업 승인) */
    { id:'futsal', owner:'learn',
      ko:'풋살을 배우는 법', en:'How futsal is learned', unit:'절',
      desc:'다섯 명 · 발바닥 · 4초와 6개 · 3-1과 로테이션 · 파워플레이',
      chap:'A 다른 점 · B 공격 · C 수비·전환·세트',
      icon:ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.2"/><path d="M3 9.5a3 3 0 0 1 0 5M21 9.5a3 3 0 0 0 0 5"/>') },
    { id:'cur', owner:'idp',
      ko:'학습 과정', en:'Curriculum', unit:'모듈',
      desc:'무엇부터 배우는지 단계로 — 다섯 갈래',
      chap:'선수 · 코치 · 피지컬 · 분석 · AT',
      icon:ic('<path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2"/>') },
    { id:'principles', owner:'idp',
      ko:'전술 원칙', en:'Tactical principles', unit:'원리',
      desc:'전술서 일곱 권의 원리를 우리말로 · 원리 → 퀴즈 → 적용',
      chap:'포지셔널 · 데 제르비 · 버티컬 · 수비 · 게임플랜 · 분석 · 규칙',
      icon:ic('<path d="M3 20V9l9-5 9 5v11"/><path d="M9 20v-6h6v6"/>') },
    { id:'game', owner:'idp',
      ko:'경기 읽기', en:'Reading the game', unit:'과정',
      desc:'한 장면을 보고 무슨 일이 있었는지 말하는 연습',
      chap:'관찰 → 원인 → 다음 행동',
      icon:ic('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>') },
    { id:'concepts', owner:'idp',
      ko:'개념', en:'Concepts', unit:'개념',
      desc:'게임모델 · 국면 · 원칙이 무슨 말인지부터',
      chap:'네 묶음',
      icon:ic('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.6 2.6 0 1 1 3.3 3.2c-.6.2-.9.7-.9 1.4"/><path d="M12 17.3h.01"/>') },
    { id:'terms', owner:'idp',
      ko:'용어 학습', en:'Football language', unit:'용어',
      desc:'FIFA 공식 분석 용어 — 팀이 같은 말로 이야기하기',
      chap:'상태 · 공간 · 행동',
      icon:ic('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4c-1.2 0-2.4-.2-3.4-.6L3 21l1.7-5.1A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4z"/>') }
  ];

  /* ── 저장소 읽기(쓰기 없음, 위 ⚠) ─────────────────────────────── */
  function uid(){ try{ var s=JSON.parse(localStorage.getItem('ps_sync_session')||'null'); return (s&&s.uid)||'local'; }catch(e){ return 'local'; } }
  function rd(k){ try{ return JSON.parse(localStorage.getItem(k)||'null')||null; }catch(e){ return null; } }
  function learnDoc(){ return rd('cs_learn_v1_'+uid())||{}; }
  function idpDoc(){ return rd('cs_idp_v1_'+uid())||{}; }
  function nKeys(o){ try{ return Object.keys(o||{}).length; }catch(e){ return 0; } }

  function totalOf(id){
    try{
      if(id==='gmhow'&&window.LR_GMHOW&&window.LR_GMHOW.chapters)
        return window.LR_GMHOW.chapters.reduce(function(a,c){ return a+((c.sections||[]).length); },0);
      if(id==='futsal'&&window.LR_FUTSAL&&window.LR_FUTSAL.chapters)
        return window.LR_FUTSAL.chapters.reduce(function(a,c){ return a+((c.sections||[]).length); },0);
      if(id==='mikl'&&window.LR_MIKL&&window.LR_MIKL.chapters)
        return window.LR_MIKL.chapters.reduce(function(a,c){ return a+((c.sections||[]).length); },0);
      if(id==='cur'&&window.LR_CUR&&window.LR_CUR.byTrack)
        return ['player','coach','physical','analysis','at'].reduce(function(a,t){ return a+(window.LR_CUR.byTrack(t)||[]).length; },0);
      if(id==='principles'&&window.LR_BOOKS)
        return window.LR_BOOKS.reduce(function(a,b){ return a+((b.principles||b.items||[]).length); },0);
      if(id==='concepts'&&window.PS_CONCEPTS)
        return (typeof window.PS_CONCEPTS.count==='function')?window.PS_CONCEPTS.count():(window.PS_CONCEPTS.count||FALLBACK.concepts);
      if(id==='game'&&window.LR_COURSES_N)return window.LR_COURSES_N;
      if(id==='terms'&&window.LR_TERMS_N)return window.LR_TERMS_N;
    }catch(e){}
    return FALLBACK[id]||0;
  }

  function doneOf(id){
    try{
      if(id==='mikl'){ var d=(learnDoc().done)||{}; var n=0;
        Object.keys(d).forEach(function(k){ if(d[k]&&d[k].hits>=3)n++; }); return n; }
      var L=(idpDoc().learning)||{};
      if(id==='cur')return nKeys((L.cur||{}).done);
      if(id==='principles')return nKeys((L.tp||{}).understood);
      if(id==='game')return nKeys(L.completed);
      if(id==='terms')return nKeys(L.termKnown);
      if(id==='concepts')return nKeys((L.cpt||{}).read);   /* 2.467 — 저장은 cpt.read(idp 6395) — cptSeen은 아무도 안 써 영원히 0이었다(1판) */
    }catch(e){}
    return 0;
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function card(it){
    var tot=totalOf(it.id), dn=Math.min(doneOf(it.id),tot);
    var pct=tot?Math.round(dn/tot*100):0;
    /* 시작 전에는 '0/21' 대신 총 개수만 — 처음 온 사람에게 0 을 먼저 보이지 않는다(2.315 와 같은 태도) */
    var line=dn?('<b>'+dn+'</b> / '+tot+' '+esc(it.unit)):(tot+' '+esc(it.unit));
    return '<button type="button" class="toc-card'+(dn?' has':'')+'" data-toc="'+it.id+'">'
      +'<span class="toc-h">'+it.icon+'<span class="toc-nm"><b>'+esc(it.ko)+'</b><i>'+esc(it.en)+'</i></span>'
      +(dn===tot&&tot?'<em class="toc-ok">다 봤어요</em>':'')+'</span>'
      +'<span class="toc-desc">'+esc(it.desc)+'</span>'
      +'<span class="toc-chap">'+esc(it.chap)+'</span>'
      +'<span class="toc-bar"><i style="width:'+pct+'%"></i></span>'
      +'<span class="toc-n">'+line+'<span class="toc-go">›</span></span>'
      +'</button>';
  }

  var LR_TOC={
    owner:function(id){ var it=ITEMS.filter(function(x){ return x.id===id; })[0]; return it?it.owner:''; },
    /* 서가 한 장. `head` 를 false 로 주면 제목 줄 없이 카드만 */
    render:function(opt){
      opt=opt||{};
      /* 2.467 — 부르는 쪽이 갈래를 뺄 수 있다(opt.skip). 학습 앱은 '학습 과정'을 교과서가
         대신해 카드를 DOM에서 떼어냈는데, 머리글 갈래 수·합계는 뗀 것까지 세어 거짓말이었다
         (오디트 ③ «여섯 갈래 · 모두 275» vs 실합 185). 세는 것과 그리는 것을 같은 목록으로. */
      var items=ITEMS.filter(function(it){ return !(opt.skip&&opt.skip.indexOf(it.id)>=0); });
      var tot=0, dn=0;
      items.forEach(function(it){ tot+=totalOf(it.id); dn+=Math.min(doneOf(it.id),totalOf(it.id)); });
      var h='<div class="toc-wrap">';
      if(opt.head!==false)
        h+='<div class="toc-top"><h2>무엇을 공부할까요</h2>'
          +'<p>'+items.length+'갈래 · 모두 '+tot+'개'+(dn?' · 지금까지 '+dn+'개':'')+'</p></div>';
      h+='<div class="toc-grid">'+items.map(card).join('')+'</div></div>';
      return h;
    },
    bind:function(root,pick){
      if(!root||!pick)return;
      [].forEach.call(root.querySelectorAll('[data-toc]'),function(b){
        b.onclick=function(){ pick(b.dataset.toc, LR_TOC.owner(b.dataset.toc)); };
      });
    }
  };

  window.LR_TOC=LR_TOC;
})();
