'use strict';
/* 3.038 — 로그아웃 전 자료 묻기(sync.js legacyCacheAsk). 전엔 «확인/취소» 창이었고 «취소»가 기기 자료를 지웠는데,
   psConfirm 은 바깥 탭·Esc 도 «취소»라 잘못 탭 한 번이 삭제였다(피드백 CP-1). 이제: 단추에 할 일 · 닫기는 지우지 않음 · 지우기는 2차 확인. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function section(a,b){const i=sync.indexOf(a),j=sync.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return sync.slice(i,j);}
const code=section('function legacyCacheAsk(){','/* RPC 호출(PostgREST) */');
function harness(answers,confirms){
  const asked=[],confirmed=[];
  const c={asked,confirmed,Promise,
    askChoice(msg,buttons){asked.push({msg,labels:buttons.map(b=>b.label),primary:buttons.filter(b=>b.primary).map(b=>b.value),danger:buttons.filter(b=>b.danger).map(b=>b.value)});return Promise.resolve(answers.length?answers.shift():null);},
    askConfirm(msg){confirmed.push(msg);return Promise.resolve(confirms.length?confirms.shift():false);}};
  vm.createContext(c);vm.runInContext(code,c);return c;
}
test('«이 계정에 연결» answers mine without any confirmation',async()=>{
  const c=harness(['keep'],[]);assert.equal(await c.legacyCacheAsk(),true);assert.equal(c.asked.length,1);assert.deepEqual(c.confirmed,[]);
});
test('closing the dialog never wipes: it asks again, then falls back to keeping the data',async()=>{
  const c=harness([null,null,null,null,null],[]);assert.equal(await c.legacyCacheAsk(),true);assert.equal(c.asked.length,4,'first ask + three more');assert.deepEqual(c.confirmed,[]);
  const d=harness([null,'wipe'],[true]);assert.equal(await d.legacyCacheAsk(),false,'a real choice after one close still works');
});
test('wiping needs a second confirmation, and its cancel keeps the data',async()=>{
  const c=harness(['wipe'],[false]);assert.equal(await c.legacyCacheAsk(),true);assert.equal(c.confirmed.length,1);assert.match(c.confirmed[0],/되돌릴 수 없어요/);assert.match(c.confirmed[0],/취소: 이 계정에 연결/);
  const d=harness(['wipe'],[true]);assert.equal(await d.legacyCacheAsk(),false);
});
test('buttons name the action; the destructive one is red and not the default',()=>{
  const c=harness(['keep'],[]);return c.legacyCacheAsk().then(()=>{
    /* vm 문맥의 배열은 Array.prototype 이 달라 deepEqual(strict)이 거짓 — 문자열로 비교 */
    assert.equal(c.asked[0].labels.join('|'),'이 계정에 연결|기기 자료 지우고 서버 자료만 받기');
    assert.equal(c.asked[0].primary.join('|'),'keep');assert.equal(c.asked[0].danger.join('|'),'wipe');
    assert.match(c.asked[0].msg,/지금 로그인한 계정의 자료인가요\?/);
  });
});
test('the old confirm wording is gone and the shell has a psChoice whose close path picks nothing',()=>{
  assert.doesNotMatch(sync,/취소: 이전 자료를 제거하고/);
  assert.match(sync,/return legacyCacheAsk\(\)\.then\(function\(mine\)\{/);
  const i=app.indexOf('window.psChoice=function(msg,buttons,onPick){');assert.ok(i>0,'app.html defines psChoice');
  const body=app.slice(i,app.indexOf('})();',i));
  assert.match(body,/e\.key==='Escape'\)\{e\.stopPropagation\(\);close\(\);onPick&&onPick\(null\);\}/,'Escape → null');
  assert.match(body,/if\(e\.target===ov\)\{ close\(\); onPick&&onPick\(null\); \}/,'backdrop → null');
  assert.match(sync,/function askChoice\(msg,buttons\)\{return new Promise\(function\(res\)\{try\{if\(window\.psChoice\)/,'sync.js askChoice uses the shell dialog');
  assert.match(sync,/\}catch\(_\)\{\}res\(null\);\}\);\}/,'without the shell dialog askChoice answers null (never a native confirm whose cancel could wipe)');
});
