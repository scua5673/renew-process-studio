'use strict';
/* 3.040 — 오류 제보 «선수단 표시 오류»: 팀 운영 › 선수단 운동장에서 카드가 포지션과 상관없이 왼쪽 아래 한 줄에 몰렸다.
   저장한 자리가 없고 포메이션 표에 같은 약어가 없으면 {x:14+15n, y:90} 에 세웠기 때문이다.
   실제 scout.html 의 TM_FORMS·posAbbr·tmBase·tbPlacer 를 그대로 돌려 본다. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const code=[
  part('const TM_ALIAS=','/* 포메이션별 기본 표시 라벨'),
  part('const TM_FORMS={','const SHIRT_D='),
  part('function tmCustomForms(){','function tmFormOptsHTML(){'),
  part('function tmFormSlots(key){','var tmPosEdit=false;'),
  part('function tmFormSlotsAdj(form){','function svgPoint('),
  part('function tmNorm(pos){','function tmFormKey('),
  part('function posAbbr(name){','/* 참고: MYDP 피치'),
  part('function tbXYStore(){','function tbDefaultMap(){'),
  part('var TB_ALT=','function tbOurs(){')
].join('\n')+'\nthis.__api={tbPlacer,posAbbr};';
function run(form,names,xy){
  const data={meta:{form,tbXY:xy||{}}};
  const c=vm.createContext({data,Math,String,Array});
  vm.runInContext(code,c,{filename:'squad-card-placement.js'});
  const place=c.__api.tbPlacer();
  return names.map((n,i)=>({ab:String(c.__api.posAbbr(n)||n).toUpperCase(),pos:place('pos'+i,String(c.__api.posAbbr(n)||n).toUpperCase())}));
}
const bottomRow=p=>p.y===90&&p.x<=100&&(p.x-14)%15===0;

test('custom Korean position names land at their own place, not in the bottom-left row',()=>{
  const r=run('433',['골키퍼','센터백','왼쪽 풀백','오른쪽 풀백','수비형 미드필더','중앙 미드필더','공격형 미드필더','왼쪽 윙어','오른쪽 윙어','스트라이커','윙어']);
  assert.ok(r.every(x=>!bottomRow(x.pos)),JSON.stringify(r));
  const at=ab=>r.find(x=>x.ab===ab).pos;
  assert.ok(at('GK').x<20,'goalkeeper stays at our goal (left)');
  assert.ok(at('ST').x>80,'striker takes the centre-forward place');
  assert.ok(at('CB').x<35,'centre-back is in the back line');
  assert.ok(at('LB').y<at('RB').y,'left back above right back on the horizontal board');
  const seen=new Set(r.map(x=>x.pos.x+','+x.pos.y));
  assert.equal(seen.size,r.length,'no two cards are stacked on one spot');
});

test('a 4-4-2 with two strikers gives the second CF card the second CF place',()=>{
  const r=run('442',['GK','LB','LCB','RCB','RB','LM','CM','DM','RM','CF','ST']);
  const cf=r.filter(x=>x.ab==='CF'||x.ab==='ST').map(x=>x.pos);
  assert.equal(cf.length,2);
  assert.ok(cf.every(p=>p.x>80),JSON.stringify(cf));
  assert.notEqual(cf[0].y,cf[1].y);
});

test('positions that are not in the formation use their default place, and unknown names sit on the half-way line',()=>{
  const r=run('433',['GK','LCB','RCB','LB','RB','DM','CM','AM','LW','RW','CF','CB','LM','ZZZ']);
  const cb=r.find(x=>x.ab==='CB').pos,lm=r.find(x=>x.ab==='LM').pos,zz=r.find(x=>x.ab==='ZZZ').pos;
  assert.ok(cb.x<35&&cb.y===50,'CB default spot is the centre of the back line');
  assert.ok(lm.y<20&&lm.x>40&&lm.x<60,'LM default spot is the left of midfield');
  assert.equal(zz.x,50);
  assert.ok(r.every(x=>!bottomRow(x.pos)));
});

test('saved card positions still win and keep consuming their formation place',()=>{
  const r=run('442',['GK','CF','CF'],{pos1:{x:60,y:40}});
  assert.deepEqual(r[1].pos,{x:60,y:40});
  assert.ok(r[2].pos.x>80,'the other CF card takes the remaining CF place');
});
