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
      var spec=doc.defaultView.__getPitchSpec?.()||{len:105,wid:68};
      /* 동일 조건이면 재생성 생략 — 주기적 재호출로 인한 깜박임 방지. 기준 프레임(_bvb)을 캐시 키로 사용해
         순수 리사이즈(라이브 viewBox만 변함)에는 재배치하지 않는다(같은 기준 프레임 → 같은 배치). */
      try{ var _sgt='off'; try{ if(doc.defaultView.__getGridType){_sgt=doc.defaultView.__getGridType()||'off';} else {var _sgb=doc.querySelector('#gridSeg button.on'); if(_sgb)_sgt=_sgb.getAttribute('data-g')||'off';} }catch(_g){}
        var _sig=n+'|'+(_bvb?_bvb.join(' '):(board.getAttribute('viewBox')||''))+'|'+_sgt+'|'+JSON.stringify(spec)+'|'+(doc.documentElement.dataset.pitch||'');
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
      function _psLum(c){c=(c||'').trim();var r,g,bl;if(c.charAt(0)==='#'){var v=c.slice(1);if(v.length===3)v=v.split('').map(function(x){return x+x;}).join('');var n=parseInt(v,16)||0;r=(n>>16)&255;g=(n>>8)&255;bl=n&255;}else{var m=c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);if(!m)return 0.5;r=+m[1];g=+m[2];bl=+m[3];}return (0.2126*r+0.7152*g+0.0722*bl)/255;}var _pbg='';try{_pbg=(doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue('--pitchbg')||'').trim();}catch(_e){}var _light=_psLum(_pbg)>0.6;var _lc=_light?'#5f6a78':'#ffffff'; var ST={stroke:_lc,'stroke-width':'1.3',fill:'none','stroke-opacity':'0.92'};
      var _goalNetSeq=0;
      function pitch(x0,y0,w,h,goalDepthCap,showGoals){
        var g=E('g',{'data-pitch-rect':[x0,y0,w,h].join(',')}), _goalNetId='ps-mp-goal-net-'+(++_goalNetSeq), _goalMesh=Math.max(3.8,Math.min(6.4,w*.025));
        var _goalDefs=E('defs',{}),_goalPattern=E('pattern',{id:_goalNetId,patternUnits:'userSpaceOnUse',width:_goalMesh,height:_goalMesh});
        _goalPattern.appendChild(E('path',{d:'M 0 0 L '+_goalMesh+' '+_goalMesh+' M '+_goalMesh+' 0 L 0 '+_goalMesh,fill:'none',stroke:_lc,'stroke-width':'0.52','stroke-opacity':'0.58','stroke-linecap':'round'}));
        _goalDefs.appendChild(_goalPattern);g.appendChild(_goalDefs);
        function add(t,a){ for(var k in ST) if(!(k in a)) a[k]=ST[k]; g.appendChild(E(t,a)); }
        /* 2.738 — 멀티피치도 단일 보드와 같은 사다리꼴 프레임·마름모 망으로 통일한다. */
        function goalShape(yLine,dir,goW,rawDepth){
          if(showGoals===false)return;
          var center=x0+w/2,frontL=center-goW/2,frontR=center+goW/2,depth=Math.max(5,Math.min(rawDepth*1.25,goalDepthCap||Infinity)),backY=yLine+dir*depth,flare=0,backL=frontL-flare,backR=frontR+flare;
          var d='M '+frontL+' '+yLine+' L '+backL+' '+backY+' L '+backR+' '+backY+' L '+frontR+' '+yLine+' Z';
          var gg=E('g',{class:'ps-pitch-goal','data-side':dir<0?'top':'bottom','data-goal-depth':depth});
          gg.appendChild(E('path',{class:'ps-pitch-goal-bed',d:d,fill:_lc,'fill-opacity':'0.055',stroke:'none'}));
          gg.appendChild(E('path',{class:'ps-pitch-goal-net',d:d,fill:'url(#'+_goalNetId+')',stroke:'none'}));
          gg.appendChild(E('path',{class:'ps-pitch-goal-frame',d:'M '+frontL+' '+yLine+' L '+backL+' '+backY+' L '+backR+' '+backY+' L '+frontR+' '+yLine,fill:'none',stroke:_lc,'stroke-width':'1.7','stroke-opacity':'0.9','stroke-linecap':'round','stroke-linejoin':'round'}));
          gg.appendChild(E('line',{class:'ps-pitch-goal-back',x1:backL,y1:backY,x2:backR,y2:backY,stroke:_lc,'stroke-width':'2.6','stroke-opacity':'0.98','stroke-linecap':'round'}));
          gg.appendChild(E('line',{class:'ps-pitch-goal-mouth',x1:frontL,y1:yLine,x2:frontR,y2:yLine,stroke:_lc,'stroke-width':'3.1','stroke-opacity':'1','stroke-linecap':'round'}));
          g.appendChild(gg);
        }
        /* 2.658 — 규격이 풋살이면 카드도 풋살장(사용자 "풋살 규격으로 했을 때 운동장 개수 표현되는거 똑같이 풋살장으로").
           전엔 규격과 상관없이 축구장(페널티 박스·골 에어리어·아크)만 그렸다. FIFA 풋살 규칙 1조: 40×20m · 골 3×2m(깊이 1m) ·
           페널티 에어리어 = 골포스트 기준 r6m 사분원 둘 + 직선 · PK 6m · 제2 PK 10m · 센터서클 r3m. 카드는 세로(골이 위·아래) — m→px 는 가로 w/20, 세로 h/40 */
        var SPX=null; try{ SPX=doc.defaultView.__getPitchSpec&&doc.defaultView.__getPitchSpec(); }catch(_){}
        if(SPX&&SPX.futsal){
          var LEN=SPX.len||40, WID=SPX.wid||20, sx=w/WID, sy=h/LEN, cxF=x0+w/2, cyF=y0+h/2;
          var gHalf=(SPX.goal||3)/2*sx, R=(SPX.paR||6), pk1=(SPX.pk||6), pk2=(SPX.pk2||10), cc=(SPX.cc||3);
          add('rect',{x:x0,y:y0,width:w,height:h,rx:4});
          add('line',{x1:x0,y1:cyF,x2:x0+w,y2:cyF});
          add('ellipse',{cx:cxF,cy:cyF,rx:cc*sx,ry:cc*sy});
          add('circle',{cx:cxF,cy:cyF,r:2.6,fill:_lc,'stroke-width':'0'});
          /* 페널티 에어리어: 위 골(sweep 0) · 아래 골(sweep 1) */
          add('path',{d:'M '+(cxF-gHalf-R*sx)+' '+y0+' A '+(R*sx)+' '+(R*sy)+' 0 0 0 '+(cxF-gHalf)+' '+(y0+R*sy)+' L '+(cxF+gHalf)+' '+(y0+R*sy)+' A '+(R*sx)+' '+(R*sy)+' 0 0 0 '+(cxF+gHalf+R*sx)+' '+y0});
          add('path',{d:'M '+(cxF-gHalf-R*sx)+' '+(y0+h)+' A '+(R*sx)+' '+(R*sy)+' 0 0 1 '+(cxF-gHalf)+' '+(y0+h-R*sy)+' L '+(cxF+gHalf)+' '+(y0+h-R*sy)+' A '+(R*sx)+' '+(R*sy)+' 0 0 1 '+(cxF+gHalf+R*sx)+' '+(y0+h)});
          /* PK 6m · 제2 PK 10m */
          [pk1,pk2].forEach(function(m){ add('circle',{cx:cxF,cy:y0+m*sy,r:2.2,fill:_lc,'stroke-width':'0'}); add('circle',{cx:cxF,cy:y0+h-m*sy,r:2.2,fill:_lc,'stroke-width':'0'}); });
          var goWf=gHalf*2, goDf=Math.min(15,Math.max(4,(SPX.goalD||1)*sy));
          function goalF(yLine,dir){ goalShape(yLine,dir,goWf,goDf); }
          goalF(y0,-1); goalF(y0+h,1);
          return g;
        }
        add('rect',{x:x0,y:y0,width:w,height:h,rx:6});
        add('line',{x1:x0,y1:y0+h/2,x2:x0+w,y2:y0+h/2});
        add('circle',{cx:x0+w/2,cy:y0+h/2,r:Math.min(w,h)*0.13});
        add('circle',{cx:x0+w/2,cy:y0+h/2,r:3,fill:_lc,'stroke-width':'0'});
        var pbW=w*0.58,pbH=h*0.155;
        add('rect',{x:x0+(w-pbW)/2,y:y0,width:pbW,height:pbH});
        add('rect',{x:x0+(w-pbW)/2,y:y0+h-pbH,width:pbW,height:pbH});
        var gbW=w*0.30,gbH=h*0.062;
        add('rect',{x:x0+(w-gbW)/2,y:y0,width:gbW,height:gbH});
        add('rect',{x:x0+(w-gbW)/2,y:y0+h-gbH,width:gbW,height:gbH});
        var ar=w*0.13;
        add('path',{d:'M '+(x0+(w-pbW*0.36)/2)+' '+(y0+pbH)+' A '+ar+' '+ar+' 0 0 0 '+(x0+(w+pbW*0.36)/2)+' '+(y0+pbH)});
        add('path',{d:'M '+(x0+(w-pbW*0.36)/2)+' '+(y0+h-pbH)+' A '+ar+' '+ar+' 0 0 1 '+(x0+(w+pbW*0.36)/2)+' '+(y0+h-pbH)});
        add('circle',{cx:x0+w/2,cy:y0+pbH*0.7,r:2.4,fill:_lc,'stroke-width':'0'});
        add('circle',{cx:x0+w/2,cy:y0+h-pbH*0.7,r:2.4,fill:_lc,'stroke-width':'0'});
        var cr=Math.min(w,h)*0.035;
        add('path',{d:'M '+x0+' '+(y0+cr)+' A '+cr+' '+cr+' 0 0 0 '+(x0+cr)+' '+y0});
        add('path',{d:'M '+(x0+w-cr)+' '+y0+' A '+cr+' '+cr+' 0 0 0 '+(x0+w)+' '+(y0+cr)});
        add('path',{d:'M '+(x0+w)+' '+(y0+h-cr)+' A '+cr+' '+cr+' 0 0 0 '+(x0+w-cr)+' '+(y0+h)});
        add('path',{d:'M '+(x0+cr)+' '+(y0+h)+' A '+cr+' '+cr+' 0 0 0 '+x0+' '+(y0+h-cr)});
        var goW=w*0.115, goD=Math.min(15,h*0.026);
        function goal(yLine,dir){ goalShape(yLine,dir,goW,goD); }
        goal(y0,-1); goal(y0+h,1);
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
      var _GRD=''; try{ _GRD=(doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue('--grid')||'').trim(); }catch(_e){} if(!_GRD)_GRD='#3a6df0';
      function pitchGrid(pg,gx,gy,gwid,ghei){
        if(!_gt||_gt==='off')return;
        var gcx=gx+gwid/2, pbH=gwid*0.29, gbH=gwid*0.15, gsw=1.5, gop=0.5, gdsh='6 10';   // 세로 운동장: 하프스페이스=박스폭/2, 센터=골에어리어폭/2
        function vL(x){ pg.appendChild(E('line',{x1:x,y1:gy,x2:x,y2:gy+ghei,stroke:_GRD,'stroke-width':gsw,'stroke-dasharray':gdsh,'stroke-opacity':gop})); }
        function hL(y){ pg.appendChild(E('line',{x1:gx,y1:y,x2:gx+gwid,y2:y,stroke:_GRD,'stroke-width':gsw,'stroke-dasharray':gdsh,'stroke-opacity':gop})); }
        var _lanes=(_gt==='lanes'||_gt==='grid15'||_gt==='zone20');
        var _thirds=(_gt==='thirds'||_gt==='grid15'||_gt==='zone20');
        if(_gt==='grid15'){ pg.appendChild(E('rect',{x:gcx-pbH,y:gy,width:(pbH-gbH),height:ghei,fill:_GRD,opacity:0.10,stroke:'none'})); pg.appendChild(E('rect',{x:gcx+gbH,y:gy,width:(pbH-gbH),height:ghei,fill:_GRD,opacity:0.10,stroke:'none'})); }
        if(_lanes){ [gcx-pbH,gcx-gbH,gcx+gbH,gcx+pbH].forEach(vL); }
        if(_thirds){ hL(gy+ghei/3); hL(gy+2*ghei/3); }
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
        for(var q=0;q<4;q++){ var qc=q%2, qr=Math.floor(q/2); var qx=LX+WL+_cg5+qc*(sw+_cg5), qy=TY+qr*(sh+_rg5); placePitch(qx,qy,sw,sh,_goalCap5,false); }
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
