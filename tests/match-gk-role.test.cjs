'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function declaration(name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'source function: '+name);
  const body=source.indexOf('{',start);
  let depth=0,quote='',comment='';
  for(let i=body;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(comment==='line'){if(ch==='\n')comment='';continue;}
    if(comment==='block'){if(ch==='*'&&next==='/'){comment='';i++;}continue;}
    if(quote){if(ch==='\\'){i++;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='/'){comment='line';i++;continue;}
    if(ch==='/'&&next==='*'){comment='block';i++;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  assert.fail('unclosed source function: '+name);
}
const implementation=['matchPlayerRole','matchPlayerRoleSet','matchKitIsGK','matchKitPaint','matchPlayerRoleEditor','matchTokenEditorPosition','teamSaveOwner'].map(declaration).join('\n');

function match(id='match-a'){
  return {id,squad:{start:['keeper','field-one'],res:['substitute']},
    phaseBoards:{cur:'p1',list:[['p1','페이지 1'],['p2','후반']],boards:{
      p1:{us:[{pid:'keeper',num:'1',pos:'GK',gk:true,x:8,y:50},{pid:'substitute',num:'12',pos:'CB',gk:false,x:24,y:31}],opp:[{pid:'substitute',num:'1',gk:true,x:93,y:50}]},
      p2:{us:[{pid:'substitute',num:'12',pos:'CB',gk:false,x:11,y:49}],opp:[]}
    }},
    oppPB:{cur:'def',list:[['def','수비']],boards:{def:{cur:1,frames:[
      {us:[{pid:'substitute',num:'12',pos:'CB',gk:false,x:20,y:40}],opp:[]},
      {us:[{pid:'substitute',num:'12',pos:'CB',gk:false,x:15,y:55}],opp:[{pid:'substitute',num:'1',gk:true,x:91,y:52}]}
    ]}}},
    boardKitsV1:{prep:{us:{gk:{main:'#55aa55'},field:{main:'#222222'}}},analysis:{us:{gk:{main:'#11aaaa'}}}}
  };
}
function setup(){
  const paints=[],data={players:[{id:'substitute',name:'가상 대체 선수',num:'12',posId:'cb',levels:{speed:3}},{id:'field-one',name:'가상 필드 선수',num:'1',posId:'st'}]};
  const c=vm.createContext({data,
    matchKitStyle:(m,mode,side,role)=>{paints.push({m,mode,side,role});return {main:role==='gk'?'#55aa55':'#222222',accent:'#ffffff',pat:'solid',stroke:'#ffffff',txt:'#000000'};},
    matchKitCSSBG:main=>main,matchKitLum:()=>0
  });
  vm.runInContext(implementation,c,{filename:'scout-match-gk-role.js'});
  return {c,data,paints};
}
function ownTokens(m){return [m.phaseBoards.boards.p1.us[1],m.phaseBoards.boards.p2.us[0],...m.oppPB.boards.def.frames.map(f=>f.us[0])];}

test('role lookup accepts only explicit per-match goalkeeper or field overrides without creating data',()=>{
  const {c}=setup(),m=match(),before=plain(m);
  assert.equal(c.matchPlayerRole(m,'substitute'),'');
  assert.deepEqual(plain(m),before);
  m.boardPlayerRolesV1={substitute:'gk','field-one':'field',bad:'GK',unknown:'keeper'};
  assert.equal(c.matchPlayerRole(m,'substitute'),'gk');
  assert.equal(c.matchPlayerRole(m,'field-one'),'field');
  for(const pid of ['bad','unknown','missing',''])assert.equal(c.matchPlayerRole(m,pid),'');
});

test('a substitute goalkeeper overrides stale field flags on every preparation page and analysis frame',()=>{
  const {c}=setup(),m=match();
  for(const token of ownTokens(m))assert.equal(c.matchKitIsGK(token,m,false),false);
  c.matchPlayerRoleSet(m,'substitute','gk');
  for(const token of ownTokens(m))assert.equal(c.matchKitIsGK(token,m,false),true);
});

test('an explicit field role wins over goalkeeper flags, position and shirt number one',()=>{
  const {c}=setup(),m=match(),token={pid:'field-one',num:'1',pos:'GK',gk:true};
  c.matchPlayerRoleSet(m,'field-one','field');
  assert.equal(c.matchKitIsGK(token,m,false),false);
  c.matchPlayerRoleSet(m,'field-one','gk');
  assert.equal(c.matchKitIsGK(token,m,false),true);
});

test('role changes preserve player records, token identities, coordinates, numbers, squad and kit settings',()=>{
  const {c,data}=setup(),m=match(),before=plain(m),playersBefore=plain(data),tokens=ownTokens(m).slice(),tokenBefore=tokens.map(plain);
  c.matchPlayerRoleSet(m,'substitute','gk');
  c.matchPlayerRoleSet(m,'field-one','field');
  const actual=plain(m);delete actual.boardPlayerRolesV1;
  assert.deepEqual(actual,before);
  assert.deepEqual(plain(data),playersBefore);
  ownTokens(m).forEach((token,i)=>{assert.equal(token,tokens[i]);assert.deepEqual(plain(token),tokenBefore[i]);});
});

test('the same player can be goalkeeper in one match and field player in another',()=>{
  const {c}=setup(),a=match('match-a'),b=match('match-b'),token=ownTokens(a)[0];
  c.matchPlayerRoleSet(a,'substitute','gk');
  assert.equal(c.matchKitIsGK(token,a,false),true);
  assert.equal(c.matchKitIsGK(token,b,false),false);
  c.matchPlayerRoleSet(b,'substitute','field');
  assert.equal(c.matchPlayerRole(a,'substitute'),'gk');
  assert.equal(c.matchPlayerRole(b,'substitute'),'field');
});

test('our role overrides never affect opponents even when their player identifiers collide',()=>{
  const {c}=setup(),m=match();
  c.matchPlayerRoleSet(m,'substitute','gk');
  assert.equal(c.matchKitIsGK({pid:'substitute',num:'12',gk:false},m,true),false);
  c.matchPlayerRoleSet(m,'substitute','field');
  assert.equal(c.matchKitIsGK({pid:'substitute',num:'1',gk:true},m,true),true);
});

test('tokens without a linked player keep their own role even when the match has overrides',()=>{
  const {c}=setup(),m=match();c.matchPlayerRoleSet(m,'substitute','gk');
  assert.equal(c.matchKitIsGK({num:'12',gk:false},m,false),false);
  assert.equal(c.matchKitIsGK({num:'1',gk:true},m,false),true);
});

test('explicit boolean roles take priority over contradictory positions and numbers',()=>{
  const {c}=setup(),m=match();
  for(const opp of [false,true]){
    assert.equal(c.matchKitIsGK({gk:false,pos:'GK',num:'1'},m,opp),false);
    assert.equal(c.matchKitIsGK({gk:true,pos:'CB',num:'12'},m,opp),true);
    assert.equal(c.matchKitIsGK({gk:false,num:'1'},m,opp),false);
  }
});

test('position fallback recognizes trimmed GK and treats an explicit field position as authoritative',()=>{
  const {c}=setup(),m=match();
  for(const opp of [false,true]){
    for(const pos of ['GK','gk','  gK  '])assert.equal(c.matchKitIsGK({pos,num:'12'},m,opp),true);
    for(const pos of ['CB','st',' CM '])assert.equal(c.matchKitIsGK({pos,num:'1'},m,opp),false);
    assert.equal(c.matchKitIsGK({gk:'false',pos:'GK',num:'12'},m,opp),true);
  }
});

test('legacy number-one inference remains available only when role and position are absent',()=>{
  const {c}=setup(),m=match();
  for(const num of ['1',1,' 1 '])assert.equal(c.matchKitIsGK({num},m,false),true);
  assert.equal(c.matchKitIsGK({num:'1',pos:'  '},m,false),true);
  for(const token of [{},{num:'12'},{num:'01'},null,undefined])assert.equal(c.matchKitIsGK(token,m,false),false);
  assert.equal(c.matchKitIsGK({num:'1'}),true);
});

test('JSON save and reload preserve both roles and every board while keeping matches independent',()=>{
  const {c}=setup(),m=match();c.matchPlayerRoleSet(m,'substitute','gk');c.matchPlayerRoleSet(m,'keeper','field');
  const restored=plain(m);
  assert.equal(c.matchPlayerRole(restored,'substitute'),'gk');
  assert.equal(c.matchPlayerRole(restored,'keeper'),'field');
  for(const token of ownTokens(restored))assert.equal(c.matchKitIsGK(token,restored,false),true);
  assert.equal(c.matchKitIsGK(restored.phaseBoards.boards.p1.us[0],restored,false),false);
  assert.deepEqual(restored,plain(m));
  c.matchPlayerRoleSet(restored,'substitute','field');
  assert.equal(c.matchPlayerRole(m,'substitute'),'gk');
});

test('reset removes only the requested override and resumes the existing token role',()=>{
  const {c}=setup(),m=match();c.matchPlayerRoleSet(m,'substitute','gk');c.matchPlayerRoleSet(m,'keeper','field');
  c.matchPlayerRoleSet(m,'substitute','');
  assert.equal(c.matchPlayerRole(m,'substitute'),'');
  assert.deepEqual(plain(m.boardPlayerRolesV1),{keeper:'field'});
  for(const token of ownTokens(m))assert.equal(c.matchKitIsGK(token,m,false),false);
  c.matchPlayerRoleSet(m,'keeper','');
  assert.equal(Object.hasOwn(m,'boardPlayerRolesV1'),false);
  assert.equal(c.matchKitIsGK(m.phaseBoards.boards.p1.us[0],m,false),true);
});

test('reset of an absent override does not create empty persisted state or remove another player role',()=>{
  const {c}=setup(),m=match(),before=plain(m);
  c.matchPlayerRoleSet(m,'missing','');assert.deepEqual(plain(m),before);
  c.matchPlayerRoleSet(m,'keeper','gk');c.matchPlayerRoleSet(m,'missing','');
  assert.deepEqual(plain(m.boardPlayerRolesV1),{keeper:'gk'});
});

test('missing player identifiers and unsupported roles cannot mutate the match',()=>{
  const {c}=setup();
  for(const existing of [false,true]){
    const m=match();if(existing)m.boardPlayerRolesV1={keeper:'gk'};
    const before=plain(m);
    for(const pid of ['',null,undefined])for(const role of ['gk','field',''])c.matchPlayerRoleSet(m,pid,role);
    for(const role of ['GK','keeper','FIELD',' gk ',null,undefined,false,1,{}])c.matchPlayerRoleSet(m,'keeper',role);
    assert.deepEqual(plain(m),before);
  }
});

test('actual kit painting applies the per-match role to both our boards and leaves opponents independent',()=>{
  const {c,paints}=setup(),m=match(),token={pid:'substitute',num:'12',pos:'CB',gk:false};
  c.matchPlayerRoleSet(m,'substitute','gk');
  for(const mode of ['prep','analysis']){
    const us={style:{}};c.matchKitPaint(m,mode,us,token,false);
    assert.equal(us.style.background,'#55aa55');
    const opp={style:{}};c.matchKitPaint(m,mode,opp,token,true);
    assert.equal(opp.style.background,'#222222');
  }
  assert.deepEqual(paints.map(({mode,side,role})=>({mode,side,role})),[
    {mode:'prep',side:'us',role:'gk'},{mode:'prep',side:'opp',role:'field'},
    {mode:'analysis',side:'us',role:'gk'},{mode:'analysis',side:'opp',role:'field'}
  ]);
  assert.ok(paints.every(p=>p.m===m));
  c.matchPlayerRoleSet(m,'substitute','field');
  const field={style:{}};c.matchKitPaint(m,'prep',field,{...token,gk:true,pos:'GK',num:'1'},false);
  assert.equal(field.style.background,'#222222');
});

function editorSetup(mode){
  const {c}=setup(),m=match(),state={current:m,editable:true,saves:0,prepDraws:0,analysisDraws:0,trays:0,prepCloses:0,analysisCloses:0,messages:[]};
  const stored=new Map([
    ['ps_active_ws','workspace-a'],['ps_sync_session',JSON.stringify({uid:'coach-a'})],
    ['ps_cache_owner_v1','owner-a'],['ps_ws_switch_epoch_v1','1'],['cs_perms_v1','coach']
  ]);
  const del={},ed={children:[del],querySelector:selector=>selector==='.del'?del:null,
    insertBefore(el,before){const index=this.children.indexOf(before);assert.ok(index>=0);this.children.splice(index,0,el);}
  };
  c.localStorage={getItem:key=>stored.get(key)||null};
  c.store={owner:()=>c.teamSaveOwner()};
  c.document={createElement:tag=>({tagName:tag.toUpperCase(),attributes:{},listeners:{},
    setAttribute(key,value){this.attributes[key]=value;},
    addEventListener(type,fn){this.listeners[type]=fn;},
    emit(type,event={}){this.listeners[type].call(this,event);}
  })};
  c.matchGet=()=>state.current;c.matchCanEditOne=id=>state.editable&&state.current&&id===state.current.id;
  c.mb2Ensure=target=>target.phaseBoards;c.mb2Cur=target=>target.phaseBoards.boards[target.phaseBoards.cur];
  c.obEnsure=target=>target.oppPB;c.obFrame=target=>{const board=target.oppPB.boards[target.oppPB.cur];return board.frames[board.cur||0];};
  c.mb2Deselect=()=>state.prepCloses++;c.obCloseEdit=()=>state.analysisCloses++;
  c.mb2RenderTrays=target=>{assert.equal(target,m);state.trays++;};
  c.mb2Draw=target=>{assert.equal(target,m);state.prepDraws++;};
  c.obDraw=target=>{assert.equal(target,m);state.analysisDraws++;};
  c.matchQueueSave=()=>state.saves++;c.toast=message=>state.messages.push(message);
  const board=mode==='analysis'?m.oppPB:m.phaseBoards;
  const frame=mode==='analysis'?c.obFrame(m):c.mb2Cur(m);
  const token=frame.us.find(t=>t.pid==='substitute');
  c.matchPlayerRoleEditor(m,ed,token,mode);
  const select=ed.children[0];
  return {c,m,state,stored,ed,select,board,frame,token};
}

for(const mode of ['prep','analysis']){
  test(mode+': a current role selection redraws both boards and queues exactly one save',()=>{
    const {c,m,state,select,token}=editorSetup(mode),before=plain(token);
    assert.equal(select.tagName,'SELECT');
    assert.equal(select.attributes['aria-label'],'이 경기 역할');
    assert.equal(select.value,'');
    let stopped=0;select.emit('keydown',{stopPropagation(){stopped++;}});assert.equal(stopped,1);
    select.value='gk';select.emit('change');
    assert.equal(c.matchPlayerRole(m,token.pid),'gk');
    assert.deepEqual(plain(token),before);
    assert.equal(state.saves,1);assert.equal(state.trays,1);
    assert.equal(state.prepDraws,1);assert.equal(state.analysisDraws,1);
    assert.equal(state.prepCloses,1);assert.equal(state.analysisCloses,1);
    assert.equal(state.messages.length,1);
  });

  test(mode+': stale role selectors cannot save after owner, permission, match, page or token changes',()=>{
    const cases=[
      ['workspace',h=>h.stored.set('ps_active_ws','workspace-b')],
      ['account',h=>h.stored.set('ps_sync_session',JSON.stringify({uid:'coach-b'}))],
      ['cache owner',h=>h.stored.set('ps_cache_owner_v1','owner-b')],
      ['workspace switch epoch',h=>h.stored.set('ps_ws_switch_epoch_v1','2')],
      ['permission snapshot',h=>h.stored.set('cs_perms_v1','player')],
      ['edit permission',h=>{h.state.editable=false;}],
      ['different match',h=>{h.state.current=match('match-b');}],
      ['same-id reloaded match',h=>{h.state.current=plain(h.m);}],
      ['no current match',h=>{h.state.current=null;}],
      ['replaced board document',h=>{h.m[mode==='analysis'?'oppPB':'phaseBoards']=plain(h.board);}],
      ['changed page',h=>{
        const other=mode==='analysis'?'atk':'p2';
        if(mode==='analysis')h.board.boards[other]={cur:0,frames:[{us:[h.token],opp:[]}]};
        h.board.cur=other;
      }],
      ['replaced current frame',h=>{
        if(mode==='analysis'){const board=h.board.boards[h.board.cur];board.frames[board.cur]=plain(h.frame);}
        else h.board.boards[h.board.cur]=plain(h.frame);
      }],
      ['removed token',h=>{h.frame.us=h.frame.us.filter(t=>t!==h.token);}]
    ];
    if(mode==='analysis')cases.push(['changed animation frame',h=>{h.board.boards[h.board.cur].cur=0;}]);
    for(const [label,mutate] of cases){
      const h=editorSetup(mode);mutate(h);
      const before=plain(h.m),tokenBefore=plain(h.token);
      h.select.value='gk';h.select.emit('change');
      assert.deepEqual(plain(h.m),before,label);
      assert.deepEqual(plain(h.token),tokenBefore,label);
      assert.equal(h.state.saves,0,label);assert.equal(h.state.trays,0,label);
      assert.equal(h.state.prepDraws,0,label);assert.equal(h.state.analysisDraws,0,label);
      assert.equal(h.state.prepCloses,1,label);assert.equal(h.state.analysisCloses,1,label);
      assert.equal(h.state.messages.length,0,label);
    }
  });

  test(mode+': resetting a role through the editor saves once and restores the token fallback',()=>{
    const h=editorSetup(mode);h.c.matchPlayerRoleSet(h.m,h.token.pid,'gk');
    h.select.value='';h.select.emit('change');
    assert.equal(Object.hasOwn(h.m,'boardPlayerRolesV1'),false);
    assert.equal(h.c.matchKitIsGK(h.token,h.m,false),false);
    assert.equal(h.state.saves,1);assert.equal(h.state.prepDraws,1);assert.equal(h.state.analysisDraws,1);
  });
}

test('token editor positioning keeps ordinary-size popups inside both pitch edges and below top-edge tokens',()=>{
  const {c}=setup(),pit={clientWidth:320,clientHeight:200};
  for(const [left,expected] of [['2%',94],['98%',226],['50%',160]]){
    const ed={offsetWidth:180,offsetHeight:30,style:{}},token={style:{left,top:'4%'}};
    c.matchTokenEditorPosition(ed,token,pit);
    assert.equal(ed.style.left,expected+'px');
    assert.equal(ed.style.transform,'translate(-50%,24px)');
    assert.ok(expected-ed.offsetWidth/2>=0);
    assert.ok(expected+ed.offsetWidth/2<=pit.clientWidth);
  }
  const lower={offsetWidth:180,offsetHeight:30,style:{}};
  c.matchTokenEditorPosition(lower,{style:{left:'50%',top:'96%'}},pit);
  assert.equal(lower.style.left,'160px');
  assert.equal(lower.style.transform,undefined);
});
