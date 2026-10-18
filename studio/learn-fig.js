/* PROCESS STUDIO — 학습 그림 (3.111)
   ─────────────────────────────────────────────────────────────────────────────
   절의 `pic` 을 그린다. 사용자 «학습 페이지 제대로» → 2판 «그림은 작전판으로».
   ⚠ 작전판(board.html, 2.5MB)을 학습 화면에 싣지 않는다 — 작전판과 같은 색 · 모양만 빌려 가볍게 그린다
      (남색 우리 · 흰 상대 · 노란 강조, board-hero.svg 와 같은 값).
   ⚠ 운동장 좌표는 미터. full = 105×68(오른쪽으로 공격), half = 68×52.5(위쪽 골로 공격, y=0 이 골라인),
      grid = w×h 훈련 구역(선 없음, 모서리 콘).
   ⚠ 흐름 · 사다리 · 네 칸 · 한 주 막대는 폰 폭에서 접히도록 HTML 로 그린다(모양은 learning.html 의 .lf-*).
   모양: { t:'pitch', v, w, h, us:[[x,y,'9',hi]], them:[[x,y,'4']], ball:[x,y], arrows:[[x1,y1,x2,y2,'pass'|'run'|'press'|'move',bend]],
           zones:[[x,y,w,h,'글']], notes:[[x,y,'글','start'|'middle'|'end']], goals:[[x,y,'l'|'r'|'t'|'b',폭]] }
         { t:'cycle', items:['…'], on:['화살표 글'], center:'…' }   { t:'steps', items:['…' | ['제목','설명']], loop:'…', v:true }
         { t:'quad', items:[['제목','설명']×4], center:'…' }      { t:'bars', items:[['MD-1','짧고 가볍게',1~4,강조]], note:'…' }
         그림 둘이면 배열로 — [{t:'pitch',…},{t:'steps',…}] */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LR_FIG=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var C={grass:'#2f7a48',grass2:'#2b7143',line:'rgba(255,255,255,.9)',us:'#1a2f5c',them:'#ffffff',ink:'#15171c',hi:'#ffd24a',acc:'#7C4DFF',accSoft:'#f0eaff',gray:'#646a73',line2:'#d3d7dd'};
  var FONT="'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,sans-serif";
  var uid=0;
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function n(v){return Math.round(v*100)/100;}

  /* ── 운동장 ─────────────────────────────────────────────────────────── */
  function marksFull(lw){
    var L='<g fill="none" stroke="'+C.line+'" stroke-width="'+lw+'">';
    L+='<rect x="0" y="0" width="105" height="68"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/>';
    L+='<rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/>';
    L+='<rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/>';
    L+='<path d="M16.5 26.69A9.15 9.15 0 0 1 16.5 41.31"/><path d="M88.5 26.69A9.15 9.15 0 0 0 88.5 41.31"/>';
    L+='<rect x="-2" y="30.34" width="2" height="7.32"/><rect x="105" y="30.34" width="2" height="7.32"/></g>';
    L+='<g fill="'+C.line+'"><circle cx="52.5" cy="34" r=".5"/><circle cx="11" cy="34" r=".45"/><circle cx="94" cy="34" r=".45"/></g>';
    return L;
  }
  function marksHalf(lw){   /* 위쪽이 상대 골 — 그림 공부에서 가장 흔한 «위로 공격» 보기 */
    var L='<g fill="none" stroke="'+C.line+'" stroke-width="'+lw+'">';
    L+='<rect x="0" y="0" width="68" height="52.5"/><rect x="13.84" y="0" width="40.32" height="16.5"/><rect x="24.84" y="0" width="18.32" height="5.5"/>';
    L+='<path d="M26.69 16.5A9.15 9.15 0 0 0 41.31 16.5"/><path d="M24.85 52.5A9.15 9.15 0 0 1 43.15 52.5"/>';
    L+='<rect x="30.34" y="-2" width="7.32" height="2"/></g>';
    L+='<circle cx="34" cy="11" r=".45" fill="'+C.line+'"/>';
    return L;
  }
  function goalMini(g,lw){   /* 작은 골 — 훈련 구역 가장자리 */
    var x=g[0],y=g[1],d=g[2]||'l',w=g[3]||3,dp=w*0.35;
    var r=(d==='l')?[x-dp,y-w/2,dp,w]:(d==='r')?[x,y-w/2,dp,w]:(d==='t')?[x-w/2,y-dp,w,dp]:[x-w/2,y,w,dp];
    return '<rect x="'+n(r[0])+'" y="'+n(r[1])+'" width="'+n(r[2])+'" height="'+n(r[3])+'" fill="rgba(255,255,255,.18)" stroke="'+C.line+'" stroke-width="'+lw+'"/>';
  }
  function pitch(p){
    var v=p.v||'full', W=v==='full'?105:v==='half'?68:(+p.w||40), H=v==='full'?68:v==='half'?52.5:(+p.h||30);
    var pad=Math.max(W,H)*0.04, vw=W+pad*2, vh=H+pad*2;
    var r=Math.min(2.4,Math.max(0.9,vw*0.022)), lw=n(Math.max(0.12,vw*0.0035)), fs=n(vw*0.031);
    var id='lf'+(++uid);
    var s='<svg viewBox="'+n(-pad)+' '+n(-pad)+' '+n(vw)+' '+n(vh)+'" role="img" aria-label="'+esc(p.alt||'')+'" xmlns="http://www.w3.org/2000/svg" font-family="'+esc(FONT)+'">';
    s+='<defs>'+['pass','run','press','move'].map(function(k){
      var col=(k==='run'||k==='press')?C.hi:'#ffffff';
      return '<marker id="'+id+k+'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="'+(k==='press'?3.4:4)+'" markerHeight="'+(k==='press'?3.4:4)+'" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="'+col+'"/></marker>';
    }).join('')+'</defs>';
    s+='<rect x="'+n(-pad)+'" y="'+n(-pad)+'" width="'+n(vw)+'" height="'+n(vh)+'" rx="'+n(pad*0.6)+'" fill="'+C.grass+'"/>';
    /* 잔디 줄무늬 — 작전판처럼. half 는 가로 줄, 나머지는 세로 줄 */
    var k, stripes='';
    if(v==='half'){ for(k=0;k<7;k++)if(k%2)stripes+='<rect x="0" y="'+n(k*H/7)+'" width="'+W+'" height="'+n(H/7)+'" fill="'+C.grass2+'"/>'; }
    else { for(k=0;k<10;k++)if(k%2)stripes+='<rect x="'+n(k*W/10)+'" y="0" width="'+n(W/10)+'" height="'+H+'" fill="'+C.grass2+'"/>'; }
    s+=stripes;
    if(v==='full')s+=marksFull(lw); else if(v==='half')s+=marksHalf(lw);
    else { s+='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="none" stroke="'+C.line+'" stroke-width="'+lw+'" stroke-dasharray="'+n(lw*6)+' '+n(lw*5)+'"/>';
      [[0,0],[W,0],[0,H],[W,H]].forEach(function(c){ s+='<path d="M'+n(c[0]-r*0.55)+' '+n(c[1]+r*0.45)+'L'+n(c[0])+' '+n(c[1]-r*0.6)+'L'+n(c[0]+r*0.55)+' '+n(c[1]+r*0.45)+'z" fill="#ff8a1f"/>'; }); }
    (p.goals||[]).forEach(function(g){ s+=goalMini(g,lw); });
    (p.zones||[]).forEach(function(z){
      s+='<rect x="'+z[0]+'" y="'+z[1]+'" width="'+z[2]+'" height="'+z[3]+'" rx="'+n(r*0.4)+'" fill="rgba(255,210,74,.2)" stroke="'+C.hi+'" stroke-width="'+lw+'" stroke-dasharray="'+n(lw*4)+' '+n(lw*3)+'"/>';
      if(z[4])s+='<text x="'+n(z[0]+z[2]/2)+'" y="'+n(z[1]+fs*1.05)+'" text-anchor="middle" font-size="'+fs+'" font-weight="700" fill="'+C.hi+'">'+esc(z[4])+'</text>';
    });
    (p.arrows||[]).forEach(function(a){
      var k=a[4]||'pass', col=(k==='run'||k==='press')?C.hi:'#ffffff', w=n(lw*(k==='press'?3.2:2.2));
      var d, bend=+a[5]||0;
      if(bend){ var mx=(a[0]+a[2])/2, my=(a[1]+a[3])/2, dx=a[2]-a[0], dy=a[3]-a[1]; d='M'+a[0]+' '+a[1]+'Q'+n(mx-dy*bend)+' '+n(my+dx*bend)+' '+a[2]+' '+a[3]; }
      else d='M'+a[0]+' '+a[1]+'L'+a[2]+' '+a[3];
      s+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round"'+(k==='pass'?' stroke-dasharray="'+n(lw*5)+' '+n(lw*4)+'"':'')+' marker-end="url(#'+id+k+')"/>';
    });
    function tok(t,us){
      var lab=String(t[2]==null?'':t[2]), f=n(r*(lab.length>2?0.78:1.05));
      return (t[3]?'<circle cx="'+t[0]+'" cy="'+t[1]+'" r="'+n(r*1.45)+'" fill="none" stroke="'+C.hi+'" stroke-width="'+n(lw*2)+'"/>':'')
        +'<circle cx="'+t[0]+'" cy="'+t[1]+'" r="'+n(r)+'" fill="'+(us?C.us:C.them)+'" stroke="'+(us?'#ffffff':C.ink)+'" stroke-width="'+n(lw*1.4)+'"/>'
        +(lab?'<text x="'+t[0]+'" y="'+n(t[1]+f*0.36)+'" text-anchor="middle" font-size="'+f+'" font-weight="700" fill="'+(us?'#ffffff':C.ink)+'">'+esc(lab)+'</text>':'');
    }
    (p.them||[]).forEach(function(t){ s+=tok(t,false); });
    (p.us||[]).forEach(function(t){ s+=tok(t,true); });
    if(p.ball)s+='<circle cx="'+p.ball[0]+'" cy="'+p.ball[1]+'" r="'+n(r*0.48)+'" fill="#ffffff" stroke="'+C.ink+'" stroke-width="'+n(lw*1.2)+'"/>';
    (p.notes||[]).forEach(function(t){
      s+='<text x="'+t[0]+'" y="'+t[1]+'" text-anchor="'+(t[3]||'middle')+'" font-size="'+fs+'" font-weight="700" fill="#ffffff" stroke="rgba(0,0,0,.55)" stroke-width="'+n(fs*0.22)+'" paint-order="stroke" stroke-linejoin="round">'+esc(t[2])+'</text>';
    });
    return s+'</svg>';
  }

  /* ── 순환(고리) ──────────────────────────────────────────────────────── */
  function cycle(p){
    var it=p.items||[], N=it.length||1, W=340, H=p.h||230, cx=W/2, cy=H/2, rx=W/2-70, ry=H/2-34, id='lf'+(++uid);
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(p.alt||it.join(' → '))+'" xmlns="http://www.w3.org/2000/svg" font-family="'+esc(FONT)+'">';
    s+='<defs><marker id="'+id+'m" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9z" fill="'+C.acc+'"/></marker></defs>';
    s+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="'+C.line2+'" stroke-width="2"/>';
    function pt(a){ return [cx+rx*Math.cos(a),cy+ry*Math.sin(a)]; }
    for(var i=0;i<N;i++){   /* 화살촉은 두 마디 사이 가운데에 시계 방향으로 */
      var a0=-Math.PI/2+i*2*Math.PI/N, a1=a0+Math.PI/N, q=pt(a1), q2=pt(a1+0.02);
      s+='<path d="M'+n(q[0])+' '+n(q[1])+'L'+n(q2[0])+' '+n(q2[1])+'" stroke="'+C.acc+'" stroke-width="2" marker-end="url(#'+id+'m)"/>';
      if(p.on&&p.on[i]){ var o=[cx+(rx+16)*Math.cos(a1),cy+(ry+14)*Math.sin(a1)];
        s+='<text x="'+n(o[0])+'" y="'+n(o[1]+4)+'" text-anchor="'+(Math.cos(a1)>0.3?'start':Math.cos(a1)<-0.3?'end':'middle')+'" font-size="11" fill="'+C.gray+'">'+esc(p.on[i])+'</text>'; }
    }
    if(p.center)s+='<text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" font-size="13" font-weight="700" fill="'+C.gray+'">'+esc(p.center)+'</text>';
    it.forEach(function(t,i){
      var a=-Math.PI/2+i*2*Math.PI/N, c=pt(a), lines=String(t).split('\n'), wd=Math.max.apply(null,lines.map(function(l){return l.length;}))*12.5+22, ht=lines.length*15+12;
      s+='<rect x="'+n(c[0]-wd/2)+'" y="'+n(c[1]-ht/2)+'" width="'+n(wd)+'" height="'+ht+'" rx="10" fill="'+(i===0&&p.first?C.acc:C.accSoft)+'" stroke="'+C.acc+'" stroke-width="1.2"/>';
      lines.forEach(function(l,j){ s+='<text x="'+n(c[0])+'" y="'+n(c[1]-ht/2+19+j*15)+'" text-anchor="middle" font-size="12.5" font-weight="700" fill="'+(i===0&&p.first?'#ffffff':'#3c1fa8')+'">'+esc(l)+'</text>'; });
    });
    return s+'</svg>';
  }

  /* ── HTML 그림: 흐름 · 사다리 · 네 칸 · 한 주 막대 ───────────────────── */
  function two(x){ return Array.isArray(x)?x:[x,'']; }
  function steps(p){
    var it=p.items||[];
    return '<ol class="lf-steps'+(p.v?' v':'')+'" aria-label="'+esc(p.alt||'')+'">'+it.map(function(x,i){ var t=two(x);
      return '<li style="--i:'+i+'"><b>'+(i+1)+'</b><span>'+esc(t[0])+(t[1]?'<small>'+esc(t[1])+'</small>':'')+'</span></li>'; }).join('')
      +'</ol>'+(p.loop?'<div class="lf-loop">↻ '+esc(p.loop)+'</div>':'')+(p.note?'<div class="lf-loop">'+esc(p.note)+'</div>':'');
  }
  function quad(p){
    return '<div class="lf-quad" aria-label="'+esc(p.alt||'')+'">'+(p.items||[]).map(function(x){ var t=two(x);
      return '<div><b>'+esc(t[0])+'</b>'+(t[1]?'<small>'+esc(t[1])+'</small>':'')+'</div>'; }).join('')
      +(p.center?'<i>'+esc(p.center)+'</i>':'')+'</div>';
  }
  function bars(p){
    var mx=p.max||4;
    return '<div class="lf-bars" aria-label="'+esc(p.alt||'')+'">'+(p.items||[]).map(function(x){
      var v=Math.max(0,Math.min(mx,+x[2]||0));
      return '<div class="'+(x[3]?'on':'')+'"><span class="bar"><i style="height:'+Math.round(v/mx*100)+'%"></i></span><b>'+esc(x[0])+'</b><small>'+esc(x[1]||'')+'</small></div>';
    }).join('')+'</div>'+(p.note?'<div class="lf-loop">'+esc(p.note)+'</div>':'');
  }

  /* HTML 그림의 모양 — 처음 그릴 때 한 번 붙인다(.html 의 px 글자 · 색 개수는 스타일 래칫이 세므로 모듈에 둔다) */
  var CSS='.lf-steps{list-style:none;display:flex;flex-wrap:wrap;gap:8px 24px;margin:0;padding:0}'
    +'.lf-steps li{position:relative;display:flex;gap:8px;align-items:flex-start;background:#f0eaff;border:1px solid #d9ccff;border-radius:10px;padding:9px 12px;flex:1 1 120px;min-width:0}'
    +'.lf-steps li>b{flex:0 0 auto;width:20px;height:20px;border-radius:50%;background:#7C4DFF;color:#fff;font-size:11px;display:grid;place-items:center}'
    +'.lf-steps li>span{font-weight:700;font-size:13px;line-height:1.4;color:#3c1fa8}'
    +'.lf-steps li small{display:block;font-weight:400;font-size:11px;color:#646a73;margin-top:2px}'
    +'.lf-steps li:not(:last-child)::after{content:"→";position:absolute;right:-18px;top:50%;transform:translateY(-50%);color:#7C4DFF;font-weight:700}'
    +'.lf-steps.v{flex-direction:column;gap:18px}.lf-steps.v li{flex:none;margin-left:calc(var(--i) * 16px)}'
    +'.lf-steps.v li:not(:last-child)::after{content:"↓";right:auto;left:16px;top:auto;bottom:-17px;transform:none}'
    +'@media (max-width:640px){.lf-steps{flex-direction:column;gap:18px}.lf-steps li{flex:none}.lf-steps li:not(:last-child)::after{content:"↓";right:auto;left:16px;top:auto;bottom:-17px;transform:none}.lf-steps.v li{margin-left:calc(var(--i) * 8px)}}'
    +'.lf-loop{margin-top:8px;font-size:12px;color:#5a2fd6;font-weight:600}'
    +'.lf-quad{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:8px}'
    +'.lf-quad div{background:#f0eaff;border:1px solid #d9ccff;border-radius:10px;padding:12px 14px 14px;min-height:66px}'
    +'.lf-quad b{display:block;font-size:13px;color:#3c1fa8}.lf-quad small{display:block;font-size:11px;color:#646a73;margin-top:3px;line-height:1.5}'
    +'.lf-quad i{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-style:normal;font-size:11px;font-weight:700;background:#7C4DFF;color:#fff;border-radius:999px;padding:5px 10px;white-space:nowrap;box-shadow:0 0 0 4px #fff}'
    +'.lf-bars{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;align-items:end}'
    +'.lf-bars>div{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-width:0}'
    +'.lf-bars .bar{display:flex;align-items:flex-end;width:100%;max-width:46px;height:92px;background:#f4f5f7;border-radius:6px;overflow:hidden}'
    +'.lf-bars .bar i{display:block;width:100%;background:#c9b8ff;border-radius:6px 6px 0 0}.lf-bars .on .bar i{background:#7C4DFF}'
    +'.lf-bars b{font-size:11px}.lf-bars small{font-size:10px;color:#646a73;line-height:1.3;word-break:keep-all}';
  function ensureCss(){
    try{ if(typeof document==='undefined'||document.getElementById('lfCss'))return;
      var st=document.createElement('style'); st.id='lfCss'; st.textContent=CSS; (document.head||document.documentElement).appendChild(st); }catch(_){}
  }

  function html(p){
    if(Array.isArray(p))return p.map(html).filter(Boolean).join('<div class="lf-gap" style="height:12px"></div>');   /* 한 절에 그림 둘(장면 + 흐름) */
    if(!p||typeof p!=='object')return '';
    ensureCss();
    try{
      if(p.t==='pitch')return pitch(p);
      if(p.t==='cycle')return cycle(p);
      if(p.t==='steps')return steps(p);
      if(p.t==='quad')return quad(p);
      if(p.t==='bars')return bars(p);
    }catch(_){}
    return '';
  }
  return {html:html,colors:C};
});
