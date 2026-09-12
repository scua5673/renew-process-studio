'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
const KEY='cs_idp_v1_fixture-player';
const clone=value=>JSON.parse(JSON.stringify(value));
function actual(name){
  const marker='  function '+name+'(';
  assert.equal(source.split(marker).length-1,1,`${name} has one production declaration`);
  const start=source.indexOf(marker),end=source.indexOf('\n  }',start);
  assert.ok(start>=0&&end>start,`${name} production body exists`);
  return source.slice(start,end+4);
}
function blank(){return {v:1,profile:{},selfEval:{levels:{},strengths:'',improve:'',seasonGoal:''},trainings:[],log:{}};}
function vision(){return {statement:'함께 전진하는 선수',reason:'동료와 기회를 만들고 싶다',behaviors:[
  {id:'stable-a',text:'받기 전에 주변을 확인한다'},{id:'stable-b',text:'전진할 수 있게 첫 터치를 한다'},
  {id:'stable-c',text:'패스 뒤 동료를 지원한다'}],focusId:'stable-c',updatedAt:100,revision:'old-revision',history:[]};}
function decode(value){return String(value).replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));}

// The production HTML provides every input, behavior id and selected focus.
// Only DOM operations and the localStorage surface are fakes; validation,
// revision/history, fresh-root merge and exact-write guards are actual code.
function cardFrom(html){
  const nodes=[];
  for(const match of html.matchAll(/<(input|textarea|button)\b([^>]*)>/g)){
    const attrs={};for(const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[attr[1]]=decode(attr[2]||'');
    const classes=new Set((attrs.class||'').split(/\s+/));
    const node={attrs,dataset:{},value:attrs.value||'',focused:false,
      focus(){this.focused=true;},setAttribute(key,value){attrs[key]=String(value);},click(){if(this.onclick)this.onclick();},
      classList:{contains:key=>classes.has(key),toggle(key,on){if(on)classes.add(key);else classes.delete(key);}}};
    for(const [key,value]of Object.entries(attrs))if(key.startsWith('data-'))node.dataset[key.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=value;
    if(match[1]==='textarea')node.value=decode(html.slice(match.index+match[0].length).split('</textarea>')[0]);
    nodes.push(node);
  }
  function matches(node,selector){
    if(selector.startsWith('#'))return node.attrs.id===selector.slice(1);
    const m=/^\[([^=\]]+)(?:="([^"]*)")?\](\.on)?$/.exec(selector);
    return !!(m&&Object.hasOwn(node.attrs,m[1])&&(m[2]===undefined||node.attrs[m[1]]===m[2])&&(!m[3]||node.classList.contains('on')));
  }
  return {html,addEventListener(){},querySelector:selector=>nodes.find(node=>matches(node,selector))||null,
    querySelectorAll:selector=>nodes.filter(node=>matches(node,selector))};
}
function harness(initial=blank()){
  const state={writes:0,throwWrite:false,renders:[],toasts:[],syncs:[],acts:[]};
  const local=new Map([[KEY,JSON.stringify(initial)]]);let card=null,nextId=0;
  const fixedNow=new Date(2026,8,12,15,45).getTime();
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return fixedNow;}}
  const c=vm.createContext({Date:FixedDate,console,doc:clone(initial),viewing:KEY,visionEdit:false,visionEditBase:null,visionEditHadKey:false,
    PREFIX:'cs_idp_v1_',_saveT:null,_docSeenRaw:local.get(KEY),_docSourceValid:true,_privateWriteConflict:false,
    _idpEditBase:clone(initial),_idpDocumentOwner:null,_idpRecovery:null,_idpRecoveryAuthLocked:false,_idpVisionBaseDoc:null,
    curL:'goal',calView:'month',calAnchor:new FixedDate(2020,0,1),
    blank,sess:()=>({uid:'fixture-player'}),myKey:()=>KEY,ro:()=>c.viewing!==KEY,load:key=>JSON.parse(local.get(key)),uid:()=>`tfixture${++nextId}`,
    esc:value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    localStorage:{getItem:key=>local.has(key)?local.get(key):null,setItem(key,raw){if(state.throwWrite)throw new Error('quota');state.writes++;local.set(key,String(raw));}},
    clearTimeout(){},setTimeout:fn=>fn(),syncMyIdpSoon:delay=>state.syncs.push(delay),
    gToast:text=>state.toasts.push(text),psAct:name=>state.acts.push(name),
    render:()=>state.renders.push({layer:c.curL,view:c.calView,date:c.calAnchor.toISOString()}),scrollTo(){},
    wrap:{querySelector:selector=>selector==='.vs-card'?card:null},document:{getElementById:id=>card?.querySelector('#'+id)},
    rReact:()=>'',rGoalFamSeg:()=>'',rCoachFeedback:()=>'<aside>coach feedback</aside>',
    qgLadder:()=>'',rSwFree:()=>'<section class="card">strengths input</section>',
    wpPicks:()=>c.doc.weapon?.picks||[],myThread:()=>c.doc.qgoal?.goals?.[0]||null,WP_SRC:{me:'내가 적음'},
    openLadderSheet(){throw new Error('first setup must not open the ladder');}
  });c.window=c;c.parent=c;
  const helperStart=source.indexOf('  function visionCore('),helperEnd=source.indexOf('  /* 시간은 자유 입력',helperStart);
  assert.ok(helperStart>=0&&helperEnd>helperStart);
  vm.runInContext(source.slice(helperStart,helperEnd),c);
  for(const name of ['idpSaveApi','idpSaveOwner','idpSaveOwnerCurrent','idpRecoveryOwner','idpRecoveryController','idpRecoveryCapture','idpRecoveryBlocked','idpRecoverySaved','idpRecoveryConflict','idpVisionCapture','persistMyIdpNow','visionBeginEdit','visionEndEdit','visionLatestRoot','visionWriteRoot','rVisionCard','bindVisionCard','rGoal'])vm.runInContext(actual(name),c,{filename:'idp.html '+name});
  return {c,state,local,read:()=>JSON.parse(local.get(KEY)),
    begin(){assert.equal(c.visionBeginEdit(),true);card=cardFrom(c.rVisionCard());c.bindVisionCard();return card;},
    form(statement='공을 받기 전에 생각하는 선수',action='공이 오기 전에 주변을 확인한다'){
      card.querySelector('#vsStatement').value=statement;card.querySelector('[data-vs-beh="0"]').value=action;
    },card:()=>card,save:()=>card.querySelector('[data-vs-save]').click()};
}

test('fresh editor asks for one behavior and keeps optional controls closed without writing',()=>{
  const h=harness(),card=h.begin();
  assert.match(card.html,/<details class="vs-start-more">/);
  assert.ok(card.html.indexOf('data-vs-beh="0"')<card.html.indexOf('<details'));
  assert.ok(card.html.indexOf('data-vs-beh="1"')>card.html.indexOf('<details'));
  assert.equal(card.querySelectorAll('[data-vs-save]').length,1);
  assert.equal(card.querySelector('[data-vs-save]').dataset.vsSave,'today');
  assert.equal(h.state.writes,0);
});

test('one action saves through the real exact-write and opens today rather than the old calendar date',()=>{
  const h=harness();h.begin();h.form();h.save();
  const saved=h.read();assert.equal(saved.vision.behaviors.length,1);
  assert.equal(saved.vision.focusId,saved.vision.behaviors[0].id);
  assert.equal(saved.qgoal,undefined);assert.equal(saved.focusByWk,undefined);
  assert.equal(h.state.writes,1);assert.deepEqual(h.state.syncs,[80]);
  assert.equal(h.c.curL,'cal');assert.equal(h.c.calView,'day');
  assert.equal(h.c.calAnchor.getFullYear(),2026);assert.equal(h.c.calAnchor.getMonth(),8);assert.equal(h.c.calAnchor.getDate(),12);
  assert.equal(h.c.calAnchor.getHours(),0);assert.equal(h.c.visionEdit,false);
});

for(const [label,statement,action]of [['statement','','행동 하나'],['action','선수 모습','']])test(`empty ${label} cannot save or navigate`,()=>{
  const h=harness();h.begin();h.form(statement,action);h.save();
  assert.equal(h.state.writes,0);assert.equal(h.c.curL,'goal');assert.equal(h.c.visionEdit,true);
});

test('existing three actions keep all stable ids and selected focus, while history retains the previous version',()=>{
  const old=vision(),h=harness({...blank(),vision:old});const card=h.begin();
  assert.match(card.html,/<details class="vs-start-more" open>/);
  card.querySelector('#vsStatement').value='더 정확하게 동료를 살리는 선수';h.save();
  const saved=h.read().vision;
  assert.deepEqual(saved.behaviors,old.behaviors);assert.equal(saved.focusId,'stable-c');
  assert.notEqual(saved.revision,old.revision);assert.equal(saved.history.length,1);assert.equal(saved.history[0].statement,old.statement);
});

test('the example fills only blank starting fields and never replaces existing behaviors or focus',()=>{
  const old=vision(),h=harness({...blank(),vision:old}),card=h.begin();
  card.querySelector('[data-vs-example]').click();h.save();
  assert.deepEqual(h.read().vision,old);assert.equal(h.state.writes,0);assert.equal(h.c.curL,'cal');
  const fresh=harness(),first=fresh.begin();first.querySelector('[data-vs-example]').click();
  assert.ok(first.querySelector('#vsStatement').value);assert.ok(first.querySelector('[data-vs-beh="0"]').value);
  assert.equal(first.querySelector('[data-vs-beh="1"]').value,'');assert.equal(first.querySelector('#vsReason').value,'');
});

test('an unchanged direction opens today without adding a revision or history',()=>{
  const old=vision(),h=harness({...blank(),vision:old});h.begin();h.save();
  assert.deepEqual(h.read().vision,old);assert.equal(h.state.writes,0);assert.equal(h.c.curL,'cal');
});

test('cancel keeps storage unchanged and stays on the goal screen',()=>{
  const h=harness(),card=h.begin(),before=h.local.get(KEY);h.form();card.querySelector('[data-vs-cancel]').click();
  assert.equal(h.local.get(KEY),before);assert.equal(h.state.writes,0);assert.equal(h.c.curL,'goal');assert.equal(h.c.visionEdit,false);
});
test('cancel adopts the latest root as the edit base rather than recapturing remote fields as mine',()=>{
  const h=harness({...blank(),vision:vision()});h.begin();const latest=h.read();latest.profile.name='remote profile';h.local.set(KEY,JSON.stringify(latest));h.card().querySelector('[data-vs-cancel]').click();
  assert.equal(h.c.doc.profile.name,'remote profile');assert.equal(h.c._idpEditBase.profile.name,'remote profile');assert.equal(h.state.writes,0);
});
test('a root deleted during direction editing is not restored by cancel or a later ordinary save',()=>{
  const h=harness({...blank(),profile:{name:'old private name'},vision:vision()});h.begin();h.local.delete(KEY);h.card().querySelector('[data-vs-cancel]').click();
  assert.equal(h.c.doc.profile.name,undefined);assert.equal(h.c.doc.vision,undefined);assert.equal(h.c._idpEditBase.vision,undefined);assert.equal(h.c._docSeenRaw,null);assert.equal(h.state.writes,0);
  assert.equal(h.c.persistMyIdpNow(),true);assert.equal(h.read().vision,undefined);assert.equal(h.read().profile.name,undefined);
});

test('local storage failure keeps the draft and does not navigate',()=>{
  const h=harness();h.begin();h.form();h.state.throwWrite=true;h.save();
  assert.equal(h.state.writes,0);assert.equal(h.c.visionEdit,true);assert.equal(h.c.curL,'goal');assert.equal(h.read().vision,undefined);
});

test('a concurrently changed direction is not overwritten or followed into today',()=>{
  const h=harness({...blank(),vision:vision()});h.begin();h.form();
  const other=h.read();other.vision.statement='다른 창의 새 방향';other.vision.revision='other';h.local.set(KEY,JSON.stringify(other));h.save();
  assert.equal(h.state.writes,0);assert.equal(h.read().vision.statement,'다른 창의 새 방향');assert.equal(h.c.curL,'goal');
  assert.equal(h.c.visionEdit,true);assert.equal(h.card().querySelector('#vsStatement').value,'공을 받기 전에 생각하는 선수');
  assert.equal(h.state.renders.length,0,'conflict must not replace the draft DOM');
});

test('an unrelated fresh root field survives the direction save',()=>{
  const h=harness();h.begin();h.form();const fresh=h.read();fresh.log['2026-09-11']={memo:'다른 창에서 적은 장면'};
  h.local.set(KEY,JSON.stringify(fresh));h.save();
  assert.equal(h.read().log['2026-09-11'].memo,'다른 창에서 적은 장면');assert.equal(h.read().vision.behaviors.length,1);
});

test('a missing or invalid latest document prevents navigation',()=>{
  for(const raw of ['{broken',JSON.stringify({v:2,vision:{statement:'future'}})]){
    const h=harness();h.begin();h.form();h.local.set(KEY,raw);h.save();
    assert.equal(h.local.get(KEY),raw);assert.equal(h.state.writes,0);assert.equal(h.c.curL,'goal');assert.equal(h.c.visionEdit,true);
  }
});

test('a stale form cannot write after the viewed account changes',()=>{
  const h=harness();h.begin();h.form();h.c.viewing='cs_idp_v1_someone-else';h.save();
  assert.equal(h.state.writes,0);assert.equal(h.c.curL,'goal');
});

test('the exact-write comparison rejects a root changed after reading',()=>{
  const h=harness(),expected=h.local.get(KEY),edited=h.read();edited.vision=vision();
  h.local.set(KEY,JSON.stringify({...blank(),profile:{name:'new value'}}));
  assert.equal(h.c.visionWriteRoot(edited,expected),false);assert.equal(h.state.writes,0);assert.equal(h.read().profile.name,'new value');
});

test('an own IDP without goal content folds secondary cards while retaining their controls',()=>{
  const h=harness(),html=h.c.rGoal();assert.match(html,/<details class="idp-start-more">/);
  assert.match(html,/data-ql="week"/);assert.match(html,/strengths input/);assert.match(html,/data-wp-open/);
  assert.ok(html.indexOf('coach feedback')<html.indexOf('<details class="idp-start-more">'));
  assert.equal(h.state.writes,0);
});

for(const [label,patch]of Object.entries({
  quarter:{qgoal:{theme:'기존 목표'}},quarterHistory:{qgoalHist:[{theme:'지난 목표'}]},
  profileGoal:{profile:{goal:'기존 방향'}},
  strengths:{selfEval:{strengths:'패스'}},improve:{selfEval:{improve:'확인'}},seasonGoal:{selfEval:{seasonGoal:'기존 시즌'}},
  ratings:{selfEval:{levels:{scan:2}}},weapon:{weapon:{picks:[{t:'패스',src:'me'}]}},
  monthGoal:{goal:{cur:{note:'기존 월 목표'}}},direction:{vision:vision()},partialDirection:{vision:{statement:'아직 행동은 안 정함'}},
  weeklyFocus:{focusByWk:{'2026-09-07':{text:'이번 주 초점'}}}
}))test(`existing ${label} keeps the secondary goal cards visible`,()=>{
  const h=harness({...blank(),...patch});assert.doesNotMatch(h.c.rGoal(),/<details class="idp-start-more">/);
});

for(const [label,patch]of Object.entries({
  profile:{profile:{name:'가상 선수',pos:'CM',photo:'fixture-photo'}},
  log:{log:{'2026-09-11':{memo:'이름과 일지를 먼저 적었어요'}}},trainings:{trainings:[{id:'fixture',title:'개인 훈련'}]}
}))test(`${label} alone does not turn first goal setup into an advanced goal screen`,()=>{
  const h=harness({...blank(),...patch});assert.match(h.c.rGoal(),/<details class="idp-start-more">/);
});

test('a coach reading an empty player IDP does not receive the own-player starter controls',()=>{
  const h=harness();h.c.viewing='cs_idp_v1_someone-else';const html=h.c.rGoal();
  assert.doesNotMatch(html,/data-vs-edit|data-vs-save|idp-start-more/);assert.equal(h.state.writes,0);
});
