'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ScoutStore=require('../studio/scouting-store.js');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function slice(begin,end){const a=source.indexOf(begin),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const implementation=slice('var scIdentityEditState=null;','/* ── 핵심 속성 나란히 비교');
const persistence=slice('function scProject(p){','async function scMigrateMainTargets(){');
const clone=x=>JSON.parse(JSON.stringify(x));
const escape=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const decode=v=>v.replace(/&(amp|lt|gt|quot|#39);/g,(_,s)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[s]));

// The app's real delegated handlers and dialog markup run against a small DOM.
// Native focus trapping and viewport behavior are covered by the manual browser check.
class Element{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.attrs={};this.dataset={};this.children=[];this.parentNode=null;this.listeners={};this.value='';this.disabled=false;this.open=false;this._text='';}
  setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);if(k==='value')this.value=decode(String(v));}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  set id(v){this.setAttribute('id',v);}get id(){return this.attrs.id||'';}
  set className(v){this.setAttribute('class',v);}get className(){return this.attrs.class||'';}
  get parentElement(){return this.parentNode;}
  get isConnected(){return this===this.doc.body||!!(this.parentNode&&this.parentNode.isConnected);}
  appendChild(el){el.parentNode=this;this.children.push(el);return el;}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}}
  set innerHTML(html){this._html=html;this.children=[];this._text='';let stack=[this];
    for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){if(token.startsWith('</')){stack.pop();continue;}if(token.startsWith('<')){
      const m=token.match(/^<([\w-]+)/);if(!m)continue;const el=new Element(m[1],this.doc);
      for(const a of token.slice(m[0].length).matchAll(/([\w:-]+)(?:="([^"]*)")?/g))el.setAttribute(a[1],decode(a[2]||''));
      stack.at(-1).appendChild(el);if(!/\/>$/.test(token)&&!['INPUT','BR','HR','IMG','META','LINK'].includes(el.tagName))stack.push(el);
    }else stack.at(-1)._text+=decode(token);}}
  get innerHTML(){return this._html||'';}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  matches(selector){return selector.split(',').some(s=>{s=s.trim();const tag=s.match(/^[a-z][\w-]*/i);if(tag&&tag[0].toUpperCase()!==this.tagName)return false;
    for(const c of s.matchAll(/\.([\w-]+)/g))if(!this.className.split(/\s+/).includes(c[1]))return false;
    const id=s.match(/^#([\w-]+)/);if(id&&id[1]!==this.id)return false;
    for(const a of s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){if(a[1]==='open'){if(!this.open)return false;}else if(!(a[1]in this.attrs)||a[2]!=null&&this.attrs[a[1]]!==a[2])return false;}
    return true;});}
  querySelectorAll(s){return this.children.flatMap(c=>(c.matches(s)?[c]:[]).concat(c.querySelectorAll(s)));}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){return this.matches(s)?this:this.parentNode&&this.parentNode.closest(s);}
  addEventListener(type,fn){(this.listeners[type]||(this.listeners[type]=[])).push(fn);}
  focus(){this.doc.activeElement=this;}select(){this.selected=true;}
  showModal(){this.open=true;this.modal=true;}
  close(){this.open=false;fire(this,'close');}
  getBoundingClientRect(){return {left:100,right:400,top:100,bottom:500};}
}
function fire(target,type,extra={}){
  const e={target,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};const pending=[];
  for(let n=target;n;n=n.parentNode){for(const fn of n.listeners[type]||[]){const p=fn(e);if(p&&typeof p.then==='function')pending.push(p);}if(e.stopped)break;}
  e.done=Promise.all(pending);return e;
}
async function setup(identity={}){
  const base=ScoutStore.reconcile(null,{v:1,players:[
    {id:'candidate-1',type:'target',dbId:'shared-candidate',name:'기존 이름',club:'기존 팀',num:'9',posId:'',memos:['기존 메모'],levels:{skill:4},...identity},
    {id:'candidate-2',type:'target',dbId:'shared-candidate',name:'기존 이름',club:'기존 팀',num:'9',posId:'',memo:'다른 배치 메모',...identity},
    {id:'candidate-3',type:'target',name:'다른 후보',club:'다른 팀',num:'11',posId:''}
  ]});
  const values=new Map([['ps_sync_session',JSON.stringify({uid:'account-A'})],['ps_active_ws','team-A'],['ps_cache_owner_v1',JSON.stringify({uid:'account-A',wid:'team-A',nonce:'seal-A'})],['ps_ws_list',JSON.stringify([{id:'team-A',kind:'team'}])],[ScoutStore.KEY,JSON.stringify(base)]]);
  const state={allowed:true,role:'executive',ready:true,rejectWrite:false,failDurable:false,durable:values.get(ScoutStore.KEY),writes:[],writeAttempts:0,verifiedReads:0,warnings:[],tracks:[],boards:0,listRenders:0,profiles:[],tombs:{},timers:new Map(),nextTimer:0,gate:null};
  const win={localStorage:{getItem:k=>values.get(k)??null},PSSync:{dataUnlocked:()=>true,keyReady:()=>state.ready},PSPerms:{role:()=>state.role,canEdit:()=>state.allowed},
    PSStorage:{sharedReady:()=>state.gate||Promise.resolve(),sharedVerified:(k,raw)=>{state.verifiedReads++;return state.failDurable||raw!==state.durable?Promise.reject(new Error('기기에 저장하지 못했습니다.')):Promise.resolve();}},
    storage:{get:()=>Promise.resolve({value:state.durable})},psSaveShared(k,raw){state.writeAttempts++;if(state.rejectWrite)return false;state.writes.push({k,raw});values.set(k,raw);if(!state.failDurable)state.durable=raw;return true;}};win.parent=win;
  const client=ScoutStore.createClient(win);await client.prepare();
  const doc={activeElement:null,addEventListener(){},createElement(tag){return new Element(tag,this);},querySelectorAll(s){return this.body.querySelectorAll(s);},querySelector(s){return this.body.querySelector(s);}};doc.body=new Element('body',doc);
  const box=doc.body.appendChild(new Element('div',doc));box.id='scList';
  const data={players:client.state.doc.players.slice(),positions:[]};
  const c=vm.createContext({window:win,localStorage:win.localStorage,document:doc,data,PSScoutStore:ScoutStore,TKEY:ScoutStore.KEY,mem:{},scStore:()=>client,scWarn:e=>{state.warnings.push(e.message);return false;},plTombs:()=>state.tombs,
    teamSaves:{track(k,p,retry){state.tracks.push({k,p,retry});p.catch(()=>{});}},
    save(){throw new Error('Identity editing must not write the main roster.');},renderScoutBoard(){state.boards++;},
    setTimeout(fn){const id=++state.nextTimer;state.timers.set(id,fn);return id;},clearTimeout:id=>state.timers.delete(id),
    $:id=>id==='scList'?box:null,scRenderTools(){},renderScDbHits(){},scSearchQ:'',scSort:'pos',sbShow:'tgt',
    scMemos:p=>p.memos||[],scStOf:()=>['rep','추천','#000'],scoutFit:()=>0,sbAge:()=>null,SB_GRADES:['A','B','C','D'],catAvgCellsHTML:()=>'',esc:escape,openPlayer:id=>state.profiles.push(id)
  });
  vm.runInContext(persistence+'\n'+implementation,c,{filename:'scout-identity-edit.js'});
  data.players.forEach(p=>c.scProject(p));const p=data.players[0],other=data.players[2];
  const render=c.renderScoutCands;c.renderScoutCands=()=>{state.listRenders++;render();};c.renderScoutCands();
  function open(id=p.id){const trigger=box.querySelector('[data-scidentity="'+id+'"]');fire(trigger,'click');return doc.querySelector('dialog');}
  function fields(dialog){return Object.fromEntries(dialog.querySelectorAll('[data-sc-identity-field]').map(e=>[e.dataset.scIdentityField,e]));}
  function draft(dialog,v){const f=fields(dialog);Object.keys(v).forEach(k=>{f[k].value=v[k];fire(f[k],'input');});return f;}
  function submit(dialog){return fire(dialog.querySelector('form'),'submit');}
  function hold(){let release;state.gate=new Promise(resolve=>{release=()=>{state.gate=null;resolve();};});return release;}
  function flush(){const jobs=[...state.timers.values()];state.timers.clear();jobs.forEach(fn=>fn());}
  return {c,client,data,p,other,state,values,win,doc,box,open,fields,draft,submit,hold,flush};
}

const info=h=>h.client.state.doc.scoutRegistry.candidates['db:shared-candidate'].info;
const error=dialog=>dialog.querySelector('.sc-identity-error').textContent;

test('name opens one labeled native dialog with all three values; the arrow still opens the full profile',async()=>{
  const h=await setup(),dialog=h.open(),f=h.fields(dialog);
  assert.equal(dialog.modal,true);assert.equal(dialog.getAttribute('aria-labelledby'),'scIdentityTitle');assert.equal(dialog.querySelector('#scIdentityTitle').textContent,'선수 정보 수정');
  assert.deepEqual(Object.fromEntries(Object.entries(f).map(([k,v])=>[k,v.value])),{name:'기존 이름',club:'기존 팀',num:'9'});
  assert.equal(h.doc.activeElement,f.name);assert.equal(dialog.querySelector('.sc-identity-error').getAttribute('role'),'status');
  h.draft(dialog,{name:'입력 중'});assert.equal(h.open(),dialog);assert.equal(f.name.value,'입력 중');assert.equal(h.doc.querySelectorAll('dialog').length,1);
  fire(dialog.querySelector('[data-sc-identity-cancel]'),'click');
  fire(h.box.querySelector('[data-sccard="candidate-1"]').querySelector('path'),'click');assert.deepEqual(h.state.profiles,['candidate-1']);assert.equal(h.state.writeAttempts,0);
});

for(const cancel of ['취소','닫기','Escape','outside'])test(cancel+' discards a local draft without changing any candidate fields',async()=>{
  const h=await setup(),dialog=h.open(),before=clone(h.client.state.doc),f=h.draft(dialog,{name:'취소할 이름',club:'취소할 팀',num:'33'});
  fire(f.name,'change');fire(f.club,'change');fire(f.num,'change');assert.deepEqual(h.client.state.doc,before);
  if(cancel==='Escape')assert.equal(fire(dialog,'cancel').prevented,true);
  else if(cancel==='outside')fire(dialog,'click',{clientX:20,clientY:20});
  else fire(dialog.querySelectorAll('[data-sc-identity-cancel]')[cancel==='취소'?1:0],'click');
  assert.equal(dialog.isConnected,false);assert.equal(h.state.writeAttempts,0);assert.deepEqual(h.client.state.doc,before);assert.equal(h.doc.activeElement.dataset.scidentity,'candidate-1');
});

test('dialog padding clicks do not dismiss it and opening another candidate replaces the old draft',async()=>{
  const h=await setup(),first=h.open();h.draft(first,{name:'저장하지 않은 이름'});fire(first,'click',{clientX:110,clientY:110});assert.equal(first.isConnected,true);
  const second=h.open('candidate-3');assert.notEqual(first,second);assert.equal(first.isConnected,false);assert.equal(h.fields(second).name.value,'다른 후보');assert.equal(h.doc.querySelectorAll('dialog').length,1);assert.equal(h.state.writeAttempts,0);
});

test('blank names are rejected in the popup without losing any draft values',async()=>{
  const h=await setup(),dialog=h.open(),f=h.draft(dialog,{name:'  ',club:'입력한 팀',num:'22'});await h.submit(dialog).done;
  assert.match(error(dialog),/이름/);assert.equal(f.name.getAttribute('aria-invalid'),'true');assert.equal(h.doc.activeElement,f.name);assert.equal(f.club.value,'입력한 팀');assert.equal(dialog.open,true);assert.equal(h.state.writeAttempts,0);
});
for(const num of ['9x','1234','-1','3.5'])test('invalid number '+num+' is shown as an error rather than silently rewritten',async()=>{
  const h=await setup(),dialog=h.open(),f=h.draft(dialog,{name:'수정 이름',num});await h.submit(dialog).done;
  assert.match(error(dialog),/숫자 3자리/);assert.equal(f.num.value,num);assert.equal(h.doc.activeElement,f.num);assert.equal(dialog.open,true);assert.equal(h.state.writeAttempts,0);
});

test('three fields are persisted once, propagate to shared placements, and refresh only after durable confirmation',async()=>{
  const h=await setup(),dialog=h.open(),f=h.draft(dialog,{name:'  수정 이름  ',club:'  새 팀  ',num:'007'}),release=h.hold(),renders=h.state.listRenders;
  const first=h.submit(dialog);await h.submit(dialog).done;
  assert.equal(h.state.writes.length,1);assert.equal(h.state.writes[0].k,ScoutStore.KEY);assert.equal(dialog.open,true);assert.equal(f.name.disabled,true);assert.equal(h.state.listRenders,renders);
  const stored=JSON.parse(h.state.writes[0].raw);assert.deepEqual(['name','club','num'].map(k=>stored.scoutRegistry.candidates['db:shared-candidate'].info[k]),['수정 이름','새 팀','007']);
  assert.ok(stored.players.filter(p=>p.dbId==='shared-candidate').every(p=>p.name==='수정 이름'&&p.club==='새 팀'&&p.num==='007'));
  assert.deepEqual(stored.players[0].memos,['기존 메모']);assert.equal(stored.players[0].levels.skill,4);assert.equal(stored.players[1].memo,'다른 배치 메모');assert.equal(stored.players[2].name,'다른 후보');
  release();await first.done;assert.equal(dialog.isConnected,false);assert.equal(h.state.listRenders,renders+1);assert.equal(h.state.boards,1);assert.equal(h.doc.activeElement.dataset.scidentity,'candidate-1');
});

for(const num of ['','0','999'])test('empty club and number '+JSON.stringify(num)+' are allowed',async()=>{
  const h=await setup(),dialog=h.open();h.draft(dialog,{club:' ',num});await h.submit(dialog).done;assert.equal(info(h).club,'');assert.equal(info(h).num,num);assert.equal(dialog.isConnected,false);assert.equal(h.state.writes.length,1);
});
test('a legacy numeric zero remains visible and can be edited with the other identity fields',async()=>{
  const h=await setup({num:0});assert.equal(h.p.num,0);assert.equal(h.box.querySelector('.sc-origin-num').textContent,'0');
  const dialog=h.open();assert.ok(dialog);assert.equal(h.fields(dialog).num.value,'0');
  h.draft(dialog,{name:'영 번 선수',club:'수정 팀'});await h.submit(dialog).done;
  assert.equal(dialog.isConnected,false);assert.equal(h.state.writes.length,1);assert.equal(info(h).num,'0');
  assert.equal(info(h).name,'영 번 선수');assert.equal(info(h).club,'수정 팀');
  assert.ok(h.client.state.doc.players.filter(p=>p.dbId==='shared-candidate').every(p=>p.num==='0'));
});
test('repeated reconciliation preserves numeric zero in canonical and compatibility identity fields',()=>{
  let doc={v:1,players:[{id:'zero-candidate',type:'target',name:'영 번 선수',club:'가상 팀',num:0}]};
  for(let i=0;i<3;i++){
    doc=ScoutStore.reconcile(i?doc:null,clone(doc));const p=doc.players[0],candidate=doc.scoutRegistry.candidates[ScoutStore.idOf(p)];
    assert.equal(candidate.info.num,0);assert.equal(p.num,0);assert.equal(p._scoutRef.base.num,0);
    assert.ok(!(candidate.variants||[]).some(v=>v.field==='num'));
  }
});
for(const key of ['name','club','num'])test('numeric zero projection for '+key+' preserves strict stale-value checks',async()=>{
  const h=await setup({[key]:0});assert.equal(h.p[key],0);
  const dialog=h.c.scIdentityEditOpen(h.p.id,null);assert.ok(dialog);assert.equal(h.fields(dialog)[key].value,'0');
  Object.defineProperty(h.p,key,{configurable:true,enumerable:true,writable:true,value:''});
  h.draft(dialog,{name:'저장할 이름',club:'저장할 팀',num:'10'});await h.submit(dialog).done;
  assert.equal(h.state.writeAttempts,0);assert.equal(dialog.isConnected,true);assert.ok(error(dialog));
});
test('saving unchanged information closes without a redundant write',async()=>{const h=await setup(),dialog=h.open();await h.submit(dialog).done;assert.equal(h.state.writeAttempts,0);assert.equal(dialog.isConnected,false);});

for(const [label,change]of [
  ['workspace switch',h=>h.values.set('ps_active_ws','team-B')],
  ['account switch',h=>h.values.set('ps_sync_session',JSON.stringify({uid:'account-B'}))],
  ['permission revocation',h=>{h.state.allowed=false;}],
  ['unverified source',h=>{h.client.state.verified=false;}],
  ['externally replaced storage',h=>h.values.set(ScoutStore.KEY,JSON.stringify({v:1,players:[]}))],
  ['player replacement using the same ID',h=>{h.data.players[0]={...h.p};}],
  ['player removal',h=>{h.data.players=h.data.players.filter(p=>p!==h.p);}],
  ['placement removal',h=>{h.client.state.doc.players=h.client.state.doc.players.filter(p=>p.id!==h.p.id);}],
  ['changed placement identity',h=>{h.client.state.doc.players[0]={...h.p,dbId:'new-candidate',_scoutRef:{id:'db:new-candidate'}};}],
  ['archived candidate',h=>{h.client.state.doc.scoutRegistry.candidates['db:shared-candidate'].archivedAt=1;}],
  ['hidden placement',h=>{h.p._scoutHidden=true;}],
  ['deletion tombstone',h=>{h.state.tombs[h.p.id]=Date.now();}],
  ...['name','club','num'].map(k=>['concurrent '+k+' edit',h=>ScoutStore.edit(h.client.state.doc,'db:shared-candidate',k,'다른 곳의 수정',h.client.stamp())])
])test('save refuses a stale popup after '+label,async()=>{
  const h=await setup(),dialog=h.open(),f=h.draft(dialog,{name:'내 수정',club:'내 팀',num:'33'});change(h);const before=clone(h.client.state.doc);await h.submit(dialog).done;
  assert.equal(h.state.writeAttempts,0);assert.deepEqual(h.client.state.doc,before);assert.equal(dialog.isConnected,true);assert.equal(f.name.value,'내 수정');assert.ok(error(dialog));
});

test('an edit then revert is detected by field stamps, while unrelated data remains editable and preserved',async()=>{
  const h=await setup(),dialog=h.open();h.draft(dialog,{name:'내 수정'});ScoutStore.edit(h.client.state.doc,'db:shared-candidate','club','변경',h.client.stamp());ScoutStore.edit(h.client.state.doc,'db:shared-candidate','club','기존 팀',h.client.stamp());await h.submit(dialog).done;assert.equal(h.state.writeAttempts,0);assert.ok(error(dialog));
  const g=await setup(),d=g.open();g.draft(d,{name:'내 수정'});ScoutStore.edit(g.client.state.doc,'db:shared-candidate','grade','A',g.client.stamp());g.p.memo='다른 항목의 최신 메모';await g.submit(d).done;
  assert.equal(info(g).grade,'A');assert.equal(g.client.state.doc.players[0].memo,'다른 항목의 최신 메모');assert.equal(info(g).name,'내 수정');assert.equal(g.state.writes.length,1);
});

test('a synchronous write rejection leaves original data unchanged and retains the draft for retry',async()=>{
  const h=await setup(),dialog=h.open(),before=clone(h.client.state.doc),f=h.draft(dialog,{name:'다시 저장할 이름',club:'새 팀',num:'55'});h.state.rejectWrite=true;await h.submit(dialog).done;
  assert.deepEqual(h.client.state.doc,before);assert.equal(h.state.writes.length,0);assert.equal(dialog.open,true);assert.equal(f.name.disabled,false);assert.equal(f.club.value,'새 팀');assert.ok(error(dialog));
  h.state.rejectWrite=false;await h.submit(dialog).done;assert.equal(h.state.writes.length,1);assert.equal(info(h).name,'다시 저장할 이름');assert.equal(dialog.isConnected,false);
});

test('a durable failure retains the draft and retries confirmation without another write',async()=>{
  const h=await setup(),dialog=h.open(),f=h.draft(dialog,{name:'저장 확인할 이름',club:'새 팀',num:'55'});h.state.failDurable=true;await h.submit(dialog).done;
  assert.equal(h.state.writes.length,1);assert.equal(dialog.open,true);assert.equal(f.name.value,'저장 확인할 이름');assert.equal(f.name.disabled,false);assert.ok(error(dialog));assert.equal(h.client.state.verified,false);assert.equal(h.state.boards,0);
  h.state.failDurable=false;h.state.durable=h.client.state.raw;await h.submit(dialog).done;
  assert.equal(h.state.writes.length,1);assert.equal(dialog.isConnected,false);assert.equal(h.client.state.verified,true);assert.equal(h.state.boards,1);
});

test('changing a failed draft verifies the accepted save before submitting the new draft once',async()=>{
  const h=await setup(),dialog=h.open();h.client.stamp=()=>({at:100,id:'same-millisecond'});h.draft(dialog,{name:'첫 수정',club:'첫 팀'});h.state.failDurable=true;await h.submit(dialog).done;h.draft(dialog,{name:'최종 수정',club:'최종 팀',num:'22'});
  h.state.failDurable=false;h.state.durable=h.client.state.raw;await h.submit(dialog).done;
  assert.equal(h.state.writes.length,2);assert.deepEqual(['name','club','num'].map(k=>info(h)[k]),['최종 수정','최종 팀','22']);assert.equal(dialog.isConnected,false);
});

test('identity edits advance existing field stamps even when this device clock is behind',async()=>{
  const h=await setup();ScoutStore.edit(h.client.state.doc,'db:shared-candidate','name','먼저 저장한 이름',{at:5000,id:'remote'});h.client.stamp=()=>({at:100,id:'local'});
  const dialog=h.open();h.draft(dialog,{name:'내 최신 수정',club:'새 팀'});await h.submit(dialog).done;
  assert.equal(info(h).name,'내 최신 수정');assert.equal(info(h).club,'새 팀');assert.equal(h.client.state.doc.scoutRegistry.candidates['db:shared-candidate'].edits.name.at,5001);assert.equal(dialog.isConnected,false);
});

test('failed save retry never crosses a changed owner or overwrites an intervening save',async()=>{
  const h=await setup(),dialog=h.open();h.draft(dialog,{name:'검증 실패'});h.state.failDurable=true;await h.submit(dialog).done;const reads=h.state.verifiedReads;h.values.set('ps_active_ws','team-B');await h.submit(dialog).done;
  assert.equal(h.state.writes.length,1);assert.equal(h.state.verifiedReads,reads);assert.equal(dialog.open,true);assert.ok(error(dialog));
  const g=await setup(),d=g.open(),release=g.hold();g.draft(d,{name:'이전 제출'});const submission=g.submit(d);
  const next=ScoutStore.copy(g.client.state.doc);ScoutStore.edit(next,'target:candidate-3','club','다른 저장',g.client.stamp());assert.equal(g.c.scSaveTargetDoc(next),true);
  release();await submission.done;assert.equal(d.open,true);assert.ok(error(d));assert.equal(g.state.boards,0);assert.equal(g.state.writes.length,2);
});

test('IME Enter and composition completion never submit until composition has finished',async()=>{
  const h=await setup(),dialog=h.open(),f=h.draft(dialog,{name:'ㄱ'});fire(f.name,'compositionstart');assert.equal(fire(f.name,'keydown',{key:'Enter',isComposing:true}).prevented,false);await h.submit(dialog).done;assert.equal(h.state.writeAttempts,0);
  fire(f.name,'compositionend');f.name.value='김민준';await h.submit(dialog).done;assert.equal(h.state.writeAttempts,0);h.flush();
  fire(f.name,'keydown',{key:'Enter',keyCode:229});await h.submit(dialog).done;assert.equal(h.state.writeAttempts,0);h.flush();await h.submit(dialog).done;assert.equal(info(h).name,'김민준');assert.equal(h.state.writes.length,1);
});

test('an accepted submission cannot be dismissed or replaced until it finishes and refreshes the list',async()=>{
  const h=await setup(),dialog=h.open(),release=h.hold();h.draft(dialog,{name:'제출된 이름'});const submitted=h.submit(dialog);
  assert.ok(dialog.querySelectorAll('[data-sc-identity-cancel]').every(b=>b.disabled));fire(dialog,'cancel');fire(dialog,'click',{clientX:20,clientY:20});fire(dialog.querySelector('[data-sc-identity-cancel]'),'click');
  assert.equal(h.open('candidate-3'),dialog);assert.equal(dialog.open,true);release();await submitted.done;
  assert.equal(dialog.isConnected,false);assert.equal(h.state.writes.length,1);assert.equal(h.state.boards,1);
});
