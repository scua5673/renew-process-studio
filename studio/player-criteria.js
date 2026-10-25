/* Player criteria: presentation only; existing roster IDs, scoring and save flow remain authoritative. */
(function(){
let attrReadCat="";
function renderAttrs(){
  const box=$("attrEditor");box.innerHTML="";
  const manager=$("evalSetManager");
  refreshCats();
  const byCat=attrsByCat();
  const editable=!!window.PSPerms&&PSPerms.canEdit('team');
  if(!editable)attrEditMode=false;
  if(!CATS.some(c=>c[0]===attrReadCat))attrReadCat=CATS.length?CATS[0][0]:'';
  if(manager){
    manager.innerHTML='<div class="tc-criteria-head"><div><h2>선수 기준</h2><p>우리 팀이 선수에게 기대하는 행동. 선수와 코치가 같은 질문으로 평가합니다.</p></div>'
      +(editable?'<button type="button" class="btn primary sm" id="attrEditBtn">'+(attrEditMode?'읽기로 돌아가기':'기준 수정')+'</button>':'')+'</div>'
      +'<details class="tc-standard"><summary>평가 기준 안내 · 표준 자료</summary><p>질문 아래에는 코치가 관찰할 행동이 있습니다. 팀에서 수정한 질문과 관찰 포인트는 선수 화면에도 함께 적용됩니다.</p>'
      +'<p>PROCESS가 FIFA의 경기 언어와 교육 자료를 참고해 설계한 행동 기준입니다. FIFA 공식 인증 평가표는 아닙니다.</p>'
      +'<a href="https://www.fifatrainingcentre.com/en/game/performance-analysis/football-language-analysis/the-fifa-football-language.php" target="_blank" rel="noopener">공식 자료 ↗</a></details>'
      +(!attrEditMode?'<nav class="tc-categories" aria-label="선수 기준 영역">'+CATS.map(([cat,label])=>'<button type="button" data-criteria-cat="'+esc(cat)+'" aria-pressed="'+(cat===attrReadCat)+'">'+esc(label)+' <small>'+(byCat[cat]||[]).length+'</small></button>').join('')+'</nav>':'<p class="tc-edit-note">입력한 내용은 자동 저장됩니다. 기존 평가 점수는 유지됩니다.</p>');
    var eb=document.getElementById('attrEditBtn');
    if(eb)eb.onclick=function(){if(!PSPerms.canEdit('team'))return;attrEditMode=!attrEditMode;renderAttrs();};
    manager.querySelectorAll('[data-criteria-cat]').forEach(b=>b.onclick=()=>{attrReadCat=b.dataset.criteriaCat;renderAttrs();});
  }
  if(!attrEditMode){
    box.className="eval-readonly";
    /* ══ 2.417 · 세그를 없애고 **질문 하나**로 ══════════════════════════════════════
       ⚠ '선수 문장 / 코치 문장' 은 **같은 말의 두 판본이 아니었다.** 앞은 질문이고 뒤는
          관찰 포인트다(eval-standard.js 2.111 이 그렇게 적어 뒀다: "선수와 코치가 **같은 질문**을
          읽어야 셀프 vs 코치 대조가 맞다"). 두 판본처럼 세그로 놓으니 어느 쪽이 진짜인지
          물어보게 됐다(사용자 "이러면 헷갈리니까 하나로 통일").
       ⚠ 그래서 **질문을 한 벌만** 크게 놓고, 관찰 포인트는 그 아래 작은 회색 줄로 붙인다.
          지우지 않는다 — 코치가 '무엇을 보고 매기나'를 잃으면 점수가 느낌이 된다. */

    /* 2.025 — 포지션별 추가 문항(읽기): 그룹 6개 × 4문항. 선수 포지션에 따라 자동으로 붙는다는 안내 */
    try{ if(window.PS_EVAL_STD&&PS_EVAL_STD.posGroups){
      const pcard=document.createElement("details");pcard.className="card attr-cat attr-pos";pcard.style.setProperty("--evc","#16213A");
      const ph=document.createElement("summary");ph.className="card-h attr-cat-head";
      const pdot=document.createElement("i");pdot.className="attr-cat-dot";ph.appendChild(pdot);
      const pt=document.createElement("strong");pt.textContent="포지션별 추가 문항";ph.appendChild(pt);
      const pc=document.createElement("span");pc.className="attr-cat-count";pc.textContent="주 포지션에 따라 자동 적용 · "+PS_EVAL_STD.posGroups.length+"개 그룹";ph.appendChild(pc);
      pcard.appendChild(ph);
      const pw=document.createElement("div");pw.className="attr-pos-grid";
      PS_EVAL_STD.posGroups.forEach(function(g){
        const col=document.createElement("div");col.className="attr-pos-col";
        const hd=document.createElement("b");hd.textContent=g[1]+" · "+PS_EVAL_STD.posItems(g[0]).length+"개";hd.setAttribute("data-code",g[0]);col.appendChild(hd);
        PS_EVAL_STD.posItems(g[0]).forEach(function(it){
          const r=document.createElement("div");r.className="eval-ro-row";
          const lb=document.createElement("span");lb.className="eval-ro-lb";lb.textContent=it.name;
          const tx=document.createElement("span");tx.className="eval-ro-tx";tx.textContent=it.player;
          const wt=document.createElement("small");wt.className="eval-ro-watch";wt.textContent=it.coach||"";
          r.appendChild(lb);r.appendChild(tx);if(it.coach)r.appendChild(wt);col.appendChild(r);
        });
        pw.appendChild(col);
      });
      pcard.appendChild(pw);
      box.__posCard=pcard;
    } }catch(_){}
    CATS.forEach(([cat,label],ci)=>{
      if(cat!==attrReadCat)return;
      /* 2.021 — IDP 평가표(2.015)와 같은 영역 색(전술 파랑·기술 초록·체력 갈색·심리 보라·태도 회청): 왼쪽 띠 + 점 */
      const _COLS=["#3A6DF0","#2E7D63","#B5762B","#8A63D2","#5B6B7C"], _col=_COLS[ci%_COLS.length];
      const card=document.createElement("div");card.className="card attr-cat";card.style.setProperty("--evc",_col);
      const h=document.createElement("div");h.className="card-h attr-cat-head";
      const dot=document.createElement("i");dot.className="attr-cat-dot";h.appendChild(dot);
      const t=document.createElement("strong");t.textContent=label;h.appendChild(t);
      const cnt=document.createElement("span");cnt.className="attr-cat-count";cnt.textContent=(byCat[cat]||[]).length+"개";h.appendChild(cnt);
      card.appendChild(h);
      const items=document.createElement("div");items.className="eval-ro-rows";
      (byCat[cat]||[]).forEach(a=>{
        const st=stdAttr(a);   /* 2.126 — 팀 항목이면 이름으로 표준을 찾아 문장을 빌린다 */
        const q=attrQ(a), w=attrW(a);   /* 2.417 — 팀이 고쳐 썼으면 그 글이 먼저 */
        const row=document.createElement("div");row.className="eval-ro-row";
        const lb=document.createElement("span");lb.className="eval-ro-lb";lb.textContent=a.name;
        const tx=document.createElement("span");tx.className="eval-ro-tx";
        /* ⚠ 질문이 없으면 없다고 말한다 — 이름으로 흉내 내지 않는다(2.125 와 같은 규칙) */
        tx.textContent=q||"질문이 아직 없어요 — 기준 수정에서 적어 주세요";
        if(!q)tx.className+=" none";
        const wt=document.createElement("small");wt.className="eval-ro-watch";wt.textContent=w||"";
        const en=document.createElement("details");en.className="eval-ro-en";if(st){const title=document.createElement("summary");title.textContent="참고 용어";const text=document.createElement("span");text.textContent=st.en;en.append(title,text);}
        row.appendChild(lb);row.appendChild(tx);
        if(w)row.appendChild(wt);
        if(st)row.appendChild(en);
        items.appendChild(row);
      });
      card.appendChild(items);box.appendChild(card);
    });
    if(box.__posCard){ box.__posCard.style.gridColumn="1 / -1"; box.appendChild(box.__posCard); box.__posCard=null; }   /* 2.025 */
    return;
  }
  box.className="";
  // ＋ 카테고리 추가 — 맨 위
  const top=document.createElement("div");
  top.className="attr-toolbar";
  const tl=document.createElement("span");tl.className="attr-toolbar-label";
  tl.textContent="카테고리 "+CATS.length+"개 · 항목 "+data.attrs.length+"개";
  const addCat=document.createElement("button");addCat.className="btn primary sm";addCat.textContent="＋ 카테고리 추가";
  addCat.onclick=()=>{psPrompt("카테고리 이름 (예: 골키핑, 세트피스)","",v=>{const name=(v||"").trim();if(!name)return;
    ensureCustomCats();const id=uid("c");data.meta.cats.push({id,name});refreshCats();save();
    attrOpen[id]=true;renderAttrs();});};
  const sp0=document.createElement("span");sp0.style.flex="1";
  top.append(tl,sp0,addCat);box.appendChild(top);
  CATS.forEach(([cat,label])=>{
    const open=!!attrOpen[cat];
    const card=document.createElement("div");card.className="card attr-cat";
    const h=document.createElement("div");h.className="card-h attr-cat-head";h.style.cursor="pointer";
    const chev=document.createElement("span");chev.textContent=open?"▾":"▸";
    chev.style.cssText="font-size:13px;color:#8A9099;width:16px;";
    h.appendChild(chev);
    const ci=document.createElement("input");ci.className="inp attr-cat-name";ci.value=label;ci.title="카테고리 이름 — 팀 기준에 맞게 수정";
    ci.onclick=e=>e.stopPropagation();
    ci.oninput=()=>{ensureCustomCats();const c=data.meta.cats.find(x=>x.id===cat);if(c){c.name=ci.value;refreshCats();save();}};
    h.appendChild(ci);
    const cnt=document.createElement("span");cnt.className="attr-cat-count";
    cnt.textContent=(byCat[cat]||[]).length+"개";
    h.appendChild(cnt);
    const sp=document.createElement("span");sp.className="sp";h.appendChild(sp);
    if(open){
      const cdel=document.createElement("button");cdel.className="btn ghost sm";cdel.textContent="카테고리 삭제";
      cdel.onclick=e=>{e.stopPropagation();const cnt2=(byCat[cat]||[]).length;
        if(cnt2){toast("이 카테고리의 항목("+cnt2+"개)을 먼저 삭제하거나 옮겨주세요");return;}
        ensureCustomCats();data.meta.cats=data.meta.cats.filter(x=>x.id!==cat);refreshCats();save();renderAttrs();};
      h.appendChild(cdel);
      const add=document.createElement("button");add.className="btn primary sm";add.textContent="＋ 항목";
      add.onclick=e=>{e.stopPropagation();data.attrs.push({id:uid("a"),cat,name:"새 항목"});save();renderAttrs();};
      h.appendChild(add);}
    h.addEventListener("click",()=>{attrOpen[cat]=!open;renderAttrs();});
    card.appendChild(h);
    if(open){
      (byCat[cat]||[]).forEach(a=>{
        const row=document.createElement("div");row.className="ed-attr";
        const inp=document.createElement("input");inp.className="inp";inp.value=a.name;
        /* 2.126 — 팀 평가표에서도 **무엇을 보고 매기는지**가 보이게. 이름이 표준과 같으면 그 관찰 문장을 빌려 온다.
           ⚠ 이름을 고치면 문장도 따라 바뀐다(표준 이름에서 벗어나면 사라진다) — 그게 정직하다. */
        const sent=document.createElement("small");sent.className="ed-attr-sent";
        /* ══ 2.417 · 질문 칸 ══════════════════════════════════════════════════════
           ⚠ 지금까지 이 편집기는 **이름만** 고칠 수 있었다. 그래서 팀이 새 항목을 만들면
              질문이 없는 채로 선수 화면에 떴다(이름만 두 번 찍히던 2.125 의 그 자리).
           ⚠ 빈 칸이면 **표준 문장 그대로**라는 뜻이다(플레이스홀더가 그 문장을 보여 준다) —
              빈 칸을 저장하지 않는다. 표준에 없는 새 항목은 플레이스홀더가 비어 있어,
              적지 않으면 선수 화면에 물을 말이 없다는 것이 그대로 보인다. */
        const qin=document.createElement("input");qin.className="inp ed-attr-q";
        qin.value=String(a.q||"");qin.maxLength=90;
        qin.title="선수와 코치가 같이 읽는 질문 — 비우면 표준 문장을 씁니다";
        const win=document.createElement('input');win.className='inp ed-attr-w';win.value=String(a.w||'');win.maxLength=300;win.setAttribute('aria-label','관찰 포인트');
        qin.setAttribute('aria-label','선수와 코치가 함께 읽는 질문');inp.setAttribute('aria-label','항목 이름');
        win.oninput=()=>{const v=win.value.trim();if(v)a.w=v.slice(0,300);else delete a.w;save();};
        const drawSent=()=>{ const st=stdAttr({id:a.id,name:inp.value});
          sent.textContent="질문과 관찰 포인트를 비우면 표준 문장을 사용합니다.";win.placeholder=st?st.coach:"코치가 확인할 구체적인 행동을 적어 주세요";
          sent.style.display="";
          qin.placeholder=st?st.player:"이 항목의 질문을 적어 주세요 — 예: 공을 받기 전에 주변을 확인하나요?"; };
        drawSent();
        qin.oninput=()=>{ const v=qin.value.trim(); if(v)a.q=v.slice(0,90); else delete a.q; save(); };
        inp.oninput=()=>{a.name=inp.value;drawSent();save();};
        const del=document.createElement("button");del.className="ed-del";del.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';del.title="삭제";
        del.onclick=()=>{psConfirm(`"${a.name}" 항목을 삭제할까요? 포지션·선수 데이터에서도 제거됩니다.`,()=>{
          data.attrs=data.attrs.filter(x=>x.id!==a.id);
          /* 2.908 — 표준 항목을 지웠으면 기억한다. 안 그러면 다음 불러오기(2.026 채우기)가 빈 점수로 되살렸다 */
          try{ if(window.PS_EVAL_STD&&PS_EVAL_STD.items.some(function(it){return it.id===a.id;})){ data.meta.removedStd=data.meta.removedStd||{}; data.meta.removedStd[a.id]=Date.now(); } }catch(_){}
          data.positions.forEach(p=>delete p.targets[a.id]);
          data.players.forEach(p=>{if(p.levels)delete p.levels[a.id];});
          save();renderAttrs();});};
        row.append(inp,del);card.appendChild(row);card.appendChild(qin);card.appendChild(win);card.appendChild(sent);
      });
      if(!(byCat[cat]||[]).length){const e=document.createElement("div");e.className="list-empty";e.style.padding="14px";e.textContent="항목 없음 — ＋ 항목으로 추가";card.appendChild(e);}}
    box.appendChild(card);
  });
}


window.PSPlayerCriteria={render:renderAttrs};
})();
