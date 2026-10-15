'use strict';
/* 3.040 — 오류 제보 «선수단 표시 오류»(팀 운영 › 선수단 선발 라인업에 팀 인원이 안 올라오고 좌측 하단에 포지션과 무관하게 쌓임).
   포메이션이 바뀌면 새 포메이션에 없는 카드가 왼쪽 아래 한 줄(x 14·29·44… y 90)로 떨어지고, 새 포지션(LM · RM)으로 옮겨진 선수는 «운동장 밖»으로 빠졌다. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const implementation=[
  part('const SLOT_XY=','function posShort('),
  part('function posAbbr(name){','/* 참고: MYDP'),
  part('function tmCustomForms(){','function tmFormOptsHTML()'),
  part('function tmFormSlots(key){','function svgPoint('),
  part('const TM_FORMS={','const SHIRT_D='),
  part('function tbXYStore()','function tbGroupOf('),
  part('function tbSlotsCompute()','/* 2.761')
].join('\n')+'\nthis.api={tbCards,tbAdoptForm,tbSlotsCompute,tbCardPos,tbHomeXY,tbDefaultMap};';
const AB=['GK','LB','LCB','RCB','RB','DM','CM','AM','LW','RW','CF'];
function setup({form='433',cards=null,xy=null,extra=[]}={}){
  const positions=['GK','CB','LCB','RCB','LB','RB','LWB','RWB','LDM','DM','RDM','LCM','CM','RCM','LM','RM','AM','CF','LW','RW'].concat(extra)
    .map((name,i)=>({id:'pos_'+name+(i>19?'_'+i:''),name,targets:{}}));
  const id=ab=>positions.find(p=>p.name===ab).id;
  const players=AB.map((ab,i)=>({id:'pl'+i,name:'선수'+ab,type:'ours',posId:id(ab)}));
  const meta={form};if(cards)meta.tbCards=cards.map(id);if(xy)meta.tbXY=xy;
  const data={positions,players,meta};
  const c=vm.createContext({data,tmOurs:()=>data.players.filter(p=>p.type!=='target'),console});
  vm.runInContext(implementation,c,{filename:'squad-cards-3038.js'});
  const abOf=pid=>positions.find(p=>p.id===pid).name;
  return {data,api:c.api,id,abOf};
}
const plain=v=>JSON.parse(JSON.stringify(v));
const bottomLeftRow=slot=>slot.y>=88&&slot.x<50;   // 예전 자리 {x:14+15k,y:90}

test('formation change elsewhere leaves no card in the old bottom-left row; off-formation cards stand at their own position', () => {
  const h=setup({form:'442',cards:AB});   // 4-3-3 카드 11장 · 끈 적 없음 · 포메이션 값만 4-4-2
  const slots=h.api.tbSlotsCompute();
  assert.equal(slots.length,11);
  assert.deepEqual(plain(slots.filter(bottomLeftRow)),[]);
  const at=ab=>slots.find(s=>s.ab===ab);
  assert.ok(at('LW').x>70&&at('LW').y<30,'LW on the left wing up front');
  assert.ok(at('RW').x>70&&at('RW').y>70,'RW on the right wing up front');
  assert.ok(at('AM').x>55&&at('AM').x<75&&Math.abs(at('AM').y-50)<5,'AM in the middle behind the strikers');
});

test('a team already broken by an old formation change heals: empty app-made cards give way to formation positions with players', () => {
  const h=setup({form:'442',cards:AB});
  const pl=n=>h.data.players.find(p=>p.id===n);
  pl('pl7').posId=h.id('LM');pl('pl8').posId=h.id('RM');pl('pl9').posId=h.id('CF');   // 예전 tmApplyFormation 이 옮긴 선수
  const ids=h.api.tbCards();
  assert.equal(ids.length,11);
  assert.ok(ids.includes(h.id('LM'))&&ids.includes(h.id('RM')),'LM · RM come onto the pitch');
  const onCards=new Set(ids);
  assert.deepEqual(plain(h.data.players.filter(p=>!onCards.has(p.posId)).map(p=>p.id)),[],'every player is on a card');
  assert.equal(ids.indexOf(h.id('LM')),7,'the swap keeps the card slot (AM → LM)');
});

test('cards the coach dragged or picked (tbXY) are never swapped, even when empty and outside the formation', () => {
  const h=setup({form:'442',cards:AB,xy:{pos_AM:{x:60,y:50},pos_LW:{x:80,y:15},pos_RW:{x:80,y:85}}});
  h.data.players.find(p=>p.id==='pl7').posId=h.id('LM');h.data.players.find(p=>p.id==='pl8').posId=h.id('RM');
  assert.deepEqual(plain(h.api.tbCards().map(h.abOf)),AB);
  const slots=h.api.tbSlotsCompute();
  assert.deepEqual(plain(slots.find(s=>s.ab==='LW')),{ab:'LW',x:80,y:15});
});

test('picking a formation in the squad adopts its positions as the 11 cards and pins its coordinates', () => {
  const h=setup({form:'433',cards:AB,xy:{pos_LB:{x:40,y:20},pos_LWB:{x:33,y:33}}});
  h.data.meta.form='442';h.api.tbAdoptForm();
  const ids=h.data.meta.tbCards;
  assert.equal(ids.length,11);
  assert.deepEqual(plain(ids.slice(0,10).map(h.abOf)),['GK','LB','LCB','RCB','RB','LM','CM','DM','RM','CF']);
  const def=h.api.tbDefaultMap();
  ['GK','LB','LM','RM','CF'].forEach(ab=>assert.deepEqual(plain(h.data.meta.tbXY[h.id(ab)]),{x:Math.round(def[ab].x*10)/10,y:Math.round(def[ab].y*10)/10},ab));
  assert.deepEqual(plain(h.data.meta.tbXY.pos_LWB),{x:33,y:33},'coordinates of other cards stay');
  assert.deepEqual(plain(h.api.tbSlotsCompute().filter(bottomLeftRow)),[]);
});

test('lost card ids refill from the current formation first, not the position list order', () => {
  const h=setup({form:'433'});h.data.meta.tbCards=['gone1','gone2'];
  assert.deepEqual(plain(h.api.tbCards().map(h.abOf)),AB);
});

test('two cards with the same abbreviation outside the formation do not sit on top of each other', () => {
  const h=setup({form:'433',extra:['CB']});
  h.data.players.find(p=>p.id==='pl2').posId='pos_CB';h.data.players.find(p=>p.id==='pl3').posId='pos_CB_20';   // 두 CB 에 선수 — 빈 카드가 아니라 바꾸지 않는다
  h.data.meta.tbCards=['pos_GK','pos_CB','pos_CB_20','pos_LB','pos_RB','pos_DM','pos_CM','pos_AM','pos_LW','pos_RW','pos_CF'];
  const slots=h.api.tbSlotsCompute(),cbs=slots.filter(s=>s.ab==='CB');
  assert.equal(cbs.length,2);
  assert.notDeepEqual(plain(cbs[0]),plain(cbs[1]));
  assert.deepEqual(plain(slots.filter(bottomLeftRow)),[]);
});

test('every card placement path uses the shared rule and the squad formation picker adopts the formation', () => {
  assert.equal(source.includes('14+(fb++)*15'),false,'no bottom-left row fallback remains');
  assert.equal((source.match(/tbCardPos\(/g)||[]).length,4,'definition + tbRender + tbSlotsCompute + obFillUs');
  assert.match(source,/\$\("tmForm"\)\.onchange=[^\n]*tmApplyFormation\(data\.meta\.form\);\}catch\(_\)\{\}tbAdoptForm\(\);/);
});
