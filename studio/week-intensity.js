/* 3.332 — 주간 «이번 주 요약»의 강도 막대(문서 저장소 목업 `UI-주간-강도-그래프-목업-2026-11-19.html` A안).
   세션에 적은 RPE 만 그린다(앱은 거울 — 권장 띠 없음). 경기가 잡힌 주는 가로축이 MD, 없는 주는 요일.
   model · html 은 순수 셈(단위 시험), 아래 mount 가 process.html 끝에서 읽혀 `renderMix` 를 감싸고
   «주제 배분» 범례 뒤에 한 구획을 붙인다. 날은 요약 · 주제 배분과 같은 «지금 보기(조)로 본 하루»(schedViewDay)다.
   저장하는 것 없음. process.html 은 <script> 한 줄(크기 예산). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSWeekIntensity=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function rpe(n){n=Number(n);return Number.isFinite(n)&&n>=1&&n<=10?n:0;}
  function band(n){return n<=4?'lo':n<=6?'mid':'hi';}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function one(n){return (Math.round(n*10)/10).toFixed(1);}

  /* days: [{d, md, today, kind:'OFF'|'훈련'|'', sessions:[{rpe,rec,min}], match:{rpe,min}|null}] */
  function model(days){
    var sum=0,cnt=0,top=null,any=false,hasMatch=false;
    var cols=(days||[]).map(function(day){
      day=day||{};
      var bars=[],mins=0,peak=0,trainPeak=0,ses=(day.sessions||[]);
      ses.forEach(function(s){
        mins+=Math.max(0,Math.round(+s.min||0));
        if(s.rec){bars.push({k:'rec',h:10});return;}
        var r=rpe(s.rpe);if(!r)return;
        bars.push({k:band(r),h:r*10});
        sum+=r;cnt++;if(r>trainPeak)trainPeak=r;if(r>peak)peak=r;
      });
      var mr=0;
      if(day.match){
        mr=rpe(day.match.rpe);mins+=Math.max(0,Math.round(+day.match.min||0));hasMatch=true;
        if(mr){bars.push({k:'mt',h:mr*10});if(mr>peak)peak=mr;}
      }
      if(bars.length)any=true;
      var md=String(day.md||''),d=String(day.d||'');
      if(trainPeak&&(!top||trainPeak>top.v))top={v:trainPeak,label:md||d};
      var cap=mins?(mins+'′'):((ses.length||day.match)?'–':(day.kind==='OFF'?'OFF':day.kind==='훈련'?'계획만':''));
      return {d:d,md:md,today:!!day.today,bars:bars,h:peak?peak*10:(bars.length?10:0),rec:!peak&&bars.length>0,val:peak?String(peak):'',cap:cap,
        tone:!bars.length?'none':(mr&&mr===peak&&!trainPeak?'mt':'')};
    });
    return {cols:cols,mdMode:cols.some(function(c){return !!c.md;}),any:any,hasMatch:hasMatch,avg:cnt?one(sum/cnt):'',top:top?top.label:''};
  }

  function html(m){
    if(!m||!m.any)return '<span class="mempty">세션에 강도를 적으면 여기 막대가 채워져요</span>';
    var said=[];
    var cols=m.cols.map(function(c){
      var bars=c.bars.map(function(b){return '<i class="wki-bar '+b.k+'" style="height:'+b.h+'%"></i>';}).join('');
      said.push((c.md?c.md+' ':'')+c.d+' '+(c.val||(c.rec?'회복':'–')));
      var at=' style="bottom:'+c.h+'%">';
      var v=c.val?'<span class="wki-v"'+at+esc(c.val)+'</span>':(c.rec?'<span class="wki-v rec"'+at+'회복</span>':'');
      return '<div class="wki-col'+(c.tone?' '+c.tone:'')+(c.today?' today':'')+'">'
        +'<div class="wki-plot"><div class="wki-bars">'+bars+v+'</div></div>'
        +(m.mdMode?'<div class="wki-md'+(c.md==='MD'?' is-md':'')+'">'+(esc(c.md)||'&nbsp;')+'</div>':'')
        +'<div class="wki-d">'+esc(c.d)+'</div><div class="wki-cap">'+(esc(c.cap)||'&nbsp;')+'</div></div>';
    }).join('');
    var stat='';
    if(m.avg)stat+='<span>훈련 평균</span> <b>'+m.avg+'</b>';
    if(m.top)stat+=(stat?' · ':'')+'<span>가장 높은 날</span> <b>'+esc(m.top)+'</b>';
    var leg='<span><i class="lo"></i>낮음 1–4</span><span><i class="mid"></i>보통 5–6</span><span><i class="hi"></i>높음 7–10</span>';
    if(m.hasMatch)leg+='<span><i class="mt"></i>경기</span>';
    return (stat?'<div class="wki-stat">'+stat+'</div>':'')
      +'<div class="wki-grid" role="img" aria-label="'+esc(said.join(', '))+'">'+cols+'</div>'
      +'<div class="wki-leg">'+leg+'</div>';
  }

  /* 글자 12 · 14 · 16 / 굵기 500 · 600 · 700 / 모서리 6 · 999. 색은 뜻으로만: 낮음 · 보통 · 높음(기존 강도 색) · 경기. */
  var CSS='.wki-sec{margin-top:18px}.sumcard .legend+.wki-sec{margin-top:0}'
    +'.wki{position:relative}'
    +'.wki-stat{font-size:12px;font-weight:500;color:var(--text-2);margin:-4px 0 10px;font-variant-numeric:tabular-nums}'
    +'.wki-stat b{font-weight:700;color:var(--text)}'
    +'.wki-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}'
    +'.wki-col{display:flex;flex-direction:column;align-items:center;min-width:0}'
    +'.wki-plot{height:112px;width:100%;display:flex;align-items:flex-end;border-bottom:1px solid var(--line)}'
    +'.wki-bars{position:relative;height:88px;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px;'
    +'background:linear-gradient(var(--line-soft,var(--line)),var(--line-soft,var(--line))) 0 50%/100% 1px no-repeat}'
    +'.wki-v{position:absolute;left:0;right:0;text-align:center;padding-bottom:2px;font-size:16px;font-weight:700;line-height:20px;color:var(--text);font-variant-numeric:tabular-nums}'
    +'.wki-v.rec{font-size:12px;font-weight:600;color:var(--text-2)}'
    +'.wki-bar{display:block;flex:0 1 44px;min-width:0;max-width:62%;border-radius:6px 6px 0 0}'
    +'.wki-bar.lo,.wki-bar.rec,.wki-leg i.lo{background:#5E8FA8}.wki-bar.mid,.wki-leg i.mid{background:#6FB5C1}'
    +'.wki-bar.hi,.wki-leg i.hi{background:#B5762B}.wki-bar.mt,.wki-leg i.mt{background:var(--match,#C24A46)}'
    +'.wki-col.mt .wki-v{color:var(--match,#C24A46)}'
    +'.wki-col.none .wki-bars::after{content:"";width:62%;max-width:44px;border-top:2px dashed var(--line);margin-bottom:-1px}'
    +'.wki-md{margin-top:8px;font-size:14px;font-weight:700;line-height:20px;letter-spacing:-.01em;white-space:nowrap;color:var(--text)}'
    +'.wki-md.is-md{color:#fff;background:var(--match,#C24A46);border-radius:999px;padding:0 8px}'
    +'.wki-d{margin-top:8px;font-size:14px;font-weight:600;line-height:18px;color:var(--text);white-space:nowrap}'
    +'.wki-md+.wki-d{margin-top:2px;font-size:12px;font-weight:500;color:var(--text-3)}'
    +'.wki-col.today .wki-d{font-weight:700;color:var(--text);text-decoration:underline;text-underline-offset:3px}'
    +'.wki-cap{font-size:12px;font-weight:500;line-height:16px;color:var(--text-3);white-space:nowrap;font-variant-numeric:tabular-nums}'
    +'.wki-col.none .wki-md:not(.is-md),.wki-col.none:not(.today) .wki-d{color:var(--text-3)}'
    +'.wki-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:12px;font-size:12px;font-weight:500;color:var(--text-2)}'
    +'.wki-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}'
    +'@media (max-width:600px){.wki-grid{gap:3px}.wki-plot{height:96px}.wki-bars{height:72px}'
    +'.wki-md{font-size:12px;letter-spacing:-.03em}.wki-md.is-md{padding:0 6px}.wki-d{font-size:12px}.wki-bar{max-width:70%}}';

  function mount(win){
    var doc=win.document;
    if(!doc||!doc.getElementById||typeof win.renderMix!=='function')return;
    function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    /* 페이지 전역(let · const 포함)은 이름으로 읽는다 — window 속성이 아니다. */
    function gather(){
      /* global week, wk, schedViewDay, schedSesActive, schedMatchVis, getLoad, loadRpe, trMinutes, wkDayYmd, MATCH_RPE, MATCH_MIN */
      var W=(typeof week!=='undefined'&&week)||[],now=ymd(new Date());
      return W.map(function(raw,i){
        if(!raw)return {};
        var day=schedViewDay(raw)||raw,bd=day.board||{};
        var ses=(day.trainings||[]).filter(function(tr){return schedSesActive(tr,raw);}).map(function(tr){
          var L=getLoad(tr);return {rpe:loadRpe(L),rec:!!(L&&L.rec),min:trMinutes(tr,day)};});
        var m=day.match&&schedMatchVis(day.match,raw)
          ?{rpe:day.match.rpe!=null?day.match.rpe:MATCH_RPE,min:day.match.min!=null?day.match.min:MATCH_MIN}:null;
        return {d:day.d||raw.d,md:day.md||raw.md||'',today:wkDayYmd(wk,i)===now,
          kind:(bd.sched==='OFF'||day.off)?'OFF':(bd.sched==='훈련'?'훈련':''),sessions:ses,match:m};
      });
    }
    function host(){
      var el=doc.getElementById('wkiHost');if(el)return el;
      var leg=doc.getElementById('mixLegend');if(!leg||!leg.parentNode)return null;
      if(!doc.getElementById('ps-wki-css')){var st=doc.createElement('style');st.id='ps-wki-css';st.textContent=CSS;doc.head.appendChild(st);}
      var sec=doc.createElement('div');sec.className='sumsec wki-sec';
      sec.innerHTML='강도 <em id="wkiSub"></em>';
      el=doc.createElement('div');el.className='wki';el.id='wkiHost';
      leg.parentNode.insertBefore(sec,leg.nextSibling);sec.parentNode.insertBefore(el,sec.nextSibling);
      return el;
    }
    function paint(){
      var el=host();if(!el)return;
      try{
        var m=model(gather()),sub=doc.getElementById('wkiSub');
        if(sub)sub.textContent=m.mdMode?'세션 RPE · 경기 기준(MD)':'세션 RPE';
        el.innerHTML=html(m);
      }catch(e){ if(win.console)win.console.warn('[week-intensity]',e); }
    }
    var orig=win.renderMix;
    win.renderMix=function(){var r=orig.apply(this,arguments);paint();return r;};
    paint();
  }
  return {model:model,html:html,mount:mount};
});
