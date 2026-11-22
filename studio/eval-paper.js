/* PROCESS STUDIO — 선수 평가서 · 선수 추천서 (A4 세로 한 장씩)
   사용자 목업 승인 2026-11-22(`processstudio-문서/UI-선수평가서-A4-목업-2026-11-22.html`).
   · 평가서 = 스태프용 기록. 포지션 · 5영역 레이더 · 경기 훈련 표 · 강점 · 키울 것 · 항목 전체 · 종합 의견.
   · 추천서 = 진학 · 외부 제출용. 포지션 · 레이더 · 기본 정보 · 기록 표 · 코치가 고른 강점 · 추천 의견 · 서명.
   이 파일은 **그리기만** 한다 — 받은 값으로 HTML 문자열을 돌려준다. 저장 · 읽기 · 인쇄는 부르는 쪽(idp.html) 몫.
   ⚠ 항목은 평가 표준(eval-standard.js) 그대로 받는다. 여기서 항목을 만들지 않는다.
   ⚠ 색은 둘뿐: 보라(#7C4DFF) = 경기에서 해내는 항목(3 이상) · 회색 = 훈련 단계. 낮은 쪽에 경고색을 쓰지 않는다.
   ⚠ idp.html 의 인쇄는 `@page{size:A4;margin:12mm}` 이라 종이 안쪽은 186 × 273mm — `.evp` 가 그 크기다. */
(function(root){
  'use strict';
  var C='#7C4DFF';
  /* 세부평가 종이(idp.html POS_XY)와 같은 자리표 — 세로 운동장, 위가 상대 골문 */
  var POS_XY={ST:[50,10],SS:[50,19],LW:[15,14],RW:[85,14],AM:[35,30],CM:[65,30],DM:[50,40],
    LWB:[13,46],RWB:[87,46],LB:[13,66],LCB:[33,68],CB:[50,70],RCB:[67,68],RB:[87,66],GK:[50,86]};
  var SCALE=['','아직','훈련에서','경기에서','압박에서도','내 무기'];
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ v=+v; return (v>=1&&v<=5)?Math.round(v):0; }
  function f1(v){ return (Math.round(v*10)/10).toFixed(1); }

  function pitch(main,subs){
    subs=(subs||[]).filter(function(k){ return k!==main&&POS_XY[k]; });
    var keys=Object.keys(POS_XY), order=keys.filter(function(k){ return k!==main&&subs.indexOf(k)<0; }).concat(subs);
    if(POS_XY[main])order.push(main);
    var h='<svg viewBox="0 0 100 132" class="evp-pitch" role="img" aria-label="'+esc('포지션 — 주 '+(main||'미정')+(subs.length?' · 보조 '+subs.join(' '):''))+'">'
      +'<rect x="4" y="4" width="92" height="124" rx="2" fill="#fafbfc" stroke="#c9ced6" stroke-width="1.2"/>'
      +'<line x1="4" y1="66" x2="96" y2="66" stroke="#c9ced6"/><circle cx="50" cy="66" r="10" fill="none" stroke="#c9ced6"/>'
      +'<rect x="28" y="4" width="44" height="16" fill="none" stroke="#c9ced6"/><rect x="28" y="112" width="44" height="16" fill="none" stroke="#c9ced6"/>';
    order.forEach(function(k){ var c=POS_XY[k], x=(4+c[0]/100*92).toFixed(1), y=4+c[1]/100*124;
      if(k===main)h+='<circle cx="'+x+'" cy="'+y.toFixed(1)+'" r="10" fill="none" stroke="'+C+'" stroke-width="1.2"/>'
        +'<circle cx="'+x+'" cy="'+y.toFixed(1)+'" r="8" fill="'+C+'"/>'
        +'<text x="'+x+'" y="'+(y+2).toFixed(1)+'" text-anchor="middle" font-size="5.6" font-weight="800" fill="#fff">'+k+'</text>';
      else if(subs.indexOf(k)>=0)h+='<circle cx="'+x+'" cy="'+y.toFixed(1)+'" r="6.4" fill="#fff" stroke="'+C+'" stroke-width="1.6"/>'
        +'<text x="'+x+'" y="'+(y+1.6).toFixed(1)+'" text-anchor="middle" font-size="4.2" font-weight="800" fill="'+C+'">'+k+'</text>';
      else h+='<circle cx="'+x+'" cy="'+y.toFixed(1)+'" r="3" fill="#E3E6EA"/>'; });
    return h+'</svg>';
  }
  function posLegend(main,subs,mainName){
    subs=(subs||[]).filter(function(k){ return k!==main; });
    return '<div class="evp-posleg"><span><i class="m"></i>주 <b>'+esc(main||mainName||'미정')+'</b>'
      +((main&&mainName&&mainName!==main)?' <u>'+esc(mainName)+'</u>':'')+'</span>'
      +(subs.length?'<span><i class="sb"></i>보조 <b>'+esc(subs.join(' · '))+'</b></span>':'')+'</div>';
  }
  /* rows: [{lb, en, now, prev}] — now · prev 는 1~5 평균 또는 null(평가 전) */
  function radar(rows,o){
    o=o||{}; var size=220, cx=size/2, cy=size/2+4, R=size*0.34, N=rows.length;
    if(N<3)return '';
    function pt(i,r){ var a=-Math.PI/2+i*2*Math.PI/N; return [cx+r*Math.cos(a),cy+r*Math.sin(a)]; }
    function poly(key){ var any=false, ps=rows.map(function(x,i){ var v=x[key]; if(v!=null)any=true;
      var q=pt(i,Math.max(.05,(v||0)/5)*R); return q[0].toFixed(1)+','+q[1].toFixed(1); }); return any?ps.join(' '):''; }
    var h='<svg viewBox="0 -6 '+size+' '+(size+16)+'" class="evp-radar" role="img" aria-label="5영역 레이더">', k, i, q;
    for(k=1;k<=5;k++){ var ps=[]; for(i=0;i<N;i++){ q=pt(i,R*k/5); ps.push(q[0].toFixed(1)+','+q[1].toFixed(1)); }
      h+='<polygon points="'+ps.join(' ')+'" fill="none" stroke="#E3E6EA"/>'; }
    for(i=0;i<N;i++){ q=pt(i,R); h+='<line x1="'+cx+'" y1="'+cy+'" x2="'+q[0].toFixed(1)+'" y2="'+q[1].toFixed(1)+'" stroke="#E3E6EA"/>'; }
    var pp=o.noPrev?'':poly('prev');
    if(pp)h+='<polygon points="'+pp+'" fill="none" stroke="#8a8f98" stroke-width="1.5" stroke-dasharray="5 4"/>';
    var pn=poly('now');
    if(pn){ h+='<polygon points="'+pn+'" fill="rgba(124,77,255,.14)" stroke="'+C+'" stroke-width="2.2" stroke-linejoin="round"/>';
      rows.forEach(function(x,j){ if(x.now==null)return; var d=pt(j,Math.max(.05,x.now/5)*R);
        h+='<circle cx="'+d[0].toFixed(1)+'" cy="'+d[1].toFixed(1)+'" r="3" fill="'+C+'"/>'; }); }
    rows.forEach(function(x,j){ var l=pt(j,R+17), sub=o.en?(x.en||''):(x.now==null?'평가 전':f1(x.now));
      h+='<text x="'+l[0].toFixed(1)+'" y="'+(l[1]+1).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#14171c">'+esc(x.lb)+'</text>'
        +'<text x="'+l[0].toFixed(1)+'" y="'+(l[1]+12).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#6b7280">'+esc(sub)+'</text>'; });
    return h+'</svg>';
  }
  function delta(v,pv){ v=num(v); pv=num(pv);
    if(!v||!pv||v===pv)return '<em></em>';
    return '<em>'+(v>pv?'↑':'↓')+Math.abs(v-pv)+'</em>'; }
  function seg(v){ var h='<span class="evp-seg">'; for(var k=1;k<=5;k++)h+='<i'+(v&&k<=v?' class="on"':'')+'></i>'; return h+'</span>'; }
  function itemRow(it){ var v=num(it.v);
    return '<div class="evp-dr'+(v>=3?' hi':'')+'"><span>'+esc(it.name)+'</span>'+seg(v)+'<b>'+(v||'–')+'</b>'+delta(v,it.pv)+'</div>'; }
  function hlRow(it){ var v=num(it.v);
    return '<div class="evp-hl"><b>'+esc(it.name)+'</b><span>'+esc(it.word||SCALE[v]||'')+'</span>'+delta(v,it.pv)+'</div>'; }
  /* rows: [{k, en, n, t, r}] — 없는 값은 '—' */
  function table(heads,rows,en){
    function c(v){ return (v==null||v==='')?'—':esc(v); }
    return '<table class="evp-tb"><thead><tr>'+heads.map(function(x){
        return '<th>'+esc(x[0])+((en&&x[1])?' <u>'+esc(x[1])+'</u>':'')+'</th>'; }).join('')+'</tr></thead><tbody>'
      +rows.map(function(r){ return '<tr><td>'+esc(r.k)+((en&&r.en)?' <u>'+esc(r.en)+'</u>':'')+'</td><td>'+c(r.n)+'</td><td>'+c(r.t)+'</td><td>'+c(r.r)+'</td></tr>'; }).join('')+'</tbody></table>';
  }
  function kv(rows,en){
    return '<table class="evp-tb kv"><tbody>'+rows.map(function(r){
      return '<tr><td>'+esc(r[0])+((en&&r[2])?' <u>'+esc(r[2])+'</u>':'')+'</td><td>'+esc(r[1])+'</td></tr>'; }).join('')+'</tbody></table>';
  }
  function head(d,title,sub,en,lock){
    return '<header class="evp-hd"><div class="evp-ph">'+(d.photo?'<img src="'+esc(d.photo)+'" alt="">':esc(d.num||''))+'</div>'
      +'<div class="evp-nm"><h3>'+esc(d.name||'선수')+'</h3><p>'+esc(d.meta||'')+'</p></div>'
      +'<div class="evp-doc"><b>'+esc(title)+'</b>'+(en?'<span class="en">'+esc(en)+'</span>':'')
      +'<span>'+esc(sub)+'</span>'+(lock?'<span class="lock">'+esc(lock)+'</span>':'')+'</div></header>';
  }
  function foot(left,right){ return '<footer class="evp-ft"><span><b>PRO</b>CESS STUDIO · '+esc(left)+'</span><span>'+esc(right)+'</span></footer>'; }
  var BASIS='평가 표준 v1 — FIFA Talent ID 5차원 · FIFA Football Language · FA 4 Corner';
  var TH=[['구분'],['횟수','Count'],['시간','Minutes'],['비율','Rate']];

  /* ── 평가서(스태프용) ─────────────────────────────────────────────────────────────── */
  function evalSheet(d){
    d=d||{}; var pos=d.pos||{}, hasPrev=(d.radar||[]).some(function(x){ return x.prev!=null; });
    var h='<article class="evp">'+head(d,'선수 평가서',[d.label,d.date].filter(Boolean).join(' · '),'', '스태프 전용');
    h+='<section class="evp-top"><div class="evp-blk"><h4>포지션</h4>'+pitch(pos.main,pos.subs)+posLegend(pos.main,pos.subs,pos.name)+'</div>'
      +'<div class="evp-blk"><h4>5영역 평가 <small>항목 평균</small></h4>'+radar(d.radar||[])
      +'<div class="evp-lg"><span><i class="now"></i>이번 평가</span>'+(hasPrev?'<span><i class="prv"></i>'+esc(d.prevLabel||'지난 평가서')+'</span>':'')+'</div></div>'
      +'<div class="evp-blk"><h4>경기 · 훈련'+(d.period?' <small>'+esc(d.period)+'</small>':'')+'</h4>'
      +((d.table&&d.table.length)?table(TH,d.table):'<p class="evp-none">기록이 아직 없습니다</p>')+'</div></section>';
    h+='<section class="evp-mid"><div class="evp-blk"><h4>강점 3</h4>'+((d.strengths||[]).map(hlRow).join('')||'<p class="evp-none">평가 전</p>')+'</div>'
      +'<div class="evp-blk"><h4>키울 것 3</h4>'+((d.grows||[]).map(hlRow).join('')||'<p class="evp-none">평가 전</p>')+'</div></section>';
    h+='<section class="evp-all"><h4>항목 전체 <small>1 아직 · 2 훈련에서 · 3 경기에서 · 4 압박에서도 · 5 내 무기 · <i class="k hi"></i>보라 = 경기에서 해내는 항목(3 이상) · <i class="k"></i>회색 = 훈련 단계'
      +(hasPrev?' · ↑1 = 한 칸 위':'')+' · – = 평가 전</small></h4><div class="evp-cards">'
      +(d.groups||[]).map(function(g){ return '<div class="evp-card"><h4>'+esc(g.cat)+'</h4>'+g.items.map(itemRow).join('')+'</div>'; }).join('')
      +'</div></section>';
    h+='<section class="evp-op"><h4>코치 종합 의견</h4><div class="evp-txt">'+esc(d.opinion||'')+'</div></section>';
    return h+foot(BASIS,d.author?'작성 · '+d.author:'')+'</article>';
  }
  /* ── 추천서(진학 · 외부 제출) ────────────────────────────────────────────────────── */
  function recoLetter(d){
    d=d||{}; var pos=d.pos||{};
    var h='<article class="evp ext">'+head(d,'선수 추천서',[d.to?d.to+' 귀중':'',d.date].filter(Boolean).join(' · '),'Player Recommendation','');
    h+='<section class="evp-top"><div class="evp-blk"><h4>포지션 <small>Position</small></h4>'+pitch(pos.main,pos.subs)+posLegend(pos.main,pos.subs,pos.name)+'</div>'
      +'<div class="evp-blk"><h4>5영역 평가 <small>Player profile · 코치 평가</small></h4>'+radar(d.radar||[],{en:true,noPrev:true})+'</div>'
      +'<div class="evp-blk"><h4>기본 정보 <small>Profile</small></h4>'+((d.profile&&d.profile.length)?kv(d.profile,true):'<p class="evp-none">—</p>')
      +((d.career&&d.career.length)?'<h4 class="gap">걸어온 길 <small>Career</small></h4>'+kv(d.career,false):'')+'</div></section>';
    if(d.table&&d.table.length)h+='<section class="evp-mid one"><div class="evp-blk"><h4>경기 · 훈련 <small>Matches · Training'+(d.period?' · '+esc(d.period):'')+'</small></h4>'
      +table(TH,d.table,true)+'</div></section>';
    if(d.strengths&&d.strengths.length)h+='<section class="evp-str"><h4>이 선수의 강점 <small>Strengths</small></h4><div class="evp-s3">'
      +d.strengths.slice(0,3).map(function(s,i){ return '<div><i>'+(i+1)+'</i><b>'+esc(s.name)+'</b>'+(s.en?'<u>'+esc(s.en)+'</u>':'')+'<p>'+esc(s.text||'')+'</p></div>'; }).join('')
      +'</div></section>';
    h+='<section class="evp-op"><h4>추천 의견 <small>Recommendation</small></h4><div class="evp-txt">'+esc(d.opinion||'')+'</div></section>';
    h+='<section class="evp-sign"><div><span>추천인 Referee</span><b>'+esc(d.referee||'')+'</b></div>'
      +'<div><span>연락처 Contact</span><b>'+esc(d.contact||'')+'</b></div><div><span>서명 Signature</span><b class="line"></b></div></section>';
    return h+foot(BASIS,d.date||'')+'</article>';
  }
  /* 강점 · 키울 것 고르기 — 평가한 항목만. 같은 값이면 포지션 항목이 먼저(그 자리의 핵심) */
  function pick(groups,n,low){
    var all=[]; (groups||[]).forEach(function(g,gi){ g.items.forEach(function(it,ii){ var v=num(it.v); if(!v)return;
      all.push({id:it.id,name:it.name,en:it.en,q:it.q,v:v,pv:num(it.pv),pos:!!g.pos,o:gi*100+ii}); }); });
    all.sort(function(a,b){ return (low?a.v-b.v:b.v-a.v)||((b.pos?1:0)-(a.pos?1:0))||(a.o-b.o); });
    return all.filter(function(x){ return low?x.v<=3:x.v>=3; }).slice(0,n||3);
  }
  /* 영역 평균 — 답한 항목만. 하나도 없으면 null(레이더에 «평가 전») */
  function avg(items,key){ var s=0,n=0; (items||[]).forEach(function(it){ var v=num(it[key||'v']); if(v){ s+=v; n++; } }); return n?s/n:null; }

  /* 팀이 적은 포지션 이름 → 자리표의 코드. 모르는 이름은 '' (그림에는 표시 없이 이름만 적는다).
     LM · RM 은 세부평가 종이(normPos)와 같게 윙백 자리로 본다. */
  var POS_ALIAS={CF:'ST',FW:'ST',LM:'LWB',RM:'RWB',LDM:'DM',RDM:'DM',CDM:'DM',LCM:'CM',RCM:'CM',CAM:'AM',LAM:'AM',RAM:'AM'};
  function posCode(name){ var k=String(name||'').toUpperCase().replace(/[^A-Z]/g,''); k=POS_ALIAS[k]||k; return POS_XY[k]?k:''; }
  var EN_CAT={tac:'Tactical',tech:'Technical',fit:'Physical',psy:'Psychological',att:'Social'};
  /* 평가표 묶음(sqEvalItemsFor) + 눈금 → 종이가 읽는 모양. std 는 평가 표준 사전(없어도 돈다) */
  function shape(gs,lv,pv,std){
    lv=lv||{}; pv=pv||{};
    return (gs||[]).map(function(g){ var pos=g.cid==='pos';
      return {cat:String(g.cat||'').replace(/^포지션 · /,'포지션 · '),cid:g.cid,pos:pos,en:EN_CAT[g.cid]||'',
        items:g.items.map(function(it){ var sid=it.std||it.id, v=num(lv[it.id]), d=(std&&std.byId&&std.byId[sid])||null, w='';
          try{ w=(v&&std&&std.scaleLabel)?(std.scaleLabel(v,sid)||''):''; }catch(e){ w=''; }
          return {id:it.id,name:it.name,en:d?d.en:'',v:v,pv:num(pv[it.id]),word:w||SCALE[v]||'',b:!!(std&&std.scaleOf&&std.scaleOf(sid)==='B')}; })}; });
  }
  function radarRows(groups){ return (groups||[]).filter(function(g){ return !g.pos; }).map(function(g){
    return {lb:g.cat,en:g.en,now:avg(g.items,'v'),prev:avg(g.items,'pv')}; }); }
  /* 추천서의 강점 한 줄 — 눈금을 문장으로. 태도 항목(B 눈금)은 빈도로 말한다 */
  function phrase(v,b){ v=num(v);
    if(b)return v>=5?'늘 보여 줍니다.':v===4?'자주 보여 줍니다.':'경기와 훈련에서 보여 줍니다.';
    return v>=5?'이 선수의 무기입니다.':v===4?'압박이 강한 경기에서도 꾸준히 해냅니다.':'경기에서 해냅니다.'; }
  function pct(a,b){ return b>0?Math.round(a/b*100)+'%':''; }
  function comma(n){ return String(Math.round(+n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
  /* 경기 · 훈련 표의 줄 — 있는 기록만. st = 팀 집계(teamEvalStats) · self = 선수가 적은 출전 · solo = 개인 훈련 */
  function rows(st,self,solo){
    var out=[], m=st&&st.match, t=st&&st.train;
    if(m&&m.total){ out.push({k:'선발',en:'Starts',n:m.start+' / '+m.total+'경기',r:pct(m.start,m.total)});
      out.push({k:'리저브',en:'On the bench',n:m.res+'경기'}); }
    if(self&&self.n)out.push({k:'출전 · 선수 기록',en:'Appearances (self-reported)',n:self.n+'경기',t:self.mins?comma(self.mins)+'분':''});
    if(m&&m.total)out.push({k:'득점',en:'Goals',n:String(m.goals)});
    if(t&&t.scheduled)out.push({k:'팀 훈련',en:'Team training',n:t.done+' / '+t.scheduled+'회',t:t.minutes?comma(t.minutes)+'분':'',r:pct(t.done,t.scheduled)});
    if(solo&&solo.n)out.push({k:'개인 훈련',en:'Individual training',n:solo.n+'회',t:solo.mins?comma(solo.mins)+'분':''});
    return out;
  }
  root.PSEvalPaper={ evalSheet:evalSheet, recoLetter:recoLetter, pick:pick, avg:avg, pitch:pitch, radar:radar, posCode:posCode, shape:shape,
    radarRows:radarRows, phrase:phrase, rows:rows, SCALE:SCALE, POS_XY:POS_XY, BASIS:BASIS };
})(typeof window!=='undefined'?window:globalThis);
