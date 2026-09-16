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

test('crowded positions render all players in one naturally sized card without changing saved positions',()=>{
  const h=setup();h.data.players=Array.from({length:48},(_,i)=>h.player('player-'+i,'pos-0',i%2?'target':'ours'));
  const before=plain(h.data),first=h.data.players[0];h.c.renderScoutBoard();
  assert.equal(h.wrap.children.length,11);
  const ids=h.renderedIds();assert.equal(ids.length,48);assert.equal(new Set(ids).size,48);
  assert.match(h.wrap.children[0].innerHTML,/<div class="sb-players" data-sbgroup="ours" role="group" aria-label="GK 우리 팀 선수 목록">/);
  assert.match(h.wrap.children[0].innerHTML,/<div class="sb-players" data-sbgroup="target" role="group" aria-label="GK 스카우트 후보 선수 목록">/);
  assert.equal(h.wrap.children.filter(el=>el.innerHTML.includes('class="sb-players"')).length,1);
  const groups=[...h.wrap.children[0].innerHTML.matchAll(/<div class="sb-players" data-sbgroup="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="sb-players"|<button type="button" class="sb-add")/g)];
  assert.deepEqual(groups.map(g=>g[1]),['ours','target']);
  assert.equal([...groups[0][2].matchAll(/data-pid="/g)].length,24);
  assert.equal([...groups[1][2].matchAll(/data-pid="/g)].length,24);
  assert.deepEqual(plain(h.data),before);assert.equal(h.data.players[0],first);
});

test('each populated card displays the full ordered roster for both groups instead of allocating a limited row count',()=>{
  for(let ours=0;ours<=5;ours++)for(let candidates=0;candidates<=5;candidates++){
    const h=setup();
    h.data.players=[...Array.from({length:ours},(_,i)=>h.player('ours-'+i,'pos-0')),
      ...Array.from({length:candidates},(_,i)=>h.player('candidate-'+i,'pos-0','target'))];
    const before=plain(h.data);h.c.renderScoutBoard();
    const html=h.wrap.children[0].innerHTML;
    assert.equal(html.includes('data-sbgroup="ours"'),ours>0,'our players remain visible');
    assert.equal(html.includes('data-sbgroup="target"'),candidates>0,'candidates remain visible');
    assert.doesNotMatch(html,/--sb-visible-rows|max-height|overflow/);
    assert.deepEqual(h.renderedIds(),h.data.players.map(p=>p.id),'all players retain their order');
    assert.deepEqual(plain(h.data),before);
  }
});

test('switching to one group displays every player without changing player order',()=>{
  const h=setup();h.data.players=[...Array.from({length:5},(_,i)=>h.player('ours-'+i,'pos-0')),
    ...Array.from({length:5},(_,i)=>h.player('candidate-'+i,'pos-0','target'))];
  for(const [filter,kind,prefix]of [['ours','ours','ours'],['tgt','target','candidate']]){
    h.c.sbShow=filter;h.c.renderScoutBoard();
    assert.match(h.wrap.children[0].innerHTML,new RegExp('data-sbgroup="'+kind+'" role="group"'));
    assert.deepEqual(h.renderedIds(),Array.from({length:5},(_,i)=>prefix+'-'+i));
  }
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

function clampSetup(specs,baseHeight=520){
  const props={},state={baseHeight,width:1000};
  const slots=specs.map(s=>({x:s.x,y:s.y}));
  const cards=specs.map((s,i)=>({dataset:{sbslot:String(i)},style:{},offsetWidth:s.w||164,offsetHeight:s.h}));
  const wrap={style:{setProperty(k,v){props[k]=v;},removeProperty(k){delete props[k];}},
    getBoundingClientRect:()=>({width:state.width,height:Math.max(state.baseHeight,parseFloat(props['--sb-content-min-height'])||0)}),
    querySelectorAll:()=>cards};
  const c=vm.createContext({$:()=>wrap,sbSlots:()=>slots,sbView:s=>s});
  vm.runInContext(part('function sbClamp()','/* 포지션별 기준 탭'),c);
  const rect=card=>{const r=wrap.getBoundingClientRect(),x=parseFloat(card.style.left)/100*r.width,y=parseFloat(card.style.top)/100*r.height;
    return {left:x-card.offsetWidth/2,right:x+card.offsetWidth/2,top:y-card.offsetHeight/2,bottom:y+card.offsetHeight/2};};
  const assertContained=()=>cards.forEach(card=>{const r=rect(card),pitch=wrap.getBoundingClientRect();
    assert.ok(r.top>=0&&r.bottom<=pitch.height,'the full card remains inside the pitch');});
  return {c,slots,cards,props,state,wrap,rect,assertContained};
}

test('the pitch expands for a tall card and shrinks to its normal height after filtering without changing saved positions',()=>{
  const h=clampSetup([{x:50,y:90,h:1800}]);
  const before=plain(h.slots);h.c.sbClamp();
  assert.ok(h.wrap.getBoundingClientRect().height>1800);h.assertContained();
  assert.deepEqual(plain(h.slots),before);
  h.cards[0].offsetHeight=150;h.c.sbClamp();
  assert.equal(h.wrap.getBoundingClientRect().height,520);
  assert.equal(h.props['--sb-content-min-height'],undefined);h.assertContained();
  assert.deepEqual(plain(h.slots),before);
});

test('horizontally intersecting crowded cards gain a clear vertical gap while retaining saved position proportions',()=>{
  for(const specs of [
    [{x:50,y:20,h:250},{x:52,y:55,h:300}],
    [{x:50,y:0,h:80},{x:50,y:8,h:160}],
    [{x:50,y:92,h:160},{x:50,y:100,h:80}]
  ]){
    const h=clampSetup(specs),before=plain(h.slots);h.c.sbClamp();
    assert.ok(h.rect(h.cards[1]).top-h.rect(h.cards[0]).bottom>=8,'crowded cards do not obscure each other');
    h.assertContained();assert.deepEqual(plain(h.slots),before);
    const height=h.wrap.getBoundingClientRect().height;h.c.sbClamp();
    assert.equal(h.wrap.getBoundingClientRect().height,height,'repeated layout does not accumulate extra height');
    h.cards.forEach(card=>{card.offsetHeight=32;});h.c.sbClamp();
    assert.ok(h.wrap.getBoundingClientRect().height<height,'fewer players remove obsolete expanded space');
  }
});

test('separate columns and manually colocated cards preserve the existing pitch height',()=>{
  for(const specs of [
    [{x:10,y:30,h:300},{x:90,y:60,h:300}],
    [{x:50,y:50,h:300},{x:50,y:50,h:300}],
    [{x:50,y:50,h:300},{x:50,y:51,h:300}]
  ]){
    const h=clampSetup(specs,840);h.c.sbClamp();
    assert.equal(h.wrap.getBoundingClientRect().height,840,'the viewport or meeting-mode baseline remains effective');
    assert.equal(h.props['--sb-content-min-height'],undefined);h.assertContained();
  }
});
