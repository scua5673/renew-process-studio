'use strict';
/* 오류 제보 0d7c9cca «애니메이션 속도를 설정하면 모든 장면에 똑같이» — 장면 속도 «이 장면만 / 모든 장면에 적용» · 새 장면은 속도를 이어받는다. */
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../studio/board-anim-tools.js');

test('속도 목록 값 — 그냥 숫자는 이 장면만, all: 은 모든 장면, 이상한 값은 1×',()=>{
  assert.deepEqual(T.speedChoice('1.5'),{all:false,speed:1.5});
  assert.deepEqual(T.speedChoice('all:2'),{all:true,speed:2});
  assert.deepEqual(T.speedChoice('all:'),{all:true,speed:1});
  assert.deepEqual(T.speedChoice('x'),{all:false,speed:1});
  assert.deepEqual(T.speedChoice(null),{all:false,speed:1});
});

test('이 장면만 — 고른 장면 하나만 바뀐다',()=>{
  const fr=[{dur:1},{dur:1,moveSpeed:2},{dur:1}];
  const r=T.setSpeed(fr,1,'0.5');
  assert.equal(r.all,false);assert.equal(r.changed,1);
  assert.deepEqual(fr.map(f=>f.moveSpeed),[undefined,0.5,undefined]);
});

test('모든 장면에 적용 — 마지막 장면까지 같은 속도, 이미 같으면 센 수에서 빠진다',()=>{
  const fr=[{dur:1},{dur:1,moveSpeed:2},{dur:1,moveSpeed:1.5},{dur:1}];
  const r=T.setSpeed(fr,0,'all:1.5');
  assert.equal(r.all,true);assert.equal(r.speed,1.5);assert.equal(r.changed,3);
  assert.deepEqual(fr.map(f=>f.moveSpeed),[1.5,1.5,1.5,1.5]);
  assert.equal(T.setSpeed(fr,0,'all:1.5').changed,0);
});

test('장면이 없거나 고른 장면이 없으면 아무것도 안 바뀐다',()=>{
  assert.equal(T.setSpeed(null,0,'all:2').changed,0);
  const fr=[{dur:1}];
  assert.equal(T.setSpeed(fr,-1,'2').changed,0);
  assert.equal(fr[0].moveSpeed,undefined);
});

test('새 장면은 앞 장면 속도를 이어받는다(1× 는 적지 않는다)',()=>{
  assert.equal(T.inheritSpeed({moveSpeed:1.5},{dur:1}).moveSpeed,1.5);
  assert.equal('moveSpeed' in T.inheritSpeed({moveSpeed:1},{dur:1}),false);
  assert.equal('moveSpeed' in T.inheritSpeed({},{dur:1}),false);
  assert.equal('moveSpeed' in T.inheritSpeed(null,{dur:1}),false);
  assert.equal(T.inheritSpeed({moveSpeed:'abc'},{dur:1,moveSpeed:2}).moveSpeed,2,'이상한 값이면 그대로 둔다');
});

/* 오류 제보 6cbcf0d1 — 토큰 리셋이 뒤 장면 그림을 지우면 곧 다시 그리는데(판을 잠깐 바꿨다 되돌림) 고른 토큰이 풀렸다 */
test('고른 것을 id 로 기억했다가 되돌린 판(새 객체)에서 다시 찾는다',()=>{
  const old={players:[{id:1},{id:2}],equipment:[{id:'c1'}],drawings:[{id:9}],ball:{x:1}};
  const typeOf=o=>old.players.includes(o)?'player':old.equipment.includes(o)?'equip':old.drawings.includes(o)?'drawing':o===old.ball?'ball':null;
  const fresh=JSON.parse(JSON.stringify(old));
  let k=T.selKeys({type:'player',ref:old.players[1]},[],typeOf);
  let r=T.selFind(k,fresh);
  assert.equal(r.sel.type,'player');assert.equal(r.sel.ref,fresh.players[1],'새 판의 같은 선수');assert.deepEqual(r.multi,[]);
  k=T.selKeys(null,[old.players[0],old.equipment[0],old.ball],typeOf);
  r=T.selFind(k,fresh);
  assert.equal(r.sel,null);assert.deepEqual(r.multi,[fresh.players[0],fresh.equipment[0],fresh.ball]);
  r=T.selFind(T.selKeys({type:'drawing',ref:old.drawings[0]},[],typeOf),{players:[],equipment:[],drawings:[]});
  assert.equal(r.sel,null,'되돌린 판에 없으면 고르지 않는다');
  assert.deepEqual(T.selKeys({type:'spball',ref:{}},[{id:5}],()=>null),{one:null,many:[]},'모르는 것은 기억하지 않는다');
});

/* 작은 가짜 DOM — select · optgroup · option 만 */
function fakeDoc(){
  const doc={createElement:tag=>el(tag,doc)};
  return doc;
}
function opts(root){ const out=[]; (function walk(n){ n.children.forEach(c=>{ if(c.tagName==='OPTION')out.push(c); walk(c); }); })(root); return out; }
function el(tag,doc){
  return {tagName:tag.toUpperCase(),ownerDocument:doc,children:[],parent:null,attrs:{},label:'',selected:false,textContent:'',title:'',
    get value(){ if(this.tagName==='SELECT'){ const o=opts(this); return (o.find(x=>x.selected)||o[0]||{value:''}).value; } return this.attrs.value!=null?this.attrs.value:this.textContent; },
    set value(v){ if(this.tagName==='SELECT'){ let hit=false; opts(this).forEach(o=>{ o.selected=!hit&&o.value===String(v); if(o.selected)hit=true; }); } else this.attrs.value=String(v); },
    appendChild(c){ if(c.parent)c.parent.children.splice(c.parent.children.indexOf(c),1); c.parent=this; this.children.push(c); return c; },
    querySelectorAll(){ return opts(this); },
    removeAttribute(k){ delete this.attrs[k]; },
    cloneNode(){ const c=el(tag,doc); c.attrs=Object.assign({},this.attrs); c.textContent=this.textContent; c.selected=this.selected; return c; }};
}
function select(doc,id,values,suffix,cur){
  const s=el('select',doc);s.id=id;
  values.forEach(v=>{ const o=el('option',doc);o.attrs.value=v;o.textContent=v+suffix;s.appendChild(o); });
  s.value=cur;return s;
}

test('속도 목록은 «이 장면만» · «모든 장면에 적용» 두 묶음 — 값과 지금 고른 것은 그대로',()=>{
  const doc=fakeDoc(),s=select(doc,'animSpeedSel',['0.5','1','2'],'×','2');
  assert.equal(T.groupSpeedSelect(s),true);
  assert.deepEqual(s.children.map(g=>[g.tagName,g.label]),[['OPTGROUP','이 장면만'],['OPTGROUP','모든 장면에 적용']]);
  assert.deepEqual(s.children[0].children.map(o=>o.value),['0.5','1','2']);
  assert.deepEqual(s.children[1].children.map(o=>o.value),['all:0.5','all:1','all:2']);
  assert.deepEqual(s.children[1].children.map(o=>o.textContent),['0.5×','1×','2×']);
  assert.equal(s.value,'2','지금 장면 속도가 그대로 보인다');
  s.value='1';assert.equal(s.value,'1','board.html 이 넣는 숫자 값은 «이 장면만» 쪽을 고른다');
  assert.match(s.title,/모든 장면에 적용/);
  assert.equal(T.groupSpeedSelect(s),false,'두 번 묶지 않는다');
  assert.equal(opts(s).length,6);
});

test('유지 시간 목록은 «모든 장면 공통» 한 묶음',()=>{
  const doc=fakeDoc(),s=select(doc,'animHoldSel',['0.1','0.3','0.6'],'초','0.6');
  assert.equal(T.groupHoldSelect(s),true);
  assert.deepEqual(s.children.map(g=>g.label),['모든 장면 공통']);
  assert.deepEqual(opts(s).map(o=>o.value),['0.1','0.3','0.6']);
  assert.equal(s.value,'0.6');
  s.value='0.1';assert.equal(s.value,'0.1');
});

test('mount — 문서에 목록이 없어도 넘어간다',()=>{
  assert.doesNotThrow(()=>T.mount({getElementById:()=>null}));
  assert.doesNotThrow(()=>T.mount(null));
});
