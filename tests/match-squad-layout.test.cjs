'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function part(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'source boundary: '+start);
  return source.slice(a,b);
}
const implementation=part('var MB2_TARGETS={','var mb2Portrait=false;')+'\n'+part('function mb2RenderTray(m,target){','function mb2FillUs(m){');
function classes(value=''){
  const values=new Set(value.split(/\s+/).filter(Boolean));
  return {contains:value=>values.has(value),add:value=>values.add(value),remove:value=>values.delete(value),toggle(value,on){
    if(on===undefined)on=!values.has(value);if(on)values.add(value);else values.delete(value);return on;
  }};
}
function chip(id,className){
  return {dataset:{pid:id},classList:classes(className),listeners:{},badge:{},
    querySelector(selector){assert.equal(selector,'i');return this.badge;},
    addEventListener(type,listener){(this.listeners[type]||(this.listeners[type]=[])).push(listener);}
  };
}
// The renderer's output is retained verbatim. Only chips needed for paint/event binding
// are materialized; layout and pointer hit testing belong to browser verification.
function container(){
  return {_html:'',chips:[],classList:classes(),textContent:'',
    get innerHTML(){return this._html;},set innerHTML(value){
      this._html=value;this.chips=Array.from(value.matchAll(/<div class="(mb2-chip[^"]*)" data-pid="([^"]*)"/g),m=>chip(m[2],m[1]));
    },querySelectorAll(selector){assert.equal(selector,'.mb2-chip');return this.chips;}
  };
}
function rows(el){
  const matches=Array.from(el.innerHTML.matchAll(/<div class="mb2-trow[^"]*" data-row="([^"]*)"(?: data-grp="([^"]*)")?[^>]*>/g));
  return matches.map((m,i)=>({kind:m[1],group:m[2],html:el.innerHTML.slice(m.index,matches[i+1]?.index)}));
}
const ids=el=>el.chips.map(c=>c.dataset.pid);
const used=el=>el.chips.filter(c=>c.classList.contains('used')).map(c=>c.dataset.pid);
function setup(){
  const els={};for(const id of ['mb2Tray','mb2SquadTray','mb2TrayN','obTray','obSquadTray','obTrayN'])els[id]=container();
  const players=[
    {id:'p1',name:'선발 골키퍼',num:'1',posId:'gk',grp:'A팀'},
    {id:'p2',name:'리저브 선수',num:'2',posId:'cm',grp:'B팀'},
    {id:'p3',name:'대기 선수',num:'3',posId:'cm',grp:'A팀'},
    {id:'p4',name:'회복 중 선수',num:'4',posId:'cm',grp:'B팀',status:'hurt'},
    {id:'p5',name:'긴 이름 확인용 알렉산더 김민수',num:'5',posId:'cm',grp:'B팀'},
    {id:'p6',name:'',num:'6',posId:'cm',grp:'',manual:true},
    {id:'ignored',name:'   ',num:'7',posId:'cm',grp:''}
  ];
  const m={id:'match',squad:{start:['p1','p1'],res:['p1','p2','missing-player']},prep:{us:[{pid:'p1'},{pid:'p3'}]},analysis:{us:[{pid:'p2'},{pid:'p4'}]}};
  const state={edit:true,paint:[]};
  const c=vm.createContext({Array,Object,JSON,Math,
    $:id=>els[id]||null,data:{players,positions:[{id:'gk',name:'GK'},{id:'cm',name:'CM'}]},
    tmOurs:()=>players,mb2Squad:m=>m.squad,mb2Cur:m=>m.prep,obFrame:m=>m.analysis,
    matchCanEdit:()=>state.edit,matchGet:()=>m,plStatusOf:p=>p.status||'ok',plOut:status=>status==='hurt',TM_ST_LB:{hurt:'회복 중'},
    posGroupOf:p=>p==='GK'?'GK':'MID',plGrpOf:p=>p.grp||'',tmGrpBase:()=>['B팀','A팀'],tmGroupLabel:g=>g==='\0'?'미지정':g,
    esc:value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    matchKitPaint:(match,kit,badge,token)=>state.paint.push({kit,badge,token}),mb2SqModeV:null,
    getComputedStyle:el=>{if(el.fail)throw new Error('detached');return {flexDirection:el.direction,flexWrap:el.wrap};}
  });
  c.window=c;vm.runInContext(implementation,c,{filename:'scout-squad-layout.js'});
  return {c,els,players,m,state};
}

for(const [target,side,top,count] of [['prep','mb2Tray','mb2SquadTray','mb2TrayN'],['ob','obTray','obSquadTray','obTrayN']]){
  test(target+': starters and reserves render only above the pitch; all remaining players appear once in the sidebar',()=>{
    const {c,els,m}=setup();c.mb2RenderTray(m,target);
    assert.deepEqual(rows(els[top]).map(r=>r.kind),['start','res']);
    assert.deepEqual(ids(els[top]),['p1','p2']);
    assert.ok(rows(els[side]).every(r=>r.kind==='none'));
    assert.deepEqual(ids(els[side]),['p5','p4','p3','p6']);
    assert.equal(els[count].textContent,6);
    const all=Array.from(c.mb2TrayChips(c.MB2_TARGETS[target]),x=>x.dataset.pid);
    assert.equal(new Set(all).size,all.length);
    assert.deepEqual(all.slice().sort(),['p1','p2','p3','p4','p5','p6']);
  });

  test(target+': paint and drag handlers bind to chips in both containers exactly once',()=>{
    const {c,els,m,state}=setup();c.mb2RenderTray(m,target);
    const all=c.mb2TrayChips(c.MB2_TARGETS[target]);
    assert.equal(state.paint.length,6);
    for(const player of all)assert.equal(player.listeners.pointerdown.length,1);
    assert.ok(state.paint.every(p=>p.kit===(target==='prep'?'prep':'analysis')));
    c.mb2RenderTray(m,target);
    assert.equal(els[side].chips.length+els[top].chips.length,6);
    for(const player of c.mb2TrayChips(c.MB2_TARGETS[target]))assert.equal(player.listeners.pointerdown.length,1);
  });

  test(target+': empty starter, reserve and actual team-group rows remain as drop targets',()=>{
    const {c,els,m}=setup();m.squad={start:[],res:[]};c.mb2RenderTray(m,target);
    assert.deepEqual(rows(els[top]).map(r=>r.kind),['start','res']);
    assert.ok(rows(els[top]).every(r=>r.html.includes('여기로 끌어오기')));
    assert.equal(ids(els[top]).length,0);
    m.squad={start:['p1','p2','p3','p4','p5','p6'],res:[]};c.mb2RenderTray(m,target);
    assert.deepEqual(rows(els[side]).map(r=>r.group),['B팀','A팀','']);
    assert.ok(rows(els[side]).every(r=>r.html.includes('모두 배정됨')));
    assert.equal(ids(els[side]).length,0);
  });
}

test('each board updates used markers on both of its trays without affecting the other board',()=>{
  const {c,els,m}=setup();c.mb2RenderTrays(m);
  assert.deepEqual(used(els.mb2SquadTray),['p1']);assert.deepEqual(used(els.mb2Tray),['p3']);
  assert.deepEqual(used(els.obSquadTray),['p2']);assert.deepEqual(used(els.obTray),['p4']);
  m.prep.us=[{pid:'p2'},{pid:'p5'}];c.mb2SyncTray(m,'prep');
  assert.deepEqual(used(els.mb2SquadTray),['p2']);assert.deepEqual(used(els.mb2Tray),['p5']);
  assert.deepEqual(used(els.obSquadTray),['p2']);assert.deepEqual(used(els.obTray),['p4']);
  m.analysis.us=[];c.obSyncTray(m);
  assert.deepEqual(used(els.obSquadTray),[]);assert.deepEqual(used(els.obTray),[]);
  assert.deepEqual(used(els.mb2SquadTray),['p2']);assert.deepEqual(used(els.mb2Tray),['p5']);
});

test('changing squad membership moves a player between trays without duplicating or dropping its used state',()=>{
  const {c,els,m}=setup();c.mb2RenderTrays(m);m.squad.res.push('p3');c.mb2RenderTrays(m);
  for(const [target,side,top] of [['prep','mb2Tray','mb2SquadTray'],['ob','obTray','obSquadTray']]){
    assert.equal(ids(els[side]).includes('p3'),false);assert.equal(ids(els[top]).filter(id=>id==='p3').length,1);
    assert.equal(c.mb2TrayChips(c.MB2_TARGETS[target]).length,6);
  }
  assert.deepEqual(used(els.mb2SquadTray),['p1','p3']);
});

test('teams with no named groups retain a single unassigned sidebar drop row',()=>{
  const {c,els,m,players}=setup();players.forEach(p=>p.grp='');m.squad={start:[],res:[]};c.mb2RenderTray(m);
  assert.deepEqual(rows(els.mb2Tray).map(r=>r.kind),['none']);
  assert.equal(ids(els.mb2Tray).length,6);
  m.squad.start=['p1','p2','p3','p4','p5','p6'];c.mb2RenderTray(m);
  assert.equal(rows(els.mb2Tray).length,1);assert.match(rows(els.mb2Tray)[0].html,/모두 배정됨/);
});

test('legacy markup without a top tray falls back to one complete roster',()=>{
  const {c,els,m}=setup();delete els.mb2SquadTray;c.mb2RenderTray(m);
  assert.deepEqual(rows(els.mb2Tray).map(r=>r.kind),['start','res','none','none','none']);
  assert.equal(new Set(ids(els.mb2Tray)).size,6);
  assert.equal(c.mb2TrayChips(c.MB2_TARGETS.prep).length,6);
  assert.deepEqual(used(els.mb2Tray),['p1','p3']);
});

test('readonly and touch-name presses cannot start a drag from either roster container',()=>{
  const {c,m,state}=setup();c.mb2RenderTray(m);let prevented=0;
  for(const player of c.mb2TrayChips(c.MB2_TARGETS.prep)){
    state.edit=false;player.listeners.pointerdown[0]({preventDefault(){prevented++;}});
    state.edit=true;player.listeners.pointerdown[0]({pointerType:'touch',target:{closest:()=>null},preventDefault(){prevented++;}});
  }
  assert.equal(prevented,0);
});

const hit={getBoundingClientRect:()=>({left:100,top:240,width:80,height:30})};
for(const wrap of ['wrap','nowrap'])test('horizontal '+wrap+' rows use the hovered chip x midpoint, including another wrapped row',()=>{
  const {c}=setup(),group={direction:'row',wrap};
  assert.equal(c.mb2ReorderBefore(group,hit,{clientX:139.9,clientY:269}),true);
  assert.equal(c.mb2ReorderBefore(group,hit,{clientX:140,clientY:240}),false);
  assert.equal(c.mb2ReorderBefore(group,hit,{clientX:170,clientY:241}),false);
});

test('vertical sidebar ordering uses y, independent of x and touch versus mouse input',()=>{
  const {c}=setup(),group={direction:'column',wrap:'nowrap'};
  for(const pointerType of ['mouse','touch']){
    assert.equal(c.mb2ReorderBefore(group,hit,{clientX:179,clientY:254.5,pointerType}),true);
    assert.equal(c.mb2ReorderBefore(group,hit,{clientX:101,clientY:255,pointerType}),false);
  }
});

test('touch coordinates in a wrapped horizontal squad row use x and preserve midpoint boundary',()=>{
  const {c}=setup(),group={direction:'row',wrap:'wrap'};
  assert.equal(c.mb2ReorderBefore(group,hit,{pointerType:'touch',clientX:139.5,clientY:269.5}),true);
  assert.equal(c.mb2ReorderBefore(group,hit,{pointerType:'touch',clientX:140,clientY:240.5}),false);
});

test('an unavailable layout style safely retains the existing vertical insertion rule',()=>{
  const {c}=setup();
  assert.equal(c.mb2ReorderBefore({fail:true},hit,{clientX:175,clientY:245}),true);
  assert.equal(c.mb2ReorderBefore({fail:true},hit,{clientX:105,clientY:265}),false);
});
