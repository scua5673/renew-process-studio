'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function part(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'source boundary: '+start);
  return source.slice(a,b);
}
function declaration(name){
  const line=source.split('\n').find(line=>line.startsWith('var '+name+'='));
  assert.ok(line,'source declaration: '+name);
  return line;
}
const implementation=[
  declaration('MB2_STD_PHASES'),declaration('MB2_DEFAULT_PHASES'),declaration('OB_PHASE_LABEL'),
  part('function mb2Ensure(m){','/* 중복 병합'),
  part('function mb2Cur(m){','/* 2.013 — 선발'),
  part('function mb2PageContext(m){','function mb2Draw(m){'),
  part('function obEnsure(m){','function obCur(m){'),
  part('function mb2ImportFromOb(m){','/* 2.757 — 담당 상대 칩')
].join('\n');

function match(){
  return {id:'match-a',phaseBoards:{
    list:[['atk','공격 시'],['def','후반 수비 계획']],cur:'atk',oppLabel:'pos',
    boards:{
      atk:{us:[{pid:'player-1',name:'가상 선수',num:'7',x:22,y:35,extra:{mark:'A'}}],opp:[{num:'9',pos:'ST',x:68,y:42,gk:false}]},
      def:{us:[{pid:'player-2',num:'5',x:30,y:60}],opp:[]}
    }
  }};
}
function setup(m=match()){
  const state={m,owner:'team-a',edit:true,saves:0,draws:0,renders:0,counts:0,forms:[],confirms:[],messages:[]};
  class FixedDate extends Date{static now(){return 1770000000000;}}
  const c=vm.createContext({JSON,Object,Date:FixedDate,
    store:{owner:()=>state.owner},matchGet:()=>state.m,matchCanEditOne:id=>state.edit&&id===state.m.id,
    mb2RenderPhases:()=>state.renders++,mb2Draw:()=>state.draws++,mb2Counts:()=>state.counts++,mb2Save:()=>state.saves++,
    toast:message=>state.messages.push(message),psForm:form=>state.forms.push(form),psConfirm:(text,onOk)=>state.confirms.push({text,onOk})
  });
  c.window=c;
  vm.runInContext(implementation,c,{filename:'scout-match-pages.js'});
  return {c,state,m};
}

test('legacy page keys, custom titles, token objects and current page survive normalization',()=>{
  const {c,m}=setup(),pb=m.phaseBoards,old=plain(pb),first=pb.boards.atk;
  assert.equal(c.mb2Ensure(m),pb);
  assert.deepEqual(plain(pb),old);
  assert.equal(pb.boards.atk,first);
  assert.equal(c.mb2Cur(m),first);
});

test('a new match starts with one named page and existing custom pages remain supported',()=>{
  const {c}=setup(),fresh={id:'fresh'};
  const pb=c.mb2Ensure(fresh);
  assert.deepEqual(plain(pb.list),[['p1','페이지 1']]);
  assert.deepEqual(plain(c.mb2Cur(fresh)),{us:[],opp:[]});
  const custom={phaseBoards:{list:[['custom-old','코너킥 두 번째']],cur:'removed',boards:{}}};
  c.mb2Ensure(custom);
  assert.equal(custom.phaseBoards.cur,'custom-old');
  assert.deepEqual(plain(custom.phaseBoards.list),[['custom-old','코너킥 두 번째']]);
  assert.deepEqual(plain(custom.phaseBoards.boards['custom-old']),{us:[],opp:[]});
});

test('adding a page immediately copies both teams independently without requesting a name first',()=>{
  const {c,m,state}=setup(),original=m.phaseBoards.boards.atk,before=plain(original);
  assert.equal(c.mb2DuplicatePage(m),true);
  const id=m.phaseBoards.cur,copy=m.phaseBoards.boards[id];
  assert.notEqual(id,'atk');
  assert.deepEqual(plain(copy),before);
  assert.notEqual(copy,original);
  assert.notEqual(copy.us,original.us);
  assert.notEqual(copy.us[0],original.us[0]);
  assert.notEqual(copy.us[0].extra,original.us[0].extra);
  assert.notEqual(copy.opp[0],original.opp[0]);
  copy.us[0].x=81;copy.us[0].extra.mark='B';copy.opp[0].num='99';
  assert.deepEqual(plain(original),before);
  assert.equal(state.forms.length,0);
  assert.equal(state.confirms.length,0);
  assert.equal(state.saves,1);
  assert.equal(state.draws,1);
});

test('rapid additions at an identical timestamp cannot overwrite earlier pages or orphan boards',()=>{
  const {c,m,state}=setup(),pb=m.phaseBoards,base='p'+(1770000000000).toString(36);
  pb.boards[base]={us:[],opp:[{num:'orphan'}]};
  const before=plain(pb.boards),ids=[];
  for(let i=0;i<4;i++){
    assert.equal(c.mb2DuplicatePage(m),true);
    ids.push(pb.cur);
    pb.boards[pb.cur].us[0].x=40+i;
  }
  assert.equal(new Set(ids).size,4);
  for(const [id,board] of Object.entries(before))assert.deepEqual(plain(pb.boards[id]),board);
  assert.deepEqual(ids.map(id=>pb.boards[id].us[0].x),[40,41,42,43]);
  assert.equal(state.saves,4);
});

test('readonly page actions cannot mutate data or open edit dialogs',()=>{
  const {c,m,state}=setup();state.edit=false;
  const before=plain(m);
  assert.equal(c.mb2PageContext(m),null);
  assert.equal(c.mb2DuplicatePage(m),false);
  c.mb2RenamePage(m);c.mb2DeletePage(m,'atk');
  assert.deepEqual(plain(m),before);
  assert.equal(state.forms.length,0);
  assert.equal(state.confirms.length,0);
  assert.equal(state.saves,0);
});

test('a stale match object cannot begin a page action',()=>{
  const {c,m,state}=setup();state.m={...m};
  assert.equal(c.mb2PageContext(m),null);
  assert.equal(c.mb2DuplicatePage(m),false);
  assert.equal(state.saves,0);
});

test('renaming changes only the page title and preserves key, order and arrangement',()=>{
  const {c,m,state}=setup(),before=plain(m.phaseBoards.boards);
  c.mb2RenamePage(m);
  assert.equal(state.forms[0].fields[0].value,'공격 시');
  assert.equal(state.saves,0);
  state.forms[0].onOk({name:'  빌드업 → 오른쪽 전개  '});
  assert.deepEqual(plain(m.phaseBoards.list),[['atk','빌드업 → 오른쪽 전개'],['def','후반 수비 계획']]);
  assert.equal(m.phaseBoards.cur,'atk');
  assert.deepEqual(plain(m.phaseBoards.boards),before);
  assert.equal(state.saves,1);
});

test('a blank name does not erase an existing title or save',()=>{
  const {c,m,state}=setup();c.mb2RenamePage(m);state.forms[0].onOk({name:'   '});
  assert.equal(m.phaseBoards.list[0][1],'공격 시');
  assert.equal(state.saves,0);
});

const staleChanges={
  workspace:({state})=>{state.owner='team-b';},
  match:({state})=>{state.m={...state.m,id:'match-b'};},
  page:({m})=>{m.phaseBoards.cur='def';},
  permission:({state})=>{state.edit=false;},
  'reloaded board object':({m})=>{m.phaseBoards=plain(m.phaseBoards);}
};
for(const [label,change] of Object.entries(staleChanges)){
  for(const operation of ['rename','delete'])test(operation+' confirmation becomes harmless after '+label+' changes',()=>{
    const h=setup(),{c,m,state}=h,ctx=c.mb2PageContext(m);
    assert.equal(c.mb2PageCurrent(ctx),true);
    if(operation==='rename')c.mb2RenamePage(m);else c.mb2DeletePage(m,'atk');
    change(h);
    const oldSnapshot=plain(m),currentSnapshot=plain(state.m);
    assert.equal(c.mb2PageCurrent(ctx),false);
    if(operation==='rename')state.forms[0].onOk({name:'stale edit'});else state.confirms[0].onOk();
    assert.deepEqual(plain(m),oldSnapshot);
    assert.deepEqual(plain(state.m),currentSnapshot);
    assert.equal(state.saves,0);
  });
}

test('deleting the current page removes only its board and selects the retained page',()=>{
  const {c,m,state}=setup(),retained=m.phaseBoards.boards.def;
  c.mb2DeletePage(m,'atk');
  assert.ok(m.phaseBoards.boards.atk,'confirmation has not yet removed data');
  state.confirms[0].onOk();
  assert.deepEqual(plain(m.phaseBoards.list),[['def','후반 수비 계획']]);
  assert.equal(m.phaseBoards.cur,'def');
  assert.equal(m.phaseBoards.boards.def,retained);
  assert.equal(Object.hasOwn(m.phaseBoards.boards,'atk'),false);
  assert.equal(state.saves,1);
});

test('the last page and noncurrent pages cannot be deleted',()=>{
  const {c,m,state}=setup();c.mb2DeletePage(m,'def');
  assert.equal(state.confirms.length,0);
  m.phaseBoards.list=[m.phaseBoards.list[0]];delete m.phaseBoards.boards.def;
  const before=plain(m);c.mb2DeletePage(m,'atk');
  assert.equal(state.confirms.length,0);
  assert.deepEqual(plain(m),before);
  assert.equal(state.saves,0);
});

test('a pending delete also protects the last page if another page disappears before confirmation',()=>{
  const {c,m,state}=setup();c.mb2DeletePage(m,'atk');
  m.phaseBoards.list=[m.phaseBoards.list[0]];delete m.phaseBoards.boards.def;
  const before=plain(m);state.confirms[0].onOk();
  assert.deepEqual(plain(m),before);
  assert.equal(state.saves,0);
});

function analysis(m){
  m.oppPB={list:[['atk','공격'],['def','수비']],cur:'def',boards:{
    atk:{cur:0,frames:[{us:[],opp:[{num:'9',pos:'ST',x:70,y:22,gk:false}]}]},
    def:{cur:1,frames:[{us:[],opp:[{num:'4',pos:'CB',x:25,y:35}]},{us:[],opp:[{num:'1',pos:'GK',x:91,y:50,gk:true}]}]}
  }};
}

test('a legacy standard page imports the same analysis phase even after its title is renamed',()=>{
  const {c,m,state}=setup();analysis(m);m.phaseBoards.list[0][1]='자유로운 제목';
  const ours=m.phaseBoards.boards.atk.us;
  assert.equal(c.mb2ImportFromOb(m),true);
  assert.deepEqual(plain(m.phaseBoards.boards.atk.opp),plain(m.oppPB.boards.atk.frames[0].opp));
  assert.equal(m.phaseBoards.boards.atk.us,ours);
  assert.equal(m.oppPB.cur,'def');
  assert.equal(state.saves,1);
});

test('a free page imports the currently viewed analysis frame as an independent copy',()=>{
  const {c,m,state}=setup();analysis(m);
  m.phaseBoards.list.push(['free-page','공격 시']);m.phaseBoards.cur='free-page';
  m.phaseBoards.boards['free-page']={us:[{pid:'own',x:25,y:35}],opp:[]};
  const original=m.oppPB.boards.def.frames[1].opp[0];
  assert.equal(c.mb2ImportFromOb(m),true);
  const copied=m.phaseBoards.boards['free-page'].opp[0];
  assert.deepEqual(plain(copied),plain(original));
  assert.notEqual(copied,original);
  copied.x=33;assert.equal(original.x,91);
  assert.match(state.messages.at(-1),/볼 비소유 시/);
  assert.equal(state.saves,1);
});

test('the first page of a new match also imports the currently viewed analysis phase',()=>{
  const {c,m}=setup({id:'match-a'});analysis(m);
  const pb=c.mb2Ensure(m);
  assert.equal(c.mb2ImportFromOb(m),true);
  assert.deepEqual(plain(pb.boards[pb.cur].opp),plain(m.oppPB.boards.def.frames[1].opp));
});

test('an empty selected analysis source does not erase the page opponent arrangement',()=>{
  const {c,m,state}=setup();analysis(m);m.oppPB.boards.atk.frames[0].opp=[];
  const before=plain(m.phaseBoards.boards.atk);
  assert.equal(c.mb2ImportFromOb(m),false);
  assert.deepEqual(plain(m.phaseBoards.boards.atk),before);
  assert.equal(state.saves,0);
});
