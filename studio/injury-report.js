/* 3.378 — 가용인원 › 부상 리포트(사용자 11/25 «가용인원에 부상리포트를 만들수 있게 해줘» → 목업 A안 + «선수를 클릭하면 개인으로도» · «이미지로 저장했을 때는 a4 사이즈»).
   ⓐ 팀 한 장: 지금 부상 · 재활 / 이 기간 복귀 / 부위별. 선수 이름을 누르면 그 선수의 부상 기록 한 장(개인).
   ⓑ 새 저장 칸은 없다 — 상태 기록(statusRuns) · 부상 기록(injuryInfo) · 그날 사유를 읽기만 한다(2.943 episodes 와 같은 셈).
   ⓒ 내보내기는 «인쇄» · «이미지로 저장» 둘. 종이는 화면을 찍지 않고 A4 세로(2480×3508 · 300dpi)를 캔버스에 직접 그린다 —
      SVG foreignObject 는 사파리에서 그림이 비는 일이 있고, 폰에서 저장해도 데스크톱과 같은 한 장이어야 해서다. 인쇄도 같은 그림을 쓴다.
      넘치면 글자를 줄이지 않고 다음 쪽으로 넘긴다(이미지도 쪽마다 한 장).
   ⓓ 부상 정보는 코칭스태프 자료다 — 공유 링크를 만들지 않는다. 메모는 «코치가 적은 기록»이라고 종이에 밝힌다.
   PSInjuryReport(셈 · 쪽 나누기 · 그리기)는 DOM 없이 돈다(node 시험). 아래 ir* 함수는 scout.html 의 가용인원 화면에 붙는 글루. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSInjuryReport=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var W=794,H=1123,M=48,CW=W-M*2,BOTTOM=H-56,PX=[2480,3508];
  var INK='#14161A',GRAY='#646A73',FAINT='#8A9099',LINE='#E3E6EA',SOFT='#F1F3F5',INJ='#C24A46',INJBG='#FBECEB',RE='#B5762B',REBG='#FAF1E4';
  var SIDE={L:'왼쪽',R:'오른쪽',B:'양쪽'},WHEN={match:'경기 중',train:'훈련 중',out:'팀 밖'},ST={injury:'부상',rehab:'재활'};
  function md(ymd){var m=String(ymd||'').split('-');return m.length===3?(+m[1])+'/'+(+m[2]):'';}
  function longDate(ymd){var m=String(ymd||'').split('-');if(m.length!==3)return '';var d=new Date(+m[0],+m[1]-1,+m[2]);return (+m[0])+'. '+(+m[1])+'. '+(+m[2])+'. '+['일','월','화','수','목','금','토'][d.getDay()]+'요일';}
  function partLabel(e){if(!e)return '부위 미정';var a=[e.part||'부위 미정'];if(SIDE[e.side])a.push(SIDE[e.side]);return a.join(' · ');}
  function whoMeta(w){return [w.pos,[w.grp,w.year].filter(Boolean).join(' ')].filter(Boolean).join(' · ');}
  function whoName(w){return (w.num?w.num+' ':'')+(w.name||'이름 없음');}

  /* 셈 — rows: [{who, status, until, e(episode|null), missed:{train,match}}]. 열린 부상은 늘 넣고, 끝난 부상은 기간에 걸친 것만 */
  function team(input){
    var now=[],back=[],by={},n=0;
    (input.rows||[]).forEach(function(r){
      var e=r.e;
      if(e&&!e.open&&(e.to<input.from||e.from>input.to))return;
      if(!e||e.open)now.push(r);else back.push(r);
      n++;var k=(e&&e.part)||'부위 미정',o=by[k]||(by[k]={part:k,n:0,done:0,days:0,open:0});o.n++;
      if(!e||e.open)o.open++;else{o.done++;o.days+=e.days;}
    });
    now.sort(function(a,b){var x=(a.e&&a.e.from)||'9',y=(b.e&&b.e.from)||'9';return x<y?-1:x>y?1:String(a.who.name).localeCompare(String(b.who.name),'ko');});
    back.sort(function(a,b){return a.e.to<b.e.to?1:a.e.to>b.e.to?-1:0;});
    var parts=Object.keys(by).map(function(k){return by[k];}).sort(function(a,b){return (a.part==='부위 미정')-(b.part==='부위 미정')||b.n-a.n||(a.part<b.part?-1:1);});
    var soonTo=input.soonTo||'';
    return {teamName:input.teamName||'',today:input.today,from:input.from,to:input.to,now:now,back:back,parts:parts,total:n,
      kpi:{injury:now.filter(function(r){return r.status==='injury';}).length,rehab:now.filter(function(r){return r.status==='rehab';}).length,
        soon:now.filter(function(r){return r.until&&soonTo&&r.until<=soonTo;}).length,back:back.length}};
  }
  function partNote(o){var a=[];if(o.open)a.push('진행 중 '+o.open);if(o.done)a.push('평균 복귀 '+Math.round(o.days/o.done)+'일');return a.join(' · ');}
  function nth(n){return n+'일째';}
  function stDays(k,n,open){if(k==='rehab')return open?'재활 '+n+'일째':'재활 '+n+'일';return open?'부상 '+n+'일째':'부상 '+n+'일';}
  function titleOf(name){return name?name+' 부상 리포트':'부상 리포트';}
  function daysText(r){var e=r.e;if(!e)return '';return e.open?(md(e.from)+' · '+nth(e.days)):(md(e.from)+' – '+md(e.to));}

  /* ── 종이(A4 세로 794×1123 좌표) — ops 목록으로 쪽을 만든다. measure(text,size,weight) → 폭 ── */
  function wrap(text,size,weight,maxW,maxLines,measure){
    var out=[],line='';text=String(text||'').replace(/\s+/g,' ').trim();
    for(var i=0;i<text.length;i++){
      var ch=text[i],next=line+ch;
      if(measure(next,size,weight)<=maxW){line=next;continue;}
      var cut=line.lastIndexOf(' ');
      if(ch!==' '&&cut>line.length*0.5){out.push(line.slice(0,cut));line=line.slice(cut+1)+ch;}
      else{out.push(line.trim());line=ch===' '?'':ch;}
      if(maxLines&&out.length===maxLines)break;
    }
    if(line&&(!maxLines||out.length<maxLines))out.push(line);
    if(maxLines&&out.length===maxLines&&i<text.length){var last=out[maxLines-1];while(last&&measure(last+'…',size,weight)>maxW)last=last.slice(0,-1);out[maxLines-1]=last+'…';}
    return out;
  }
  function doc(measure,footText){
    var pages=[],page=null,y=0,again=null;
    var d={
      get y(){return y;},set y(v){y=v;},
      page:function(){page={ops:[]};pages.push(page);y=M;if(pages.length>1&&again)again(d);},
      onNext:function(fn){again=fn;},
      need:function(h){if(y+h>BOTTOM){d.page();return true;}return false;},
      text:function(s,x,yy,size,weight,color,align){page.ops.push({t:'text',s:String(s==null?'':s),x:x,y:yy,size:size,weight:weight||500,color:color||INK,align:align||'left'});},
      rect:function(x,yy,w,h,r,fill,stroke){page.ops.push({t:'rect',x:x,y:yy,w:w,h:h,r:r||0,fill:fill||'',stroke:stroke||''});},
      line:function(yy,color){page.ops.push({t:'rect',x:M,y:yy,w:CW,h:1,r:0,fill:color||LINE,stroke:''});},
      wrap:function(s,size,weight,maxW,maxLines){return wrap(s,size,weight,maxW,maxLines,measure);},
      width:function(s,size,weight){return measure(String(s),size,weight);},
      fit:function(s,size,weight,maxW){return wrap(s,size,weight,maxW,1,measure)[0]||'';},   /* 한 줄 칸 — 넘치면 말줄임(옆 칸을 덮지 않는다) */
      pill:function(s,x,yy,fg,bg){var w=measure(s,12,700)+16;d.rect(x,yy,w,20,10,bg,'');d.text(s,x+8,yy+14,12,700,fg);return w;},
      sec:function(title,small){d.need(34+44);y+=22;d.text(title,M,y,14,700);if(small)d.text(small,M+measure(title,14,700)+8,y,12,500,FAINT);y+=10;},
      done:function(){pages.forEach(function(p,i){p.ops.push({t:'rect',x:M,y:H-44,w:CW,h:1,r:0,fill:LINE,stroke:''});p.ops.push({t:'text',s:footText,x:M,y:H-26,size:12,weight:500,color:FAINT,align:'left'});
        p.ops.push({t:'text',s:(i+1)+' / '+pages.length,x:W-M,y:H-26,size:12,weight:600,color:FAINT,align:'right'});});return pages;}
    };
    return d;
  }
  var NOW_COLS=[['선수',0,160],['상태',160,56],['부위',216,106],['다친 날',322,122],['복귀 예상',444,72],['메모',516,CW-516]];
  var BACK_COLS=[['선수',0,190],['부위',190,170],['기간',360,150],['일수',510,70,'right'],['빠진 훈련 · 경기',580,CW-580,'right']];
  function thead(d,cols){cols.forEach(function(c){d.text(c[0],c[3]==='right'?M+c[1]+c[2]:M+c[1],d.y+12,12,600,FAINT,c[3]||'left');});d.y+=20;d.line(d.y);}
  function whoCell(d,w,x,yy,maxW){d.text(d.fit(whoName(w),14,700,maxW),x,yy+18,14,700);var m=whoMeta(w);if(m)d.text(d.fit(m,12,500,maxW),x,yy+35,12,500,GRAY);}

  function teamPages(model,measure){
    var d=doc(measure,'부상 기간은 다친 날부터 복귀한 날까지의 달력일입니다. 메모는 코치가 적은 기록입니다.');
    var title=titleOf(model.teamName);
    d.onNext(function(dd){dd.text(title+' · 이어서',M,dd.y+12,12,600,GRAY);dd.y+=28;});
    d.page();
    d.text(d.fit(title,20,700,CW),M,d.y+22,20,700);d.text(longDate(model.today)+' 기준 · '+md(model.from)+' – '+md(model.to),M,d.y+44,12,500,GRAY);d.y+=60;
    var k=model.kpi,boxes=[[k.injury,'부상',INJ],[k.rehab,'재활',RE],[k.soon,'7일 안 복귀 예상',INK],[k.back,'이 기간 복귀',INK]],bw=(CW-24)/4;
    boxes.forEach(function(b,i){var x=M+i*(bw+8);d.rect(x,d.y,bw,64,10,'',LINE);d.text(String(b[0]),x+12,d.y+34,28,700,b[2]);d.text(b[1],x+12,d.y+54,12,500,GRAY);});
    d.y+=64;
    /* 지금 부상 · 재활 */
    d.sec('지금 부상 · 재활',model.now.length+'명');
    if(!model.now.length){d.text('부상 · 재활 선수 0명입니다.',M,d.y+22,14,500,GRAY);d.y+=36;}
    else{
      thead(d,NOW_COLS);
      model.now.forEach(function(r){
        var e=r.e,memo=d.wrap((e&&(e.memo||(e.notes||[]).join(' / ')))||'',12,500,NOW_COLS[5][2]-4,4),h=Math.max(48,memo.length*17+14);
        if(d.need(h+1))thead(d,NOW_COLS);
        var yy=d.y,inj=r.status==='injury';
        whoCell(d,r.who,M,yy,150);
        d.pill(ST[r.status]||'부상',M+160,yy+6,inj?INJ:RE,inj?INJBG:REBG);
        d.text((e&&e.part)||'부위 미정',M+216,yy+18,14,e&&e.part?600:500,e&&e.part?INK:FAINT);if(e&&SIDE[e.side])d.text(SIDE[e.side],M+216,yy+35,12,500,GRAY);
        d.text(e?daysText(r):'기록 없음',M+322,yy+18,14,600,e?INK:FAINT);if(e&&WHEN[e.when])d.text(WHEN[e.when],M+322,yy+35,12,500,GRAY);
        d.text(r.until?md(r.until):'모름',M+444,yy+18,14,600,r.until?INK:FAINT);
        memo.forEach(function(s,i){d.text(s,M+516,yy+17+i*17,12,500,GRAY);});
        d.y=yy+h;d.line(d.y);
      });
    }
    /* 이 기간 복귀 */
    d.sec('이 기간 복귀',model.back.length+'명');
    if(!model.back.length){d.text('이 기간에 복귀한 선수 0명입니다.',M,d.y+22,14,500,GRAY);d.y+=36;}
    else{
      thead(d,BACK_COLS);
      model.back.forEach(function(r){
        if(d.need(45))thead(d,BACK_COLS);
        var yy=d.y,e=r.e;whoCell(d,r.who,M,yy,180);
        d.text(d.fit(partLabel(e),14,600,160),M+190,yy+26,14,600,e.part?INK:FAINT);
        d.text(md(e.from)+' – '+md(e.to),M+360,yy+26,14,500);
        d.text(e.days+'일',M+580,yy+26,14,600,INK,'right');
        d.text(r.missed.train+' · '+r.missed.match,M+CW,yy+26,14,600,INK,'right');
        d.y=yy+44;d.line(d.y);
      });
    }
    /* 부위별 */
    if(model.parts.length){
      d.sec('부위별',model.total+'건');d.y+=4;
      var cw=(CW-16)/3;
      model.parts.forEach(function(o,i){
        var col=i%3;if(col===0&&i)d.y+=38;if(col===0)d.need(38);
        var x=M+col*(cw+8);d.rect(x,d.y,cw,32,6,'',LINE);
        d.text(o.part,x+10,d.y+21,14,700,o.part==='부위 미정'?FAINT:INK);d.text(o.n+'건',x+10+d.width(o.part,14,700)+8,d.y+21,14,500);
        d.text(partNote(o),x+cw-10,d.y+21,12,500,GRAY,'right');
      });
      d.y+=38;
    }
    return d.done();
  }

  /* 개인 — who · today · teamName · status · until · episodes[{…episode, missed, log:[{day,note}]}](새 것부터) */
  function epFacts(m,e,isCur){
    var f=[['다친 날',md(e.from)+(WHEN[e.when]?' · '+WHEN[e.when]:'')]];
    if(e.open){f.push(['지금',stDays(m.status,m.status==='rehab'?e.rehab:e.injury,true)]);f.push(['복귀 예상',isCur&&m.until?md(m.until):'모름']);}
    else{f.push(['복귀한 날',md(e.to)]);f.push(['기간',e.days+'일']);}
    f.push(['빠진 훈련 · 경기',e.missed.train+' · '+e.missed.match]);return f;
  }
  function epBar(m,e){   /* [{k:'injury'|'rehab'|'left', days}] — 열린 부상은 복귀 예상까지 남은 날을 옅게 */
    var a=[];if(e.injury)a.push({k:'injury',days:e.injury});if(e.rehab)a.push({k:'rehab',days:e.rehab});
    if(e.open&&m.until&&m.until>m.today){var left=Math.round((Date.parse(m.until+'T00:00:00Z')-Date.parse(m.today+'T00:00:00Z'))/864e5);if(left>0)a.push({k:'left',days:left});}
    return a;
  }
  function playerPages(m,measure){
    var d=doc(measure,'코치가 적은 기록입니다. '+longDate(m.today)+(m.teamName?' · '+m.teamName:''));
    d.onNext(function(dd){dd.text(titleOf(whoName(m.who))+' · 이어서',M,dd.y+12,12,600,GRAY);dd.y+=28;});
    d.page();
    var w=m.who,nx=M;
    if(w.num){d.rect(M,d.y,48,48,10,INK,'');d.text(String(w.num),M+24,d.y+32,20,700,'#FFFFFF','center');nx=M+60;}
    d.text(d.fit(w.name||'이름 없음',20,700,W-M-nx-170),nx,d.y+22,20,700);d.text(d.fit([whoMeta(w),m.teamName].filter(Boolean).join(' · '),12,500,W-M-nx-170),nx,d.y+42,12,500,GRAY);
    d.text('부상 리포트',W-M,d.y+22,14,700,INK,'right');d.text(longDate(m.today)+' 기준',W-M,d.y+42,12,500,GRAY,'right');
    d.y+=64;d.line(d.y);
    if(!m.episodes.length){d.text('부상 기록 0건입니다.',M,d.y+30,14,500,GRAY);return d.done();}
    m.episodes.forEach(function(e,idx){
      var memo=d.wrap(e.memo||'',14,500,CW,5),log=(e.log||[]).slice(0,10).map(function(x){return {day:x.day,lines:d.wrap(x.note,14,500,CW-64,3)};});
      var logH=log.reduce(function(s,x){return s+x.lines.length*20+10;},0);
      var h=44+62+12+60+(memo.length?26+memo.length*20:0)+(log.length?34+logH:0)+16;
      d.need(Math.min(h,BOTTOM-M-40));
      var yy=d.y+26,cur=idx===0&&e.open,title=partLabel(e);
      d.text(title,M,yy,16,700,e.part?INK:FAINT);
      var px=M+d.width(title,16,700)+10;
      if(e.open)d.pill('진행 중',px,yy-15,m.status==='rehab'?RE:INJ,m.status==='rehab'?REBG:INJBG);
      else d.pill('복귀',px,yy-15,GRAY,SOFT);
      d.y=yy+16;
      var facts=epFacts(m,e,cur),fw=(CW-8*(facts.length-1))/facts.length;
      facts.forEach(function(f,i){var x=M+i*(fw+8);d.rect(x,d.y,fw,54,10,'',LINE);d.text(f[0],x+12,d.y+20,12,500,FAINT);d.text(f[1],x+12,d.y+42,14,700,f[0]==='지금'?(m.status==='rehab'?RE:INJ):INK);});
      d.y+=54+12;
      var bar=epBar(m,e),sum=bar.reduce(function(s,b){return s+b.days;},0)||1,bx=M;
      bar.forEach(function(b,i){var bw=Math.max(CW*b.days/sum,2),lb=b.k==='left'?b.days+'일':stDays(b.k,b.days,false);
        d.rect(bx,d.y,bw,26,i===0||i===bar.length-1?0:0,b.k==='injury'?INJ:b.k==='rehab'?RE:SOFT,'');
        if(d.width(lb,12,700)+12<bw)d.text(lb,bx+bw/2,d.y+17,12,700,b.k==='left'?GRAY:'#FFFFFF','center');bx+=bw;});
      d.text(md(e.from),M,d.y+42,12,500,FAINT);
      d.text(e.open?(cur&&m.until&&m.until>m.today?'오늘 '+md(m.today)+' · 복귀 예상 '+md(m.until):'오늘 '+md(m.today)):md(e.to),W-M,d.y+42,12,500,FAINT,'right');
      d.y+=60;
      if(memo.length){d.text('코치 메모',M,d.y+14,12,600,FAINT);d.y+=26;memo.forEach(function(s){d.text(s,M,d.y+14,14,500);d.y+=20;});}
      if(log.length){
        d.y+=8;d.text('날짜별 메모',M,d.y+14,12,600,FAINT);d.y+=26;
        log.forEach(function(x){var lh=x.lines.length*20+10;d.need(lh);d.text(md(x.day),M,d.y+14,12,600,GRAY);x.lines.forEach(function(s,i){d.text(s,M+64,d.y+14+i*20,14,500);});d.y+=lh;});
      }
      d.y+=16;if(idx<m.episodes.length-1)d.line(d.y);
    });
    return d.done();
  }

  /* 그리기 — ctx 는 2D 캔버스. 좌표는 794×1123, 캔버스는 2480×3508 */
  var FONT='-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic","Noto Sans KR",sans-serif';
  function font(size,weight){return (weight||500)+' '+size+'px '+FONT;}
  function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
  function paint(ctx,page){
    ctx.save();ctx.setTransform(PX[0]/W,0,0,PX[1]/H,0,0);ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);ctx.textBaseline='alphabetic';
    page.ops.forEach(function(o){
      if(o.t==='rect'){if(o.r)rr(ctx,o.x,o.y,o.w,o.h,o.r);else{ctx.beginPath();ctx.rect(o.x,o.y,o.w,o.h);}
        if(o.fill){ctx.fillStyle=o.fill;ctx.fill();}if(o.stroke){ctx.strokeStyle=o.stroke;ctx.lineWidth=1;ctx.stroke();}}
      else{ctx.font=font(o.size,o.weight);ctx.fillStyle=o.color;ctx.textAlign=o.align;ctx.fillText(o.s,o.x,o.y);}
    });
    ctx.restore();
  }
  function measurer(ctx){return function(s,size,weight){ctx.font=font(size,weight);return ctx.measureText(s).width;};}
  return {W:W,H:H,PX:PX,M:M,BOTTOM:BOTTOM,team:team,teamPages:teamPages,playerPages:playerPages,paint:paint,measurer:measurer,wrap:wrap,
    md:md,longDate:longDate,partLabel:partLabel,partNote:partNote,whoMeta:whoMeta,whoName:whoName,daysText:daysText,stDays:stDays,titleOf:titleOf,epFacts:epFacts,epBar:epBar,SIDE:SIDE,WHEN:WHEN,ST:ST};
});

/* ══ 가용인원 화면 글루(scout.html 전역을 쓴다 — avail-table.js 와 같은 방식) ══ */
var availInjPlayer=null,irDiag=[];
function irNote(e){irDiag.push(String((e&&e.message)||e));if(irDiag.length>20)irDiag.shift();if(typeof console!=='undefined'&&console.error)console.error('[injury-report]',e);}
function irSay(m){if(typeof toast==='function')toast(m);}
function irWho(p){
  var g=plGrpOf(p),y=(typeof avYearKey==='function')?avYearKey(p):'';
  return {id:p.id,num:String(p.num||'').trim(),name:p.name||'',pos:avPosition(p),grp:g?(tmGrpLabel(g)||g):'',year:y?avYearLabel(y):''};
}
/* 그 부상 동안 빠진 훈련 · 경기(일정이 있던 날만) + 날짜별 사유(같은 글이 이어지면 첫날만) */
function irWalk(p,e){
  var out={train:0,match:0,log:[]},last='',day=e.from,guard=0;
  while(day<=e.to&&guard++<400){
    var r=avResolve(p,day);
    if(r&&(r.s==='injury'||r.s==='rehab')){if(r.kind==='train')out.train++;else if(r.kind==='match')out.match++;}
    var n=r&&r.note?String(r.note).trim():'';if(n&&n!==last&&n!==String(e.memo||'').trim()){out.log.push({day:day,note:n});}if(n)last=n;
    day=stAddDays(day,1);
  }
  return out;
}
function irTeamModel(ours,from,to){
  var today=stYmd(),rows=[];
  ours.forEach(function(p){
    var st=plStatusOf(p),eps=stEpisodes(p),who=irWho(p),open=false;
    eps.forEach(function(e){if(e.open)open=true;if(!e.open&&(e.to<from||e.from>to))return;var w=irWalk(p,e);rows.push({who:who,status:e.open?st:'',until:e.open&&p.statusUntil?String(p.statusUntil):'',e:e,missed:{train:w.train,match:w.match}});});
    if(ST_SPAN[st]&&!open)rows.push({who:who,status:st,until:p.statusUntil?String(p.statusUntil):'',e:null,missed:{train:0,match:0}});   /* 상태는 부상인데 기간 기록이 없는 선수도 빠뜨리지 않는다 */
  });
  return PSInjuryReport.team({teamName:String((data.meta&&data.meta.teamName)||'').trim(),today:today,from:from,to:to,soonTo:stAddDays(today,7),rows:rows});
}
function irPlayerModel(p){
  var today=stYmd(),eps=stEpisodes(p).slice().reverse().slice(0,8).map(function(e){var w=irWalk(p,e),o={};for(var k in e)o[k]=e[k];o.missed={train:w.train,match:w.match};o.log=w.log;if(!o.memo&&e.notes&&e.notes.length&&!w.log.length)o.memo=e.notes.join(' / ');return o;});
  return {who:irWho(p),teamName:String((data.meta&&data.meta.teamName)||'').trim(),today:today,status:plStatusOf(p),until:p.statusUntil?String(p.statusUntil):'',episodes:eps};
}
function irActions(){return '<span class="ir-act"><button type="button" data-ir-out="print">인쇄</button><button type="button" class="ir-pri" data-ir-out="image">이미지로 저장</button></span>';}
function irNameBtn(w){return '<button type="button" class="av-player-link" data-ir-player="'+esc(w.id)+'" aria-label="'+esc(PSInjuryReport.titleOf(w.name||'선수'))+'">'+esc(PSInjuryReport.whoName(w))+'</button>';}
function irStatePill(s){return '<span class="ir-st '+(s==='rehab'?'ir-re':'ir-inj')+'">'+esc(PSInjuryReport.ST[s]||'부상')+'</span>';}
function renderAvailInjury(ours,from,to){
  var R=PSInjuryReport,can=typeof avCanEdit==='function'&&avCanEdit()&&(tmCanApprove()||tmCanEditStatus());
  var one=availInjPlayer&&ours.find(function(x){return String(x.id)===String(availInjPlayer);});
  if(availInjPlayer&&!one)availInjPlayer=null;
  if(one)return irPlayerHTML(one,can);
  var m=irTeamModel(ours,from,to),k=m.kpi;
  var h='<section class="av-pn ir" id="avInjReport" tabindex="-1" aria-label="부상 리포트"><div class="ir-h"><div><b class="ir-t">'+esc(R.titleOf(m.teamName))+'</b><small>'+esc(R.longDate(m.today)+' 기준 · '+R.md(from)+' – '+R.md(to))+'</small></div>'+irActions()+'</div>'
    +'<dl class="ir-kpi"><div class="ir-inj"><dd>'+k.injury+'</dd><dt>부상</dt></div><div class="ir-re"><dd>'+k.rehab+'</dd><dt>재활</dt></div><div><dd>'+k.soon+'</dd><dt>7일 안 복귀 예상</dt></div><div><dd>'+k.back+'</dd><dt>이 기간 복귀</dt></div></dl>';
  h+='<div class="ir-sec"><b>지금 부상 · 재활</b><small>'+m.now.length+'명 · 이름을 누르면 그 선수의 리포트가 열립니다</small></div>';
  if(!m.now.length)h+='<div class="av-empty">부상 · 재활 선수 0명입니다.</div>';
  else{
    h+='<table class="ir-tb ir-now"><thead><tr><th scope="col">선수</th><th scope="col">상태</th><th scope="col">부위</th><th scope="col">다친 날</th><th scope="col">복귀 예상</th><th scope="col">메모</th></tr></thead><tbody>';
    m.now.forEach(function(r){var e=r.e,w=r.who,memo=(e&&(e.memo||(e.notes||[]).join(' / ')))||'';
      var part=e&&e.part?('<b>'+esc(e.part)+'</b>'+(R.SIDE[e.side]?'<small>'+esc(R.SIDE[e.side])+'</small>':'')):(can&&e?'<button type="button" class="ir-lnk" data-inj-edit="'+esc(w.id)+'" data-inj-from="'+esc(e.from)+'">부위 적기</button>':'<span class="ir-dim">부위 미정</span>');
      h+='<tr><th scope="row">'+irNameBtn(w)+'<small>'+esc(R.whoMeta(w))+'</small></th><td data-label="상태">'+irStatePill(r.status)+'</td><td data-label="부위">'+part+'</td>'
        +'<td data-label="다친 날">'+(e?'<b class="ir-n">'+esc(R.daysText(r))+'</b>'+(R.WHEN[e.when]?'<small>'+esc(R.WHEN[e.when])+'</small>':''):'<span class="ir-dim">기록 없음</span>')+'</td>'
        +'<td data-label="복귀 예상">'+(r.until?'<b class="ir-n">'+esc(R.md(r.until))+'</b>':'<span class="ir-dim">모름</span>')+'</td>'
        +'<td data-label="메모" class="ir-memo'+(memo?'':' ir-none')+'">'+esc(memo)+'</td></tr>';});
    h+='</tbody></table>';
  }
  h+='<div class="ir-sec"><b>이 기간 복귀</b><small>'+m.back.length+'명</small></div>';
  if(!m.back.length)h+='<div class="av-empty">이 기간에 복귀한 선수 0명입니다.</div>';
  else{
    h+='<table class="ir-tb ir-back"><thead><tr><th scope="col">선수</th><th scope="col">부위</th><th scope="col">기간</th><th scope="col" class="ir-r">일수</th><th scope="col" class="ir-r">빠진 훈련 · 경기</th></tr></thead><tbody>';
    m.back.forEach(function(r){var e=r.e,w=r.who;h+='<tr><th scope="row">'+irNameBtn(w)+'<small>'+esc(R.whoMeta(w))+'</small></th><td data-label="부위">'+(e.part?esc(R.partLabel(e)):'<span class="ir-dim">부위 미정</span>')+'</td><td data-label="기간" class="ir-n">'+esc(R.md(e.from)+' – '+R.md(e.to))+'</td><td data-label="일수" class="ir-r ir-n">'+e.days+'일</td><td data-label="빠진 훈련 · 경기" class="ir-r ir-n">'+r.missed.train+' · '+r.missed.match+'</td></tr>';});
    h+='</tbody></table>';
  }
  if(m.parts.length)h+='<div class="ir-sec"><b>부위별</b><small>'+m.total+'건</small></div><ul class="ir-parts">'+m.parts.map(function(o){return '<li'+(o.part==='부위 미정'?' class="ir-nopart"':'')+'><b>'+esc(o.part)+'</b><span>'+o.n+'건</span><small>'+esc(R.partNote(o))+'</small></li>';}).join('')+'</ul>';
  return h+'<p class="av-note">부상 기간은 다친 날부터 복귀한 날까지의 달력일입니다. 메모는 코치가 적은 기록입니다. 이미지는 A4 세로 한 장으로 저장됩니다.</p></section>';
}
function irPlayerHTML(p,can){
  var R=PSInjuryReport,m=irPlayerModel(p),w=m.who;
  var h='<section class="av-pn ir ir-one" id="avInjReport" tabindex="-1" aria-label="'+esc(R.titleOf(w.name||'선수'))+'"><div class="ir-h"><button type="button" class="ir-back-btn" data-ir-player="">‹ 팀 리포트</button><span class="ir-sp"></span>'+irActions()+'</div>'
    +'<div class="ir-who">'+(w.num?'<span class="ir-no">'+esc(w.num)+'</span>':'')+'<div><b class="ir-t">'+esc(w.name||'이름 없음')+'</b><small>'+esc([R.whoMeta(w),m.teamName].filter(Boolean).join(' · '))+'</small></div></div>';
  if(!m.episodes.length)return h+'<div class="av-empty">부상 기록 0건입니다.</div></section>';
  m.episodes.forEach(function(e,idx){
    var cur=idx===0&&e.open,bar=R.epBar(m,e),sum=bar.reduce(function(s,b){return s+b.days;},0)||1;
    h+='<article class="ir-ep'+(e.open?' ir-open':'')+'"><div class="ir-ep-h"><b'+(e.part?'':' class="ir-dim"')+'>'+esc(R.partLabel(e))+'</b>'+(e.open?'<span class="ir-st '+(m.status==='rehab'?'ir-re':'ir-inj')+'">진행 중</span>':'<span class="ir-st ir-done">복귀</span>')
      +(can?'<button type="button" class="ir-lnk" data-inj-edit="'+esc(p.id)+'" data-inj-from="'+esc(e.from)+'">'+(e.part?'고치기':'부위 적기')+'</button>':'')+'</div>'
      +'<dl class="ir-facts">'+R.epFacts(m,e,cur).map(function(f){return '<div'+(f[0]==='지금'?' class="'+(m.status==='rehab'?'ir-re':'ir-inj')+'"':'')+'><dt>'+esc(f[0])+'</dt><dd class="ir-n">'+esc(f[1])+'</dd></div>';}).join('')+'</dl>'
      +'<div class="ir-bar" aria-hidden="true">'+bar.map(function(b){return '<i class="ir-b-'+b.k+'" style="flex:'+b.days+' 1 0"><span>'+(b.k==='left'?b.days+'일':esc(R.stDays(b.k,b.days,false)))+'</span></i>';}).join('')+'</div>'
      +'<div class="ir-ax ir-n"><span>'+esc(R.md(e.from))+'</span><span>'+esc(e.open?(cur&&m.until&&m.until>m.today?'오늘 '+R.md(m.today)+' · 복귀 예상 '+R.md(m.until):'오늘 '+R.md(m.today)):R.md(e.to))+'</span></div>'
      +(e.memo?'<div class="ir-sub">코치 메모</div><p class="ir-p">'+esc(e.memo)+'</p>':'')
      +(e.log.length?'<div class="ir-sub">날짜별 메모</div><ul class="ir-log">'+e.log.slice(0,10).map(function(x){return '<li><time class="ir-n">'+esc(R.md(x.day))+'</time><span>'+esc(x.note)+'</span></li>';}).join('')+'</ul>':'')+'</article>';
  });
  return h+'<p class="av-note">코치가 적은 기록입니다. 이미지는 A4 세로로 저장됩니다.</p></section>';
}
/* 내보내기 — 같은 A4 그림으로 인쇄 · 저장 */
function irCanvases(ours,from,to){
  var R=PSInjuryReport,probe=document.createElement('canvas').getContext('2d'),measure=R.measurer(probe);
  var one=availInjPlayer&&ours.find(function(x){return String(x.id)===String(availInjPlayer);});
  var pages=one?R.playerPages(irPlayerModel(one),measure):R.teamPages(irTeamModel(ours,from,to),measure);
  var name=R.titleOf(one?(one.name||'선수'):(String((data.meta&&data.meta.teamName)||'').trim()||'팀'))+' '+stYmd();
  return {name:name.replace(/[\\/:*?"<>|]/g,'_'),list:pages.map(function(pg){var c=document.createElement('canvas');c.width=R.PX[0];c.height=R.PX[1];R.paint(c.getContext('2d'),pg);return c;})};
}
function irPrint(out){
  var html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+esc(out.name)+'</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0;background:#fff}img{display:block;width:210mm;height:297mm;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>'
    +out.list.map(function(c){return '<img alt="" src="'+c.toDataURL('image/png')+'">';}).join('')+'</body></html>';
  if(typeof __pvMobile==='function'&&__pvMobile()&&typeof __pvMobilePrint==='function'){__pvMobilePrint(html);return;}
  var old=document.getElementById('irPrintFrame');if(old)old.remove();
  var f=document.createElement('iframe');f.id='irPrintFrame';f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  f.onload=function(){setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.print();}catch(e){irNote(e);irSay('브라우저의 인쇄 기능을 사용해 주세요');}},150);};
  f.srcdoc=html;document.body.appendChild(f);
}
function irBlob(c){return new Promise(function(res,rej){try{c.toBlob(function(b){b?res(b):rej(new Error('png'));},'image/png');}catch(e){rej(e);}});}
function irDownload(blob,name){var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();URL.revokeObjectURL(u);},4000);}
function irSaveImages(out){
  var names=out.list.map(function(_,i){return out.name+(out.list.length>1?' '+(i+1):'')+'.png';});
  return Promise.all(out.list.map(irBlob)).then(function(blobs){
    var touch=!!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches);
    if(touch&&navigator.share&&window.File){   /* 폰 · 아이패드: 공유 시트(이미지 저장 · 메신저). 거절되면 파일로 내려받는다 */
      try{var files=blobs.map(function(b,i){return new File([b],names[i],{type:'image/png'});});
        if(!navigator.canShare||navigator.canShare({files:files}))return navigator.share({files:files}).then(function(){return 'share';},function(err){if(err&&err.name==='AbortError')return 'cancel';blobs.forEach(function(b,i){irDownload(b,names[i]);});return 'file';});}catch(e){irNote(e);}
    }
    blobs.forEach(function(b,i){irDownload(b,names[i]);});return 'file';
  }).then(function(how){if(how==='file')irSay('A4 이미지 '+out.list.length+'장을 저장했습니다');return how;});
}
function irBind(root,ours,from,to){
  root.querySelectorAll('[data-ir-player]').forEach(function(b){b.onclick=function(){availInjPlayer=b.dataset.irPlayer||null;renderAvail();avFocusCard('avInjReport');};});
  root.querySelectorAll('[data-ir-out]').forEach(function(b){b.onclick=function(){
    var out;try{out=irCanvases(ours,from,to);}catch(e){irNote(e);irSay('리포트를 만들지 못했습니다. 새로고침 뒤 다시 눌러 주세요');return;}
    if(b.dataset.irOut==='print')irPrint(out);
    else irSaveImages(out).catch(function(e){irNote(e);irSay('이미지를 저장하지 못했습니다');});
  };});
}
(function(){if(typeof document==='undefined'||document.getElementById('ps-ir-css'))return;var st=document.createElement('style');st.id='ps-ir-css';st.textContent='#availRoot .ir{padding:16px}#availRoot .ir .ir-h{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}#availRoot .ir .ir-h>div{min-width:0;flex:1 1 220px}#availRoot .ir .ir-t{display:block;font-size:20px;font-weight:700;line-height:1.3}#availRoot .ir .ir-h small,#availRoot .ir .ir-who small{display:block;font-size:12px;font-weight:500;color:var(--dim)}#availRoot .ir .ir-sp{flex:1}#availRoot .ir .ir-act{display:inline-flex;gap:6px}#availRoot .ir .ir-act button,#availRoot .ir .ir-back-btn{min-height:36px;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--accent-blue,#2F6BFF);font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}#availRoot .ir .ir-act button.ir-pri{background:var(--accent-blue,#2F6BFF);border-color:var(--accent-blue,#2F6BFF);color:#fff}#availRoot .ir .ir-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0 0}#availRoot .ir .ir-kpi div{border:1px solid var(--line);border-radius:10px;padding:8px 12px;min-width:0}#availRoot .ir .ir-kpi dd{margin:0;font-size:28px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}#availRoot .ir .ir-kpi dt{font-size:12px;font-weight:500;color:var(--dim)}#availRoot .ir .ir-kpi .ir-inj dd,#availRoot .ir .ir-facts .ir-inj dd{color:#C24A46}#availRoot .ir .ir-kpi .ir-re dd,#availRoot .ir .ir-facts .ir-re dd{color:#B5762B}#availRoot .ir .ir-sec{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:20px 0 6px;font-size:14px}#availRoot .ir .ir-sec b{font-weight:700}#availRoot .ir .ir-sec small{font-size:12px;font-weight:500;color:var(--dim)}#availRoot .ir .ir-tb{width:100%;border-collapse:collapse;table-layout:fixed}#availRoot .ir .ir-tb th,#availRoot .ir .ir-tb td{text-align:left;padding:8px;border-top:1px solid var(--line);font-size:14px;font-weight:500;vertical-align:top;overflow-wrap:anywhere}#availRoot .ir .ir-tb thead th{border-top:0;font-size:12px;font-weight:600;color:var(--dim)}#availRoot .ir .ir-tb small{display:block;font-size:12px;font-weight:500;color:var(--dim)}#availRoot .ir .ir-tb b{font-weight:600}#availRoot .ir .ir-tb .av-player-link{font-weight:700;text-align:left}#availRoot .ir .ir-tb .ir-r{text-align:right}#availRoot .ir .ir-n{font-variant-numeric:tabular-nums}#availRoot .ir .ir-now th:nth-child(1){width:22%}#availRoot .ir .ir-now th:nth-child(2){width:10%}#availRoot .ir .ir-now th:nth-child(3){width:15%}#availRoot .ir .ir-now th:nth-child(4){width:17%}#availRoot .ir .ir-now th:nth-child(5){width:12%}#availRoot .ir .ir-back th:nth-child(1){width:24%}#availRoot .ir .ir-back th:nth-child(4){width:12%}#availRoot .ir .ir-st{display:inline-block;font-size:12px;font-weight:700;padding:1px 8px;border-radius:999px;white-space:nowrap}#availRoot .ir .ir-st.ir-inj{background:rgba(194,74,70,.12);color:#C24A46}#availRoot .ir .ir-st.ir-re{background:rgba(181,118,43,.14);color:#B5762B}#availRoot .ir .ir-st.ir-done{background:var(--line);color:var(--dim)}#availRoot .ir .ir-lnk{border:0;background:none;padding:0;min-height:32px;color:var(--accent-blue,#2F6BFF);font:inherit;font-size:14px;font-weight:600;cursor:pointer}#availRoot .ir .ir-dim{color:var(--dim)}#availRoot .ir .ir-memo{font-size:12px;color:var(--dim)}#availRoot .ir .ir-parts{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px}#availRoot .ir .ir-parts li{display:flex;align-items:baseline;gap:8px;border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:14px;min-width:0}#availRoot .ir .ir-parts b{font-weight:700}#availRoot .ir .ir-parts small{margin-left:auto;font-size:12px;color:var(--dim);text-align:right}#availRoot .ir .ir-parts .ir-nopart b{color:var(--dim)}#availRoot .ir .av-note{padding:0;margin-top:14px}#availRoot .ir .av-empty{padding:10px 0}#availRoot .ir .ir-who{display:flex;align-items:center;gap:12px;margin-top:14px}#availRoot .ir .ir-no{min-width:44px;height:44px;padding:0 6px;border-radius:10px;background:var(--txt);color:var(--surface);display:grid;place-items:center;font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}#availRoot .ir .ir-ep{border-top:1px solid var(--line);margin-top:16px;padding-top:14px}#availRoot .ir .ir-ep-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#availRoot .ir .ir-ep-h b{font-size:16px;font-weight:700}#availRoot .ir .ir-ep-h .ir-lnk{margin-left:auto}#availRoot .ir .ir-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 0}#availRoot .ir .ir-facts div{border:1px solid var(--line);border-radius:10px;padding:8px 12px;min-width:0}#availRoot .ir .ir-facts dt{font-size:12px;font-weight:500;color:var(--dim)}#availRoot .ir .ir-facts dd{margin:0;font-size:14px;font-weight:700}#availRoot .ir .ir-bar{display:flex;height:26px;border-radius:6px;overflow:hidden;margin-top:12px}#availRoot .ir .ir-bar i{display:grid;place-items:center;min-width:2px;overflow:hidden;font-style:normal;font-size:12px;font-weight:700;color:#fff;white-space:nowrap}#availRoot .ir .ir-b-injury{background:#C24A46}#availRoot .ir .ir-b-rehab{background:#B5762B}#availRoot .ir .ir-bar .ir-b-left{background:var(--line);color:var(--dim)}#availRoot .ir .ir-ax{display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:12px;color:var(--dim)}#availRoot .ir .ir-sub{margin-top:12px;font-size:12px;font-weight:600;color:var(--dim)}#availRoot .ir .ir-p{margin:4px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}#availRoot .ir .ir-log{list-style:none;margin:4px 0 0;padding:0}#availRoot .ir .ir-log li{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:14px}#availRoot .ir .ir-log li:first-child{border-top:0}#availRoot .ir .ir-log time{font-size:12px;font-weight:600;color:var(--dim);padding-top:2px}@media (max-width:600px){#availRoot .ir{padding:12px}#availRoot .ir .ir-t{font-size:16px}#availRoot .ir .ir-kpi,#availRoot .ir .ir-facts{grid-template-columns:repeat(2,minmax(0,1fr))}#availRoot .ir .ir-tb thead{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}#availRoot .ir .ir-tb,#availRoot .ir .ir-tb tbody,#availRoot .ir .ir-tb tr{display:block}#availRoot .ir .ir-tb tr{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px}#availRoot .ir .ir-tb th,#availRoot .ir .ir-tb td{border:0;padding:0}#availRoot .ir .ir-tb tbody th{display:block;padding-bottom:6px}#availRoot .ir .ir-tb td{display:flex;align-items:baseline;gap:4px 8px;flex-wrap:wrap;padding:2px 0;font-size:12px;text-align:left}#availRoot .ir .ir-tb td:before{content:attr(data-label);flex:0 0 96px;color:var(--dim)}#availRoot .ir .ir-tb td small{display:inline}#availRoot .ir .ir-tb td.ir-none{display:none}#availRoot .ir .ir-tb .ir-r{text-align:left}#availRoot .ir .ir-lnk{font-size:12px}}';(document.head||document.documentElement).appendChild(st);})();
