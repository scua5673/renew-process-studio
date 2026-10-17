'use strict';
/* 3.080 — 고리: 학습 → 내 게임모델(개인 판) → 훈련 설계 → 게임모델의 «보관함 훈련 n개». 브라우저 시험은 tests/browser/learn-gm-loop.mjs */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..','studio',f),'utf8');
const gm=R('gamemodel.html'),app=R('app.html'),board=R('board.html'),learn=R('learning.html');
test('the game model takes a principle from learning only on the personal board, once per request',()=>{
  assert.match(gm,/if\(d\.source==='app'&&d\.type==='gmAddPrinciple'\)\{\n      if\(e\.source!==parent\)return;\n      if\(!GM_PERSONAL\)return;\n      if\(d\.req&&window\.__gmAddReq===d\.req\)return;/);
  assert.match(gm,/var dup=ph\.principles\.some\(/,'같은 문장은 두 번 넣지 않는다');
});
test('each phase card can start a drill, and shows how many vault drills use it',()=>{
  assert.match(gm,/type:'gmMakeDrill',phaseId:ph\.id,phaseName:\(m\.name\|\|''\)\+' › '\+\(ph\.name\|\|''\),principle:pr/);
  assert.match(gm,/window\.storage\.get\('cs_drill_lib_v1'\)/);
  assert.match(gm,/if\(JSON\.stringify\(byId\)!==before\)render\(\);/,'숫자가 바뀔 때만 다시 그린다(무한 반복 없음)');
});
test('standard phase ids from the drill editor map back to same-named phases (the «4 weeks: 0» fix)',()=>{
  const code=gm.slice(gm.indexOf('  function gmStdMap(){'),gm.indexOf('  function gmTrainCount(){'));
  const ctx=vm.createContext({model:{moments:[{key:'dt',phases:[{id:'p1',name:'즉시 반응 (역압박)'},{id:'p2',name:'후퇴 · 재정비'}]},{key:'ao',phases:[{id:'p3',name:'내 빌드업'}]}]}});
  vm.runInContext(code+';this.out=gmStdMap();',ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.out)),{std_dt_1:'p1',std_dt_2:'p2'},'이름이 다른 단계는 잇지 않는다');
  assert.match(gm,/id=_std\[id\]\|\|id;/,'최근 4주 훈련도 같은 길로 센다');
});
test('the shell opens the personal board for «담기» and the vault editor for «훈련 만들기»',()=>{
  assert.match(app,/d\.source==='learning' && d\.type==='gmAdd'\)\{[\s\S]{0,400}currentTeamKey=''; showApp\('gamemodel'\);/);
  assert.match(app,/\(d\.source==='gamemodel'\|\|d\.source==='learning'\) && d\.type==='gmMakeDrill'\)\{[\s\S]{0,500}showApp\('design'\);[\s\S]{0,200}w\.__psDrillPreset=\{phaseId:_ph,phaseName:_pn,principle:_pp\}; w\.openEditor\(null\);/);
});
test('the drill editor fills title · coaching point and picks the same-named standard phase',()=>{
  assert.match(board,/var _dp=window\.__psDrillPreset; window\.__psDrillPreset=null;/);
  assert.match(board,/EP_STD_MOMENTS\.forEach\(function\(m\)\{ if\(_hit\|\|String\(m\.name\)\.trim\(\)!==_mN\)return;/);
});
test('learning offers «내 게임모델에 담기» in chapter 1 and «내 원칙으로 훈련 만들기» in chapter 3',()=>{
  assert.match(learn,/function keepHtml\(k\)\{/);assert.match(learn,/function drillHtml\(\)\{/);
  assert.match(learn,/parent\.postMessage\(\{source:'learning',type:'gmAdd',momentKey:mk,text:tx\},'\*'\)/);
  const S=R('learn-studio.js'); global.window=global; vm.runInThisContext(S);
  const secs=window.LR_STUDIO.chapters.flatMap(c=>c.sections);
  assert.deepEqual(secs.filter(s=>s.try.keep).map(s=>s.id),['SG2','SG3','SG4','SG5']);
  assert.deepEqual(secs.filter(s=>s.try.drill).map(s=>s.id),['ST1','ST3','ST5']);
});
