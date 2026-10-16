'use strict';
/* 3.064 — 엘미하 계정이 올리는 글은 토큰 이름을 그대로 싣는다(사용자 «엘미하가 올리는 거에는 토큰에 이름이 뜨게»). 다른 코치 글은 예전처럼 비운다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,to); return src.slice(a,b); }
const STRIP=cut(comm,'var __pubNames=[];','function openUpload(){');
function api(){ const c=vm.createContext({}); vm.runInContext(STRIP+';this.api={stripSnap,stripPages,stripThumbNames,keep:function(v){__pubKeepNames=v;},names:function(){return __pubNames;}};',c); return c.api; }
const snap=()=>({players:[{id:1,team:'red',num:7,name:'손흥민'},{id:2,team:'blue',num:9,name:'케인',img:'data:image/png;base64,AAA'}]});
test('엘미하 글: 이름은 남고 사진은 빠진다',()=>{
  const a=api();a.keep(true);const s=a.stripSnap(snap());
  assert.equal(JSON.stringify(s.players.map(p=>p.name)),JSON.stringify(['손흥민','케인']));
  assert.equal(s.players[1].img,undefined);assert.equal(a.names().length,0);
  assert.match(a.stripThumbNames('<text>손흥민</text>'),/손흥민/);
});
test('다른 코치 글: 이름은 예전처럼 비운다',()=>{
  const a=api();const s=a.stripSnap(snap());
  assert.equal(JSON.stringify(s.players.map(p=>p.name)),JSON.stringify(['','']));
});
test('올리기 · 고치기는 엘미하 계정일 때만 이름을 남기고, 끝나면 다시 끈다',()=>{
  assert.equal((comm.match(/__pubKeepNames=elmIsOwner\(\);/g)||[]).length,2);
  assert.equal((comm.match(/__pubKeepNames=false;/g)||[]).length,3);
});
