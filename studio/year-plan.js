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
  #printDoc.pl-year .ponepage{height:209.5mm;padding:10mm 0;box-sizing:border-box;break-after:page}   /* 3.073 — 여러 장: 장마다 A4 가로 한 쪽, 여백도 장마다 */
  #printDoc.pl-year .ponepage:last-child{break-after:auto}
  #printDoc.pl-year .pyr-pg{font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-h0{font-size:var(--t-3,12px);color:#8A9099;font-weight:600;margin-bottom:3px}
  #printDoc.pl-year .pyr-sub .pyr-h1 span{font-size:var(--t-3,12px);color:#8A9099;font-weight:600;letter-spacing:0}
  #printDoc.pl-year .pyr-pbody{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}
  #printDoc.pl-year .pyr-pbody h3{font-size:var(--t-5,14px);font-weight:800;color:#14161A;margin:16px 0 8px;flex:0 0 auto}
  #printDoc.pl-year .pyr-pbody h3:first-child{margin-top:0}
  #printDoc.pl-year .pyr-pbody h3 em{font-style:normal;font-size:var(--t-1,10px);color:#8A9099;font-weight:600;margin-left:6px}
  #printDoc.pl-year .pyr-none{font-size:var(--t-2,11px);color:#8A9099;padding:6px 0}
  #printDoc.pl-year .pyr-tbl{width:100%;border-collapse:collapse;table-layout:auto;font-variant-numeric:tabular-nums;flex:0 0 auto}
  #printDoc.pl-year .pyr-tbl th,#printDoc.pl-year .pyr-tbl td{font-size:var(--t-2,11px);padding:5px 6px;text-align:center;border-bottom:1px solid #ECEEF1;color:#14161A;white-space:nowrap}
  #printDoc.pl-year .pyr-tbl thead th{font-size:var(--t-1,10px);color:#8A9099;font-weight:700;border-bottom:1.5px solid #14161A;padding-bottom:4px}
  #printDoc.pl-year .pyr-tbl thead th small{font-weight:600}
  #printDoc.pl-year .pyr-tbl tbody th{font-weight:800;text-align:left}
  #printDoc.pl-year .pyr-tbl tfoot th,#printDoc.pl-year .pyr-tbl tfoot td{font-weight:800;border-top:1.5px solid #14161A;border-bottom:0}
  #printDoc.pl-year .pyr-tbl tfoot th{text-align:left}
  #printDoc.pl-year .pyr-tbl .txt{text-align:left;white-space:normal}
  #printDoc.pl-year .pyr-tbl td.goal{color:#3F454D;max-width:170px}
  #printDoc.pl-year .pyr-tbl tr.quiet td,#printDoc.pl-year .pyr-tbl tr.quiet th{color:#A2A8AE}
  #printDoc.pl-year .pyr-tbl td.ibc{text-align:left}
  #printDoc.pl-year .pyr-ib{display:inline-flex;width:70px;height:7px;border-radius:2px;overflow:hidden;vertical-align:middle;background:#F1F3F5;gap:1px}
  #printDoc.pl-year .pyr-ib i{display:block;height:100%}
  #printDoc.pl-year .pyr-ib i.l{background:#2E9D6A} #printDoc.pl-year .pyr-ib i.m{background:#3A6DF0} #printDoc.pl-year .pyr-ib i.h{background:#D9822B} #printDoc.pl-year .pyr-ib i.u{background:#C2C7CF}
  #printDoc.pl-year .pyr-ib.none{background:none;width:auto;color:#A2A8AE}
  #printDoc.pl-year .pyr-ibn{margin-left:6px;font-size:var(--t-1,10px);color:#3F454D}
  #printDoc.pl-year .pyr-ibn small{color:#A2A8AE}
  #printDoc.pl-year .pyr-wk{display:flex;align-items:flex-end;gap:2px;height:110px;border-bottom:1px solid #C2C7CF;flex:0 0 auto}
  #printDoc.pl-year .pyr-wc{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;position:relative}
  #printDoc.pl-year .pyr-wc i{display:block;background:rgba(58,109,240,.38);border-radius:2px 2px 0 0;min-height:1px}
  #printDoc.pl-year .pyr-wc.hi i{background:#3A6DF0}
  #printDoc.pl-year .pyr-wc b{position:absolute;bottom:-7px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#C24A46}
  #printDoc.pl-year .pyr-wkt{position:relative;height:16px;margin-top:8px}
  #printDoc.pl-year .pyr-wkt span{position:absolute;font-size:var(--t-1,10px);color:#8A9099;font-weight:600;border-left:1px solid #C2C7CF;padding-left:3px}
  #printDoc.pl-year .pyr-heat td{min-width:28px}
  #printDoc.pl-year .pyr-heat tbody th i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;vertical-align:0}
  #printDoc.pl-year .pyr-dr{list-style:none;margin:0;padding:0;columns:2;column-gap:32px;flex:0 0 auto}
  #printDoc.pl-year .pyr-dr li{display:flex;align-items:baseline;gap:10px;font-size:var(--t-2,11px);padding:4px 0;border-bottom:1px solid #ECEEF1;break-inside:avoid;counter-increment:dr}
  #printDoc.pl-year .pyr-dr li:before{content:counter(dr);flex:0 0 16px;color:#A2A8AE;font-weight:700;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-dr li b{flex:1 1 auto;min-width:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-dr li span{flex:0 0 auto;color:#3F454D;font-weight:600;font-variant-numeric:tabular-nums}
  #printDoc.pl-year .pyr-dr li em{flex:0 0 auto;font-style:normal;font-size:var(--t-1,10px);color:#A2A8AE}
  #printDoc.pl-year .pyr-msum{display:flex;gap:28px;align-items:flex-start;padding-bottom:12px;margin-bottom:10px;border-bottom:1px solid #E3E6EA;flex:0 0 auto}
  #printDoc.pl-year .pyr-msum>div b{display:block;font-size:var(--t-7,20px);font-weight:800;letter-spacing:-.02em;line-height:1.15;white-space:nowrap}
  #printDoc.pl-year .pyr-msum>div span{font-size:var(--t-1,10px);color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-msum .kinds{margin-left:auto;font-size:var(--t-2,11px);color:#3F454D}
  #printDoc.pl-year .pyr-msum .kinds p{margin:0 0 3px;font-weight:600}
  #printDoc.pl-year .pyr-msum .kinds u{text-decoration:none;display:inline-block;min-width:34px;color:#8A9099;font-weight:700}
  #printDoc.pl-year .pyr-mt td,#printDoc.pl-year .pyr-mt th{vertical-align:top;padding:6px 6px}
  #printDoc.pl-year .pyr-mt td.opp{width:190px}
  #printDoc.pl-year .pyr-mt td.opp b{display:block;font-weight:800}
  #printDoc.pl-year .pyr-mt small{font-size:var(--t-1,10px);color:#8A9099;font-weight:600}
  #printDoc.pl-year .pyr-mt td.opp small{display:block}
  #printDoc.pl-year .pyr-mt td.sc{width:70px}
  #printDoc.pl-year .pyr-mt td.sc u{text-decoration:none;font-weight:800;margin-left:3px}
  #printDoc.pl-year u.r-w{color:#2E9D6A} #printDoc.pl-year u.r-d{color:#8A9099} #printDoc.pl-year u.r-l{color:#C24A46}
  #printDoc.pl-year .pyr-mt td.notes{color:#3F454D;line-height:1.45}
  #printDoc.pl-year .pyr-mt td.notes p{margin:0 0 2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  #printDoc.pl-year .pyr-mt td.notes u{text-decoration:none;font-weight:700;margin-right:6px}
  #printDoc.pl-year .pyr-mt td.notes u.g{color:#2E9D6A} #printDoc.pl-year .pyr-mt td.notes u.b{color:#C24A46}
  #printDoc.pl-year .pen-l{display:block;height:16px;border-bottom:1px solid #DDE1E5}
  #printDoc.pl-year .pen-s{display:inline-block;width:44px;height:14px;border-bottom:1px solid #DDE1E5}
  #printDoc.pl-year .pyr-one{display:flex;align-items:flex-end;gap:12px;margin-bottom:16px;flex:0 0 auto}
  #printDoc.pl-year .pyr-one b{font-size:var(--t-5,14px);font-weight:800;white-space:nowrap}
  #printDoc.pl-year .pyr-one span{flex:1 1 auto;border-bottom:1px solid #C2C7CF;height:22px}
  #printDoc.pl-year .pyr-notes{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px 28px}
  #printDoc.pl-year .pyr-nb{display:flex;flex-direction:column;min-height:0}
  #printDoc.pl-year .pyr-nb h3{margin:0 0 4px}
  #printDoc.pl-year .pyr-nb .pfill{flex:1 1 auto}
  #printDoc.pl-year .pyr-plan td,#printDoc.pl-year .pyr-plan th{vertical-align:top;padding:6px 8px}
  #printDoc.pl-year .pyr-plan tbody th{width:96px}
  #printDoc.pl-year .pyr-plan tbody th small{display:block;margin-top:2px}
  #printDoc.pl-year .pyr-plan tbody th small span{display:inline-flex;align-items:center;gap:3px;font-size:var(--t-1,10px);color:#646A73;font-weight:600;margin-right:6px}
  #printDoc.pl-year .pyr-plan tbody th small i{width:7px;height:7px;border-radius:2px;display:inline-block}
  #printDoc.pl-year .pyr-plan td.goal{width:230px}
  #printDoc.pl-year .pyr-plan td.goal b{font-weight:700}
  #printDoc.pl-year .pyr-plan td.mt{width:300px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #printDoc.pl-year .pyr-plan td.mt b{font-weight:700;margin-right:6px}
  #printDoc.pl-year .pyr-plan td.mt small{font-size:var(--t-1,10px);color:#646A73}
  #printDoc.pl-year .pyr-plan td.focus .pen-l+.pen-l{margin-top:2px}
  #printDoc.pl-year .pyr-plan td.chk i{display:inline-block;width:14px;height:14px;border:1.5px solid #A2A8AE;border-radius:3px}
  #printDoc.pl-year .pyr-plan tr.past td,#printDoc.pl-year .pyr-plan tr.past th{opacity:.45}
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
  const first=`<div class="ponepage pyr-${plan?'plan':'review'}">${head}${band}<div class="pyr-body"><div class="pyr-grid">${cal}</div>`
    +`<div class="pyr-side">${side}</div></div>${legend}${yFoot()}</div>`;
  /* 3.073 — 뒷장: 돌아보기는 자세히, 계획은 월별 계획표. 쪽 번호는 다 지은 뒤 붙인다 */
  let rest=[]; try{ rest=plan?yearPlanPages(Y,t.name||''):yearReviewPages(Y,t.name||''); }catch(e){ try{console.error(e);}catch(_){} rest=[]; }
  const pages=[first].concat(rest);
  return pages.map((h,i)=>h.replace('@@PG@@',(i+1)+' / '+pages.length)).join('');
}

/* ══ 3.073 · 연간 PDF 뒷장 — 돌아보기는 자세히(여러 장), 계획은 월별 계획표 한 장 ══════════════════════
   사용자 «돌아보기는 구체적으로 · 몇 장이 되어도 좋으니 잘 돌아볼 수 있게 / 계획은 깔끔하게 잘 계획할 수 있게».
   장마다 크기를 정해 짓는다(행 수를 나눠 담는다) — 넘쳐서 잘리는 장이 없게. 장 머리 = 작은 맥락 줄(팀 · 문서) + 큰 장 이름.
   돌아보기: ② 달마다(표 + 주별 부하 흐름) ③ 훈련 내용(주제 × 달 · 자주 쓴 훈련) ④~ 경기 기록(요약 + 경기마다 결과 · 실행 · 리뷰) ⑤ 돌아보기 노트.
   계획: ② 월별 계획표(단계 · 목표 · 경기 · 훈련 중점 펜 줄 · 점검). 일정 · 경기 문서는 읽기만 한다. */
function yFoot(){ return pFooter().replace('</footer>','<span class="pyr-pg">@@PG@@</span></footer>'); }
function yPage(ctxLine,title,sub,body,cls){
  return `<div class="ponepage pyr-sub${cls?' '+cls:''}"><div class="pyr-head"><div class="pyr-tt"><div class="pyr-h0">${ctxLine}</div>`
    +`<div class="pyr-h1"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</div></div></div><div class="pyr-pbody">${body}</div>${yFoot()}</div>`;
}
/* 한 해의 날을 한 번만 읽는다 — 돌아보기는 오늘까지(지난 해는 1년) */
function yearCollect(Y,uptoToday){
  const today=new Date(); today.setHours(0,0,0,0);
  const days=[];
  for(let dt=new Date(Y,0,1);dt.getFullYear()===Y;dt.setDate(dt.getDate()+1)){
    const d=new Date(dt); if(uptoToday&&d>today)break;
    const n=offsetOfDate(d), r=Math.floor(n/7), col=((n%7)+7)%7;
    const raw=weeksMap[r]&&weeksMap[r][col], day=schedViewDay(raw), kind=yearDayKind(day);
    const ses=[]; if(kind==='t')(day.trainings||[]).filter(Boolean).forEach(tr=>{ let mi=0,rp=0; try{ mi=trMinutes(tr)||0; }catch(_){} try{ const L=getLoad(tr); rp=L&&!L.rec?(loadRpe(L)||0):0; }catch(_){} ses.push({min:mi,rpe:rp}); });
    days.push({dt:d,iso:yearQuickFormatIso(d),m:d.getMonth(),col:col,raw:raw,day:day,kind:kind,ses:ses,rpe:kind==='t'?yearDayTrainingRpe(day):null});
  }
  return days;
}
function yearMatchRows(days){
  const out=[];
  days.forEach(x=>{ if(x.kind!=='g')return; const day=x.day;
    let mk='official'; try{ mk=mMatchKind(day); }catch(_){}
    const list=[{opp:String((day.match&&day.match.opp)||(day.board&&day.board.opp)||'').trim(),kind:mk}]
      .concat(mxExtraList(day).map(a=>{ const L=mxExtraLabel(a); return {opp:L.o==='상대 미정'?'':L.o,kind:L.friendly?'friendly':'official'}; }));
    list.forEach(o=>{ let doc=null; try{ doc=wkbdMatchDoc(x.iso,o.opp); }catch(_){}
      const r={dt:x.dt,m:x.m,opp:o.opp||'상대 미정',kind:(doc&&(doc.kind==='friendly'||doc.kind==='cup'))?doc.kind:o.kind,doc:doc,res:'',gf:null,ga:null};
      const a=doc&&doc.scoreUs, b=doc&&doc.scoreThem;
      if(doc&&a!==''&&a!=null&&b!==''&&b!=null&&isFinite(+a)&&isFinite(+b)){ r.gf=+a; r.ga=+b; r.res=r.gf>r.ga?'w':(r.gf<r.ga?'l':'d'); }
      out.push(r); }); });
  return out;
}
function yRec(rows){ const o={n:rows.length,w:0,d:0,l:0,gf:0,ga:0,cs:0,rec:0}; rows.forEach(r=>{ if(!r.res)return; o.rec++; o[r.res]++; o.gf+=r.gf; o.ga+=r.ga; if(r.ga===0)o.cs++; }); return o; }
function yRecTxt(o){ return o.rec?`${o.w}승 ${o.d}무 ${o.l}패`:'—'; }
function yearReviewPages(Y,team){
  const E=wkbdEsc, today=new Date(); today.setHours(0,0,0,0);
  const days=yearCollect(Y,true); if(!days.length)return [];
  const ctxLine=`${team?E(team)+' · ':''}${Y} 연간 돌아보기`;
  const lastM=days[days.length-1].m, MS=[]; for(let m=0;m<=lastM;m++)MS.push(m);
  const matches=yearMatchRows(days), sp=spYear(Y);
  const pages=[];
  /* ── ② 달마다 ── */
  const band=r=>r===null?'u':(r<=3?'l':(r<=6?'m':'h'));
  const rows=MS.map(m=>{
    const ds=days.filter(x=>x.m===m), tr=ds.filter(x=>x.kind==='t'), ses=tr.reduce((a,x)=>a+(x.ses.length||1),0);
    const min=tr.reduce((a,x)=>a+x.ses.reduce((b,s)=>b+s.min,0),0), rp=[].concat(...tr.map(x=>x.ses.map(s=>s.rpe).filter(Boolean)));
    const ib={l:0,m:0,h:0,u:0}; tr.forEach(x=>ib[band(x.rpe)]++);
    const mr=matches.filter(r=>r.m===m), rec=yRec(mr);
    let top=''; try{ const mix=daysTopicCount(ds.map(x=>x.raw).filter(Boolean)); top=mix.order.map(k=>[k,mix.b[k]||0]).filter(k=>k[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,2).map(k=>k[0]).join(' · '); }catch(_){}
    return {m:m,ses:ses,trd:tr.length,min:min,avg:rp.length?Math.round(rp.reduce((a,b)=>a+b,0)/rp.length*10)/10:null,ib:ib,off:ds.filter(x=>x.kind==='o').length,g:mr.length,rec:rec,top:top,goal:sp.goals[m+1]||''};
  });
  const T=rows.reduce((a,r)=>{ a.ses+=r.ses; a.trd+=r.trd; a.min+=r.min; a.off+=r.off; a.g+=r.g; ['l','m','h','u'].forEach(k=>a.ib[k]+=r.ib[k]); return a; },{ses:0,trd:0,min:0,off:0,g:0,ib:{l:0,m:0,h:0,u:0}});
  const allR=[].concat(...days.filter(x=>x.kind==='t').map(x=>x.ses.map(s=>s.rpe).filter(Boolean))), tRec=yRec(matches);
  const ibBar=ib=>{ const n=ib.l+ib.m+ib.h+ib.u; if(!n)return '<span class="pyr-ib none">—</span>';
    return `<span class="pyr-ib">${['l','m','h','u'].map(k=>ib[k]?`<i class="${k}" style="flex:${ib[k]}"></i>`:'').join('')}</span><span class="pyr-ibn">${ib.l}·${ib.m}·${ib.h}${ib.u?` <small>(${ib.u})</small>`:''}</span>`; };
  const hrs=v=>v?(Math.round(v/6)/10):'—';
  const trow=r=>`<tr${(r.ses||r.g)?'':' class="quiet"'}><th>${r.m+1}월</th><td>${r.ses||'—'}</td><td>${r.trd||'—'}</td><td>${hrs(r.min)}</td><td>${r.avg!=null?r.avg:'—'}</td><td class="ibc">${ibBar(r.ib)}</td><td>${r.off||'—'}</td><td>${r.g||'—'}</td><td>${yRecTxt(r.rec)}</td><td>${r.rec.rec?`${r.rec.gf}–${r.rec.ga}`:'—'}</td><td class="txt">${E(r.top)||'—'}</td><td class="txt goal">${E(r.goal)}</td></tr>`;
  const table=`<table class="pyr-tbl"><thead><tr><th>달</th><th>세션</th><th>훈련일</th><th>시간</th><th>평균 RPE</th><th class="ibc">강도 저·중·고 <small>(미입력)</small></th><th>휴식</th><th>경기</th><th>전적</th><th>득–실</th><th class="txt">많이 한 주제</th><th class="txt">그 달 목표</th></tr></thead>`
    +`<tbody>${rows.map(trow).join('')}</tbody><tfoot><tr><th>합계</th><td>${T.ses}</td><td>${T.trd}</td><td>${hrs(T.min)}</td><td>${allR.length?Math.round(allR.reduce((a,b)=>a+b,0)/allR.length*10)/10:'—'}</td><td class="ibc">${ibBar(T.ib)}</td><td>${T.off}</td><td>${T.g}</td><td>${yRecTxt(tRec)}</td><td>${tRec.rec?`${tRec.gf}–${tRec.ga}`:'—'}</td><td class="txt"></td><td class="txt"></td></tr></tfoot></table>`;
  /* 주별 부하 흐름 — 주(월요일 시작)마다 RPE × 분 */
  const wk=[]; days.forEach(x=>{ const mon=new Date(x.dt); mon.setDate(mon.getDate()-x.col); const k=yearQuickFormatIso(mon);
    let w=wk[wk.length-1]; if(!w||w.k!==k){ w={k:k,mon:mon,load:0,g:0}; wk.push(w); }
    x.ses.forEach(s=>{ if(s.rpe&&s.min)w.load+=s.rpe*s.min; }); if(x.kind==='g')w.g++; });
  const wmax=Math.max(1,...wk.map(w=>w.load)), avgL=wk.length?wk.reduce((a,w)=>a+w.load,0)/wk.length:0;
  const wbars=wk.map(w=>`<div class="pyr-wc${w.load>avgL*1.3?' hi':''}" title="${w.mon.getMonth()+1}.${w.mon.getDate()}"><i style="height:${w.load/wmax*100}%"></i>${w.g?'<b></b>':''}</div>`).join('');
  const wticks=MS.map(m=>{ const f=new Date(Y,m,1), i=wk.findIndex(w=>w.mon<=f&&f<new Date(w.mon.getTime()+7*864e5)); return i<0?'':`<span style="left:${i/Math.max(1,wk.length)*100}%">${m+1}월</span>`; }).join('');
  const weekly=`<h3>주별 부하 흐름 <em>주마다 RPE × 분 · 진한 막대 = 평균보다 30% 넘게 높은 주 · 아래 점 = 경기 있는 주</em></h3><div class="pyr-wk">${wbars}</div><div class="pyr-wkt">${wticks}</div>`;
  pages.push(yPage(ctxLine,'달마다 돌아보기',`${Y}.1.1 – ${days[days.length-1].dt.getMonth()+1}.${days[days.length-1].dt.getDate()}`,table+weekly));
  /* ── ③ 훈련 내용 ── */
  const yMix=(()=>{ try{ return daysTopicCount(days.map(x=>x.raw).filter(Boolean)); }catch(_){ return {order:[],b:{},colOf:{}}; } })();
  const topics=yMix.order.filter(k=>(yMix.b[k]||0)>0).sort((a,b)=>(yMix.b[b]||0)-(yMix.b[a]||0)).slice(0,10);
  const per=MS.map(m=>{ try{ return daysTopicCount(days.filter(x=>x.m===m).map(x=>x.raw).filter(Boolean)).b; }catch(_){ return {}; } });
  const tTot=topics.reduce((a,k)=>a+(yMix.b[k]||0),0)||1, cmax=Math.max(1,...per.map(b=>Math.max(0,...topics.map(k=>b[k]||0))));
  const heat=topics.length?`<table class="pyr-tbl pyr-heat"><thead><tr><th class="txt">주제</th>${MS.map(m=>`<th>${m+1}월</th>`).join('')}<th>합계</th><th>비율</th></tr></thead><tbody>`
    +topics.map(k=>`<tr><th class="txt"><i style="background:${yMix.colOf[k]||'#8A9099'}"></i>${E(k)}</th>${per.map(b=>{ const v=b[k]||0; return `<td${v?` style="background:rgba(58,109,240,${(0.08+v/cmax*0.5).toFixed(2)})"`:''}>${v||''}</td>`; }).join('')}<td><b>${yMix.b[k]}</b></td><td>${Math.round(yMix.b[k]/tTot*100)}%</td></tr>`).join('')
    +`</tbody></table>`:'<div class="pyr-none">세션에 고른 주제가 없어요</div>';
  const dr={}; days.forEach(x=>{ if(x.kind!=='t')return; let b=null; try{ b=dayBoard(x.day); }catch(_){} if(!b)return;
    (b.trains||[]).forEach((v,i)=>{ const nm=String(v==null?'':v).trim(); if(!nm)return; const d=(b.trainData||[])[i]||{}; const mi=(parseInt(d.minutes,10)||0)*Math.max(1,parseInt(d.sets,10)||1);
      const o=dr[nm]||(dr[nm]={n:0,min:0,last:null}); o.n++; o.min+=mi; o.last=x.dt; }); });
  const drills=Object.keys(dr).map(k=>[k,dr[k]]).sort((a,b)=>b[1].n-a[1].n||b[1].min-a[1].min).slice(0,16);
  const dlist=drills.length?`<ol class="pyr-dr">${drills.map(d=>`<li><b>${E(d[0])}</b><span>${d[1].n}회${d[1].min?` · ${d[1].min}분`:''}</span><em>마지막 ${d[1].last.getMonth()+1}.${d[1].last.getDate()}</em></li>`).join('')}</ol>`:'<div class="pyr-none">훈련 칩(작전판 · 보관함 훈련)을 넣은 날이 없어요</div>';
  pages.push(yPage(ctxLine,'훈련 내용',`세션 ${T.ses} · ${hrs(T.min)}시간`,`<h3>달마다 고른 주제 <em>세션 수 · 진할수록 많이</em></h3>${heat}<h3>자주 쓴 훈련 <em>횟수 순 · 일정에 넣은 훈련 이름 기준</em></h3>${dlist}`));
  /* ── ④~ 경기 기록 ── */
  const kinds=['official','cup','friendly'].map(k=>[k,yRec(matches.filter(r=>r.kind===k))]).filter(k=>k[1].n);
  const ha=k=>yRec(matches.filter(r=>r.doc&&String(r.doc.homeAway||'')===k));
  const ex=matches.map(r=>+(r.doc&&r.doc.execution)||0).filter(v=>v>0);
  const sumBox=`<div class="pyr-msum">`
    +`<div><b>${yRecTxt(tRec)}</b><span>전체 ${matches.length}경기${tRec.rec<matches.length?` · 결과 적은 경기 ${tRec.rec}`:''}</span></div>`
    +`<div><b>${tRec.rec?`${tRec.gf} – ${tRec.ga}`:'—'}</b><span>득점 – 실점${tRec.rec?` · 경기당 ${(tRec.gf/tRec.rec).toFixed(1)} – ${(tRec.ga/tRec.rec).toFixed(1)}`:''}</span></div>`
    +`<div><b>${tRec.cs}</b><span>무실점 경기</span></div>`
    +`<div><b>${ex.length?(Math.round(ex.reduce((a,b)=>a+b,0)/ex.length*10)/10)+' / 5':'—'}</b><span>평균 실행도${ex.length?` · ${ex.length}경기`:''}</span></div>`
    +`<div class="kinds">${kinds.map(k=>`<p><u>${M_KIND_LB[k[0]]}</u>${k[1].n}경기 · ${yRecTxt(k[1])}${k[1].rec?` · ${k[1].gf}–${k[1].ga}`:''}</p>`).join('')}`
    +[['home','홈'],['away','원정']].map(h=>{ const o=ha(h[0]); return o.n?`<p><u>${h[1]}</u>${o.n}경기 · ${yRecTxt(o)}</p>`:''; }).join('')+`</div></div>`;
  const R={w:'승',d:'무',l:'패'}, HA={home:'홈',away:'원정',neutral:'중립'};
  const cut=(s,n)=>{ s=String(s||'').replace(/\s+/g,' ').trim(); return s.length>n?s.slice(0,n-1)+'…':s; };
  const mrow=r=>{ const d=r.doc||{}; const where=[HA[d.homeAway]||'',String(d.venue||'').trim()].filter(Boolean).join(' · ');
    const notes=[d.resultSummary?`<p>${E(cut(d.resultSummary,90))}</p>`:'',d.reviewGood?`<p><u class="g">잘된 점</u>${E(cut(d.reviewGood,80))}</p>`:'',d.reviewImprove?`<p><u class="b">바꿀 점</u>${E(cut(d.reviewImprove,80))}</p>`:''].join('');
    return `<tr><th>${r.dt.getMonth()+1}.${r.dt.getDate()} <small>${WDAYS[(r.dt.getDay()+6)%7]}</small></th>`
      +`<td class="txt opp"><b>${E(r.opp)}</b><small>${E([M_KIND_LB[r.kind]||'',String(d.competition||'').trim(),where].filter(Boolean).join(' · '))}</small></td>`
      +`<td class="sc">${r.res?`<b>${r.gf}:${r.ga}</b> <u class="r-${r.res}">${R[r.res]}</u>`:'<span class="pen-s"></span>'}</td>`
      +`<td>${+d.execution>0?`${+d.execution}<small>/5</small>`:'—'}</td><td class="txt notes">${notes||'<span class="pen-l"></span>'}</td></tr>`; };
  const mhead=`<thead><tr><th>날짜</th><th class="txt">상대 · 구분 · 장소</th><th>결과</th><th>실행</th><th class="txt">경기 요약 · 리뷰</th></tr></thead>`;
  if(matches.length){
    const FIRST=7, NEXT=10; let i=0, k=0;
    while(i<matches.length){ const n=k?NEXT:FIRST, part=matches.slice(i,i+n);
      pages.push(yPage(ctxLine,'경기 기록',k?`계속 · ${i+1}–${i+part.length} / ${matches.length}`:`${matches.length}경기`,(k?'':sumBox)+`<table class="pyr-tbl pyr-mt">${mhead}<tbody>${part.map(mrow).join('')}</tbody></table>`));
      i+=n; k++; }
  }
  /* ── ⑤ 돌아보기 노트 ── */
  const box=(t,h)=>`<div class="pyr-nb"><h3>${t}${h?` <em>${h}</em>`:''}</h3><div class="pfill"></div></div>`;
  pages.push(yPage(ctxLine,'돌아보기 노트','',`<div class="pyr-one"><b>한 해를 한 줄로</b><span></span></div><div class="pyr-notes">`
    +box('잘된 점','계속 가져갈 것')+box('아쉬운 점','왜 그랬나')+box('선수 성장','눈에 띈 선수 · IDP')+box('내년에 바꿀 것','훈련 · 경기 · 운영')+`</div>`));
  return pages;
}
function yearPlanPages(Y,team){
  const E=wkbdEsc, today=new Date(); today.setHours(0,0,0,0);
  const sp=spYear(Y), days=yearCollect(Y,false), matches=yearMatchRows(days);
  const ctxLine=`${team?E(team)+' · ':''}${Y} 연간 계획`;
  const rows=[0,1,2,3,4,5,6,7,8,9,10,11].map(m=>{
    const first=new Date(Y,m,1), last=new Date(Y,m+1,0), past=last<today;
    const phs=sp.phases.filter(p=>p.start<=yearQuickFormatIso(last)&&p.end>=yearQuickFormatIso(first));
    const mm=matches.filter(r=>r.m===m), tr=days.filter(x=>x.m===m&&x.kind==='t').length;
    const ml=mm.slice(0,2).map(r=>`${r.dt.getDate()}일 ${E(r.opp)}`).join(' · ')+(mm.length>2?` 외 ${mm.length-2}`:'');   /* 한 줄 — 표가 한 장에 남게 */
    return `<tr${past?' class="past"':''}><th>${m+1}월${phs.length?`<small>${phs.map(p=>`<span><i style="background:${p.color}"></i>${E(p.name)}</span>`).join('')}</small>`:''}</th>`
      +`<td class="txt goal">${sp.goals[m+1]?`<b>${E(sp.goals[m+1])}</b>`:'<span class="pen-l"></span>'}</td>`
      +`<td class="txt mt">${mm.length?`<b>${mm.length}경기</b><small>${ml}</small>`:'<small>—</small>'}</td>`
      +`<td>${tr||'—'}</td><td class="txt focus"><span class="pen-l"></span><span class="pen-l"></span></td><td class="chk"><i></i></td></tr>`; }).join('');
  const tbl=`<table class="pyr-tbl pyr-plan"><thead><tr><th>달 · 단계</th><th class="txt">목표</th><th class="txt">경기</th><th>훈련일</th><th class="txt">훈련 중점 · 할 일</th><th>점검</th></tr></thead><tbody>${rows}</tbody></table>`;
  return [yPage(ctxLine,'월별 계획표','달마다 목표 · 경기 · 훈련 중점을 적어 두고, 끝나면 점검',tbl)];
}
