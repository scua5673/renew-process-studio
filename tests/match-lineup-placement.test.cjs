'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const code=[
  part('var MB2_FORMS={','var MB2_STD_PHASES='),
  part('var MB2_SLOTS={','var MB2_POS_LIST='),
  part('function matchReviewSquad(m){','function matchSquadModernHas(m){'),
  part('function matchPlayerRole(m,pid){','function matchKitPaint('),
  part('function matchLineupStarters(m){','/* ══ 2.757 · 경기 준비'),
  part('function mb2FillUs(m){','function mb2FillOp(m){')
].join('\n');
const plain=v=>JSON.parse(JSON.stringify(v));
function setup(codes=['GK','RB','RCB','LCB','LB','RDM','LDM','RW','AM','LW','ST']){
  const players=codes.map((pos,i)=>({id:'p'+i,name:'선수 '+i,num:String(i+1),posId:'pos'+i,manual:true}));
  const data={players,positions:codes.map((name,i)=>({id:'pos'+i,name})),meta:{}};
  const m={id:'match',formation:'4231',squad:{start:players.map(p=>p.id),res:[]},
    phaseBoards:{list:[['atk','준비 A'],['def','준비 B']],cur:'atk',boards:{atk:{us:[],opp:[]},def:{us:[],opp:[]}}},
    oppPB:{cur:'atk',list:[['atk','공격'],['def','수비']],boards:{atk:{frames:[{us:[],opp:[]}],cur:0},def:{frames:[{us:[],opp:[]}],cur:0}}}};
  const state={edit:true,saves:0,draws:0,messages:[]};
  const c=vm.createContext({JSON,Math,Object,Array,data,
    tmOurs:()=>players,tmAbbrOf:p=>data.positions.find(x=>x.id===p.posId)?.name||'',matchFormLabel:key=>key,tbShape:()=>'',
    matchCanEditOne:()=>state.edit,mb2Cur:m=>m.phaseBoards.boards[m.phaseBoards.cur],obFrame:m=>m.oppPB.boards[m.oppPB.cur].frames[m.oppPB.boards[m.oppPB.cur].cur],
    mb2Draw:()=>state.draws++,obDraw:()=>state.draws++,mb2Counts(){},mb2SyncTray(){},
    mb2Save:()=>state.saves++,obSave:()=>state.saves++,toast:message=>state.messages.push(message)
  });vm.runInContext(code,c);return {c,m,data,players,state};
}
function assignments(c,m){const r=c.matchStartersToSlots(m);return Object.fromEntries(r.picked.map((p,i)=>p?[p.id,{label:r.labels[i],x:r.slots[i][0],y:r.slots[i][1]}]:null).filter(Boolean));}
function cards(h,labels=['GK','RB','CB','CB','LB','DM','DM','RW','AM','LW','ST']){
  h.data.meta.tbSlots=labels.map((ab,i)=>({ab,x:i===0?14:20+i*5,y:i===2?20:i===3?80:50}));
}

test('eleven unassigned players remain in the roster instead of being numbered into arbitrary positions',()=>{
  const {c,m,players}=setup(Array(11).fill(''));players.forEach(p=>p.num='');
  const r=c.matchStartersToSlots(m);assert.equal(r.ok,true);assert.equal(r.picked.filter(Boolean).length,0);assert.equal(r.pool.length,11);
});
test('no selected goalkeeper leaves the goalkeeper slot empty and does not turn an extra midfielder into a goalkeeper',()=>{
  const {c,m}=setup(['RW','LB','LCB','RCB','RB','DM','CM','AM','LW','ST','CM']);
  const r=c.matchStartersToSlots(m),gk=r.labels.indexOf('GK');assert.equal(r.picked[gk],null);
  assert.ok(r.pool.length>0);assert.ok(r.pool.every(p=>c.matchLineupIsGK(m,p)===false));
});
test('LCB/RCB and LDM/RDM keep their flank when selected in either order',()=>{
  const {c,m}=setup(),first=assignments(c,m);m.squad.start.reverse();const second=assignments(c,m);
  assert.deepEqual(second,first);assert.ok(first.p2.y<50);assert.ok(first.p3.y>50);assert.ok(first.p5.y<50);assert.ok(first.p6.y>50);
});
test('a role override chooses the designated match goalkeeper ahead of a default goalkeeper',()=>{
  const {c,m,players}=setup();m.boardPlayerRolesV1={p8:'gk'};
  const r=c.matchStartersToSlots(m);assert.equal(r.picked[r.labels.indexOf('GK')],players[8]);
  assert.ok(r.pool.includes(players[0]));assert.ok(r.picked.every((p,i)=>!p||i===r.labels.indexOf('GK')||!c.matchLineupIsGK(m,p)));
});
test('a registered goalkeeper explicitly playing field is never automatically put back in the goalkeeper slot',()=>{
  const {c,m,players}=setup();m.boardPlayerRolesV1={p0:'field'};const r=c.matchStartersToSlots(m);
  assert.equal(r.picked[r.labels.indexOf('GK')],null);assert.ok(r.pool.includes(players[0]));
});
test('shirt number 1 does not make a field player a goalkeeper and missing numbers remain blank',()=>{
  const {c,m,players}=setup(['CM','GK']);players[0].num='1';players[1].num='';
  assert.equal(c.matchLineupToken(m,players[0],30,40).gk,false);
  const keeper=c.matchLineupToken(m,players[1],6,50);assert.equal(keeper.num,'');assert.equal(keeper.gk,true);
});
test('excess players and mismatched known positions stay unassigned instead of filling another line',()=>{
  const {c,m,players}=setup(['GK','ST','ST','ST','ST','ST','ST','ST','ST','ST','ST','ST']);
  const r=c.matchStartersToSlots(m);assert.equal(r.picked.filter(Boolean).length,2);assert.equal(r.pool.length,players.length-2);
  assert.ok(r.picked.every((p,i)=>!p||['GK','ST'].includes(r.labels[i])));
});
test('equivalent positions still match while a generic central player does not displace a left-only player',()=>{
  const {c,m}=setup(['GK','CB','LCB','CF']);const map=assignments(c,m);
  assert.ok(map.p2.y>50);assert.ok(map.p1.y<50);assert.equal(map.p3.label,'ST');
});
test('saved team card position IDs take priority over equal abbreviations and starter selection order',()=>{
  const h=setup(['GK','CB','CB','LB','RB','DM','DM','RW','AM','LW','ST']);cards(h,['GK','CB','CB','LB','RB','DM','DM','RW','AM','LW','ST']);
  h.data.meta.tbCards=h.data.positions.map(p=>p.id);[h.data.meta.tbCards[1],h.data.meta.tbCards[2]]=[h.data.meta.tbCards[2],h.data.meta.tbCards[1]];
  h.m.squad.start.reverse();const r=h.c.matchStartersToSlots(h.m);
  assert.equal(r.formKey,'cards');assert.equal(r.picked[1].id,'p2');assert.equal(r.picked[2].id,'p1');
  assert.equal(r.slots[2][1],20);
});
test('outdated card IDs with a different abbreviation cannot pull a player into the wrong position',()=>{
  const h=setup();cards(h);h.data.meta.tbCards=Array(11).fill('pos8');
  const r=h.c.matchStartersToSlots(h.m);assert.equal(r.picked[8].id,'p8');assert.ok(r.picked.every((p,i)=>!p||p.id!=='p8'||i===8));
});
test('invalid team card coordinates fall back to finite formation slots',()=>{
  const h=setup();cards(h);h.data.meta.tbSlots[3].x='broken';const r=h.c.matchStartersToSlots(h.m);
  assert.equal(r.formKey,'4231');assert.ok(r.slots.every(p=>p.every(Number.isFinite)));
});
test('no compatible positions leave existing preparation and analysis drawings unchanged',()=>{
  const {c,m,state}=setup(['']);m.phaseBoards.boards.atk.us=[{pid:'manual-old',x:25,y:45}];m.oppPB.boards.atk.frames[0].us=[{pid:'analysis-old',x:40,y:35}];
  const before=plain(m);c.mb2FillUs(m);c.obFillUs(m);assert.deepEqual(plain(m),before);assert.equal(state.saves,0);assert.match(state.messages.join(' '),/명단에서 직접 배치/);
});
test('preparation fill preserves opponent tokens and names unmatched starters in its notice',()=>{
  const {c,m,state,players}=setup(['GK','RB','']);players[0].num='';m.phaseBoards.boards.atk.opp=[{num:'9',x:60,y:40}];
  c.mb2FillUs(m);const board=m.phaseBoards.boards.atk;assert.equal(board.us.length,2);assert.equal(board.us[0].num,'');assert.equal(board.opp[0].num,'9');assert.equal(state.saves,1);assert.match(state.messages.at(-1),/나머지 1명/);
});
test('analysis fill copies corresponding preparation page coordinates without rerunning formation assignment',()=>{
  const {c,m,state}=setup(['','RB']);m.phaseBoards.cur='def';
  m.phaseBoards.boards.atk.us=[{pid:'p0',num:'77',name:'직접 배치',x:82.3,y:14.7,gk:false,extra:{arrow:1}}];
  m.phaseBoards.boards.def.us=[{pid:'p0',num:'88',x:10,y:20}];
  c.obFillUs(m);const copied=m.oppPB.boards.atk.frames[0].us[0];
  assert.equal(copied.x,82.3);assert.equal(copied.y,14.7);assert.equal(copied.num,'77');assert.equal(copied.gk,false);
  copied.extra.arrow=3;assert.equal(m.phaseBoards.boards.atk.us[0].extra.arrow,1);assert.match(state.messages.at(-1),/준비 A/);assert.match(state.messages.at(-1),/나머지 1명/);
});
test('analysis fill falls back to the current free preparation page when no matching key exists',()=>{
  const {c,m}=setup(['']);m.phaseBoards={cur:'p-free',list:[['p-free','후반 자유 배치']],boards:{'p-free':{us:[{pid:'p0',x:73,y:31,gk:false}],opp:[]}}};
  c.obFillUs(m);assert.deepEqual(plain(m.oppPB.boards.atk.frames[0].us).map(t=>[t.pid,t.x,t.y]),[['p0',73,31]]);
});
test('prepared copying excludes reserves, duplicates, removed players and invalid coordinates',()=>{
  const {c,m}=setup(['','RB','LB']);m.squad.start=['p0','p2'];m.squad.res=['p1'];
  m.phaseBoards.boards.atk.us=[{pid:'p0',x:0,y:100},{pid:'p0',x:10,y:20},{pid:'p1',x:30,y:40},{pid:'gone',x:40,y:50},{pid:'p2',x:'broken',y:60}];
  const r=c.matchPreparedStarters(m);assert.equal(r.tokens.length,1);assert.equal(r.tokens[0].x,0);assert.equal(r.tokens[0].y,100);assert.deepEqual(Array.from(r.pool,p=>p.id),['p2']);
});
test('copied preparation tokens respect a newer match-role override without changing the source',()=>{
  const {c,m}=setup(['CM']);m.boardPlayerRolesV1={p0:'gk'};m.phaseBoards.boards.atk.us=[{pid:'p0',x:25,y:30,gk:false}];
  c.obFillUs(m);const token=m.oppPB.boards.atk.frames[0].us[0];
  assert.equal(token.gk,false);assert.equal(c.matchKitIsGK(token,m,false),true);assert.equal(m.phaseBoards.boards.atk.us[0].gk,false);
  c.matchPlayerRoleSet(m,'p0','');assert.equal(c.matchKitIsGK(token,m,false),false);
});
for(const mode of ['preparation','analysis'])test(mode+' automatic placement keeps the base field role when a goalkeeper override is later reset',()=>{
  const {c,m}=setup(['CM']);c.matchPlayerRoleSet(m,'p0','gk');
  if(mode==='preparation')c.mb2FillUs(m);else c.obFillUs(m);
  const token=mode==='preparation'?m.phaseBoards.boards.atk.us[0]:m.oppPB.boards.atk.frames[0].us[0];
  assert.ok(token);assert.equal(token.x,6);assert.equal(token.y,50);
  assert.equal(token.gk,false);assert.equal(c.matchKitIsGK(token,m,false),true);
  c.matchPlayerRoleSet(m,'p0','');assert.equal(c.matchKitIsGK(token,m,false),false);
});
test('copying under a field override also preserves the source goalkeeper base role for reset',()=>{
  const {c,m}=setup(['GK']);c.matchPlayerRoleSet(m,'p0','field');m.phaseBoards.boards.atk.us=[{pid:'p0',x:31,y:48,gk:true}];
  c.obFillUs(m);const token=m.oppPB.boards.atk.frames[0].us[0];
  assert.equal(token.gk,true);assert.equal(c.matchKitIsGK(token,m,false),false);
  c.matchPlayerRoleSet(m,'p0','');assert.equal(c.matchKitIsGK(token,m,false),true);
});
test('readonly and empty selection cannot replace either board',()=>{
  const {c,m,state}=setup();state.edit=false;const before=plain(m);c.mb2FillUs(m);c.obFillUs(m);assert.deepEqual(plain(m),before);assert.equal(state.saves,0);
  state.edit=true;m.squad.start=[];c.mb2FillUs(m);c.obFillUs(m);assert.equal(state.saves,0);
});
