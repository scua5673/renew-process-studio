'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const initial=source.split('\n').find(line=>line.startsWith('var sbTab='));
assert.ok(initial,'scouting display defaults');
const implementation=[initial,
  part('function sbCardsMode()','/* 자리를 옮기거나'),
  part('function sbPosOf(sl,i)','/* ══ 1.632'),
  part('function sbSeatsOf(code)','function sbAge(p)'),
  part('function tbCardSlotsTm()','function tbShapeLabel()'),
  part('function renderScoutBoard()','function sbWire()')
].join('\n');
function setup(){
  const positions=['GK','CB','CB','LB','RB','DM','CM','AM','LW','RW','ST'].map((name,i)=>({id:'pos-'+i,name}));
  const data={positions,players:[],meta:{form:'433',tbCards:positions.map(p=>p.id),
    tbSlots:positions.map((p,i)=>({ab:p.name,x:10+i*7,y:15+(i%3)*30})),tbXY:{'pos-1':{x:47,y:62}}}};
  const wrap={dataset:{},children:[],style:{setProperty(){},removeProperty(){}},
    set innerHTML(value){this.html=value;this.children=[];},get innerHTML(){return this.html;},appendChild(el){this.children.push(el);}};
  const pool={innerHTML:'',parentElement:{style:{}}},count={textContent:''};
  const state={group:'',fallback:[['GK',50,90],['CB',30,60],['CB',70,60]],wired:0,clamped:0};
  const c=vm.createContext({data,window:{},document:{body:{classList:{toggle(){}}},createElement:()=>({dataset:{},style:{},innerHTML:''})},
    $:id=>({sbWrap:wrap,sbPoolOurs:pool,sbNOurs:count}[id]||null),
    PSSafe:{html:v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))},
    renderSbGrpChips(){},sbFormList:()=>['433'],sbForm:()=>data.meta.form,sbFormLabel:v=>v,
    tbCards:()=>data.meta.tbCards,tmFormSlotsAdj:()=>state.fallback,
    scoutPositionByCode:code=>data.positions.find(p=>p.name.toUpperCase()===String(code).toUpperCase()),
    tmGrpFlt:p=>!state.group||p.grp===state.group,sbPitchTheme:()=>({}),sbPitch:()=> 'grass',sbSideMode:()=>false,
    tmPitchLines:()=>'',sbView:sl=>({x:100-sl[2],y:sl[1]}),sbSlotLabel:sl=>sl[3]||sl[0],posAbbr:v=>v,
    sbChip:p=>'<div class="sb-chip '+(p.type==='target'?'tgt':'ours')+'" data-pid="'+p.id+'">'+p.name+'</div>',
    sbWire(){state.wired++;},sbClamp(){state.clamped++;}
  });
  vm.runInContext(implementation,c,{filename:'scout-board-display.js'});
  const player=(id,posId,type='ours',extra={})=>({id,name:id,posId,type,...extra});
  const renderedIds=()=>wrap.children.flatMap(el=>[...el.innerHTML.matchAll(/data-pid="([^"]+)"/g)].map(m=>m[1]));
  return {c,data,state,wrap,pool,count,player,renderedIds};
}

test('the initial eleven position cards show both registered squad players and scouting candidates',()=>{
  const h=setup();h.data.players=[h.player('ours','pos-0'),h.player('candidate','pos-0','target'),h.player('legacy-ours','pos-1',undefined)];
  delete h.data.players[2].type;
  const before=plain(h.data);
  assert.equal(h.c.sbShow,'all');h.c.renderScoutBoard();
  assert.equal(h.wrap.children.length,11);
  assert.deepEqual(h.renderedIds(),['ours','candidate','legacy-ours']);
  assert.equal(h.pool.parentElement.style.display,'');
  assert.deepEqual(plain(h.data),before);
  assert.equal(h.state.wired,1);assert.equal(h.state.clamped,1);
});

test('crowded positions retain every player inside one scrollable card without adding cards or changing saved positions',()=>{
  const h=setup();h.data.players=Array.from({length:48},(_,i)=>h.player('player-'+i,'pos-0',i%2?'target':'ours'));
  const before=plain(h.data),first=h.data.players[0];h.c.renderScoutBoard();
  assert.equal(h.wrap.children.length,11);
  const ids=h.renderedIds();assert.equal(ids.length,48);assert.equal(new Set(ids).size,48);
  assert.match(h.wrap.children[0].innerHTML,/<div class="sb-players" data-sbgroup="ours" tabindex="0" aria-label="GK 우리 팀 선수 목록">/);
  assert.match(h.wrap.children[0].innerHTML,/<div class="sb-players" data-sbgroup="target" tabindex="0" aria-label="GK 스카우트 후보 선수 목록">/);
  assert.equal(h.wrap.children.filter(el=>el.innerHTML.includes('class="sb-players"')).length,1);
  const groups=[...h.wrap.children[0].innerHTML.matchAll(/<div class="sb-players" data-sbgroup="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="sb-players"|<button type="button" class="sb-add")/g)];
  assert.deepEqual(groups.map(g=>g[1]),['ours','target']);
  assert.equal([...groups[0][2].matchAll(/data-pid="/g)].length,24);
  assert.equal([...groups[1][2].matchAll(/data-pid="/g)].length,24);
  assert.deepEqual(plain(h.data),before);assert.equal(h.data.players[0],first);
});

test('distinct card positions with the same abbreviation do not lose players through legacy seat filtering',()=>{
  const h=setup();h.data.players=[h.player('left-cb','pos-1'),h.player('right-cb','pos-2'),h.player('right-candidate','pos-2','target',{sbSeat:7})];
  h.c.renderScoutBoard();
  assert.deepEqual(h.renderedIds(),['left-cb','right-cb','right-candidate']);
  assert.match(h.wrap.children[1].innerHTML,/data-pid="left-cb"/);
  assert.match(h.wrap.children[2].innerHTML,/data-pid="right-cb"/);
  assert.match(h.wrap.children[2].innerHTML,/data-pid="right-candidate"/);
});

test('legacy formation seats still distribute a shared position without duplicates',()=>{
  const h=setup();delete h.data.meta.tbSlots;
  h.data.players=[h.player('first-seat','pos-1'),h.player('second-seat','pos-1','target',{sbSeat:1}),h.player('last-seat','pos-1','ours',{sbSeat:8})];
  h.c.renderScoutBoard();
  assert.equal(h.wrap.children.length,3);
  assert.match(h.wrap.children[1].innerHTML,/data-pid="first-seat"/);
  assert.doesNotMatch(h.wrap.children[1].innerHTML,/data-pid="second-seat"/);
  assert.match(h.wrap.children[2].innerHTML,/data-pid="second-seat"/);
  assert.match(h.wrap.children[2].innerHTML,/data-pid="last-seat"/);
  assert.equal(new Set(h.renderedIds()).size,3);
});

test('explicit squad-only and candidate-only filters remain available while keeping all eleven cards',()=>{
  const h=setup();h.data.players=[h.player('ours','pos-0'),h.player('candidate','pos-0','target')];
  h.c.sbShow='ours';h.c.renderScoutBoard();assert.deepEqual(h.renderedIds(),['ours']);assert.equal(h.wrap.children.length,11);
  h.c.sbShow='tgt';h.c.renderScoutBoard();assert.deepEqual(h.renderedIds(),['candidate']);assert.equal(h.wrap.children.length,11);
  assert.equal(h.pool.parentElement.style.display,'none');
  h.c.sbShow='all';h.c.renderScoutBoard();assert.deepEqual(h.renderedIds(),['ours','candidate']);
});

test('the squad group filter affects our players without hiding external candidates',()=>{
  const h=setup();h.state.group='A팀';
  h.data.players=[h.player('ours-a','pos-0','ours',{grp:'A팀'}),h.player('ours-b','pos-0','ours',{grp:'B팀'}),h.player('candidate','pos-0','target')];
  h.c.renderScoutBoard();assert.deepEqual(h.renderedIds(),['ours-a','candidate']);
});

test('players outside the eleven selected positions remain accessible in the unplaced squad list',()=>{
  const h=setup();h.data.positions.push({id:'off-pos',name:'CF'});
  h.data.players=[h.player('unassigned',''),h.player('off-board','off-pos'),h.player('on-board','pos-0')];
  h.c.renderScoutBoard();assert.equal(h.wrap.children.length,11);assert.deepEqual(h.renderedIds(),['on-board']);
  assert.match(h.pool.innerHTML,/data-pid="unassigned"/);assert.match(h.pool.innerHTML,/data-pid="off-board"/);
  assert.equal(h.count.textContent,'2명');assert.equal(h.pool.parentElement.style.display,'');
});

test('legacy custom formations are not truncated or rewritten by the compact display',()=>{
  const h=setup();delete h.data.meta.tbSlots;
  h.state.fallback=Array.from({length:12},(_,i)=>['CB',10+i*6,60]);
  const before=plain(h.data);h.c.renderScoutBoard();
  assert.equal(h.wrap.children.length,12);assert.deepEqual(plain(h.data),before);
});
