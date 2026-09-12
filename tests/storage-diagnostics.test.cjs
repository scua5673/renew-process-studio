'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the entire shipped file: extracting the reporter into a shared scope
// would hide a reference to another IIFE's private diagnostic function.
const source = fs.readFileSync(path.join(__dirname, '../studio/storage.js'), 'utf8');
const KEY = 'cs_errlog_v1';
const initial = [{t:1700000000000,k:'err',m:'previous error',s:'app.html',l:12,p:'app.html'}];
const drain = () => new Promise(resolve=>setImmediate(resolve));

function harness(options = {}) {
  const local = new Map([[KEY,JSON.stringify(initial)]]);
  const timers = [], listeners = new Map(), diagnostics = [], warnings = [], requests = [];
  const failure = new TypeError('network failure with private document text');
  const outcomes = options.outcomes || [failure,{ok:true}];
  const ctx = vm.createContext({
    Promise,
    console:{warn:(...args)=>warnings.push(args)},
    navigator:{onLine:true,userAgent:'test browser'},
    location:{pathname:'/studio/app.html'},
    document:{body:null,getElementById:()=>null},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options&&options.detail;}},
    localStorage:{
      get length(){return local.size;},key:i=>[...local.keys()][i]||null,
      getItem:k=>local.has(k)?local.get(k):null,
      setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k),
    },
    PS_SYNC:{url:'https://storage.invalid',anonKey:'test-only'},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
    removeEventListener(){},
    dispatchEvent(e){if(e.type==='ps-storage-diagnostic')diagnostics.push(e.detail);},
    fetch(url,options){
      const request={url,options,tail:null};requests.push(request);
      const outcome=outcomes[Math.min(requests.length-1,outcomes.length-1)];
      // Preserve native promise scheduling while observing the terminal chain.
      // This captures a ReferenceError in the real catch callback without
      // allowing a deliberately failing pre-fix run to escape Node's test.
      function observe(promise){
        request.tail=promise;promise.catch(()=>{});
        return {
          then(...args){return observe(promise.then(...args));},
          catch(...args){return observe(promise.catch(...args));},
        };
      }
      return observe(outcome instanceof Error?Promise.reject(outcome):Promise.resolve(outcome));
    },
  });
  ctx.window=ctx;ctx.parent=ctx;
  vm.runInContext(source,ctx,{filename:'studio/storage.js'});
  return {
    ctx,local,diagnostics,warnings,requests,failure,
    async timer(ms){
      const index=timers.findIndex(t=>t.ms===ms);
      assert.ok(index>=0,`A real ${ms}ms reporter timer was registered`);
      timers.splice(index,1)[0].fn();
      await drain();
      if(requests.length)await requests[requests.length-1].tail;
    },
    emitError(message){
      for(const listener of listeners.get('error')||[])listener({message,filename:'/studio/app.html',lineno:15});
    },
  };
}

test('failed error-report upload emits the public sanitized diagnostic without a scope error',async()=>{
  const h=harness();
  assert.equal(typeof h.ctx.diagnostic,'undefined','The private IIFE function must not become global');
  assert.equal(typeof h.ctx.PSStorageDiagnostic,'function');
  await h.timer(4000);
  assert.equal(h.requests.length,1);
  assert.deepEqual(JSON.parse(h.local.get(KEY)),initial,'Unsent reports remain available');
  assert.deepEqual(JSON.parse(JSON.stringify(h.diagnostics)),[{stage:'event-flush',name:'TypeError',code:''}]);
  assert.equal(JSON.stringify(h.diagnostics).includes(h.failure.message),false,'Diagnostic does not copy user content from an error message');
  assert.equal(h.warnings.length,1);
});

test('a failed report upload releases the in-flight flag so the next real error can retry',async()=>{
  const h=harness();
  await h.timer(4000);
  h.emitError('next error');
  await h.timer(1500);
  assert.equal(h.requests.length,2,'The previous catch must reach flushing=false');
  const uploaded=JSON.parse(h.requests[1].options.body);
  assert.deepEqual(uploaded.map(row=>row.msg),['previous error','next error']);
  assert.deepEqual(JSON.parse(h.local.get(KEY)),[],'Successful retry acknowledges its reports');
});

for(const behavior of ['missing','throws']){
  test(`a ${behavior} diagnostic callback cannot prevent report retries`,async()=>{
    const h=harness();
    h.ctx.PSStorageDiagnostic=behavior==='missing'?undefined:()=>{throw new Error('reporter unavailable');};
    await h.timer(4000);
    assert.deepEqual(JSON.parse(h.local.get(KEY)),initial);
    h.emitError('retry after diagnostic failure');
    await h.timer(1500);
    assert.equal(h.requests.length,2);
    assert.deepEqual(JSON.parse(h.local.get(KEY)),[]);
  });
}
