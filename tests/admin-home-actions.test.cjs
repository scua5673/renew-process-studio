'use strict';
/* 2.937 — 관리자 운영 홈 '핵심 행동 14일'이 다른 탭에 갔다 오면 21개 전부 0명이 되던 것.
   '기능 방문' 칸이 HOME.feat 에서 행동 핑(a_*)을 걸러 HOME.feat 자체를 덮어썼고,
   홈은 캐시된 HOME 으로 다시 그리므로 두 번째부터 행동 행이 사라져 있었다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../admin.html'),'utf8');
function section(a,b){const i=html.indexOf(a);assert.ok(i>=0,'missing '+a);const j=html.indexOf(b,i);assert.ok(j>i,'missing '+b);return html.slice(i,j);}
const block=section('/* ── 2.022 핵심 행동(a_* 핑)','/* ── 기능별 저장 활동(kv) ──');
const actLb=html.slice(html.indexOf('var ACT_LB='),html.indexOf('\n',html.indexOf('var ACT_LB=')));
const code=actLb+'\nfunction renderPart(){\n'+block+'\n}';

function harness(feat){
  const nodes={hmActs:{innerHTML:''},hmFeat:{innerHTML:''}};
  const c=vm.createContext({Math,String,Array,
    $:id=>nodes[id],esc:s=>String(s),PING_LB:{idp:'IDP',process:'일정'},
    HOME:{feat}});
  vm.runInContext(code,c);
  return {c,nodes};
}
const FEAT=[
  {feature:'idp',users:40,prev_users:50,pings:300},
  {feature:'a_diary',users:58,prev_users:128,pings:200},
  {feature:'a_week',users:18,prev_users:22,pings:50},
  {feature:'process',users:30,prev_users:30,pings:120},
];
const count=(txt,label)=>{const i=txt.indexOf(label);if(i<0)return null;const m=txt.slice(i).match(/>(\d+)명/);return m?+m[1]:null;};

test('core actions keep their counts when the home is rendered again from cache',()=>{
  const h=harness(FEAT.map(x=>({...x})));
  h.c.renderPart();
  const first=h.nodes.hmActs.innerHTML;
  assert.equal(count(first,'훈련일지(오늘 한 장)'),58);
  assert.equal(count(first,'일정 편집(주간 보드)'),18);
  h.c.renderPart();
  const second=h.nodes.hmActs.innerHTML;
  assert.equal(second,first,'second render must match the first');
  assert.doesNotMatch(second,/아직 없음/);
});

test('cached HOME.feat still holds the action rows after rendering',()=>{
  const h=harness(FEAT.map(x=>({...x})));
  h.c.renderPart();h.c.renderPart();
  assert.deepEqual(h.c.HOME.feat.map(x=>x.feature),['idp','a_diary','a_week','process']);
});

test('feature visits never list action pings and stay stable across renders',()=>{
  const h=harness(FEAT.map(x=>({...x})));
  h.c.renderPart();
  const first=h.nodes.hmFeat.innerHTML;
  assert.doesNotMatch(first,/a_diary|a_week/);
  assert.match(first,/IDP/);assert.match(first,/일정/);
  h.c.renderPart();
  assert.equal(h.nodes.hmFeat.innerHTML,first);
});

test('only action pings: visits show the empty state, actions still counted',()=>{
  const h=harness([{feature:'a_diary',users:3,prev_users:1,pings:4}]);
  h.c.renderPart();
  assert.match(h.nodes.hmFeat.innerHTML,/수집 시작 전/);
  assert.equal(count(h.nodes.hmActs.innerHTML,'훈련일지(오늘 한 장)'),3);
});

test('missing RPC is still reported in both sections',()=>{
  const h=harness(null);
  h.c.renderPart();
  assert.match(h.nodes.hmActs.innerHTML,/RPC가 없어요/);
  assert.match(h.nodes.hmFeat.innerHTML,/RPC가 없어요/);
});
