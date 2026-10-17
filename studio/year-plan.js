/* PROCESS — 연간 PDF(돌아보기 · 계획)와 년간 화면 «시즌 계획» 카드. 3.073 에 process.html 에서 떼어 냈다(페이지 크기 예산).
   process.html 의 전역(weeksMap · yearAnchor · seasonPlan · save · schedEditBlocked · wkbdEsc …)을 **부를 때** 읽는다 — 이 파일이 먼저 실려도 된다.
   인쇄 문서는 페이지의 <style> 을 모아 만든다(__buildPrintDoc) — 그래서 인쇄 CSS 는 <link> 가 아니라 <style> 로 붙인다. */
(function(){
  try{
    var st=document.createElement('style'); st.id='ps-year-plan-css';
    st.textContent=`
  /* ---------- PRINT: 연간 1장 (pl-year) — 3.073 돌아보기/계획, 단순하게 ----------
     위계: ① 엠블럼 + 팀 이름 + 문서 이름(20) → ② 기간(12, 회색) → ③ 달 이름 = 오른쪽 제목(14, 800) → ④ 칸 · 목록(10~11).
     칸 색은 셋(훈련 연파랑 · 경기 빨강 · 휴식 회색). 선 · 상자를 줄이고 여백으로 나눈다. 글자는 tokens.css 7단(대체값 같이). */
  #printDoc.pl-year .ponepage{height:186mm}
  #printDoc.pl-year .pyr-head{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2px solid #14161A;margin-bottom:12px;flex:0 0 auto}
  #printDoc.pl-year .pyr-emb img{display:block;height:40px;max-width:64px;object-fit:contain}
  #printDoc.pl-year .pyr-tt{flex:1 1 auto;min-width:0}
  #printDoc.pl-year .pyr-h1{display:flex;align-items:baseline;gap:10px;font-size:var(--t-7,20px);line-height:1.15;letter-spacing:-.02em;color:#14161A}
  #printDoc.pl-year .pyr-h1 b{font-weight:800}
  #printDoc.pl-year .pyr-h1 span{font-weight:500;color:#3F454D}
  #printDoc.pl-year .pyr-h2{margin-top:3px;font-size:var(--t-3,12px);color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-band{flex:0 0 auto;margin:0 0 12px}
  #printDoc.pl-year .pyr-seg{position:relative;height:20px;border-radius:5px;background:#F1F3F5}
  #printDoc.pl-year .pyr-seg i{font-style:normal;position:absolute;top:0;bottom:0;border-radius:5px;display:flex;align-items:center;padding:0 8px;overflow:hidden;box-shadow:inset -2px 0 0 #fff}
  #printDoc.pl-year .pyr-seg i b{font-size:var(--t-1,10px);font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-noph{position:absolute;left:10px;top:0;line-height:20px;font-size:var(--t-1,10px);color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-now{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#14161A}
  #printDoc.pl-year .pyr-body{flex:1 1 auto;min-height:0;display:flex;gap:24px}
  #printDoc.pl-year .pyr-grid{flex:1 1 0;min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:14px 18px}
  #printDoc.pl-year .pyr-m{min-width:0;display:flex;flex-direction:column}
  #printDoc.pl-year .pyr-mh{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:4px;min-width:0}
  #printDoc.pl-year .pyr-mh b{flex:0 0 auto;font-size:var(--t-5,14px);font-weight:800;color:#14161A}
  #printDoc.pl-year .pyr-mh>span{font-size:var(--t-1,10px);color:#8A9099;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  #printDoc.pl-year .pyr-phn{display:inline-flex;align-items:center;gap:4px;color:#3F454D}
  #printDoc.pl-year .pyr-phn i{display:inline-block;width:7px;height:7px;border-radius:2px}
  #printDoc.pl-year .pyr-cal{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:12px repeat(6,minmax(0,1fr));gap:2px}   /* 여섯 줄 고정 — 달마다 같은 높이 */
  #printDoc.pl-year .pyr-cal i{font-style:normal;display:flex;align-items:center;justify-content:center;font-size:var(--t-1,10px);line-height:1;border-radius:3px;color:#8A9099;font-weight:500;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-cal i.w{color:#A2A8AE;font-weight:600}
  #printDoc.pl-year .pyr-cal i.t{background:#E7EDFD;color:#23408F;font-weight:700}
  #printDoc.pl-year .pyr-cal i.g{background:#C24A46;color:#fff;font-weight:800}
  #printDoc.pl-year .pyr-cal i.o{background:#F1F3F5;color:#A2A8AE}
  #printDoc.pl-year .pyr-cal i.dim{opacity:.3}
  #printDoc.pl-year .pyr-cal i.now{outline:2px solid #14161A;outline-offset:-1px}
  #printDoc.pl-year .pyr-goal{flex:0 0 auto;margin-top:4px;font-size:var(--t-1,10px);color:#3F454D;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-goal.pen{border-bottom:1px solid #DDE1E5;min-height:13px}
  #printDoc.pl-year .pyr-side{flex:0 0 270px;min-width:0;display:flex;flex-direction:column}
  #printDoc.pl-year .pyr-side h4{font-size:var(--t-5,14px);font-weight:800;color:#14161A;margin:16px 0 6px;flex:0 0 auto}
  #printDoc.pl-year .pyr-big{display:flex;gap:18px;flex:0 0 auto;padding-bottom:12px;border-bottom:1px solid #E3E6EA}
  #printDoc.pl-year .pyr-big b{display:block;font-size:var(--t-7,20px);font-weight:800;letter-spacing:-.02em;line-height:1.15;color:#14161A;white-space:nowrap;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-big span{font-size:var(--t-2,11px);color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-bars{display:flex;align-items:stretch;gap:5px;height:56px;flex:0 0 auto}
  #printDoc.pl-year .pyr-bc{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}
  #printDoc.pl-year .pyr-bar{flex:1 1 auto;width:72%;display:flex;flex-direction:column;justify-content:flex-end}
  #printDoc.pl-year .pyr-bar i{display:block;width:100%;border-radius:2px 2px 0 0;min-height:2px;background:#3A6DF0}
  #printDoc.pl-year .pyr-bc span{font-size:var(--t-1,10px);line-height:13px;color:#A2A8AE;font-weight:600}
  #printDoc.pl-year .pyr-dist{gap:5px;flex:0 0 auto}
  #printDoc.pl-year .pyr-dist .pdrow{gap:8px}
  #printDoc.pl-year .pyr-dist .pdrow:nth-child(n+4){display:none}   /* 셋만 */
  #printDoc.pl-year .pyr-dist .pdrow .k{font-size:var(--t-2,11px);width:72px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-dist .pdrow .track{height:6px}
  #printDoc.pl-year .pyr-dist .pdrow .v{font-size:var(--t-1,10px)}
  #printDoc.pl-year .pyr-ml,#printDoc.pl-year .pyr-pl{list-style:none;margin:0;padding:0;flex:0 1 auto;min-height:0;overflow:hidden}
  #printDoc.pl-year .pyr-ml li,#printDoc.pl-year .pyr-pl li{display:flex;align-items:baseline;gap:10px;font-size:var(--t-2,11px);line-height:1.4;padding:2px 0}
  #printDoc.pl-year .pyr-ml li b{flex:0 0 46px;color:#8A9099;font-weight:600;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-ml li span,#printDoc.pl-year .pyr-pl li b{flex:1 1 auto;min-width:0;color:#14161A;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-ml li em,#printDoc.pl-year .pyr-pl li>span{flex:0 0 auto;font-style:normal;font-size:var(--t-1,10px);color:#646A73;font-weight:600;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-ml li em u{text-decoration:none;margin-left:4px;font-weight:800}
  #printDoc.pl-year .pyr-ml li em u.r-w{color:#2E9D6A}
  #printDoc.pl-year .pyr-ml li em u.r-d{color:#8A9099}
  #printDoc.pl-year .pyr-ml li em u.r-l{color:#C24A46}
  #printDoc.pl-year .pyr-pl li i{flex:0 0 auto;align-self:center;width:8px;height:8px;border-radius:2px}
  #printDoc.pl-year .pyr-ml li.none,#printDoc.pl-year .pyr-pl li.none{color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-pen{flex:1 1 auto;min-height:14mm}
  #printDoc.pl-year .pyr-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;font-size:var(--t-1,10px);color:#646A73;font-weight:500;margin-top:10px;flex:0 0 auto}
  #printDoc.pl-year .pyr-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 5px 0 0;vertical-align:-1px}
  #printDoc.pl-year .pyr-legend i.t{background:#E7EDFD;box-shadow:inset 0 0 0 1px #3A6DF0}
  #printDoc.pl-year .pyr-legend i.g{background:#C24A46}
  #printDoc.pl-year .pyr-legend i.o{background:#F1F3F5;box-shadow:inset 0 0 0 1px #C2C7CF}
  #printDoc.pl-year .pyr-legend .note{margin-left:auto;color:#A2A8AE}
  #printDoc.pl-year footer{margin-top:8px}
  /* ---------- 화면: 년간 «시즌 계획» 카드 (3.073) ---------- */
  #yearViewWrap .sp-card .sumhead em{font-style:normal;font-size:var(--fs-caption,12px);font-weight:600;color:var(--text-3,#6b6f76);margin-left:6px}
  #yearViewWrap .sp-band{margin:6px 0 4px}
  #yearViewWrap .sp-seg{position:relative;height:24px;border-radius:6px;background:var(--surface-2,#F1F3F5);overflow:hidden}
  #yearViewWrap .sp-seg i{font-style:normal;position:absolute;top:0;bottom:0;display:flex;align-items:center;padding:0 6px;overflow:hidden;box-shadow:inset -1px 0 0 var(--surface,#fff)}
  #yearViewWrap .sp-seg i b{font-size:var(--fs-micro,11px);font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #yearViewWrap .sp-empty{position:absolute;left:10px;top:0;line-height:24px;font-size:var(--fs-micro,11px);color:var(--text-3,#6b6f76)}
  #yearViewWrap .sp-tick{position:relative;height:16px}
  #yearViewWrap .sp-tick span{position:absolute;top:2px;font-size:var(--fs-micro,11px);color:var(--text-3,#6b6f76);padding-left:3px;border-left:1px solid var(--line)}
  #yearViewWrap .sp-rows{display:flex;flex-direction:column;gap:6px}
  #yearViewWrap .sp-row{display:grid;grid-template-columns:22px minmax(120px,280px) 160px 12px 160px 30px;grid-template-areas:'dot nm st to en del';align-items:center;gap:6px}
  #yearViewWrap .sp-dot{grid-area:dot} #yearViewWrap .sp-name{grid-area:nm} #yearViewWrap .sp-row input[data-f=start]{grid-area:st} #yearViewWrap .sp-to{grid-area:to;text-align:center} #yearViewWrap .sp-row input[data-f=end]{grid-area:en} #yearViewWrap .sp-del{grid-area:del}
  #yearViewWrap .sp-row input{font:inherit;font-size:var(--fs-sub,13px);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:6px 8px;background:var(--surface);color:var(--text);min-width:0}
  #yearViewWrap .sp-row .sp-name{font-weight:600}
  #yearViewWrap .sp-to{color:var(--text-3,#6b6f76)}
  #yearViewWrap .sp-dot{width:22px;height:22px;border-radius:6px;border:0;cursor:pointer;flex:0 0 auto}
  #yearViewWrap .sp-del{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text-3,#6b6f76);cursor:pointer;font-size:var(--fs-title,16px);line-height:1}
  #yearViewWrap .sp-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  #yearViewWrap .sp-acts small{font-weight:500;color:var(--text-3,#6b6f76);margin-left:4px}
  #yearViewWrap .sp-ro{margin-top:6px;font-size:var(--fs-caption,12px);color:var(--text-3,#6b6f76)}
  #yearViewWrap .sp-goals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 10px}
  #yearViewWrap .sp-goal{display:flex;align-items:center;gap:8px;min-width:0}
  #yearViewWrap .sp-goal b{flex:0 0 30px;font-size:var(--fs-caption,12px);font-weight:700;color:var(--text-2)}
  #yearViewWrap .sp-goal input{flex:1 1 auto;min-width:0;font:inherit;font-size:var(--fs-sub,13px);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:6px 8px;background:var(--surface);color:var(--text)}
  #yearViewWrap .sp-card input:disabled,#yearViewWrap .sp-card button:disabled{opacity:.6;cursor:not-allowed}
  @media (max-width:640px){ #yearViewWrap .sp-goals{grid-template-columns:1fr}
    #yearViewWrap .sp-row{grid-template-columns:22px minmax(0,1fr) 10px minmax(0,1fr) 30px;grid-template-areas:'dot nm nm nm del' '. st to en .';row-gap:4px;padding-bottom:6px;border-bottom:1px solid var(--line)}
    #yearViewWrap .sp-row input[type=date]{font-size:var(--fs-caption,12px);padding:6px 4px} }
`;
    (document.head||document.documentElement).appendChild(st);
  }catch(_){}
})();

/* ══ 3.073 · 시즌 계획 — 해마다 시즌 단계(이름 · 기간 · 색)와 월별 목표 ═══════════════════════════════
   사용자 «1년간 했던 걸 보는 거랑 계획할 수 있는 거 2가지로» · «앱에서 입력 · 저장». 일정 문서(process_coach_v1)의
   최상위 seasonPlan = { '2026': { phases:[{name,start,end,color}], goals:{'1':'…',…,'12':'…'} } }.
   저장은 일정의 save() 한 길(권한 · 편집 보호 · 동기화 그대로). 병합은 sync.js 의 «weeks 밖 최상위 필드» 규칙(필드째 나중 저장). */
var SP_COLORS=['#3A6DF0','#2E9D6A','#D9822B','#8B63D2','#646A73','#B5762B'];
var SP_PRESET=[['동계훈련','01-05','02-28'],['전반기','03-01','07-15'],['하계','07-16','08-20'],['후반기','08-21','11-15'],['휴식기','11-16','12-31']];
function spIso(s){ s=String(s||''); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m)return ''; const d=new Date(+m[1],+m[2]-1,+m[3]); return (d.getMonth()===+m[2]-1&&d.getDate()===+m[3])?s:''; }
/* 읽을 때마다 정리한다 — 다른 기기 · 옛 판본이 무엇을 남겼든 PDF · 화면은 이 모양만 본다 */
function spYear(y){
  const raw=(seasonPlan&&typeof seasonPlan==='object'&&seasonPlan[String(y)])||{};
  const phases=(Array.isArray(raw.phases)?raw.phases:[]).map((p,i)=>{
    if(!p||typeof p!=='object')return null;
    let a=spIso(p.start), b=spIso(p.end); if(!a||!b)return null; if(b<a){ const t=a; a=b; b=t; }
    const c=SP_COLORS.indexOf(p.color)>=0?p.color:SP_COLORS[i%SP_COLORS.length];
    return {name:String(p.name||'').trim().slice(0,20)||'단계',start:a,end:b,color:c};
  }).filter(Boolean).sort((x,y)=>x.start<y.start?-1:(x.start>y.start?1:0));
  const goals={}; const g=(raw.goals&&typeof raw.goals==='object')?raw.goals:{};
  for(let m=1;m<=12;m++){ const v=String(g[m]==null?'':g[m]).replace(/\s+/g,' ').trim().slice(0,60); if(v)goals[m]=v; }
  return {phases:phases,goals:goals};
}
function spPhaseOn(phases,iso){ for(const p of phases){ if(iso>=p.start&&iso<=p.end)return p; } return null; }
function spWrite(y,fn){
  if(schedEditBlocked()){ try{schedBlockNotice();}catch(_){} renderSeasonPlan(); return false; }
  const cur=spYear(y); fn(cur);
  const next=Object.assign({},(seasonPlan&&typeof seasonPlan==='object')?seasonPlan:{});
  if(!cur.phases.length&&!Object.keys(cur.goals).length)delete next[String(y)];
  else next[String(y)]={phases:cur.phases,goals:cur.goals};
  seasonPlan=next; save(); renderSeasonPlan(); return true;
}

/* 3.073 — 년간 화면 «시즌 계획» 카드. 단계(색 · 이름 · 기간)와 월별 목표를 고치면 일정 save() 로 바로 저장된다. */
function renderSeasonPlan(){
  const box=document.getElementById('spCard'); if(!box) return;
  const Y=yearAnchor, sp=spYear(Y), ro=schedEditBlocked(), E=wkbdEsc, dis=ro?' disabled':'';
  const yd=Math.round((new Date(Y+1,0,1)-new Date(Y,0,1))/864e5);
  const dOf=iso=>{ const p=iso.split('-'); return Math.round((new Date(+p[0],+p[1]-1,+p[2])-new Date(Y,0,1))/864e5); };
  const segs=sp.phases.filter(p=>p.end>=Y+'-01-01'&&p.start<=Y+'-12-31').map(p=>{ const a=Math.max(0,dOf(p.start)), b=Math.min(yd-1,dOf(p.end));
    return `<i style="left:${a/yd*100}%;width:${(b-a+1)/yd*100}%;background:${p.color}" title="${E(p.name)}"><b>${E(p.name)}</b></i>`; }).join('');
  const ticks=[0,1,2,3,4,5,6,7,8,9,10,11].map(m=>`<span style="left:${dOf(yearQuickFormatIso(new Date(Y,m,1)))/yd*100}%">${m+1}</span>`).join('');
  const rows=sp.phases.map((p,i)=>`<div class="sp-row" data-i="${i}">`
    +`<button type="button" class="sp-dot" data-act="color" style="background:${p.color}" aria-label="${E(p.name)} 색 바꾸기"${dis}></button>`
    +`<input class="sp-name" data-f="name" value="${E(p.name)}" maxlength="20" aria-label="단계 이름"${dis}>`
    +`<input type="date" data-f="start" value="${p.start}" aria-label="${E(p.name)} 시작"${dis}><span class="sp-to">–</span>`
    +`<input type="date" data-f="end" value="${p.end}" aria-label="${E(p.name)} 끝"${dis}>`
    +`<button type="button" class="sp-del" data-act="del" aria-label="${E(p.name)} 지우기"${dis}>×</button></div>`).join('');
  const goals=[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>`<label class="sp-goal"><b>${m}월</b><input data-goal="${m}" value="${E(sp.goals[m]||'')}" maxlength="60" placeholder="이달 목표" aria-label="${m}월 목표"${dis}></label>`).join('');
  box.innerHTML=`<div class="sumhead">시즌 계획 <em>${Y}년 · «연간 계획 PDF»에 들어가요</em></div>`
    +`<div class="sp-band"><div class="sp-seg">${segs||'<span class="sp-empty">단계를 넣으면 한 해 띠로 보여요</span>'}</div><div class="sp-tick">${ticks}</div></div>`
    +`<div class="sumsec">시즌 단계</div><div class="sp-rows">${rows}</div>`
    +(ro?'<div class="sp-ro">일정 편집 권한이 있는 운영진만 바꿀 수 있어요</div>'
       :`<div class="sp-acts"><button type="button" class="btn" data-act="add">＋ 단계 추가</button>${sp.phases.length?'':'<button type="button" class="btn" data-act="preset">기본 틀 넣기 <small>동계 · 전반기 · 하계 · 후반기 · 휴식기</small></button>'}</div>`)
    +`<div class="sumsec">월별 목표</div><div class="sp-goals">${goals}</div>`;
  if(box.__wired) return;
  box.__wired=1;
  box.addEventListener('change',function(e){
    const el=e.target; const Y2=yearAnchor;
    if(el.dataset.goal){ const m=+el.dataset.goal, v=String(el.value||'').replace(/\s+/g,' ').trim().slice(0,60);
      spWrite(Y2,cur=>{ if(v)cur.goals[m]=v; else delete cur.goals[m]; }); return; }
    const row=el.closest('.sp-row'); if(!row||!el.dataset.f) return; const i=+row.dataset.i, f=el.dataset.f;
    spWrite(Y2,cur=>{ const p=cur.phases[i]; if(!p) return;
      if(f==='name'){ p.name=String(el.value||'').trim().slice(0,20)||'단계'; }
      else{ const v=spIso(el.value); if(v) p[f]=v; }
      if(p.end<p.start){ const t=p.start; p.start=p.end; p.end=t; } });
  });
  box.addEventListener('click',function(e){
    const b=e.target.closest('button[data-act]'); if(!b||b.disabled) return;
    const act=b.dataset.act, Y2=yearAnchor, row=b.closest('.sp-row'), i=row?+row.dataset.i:-1;
    if(act==='del') spWrite(Y2,cur=>{ cur.phases.splice(i,1); });
    else if(act==='color') spWrite(Y2,cur=>{ const p=cur.phases[i]; if(p) p.color=SP_COLORS[(SP_COLORS.indexOf(p.color)+1)%SP_COLORS.length]; });
    else if(act==='preset') spWrite(Y2,cur=>{ if(cur.phases.length) return; cur.phases=SP_PRESET.map((x,k)=>({name:x[0],start:Y2+'-'+x[1],end:Y2+'-'+x[2],color:SP_COLORS[k%SP_COLORS.length]})); });
    else if(act==='add') spWrite(Y2,cur=>{
      const last=cur.phases[cur.phases.length-1];
      let s=new Date(Y2,0,1); if(last){ const p=last.end.split('-'); s=new Date(+p[0],+p[1]-1,+p[2]+1); }
      if(s.getFullYear()>Y2) s=new Date(Y2,11,1);
      const en=new Date(s); en.setDate(en.getDate()+30); if(en.getFullYear()>Y2) en.setTime(new Date(Y2,11,31).getTime());
      cur.phases.push({name:'새 단계',start:yearQuickFormatIso(s),end:yearQuickFormatIso(en),color:SP_COLORS[cur.phases.length%SP_COLORS.length]}); });
  });
}

/* ══ 3.073 · 연간 PDF 두 가지 — 돌아보기(했던 것) · 계획(할 것). A4 가로 한 장씩 ═══════════════════
   단순하게(사용자 «조금 복잡해 보이는데»): 칸 색은 셋(훈련 · 경기 · 휴식)뿐 — 강도는 종이에서 뺐다(화면 «올해 요약»에 있다).
   머리 = 엠블럼 + 팀 이름 + 문서 이름, 아래 기간 한 줄. 오른쪽은 큰 숫자 하나 줄 + 구역 셋.
   돌아보기: 1/1 ~ 오늘(지난 해는 1년). 숫자(훈련 · 시간 · 전적) → 월별 훈련 시간 → 많이 한 주제 셋 → 최근 경기 → 손글씨 칸. 오늘 뒤는 흐리게.
   계획: 위에 시즌 단계 띠, 달 머리에 그 달 단계, 달 아래 목표(없으면 펜 줄). 숫자(다음 경기 · 남은 경기) → 단계 → 다가오는 경기 → 메모. 지난 날은 흐리게.
   일정은 읽기만 한다. 지금 보기(조)를 따른다(schedViewDay). 빈 양식은 없다. */
function yearDocHTML(mode){
  const plan=mode==='plan', E=wkbdEsc, Y=yearAnchor;
  const t=(typeof teamGet==='function'&&teamGet())||{};
  const today=new Date(); today.setHours(0,0,0,0);
  const tIso=yearQuickFormatIso(today);
  const sp=spYear(Y);
  const md=dt=>(dt.getMonth()+1)+'.'+dt.getDate();
  const wdOf=dt=>WDAYS[(dt.getDay()+6)%7];
  const months=[], matches=[], pastRaw=[];
  const tot={ses:0,min:0,w:0,d:0,l:0};
  for(let m=0;m<12;m++){
    const dim=new Date(Y,m+1,0).getDate(), lead=(new Date(Y,m,1).getDay()+6)%7;   /* 월요일 시작 — 화면 연간과 같다 */
    const mo={m:m,lead:lead,cells:[],tr:0,g:0,min:0,ph:null};
    for(let d=1;d<=dim;d++){
      const dt=new Date(Y,m,d), iso=yearQuickFormatIso(dt), past=dt<=today;
      const n=offsetOfDate(dt), r=Math.floor(n/7), col=((n%7)+7)%7;
      const raw=weeksMap[r]&&weeksMap[r][col], day=schedViewDay(raw);
      const counts=plan||past;   /* 돌아보기는 오늘까지만 센다 */
      if(!plan&&past&&raw)pastRaw.push(raw);
      const k=yearDayKind(day);
      if(k==='g'){
        const add=mxExtraList(day);
        if(counts)mo.g+=1+add.length;
        let mk='official'; try{ mk=mMatchKind(day); }catch(_){}
        const one=(o,tm,kd)=>{
          const x={dt:dt,opp:o||'상대 미정',time:tm,kind:kd,res:''};
          if(!plan&&past){ try{ const doc=wkbdMatchDoc(iso,o); const a=doc&&doc.scoreUs, b=doc&&doc.scoreThem;
            if(doc&&a!==''&&a!=null&&b!==''&&b!=null&&isFinite(+a)&&isFinite(+b)){ x.sc=(+a)+':'+(+b); x.res=+a>+b?'w':(+a<+b?'l':'d'); tot[x.res]++; } }catch(_){} }
          if(plan?(dt>=today):past)matches.push(x);
        };
        one(String((day.match&&day.match.opp)||(day.board&&day.board.opp)||'').trim(),String((day.match&&day.match.time)||'').trim(),mk);
        add.forEach(x=>{ const L=mxExtraLabel(x); one(L.o==='상대 미정'?'':L.o,L.t,L.friendly?'friendly':'official'); });
      } else if(k==='t'){
        if(counts)mo.tr++;
        if(!plan&&past){
          const ts=(day.trainings||[]).filter(Boolean);
          ts.forEach(tr=>{ let mins=0; try{ mins=trMinutes(tr)||0; }catch(_){} tot.min+=mins; mo.min+=mins; });
          tot.ses+=ts.length||1;   /* 세션 없이 종류만 정한 옛 저장본 — 하루를 1회로 */
        }
      }
      if(plan&&!mo.ph)mo.ph=spPhaseOn(sp.phases,iso);
      mo.cells.push({d:d,c:k,dim:plan?dt<today:dt>today,now:iso===tIso});
    }
    months.push(mo);
  }
  /* ── 머리: 엠블럼 + 팀 이름 + 문서 이름 / 기간 ── */
  const isThis=Y===today.getFullYear(), isPastYear=Y<today.getFullYear();
  const period=(plan||isPastYear)?`${Y}.1.1 – 12.31`:(isThis?`${Y}.1.1 – ${md(today)} 오늘까지`:`${Y}년 — 아직 지난 날이 없어요`);
  const head=`<div class="pyr-head">${t.logo?`<span class="pyr-emb"><img src="${__psImgSrc(t.logo)}" alt=""></span>`:''}<div class="pyr-tt">`
    +`<div class="pyr-h1">${t.name?`<b>${E(t.name)}</b>`:''}<span>${Y} 연간 ${plan?'계획':'돌아보기'}</span></div>`
    +`<div class="pyr-h2">${period}${pGrpTag()}</div></div></div>`;
  /* ── 계획: 시즌 단계 띠 ── */
  const dOfY=iso=>{ const p=iso.split('-'); return Math.round((new Date(+p[0],+p[1]-1,+p[2])-new Date(Y,0,1))/86400000); };
  const yDays=Math.round((new Date(Y+1,0,1)-new Date(Y,0,1))/86400000);
  let band='';
  if(plan){
    const segs=sp.phases.filter(p=>p.end>=Y+'-01-01'&&p.start<=Y+'-12-31').map(p=>{
      const a=Math.max(0,dOfY(p.start)), b=Math.min(yDays-1,dOfY(p.end));
      return `<i style="left:${a/yDays*100}%;width:${(b-a+1)/yDays*100}%;background:${p.color}"><b>${E(p.name)}</b></i>`; }).join('');
    band=`<div class="pyr-band"><div class="pyr-seg">${segs||'<span class="pyr-noph">시즌 단계는 년간 화면 «시즌 계획»에서 넣어요</span>'}${isThis?`<em class="pyr-now" style="left:${dOfY(tIso)/yDays*100}%"></em>`:''}</div></div>`;
  }
  /* ── 12개월 달력 — 칸 색은 셋 ── */
  const wd=WDAYS.map(w=>`<i class="w">${w}</i>`).join('');
  const cal=months.map(mo=>{
    const cells='<i class="e"></i>'.repeat(mo.lead)+mo.cells.map(x=>{
      const cls=[x.c,x.dim?'dim':'',x.now?'now':''].filter(Boolean).join(' ');
      return `<i${cls?` class="${cls}"`:''}>${x.d}</i>`; }).join('');
    const meta=plan
      ? (mo.ph?`<span class="pyr-phn"><i style="background:${mo.ph.color}"></i>${E(mo.ph.name)}</span>`:'')
      : [mo.tr?`훈련 ${mo.tr}`:'',mo.g?`경기 ${mo.g}`:''].filter(Boolean).join(' · ');
    const foot=plan?(sp.goals[mo.m+1]?`<div class="pyr-goal">${E(sp.goals[mo.m+1])}</div>`:`<div class="pyr-goal pen"></div>`):'';
    return `<div class="pyr-m"><div class="pyr-mh"><b>${mo.m+1}월</b><span>${meta}</span></div><div class="pyr-cal">${wd}${cells}</div>${foot}</div>`;
  }).join('');
  /* ── 오른쪽 ── */
  const big=xs=>`<div class="pyr-big">${xs.map(x=>`<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>`;
  let side='';
  if(!plan){
    const rec=tot.w+tot.d+tot.l;
    side+=big([[tot.ses,'훈련'],[Math.round(tot.min/60),'시간'],rec?[`${tot.w}승 ${tot.d}무 ${tot.l}패`,'전적']:[matches.length,'경기']]);
    const bmax=Math.max(1,...months.map(mo=>mo.min));
    side+=`<h4>월별 훈련 시간</h4><div class="pyr-bars">${months.map(mo=>`<div class="pyr-bc"><div class="pyr-bar">${mo.min?`<i style="height:${mo.min/bmax*100}%"></i>`:''}</div><span>${mo.m+1}</span></div>`).join('')}</div>`;
    side+=`<h4>많이 한 주제</h4><div class="pdist pyr-dist">${pTopicRows(daysTopicCount(pastRaw))}</div>`;
    const R={w:'승',d:'무',l:'패'}, shown=matches.slice(-5);
    side+=`<h4>최근 경기</h4><ul class="pyr-ml">`+(shown.length?shown.map(x=>`<li><b>${md(x.dt)}</b><span>${E(x.opp)}</span><em>${x.sc?`${x.sc} <u class="r-${x.res}">${R[x.res]}</u>`:(M_KIND_LB[x.kind]||'')}</em></li>`).join(''):'<li class="none">지난 경기가 없어요</li>')+`</ul>`;
    side+=`<h4>돌아보기</h4><div class="pfill pyr-pen"></div>`;
  } else {
    const nx=matches[0], dN=x=>Math.round((x.dt-today)/86400000);
    side+=big([[nx?(dN(nx)<=0?'오늘':'D-'+dN(nx)):'—','다음 경기'],[matches.length,'남은 경기']]);
    side+=`<h4>시즌 단계</h4><ul class="pyr-pl">`+(sp.phases.length?sp.phases.map(p=>{ const a=p.start.split('-'), b=p.end.split('-');
      return `<li><i style="background:${p.color}"></i><b>${E(p.name)}</b><span>${+a[1]}.${+a[2]} – ${+b[1]}.${+b[2]}</span></li>`; }).join(''):'<li class="none">아직 없어요</li>')+`</ul>`;
    side+=`<h4>다가오는 경기</h4><ul class="pyr-ml">`+(matches.length?matches.slice(0,5).map(x=>`<li><b>${md(x.dt)} ${wdOf(x.dt)}</b><span>${E(x.opp)}</span><em>${dN(x)<=0?'오늘':'D-'+dN(x)}</em></li>`).join(''):'<li class="none">남은 경기가 없어요</li>')+`</ul>`;
    side+=`<h4>메모</h4><div class="pfill pyr-pen"></div>`;
  }
  const legend=`<div class="pyr-legend"><span><i class="t"></i>훈련</span><span><i class="g"></i>경기</span><span><i class="o"></i>휴식</span><span class="note">흐린 날 = ${plan?'지난 날':'아직 오지 않은 날'}</span></div>`;
  return `<div class="ponepage pyr-${plan?'plan':'review'}">${head}${band}<div class="pyr-body"><div class="pyr-grid">${cal}</div>`
    +`<div class="pyr-side">${side}</div></div>${legend}${pFooter()}</div>`;
}
