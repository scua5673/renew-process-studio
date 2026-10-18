'use strict';
// 오류 제보 8d8daa7e «IDP» — 새 판으로 여는 새로고침은 «우리가 하는 새로고침» 표시(ps_self_reload)를 남긴다.
// 표시가 없으면 sync.js 의 pagehide 정리(wipeTeamCacheSoft)가 닫을 때처럼 팀 자료 사본을 지운다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function cut(src,from,to){const a=src.indexOf(from),b=src.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,from);return src.slice(a,b);}
const code=cut(app,'function psReloadWorkspaceSeal(){','function psFlushAllPending(){')+'\n'+cut(app,'function psUpdateStatus(','</script>');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(flush){
  const local=new Map([['ps_active_ws','team-a'],['ps_cache_owner_v1','owner-a']]),session=new Map(),seen=[];
  const c={Date,JSON,Promise,localStorage:{getItem:k=>local.get(k)||null},
    sessionStorage:{setItem:(k,v)=>session.set(k,String(v)),getItem:k=>session.get(k)??null},
    document:{getElementById:()=>null,hidden:true,querySelector:()=>null,querySelectorAll:()=>[],body:{getAttribute:()=>'idp',classList:{contains:()=>false}},addEventListener(){}},
    navigator:{},location:{reload(){seen.push(session.get('ps_self_reload')||null);}},psShowUpdBand(){},
    psFlushAllPendingReady:async()=>{if(flush)await flush();},setTimeout:()=>0,clearTimeout(){},setInterval(){}};
  c.window=c;vm.createContext(c);vm.runInContext(code,c);return {c,session,seen};
}
test('자동 업데이트 새로고침은 reload 전에 우리 새로고침 표시를 남긴다',async()=>{
  const f=fixture();f.c.psAutoReloadWhenSafe();await tick();await tick();
  assert.deepEqual(f.seen,['1'],'reload 순간 표시가 이미 있다');
});
test('저장 확인이 실패해 미룬 업데이트는 표시를 남기지 않는다(그 탭을 닫으면 평소처럼 정리된다)',async()=>{
  const f=fixture(()=>{throw Error('disk');});f.c.psAutoReloadWhenSafe();await tick();await tick();
  assert.deepEqual(f.seen,[]);assert.equal(f.session.has('ps_self_reload'),false);
});
test('sync.js 는 이 표시가 있으면 닫힘 정리를 하지 않는다',()=>{
  const fn=cut(sync,'function wipeAllowedNow(){','\nvar IDP_PRIV_PREFIX');
  const run=(session,booting,age)=>{const c={sessionStorage:{getItem:k=>session[k]||null},document:{body:{classList:{contains:()=>booting}}},Date:{now:()=>1e6},BOOT_AT:1e6-age,SELF_RELOAD:'ps_self_reload'};
    vm.createContext(c);vm.runInContext(fn+';this.r=wipeAllowedNow();',c);return c.r;};
  assert.equal(run({},false,60000),true,'평소 닫힘은 정리한다');
  assert.equal(run({ps_self_reload:'1'},false,60000),false,'우리 새로고침은 정리하지 않는다');
});
