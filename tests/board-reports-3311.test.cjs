'use strict';
/* 3.311 — 작전판 그리기 도구 제보 묶음(2026-11-17, 같은 제보자 · 맥 크롬 3.306).
   - dd59a8b4 «화살표로 토큰과 토큰을 이으면 화살표 머리가 가려진다» → 토큰에 묶였거나 토큰 안의 끝은 가장자리까지만(PSShapeMenu.trimTip).
   - b2007df6 «화살표에서 끝 모양을 고르면 직선 · 점선에도 화살표» → 끝 모양 기본값은 집안마다(headFamily · headDefault · headShown · setHeadDefault).
   - f2b9c41a «우클릭 › 점 · 선 스타일은 그 도형에만» → 메뉴가 __psLsSelOnly 를 세우고 창은 기본값을 안 쓴다.
   - 43d6b2af «속을 채우지 않는 원» → 채움 «없음».
   - 5588062b · a2f004f9 · e4b723a1 → 단축키 여섯(board-shortcuts.js drawAct) · «선 지우기» → «그림 모두 지우기».
   실제 판은 tests/browser/board-reports-3311.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../studio/board-shape-menu.js');
const K=require('../studio/board-shortcuts.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
const DRAW_IDS=['lineStyleOpen','lineDashToggle','passLobToggle','playersOpen','teamLoadOpen','drawingsClear'];

test('trimTip — 토큰 밖의 끝은 그대로, 토큰 안의 끝은 선이 들어온 쪽 가장자리(반지름 + 틈)에',()=>{
  const c={x:600,y:300};
  assert.deepEqual(M.trimTip({x:700,y:300},{x:300,y:300},c,21,3),{x:700,y:300},'토큰 밖');
  const t=M.trimTip({x:600,y:300},{x:300,y:300},c,21,3);assert.ok(near(t.x,576)&&near(t.y,300),'왼쪽에서 들어온 선: '+JSON.stringify(t));
  const u=M.trimTip({x:600,y:300},{x:600,y:0},c,21,3);assert.ok(near(u.x,600)&&near(u.y,276),'위에서 들어온 선: '+JSON.stringify(u));
  const v=M.trimTip({x:610,y:305},{x:300,y:200},c,21,3);   // 중심을 지나지 않는 비스듬한 선 — 교점은 원 위 · 선 위
  assert.ok(near(Math.hypot(v.x-c.x,v.y-c.y),24,1e-6),'원 위');assert.ok(Math.abs((v.x-300)*105-(v.y-200)*310)<1e-6,'선 위');
  const w=M.trimTip({x:610,y:300},{x:610,y:300},c,21,3);assert.ok(near(w.x,624)&&near(w.y,300),'들어오는 쪽을 모르면 중심에서 끝 쪽으로');
  const z=M.trimTip({x:600,y:300},null,c,21,3);assert.ok(near(z.x,624)&&near(z.y,300),'끝이 중심이고 방향도 없으면 오른쪽으로');
  assert.equal(M.trimTip(null,null,c,21,3),null);
  assert.deepEqual(M.trimTip({x:1,y:1},null,null,21,3),{x:1,y:1});
  assert.deepEqual(M.trimTip({x:600,y:300},null,c,0,3),{x:600,y:300},'반지름 0 은 안 물린다');
});

test('끝 모양 기본값은 도구 집안마다 — 화살표(drawHead) · 선(drawHeadLine)',()=>{
  assert.equal(M.headFamily('line'),'line');assert.equal(M.headFamily('dashline'),'line');
  for(const t of ['pass','run','dribble','shot','move','rect',undefined,''])assert.equal(M.headFamily(t),'arrow',String(t));
  const st={};
  assert.equal(M.headDefault(st,'pass'),undefined);assert.equal(M.headShown(st,'pass'),'arrow');assert.equal(M.headShown(st,'line'),'none');
  M.setHeadDefault(st,'pass','bar');assert.deepEqual(st,{drawHead:'bar'});
  assert.equal(M.headShown(st,'line'),'none','화살표에서 고른 끝 모양이 선에 따라오지 않는다(b2007df6)');
  assert.equal(M.headShown(st,'dashline'),'none');
  M.setHeadDefault(st,'dashline','dot');assert.deepEqual(st,{drawHead:'bar',drawHeadLine:'dot'});
  assert.equal(M.headDefault(st,'line'),'dot');assert.equal(M.headDefault(st,'run'),'bar');assert.equal(M.headShown(st,'line'),'dot');
  assert.equal(M.headDefault(null,'line'),undefined);assert.equal(M.headShown(null,'pass'),'arrow');
  M.setHeadDefault(null,'line','dot');   // 던지지 않는다
});

function fakeDoc(ids,active){
  const els={},clicks=[];
  ids.forEach(id=>{els[id]={id,disabled:false,click(){clicks.push(id);}};});
  return {doc:{activeElement:active||null,body:{classList:{contains:()=>false}},getElementById:id=>els[id]||null},clicks,els};
}
function fakeWin(doc,extra){
  const calls=[];
  const w=Object.assign({document:doc,__csView:'board',state:{drawings:[]},sel:null,multiSel:[],PSShapeMenu:M,
    toast:m=>calls.push(['toast',m]),pushUndo:()=>calls.push(['pushUndo']),renderDrawings:()=>calls.push(['render']),
    autoSaveAnimFrame:()=>calls.push(['anim']),boardSaveLive:()=>calls.push(['save']),openAnalysisTeamLibrary:()=>calls.push(['teamlib'])},extra||{});
  return {w,calls};
}

test('단축키 여섯 — 표에 있고 기본 키는 비어 있다(3.168 과 같이)',()=>{
  for(const id of DRAW_IDS){assert.ok(K.actions[id],id);assert.equal(K.defaults[id],'',id);}
  assert.equal(K.actions.lineDashToggle,'선 모양 — 점선 ↔ 실선');assert.equal(K.actions.passLobToggle,'패스 — 로빙 ↔ 땅볼');
  assert.equal(K.actions.playersOpen,'선수 놓기 열기·닫기');assert.equal(K.actions.teamLoadOpen,'저장 팀 불러오기');
  assert.equal(K.actions.drawingsClear,'이 장면의 그림 모두 지우기');assert.equal(K.actions.lineStyleOpen,'선 스타일 열기·닫기');
});

test('선 모양 점선 ↔ 실선 — 새로 그릴 기본값을 바꾸고 고른 그림(글 제외)에도 바로',()=>{
  const {doc}=fakeDoc([]);const l1={type:'line',pts:[]},l2={type:'poly',pts:[]},tx={type:'text',pts:[]};
  const {w,calls}=fakeWin(doc,{state:{drawings:[l1,l2,tx]},multiSel:[l1,tx],sel:null});
  assert.equal(K.run(w,'lineDashToggle'),true);
  assert.equal(w.state.drawLineStyle,'dash');assert.equal(l1.dash,true);assert.equal(l2.dash,undefined,'안 고른 그림');assert.equal(tx.dash,undefined,'글');
  assert.deepEqual(calls.map(c=>c[0]),['pushUndo','render','anim','save','toast']);assert.equal(calls[4][1],'점선으로 그려요 · 고른 그림도 점선');
  calls.length=0;w.multiSel=[];w.sel={type:'drawing',ref:l2};
  K.run(w,'lineDashToggle');
  assert.equal(w.state.drawLineStyle,'solid');assert.equal(l2.dash,undefined);assert.equal(l1.dash,true,'고르지 않은 그림은 그대로');
  assert.equal(calls[calls.length-1][1],'실선으로 그려요 · 고른 그림도 실선');
  calls.length=0;w.sel=null;
  K.run(w,'lineDashToggle');assert.equal(w.state.drawLineStyle,'dash');assert.deepEqual(calls,[['toast','점선으로 그려요']],'고른 것이 없으면 기본값만');
  w.state.drawLineStyle='dot';K.run(w,'lineDashToggle');assert.equal(w.state.drawLineStyle,'dash','둥근 점선에서 누르면 점선');
});

test('패스 로빙 ↔ 땅볼 — 기본값 + 고른 패스에만',()=>{
  const {doc}=fakeDoc([]);const p={type:'pass',pts:[]},r={type:'run',pts:[]};
  const {w,calls}=fakeWin(doc,{state:{drawings:[p,r]},multiSel:[p,r]});
  K.run(w,'passLobToggle');assert.equal(w.state.drawLob,true);assert.equal(p.lob,true);assert.equal(r.lob,undefined);
  assert.equal(calls[calls.length-1][1],'로빙 패스로 그려요 · 고른 패스도 로빙');
  K.run(w,'passLobToggle');assert.equal(w.state.drawLob,false);assert.equal(p.lob,undefined);
  calls.length=0;w.multiSel=[r];K.run(w,'passLobToggle');assert.deepEqual(calls,[['toast','로빙 패스로 그려요']],'패스가 아니면 기본값만');
});

test('열기 · 불러오기 · 지우기 — 있는 단추 · 함수를 대신 누른다',()=>{
  const a=fakeDoc(['lineStyleBtn','ps-df-team','benchTog','clearDrawBtn']);const A=fakeWin(a.doc);
  K.run(A.w,'lineStyleOpen');K.run(A.w,'playersOpen');K.run(A.w,'drawingsClear');K.run(A.w,'teamLoadOpen');
  assert.deepEqual(a.clicks,['lineStyleBtn','ps-df-team','clearDrawBtn']);
  assert.deepEqual(A.calls,[['toast','이 장면의 그림을 모두 지웠어요 — 되돌리기는 ⌘Z'],['teamlib']]);
  const b=fakeDoc(['benchTog']);const B=fakeWin(b.doc);
  K.run(B.w,'playersOpen');assert.deepEqual(b.clicks,['benchTog'],'떠 있는 도크가 없으면 «선수 ▾»');
  K.run(B.w,'drawingsClear');assert.deepEqual(B.calls,[],'단추가 없으면 조용히');
  const c=fakeDoc(['lineStyleBtn','lsPop']);const C=fakeWin(c.doc,{state:{drawings:[]}});
  K.run(C.w,'lineDashToggle');assert.deepEqual(c.clicks,['lineStyleBtn','lineStyleBtn'],'열린 «선 스타일» 창은 닫았다 열어 표시를 맞춘다');
});

test('입력 중 · 작전판 밖에서는 안 돈다(잡기만 한다)',()=>{
  const a=fakeDoc(['lineStyleBtn','clearDrawBtn'],{tagName:'INPUT'});const A=fakeWin(a.doc,{state:{drawings:[]}});
  for(const id of DRAW_IDS)assert.equal(K.run(A.w,id),true,id);
  assert.deepEqual(a.clicks,[]);assert.equal(A.w.state.drawLineStyle,undefined);
  const b=fakeDoc(['lineStyleBtn','clearDrawBtn']);const B=fakeWin(b.doc,{__csView:'scouting',state:{drawings:[]}});
  for(const id of DRAW_IDS)assert.equal(K.run(B.w,id),true,id);
  assert.deepEqual(b.clicks,[]);assert.equal(B.w.state.drawLineStyle,undefined);
  const s=fakeDoc(['clearDrawBtn']);const S=fakeWin(s.doc,{__csView:'session',state:{drawings:[]}});
  K.run(S.w,'drawingsClear');assert.deepEqual(s.clicks,['clearDrawBtn'],'훈련 편집기(session)에서는 된다');
  assert.equal(K.run(A.w,'nope'),false,'모르는 동작은 본문에 맡긴다');
});

test('board.html 배선 — 채움 «없음» · 메뉴 길은 고른 그림에만 · 끝 모양 집안 · 머리 물리기 · «그림 모두 지우기»',()=>{
  const h=read('studio/board.html');
  assert.ok(h.includes('<button type="button" data-v="none">없음</button>'),'«선 스타일 › 채움 › 없음»');
  assert.equal((h.match(/d\.fillStyle==="none"\?"none":/g)||[]).length,3,'구역 · 연결선 · 다각형의 채움');
  assert.ok(h.includes('if(_zda||d.fillStyle==="none"){ const zs={fill:"none"'),'채움 없음이면 실선 테두리');
  assert.ok(h.includes('var selOnly=!!(window.__psLsSelOnly&&ds.length);'));
  for(const k of ['if(!selOnly){ state.drawLw=w; state.drawOp=o; }','if(!selOnly)state.drawLineStyle=v;','if(!selOnly)state.drawFillStyle=v;','if(!selOnly)state.drawHead2=both;','if(!selOnly)state.drawLob=on;','if(!selOnly){ if(window.PSShapeMenu)PSShapeMenu.setHeadDefault(state,state.tool,v); else state.drawHead=v; }'])assert.ok(h.includes(k),k);
  assert.ok(h.includes('PSShapeMenu.headShown(state,state.tool)'));
  assert.ok(h.includes('PSShapeMenu.headDefault(state,state.tool):undefined'),'새로 그릴 때의 끝 모양');
  assert.ok(h.includes('const b=_tp(1,b0,cpt||a0),a=d.head2?_tp(0,a0,cpt||b0):a0;'),'그릴 끝점만 물린다');
  assert.ok(h.includes('[a0,b0].forEach((pt,idx)=>{'),'핸들은 자료의 끝점');
  assert.ok(h.includes('21*_tokScaleOf(p),3)'),'토큰 반지름 21 × 배율 + 틈 3');
  assert.ok(h.includes('>그림 모두 지우기</button>')&&!h.includes('>선 지우기</button>'));
  const V=(read('sw.js').match(/process-(\d\.\d{3})/)||[])[1];   // 판 번호는 sw.js CACHE 에서(시험에 박지 않는다 — code-budget-3043)
  assert.ok(V&&h.includes('board-shortcuts.js?v='+V)&&h.includes('board-shape-menu.js?v='+V),'고친 모듈 둘의 ?v= 는 지금 판');
  const sm=read('studio/board-shape-menu.js');
  assert.ok(sm.includes("win.__psLsSelOnly = 1; try { lb.click(); } finally { win.__psLsSelOnly = 0; }"),'메뉴가 표식을 세우고 누른다');
  const en=read('studio/i18n/en-board.js');
  for(const k of ['"선 모양 — 점선 ↔ 실선"','"이 장면의 그림 모두 지우기"','"그림 모두 지우기"','"점선으로 그려요 · 고른 그림도 점선"'])assert.ok(en.includes(k),'영어 '+k);
});
