const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// 2.996 — 아이패드 «일정 등록하니 저장 공간이 부족»: 사람이 저장하는 길도 안전 정리 한 번 뒤 다시 저장한다.
const html=fs.readFileSync(require.resolve('../studio/process.html'),'utf8');
function setup({optimize,saveNow}){
  const start=html.indexOf('var __schedTidyAt=0'),end=html.indexOf('function save(){',start);
  assert.ok(start>0&&end>start);
  const toasts=[],states=[],calls={optimize:0,saveNow:0};
  const c=vm.createContext({window:{PSStorage:{optimize:()=>{calls.optimize++;return optimize();}},PSSaveState:{begin:s=>states.push('begin:'+s)}},
    toast:t=>toasts.push(t),saveNow:()=>{calls.saveNow++;return saveNow();},Promise,Date});
  c.PSStorage=c.window.PSStorage;c.window.PSSaveState=c.window.PSSaveState;c.PSSaveState=c.window.PSSaveState;
  vm.runInContext(html.slice(start,end),c);
  return {c,toasts,states,calls};
}
const tick=()=>new Promise(r=>setImmediate(r));

test('a quota failure runs the safe tidy once and saves the current screen again',async()=>{
  const f=setup({optimize:async()=>({freed:300000}),saveNow:()=>true});
  assert.equal(f.c.__schedTidyRetry(),true,'정리를 시작했다');
  assert.equal(f.c.__schedTidyRetry(),true,'정리 중에 들어온 저장은 기다린다');
  await tick();await tick();
  assert.equal(f.calls.optimize,1,'정리는 한 번');
  assert.equal(f.calls.saveNow,1,'정리 뒤 한 번 다시 저장');
  assert.deepEqual(f.toasts,['저장 공간을 정리하고 일정을 저장했어요']);
  assert.deepEqual(f.states,['begin:schedule']);
  assert.equal(f.c.__schedTidyRetry(),false,'10분 안에는 다시 정리하지 않고 경고로 넘어간다');
});

test('a failing tidy still retries the save, and a second failure is left to the warning',async()=>{
  const f=setup({optimize:async()=>{throw new Error('owner changed');},saveNow:()=>false});
  assert.equal(f.c.__schedTidyRetry(),true);
  await tick();await tick();
  assert.equal(f.calls.saveNow,1);
  assert.deepEqual(f.toasts,[],'다시 저장에 실패하면 성공 문구를 띄우지 않는다');
  assert.equal(f.c.__schedTidyRetry(),false);
});

test('without the storage helper the old warning path is unchanged',()=>{
  const f=setup({optimize:async()=>({}),saveNow:()=>true});
  f.c.window.PSStorage=null;f.c.PSStorage=null;
  assert.equal(f.c.__schedTidyRetry(),false);
});

test('saveNow asks for the tidy before the storage-full warning',()=>{
  const body=html.slice(html.indexOf('function saveNow(){'),html.indexOf('function loadState(opt){'));
  const retry=body.indexOf('if(__schedTidyRetry())return false;'),warn=body.indexOf("toast('⚠︎ 저장 공간 부족");
  assert.ok(retry>0&&warn>retry);
});
