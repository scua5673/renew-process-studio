/* Multiple pitches share a stable world frame. Rotation changes only its viewport. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSMultiPitch=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function worldFrame(v,m){
    if(!v||!m)return v;
    var det=m.a*m.d-m.b*m.c;
    if(!isFinite(det)||Math.abs(det)<1e-9)return v;
    var ps=[[v[0],v[1]],[v[0]+v[2],v[1]],[v[0],v[1]+v[3]],[v[0]+v[2],v[1]+v[3]]].map(function(p){
      var x=p[0]-m.e,y=p[1]-m.f;return [(m.d*x-m.c*y)/det,(-m.b*x+m.a*y)/det];
    });
    var xs=ps.map(function(p){return p[0];}),ys=ps.map(function(p){return p[1];});
    var x=Math.min.apply(null,xs),y=Math.min.apply(null,ys);
    return [x,y,Math.max.apply(null,xs)-x,Math.max.apply(null,ys)-y];
  }
  function fit(r,s){
    var ratio=(s&&s.wid||68)/(s&&s.len||105),w=Math.min(r.w,r.h*ratio),h=w/ratio;
    return {x:r.x+(r.w-w)/2,y:r.y+(r.h-h)/2,w:w,h:h};
  }
  function applyPitches(doc,n){
    try{
      var board=doc.getElementById('board'); if(!board) return;
      var world=board.querySelector('#world'); if(!world) return;
      /* 멀티피치 카드는 '안정 기준 프레임(__baseVB)'으로 배치한다 — 라이브 viewBox는 창 크기·화면비·예약공간에
         따라 계속 변해, 고정 월드 좌표로 저장된 토큰과 어긋난다(리사이즈 시 토큰이 카드 위에서 밀리는 원인).
         __baseVB는 피치 고정 기하(예: [0,0,1110,740])라 창 크기와 무관 → 카드·토큰이 같은 월드 프레임을 공유해 드리프트 0. */
      var _bvb=null; try{ var _bb=doc.defaultView.__baseVB; if(_bb&&_bb.length>=4&&isFinite(_bb[2])&&_bb[2]>0) _bvb=[+_bb[0],+_bb[1],+_bb[2],+_bb[3]]; }catch(_bv){}
      _bvb=worldFrame(_bvb,world.transform.baseVal.consolidate()?.matrix);
      var spec=doc.defaultView.__getPitchSpec?.();
      if(!spec)return; // Wait for the board's specification instead of painting incomplete geometry.
      var lines=doc.defaultView.__getPitchLines?.()!==false;
      var colors=doc.defaultView.getComputedStyle(doc.documentElement),lineColor=colors.getPropertyValue('--pline').trim()||'#ffffff',gridColor=colors.getPropertyValue('--grid').trim()||'#3a6df0';
      /* 동일 조건이면 재생성 생략 — 주기적 재호출로 인한 깜박임 방지. 기준 프레임(_bvb)을 캐시 키로 사용해
         순수 리사이즈(라이브 viewBox만 변함)에는 재배치하지 않는다(같은 기준 프레임 → 같은 배치). */
      try{ var _sgt='off'; try{ if(doc.defaultView.__getGridType){_sgt=doc.defaultView.__getGridType()||'off';} else {var _sgb=doc.querySelector('#gridSeg button.on'); if(_sgb)_sgt=_sgb.getAttribute('data-g')||'off';} }catch(_g){}
        var _sig=n+'|'+(_bvb?_bvb.join(' '):(board.getAttribute('viewBox')||''))+'|'+_sgt+'|'+JSON.stringify(spec)+'|'+lines+'|'+lineColor+'|'+gridColor+'|'+(doc.documentElement.dataset.pitch||'');
        if(n>1 && world.querySelector('#ps-multipitch') && world.__psMpSig===_sig){
          /* 2.706 — 같은 조건이라 카드는 다시 안 그리더라도 **전체 피치 선·그리드는 반드시 숨긴 채** 둔다(사용자 "보드가 삐뚤어졌어": 운동장 4개 + 전체 피치 선이 함께 보여
             viewBox 가 둘을 다 담느라 판이 밀려 있었다). buildLines 가 state.pitchN 이 바뀌기 전에 새 #lineLayer 를 만들면 보이는 채로 남을 수 있다. */
          try{ ['#lineLayer','#gridLayer'].forEach(function(sel){ var el=world.querySelector(sel); if(el&&el.style.display!=='none'){ el.setAttribute('data-ps-hidden','1'); el.style.display='none'; } }); }catch(_h){}
          return; }
        world.__psMpSig=_sig; }catch(_e){}
      var NS='http://www.w3.org/2000/svg', W=1110, H=740;
      /* 옛 운동장은 새 것이 완성될 때까지 제거하지 않음(끝에서 replaceChild로 원자 교체) — 느린 기기에서 빈 프레임이 생길 여지 차단 */
      var old=world.querySelector('#ps-multipitch');
      var grid=world.querySelector('#gridLayer');
      if(n<=1){
        try{ doc.defaultView.__psPitchRects=null; }catch(_pr){}   /* 2.543 — 낡은 사각형을 남기지 않는다 */
        if(old) old.remove();
        [].slice.call(world.querySelectorAll('[data-ps-hidden]')).forEach(function(c){ c.style.display=''; c.removeAttribute('data-ps-hidden'); });
        if(grid) grid.style.display='';
        try{if(doc.defaultView.__psWmPlace)doc.defaultView.__psWmPlace();if(doc.defaultView.tiltGoalsSync)doc.defaultView.tiltGoalsSync();}catch(_){}
        return;
      }
      [].slice.call(world.children).forEach(function(c){ if(c.tagName.toLowerCase()==='g' && !c.id && c.querySelector('circle,path,line')){ c.setAttribute('data-ps-hidden','1'); c.style.display='none'; } }); ['#lineLayer','#gridLayer'].forEach(function(sel){ var el=world.querySelector(sel); if(el){ el.setAttribute('data-ps-hidden','1'); el.style.display='none'; } });
      function E(t,a){ var e=doc.createElementNS(NS,t); for(var k in a) e.setAttribute(k,a[k]); return e; }
      var _lc=lineColor,ST={stroke:_lc,'stroke-width':'1.3',fill:'none','stroke-opacity':'0.92'};
      var _goalNetSeq=0;
      function pitch(x0,y0,w,h,goalDepthCap,showGoals){
        var g=E('g',{'data-pitch-rect':[x0,y0,w,h].join(',')});
        if(!lines)return g;
        var _goalNetId='ps-mp-goal-net-'+(++_goalNetSeq), _goalMesh=Math.max(3.8,Math.min(6.4,w*.025));
        var _goalDefs=E('defs',{}),_goalPattern=E('pattern',{id:_goalNetId,patternUnits:'userSpaceOnUse',width:_goalMesh,height:_goalMesh});
        _goalPattern.appendChild(E('path',{d:'M 0 0 L '+_goalMesh+' '+_goalMesh+' M '+_goalMesh+' 0 L 0 '+_goalMesh,fill:'none',stroke:_lc,'stroke-width':'0.52','stroke-opacity':'0.58','stroke-linecap':'round'}));
        _goalDefs.appendChild(_goalPattern);g.appendChild(_goalDefs);
        function add(t,a){ for(var k in ST) if(!(k in a)) a[k]=ST[k]; g.appendChild(E(t,a)); }
        /* 2.738 — 멀티피치도 단일 보드와 같은 사다리꼴 프레임·마름모 망으로 통일한다. */
        function goalShape(yLine,dir,goW,rawDepth){
          if(showGoals===false)return;
          var center=x0+w/2,frontL=center-goW/2,frontR=center+goW/2,depth=Math.max(5,Math.min(rawDepth*1.25,goalDepthCap||Infinity)),backY=yLine+dir*depth,flare=0,backL=frontL-flare,backR=frontR+flare;
          var d='M '+frontL+' '+yLine+' L '+backL+' '+backY+' L '+backR+' '+backY+' L '+frontR+' '+yLine+' Z';
          var gg=E('g',{class:'ps-pitch-goal','data-side':dir<0?'top':'bottom','data-goal-depth':depth,'data-goal-depth-cap':goalDepthCap||Infinity});
          gg.appendChild(E('path',{class:'ps-pitch-goal-bed',d:d,fill:_lc,'fill-opacity':'0.055',stroke:'none'}));
          gg.appendChild(E('path',{class:'ps-pitch-goal-net',d:d,fill:'url(#'+_goalNetId+')',stroke:'none'}));
          gg.appendChild(E('path',{class:'ps-pitch-goal-frame',d:'M '+frontL+' '+yLine+' L '+backL+' '+backY+' L '+backR+' '+backY+' L '+frontR+' '+yLine,fill:'none',stroke:_lc,'stroke-width':'1.7','stroke-opacity':'0.9','stroke-linecap':'round','stroke-linejoin':'round'}));
          gg.appendChild(E('line',{class:'ps-pitch-goal-back',x1:backL,y1:backY,x2:backR,y2:backY,stroke:_lc,'stroke-width':'2.6','stroke-opacity':'0.98','stroke-linecap':'round'}));
          gg.appendChild(E('line',{class:'ps-pitch-goal-mouth',x1:frontL,y1:yLine,x2:frontR,y2:yLine,stroke:_lc,'stroke-width':'3.1','stroke-opacity':'1','stroke-linecap':'round'}));
          g.appendChild(gg);
        }
        // Each measurement comes from the same specification as the single pitch.
        var sp=spec,sx=w/sp.wid,sy=h/sp.len,cx=x0+w/2,cy=y0+h/2;
        function dot(x,y,r){add('circle',{cx:x,cy:y,r:r,fill:_lc,'stroke-width':0});}
        add('rect',{x:x0,y:y0,width:w,height:h,rx:Math.min(2,sx*.4)});
        add('line',{x1:x0,y1:cy,x2:x0+w,y2:cy});
        add('circle',{cx:cx,cy:cy,r:sp.cc*sx});dot(cx,cy,1.5);
        [-1,1].forEach(function(side){
          var base=side<0?y0:y0+h,dir=-side,halfGoal=sp.goal*sx/2;
          if(sp.futsal){
            var rx=sp.paR*sx,ry=sp.paR*sy,front=base+dir*ry,sweep=side<0?0:1;
            add('path',{d:'M '+(cx-halfGoal-rx)+' '+base+' A '+rx+' '+ry+' 0 0 '+sweep+' '+(cx-halfGoal)+' '+front+' L '+(cx+halfGoal)+' '+front+' A '+rx+' '+ry+' 0 0 '+sweep+' '+(cx+halfGoal+rx)+' '+base});
            var pk2=base+dir*sp.pk2*sy;dot(cx,pk2,1.2);
            [-1,1].forEach(function(sign){var x=cx+sign*5*sx;add('line',{x1:x,y1:pk2-.2*sy,x2:x,y2:pk2+.2*sy});});
            [sp.subGap,sp.subGap+sp.subZone].forEach(function(m){var y=cy+dir*m*sy;add('line',{x1:x0-.4*sx,y1:y,x2:x0+.4*sx,y2:y});});
          }else{
            var pbW=(sp.goal+2*sp.paOff)*sx,pbH=sp.paD*sy,gbW=(sp.goal+2*sp.gaOff)*sx,gbH=sp.gaD*sy;
            add('rect',{x:cx-pbW/2,y:side<0?base:base-pbH,width:pbW,height:pbH});
            add('rect',{x:cx-gbW/2,y:side<0?base:base-gbH,width:gbW,height:gbH});
            var dy=sp.paD-sp.pk,dx=Math.sqrt(Math.max(0,sp.arc*sp.arc-dy*dy))*sx,front=base+dir*pbH;
            if(dx>0)add('path',{d:'M '+(cx-dx)+' '+front+' A '+(sp.arc*sx)+' '+(sp.arc*sy)+' 0 0 '+(side<0?0:1)+' '+(cx+dx)+' '+front});
          }
          dot(cx,base+dir*sp.pk*sy,1.3);
          goalShape(base,side,sp.goal*sx,sp.goalD*sy);
        });
        var cr=sp.corner*sx;
        add('path',{d:'M '+x0+' '+(y0+cr)+' A '+cr+' '+cr+' 0 0 0 '+(x0+cr)+' '+y0});
        add('path',{d:'M '+(x0+w-cr)+' '+y0+' A '+cr+' '+cr+' 0 0 0 '+(x0+w)+' '+(y0+cr)});
        add('path',{d:'M '+(x0+w)+' '+(y0+h-cr)+' A '+cr+' '+cr+' 0 0 0 '+(x0+w-cr)+' '+(y0+h)});
        add('path',{d:'M '+(x0+cr)+' '+(y0+h)+' A '+cr+' '+cr+' 0 0 0 '+x0+' '+(y0+h-cr)});
        return g;
      }
      var grp=E('g',{id:'ps-multipitch','data-layout':_sig});
      var m=16;
      /* 보이는 viewBox 기준: 위·아래 여백 + 운동장 사이 간격(좌·우 여백보다 넓게) */
      /* 라이브 viewBox가 아니라 안정 기준 프레임 사용 — 창을 줄이고 늘려도 카드(→토큰) 위치가 고정됨 */
      var _vb=_bvb?_bvb.slice():(board.getAttribute('viewBox')||('0 0 '+W+' '+H)).split(/\s+/).map(Number);
      if(_vb.length<4||!isFinite(_vb[2])){ _vb=[0,0,W,H]; }
      var _vm=Math.max(16, Math.round(_vb[3]*0.035));               // 상·하 여백 축소 — 운동장이 화면에 더 꽉 차게
      /* 3개 초과면 2줄 그리드 (예: 6개 = 상단 3 + 하단 3) */
      var rows=n>3?2:1, cols=Math.ceil(n/rows);
      var _rg=Math.max(22, Math.round(_vb[3]*0.03));                // 줄 사이 간격
      var ph=(_vb[3]-2*_vm-_rg*(rows-1))/rows; if(!(ph>0)) ph=H-2*m;
      var _cg=Math.max(30, Math.round(_vb[2]*(cols>=3?0.028:0.05)));   // 운동장 사이 간격: 2열일 때 더 넓게
      var _sm=Math.max(10, Math.round(_vb[2]*0.013));               // 좌·우 여백(사이 간격보다 좁게)
      var cw=(_vb[2]-2*_sm-_cg*(cols-1))/cols; if(!(cw>0)) cw=_vb[2]/(cols+1);
      var cell=fit({x:0,y:0,w:cw,h:ph},spec);cw=cell.w;ph=cell.h;
      var _x0=_vb[0]+(_vb[2]-cols*cw-(cols-1)*_cg)/2;
      var _py=_vb[1]+(_vb[3]-rows*ph-(rows-1)*_rg)/2;
      /* 현재 격자/존 프리셋을 각 운동장에도 적용 — 2·3개 배치에서도 프리셋(채널·1/3·존·15존)이 보이게 */
      var _gt='off'; try{ if(doc.defaultView.__getGridType){ _gt=doc.defaultView.__getGridType()||'off'; } else { var _gb=doc.querySelector('#gridSeg button.on')||doc.querySelector('#gridSeg [data-g].on'); if(_gb)_gt=_gb.getAttribute('data-g')||'off'; } }catch(_e){}
      var _GRD=gridColor;
      function pitchGrid(pg,gx,gy,gwid,ghei){
        if(!_gt||_gt==='off')return;
        var sx=gwid/spec.wid,sy=ghei/spec.len,cx=gx+gwid/2,cy=gy+ghei/2;
        var pb=spec.futsal?gwid*.3:(spec.goal+2*spec.paOff)*sx/2,gb=spec.futsal?gwid*.1:(spec.goal+2*spec.gaOff)*sx/2;
        var pd=(spec.futsal?spec.paR:spec.paD)*sy,near=gy+pd,far=gy+ghei-pd;
        function line(x1,y1,x2,y2){pg.appendChild(E('line',{x1:x1,y1:y1,x2:x2,y2:y2,stroke:_GRD,'stroke-width':1.5,'stroke-dasharray':'6 10','stroke-opacity':.5}));}
        function v(x,y1,y2){line(x,y1==null?gy:y1,x,y2==null?gy+ghei:y2);}
        function h(y,x1,x2){line(x1==null?gx:x1,y,x2==null?gx+gwid:x2,y);}
        function shade(x,y,w,h){pg.appendChild(E('rect',{x:x,y:y,width:w,height:h,fill:_GRD,opacity:.1,stroke:'none'}));}
        if(_gt==='lanes'||_gt==='grid'||_gt==='grid15') [cx-pb,cx-gb,cx+gb,cx+pb].forEach(function(x){v(x);});
        if(_gt==='grid') [near,(near+cy)/2,(cy+far)/2,far].forEach(function(y){h(y);});
        if(_gt==='grid15'){shade(cx-pb,gy,pb-gb,ghei);shade(cx+gb,gy,pb-gb,ghei);}
        if(_gt==='thirds'||_gt==='fthird'||_gt==='grid15'){h(gy+ghei/3);h(gy+ghei*2/3);}
        // World left-to-right attack becomes top-to-bottom on the portrait cards.
        if(_gt==='fthird')shade(gx,gy+ghei*2/3,gwid,ghei/3);
        if(_gt==='zone20'){
          v(cx-pb);v(cx+pb);v(cx-gb,near,far);v(cx+gb,near,far);
          [near,cy,far].forEach(function(y){h(y);});
          [(near+cy)/2,(cy+far)/2].forEach(function(y){h(y,gx,cx-pb);h(y,cx+pb,gx+gwid);});
        }
      }
      function placePitch(x,y,w,h,cap,goals){
        var r=fit({x:x,y:y,w:w,h:h},spec);
        var g=pitch(r.x,r.y,r.w,r.h,cap,goals);
        pitchGrid(g,r.x,r.y,r.w,r.h);grp.appendChild(g);
      }
      if(n===5){
        /* 5개 특수 배치: 왼쪽 큰 운동장 1 + 오른쪽 작은 운동장 2×2 */
        var W2=_vb[2]-2*_sm, H2=_vb[3]-2*_vm;
        var _cg5=Math.max(26,Math.round(_vb[2]*0.024)), _rg5=Math.max(20,Math.round(_vb[3]*0.03));
        var WL=(W2-_cg5)*0.46, WRz=W2-WL-_cg5;
        var sw=(WRz-_cg5)/2, sh=(H2-_rg5)/2;
        var LX=_vb[0]+_sm, TY=_vb[1]+_vm;
        placePitch(LX,TY,WL,H2);
        var _goalCap5=Math.max(5,(_rg5-5)/2);   // 마주 보는 뒤 프레임(2.6u) 사이에 최소 2.4u 틈
        for(var q=0;q<4;q++){ var qc=q%2, qr=Math.floor(q/2); var qx=LX+WL+_cg5+qc*(sw+_cg5), qy=TY+qr*(sh+_rg5); placePitch(qx,qy,sw,sh,_goalCap5); }
      } else {
        /* ══ 2.543 · 운동장 사각형을 보드 문서에 내준다 ═══════════════════════════
         선수 배치(board.html `applySquadToBoard`)가 운동장이 어디 있는지 몰라서, 운동장을
         2~6개로 나눠 놔도 **한 판 좌표**에 그대로 쏟아 놓았다(사용자: "운동장갯수에 따라
         전부 배치하면서 운동장에 맞게").
         ⚠ 같은 계산을 board.html 에 **복사하지 않는다** — 카드를 그리는 곳과 선수를 놓는 곳이
            제각기 세면 언젠가 어긋나고, 그때 화면은 «여기 있다»고 거짓말을 한다.
            그리는 이 자리에서 결과를 그대로 넘긴다. */
      var _rects=[],_goalCap=rows>1?Math.max(5,(_rg-5)/2):Infinity;   // 2행의 위·아래 골망/프레임이 맞닿지 않게 간격 기반 제한
      for(var i=0;i<n;i++){ var _r=Math.floor(i/cols), _c=i%cols; var _px=_x0+_c*(cw+_cg), _pyr=_py+_r*(ph+_rg); placePitch(_px,_pyr,cw,ph,_goalCap);
        _rects.push({x:_px,y:_pyr,w:cw,h:ph}); }
      }
      var _rects=Array.from(grp.children).filter(function(g){return g.hasAttribute('data-pitch-rect');}).map(function(g){var r=g.getAttribute('data-pitch-rect').split(',').map(Number);return {x:r[0],y:r[1],w:r[2],h:r[3]};});
      try{ doc.defaultView.__psPitchRects=_rects; }catch(_pr){}
      if(old&&old.parentNode===world){ world.replaceChild(grp,old); }   // 원자 교체 — 옛/새 그룹 사이 빈 순간 없음
      else { var tl=world.querySelector('#tokenLayer'); if(tl) world.insertBefore(grp,tl); else world.appendChild(grp); }
      try{if(doc.defaultView.__psWmPlace)doc.defaultView.__psWmPlace();if(doc.defaultView.tiltGoalsSync)doc.defaultView.tiltGoalsSync();}catch(_){}
    }catch(e){}
  }
  return {apply:applyPitches,worldFrame:worldFrame,fit:fit};
});
