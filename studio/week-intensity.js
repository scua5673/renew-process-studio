/* 3.332 — 주간 «이번 주 요약»의 강도 막대 → 3.337 부하 막대(문서 저장소 목업 `UI-주간-부하-색-목업-2026-11-19.html` A안).
   막대의 높이도 색도 부하(세션 RPE × 분) — 클수록 붉다. 적힌 것만 그린다(앱은 거울 — 권장 띠 없음). 경기가 잡힌 주는 가로축이 MD, 없는 주는 요일.
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
  /* 부하 네 칸을 가르는 숫자 — 임시 값(목업 «먼저 정할 것» 둘째). 팀 기준으로 바꿀 때 이 한 줄만 고친다. */
  var CUTS=[300,500,700],AXIS=1000;
  function band(v){return v<CUTS[0]?1:v<CUTS[1]?2:v<CUTS[2]?3:4;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+$)/g,',');}

  /* days: [{d, md, today, kind:'OFF'|'훈련'|'', sessions:[{rpe,rec,min}], match:{rpe,min}|null}]
     부하 = RPE × 분(회복은 분 × 0.3 — process.html sessionLoadMin 과 같은 셈). RPE 나 분이 빈 세션은 세지 않고 «빈 세션»으로 남긴다. */
  function model(days){
    var total=0,empty=0,top=null,any=false,peak=0;
    var cols=(days||[]).map(function(day){
      day=day||{};
      var segs=[],mins=0,rmax=0,hole=0,recOnly=true,ses=(day.sessions||[]).slice(),n=ses.length+(day.match?1:0);
      if(day.match)ses.push({rpe:day.match.rpe,min:day.match.min});
      ses.forEach(function(s){
        var m=Math.max(0,Math.round(+s.min||0)),r=s.rec?0:rpe(s.rpe);mins+=m;
        if(!s.rec)recOnly=false;
        if(r>rmax)rmax=r;
        var v=s.rec?Math.round(m*0.3):r*m;
        if(v>0)segs.push(v);else hole++;
      });
      var load=segs.reduce(function(a,b){return a+b;},0);
      total+=load;empty+=hole;if(n)any=true;if(load>peak)peak=load;
      var md=String(day.md||''),d=String(day.d||'');
      if(load&&(!top||load>top.v))top={v:load,label:md||d};
      var cap=n?[(recOnly?'회복':'RPE '+(rmax||'–')),(mins?mins+'′':'분 –')]:[(day.kind==='OFF'?'OFF':day.kind==='훈련'?'계획만':'')];
      return {d:d,md:md,today:!!day.today,segs:segs,load:load,k:load?band(load):0,hole:hole,val:load?num(load):(hole?'?':''),cap:cap,
        tone:n?(load?'':'hole'):'none'};
    });
    var axis=Math.max(AXIS,peak);
    cols.forEach(function(c){c.h=c.load?Math.max(4,Math.round(c.load/axis*100)):(c.hole?40:0);});
    return {cols:cols,mdMode:cols.some(function(c){return !!c.md;}),any:any,total:total,empty:empty,top:top?top.label:''};
  }

  function html(m){
    if(!m||!m.any)return '<span class="mempty">세션에 강도와 시간을 적으면 여기 부하 막대가 채워져요</span>';
    var said=[];
    var cols=m.cols.map(function(c){
      var bar='';
      if(c.load)bar='<div class="wki-bar k'+c.k+'" style="height:'+c.h+'%">'+c.segs.map(function(v){return '<i style="flex:'+v+' 0 0"></i>';}).join('')+'</div>';
      else if(c.hole)bar='<div class="wki-bar hole" style="height:'+c.h+'%"></div>';
      said.push((c.md?c.md+' ':'')+c.d+' '+(c.load?'부하 '+c.val:(c.hole?'빈 세션':'–')));
      var v=c.val?'<span class="wki-v'+(c.load?'':' q')+'" style="bottom:'+c.h+'%">'+esc(c.val)+'</span>':'';
      return '<div class="wki-col'+(c.tone?' '+c.tone:'')+(c.today?' today':'')+'">'
        +'<div class="wki-plot"><div class="wki-bars">'+bar+v+'</div></div>'
        +(m.mdMode?'<div class="wki-md'+(c.md==='MD'?' is-md':'')+'">'+(esc(c.md)||'&nbsp;')+'</div>':'')
        +'<div class="wki-d">'+esc(c.d)+'</div><div class="wki-cap">'+c.cap.map(function(t){return '<span>'+(esc(t)||'&nbsp;')+'</span>';}).join('')+'</div></div>';
    }).join('');
    var stat='<span>주간 부하</span> <b>'+num(m.total)+'</b>';
    if(m.empty)stat+=' · <span>빈 세션</span> <b>'+m.empty+'</b>';
    if(m.top)stat+=' · <span>가장 높은 날</span> <b>'+esc(m.top)+'</b>';
    var leg='<span><i class="k1"></i>낮음 ~'+(CUTS[0]-1)+'</span><span><i class="k2"></i>보통 '+CUTS[0]+'–'+(CUTS[1]-1)+'</span>'
      +'<span><i class="k3"></i>높음 '+CUTS[1]+'–'+(CUTS[2]-1)+'</span><span><i class="k4"></i>매우 높음 '+CUTS[2]+'+</span>';
    if(m.empty)leg+='<span><i class="hole"></i>RPE나 시간이 빈 세션</span>';
    return '<div class="wki-stat">'+stat+'</div>'
      +'<div class="wki-grid" role="img" aria-label="'+esc(said.join(', '))+'">'+cols+'</div>'
      +'<div class="wki-leg">'+leg+'</div>';
  }

  /* 글자 12 · 14 · 16 / 굵기 500 · 600 · 700 / 모서리 6 · 999. 색은 뜻 하나: 부하가 클수록 붉다(네 칸 — 연속 그라데이션은 옆 칸과 구별이 안 된다, 2.909).
     경기도 부하로 같이 잰다 — 경기일은 «MD» 알약(글자색 바탕)이 알린다. */
  var CSS='.wki-sec{margin-top:18px}.sumcard .legend+.wki-sec{margin-top:0}'
    +'.wki{position:relative;--wk1:#E8D5C8;--wk2:#E3A98C;--wk3:#D46A4F;--wk4:#B4231C;--wkh:#B9BEC6}'
    +'body.fmdark .wki{--wk1:#4D4039;--wk2:#8C5F4D;--wk3:#C9674F;--wk4:#F0503F;--wkh:#5A616B}'
    +'.wki-stat{font-size:12px;font-weight:500;color:var(--text-2);margin:-4px 0 10px;font-variant-numeric:tabular-nums}'
    +'.wki-stat b{font-weight:700;color:var(--text)}'
    +'.wki-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}'
    +'.wki-col{display:flex;flex-direction:column;align-items:center;min-width:0}'
    +'.wki-plot{height:132px;width:100%;display:flex;align-items:flex-end;border-bottom:1px solid var(--line)}'
    +'.wki-bars{position:relative;height:108px;width:100%;display:flex;align-items:flex-end;justify-content:center;'
    +'background:linear-gradient(var(--line-soft,var(--line)),var(--line-soft,var(--line))) 0 50%/100% 1px no-repeat}'
    +'.wki-v{position:absolute;left:0;right:0;text-align:center;padding-bottom:2px;font-size:16px;font-weight:700;line-height:20px;letter-spacing:-.02em;color:var(--text);font-variant-numeric:tabular-nums}'
    +'.wki-v.q{font-size:12px;font-weight:600;color:var(--text-2)}'
    +'.wki-bar{display:flex;flex-direction:column-reverse;gap:2px;width:62%;max-width:44px;min-width:0;border-radius:6px 6px 0 0;overflow:hidden}'
    +'.wki-bar i{display:block;min-height:0}'
    +'.wki-bar.k1 i,.wki-leg i.k1{background:var(--wk1)}.wki-bar.k2 i,.wki-leg i.k2{background:var(--wk2)}'
    +'.wki-bar.k3 i,.wki-leg i.k3{background:var(--wk3)}.wki-bar.k4 i,.wki-leg i.k4{background:var(--wk4)}'
    +'.wki-bar.hole{border:2px dashed var(--wkh);border-bottom:0}.wki-leg i.hole{border:1.5px dashed var(--wkh)}'
    +'.wki-col.none .wki-bars::after{content:"";width:62%;max-width:44px;border-top:2px dashed var(--line);margin-bottom:-1px}'
    +'.wki-md{margin-top:8px;font-size:14px;font-weight:700;line-height:20px;letter-spacing:-.01em;white-space:nowrap;color:var(--text)}'
    +'.wki-md.is-md{color:var(--surface,#fff);background:var(--text);border-radius:999px;padding:0 8px}'
    +'.wki-d{margin-top:8px;font-size:14px;font-weight:600;line-height:18px;color:var(--text);white-space:nowrap}'
    +'.wki-md+.wki-d{margin-top:2px;font-size:12px;font-weight:500;color:var(--text-3)}'
    +'.wki-col.today .wki-d{font-weight:700;color:var(--text);text-decoration:underline;text-underline-offset:3px}'
    +'.wki-cap{font-size:12px;font-weight:500;line-height:16px;color:var(--text-3);white-space:nowrap;text-align:center;font-variant-numeric:tabular-nums}'
    +'.wki-cap span{display:block}'
    +'.wki-col.none .wki-md:not(.is-md),.wki-col.none:not(.today) .wki-d{color:var(--text-3)}'
    +'.wki-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:12px;font-size:12px;font-weight:500;color:var(--text-2);font-variant-numeric:tabular-nums}'
    +'.wki-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}'
    +'@media (max-width:600px){.wki-grid{gap:3px}.wki-plot{height:116px}.wki-bars{height:92px}.wki-v{font-size:14px;letter-spacing:-.03em}'
    +'.wki-md{font-size:12px;letter-spacing:-.03em}.wki-md.is-md{padding:0 6px}.wki-d{font-size:12px}.wki-bar{width:70%}}';

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
      sec.innerHTML='부하 <em id="wkiSub"></em>';
      el=doc.createElement('div');el.className='wki';el.id='wkiHost';
      leg.parentNode.insertBefore(sec,leg.nextSibling);sec.parentNode.insertBefore(el,sec.nextSibling);
      return el;
    }
    function paint(){
      var el=host();if(!el)return;
      try{
        var m=model(gather()),sub=doc.getElementById('wkiSub');
        if(sub)sub.textContent=m.mdMode?'RPE × 분 · 경기 기준(MD)':'RPE × 분';
        el.innerHTML=html(m);
      }catch(e){ if(win.console)win.console.warn('[week-intensity]',e); }
    }
    var orig=win.renderMix;
    win.renderMix=function(){var r=orig.apply(this,arguments);paint();return r;};
    paint();
  }
  return {model:model,html:html,mount:mount};
});
