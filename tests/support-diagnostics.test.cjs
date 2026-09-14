'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../studio/support-diagnostics.js');

class Target{
  constructor(){this.listeners=new Map();this.registrations=[];}
  addEventListener(type,fn,capture){this.registrations.push({type,capture:!!capture});if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,data={}){const event={type,...data};for(const fn of [...(this.listeners.get(type)||[])])fn(event);}
  count(type){return this.listeners.get(type)?.size||0;}
}
function surface(origin='https://studio.example.invalid'){
  const w=new Target(),doc=new Target(),values=new Map(),reads=[],observers=[];
  doc.iframes=[];doc.querySelectorAll=selector=>selector==='iframe'?doc.iframes:[];
  Object.assign(w,{document:doc,location:{origin,href:origin+'/studio/app.html?access_token=URL_SECRET#email=PRIVATE_EMAIL',pathname:'/studio/app.html'},PS_BUILD:'2.813',innerWidth:393,innerHeight:852,screen:{width:393,height:852},navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1 USER_AGENT_SECRET',language:'ko-KR',onLine:true,maxTouchPoints:5},Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:'Asia/Seoul'})})},matchMedia:()=>({matches:false}),uid:'owner-A',unlocked:true});
  w.PSSync={session:()=>({uid:w.uid,at:'ACCESS_SECRET',rt:'REFRESH_SECRET',email:'PRIVATE_EMAIL'}),dataUnlocked:()=>w.unlocked};
  values.set('ps_cache_owner_v1',JSON.stringify({uid:w.uid,wid:'team-A',seal:'seal-A'}));values.set('ps_active_ws','team-A');
  w.localStorage={getItem(k){reads.push(k);if(k==='ps_sync_session')throw Error('must not read tokens');return values.get(k)??null;}};
  w.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
  return {w,doc,values,reads,observers};
}
function frame(parent,child){const f={isConnected:true,contentWindow:child.w,ownerDocument:parent.doc};parent.doc.iframes.push(f);child.w.frameElement=f;child.w.parent=parent.w;return f;}
function collector(s){let at=Date.parse('2026-09-15T00:00:00Z');const c=D.createCollector({window:s.w,now:()=>at++});c.start();return c;}
function error(message='private row: PLAYER_SECRET',source='https://studio.example.invalid/studio/scout.html?token=SOURCE_SECRET',name='TypeError'){
  return {message,filename:source,lineno:123,colno:9,error:{name,message,stack:'TypeError: '+message+'\n at PRIVATE_FUNCTION (https://studio.example.invalid/studio/scout.html?token=STACK_SECRET:123:9)\n at https://evil.invalid/studio/sync.js?uid=PRIVATE_UID:1:2\n at https://studio.example.invalid/users/PRIVATE_NAME.js:2:3'}};
}

test('browser UMD exports install API without automatically changing handlers',()=>{
  const w={};vm.runInNewContext(fs.readFileSync(require.resolve('../studio/support-diagnostics.js'),'utf8'),{window:w,URL,Intl,Date,WeakMap});
  assert.equal(typeof w.PSSupportDiagnostics.install,'function');assert.equal(typeof w.PSSupportDiagnostics.snapshot,'function');
});

test('top errors retain only known name and static source locations, never free-form content',()=>{
  const s=surface(),c=collector(s);s.w.emit('error',error());
  const report=c.snapshot(),log=report.logs[0];
  assert.equal(log.name,'TypeError');assert.equal(log.category,'javascript');assert.equal(log.source,'/studio/scout.html');assert.equal(log.line,123);assert.equal(log.column,9);
  assert.deepEqual(log.frames,[{source:'/studio/scout.html',line:123,column:9}]);
  const copied=D.format(report),serialized=JSON.stringify(report);
  for(const secret of ['PLAYER_SECRET','SOURCE_SECRET','STACK_SECRET','PRIVATE_FUNCTION','PRIVATE_UID','PRIVATE_NAME','ACCESS_SECRET','REFRESH_SECRET','PRIVATE_EMAIL','USER_AGENT_SECRET','URL_SECRET','studio.example.invalid','evil.invalid']){
    assert.ok(!serialized.includes(secret),secret);assert.ok(!copied.includes(secret),secret);
  }
  assert.ok(copied.includes('자바스크립트 오류'));assert.ok(copied.includes('/studio/scout.html:123:9'));
  assert.ok(!s.reads.includes('ps_sync_session'));
  assert.ok(s.reads.every(k=>['ps_cache_owner_v1','ps_active_ws','ps_ws_switch_epoch_v1','ps_ws_switch_guard_v1'].includes(k)));
});

test('environment copies allowlisted device fields, not raw user agent or URL',()=>{
  const s=surface(),e=D.environment(s.w);
  assert.deepEqual(e,{appVersion:'2.813',browser:'Safari 18.0',os:'iOS',viewport:{width:393,height:852},screen:{width:393,height:852},language:'ko-KR',timeZone:'Asia/Seoul',online:true,displayMode:'browser',path:'/studio/app.html'});
  s.w.navigator.standalone=true;assert.equal(D.environment(s.w).displayMode,'standalone');
  s.w.navigator.onLine=false;assert.equal(D.environment(s.w).online,false);
  s.w.location.pathname='/users/PRIVATE_UID';s.w.PS_BUILD='SECRET_VERSION';s.w.navigator.language='secret-player-name';
  const privateEnv=D.environment(s.w);assert.equal(privateEnv.path,'');assert.equal(privateEnv.appVersion,'');assert.equal(privateEnv.language,'');
});

test('unhandled rejection objects and strings never leak documents, arbitrary codes or names',()=>{
  const s=surface(),c=collector(s);
  s.w.emit('unhandledrejection',{reason:{name:'PLAYER_SECRET',code:'JWT_SECRET',message:JSON.stringify({players:[{name:'PRIVATE_NAME'}],at:'ACCESS_SECRET'}),stack:'secret nonlocation text'}});
  s.w.emit('unhandledrejection',{reason:'Bearer ACCESS_SECRET PRIVATE_NAME'});
  const logs=c.snapshot().logs;assert.equal(logs.length,2);assert.equal(logs[0].name,'UnhandledRejection');assert.equal(logs[0].code,'');assert.equal(logs[0].source,'');
  assert.ok(!JSON.stringify(logs).includes('SECRET'));assert.ok(!D.format(c.snapshot()).includes('PRIVATE_NAME'));
});

test('known sync/storage diagnostic events retain classifier stages but discard dynamic key suffixes',()=>{
  const s=surface(),c=collector(s);
  s.w.emit('ps-sync-diagnostic',{detail:{stage:'oauth-callback-storage',name:'StorageVerificationError',code:'sync_storage',message:'TOKEN_SECRET',session:{at:'TOKEN_SECRET'}}});
  s.w.emit('ps-storage-diagnostic',{detail:{stage:'migration:cs_idp_v1_PRIVATE_UID',name:'QuotaExceededError',code:22}});
  s.w.emit('ps-sync-diagnostic',{detail:{stage:'PRIVATE_TEAM_NAME',name:'PRIVATE_PLAYER',code:'PRIVATE_UID'}});
  const logs=c.snapshot().logs;
  assert.equal(logs[0].stage,'oauth-callback-storage');assert.equal(logs[0].code,'sync_storage');assert.equal(logs[0].category,'storage');
  assert.equal(logs[1].stage,'migration');assert.equal(logs[1].name,'QuotaExceededError');assert.equal(logs[1].code,'');
  assert.equal(logs[2].stage,'');assert.equal(logs[2].name,'Error');assert.equal(logs[2].code,'');
  assert.ok(!JSON.stringify(logs).includes('PRIVATE'));assert.ok(!JSON.stringify(logs).includes('SECRET'));
});

test('safe known error classes remain meaningful without their original messages',()=>{
  assert.equal(D.sanitizeLog('error',{message:'Failed to fetch https://private.invalid/TOKEN_SECRET'},null,0).category,'network');
  assert.equal(D.sanitizeLog('sync',{name:'Error',code:403,message:'PRIVATE_TEAM'},null,0).category,'permission');
  assert.equal(D.sanitizeLog('sync',{name:'Error',code:'sync_auth'},null,0).category,'authentication');
  assert.equal(D.sanitizeLog('error',{message:'PRIVATE_RECORD timed out'},null,0).category,'timeout');
});

test('install is idempotent and preserves existing event handlers and console/network',()=>{
  const s=surface();let oldCalls=0;const old=()=>oldCalls++;s.w.addEventListener('error',old);s.w.onerror=old;s.w.fetch=()=>{};s.w.console={warn(){}};const originalFetch=s.w.fetch,originalConsole=s.w.console;
  const first=D.install(s.w),again=D.install(s.w);assert.equal(first,again);assert.equal(s.w.count('error'),2);
  s.w.emit('error',error());assert.equal(oldCalls,1);assert.equal(first.snapshot().logs.length,1);assert.equal(s.w.onerror,old);assert.equal(s.w.fetch,originalFetch);assert.equal(s.w.console,originalConsole);
  assert.equal(D.snapshot({window:s.w}).logs.length,1);assert.equal(D.snapshot().logs.length,1);
  first.stop();assert.equal(s.w.count('error'),1);assert.equal(first.snapshot().logs.length,0);
});

test('bounded snapshots are detached copies and format never serializes untrusted fields',()=>{
  const s=surface(),c=collector(s);for(let i=0;i<55;i++)s.w.emit('error',{...error(),lineno:i});
  const snapshot=c.snapshot();assert.equal(snapshot.logs.length,40);assert.equal(snapshot.logs[0].line,15);snapshot.logs[0].source='PRIVATE_SOURCE';snapshot.logs.push({message:'PRIVATE_RECORD'});
  assert.equal(c.snapshot().logs.length,40);assert.equal(c.snapshot().logs[0].source,'/studio/scout.html');
  snapshot.environment.browser='TOKEN_SECRET';snapshot.environment.path='/users/PRIVATE_NAME';snapshot.environment.email='PRIVATE_EMAIL';snapshot.session={at:'ACCESS_SECRET'};
  const copied=D.format(snapshot);for(const secret of ['PRIVATE_SOURCE','PRIVATE_RECORD','TOKEN_SECRET','PRIVATE_NAME','PRIVATE_EMAIL','ACCESS_SECRET'])assert.ok(!copied.includes(secret));
});

test('same-origin iframe runtime errors and rejections are captured; cross-origin frames are untouched',()=>{
  const s=surface(),child=surface(),foreign=surface('https://foreign.invalid');frame(s,child);frame(s,foreign);const c=collector(s);
  child.w.emit('error',error());child.w.emit('unhandledrejection',{reason:new TypeError('PRIVATE_CHILD')});foreign.w.emit('error',error());
  assert.equal(c.snapshot().logs.length,2);assert.equal(foreign.w.count('error'),0);assert.ok(!JSON.stringify(c.snapshot()).includes('PRIVATE_CHILD'));
});

test('newly loaded frames attach once and detached old documents cannot append later events',()=>{
  const s=surface(),c=collector(s),child=surface(),f=frame(s,child);s.doc.emit('load');assert.equal(child.w.count('error'),1);s.doc.emit('load');assert.equal(child.w.count('error'),1);
  const late=[...child.w.listeners.get('error')][0];child.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
  f.isConnected=false;s.doc.iframes=[];s.doc.emit('load');late(error());assert.equal(c.snapshot().logs.length,1);assert.equal(child.w.count('error'),0);
});

test('nested frame callbacks are rejected after an ancestor is detached',()=>{
  const s=surface(),child=surface(),nested=surface(),outer=frame(s,child);frame(child,nested);const c=collector(s);
  nested.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);outer.isConnected=false;nested.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
});

test('owner/team transition immediately clears logs and fences the old iframe, including A-B-A',()=>{
  const s=surface(),child=surface();frame(s,child);const c=collector(s);child.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
  s.w.uid='owner-B';s.values.set('ps_active_ws','team-B');s.values.set('ps_cache_owner_v1',JSON.stringify({uid:'owner-B',wid:'team-B',seal:'seal-B'}));s.values.set('ps_ws_switch_epoch_v1','epoch-B');s.w.emit('ps-auth-state');
  assert.equal(c.snapshot().logs.length,0);child.w.emit('error',error());assert.equal(c.snapshot().logs.length,0);
  s.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
  s.w.uid='owner-A';s.values.set('ps_active_ws','team-A');s.values.set('ps_cache_owner_v1',JSON.stringify({uid:'owner-A',wid:'team-A',seal:'seal-A'}));s.values.set('ps_ws_switch_epoch_v1','epoch-A-return');s.w.emit('ps-auth-state');
  child.w.emit('error',error());assert.equal(c.snapshot().logs.length,0);
  const fresh=surface();frame(s,fresh);s.doc.emit('load');fresh.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
});

test('snapshot notices silent identity changes, logout clears logs, token rotation does not',()=>{
  const s=surface(),c=collector(s);s.w.emit('error',error());s.w.emit('storage',{key:'ps_sync_session'});assert.equal(c.snapshot().logs.length,1);
  s.values.set('ps_active_ws','team-B');assert.equal(c.snapshot().logs.length,0);
  s.w.emit('error',error());s.w.uid='';s.w.emit('ps-auth-state');assert.equal(c.snapshot().logs.length,0);
});

test('initially locked same-owner frames can report errors before first data confirmation',()=>{
  const s=surface(),child=surface();s.w.unlocked=false;frame(s,child);const c=collector(s);child.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
  s.w.emit('ps-sync-diagnostic',{detail:{stage:'oauth-user-lookup',code:'sync_auth'}});assert.equal(c.snapshot().logs[1].category,'authentication');
});

test('storage access denial does not prevent sanitized top-level diagnostics',()=>{
  const s=surface();Object.defineProperty(s.w,'localStorage',{get(){throw new Error('PRIVATE_DENIED');}});const c=collector(s);s.w.emit('error',error('PRIVATE_RECORD','https://studio.example.invalid/studio/storage.js','SecurityError'));
  assert.equal(c.snapshot().logs.length,1);assert.equal(c.snapshot().logs[0].category,'permission');assert.ok(!JSON.stringify(c.snapshot()).includes('PRIVATE'));
});

test('malicious error getters fail closed without throwing or copying objects',()=>{
  const input={};for(const key of ['name','code','psCode','message','stack','error','reason','filename','source'])Object.defineProperty(input,key,{get(){throw new Error('PRIVATE_GETTER');}});
  assert.doesNotThrow(()=>D.sanitizeLog('error',input,null,0));assert.ok(!JSON.stringify(D.sanitizeLog('error',input,null,0)).includes('PRIVATE'));
});

test('early child hook captures parse errors before load and later load does not duplicate listeners',()=>{
  const s=surface(),c=D.install(s.w),child=surface();s.w.unlocked=false;frame(s,child);
  assert.equal(child.w.count('error'),0);assert.equal(D.attachFrame(child.w),true);
  child.w.emit('error',error('PRIVATE_PARSE','https://studio.example.invalid/studio/board.html','SyntaxError'));
  assert.equal(c.snapshot().logs[0].name,'SyntaxError');assert.equal(c.snapshot().logs[0].source,'/studio/board.html');
  s.doc.emit('load');assert.equal(child.w.count('error'),1);assert.equal(c.attachFrame(child.w),true);assert.equal(child.w.count('error'),1);
  assert.ok(child.w.registrations.some(x=>x.type==='error'&&x.capture));
});

test('early attach validates the complete live descendant chain and rejects unrelated windows',()=>{
  const s=surface(),c=collector(s),child=surface(),nested=surface(),outer=frame(s,child);frame(child,nested);
  assert.equal(c.attachFrame(nested.w),true);nested.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
  const unrelated=surface();unrelated.w.parent=unrelated.w;assert.equal(c.attachFrame(unrelated.w),false);
  const foreign=surface('https://foreign.invalid');frame(s,foreign);assert.equal(c.attachFrame(foreign.w),false);
  const impostor=surface();impostor.w.parent=s.w;impostor.w.frameElement=outer;assert.equal(c.attachFrame(impostor.w),false);
  outer.isConnected=false;assert.equal(c.attachFrame(nested.w),false);assert.equal(c.attachFrame(s.w),false);
});

test('old document cannot acquire a new owner generation by calling early attach again',()=>{
  const s=surface(),c=collector(s),child=surface();frame(s,child);assert.equal(c.attachFrame(child.w),true);
  s.w.uid='owner-B';s.values.set('ps_ws_switch_epoch_v1','epoch-B');s.w.emit('ps-auth-state');
  assert.equal(c.attachFrame(child.w),false);child.w.emit('error',error());assert.equal(c.snapshot().logs.length,0);
  const fresh=surface();frame(s,fresh);assert.equal(c.attachFrame(fresh.w),true);fresh.w.emit('error',error());assert.equal(c.snapshot().logs.length,1);
});

test('resource failures capture only known same-origin assets and discard URL secrets',()=>{
  const s=surface(),c=collector(s);
  for(const asset of ['support.js','release-notes.js','support.css'])s.w.emit('error',{target:{src:'https://studio.example.invalid/studio/'+asset+'?access_token=RESOURCE_SECRET#PRIVATE_ROW'}});
  s.w.emit('error',{target:{href:'https://studio.example.invalid/studio/support.css?email=PRIVATE_EMAIL'}});
  s.w.emit('error',{target:{src:'https://foreign.invalid/studio/support.js?token=SECRET'}});
  s.w.emit('error',{target:{src:'https://studio.example.invalid/uploads/PRIVATE_PLAYER.png'}});
  const snapshot=c.snapshot();assert.deepEqual(snapshot.logs.map(x=>x.source),['/studio/support.js','/studio/release-notes.js','/studio/support.css','/studio/support.css','','']);
  assert.ok(snapshot.logs.every(x=>x.line===0&&x.column===0));assert.ok(!JSON.stringify(snapshot).includes('SECRET'));assert.ok(!D.format(snapshot).includes('PRIVATE'));
});
