'use strict';
/* 2.974 — 예전에 만든 미팅도 새 규칙으로: 손대지 않은 BEST 11 만 새 배치 · 이름은 하나뿐일 때만 빈 장에 · 맨 위 문구 한 가지면 빈 장에 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const J=x=>JSON.parse(JSON.stringify(x));
const code=slice('  var MEET_TPL_US=','  window.__meetTpl=function')+slice('  var MEET_BEST_OLD_US=','  window.__meet={');
function ctx(slides){
  const c={anim:{slides},window:{__snapToThumb:sn=>'TH'+sn.players.length},JSON,Math,Object,String};
  vm.createContext(c);vm.runInContext('var MPP=10,L=30,T=30;'+code,c);return c;
}
const pt=m=>({x:Math.round((30+m[0]*10)*10)/10,y:Math.round((30+m[1]*10)*10)/10});
const OLD_US=[[5,34],[19,9],[16,25],[16,43],[19,59],[28,34],[36,22],[36,46],[47,10],[49,34],[47,58]];
const OLD_OP=[[100,34],[86,9],[89,25],[89,43],[86,59],[71,10],[74,27],[74,41],[71,58],[57,29],[57,39]];
const US=[1,3,4,5,2,6,8,10,7,9,11],OP=[1,2,4,5,3,7,8,6,11,9,10];
const NEW_US=JSON.parse(slice('    {t:"BEST 11",','    {t:"하이블록",').match(/us:(\[\[[^\n]*\]\]),/)[1]);
function oldBest(withOpp){
  const players=US.map((n,i)=>Object.assign({id:1001+i,team:'blue',num:String(n)},pt(OLD_US[i])));
  if(withOpp)OP.forEach((n,i)=>players.push(Object.assign({id:1012+i,team:'red',num:String(n)},pt(OLD_OP[i]))));
  return {title:'BEST 11',thumb:'old',snap:{players,equipment:[],drawings:[],ball:withOpp?pt([52.5,34]):null,orientation:'v',pitchTheme:'white'}};
}

test('an untouched 2.960~2.969 BEST 11 moves to the 2.970 full-pitch layout; nothing else on the slide changes',()=>{
  const s=oldBest(false),c=ctx([s]);const r=c.window.__meetUpgrade();
  assert.equal(r.best,1);assert.equal(r.changed,true);
  US.forEach((n,i)=>{const q=s.snap.players.find(p=>p.num===String(n));assert.deepEqual(J({x:q.x,y:q.y}),pt(NEW_US[i]),'#'+n);});
  assert.equal(s.snap.orientation,'v');assert.equal(s.snap.pitchTheme,'white');assert.equal(s.thumb,'TH11');
  assert.equal(c.window.__meetUpgrade().changed,false,'opening again changes nothing');
});
test('an untouched 2.959 BEST 11 also drops the template opponents and centre ball (our 11 only)',()=>{
  const s=oldBest(true),c=ctx([s]);assert.equal(c.window.__meetUpgrade().best,1);
  assert.equal(s.snap.players.length,11);assert.ok(s.snap.players.every(p=>p.team==='blue'));assert.equal(s.snap.ball,null);
});
test('a BEST 11 the coach touched stays as it is',()=>{
  const cases={
    moved:s=>{s.snap.players[3].x+=10;},
    drawing:s=>{s.snap.drawings.push({type:'arrow'});},
    equipment:s=>{s.snap.equipment.push({type:'cone'});},
    scenes:s=>{s.frames=[{snap:J(s.snap)},{snap:J(s.snap)}];},
    extraToken:s=>{s.snap.players.push({id:9,team:'blue',num:'12',x:300,y:300});},
    coach:s=>{s.snap.players.push({id:9,team:'blue',coach:true,x:300,y:300});},
    renumbered:s=>{s.snap.players[0].num='99';}
  };
  for(const [k,f] of Object.entries(cases)){const s=oldBest(false);f(s);const before=J(s);const r=ctx([s]).window.__meetUpgrade();assert.equal(r.best,0,k);assert.deepEqual(J(s),before,k);}
  const s=oldBest(true);s.snap.players[15].x+=20;const before=J(s);assert.equal(ctx([s]).window.__meetUpgrade().best,0,'moved opponent');assert.deepEqual(J(s),before);
  const b=oldBest(true);b.snap.ball=pt([60,30]);assert.equal(ctx([b]).window.__meetUpgrade().best,0,'moved ball');
});
test('names: one name for a player fills his empty tokens on other slides and scenes; two different names leave them all',()=>{
  const P=(num,name,team='blue')=>Object.assign({team,num,x:1,y:1},name!=null?{name}:{});
  const a={title:'BEST 11',snap:{players:[P('7','김민수'),P('9','박지성'),P('7',null,'red')]}};
  const b={title:'하이블록',snap:{players:[P('7'),P('9','차범근'),P('7',null,'red')]},frames:[{snap:{players:[P('7')]}},{snap:{players:[P('7')]},thumb:'f1'}]};
  const lineup={title:'선발 11 · 4-3-3',snap:{players:[P('7','이강인'),P('8')]}};
  const d={title:'로우블록',snap:{players:[P('9')]}};
  const r=ctx([a,b,lineup,d]).window.__meetUpgrade();
  assert.equal(b.snap.players[0].name,'김민수');assert.ok(b.frames.every(f=>f.snap.players[0].name==='김민수'),'every scene');
  assert.equal(b.frames[1].thumb,undefined,'a later scene thumb is redrawn');
  assert.equal(b.snap.players[2].name,undefined,'the other team keeps no name');
  assert.equal(d.snap.players[0].name,undefined,'#9 has two different names (박지성·차범근) → untouched');
  assert.equal(lineup.snap.players[0].name,'이강인','the match lineup slide is neither a source (이강인 not spread) nor a target');
  assert.equal(lineup.snap.players[1].name,undefined);
  assert.equal(r.names,3);assert.equal(b.thumb,'TH3');
});
test('the top caption fills the slides still showing «PROCESS» only when there is a single caption',()=>{
  const st={size:22};
  const s=[{pageBrand:'프로세스FC 미팅',textStyles:{brand:st},snap:{players:[]}},{snap:{players:[]}},{pageBrand:null,snap:{players:[]}}];
  const r=ctx(s).window.__meetUpgrade();assert.equal(r.brand,2);
  assert.ok(s.every(x=>x.pageBrand==='프로세스FC 미팅'));assert.deepEqual(J(s[1].textStyles.brand),st);
  const two=[{pageBrand:'A',snap:{players:[]}},{pageBrand:'B',snap:{players:[]}},{snap:{players:[]}}];
  assert.equal(ctx(two).window.__meetUpgrade().changed,false);assert.equal(two[2].pageBrand,undefined);
});
test('the vault runs it only when the meeting opens editable, then tells and saves',()=>{
  const open=slice('    if(ty==="meeting"){','    try{showViewBar(');
  assert.match(open,/var _mup=null; if\(!ro\)\{ try\{ _mup=window\.__meetUpgrade\?window\.__meetUpgrade\(\):null;/);
  assert.ok(open.indexOf('__meetUpgrade')<open.indexOf('setView("meeting")'),'before the editor loads slide 1');
  assert.match(open,/if\(_mup&&_mup\.changed\)\{ try\{toast\(window\.__meetUpgradeText\(_mup\)\);\}catch\(_\)\{\} try\{if\(window\.__vaultAutoSaveSchedule\)window\.__vaultAutoSaveSchedule\(\);/);
  const c=ctx([]);assert.equal(c.window.__meetUpgrade(),null);
  assert.equal(c.window.__meetUpgradeText({changed:true,best:1,names:4,brand:0}),'예전에 만든 미팅을 새 규칙으로 맞췄어요 — BEST 11 배치 · 이름 4곳');
});
