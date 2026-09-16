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
  const cards=specs.map((s,i)=>({dataset:{sbslot:String(i)},style:{setProperty(k,v){this[k]=v;}},offsetWidth:s.w||146,offsetHeight:s.h}));
  const wrap={style:{setProperty(k,v){props[k]=v;},removeProperty(k){delete props[k];}},
    scrollTop:0,scrollLeft:0,
    getBoundingClientRect:()=>({left:0,top:0,width:state.width,height:Math.max(state.baseHeight,parseFloat(props['--sb-content-min-height'])||0)}),
    querySelectorAll:()=>cards};
  cards.forEach(card=>{card.getBoundingClientRect=()=>{
    const r=wrap.getBoundingClientRect(),x=parseFloat(card.style.left)/100*r.width,
      y=parseFloat(card.style.top)/100*r.height+(parseFloat(card.style['--oy'])||0);
    return {left:x-card.offsetWidth/2-wrap.scrollLeft,top:y-card.offsetHeight/2-wrap.scrollTop,width:card.offsetWidth,height:card.offsetHeight};
  };});
  const c=vm.createContext({$:()=>wrap,sbSlots:()=>slots,sbView:s=>s});
  vm.runInContext(part('function sbClamp()','/* 포지션별 기준 탭'),c);
  const rect=card=>{const r=card.getBoundingClientRect(),left=r.left+wrap.scrollLeft,top=r.top+wrap.scrollTop;
    return {left,right:left+r.width,top,bottom:top+r.height};};
  const assertContained=()=>cards.forEach(card=>{const r=rect(card),pitch=wrap.getBoundingClientRect();
    assert.ok(r.left>=0&&r.right<=pitch.width&&r.top>=0&&r.bottom<=pitch.height,'the full card remains inside the pitch');});
  return {c,slots,cards,props,state,wrap,rect,assertContained};
}

test('an unusually tall card starts at the top of the fixed board so every row remains reachable by board scrolling',()=>{
  const h=clampSetup([{x:50,y:90,h:1800}]);
  const before=plain(h.slots);h.props['--sb-content-min-height']='2400px';h.c.sbClamp();
  assert.equal(h.wrap.getBoundingClientRect().height,520);
  assert.equal(h.rect(h.cards[0]).top,8);assert.equal(h.rect(h.cards[0]).bottom,1808);
  assert.equal(h.props['--sb-content-min-height'],undefined);
  assert.deepEqual(plain(h.slots),before);
  h.cards[0].offsetHeight=150;h.c.sbClamp();
  assert.equal(h.wrap.getBoundingClientRect().height,520);
  assert.equal(h.cards[0].style['--oy'],'0px');h.assertContained();
  assert.deepEqual(plain(h.slots),before);
});

test('cards at every pitch edge are clamped into the fixed dimensions without writing saved coordinates',()=>{
  for(const pos of [[0,0],[100,0],[0,100],[100,100]]){
    const h=clampSetup([{x:pos[0],y:pos[1],h:160}]),before=plain(h.slots);h.c.sbClamp();
    h.assertContained();assert.equal(h.wrap.getBoundingClientRect().height,520);
    assert.deepEqual(plain(h.slots),before);
  }
});

test('overlapping cards receive display offsets while board dimensions and saved positions stay unchanged',()=>{
  const h=clampSetup([{x:50,y:50,h:100},{x:52,y:51,h:100}]),before=plain(h.slots);h.c.sbClamp();
  assert.ok(h.rect(h.cards[1]).top-h.rect(h.cards[0]).bottom>=7,'crowded cards gain a visible gap after pixel rounding');
  assert.notEqual(h.cards[0].style['--oy'],'0px');
  const offsets=h.cards.map(card=>card.style['--oy']);
  h.assertContained();assert.deepEqual(plain(h.slots),before);
  assert.equal(h.wrap.getBoundingClientRect().height,520);
  h.wrap.scrollTop=200;h.c.sbClamp();
  assert.deepEqual(h.cards.map(card=>card.style['--oy']),offsets,'scrolling and repeated layout do not accumulate offsets');
  assert.deepEqual(plain(h.slots),before);
  h.cards.pop();h.c.sbClamp();
  assert.equal(h.cards[0].style['--oy'],'0px','removing the overlap clears the previous display offset');
});

test('separate columns retain their positions and the viewport or meeting-mode baseline',()=>{
  const h=clampSetup([{x:10,y:30,h:300},{x:90,y:60,h:300}],840),before=plain(h.slots);h.c.sbClamp();
  assert.equal(h.wrap.getBoundingClientRect().height,840);
  assert.equal(h.props['--sb-content-min-height'],undefined);h.assertContained();
  assert.deepEqual(h.cards.map(card=>card.style['--oy']),['0px','0px']);
  assert.deepEqual(plain(h.slots),before);
});

test('cards too crowded for the fixed pitch continue below it without overlapping and remain stable while scrolling',()=>{
  const h=clampSetup([
    {x:50,y:18,h:196,w:132},{x:52,y:38,h:196,w:132},
    {x:50,y:62,h:196,w:132},{x:52,y:82,h:196,w:132},
    {x:90,y:50,h:100,w:132}
  ],616);h.state.width=734;
  const before=plain(h.slots);h.c.sbClamp();
  const boxes=h.cards.map(h.rect),offsets=h.cards.map(card=>card.style['--oy']);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    assert.ok(Math.min(a.right,b.right)<=Math.max(a.left,b.left)||Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top),'no card covers another card');
  }
  assert.ok(boxes[3].bottom>616,'overflow is available below the fixed board instead of being compressed');
  assert.equal(h.wrap.getBoundingClientRect().height,616);
  assert.equal(h.cards[4].style['--oy'],'0px','a separate column keeps its preferred position');
  assert.deepEqual(plain(h.slots),before);
  h.wrap.scrollTop=260;h.c.sbClamp();
  assert.deepEqual(h.cards.map(card=>card.style['--oy']),offsets,'scrolling does not change the display layout');
  h.c.sbClamp();assert.deepEqual(h.cards.map(card=>card.style['--oy']),offsets);
  assert.deepEqual(plain(h.slots),before);
  h.cards.forEach(card=>{card.offsetHeight=32;});h.c.sbClamp();h.assertContained();
  assert.deepEqual(h.cards.map(card=>card.style['--oy']),['0px','0px','0px','0px','0px'],'less crowded cards return to their preferred positions');
});

test('dragging clears the display offset, follows the pointer in a scrolled board, and saves only the chosen position',()=>{
  const h=clampSetup([{x:50,y:50,h:100},{x:52,y:51,h:100}]);h.c.sbClamp();
  const card=h.cards[0],before=plain(h.slots),writes=[];let saves=0;
  assert.notEqual(card.style['--oy'],'0px');
  card.classList={remove(){}};
  Object.assign(h.c,{sbCard:{el:card,i:0},sbStore:(x,y)=>({x:y,y:100-x}),
    window:{removeEventListener(){}},sbWriteSlot:(...args)=>writes.push(args),save(){saves++;},renderTeam(){},renderScoutBoard(){}});
  vm.runInContext(part('function sbCardMove(e)','/* 카드는 중앙 정렬이라'),h.c);
  h.wrap.scrollTop=100;h.c.sbCardMove({clientX:250,clientY:200});
  assert.equal(card.style['--oy'],'0px');
  const visual=card.getBoundingClientRect();
  assert.ok(Math.abs(visual.left+visual.width/2-250)<0.001);
  assert.ok(Math.abs(visual.top+visual.height/2-200)<0.001);
  assert.deepEqual(plain(h.slots),before,'moving does not write saved positions before drop');
  assert.equal(saves,0);h.c.sbCardUp();
  assert.equal(saves,1);assert.equal(writes.length,1);
  assert.deepEqual(writes[0],[0,300/520*100,75,null]);
  assert.equal(h.c.sbCard,null);
});
