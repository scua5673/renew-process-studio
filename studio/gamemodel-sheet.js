/* 3.368 — 보관함 › 게임모델 «한 장에서 고르기»(사용자 11/22 «처음부터 다시 · 누구나 쉽게» → 목업 B안 · 11/23 «b로 해서 만들자»).
   보관함(개인 판 · ?scope=personal)에서만 선다. 팀 운영 › 게임모델은 그대로.
   ⚠ 새 저장 칸은 국면의 `pick`(고른 답 id) 하나. 원칙은 원래 자리(moments › phases › principles)에 그대로 적는다 —
      «자세히» 화면 · 팀으로 가져오기 · 내보내기 · 계정 저장(gmPersonal)이 손대지 않고 따라온다.
   ⚠ 한 장은 국면마다 원칙 세 개까지 보이고 적는다. 이미 더 많이 적은 국면은 앞의 셋 + «자세히 보기» — 지우지 않는다.
   ⚠ 치는 동안 다시 그리지 않는다(한글 조합). */
(function(w){
  'use strict';
  var d=w.document, MAX=3;
  /* 차례 = 경기가 도는 차례. ph = 고른 답의 원칙이 들어갈 단계 번호(GM_LIB 의 단계 차례) */
  var Q=[
    {k:'ao',name:'공을 가졌을 때',q:'공을 어떻게 앞으로 보냅니까?',opts:[
      {id:'short',ph:0,t:'짧게 이어서',s:'골키퍼부터 짧게 이어 첫 압박을 벗어납니다',idn:'짧게 이어 나가고',
       more:['받기 전에 몸을 열고 둘레를 봅니다','공 가진 선수 곁에 늘 두 길을 만듭니다'],g:{a:[[14,38,34,22],[34,22,56,38],[56,38,78,24]]}},
      {id:'long',ph:0,t:'길게 바로',s:'앞으로 길게 보내고 떨어지는 공을 따냅니다',idn:'길게 바로 보내고',
       more:['떨어지는 공 둘레에 셋이 모입니다','공이 뜨면 줄 전체가 함께 올라갑니다'],g:{a:[[14,38,98,30]],p:[[90,22],[92,40],[84,32]]}},
      {id:'wide',ph:0,t:'넓게 벌려서',s:'넓게 벌려 측면에서 수를 늘립니다',idn:'넓게 벌려 나가고',
       more:['양쪽 끝 선수가 옆줄을 밟고 섭니다','한쪽에 모았다가 반대로 넘깁니다'],g:{a:[[30,38,62,10],[30,38,62,66]]}}
    ]},
    {k:'dt',name:'공을 잃은 순간',q:'공을 잃으면 먼저 무엇을 합니까?',opts:[
      {id:'press',ph:0,t:'바로 되찾는다',s:'잃은 자리에서 5초 동안 가까운 셋이 달려듭니다',idn:'잃으면 바로 되찾는 팀',
       more:['가장 가까운 선수는 공으로, 다음 선수는 길을 막습니다','5초가 지나면 내려와 자리를 잡습니다'],g:{a:[[52,20,68,34],[52,56,68,42],[90,38,76,38]],b:[72,38]}},
      {id:'drop',ph:1,t:'내려와 자리 잡는다',s:'공 뒤로 빠르게 내려와 줄을 맞춥니다',idn:'잃으면 빠르게 자리를 잡는 팀',
       more:['가운데 길부터 닫습니다','공보다 뒤에 여덟 명이 섭니다'],g:{a:[[84,18,52,18],[88,38,56,38],[84,58,52,58]],b:[96,30]}}
    ]},
    {k:'do',name:'공이 상대에게 있을 때',q:'어디서부터 막습니까?',opts:[
      {id:'high',ph:0,t:'앞에서부터',s:'상대 골킥부터 사람을 붙여 앞에서 뺏습니다',
       more:['한쪽으로 몰아 옆줄에서 뺏습니다','앞줄이 나가면 뒷줄도 함께 올라갑니다'],g:{r:[78,8,32,60]}},
      {id:'mid',ph:1,t:'가운데에서',s:'가운데를 좁혀 공을 밖으로 내보냅니다',
       more:['줄 사이 간격을 열 걸음으로 지킵니다','공이 옆으로 가면 모두 같이 옮겨 갑니다'],g:{r:[44,8,32,60]}},
      {id:'low',ph:2,t:'우리 골문 앞에서',s:'골문 앞을 먼저 채우고 슈팅 길에 몸을 둡니다',
       more:['박스 안에서는 사람을 먼저 잡습니다','걷어낸 공 둘레에 둘이 먼저 갑니다'],g:{r:[10,8,32,60]}}
    ]},
    {k:'at',name:'공을 되찾은 순간',q:'공을 되찾으면 먼저 어디를 봅니까?',opts:[
      {id:'fast',ph:0,t:'앞을 먼저 본다',s:'첫 패스는 앞으로 보내고 셋이 함께 달립니다',
       more:['되찾은 선수는 두 번 안에 공을 보냅니다','가운데 길이 열리면 그 길로 갑니다'],g:{a:[[40,38,92,30],[48,18,84,16],[48,58,84,58]]}},
      {id:'keep',ph:1,t:'공을 지킨다',s:'첫 패스는 안전한 쪽으로 보내 공을 지킵니다',
       more:['넓게 벌려 숨을 고릅니다','공 둘레에서 빠져나온 뒤 앞을 봅니다'],g:{a:[[56,38,40,22],[40,22,24,38]]}}
    ]}
  ];
  var QK={}; Q.forEach(function(q){ QK[q.k]=q; });

  /* ── 순수 셈(시험이 그대로 부른다) ── */
  function txt(p){ return (typeof p==='string')?p:((p&&(p.t||p.text||p.title))||''); }
  function setTxt(ph,i,v){
    var p=ph.principles[i];
    if(p&&typeof p==='object'){ var key=('t' in p)?'t':('text' in p)?'text':('title' in p)?'title':'t'; p[key]=v; }
    else ph.principles[i]=v;
  }
  function optOf(k,id){ var q=QK[k]; if(!q||!id)return null; return q.opts.filter(function(o){ return o.id===id; })[0]||null; }
  function momentOf(model,k){ return ((model&&model.moments)||[]).filter(function(m){ return m&&m.key===k; })[0]||null; }
  function rows(m,fresh){
    var out=[]; if(!m)return out;
    (m.phases||[]).forEach(function(ph,pi){ ((ph&&ph.principles)||[]).forEach(function(p,xi){
      var t=String(txt(p)||''), id=m.key+':'+pi+':'+xi;
      if(t.trim()||fresh===id)out.push({pi:pi,xi:xi,t:t,id:id});
    }); });
    return out;
  }
  function ensure(model,k,deps){
    var m=momentOf(model,k); if(m)return m;
    var L=(deps.lib||[]).filter(function(x){ return x.k===k; })[0]; if(!L)return null;
    m={key:L.k,cat:(deps.cat||{})[L.k]||L.k,name:L.nm,tag:L.tag,phases:L.ph.map(deps.newPh)};
    if(!Array.isArray(model.moments))model.moments=[];
    model.moments.push(m);
    if(model.open&&typeof model.open==='object')model.open[k]=true;
    if(Array.isArray(model.removedStd))model.removedStd=model.removedStd.filter(function(x){ return x!==k; });
    return m;
  }
  function slot(m,phIdx,deps){
    if(!Array.isArray(m.phases)||!m.phases.length)m.phases=[deps.newPh('원칙')];
    var pi=Math.max(0,Math.min(phIdx||0,m.phases.length-1)), ph=m.phases[pi], xi=-1;
    if(!Array.isArray(ph.principles))ph.principles=[];
    ph.principles.some(function(p,i){ if(typeof p!=='object'&&!String(p||'').trim()){ xi=i; return true; } return false; });
    if(xi<0){ ph.principles.push(''); xi=ph.principles.length-1; }
    return {ph:ph,pi:pi,xi:xi};
  }
  function addLine(model,k,text,deps){
    var m=ensure(model,k,deps); if(!m||rows(m).length>=MAX)return null;
    var o=optOf(k,m.pick), s=slot(m,o?o.ph:0,deps);
    setTxt(s.ph,s.xi,text);
    return m.key+':'+s.pi+':'+s.xi;
  }
  function at(model,id){
    var a=String(id||'').split(':'), m=momentOf(model,a[0]), ph=m&&m.phases&&m.phases[+a[1]];
    if(!ph||!Array.isArray(ph.principles)||!(+a[2]<ph.principles.length))return null;
    return {m:m,ph:ph,xi:+a[2]};
  }
  function drop(ph,xi){ ph.principles.splice(xi,1); if(!ph.principles.length)ph.principles=['']; }
  function removeLine(model,id){
    var h=at(model,id); if(!h)return false;
    drop(h.ph,h.xi);
    if(!rows(h.m).length)delete h.m.pick;
    return true;
  }
  function compose(model){
    var a=momentOf(model,'ao'), b=momentOf(model,'dt'), oa=a&&optOf('ao',a.pick), ob=b&&optOf('dt',b.pick);
    return (oa&&ob)?(oa.idn+', '+ob.idn):'';
  }
  /* 답을 고른다 — 앞서 고른 답이 넣어 준 문장(손대지 않은 것)만 걷고 새 답의 문장을 넣는다. 직접 쓴 원칙은 그대로 */
  function setPick(model,k,id,deps){
    var o=optOf(k,id); if(!o)return false;
    var m=ensure(model,k,deps); if(!m)return false;
    var was=compose(model), old=optOf(k,m.pick);
    if(old&&old.id!==id){
      var sug=[old.s].concat(old.more);
      rows(m).reverse().forEach(function(r){ if(sug.indexOf(r.t.trim())>=0)drop(m.phases[r.pi],r.xi); });
    }
    m.pick=id;
    if(rows(m).length<MAX&&!rows(m).some(function(r){ return r.t.trim()===o.s; })){
      /* 고른 답의 문장이 그 단계의 첫 줄 — 빈 자리 하나를 걷고 앞에 넣는다 */
      var s=slot(m,o.ph,deps); s.ph.principles.splice(s.xi,1); s.ph.principles.unshift(o.s);
    }
    var now=compose(model), cur=String(model.identity||'');
    if(now&&(!cur.trim()||cur===was))model.identity=now;
    return true;
  }
  function filled(model){ return Q.filter(function(q){ return rows(momentOf(model,q.k)).length>0; }).length; }

  var api={Q:Q,MAX:MAX,txt:txt,rows:rows,optOf:optOf,ensure:ensure,addLine:addLine,removeLine:removeLine,setPick:setPick,compose:compose,filled:filled,
    draw:function(){}, mode:function(){ return 'detail'; }};
  w.PSGmSheet=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!d||!w.location||!/[?&]scope=personal(?:&|$)/.test(w.location.search||''))return;

  /* ── 화면 ── */
  var st={mode:'sheet',open:{},deep:'',fresh:'',pending:false};
  var CSS=''
    +'body.gm-sheet-on #stage>*:not(#gmSheetBar):not(#gmSheet):not(#gmPickMask){display:none!important}'
    +'#gmSheetBar{display:flex;align-items:center;gap:12px;margin:12px 20px 0}'
    +'#gmSheetBar .gsh-seg{display:inline-flex;gap:4px;padding:4px;border-radius:10px;background:var(--surface-2,#f0f0ee)}'
    +'#gmSheetBar .gsh-seg button{border:0;background:transparent;border-radius:6px;min-height:40px;padding:0 14px;font:inherit;font-size:14px;font-weight:600;color:var(--text-2,#5d636d);cursor:pointer;white-space:nowrap}'
    +'#gmSheetBar .gsh-seg button[aria-pressed="true"]{background:var(--surface,#fff);color:var(--text,#16181c);box-shadow:0 1px 2px rgba(0,0,0,.08)}'
    +'#gmSheet{display:none;margin:12px 20px 24px}'
    +'body.gm-sheet-on #gmSheet{display:block}'
    +'#gmSheet .gsh-sheet{background:var(--surface,#fff);border:1px solid var(--line,#e3e4e1);border-radius:10px;padding:20px}'
    +'#gmSheet .gsh-id{display:block;width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line,#e3e4e1);border-radius:0;background:transparent;padding:6px 0;min-height:44px;margin:0 0 16px;font:inherit;font-size:20px;font-weight:700;color:var(--text,#16181c)}'
    +'#gmSheet .gsh-id:focus{outline:0;border-bottom-color:var(--text,#16181c)}'
    +'#gmSheet .gsh-id::placeholder{color:var(--text-3,#8b919b);font-weight:600}'
    +'#gmSheet .gsh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}'
    +'#gmSheet .gsh-cell{border:1px solid var(--line,#e3e4e1);border-radius:10px;padding:14px;min-height:150px;display:flex;flex-direction:column;gap:10px;min-width:0}'
    +'#gmSheet .gsh-h{display:flex;align-items:center;gap:8px}'
    +'#gmSheet .gsh-dot{width:8px;height:8px;border-radius:999px;flex:none}'
    +'#gmSheet .gsh-h b{font-size:16px;font-weight:700;color:var(--text,#16181c)}'
    +'#gmSheet .gsh-h small{margin-left:auto;font-size:12px;font-weight:500;color:var(--text-3,#8b919b);text-align:right}'
    +'#gmSheet .gsh-q{margin:0;font-size:14px;color:var(--text-2,#5d636d)}'
    +'#gmSheet .gsh-opts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}'
    +'#gmSheet .gsh-opts.two{grid-template-columns:repeat(2,minmax(0,1fr))}'
    +'#gmSheet .gsh-opt{border:1px solid var(--line,#e3e4e1);background:var(--surface,#fff);border-radius:10px;padding:10px;min-height:44px;text-align:left;display:flex;flex-direction:column;gap:8px;font:inherit;color:var(--text,#16181c);cursor:pointer;min-width:0}'
    +'#gmSheet .gsh-opt[aria-pressed="true"]{border-color:var(--text,#16181c);box-shadow:inset 0 0 0 1px var(--text,#16181c);background:var(--surface-2,#f0f0ee)}'
    +'#gmSheet .gsh-opt svg{width:100%;height:auto;display:block;border-radius:6px;pointer-events:none}'
    +'#gmSheet .gsh-opt b{font-size:14px;font-weight:700}'
    +'#gmSheet .gsh-pbg{fill:var(--surface-2,#eef1ec)}#gmSheet .gsh-pln{fill:none;stroke:var(--text-3,#8b919b);stroke-opacity:.45;stroke-width:1}#gmSheet .gsh-ball{fill:var(--text,#16181c)}'
    +'#gmSheet .gsh-lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}'
    +'#gmSheet .gsh-lines li{display:flex;gap:8px;align-items:center;min-width:0}'
    +'#gmSheet .gsh-n{width:20px;flex:none;text-align:right;font-size:12px;font-weight:700;color:var(--text-3,#8b919b);font-variant-numeric:tabular-nums}'
    +'#gmSheet .gsh-lines input{flex:1;width:0;min-width:0;box-sizing:border-box;border:1px solid transparent;background:var(--surface-2,#f0f0ee);border-radius:6px;min-height:40px;padding:0 10px;font:inherit;font-size:14px;font-weight:600;color:var(--text,#16181c)}'
    +'#gmSheet .gsh-lines input:focus{outline:0;border-color:var(--text,#16181c);background:var(--surface,#fff)}'
    +'#gmSheet .gsh-ghost{border:0;background:transparent;border-radius:6px;min-height:40px;padding:0 8px;font:inherit;font-size:14px;font-weight:600;color:var(--text-2,#5d636d);cursor:pointer;white-space:nowrap}'
    +'#gmSheet .gsh-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center}'
    +'#gmSheet .gsh-chips{display:flex;flex-wrap:wrap;gap:6px}'
    +'#gmSheet .gsh-chip{border:1px solid var(--line,#e3e4e1);background:var(--surface,#fff);border-radius:999px;min-height:40px;padding:4px 12px;font:inherit;font-size:14px;font-weight:600;color:var(--text,#16181c);text-align:left;cursor:pointer}'
    +'#gmSheet .gsh-deep{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:6px;background:var(--surface-2,#f0f0ee);border-radius:6px;padding:8px}'
    +'#gmSheet .gsh-foot{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:1px solid var(--line,#e3e4e1)}'
    +'#gmSheet .gsh-foot p{margin:0;font-size:12px;color:var(--text-2,#5d636d)}'
    +'#gmSheet .gsh-btn{border:1px solid var(--line,#e3e4e1);background:var(--surface,#fff);border-radius:6px;min-height:40px;padding:0 14px;font:inherit;font-size:14px;font-weight:600;color:var(--text,#16181c);cursor:pointer}'
    +'@media (max-width:640px){'
    +'#gmSheetBar{margin:10px 12px 0}#gmSheet{margin:10px 12px 20px}#gmSheet .gsh-sheet{padding:14px}'
    +'#gmSheet .gsh-grid{grid-template-columns:minmax(0,1fr)}'
    +'#gmSheet .gsh-opts{grid-template-columns:minmax(0,1fr)}#gmSheet .gsh-opts.two{grid-template-columns:repeat(2,minmax(0,1fr))}'
    +'#gmSheet .gsh-opt{flex-direction:row;align-items:center}#gmSheet .gsh-opt svg{width:96px;flex:none}'
    +'#gmSheet .gsh-opts.two .gsh-opt{flex-direction:column;align-items:stretch}#gmSheet .gsh-opts.two .gsh-opt svg{width:100%}'
    +'#gmSheet .gsh-ghost,#gmSheet .gsh-chip,#gmSheet .gsh-btn,#gmSheet .gsh-lines input,#gmSheetBar .gsh-seg button{min-height:44px}'
    +'}';
  var style=d.createElement('style'); style.id='ps-gm-sheet-css'; style.textContent=CSS; d.head.appendChild(style);
  if(d.body)d.body.classList.add('gm-sheet-on');

  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function br(){ return w.__gmSheet||null; }
  function deps(){ var b=br(); return {lib:b.lib,cat:b.cat,newPh:b.newPh}; }
  function col(m){ return 'var(--'+(((m&&m.cat)||(br().cat||{})[m&&m.key])||'ao')+')'; }
  /* 작은 운동장 — 왼쪽이 우리 골문 */
  function pitch(g,k,id){
    var c='var(--'+k+')', mk='gs-'+k+'-'+id, s='<svg viewBox="0 0 120 76" aria-hidden="true"><defs><marker id="'+mk+'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:'+c+'"/></marker></defs>'
      +'<rect class="gsh-pbg" x="0" y="0" width="120" height="76"/>'
      +'<g class="gsh-pln"><rect x="4" y="4" width="112" height="68"/><line x1="60" y1="4" x2="60" y2="72"/><circle cx="60" cy="38" r="9"/><rect x="4" y="20" width="16" height="36"/><rect x="100" y="20" width="16" height="36"/></g>';
    if(g.r)s+='<rect x="'+g.r[0]+'" y="'+g.r[1]+'" width="'+g.r[2]+'" height="'+g.r[3]+'" rx="4" style="fill:'+c+';fill-opacity:.22;stroke:'+c+';stroke-width:1.5"/>';
    (g.a||[]).forEach(function(a){ s+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+a[2]+'" y2="'+a[3]+'" style="stroke:'+c+';stroke-width:2.2;stroke-linecap:round" marker-end="url(#'+mk+')"/>'; });
    (g.p||[]).forEach(function(p){ s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" style="fill:'+c+'"/>'; });
    if(g.b)s+='<circle class="gsh-ball" cx="'+g.b[0]+'" cy="'+g.b[1]+'" r="3.2"/>';
    return s+'</svg>';
  }
  function optsHTML(q,pick){
    return '<div class="gsh-opts'+(q.opts.length===2?' two':'')+'">'+q.opts.map(function(o){
      return '<button type="button" class="gsh-opt" data-gs-pick="'+q.k+':'+o.id+'" aria-pressed="'+(pick===o.id)+'">'+pitch(o.g,q.k,o.id)+'<b>'+esc(o.t)+'</b></button>';
    }).join('')+'</div>';
  }
  function cellHTML(model,k,q,m){
    var all=rows(m,st.fresh), list=all.slice(0,MAX), name=q?q.name:((m&&m.name)||'국면'), tag=q?(((br().lib||[]).filter(function(x){ return x.k===k; })[0]||{}).nm||''):'';
    var h='<div class="gsh-cell" data-gs-cell="'+esc(k)+'"><div class="gsh-h"><i class="gsh-dot" style="background:'+(q?'var(--'+k+')':col(m))+'"></i><b>'+esc(name)+'</b>'+(tag?'<small>'+esc(tag)+'</small>':'')+'</div>';
    if(q&&(!all.length||st.open[k])){
      h+='<p class="gsh-q">'+esc(q.q)+'</p>'+optsHTML(q,m&&m.pick)
        +'<div class="gsh-row"><button type="button" class="gsh-ghost" data-gs-own="'+esc(k)+'">직접 쓰기</button>'+(all.length?'<button type="button" class="gsh-ghost" data-gs-close="'+esc(k)+'">닫기</button>':'')+'</div>';
      return h+'</div>';
    }
    if(list.length){
      h+='<ul class="gsh-lines">'+list.map(function(r,i){
        return '<li><span class="gsh-n">'+(i+1)+'</span><input type="text" data-gs-line="'+esc(r.id)+'" value="'+esc(r.t)+'" maxlength="200" placeholder="우리 팀 말로 적습니다" aria-label="'+esc(name)+' 원칙 '+(i+1)+'번"><button type="button" class="gsh-ghost" data-gs-deep="'+esc(r.id)+'" aria-expanded="'+(st.deep===r.id)+'">자세히</button></li>'
          +(st.deep===r.id?'<li><span class="gsh-n"></span><div class="gsh-deep"><button type="button" class="gsh-chip" data-gs-detail="'+esc(k)+'">신호 · 작전판 · 훈련 붙이기</button><button type="button" class="gsh-chip" data-gs-del="'+esc(r.id)+'">지우기</button></div></li>':'');
      }).join('')+'</ul>';
    }
    if(all.length>MAX)h+='<div class="gsh-row"><button type="button" class="gsh-ghost" data-gs-detail="'+esc(k)+'">원칙 '+(all.length-MAX)+'개 더 · 자세히 보기</button></div>';
    var o=q&&m&&optOf(k,m.pick), have=all.map(function(r){ return r.t.trim(); });
    if(o&&all.length<MAX){
      var more=o.more.filter(function(s){ return have.indexOf(s)<0; });
      if(more.length)h+='<div class="gsh-chips">'+more.map(function(s){ return '<button type="button" class="gsh-chip" data-gs-add="'+esc(k)+'" data-gs-s="'+esc(s)+'">＋ '+esc(s)+'</button>'; }).join('')+'</div>';
    }
    h+='<div class="gsh-row">'+(all.length<MAX?'<button type="button" class="gsh-ghost" data-gs-own="'+esc(k)+'">＋ 직접 쓰기</button>':'')+(q?'<button type="button" class="gsh-ghost" data-gs-reopen="'+esc(k)+'">'+(m&&m.pick?'다시 고르기':'그림으로 고르기')+'</button>':'')+'</div>';
    return h+'</div>';
  }
  function sheetHTML(model){
    var h='<div class="gsh-sheet"><input type="text" class="gsh-id" data-gs-id="1" maxlength="120" value="'+esc(model.identity||'')+'" placeholder="우리 팀은 어떤 팀입니까" aria-label="우리 팀 한 문장"><div class="gsh-grid">';
    Q.forEach(function(q){ h+=cellHTML(model,q.k,q,momentOf(model,q.k)); });
    (model.moments||[]).forEach(function(m){ if(m&&m.key&&!QK[m.key])h+=cellHTML(model,m.key,null,m); });
    return h+'</div><div class="gsh-foot"><p>'+filled(model)+' / '+Q.length+'칸 · 원칙은 칸마다 세 개까지</p><div class="gsh-row"><button type="button" class="gsh-ghost" data-gs-more="1">국면 더하기</button><button type="button" class="gsh-btn" data-gs-export="1">내보내기</button></div></div></div>';
  }

  var root=null, bar=null;
  function typing(){ var a=d.activeElement; return !!(root&&a&&a.tagName==='INPUT'&&root.contains(a)); }
  function mount(){
    var stage=d.getElementById('stage'); if(!stage||root)return !!root;
    bar=d.createElement('div'); bar.id='gmSheetBar';
    bar.innerHTML='<div class="gsh-seg" role="group" aria-label="게임모델 보기"><button type="button" data-gs-mode="sheet">한 장</button><button type="button" data-gs-mode="detail">자세히</button></div>';
    root=d.createElement('div'); root.id='gmSheet';
    stage.insertBefore(root,stage.firstChild); stage.insertBefore(bar,root);
    bar.addEventListener('click',function(e){ var t=e.target.closest('[data-gs-mode]'); if(t)setMode(t.getAttribute('data-gs-mode')); });
    root.addEventListener('click',onClick);
    root.addEventListener('input',onInput);
    root.addEventListener('focusout',function(){ if(st.pending)w.setTimeout(function(){ if(st.pending&&!typing())draw(true); },200); });
    return true;
  }
  function paintBar(){
    if(!bar)return;
    [].forEach.call(bar.querySelectorAll('[data-gs-mode]'),function(b){ b.setAttribute('aria-pressed',String(b.getAttribute('data-gs-mode')===st.mode)); });
  }
  function draw(force){
    var b=br(); if(!b||!mount())return;
    var model=b.get(); if(!model)return;
    paintBar();
    if(st.mode!=='sheet')return;
    if(!force&&typing()){ st.pending=true; return; }
    st.pending=false;
    root.inert=!b.edit();
    root.innerHTML=sheetHTML(model);
  }
  /* 구조가 바뀐 손질 — 적고, 자세히 화면도 같이 다시 그린다(그 끝에서 이 판도 다시 그려진다) */
  function commit(){ var b=br(); b.save(); st.pending=false; if(d.activeElement&&root.contains(d.activeElement)&&d.activeElement.blur)d.activeElement.blur(); b.render(); }
  function identSync(model){
    ['gmIdentLine','identity'].forEach(function(id){ var el=d.getElementById(id); if(el)el.value=model.identity||''; });
  }
  function setMode(mode){
    var b=br(); if(!b)return;
    st.mode=(mode==='detail')?'detail':'sheet';
    d.body.classList.toggle('gm-sheet-on',st.mode==='sheet');
    identSync(b.get());
    st.pending=false; b.render();
  }
  function toDetail(k){ var b=br(); b.sel(k); setMode('detail'); }
  function focusLine(id){ var el=root.querySelector('input[data-gs-line="'+id+'"]'); if(el)el.focus(); }
  function onClick(e){
    var t=e.target.closest('button'), b=br(); if(!t||!b||!root.contains(t))return;
    var model=b.get(), a=function(n){ return t.getAttribute('data-gs-'+n); }, v;
    if((v=a('pick'))){ v=v.split(':'); if(setPick(model,v[0],v[1],deps())){ st.open[v[0]]=false; st.deep=''; st.fresh=''; identSync(model); commit(); } }
    else if((v=a('own'))){ var id=addLine(model,v,'',deps()); if(id){ st.fresh=id; st.open[v]=false; st.deep=''; commit(); focusLine(id); } }
    else if((v=a('add'))){ if(addLine(model,v,a('s')||'',deps())){ st.fresh=''; commit(); } }
    else if((v=a('reopen'))){ st.open[v]=true; draw(true); }
    else if((v=a('close'))){ st.open[v]=false; draw(true); }
    else if((v=a('deep'))){ st.deep=(st.deep===v)?'':v; draw(true); }
    else if((v=a('del'))){ if(removeLine(model,v)){ st.deep=''; st.fresh=''; commit(); } }
    else if((v=a('detail'))){ toDetail(v); }
    else if(a('more')){ var add=d.getElementById('gmRailAdd'); if(add)add.click(); }
    else if(a('export')){ var ex=d.getElementById('btnPlayerPpt'); if(ex)ex.click(); }
  }
  function onInput(e){
    var t=e.target, b=br(); if(!t||!b||!t.getAttribute)return;
    var model=b.get();
    if(t.getAttribute('data-gs-id')){ model.identity=t.value; identSync(model); b.save(); return; }
    var id=t.getAttribute('data-gs-line'), h=id&&at(model,id);
    if(h){ setTxt(h.ph,h.xi,t.value); b.save(); }
  }
  api.draw=function(){ draw(false); };
  api.mode=function(m){ if(m)setMode(m); return st.mode; };
})(typeof window!=='undefined'?window:globalThis);
