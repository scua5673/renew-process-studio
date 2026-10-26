/* Runs against the real board, using synthetic data and DOM pointer events. */
(function(){
  const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify(a)+' != '+JSON.stringify(b));};
  const ok=(v,msg)=>{if(!v)throw Error(msg);};
  const near=(a,b)=>ok(Math.abs(a-b)<.01,a+' != '+b);
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  function seed(){
    const base=captureSnap();Object.assign(base,{players:[{id:8101,team:'blue',num:7,name:'윙어',x:350,y:280},{id:8102,team:'blue',num:8,name:'중앙',x:500,y:340,bib:'#facc15'},{id:8103,team:'red',num:6,x:670,y:260,bib:'#4ade80'}],equipment:[{id:8201,team:'cone',x:300,y:500},{id:8202,team:'cone',x:550,y:440},{id:8203,team:'minigoal',x:770,y:440}],ball:{x:490,y:400},drawings:[{type:'rect',pts:[{x:280,y:230},{x:790,y:520}],color:'#d6f7ff',op:.45,lw:1,locked:true},{type:'text',pts:[{x:530,y:160}],text:'3 대 2 전진 패스',size:38,color:'#ffffff',bg:'#14213d',textWeight:900,textItalic:false,textAngle:0}],orientation:'h',pitchTheme:'grass',gridType:'off'});
    loadSnap(base);__setTilt(false);_activateMoveTool();renderTokens();renderDrawings();sel=null;multiSel=[...state.players,...state.equipment.slice(0,2)];updateDelUI();updateAlignBar();renderMultiGuides();
  }
  function pointer(target,type,id,x,y,kind='touch'){
    const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(world.getScreenCTM());
    if(target===window)target=svg;
    target.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:kind,button:0,buttons:type==='pointerup'?0:1,clientX:q.x,clientY:q.y,bubbles:true,cancelable:true}));
  }
  async function run(){
    const result=[];async function check(name,fn){try{await fn();result.push({name,pass:true});}catch(e){result.push({name,pass:false,error:e.message});}}
    seed();await frame();
    await check('혼합 정렬·고정·되돌리기',()=>{multiSel=[state.players[0],state.equipment[0],...state.drawings];sel=null;const before=JSON.stringify(state.drawings[0]);alignMulti('rowY');eq(state.players[0].y,state.equipment[0].y);eq(state.players[0].y,state.drawings[1].pts[0].y);eq(before,JSON.stringify(state.drawings[0]));undoLast();eq(state.players[0].y,280);eq(state.equipment[0].y,500);});
    await check('조끼 평면·3D·이미지 내보내기',()=>{for(const tilt of [false,true]){__setTilt(tilt);renderTokens();ok(tokenLayer.querySelector('[data-id="8102"] .ps-bib'),'조끼 없음');ok(boardImageXML().xml.includes('ps-bib'),'출력 누락');}__setTilt(false);});
    await check('격자 설정 저장·출력 제외',()=>{window.__editGrid=5;buildPitch();const sn=JSON.parse(JSON.stringify(captureSnap()));window.__editGrid=0;loadSnap(sn);eq(window.__editGrid,5);ok(document.getElementById('psEditGrid'),'격자 없음');ok(!boardImageXML().xml.includes('psEditGrid'),'격자 출력');});
    await check('글자 굵기·기울임·회전 보존',()=>{const d=state.drawings[1];Object.assign(d,{textWeight:400,textItalic:true,textAngle:30});renderDrawings();const tx=PSBoardText.node(d).querySelector('text');eq(tx.getAttribute('font-style'),'italic');eq(tx.getAttribute('font-weight'),'400');ok(tx.getAttribute('transform').includes('30'),'회전 없음');const sn=JSON.parse(JSON.stringify(captureSnap()));loadSnap(sn);eq(state.drawings[1].textAngle,30);});
    await check('고정 항목 방향키 이동 방지',()=>{const d=state.drawings[0],before=JSON.stringify(d);sel={type:'drawing',ref:d};multiSel=[];document.activeElement.blur();window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));eq(before,JSON.stringify(d));});
    await frame();
    await check('터치 혼합 이동·다른 손가락 무시·취소 종료',()=>{
      const d=state.drawings[1],locked=state.drawings[0],before=JSON.stringify(locked),start={...d.pts[0]},p=state.players[0],px=p.x,py=p.y;
      multiSel=[d,p,locked];sel=null;renderDrawings();const g=PSBoardText.node(d);localStorage.setItem('cs_drag_snap_v1','1');
      pointer(g,'pointerdown',71,start.x,start.y);pointer(window,'pointermove',72,start.x+300,start.y+300);eq(d.pts[0],start);
      pointer(window,'pointermove',71,start.x+63,start.y+42);const moved={...d.pts[0]},q=PR(),step=M2U(5);near((moved.x-q.L)/step,Math.round((moved.x-q.L)/step));near((moved.y-q.T)/step,Math.round((moved.y-q.T)/step));near(p.x-px,moved.x-start.x);near(p.y-py,moved.y-start.y);eq(JSON.stringify(locked),before);
      pointer(window,'pointercancel',71,moved.x,moved.y);pointer(window,'pointermove',71,start.x+150,start.y+150);eq(d.pts[0],moved);undoLast();near(state.drawings[1].pts[0].x,start.x);
    });
    await check('토큰에서 시작한 그룹 격자 이동',()=>{
      const p=state.players[0],d=state.drawings[1],locked=state.drawings[0],before=JSON.stringify(locked),p0={x:p.x,y:p.y},d0={...d.pts[0]};sel=null;multiSel=[p,d,locked];renderTokens();renderDrawings();const g=tokenLayer.querySelector('[data-id="8101"]');
      pointer(g,'pointerdown',81,p.x,p.y,'mouse');pointer(window,'pointermove',81,p.x+62,p.y+38,'mouse');pointer(window,'pointerup',81,p.x+62,p.y+38,'mouse');const q=PR(),step=M2U(5);near((p.x-q.L)/step,Math.round((p.x-q.L)/step));near(d.pts[0].x-d0.x,p.x-p0.x);eq(JSON.stringify(locked),before);undoLast();
    });
    await check('텍스트 두 번 누르기·취소',()=>{
      multiSel=[];sel=null;renderDrawings();const d=state.drawings[1],p=d.pts[0];
      for(let n=0;n<2;n++){const g=PSBoardText.node(d);pointer(g,'pointerdown',91,p.x,p.y);pointer(window,'pointerup',91,p.x,p.y);}
      ok(document.querySelector('.ps-text-inline-editor'),'편집창 없음');document.querySelector('.ps-text-inline-editor').__finish(false);ok(!document.querySelector('.ps-text-inline-editor'),'취소 실패');
    });
    await check('회전한 글자 손잡이로 폭 조절',()=>{
      const d=state.drawings[1];d.textAngle=90;sel={type:'drawing',ref:d};multiSel=[];renderDrawings();const g=PSBoardText.node(d),h=Array.from(g.children).find(n=>n.tagName.toLowerCase()==='g'&&n.querySelector('circle'));
      ok(h,'손잡이 없음');const p=d.pts[0];pointer(h,'pointerdown',101,p.x,p.y+120);pointer(window,'pointermove',102,p.x,p.y+400);ok(!d.w,'다른 손가락이 폭을 바꿈');pointer(window,'pointermove',101,p.x,p.y+150);pointer(window,'pointerup',101,p.x,p.y+150);near(d.w,300);undoLast();
    });
    await check('터치 여러 개 선택·선택 마침',()=>{
      sel=null;multiSel=[];updateDelUI();const panel=document.getElementById('psEditTools');panel.querySelector('[data-pick]').click();
      pointer(tokenLayer.querySelector('[data-id="8101"]'),'pointerdown',111,350,280);pointer(PSBoardText.node(state.drawings[0]),'pointerdown',112,280,230);eq(multiSel.length,2);document.getElementById('psEditToolsToggle').click();eq(document.getElementById('psEditToolsToggle').textContent,'배치 도구');eq(panel.querySelector('[data-pick]').getAttribute('aria-pressed'),'false');
    });
    await check('읽기 전용 수정 차단',()=>{const before=JSON.stringify(captureSnap());window.__vaultReadOnly=true;try{alignMulti('rowY');document.querySelector('#psEditTools [data-bib="#facc15"]').click();eq(JSON.stringify(captureSnap()),before);}finally{window.__vaultReadOnly=false;updateDelUI();}});
    return result;
  }
  window.PSBoardEditChecks={run,seed};
})();
