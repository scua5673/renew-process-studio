/* PROCESS — 연간 PDF(돌아보기 · 계획)와 년간 화면 «시즌 계획» 카드. 3.073 에 process.html 에서 떼어 냈다(페이지 크기 예산).
   process.html 의 전역(weeksMap · yearAnchor · seasonPlan · save · schedEditBlocked · wkbdEsc …)을 **부를 때** 읽는다 — 이 파일이 먼저 실려도 된다.
   인쇄 문서는 페이지의 <style> 을 모아 만든다(__buildPrintDoc) — 그래서 인쇄 CSS 는 <link> 가 아니라 <style> 로 붙인다. */
(function(){
  try{
    var st=document.createElement('style'); st.id='ps-year-plan-css';
    st.textContent=`
  /* ---------- PRINT: 연간 1장 (pl-year) — 3.072 · 3.073 돌아보기/계획 ----------
     위계: ① 엠블럼 + 팀 이름 + 문서 이름(20) → ② 기간(12, 회색) · 오른쪽 합계(12) → ③ 구역 제목 = 달 이름 = 오른쪽 제목(14, 800)
     → ④ 칸 · 목록(10~11). 글자는 tokens.css 7단(var(--t-*), 인쇄 문서엔 tokens.css 가 없어 같은 값을 대체값으로). 색은 주간 보드 PDF 와 같은 칸. */
  #printDoc.pl-year .ponepage{height:186mm}
  #printDoc.pl-year .pyr-head{display:flex;align-items:center;gap:12px;padding-bottom:8px;border-bottom:2px solid #14161A;margin-bottom:8px;flex:0 0 auto}
  #printDoc.pl-year .pyr-emb img{display:block;height:40px;max-width:64px;object-fit:contain}
  #printDoc.pl-year .pyr-tt{flex:1 1 auto;min-width:0}
  #printDoc.pl-year .pyr-h1{display:flex;align-items:baseline;gap:10px;font-size:var(--t-7,20px);line-height:1.15;letter-spacing:-.02em;color:#14161A}
  #printDoc.pl-year .pyr-h1 b{font-weight:800}
  #printDoc.pl-year .pyr-h1 span{font-weight:500;color:#3F454D}
  #printDoc.pl-year .pyr-h2{margin-top:3px;font-size:var(--t-3,12px);color:#646A73;font-weight:600}
  #printDoc.pl-year .pyr-tot{flex:0 0 auto;align-self:flex-end;font-size:var(--t-3,12px);color:#3F454D;font-weight:700;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-band{flex:0 0 auto;margin:0 0 8px}
  #printDoc.pl-year .pyr-seg{position:relative;height:18px;border-radius:4px;background:#F1F3F5}
  #printDoc.pl-year .pyr-seg i{font-style:normal;position:absolute;top:0;bottom:0;border-radius:4px;display:flex;align-items:center;padding:0 6px;overflow:hidden;box-shadow:inset -1px 0 0 #fff}
  #printDoc.pl-year .pyr-seg i b{font-size:var(--t-1,10px);font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-noph{position:absolute;left:8px;top:0;line-height:18px;font-size:var(--t-1,10px);color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-now{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#14161A}
  #printDoc.pl-year .pyr-tick{position:relative;height:12px}
  #printDoc.pl-year .pyr-tick span{position:absolute;top:1px;font-size:var(--t-1,10px);color:#8A9099;font-weight:600;padding-left:2px;border-left:1px solid #C2C7CF;line-height:11px}
  #printDoc.pl-year .pyr-body{flex:1 1 auto;min-height:0;display:flex;gap:16px}
  #printDoc.pl-year .pyr-grid{flex:1 1 0;min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:8px 14px}
  #printDoc.pl-year .pyr-m{min-width:0;display:flex;flex-direction:column}
  #printDoc.pl-year .pyr-mh{display:flex;align-items:baseline;justify-content:space-between;gap:6px;border-bottom:1px solid #DBDEE2;padding-bottom:2px;margin-bottom:3px;min-width:0}
  #printDoc.pl-year .pyr-mh b{flex:0 0 auto;font-size:var(--t-5,14px);font-weight:800;color:#14161A;letter-spacing:-.01em}
  #printDoc.pl-year .pyr-mh>span{font-size:var(--t-1,10px);color:#646A73;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  #printDoc.pl-year .pyr-phn{display:inline-flex;align-items:center;gap:3px;margin-left:6px}
  #printDoc.pl-year .pyr-phn i{display:inline-block;width:6px;height:6px;border-radius:2px}
  #printDoc.pl-year .pyr-cal{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:12px repeat(6,minmax(0,1fr));gap:2px}   /* 여섯 줄 고정 — 달마다 같은 높이 */
  #printDoc.pl-year .pyr-cal i{font-style:normal;display:flex;align-items:center;justify-content:center;font-size:var(--t-1,10px);line-height:1;border-radius:3px;color:#5A6068;font-weight:600;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-cal i.w{font-size:var(--t-1,10px);color:#A2A8AE;font-weight:700}
  #printDoc.pl-year .pyr-cal i.we{color:#A2A8AE}
  #printDoc.pl-year .pyr-cal i.g{background:#C24A46;color:#fff;font-weight:800}
  #printDoc.pl-year .pyr-cal i.tl{background:#E4F3EB;color:#1F5E40;font-weight:700}
  #printDoc.pl-year .pyr-cal i.tm{background:#E7EDFD;color:#23408F;font-weight:700}
  #printDoc.pl-year .pyr-cal i.th{background:#FBEBDA;color:#7A4412;font-weight:700}
  #printDoc.pl-year .pyr-cal i.tu{background:#E9ECEF;color:#3F454D;font-weight:700}
  #printDoc.pl-year .pyr-cal i.o{background:repeating-linear-gradient(135deg,#E3E6EA 0 2px,#fff 2px 4px);color:#A2A8AE}
  #printDoc.pl-year .pyr-cal i.dim{opacity:.32}
  #printDoc.pl-year .pyr-cal i.now{outline:2px solid #14161A;outline-offset:-1px}
  #printDoc.pl-year .pyr-top,#printDoc.pl-year .pyr-goal{flex:0 0 auto;padding-top:3px;font-size:var(--t-1,10px);color:#3F454D;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-top{color:#646A73}
  #printDoc.pl-year .pyr-goal b{color:#8A9099;font-weight:700;margin-right:5px}
  #printDoc.pl-year .pyr-goal.pen{border-bottom:1px solid #DDE1E5;min-height:15px}
  #printDoc.pl-year .pyr-side{flex:0 0 300px;min-width:0;display:flex;flex-direction:column;border-left:1px solid #E3E6EA;padding-left:16px}
  #printDoc.pl-year .pyr-side h4{font-size:var(--t-5,14px);font-weight:800;color:#14161A;margin:10px 0 5px;flex:0 0 auto;letter-spacing:-.01em}
  #printDoc.pl-year .pyr-side h4:first-child{margin-top:0}
  #printDoc.pl-year .pyr-side h4 em{font-style:normal;font-size:var(--t-1,10px);color:#8A9099;font-weight:600;margin-left:4px;letter-spacing:0}
  #printDoc.pl-year .pyr-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;flex:0 0 auto}
  #printDoc.pl-year .pyr-st{border:1px solid #E2E5E8;border-radius:8px;padding:5px 8px;min-width:0}
  #printDoc.pl-year .pyr-st.wide{grid-column:1 / -1}
  #printDoc.pl-year .pyr-st b{display:block;font-size:var(--t-7,20px);font-weight:700;letter-spacing:-.02em;line-height:1.1;color:#14161A;font-variant-numeric:tabular-nums;white-space:nowrap}
  #printDoc.pl-year .pyr-st.g b{color:#C24A46}
  #printDoc.pl-year .pyr-st b small{font-size:var(--t-2,11px);font-weight:600;color:#646A73;margin-left:1px}
  #printDoc.pl-year .pyr-st>span{display:block;font-size:var(--t-1,10px);color:#646A73;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-st em{font-style:normal;font-size:var(--t-1,10px);color:#3F454D;font-weight:600;display:flex;align-items:center;gap:3px 5px;flex-wrap:wrap}
  #printDoc.pl-year .pyr-st em span{color:#8A9099}
  #printDoc.pl-year .pyr-st em i,#printDoc.pl-year .pyr-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-left:4px}
  #printDoc.pl-year .pyr-st em i:first-child{margin-left:0}
  #printDoc.pl-year i.l,#printDoc.pl-year .pyr-legend i.tl{background:#2E9D6A}
  #printDoc.pl-year i.m,#printDoc.pl-year .pyr-legend i.tm{background:#3A6DF0}
  #printDoc.pl-year i.h,#printDoc.pl-year .pyr-legend i.th{background:#D9822B}
  #printDoc.pl-year i.u,#printDoc.pl-year .pyr-legend i.tu{background:#C2C7CF}
  #printDoc.pl-year .pyr-legend i.g{background:#C24A46}
  #printDoc.pl-year .pyr-legend i.o{background:repeating-linear-gradient(135deg,#C2C7CF 0 2px,#fff 2px 4px);border:1px solid #C2C7CF}
  #printDoc.pl-year .pyr-bars{display:flex;align-items:stretch;gap:5px;height:72px;flex:0 0 auto}
  #printDoc.pl-year .pyr-bc{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}
  #printDoc.pl-year .pyr-bg{font-size:var(--t-1,10px);line-height:11px;height:11px;color:#C24A46;font-weight:800;white-space:nowrap}
  #printDoc.pl-year .pyr-bar{flex:1 1 auto;width:70%;display:flex;flex-direction:column;justify-content:flex-end;border-bottom:1px solid #C2C7CF}
  #printDoc.pl-year .pyr-bar i{display:block;width:100%;border-radius:2px 2px 0 0;min-height:2px}
  #printDoc.pl-year .pyr-bv{font-size:var(--t-1,10px);line-height:11px;color:#3F454D;font-weight:700;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-bl{font-size:var(--t-1,10px);line-height:10px;color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-dist{gap:4px;flex:0 0 auto}
  #printDoc.pl-year .pyr-dist .pdrow{gap:8px}
  #printDoc.pl-year .pyr-dist .pdrow:nth-child(n+5){display:none}   /* 상위 네 주제만 — 한 장 고정 */
  #printDoc.pl-year .pyr-dist .pdrow .k{font-size:var(--t-1,10px);width:70px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-dist .pdrow .track{height:6px}
  #printDoc.pl-year .pyr-dist .pdrow .v{font-size:var(--t-1,10px)}
  #printDoc.pl-year .pyr-ml,#printDoc.pl-year .pyr-pl{list-style:none;margin:0;padding:0;flex:0 1 auto;min-height:0;overflow:hidden}
  #printDoc.pl-year .pyr-ml li,#printDoc.pl-year .pyr-pl li{display:flex;align-items:baseline;gap:8px;font-size:var(--t-2,11px);line-height:1.35;padding:2px 0;border-bottom:1px dotted #E3E6EA}
  #printDoc.pl-year .pyr-ml li b{flex:0 0 52px;color:#C24A46;font-weight:800;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-ml li.f b{color:#8A4B47}
  #printDoc.pl-year .pyr-ml li span,#printDoc.pl-year .pyr-pl li b{flex:1 1 auto;min-width:0;color:#14161A;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-ml li em,#printDoc.pl-year .pyr-pl li em{flex:0 0 auto;font-style:normal;font-size:var(--t-1,10px);color:#646A73;font-weight:600;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-ml li em u{text-decoration:none;display:inline-block;margin-left:4px;padding:0 4px;border-radius:3px;color:#fff;font-weight:800}
  #printDoc.pl-year .pyr-ml li em u.r-w{background:#2E9D6A}
  #printDoc.pl-year .pyr-ml li em u.r-d{background:#A2A8AE}
  #printDoc.pl-year .pyr-ml li em u.r-l{background:#C24A46}
  #printDoc.pl-year .pyr-pl li i{flex:0 0 auto;align-self:center;width:8px;height:8px;border-radius:2px}
  #printDoc.pl-year .pyr-pl li>span{flex:0 0 auto;font-size:var(--t-1,10px);color:#3F454D;font-weight:600;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-pl li.on b{text-decoration:underline;text-underline-offset:2px}
  #printDoc.pl-year .pyr-ml li.more,#printDoc.pl-year .pyr-ml li.none,#printDoc.pl-year .pyr-pl li.none{color:#8A9099;font-weight:600;border-bottom:0}
  #printDoc.pl-year .pyr-pen{flex:1 1 auto;min-height:16mm}
  #printDoc.pl-year .pyr-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;font-size:var(--t-1,10px);color:#646A73;font-weight:500;margin-top:8px;flex:0 0 auto}
  #printDoc.pl-year .pyr-legend i{margin:0 4px 0 0;vertical-align:-1px}
  #printDoc.pl-year .pyr-legend .note{margin-left:auto;color:#8A9099}
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
   머리 위계(사용자 «연간 일정 앞에 팀 이름 · 위계를 잘»): ① 엠블럼 + 팀 이름 + 문서 이름(가장 큼) → ② 기간 · 합계(작은 회색 한 줄)
   → ③ 구역 제목(달 이름과 오른쪽 제목이 같은 크기 · 굵기) → ④ 칸 · 목록 글자. 크기는 tokens.css 7단.
   돌아보기: 1/1 ~ 오늘(지난 해는 1년). 칸 색 = 그날 한 것, 오늘 뒤는 흐리게. 오른쪽 = 훈련 · 시간 · RPE · 전적 → 월별 훈련 시간 → 주제 → 경기 결과 → 손글씨 칸.
   계획: 1년 전체. 위에 시즌 단계 띠, 칸 밑줄 = 단계 색, 지난 날은 흐리게. 달 아래 = 그 달 목표(없으면 펜 줄). 오른쪽 = 남은 숫자 → 단계 → 다가오는 경기 → 메모.
   일정은 읽기만 한다. 지금 보기(조)를 따른다(schedViewDay). 빈 양식은 없다. */
function yearDocHTML(mode){
  const plan=mode==='plan', E=wkbdEsc, Y=yearAnchor;
  const t=(typeof teamGet==='function'&&teamGet())||{};
  const today=new Date(); today.setHours(0,0,0,0);
  const tIso=yearQuickFormatIso(today);
  const sp=spYear(Y);
  const kindOfRpe=r=>r===null?'u':(r<=3?'l':(r<=6?'m':'h'));
  const md=dt=>(dt.getMonth()+1)+'.'+dt.getDate();
  const wdOf=dt=>WDAYS[(dt.getDay()+6)%7];
  const months=[], matches=[], pastDates=[], pastRaw=[];
  const tot={ses:0,min:0,rpeSum:0,rpeN:0,w:0,d:0,l:0,gf:0,ga:0,futureTr:0};
  for(let m=0;m<12;m++){
    const dim=new Date(Y,m+1,0).getDate(), lead=(new Date(Y,m,1).getDay()+6)%7;   /* 월요일 시작 — 화면 연간과 같다 */
    const mo={m:m,lead:lead,cells:[],tr:0,g:0,raw:[],min:0,rpeSum:0,rpeN:0,ph:[]};
    for(let d=1;d<=dim;d++){
      const dt=new Date(Y,m,d), iso=yearQuickFormatIso(dt), past=dt<=today;
      const n=offsetOfDate(dt), r=Math.floor(n/7), col=((n%7)+7)%7;
      const raw=weeksMap[r]&&weeksMap[r][col], day=schedViewDay(raw);
      const counts=plan||past;   /* 돌아보기는 오늘까지만 센다 */
      if(raw&&counts)mo.raw.push(raw);
      if(!plan&&past){ pastDates.push(dt); if(raw)pastRaw.push(raw); }
      const k=yearDayKind(day); let c='';
      if(k==='g'){
        c='g';
        const add=mxExtraList(day);
        if(counts)mo.g+=1+add.length;
        let mk='official'; try{ mk=mMatchKind(day); }catch(_){}
        const opp=String((day.match&&day.match.opp)||(day.board&&day.board.opp)||'').trim();
        const one=(o,tm,kd)=>{
          const x={dt:dt,iso:iso,opp:o||'상대 미정',time:tm,kind:kd,res:''};
          if(!plan&&past){ try{ const doc=wkbdMatchDoc(iso,o); const a=doc&&doc.scoreUs, b=doc&&doc.scoreThem;
            if(doc&&a!==''&&a!=null&&b!==''&&b!=null&&isFinite(+a)&&isFinite(+b)){ x.sc=(+a)+' : '+(+b); x.res=+a>+b?'w':(+a<+b?'l':'d');
              tot[x.res]++; tot.gf+=+a; tot.ga+=+b; } }catch(_){} }
          if(plan?(dt>=today):past)matches.push(x);
        };
        one(opp,String((day.match&&day.match.time)||'').trim(),mk);
        add.forEach(x=>{ const L=mxExtraLabel(x); one(L.o==='상대 미정'?'':L.o,L.t,L.friendly?'friendly':'official'); });
      } else if(k==='o') c='o';
      else if(k==='t'){
        c='t'+kindOfRpe(yearDayTrainingRpe(day));
        if(counts)mo.tr++;
        if(plan&&dt>today)tot.futureTr++;
        if(!plan&&past){
          (day.trainings||[]).filter(Boolean).forEach(tr=>{ let mins=0,rp=0; try{ mins=trMinutes(tr)||0; }catch(_){} try{ const L=getLoad(tr); rp=L&&!L.rec?(loadRpe(L)||0):0; }catch(_){}
            tot.ses++; tot.min+=mins; mo.min+=mins; if(rp){ tot.rpeSum+=rp; tot.rpeN++; mo.rpeSum+=rp; mo.rpeN++; } });
          if(!(day.trainings||[]).filter(Boolean).length)tot.ses++;   /* 세션 없이 종류만 정한 옛 저장본 — 하루를 1회로 */
        }
      }
      const ph=plan?spPhaseOn(sp.phases,iso):null;
      if(ph&&mo.ph.indexOf(ph)<0)mo.ph.push(ph);
      mo.cells.push({d:d,c:c,we:col>=5,dim:plan?dt<today:dt>today,now:iso===tIso,ph:ph});
    }
    try{ const mix=daysTopicCount(mo.raw); const top=mix.order.map(x=>[x,mix.b[x]||0]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1])[0]; mo.top=top?top[0]:''; }catch(_){ mo.top=''; }
    months.push(mo);
  }
  /* ── 머리: ① 팀 + 문서 이름 ② 기간 · 합계 ── */
  const isThis=Y===today.getFullYear(), isPastYear=Y<today.getFullYear();
  const period=plan?`${Y}.1.1 – 12.31`:(isPastYear?`${Y}.1.1 – 12.31`:(isThis?`${Y}.1.1 – ${md(today)} (오늘까지)`:`${Y}년 — 아직 지난 날이 없어요`));
  const emblem=t.logo?`<img src="${__psImgSrc(t.logo)}" alt="">`:'';
  const st=plan?null:activityStatsForDates(pastDates);
  const upcoming=matches.length;
  const nextM=plan?matches.filter(x=>x.dt>=today)[0]:null;
  const dN=x=>Math.round((x.dt-today)/86400000);
  const line2=plan
    ? [`남은 경기 ${upcoming}`,`계획한 훈련일 ${tot.futureTr}`,nextM?`다음 경기 ${dN(nextM)<=0?'오늘':'D-'+dN(nextM)}`:''].filter(Boolean).join(' · ')
    : [`훈련 ${tot.ses}회`,tot.min?`${tot.min.toLocaleString('ko-KR')}분`:'',`경기 ${matches.length}`,(tot.w+tot.d+tot.l)?`${tot.w}승 ${tot.d}무 ${tot.l}패`:''].filter(Boolean).join(' · ');
  const head=`<div class="pyr-head">${emblem?`<span class="pyr-emb">${emblem}</span>`:''}<div class="pyr-tt">`
    +`<div class="pyr-h1">${t.name?`<b>${E(t.name)}</b>`:''}<span>${Y} 연간 ${plan?'계획':'돌아보기'}</span></div>`
    +`<div class="pyr-h2">${period}${pGrpTag()}</div></div><div class="pyr-tot">${line2}</div></div>`;
  /* ── 계획: 시즌 단계 띠 ── */
  const dOfY=iso=>{ const p=iso.split('-'); return Math.round((new Date(+p[0],+p[1]-1,+p[2])-new Date(Y,0,1))/86400000); };
  const yDays=Math.round((new Date(Y+1,0,1)-new Date(Y,0,1))/86400000);
  let band='';
  if(plan){
    const segs=sp.phases.filter(p=>p.end>=Y+'-01-01'&&p.start<=Y+'-12-31').map(p=>{
      const a=Math.max(0,dOfY(p.start)), b=Math.min(yDays-1,dOfY(p.end));
      return `<i style="left:${a/yDays*100}%;width:${(b-a+1)/yDays*100}%;background:${p.color}"><b>${E(p.name)}</b></i>`; }).join('');
    const ticks=months.map(mo=>`<span style="left:${dOfY(yearQuickFormatIso(new Date(Y,mo.m,1)))/yDays*100}%">${mo.m+1}월</span>`).join('');
    const nowMk=isThis?`<em class="pyr-now" style="left:${dOfY(tIso)/yDays*100}%"></em>`:'';
    band=`<div class="pyr-band"><div class="pyr-seg">${segs||'<span class="pyr-noph">시즌 단계를 아직 정하지 않았어요 — 년간 화면 «시즌 계획»에서 넣으면 여기에 띠로 나와요</span>'}${nowMk}</div><div class="pyr-tick">${ticks}</div></div>`;
  }
  /* ── 12개월 달력 ── */
  const wd=WDAYS.map((w,i)=>`<i class="w${i>=5?' we':''}">${w}</i>`).join('');
  const cal=months.map(mo=>{
    const cells='<i class="e"></i>'.repeat(mo.lead)+mo.cells.map(x=>{
      const cls=[x.c,(x.we&&!x.c)?'we':'',x.dim?'dim':'',x.now?'now':''].filter(Boolean).join(' ');
      return `<i class="${cls}"${x.ph?` style="box-shadow:inset 0 -2px 0 ${x.ph.color}"`:''}>${x.d}</i>`; }).join('');
    const meta=plan
      ? mo.ph.map(p=>`<span class="pyr-phn"><i style="background:${p.color}"></i>${E(p.name)}</span>`).join('')
      : [mo.tr?`훈련 ${mo.tr}`:'',mo.g?`경기 ${mo.g}`:''].filter(Boolean).join(' · ');
    const foot=plan
      ? (sp.goals[mo.m+1]?`<div class="pyr-goal"><b>목표</b>${E(sp.goals[mo.m+1])}</div>`:`<div class="pyr-goal pen"><b>목표</b></div>`)
      : `<div class="pyr-top">${mo.top?'주제 · '+E(mo.top):'&nbsp;'}</div>`;
    return `<div class="pyr-m"><div class="pyr-mh"><b>${mo.m+1}월</b><span>${meta||(plan?'':'—')}</span></div>`
      +`<div class="pyr-cal">${wd}${cells}</div>${foot}</div>`;
  }).join('');
  /* ── 오른쪽 ── */
  let side='';
  if(!plan){
    const avg=tot.rpeN?Math.round(tot.rpeSum/tot.rpeN*10)/10:null;
    side+=`<h4>올해 한 것</h4><div class="pyr-stats">`
      +`<div class="pyr-st"><b>${tot.ses}<small>회</small></b><span>훈련 세션</span></div>`
      +`<div class="pyr-st"><b>${tot.min?Math.round(tot.min/6)/10:0}<small>시간</small></b><span>훈련 시간</span></div>`
      +`<div class="pyr-st"><b>${avg!=null?avg:'—'}</b><span>평균 RPE</span></div>`
      +`<div class="pyr-st wide"><b>${tot.w}<small>승</small> ${tot.d}<small>무</small> ${tot.l}<small>패</small></b><span>${(tot.w+tot.d+tot.l)?`득 ${tot.gf} · 실 ${tot.ga} · 결과 적은 경기 ${tot.w+tot.d+tot.l}/${matches.length}`:'경기 리뷰에 점수를 적으면 전적이 나와요'}</span></div>`
      +`<div class="pyr-st wide"><em><i class="l"></i>저 ${st.lowIntensityDays}<i class="m"></i>중 ${st.midIntensityDays}<i class="h"></i>고 ${st.highIntensityDays}${st.unratedTrainingDays?`<i class="u"></i>미입력 ${st.unratedTrainingDays}`:''}<span>· 훈련일 ${st.trainingDays} · 휴식 ${st.restDays}</span></em></div></div>`;
    const bmax=Math.max(1,...months.map(mo=>mo.min));
    const band3=a=>a==null?'u':(a<=3?'l':(a<=6?'m':'h'));
    const bars=months.map(mo=>{ const a=mo.rpeN?mo.rpeSum/mo.rpeN:null;
      return `<div class="pyr-bc"><span class="pyr-bg">${mo.g?'●'+mo.g:''}</span><div class="pyr-bar">${mo.min?`<i class="${band3(a)}" style="height:${mo.min/bmax*100}%"></i>`:''}</div><span class="pyr-bv">${mo.min?Math.round(mo.min/60):''}</span><span class="pyr-bl">${mo.m+1}</span></div>`; }).join('');
    side+=`<h4>월별 훈련 시간 <em>시간 · 색 = 평균 RPE · ● = 경기</em></h4><div class="pyr-bars">${bars}</div>`;
    side+=`<h4>주제 배분 <em>실제로 한 세션 기준</em></h4><div class="pdist pyr-dist">${pTopicRows(daysTopicCount(pastRaw))}</div>`;
    const CAP=6, shown=matches.length>CAP?matches.slice(-CAP):matches;   /* 넘치면 최근 것 — 아래 손글씨 칸 자리를 남긴다 */
    const R={w:'승',d:'무',l:'패'};
    side+=`<h4>경기 결과${matches.length>CAP?` <em>최근 ${CAP}경기 · 전체 ${matches.length}</em>`:''}</h4><ul class="pyr-ml">`
      +(matches.length?shown.map(x=>`<li class="${x.kind==='friendly'?'f':''}"><b>${md(x.dt)} ${wdOf(x.dt)}</b><span>${E(x.opp)}</span><em>${x.sc?`${x.sc} <u class="r-${x.res}">${R[x.res]}</u>`:(M_KIND_LB[x.kind]||'')}</em></li>`).join(''):'<li class="none">지난 경기가 없어요</li>')+`</ul>`;
    side+=`<h4>돌아보기 <em>잘된 점 · 바꿀 점</em></h4><div class="pfill pyr-pen"></div>`;
  } else {
    side+=`<h4>남은 시즌</h4><div class="pyr-stats">`
      +`<div class="pyr-st g"><b>${upcoming}<small>경기</small></b><span>남은 경기</span></div>`
      +`<div class="pyr-st"><b>${tot.futureTr}<small>일</small></b><span>계획한 훈련일</span></div>`
      +`<div class="pyr-st"><b>${nextM?(dN(nextM)<=0?'오늘':'D-'+dN(nextM)):'—'}</b><span>다음 경기</span></div></div>`;
    side+=`<h4>시즌 단계</h4><ul class="pyr-pl">`+(sp.phases.length?sp.phases.map(p=>{ const a=p.start.split('-'), b=p.end.split('-'), wks=Math.max(1,Math.round((dOfY(p.end)-dOfY(p.start)+1)/7));
      const on=tIso>=p.start&&tIso<=p.end;
      return `<li${on?' class="on"':''}><i style="background:${p.color}"></i><b>${E(p.name)}</b><span>${+a[1]}.${+a[2]} – ${+b[1]}.${+b[2]}</span><em>${wks}주${on?' · 지금':''}</em></li>`; }).join(''):'<li class="none">아직 없어요 — 펜으로 적어 넣어도 돼요</li>')+`</ul>`;
    const CAP=8, shown=matches.slice(0,CAP);
    side+=`<h4>다가오는 경기${matches.length>CAP?` <em>외 ${matches.length-CAP}경기</em>`:''}</h4><ul class="pyr-ml">`
      +(matches.length?shown.map(x=>`<li class="${x.kind==='friendly'?'f':''}"><b>${md(x.dt)} ${wdOf(x.dt)}</b><span>${E(x.opp)}</span><em>${E([x.time,M_KIND_LB[x.kind]||''].filter(Boolean).join(' · '))} · ${dN(x)<=0?'오늘':'D-'+dN(x)}</em></li>`).join(''):'<li class="none">남은 경기가 없어요</li>')+`</ul>`;
    side+=`<h4>메모</h4><div class="pfill pyr-pen"></div>`;
  }
  const legend=`<div class="pyr-legend"><span><i class="g"></i>경기</span><span><i class="tl"></i>훈련 저강도 (RPE ≤3)</span><span><i class="tm"></i>중 (4–6)</span><span><i class="th"></i>고 (7+)</span><span><i class="tu"></i>강도 미입력</span><span><i class="o"></i>휴식</span>`
    +`<span class="note">${plan?'칸 밑줄 = 시즌 단계 · 흐린 날 = 지난 날':'흐린 날 = 아직 오지 않은 날 · 달 아래 «주제» = 그 달 가장 많이 고른 주제'}</span></div>`;
  return `<div class="ponepage pyr-${plan?'plan':'review'}">${head}${band}<div class="pyr-body"><div class="pyr-grid">${cal}</div>`
    +`<div class="pyr-side">${side}</div></div>${legend}${pFooter()}</div>`;
}
