'use strict';
/* 2.949 — 오래 숨은 옛 판 앱 탭은 서비스워커가 새로 연다(sw.js stuckCheck).
   옛 판 문서의 자기 새로고침이 옛 버그로 막혀 하루 넘게 옛 판에 남은 기기(2.875·2.885·2.913)와
   옛 판 부팅이 가용인원 기록을 지운 사고(2.948) 때문. 보이는 탭·포커스 있는 탭·iframe·다른 화면은 절대 건드리지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const cacheLine=sw.match(/^const CACHE = '[^']+';/m)[0];
const block=sw.slice(sw.indexOf('const CLIENT_CACHE'),sw.indexOf('function htmlRelease(url) {'));
const ORIGIN='https://processstudio.netlify.app';
const MIN=60000;

function makeCaches(){
  const stores=new Map();
  function store(name){
    if(!stores.has(name))stores.set(name,new Map());
    const m=stores.get(name);
    return {
      async match(k){const v=m.get(String(k));return v==null?undefined:{text:async()=>v};},
      async put(k,res){m.set(String(k),await res.text());},
      async delete(k){return m.delete(String(k));},
      async keys(){return [...m.keys()].map(url=>({url}));},
    };
  }
  return {stores,api:{open:async n=>store(n),keys:async()=>[...stores.keys()]}};
}
function client(o){
  const c=Object.assign({id:'c1',url:ORIGIN+'/studio/app.html',frameType:'top-level',visibilityState:'hidden',focused:false},o);
  c.navigated=[];c.navigate=async u=>{c.navigated.push(u);return c;};
  return c;
}
function setup(clients,{off=false}={}){
  const cs=makeCaches();
  class Response{constructor(b){this._b=String(b);}async text(){return this._b;}}
  const ctx={URL,JSON,Math,Date,Set,Map,Promise,Response,caches:cs.api,
    self:{location:{origin:ORIGIN},clients:{matchAll:async()=>clients}}};
  vm.createContext(ctx);
  vm.runInContext(cacheLine+'\n'+(off?block.replace('const STUCK_RELOAD_ON = true;','const STUCK_RELOAD_ON = false;'):block)+'\n;globalThis.__api={stuckCheck,bindClient,setLast:v=>{stuckLast=v;},CACHE};',ctx);
  const api=ctx.__api;
  // 매 호출 전에 1분 제한을 풀어 시험 시각을 우리가 정한다(실제로는 요청마다 1분에 한 번).
  api.check=async now=>{api.setLast(0);return api.stuckCheck(now);};
  api.hidden=async id=>{const m=cs.stores.get('process-client-releases-v1');const v=m&&m.get(ORIGIN+'/__ps_client_hidden__/'+id);return v?JSON.parse(v):null;};
  api.forced=()=>{const m=cs.stores.get('process-client-releases-v1');const v=m&&m.get(ORIGIN+'/__ps_sw_forced__');return v?JSON.parse(v):null;};
  return api;
}
const OLD='process-2.940';

test('옛 판·숨김·앱 셸 탭은 10분 넘게 숨어 있으면 한 번 새로 연다',async()=>{
  const c=client(),api=setup([c]);await api.bindClient('c1',OLD);
  const t0=1_000_000_000_000;
  assert.equal(await api.check(t0),0,'처음 본 순간에는 새로 열지 않는다');
  assert.deepEqual(await api.hidden('c1'),{since:t0,seen:t0});
  assert.equal(await api.check(t0+9*MIN),0,'9분은 아직');
  assert.equal(await api.check(t0+10*MIN),1);
  assert.deepEqual(c.navigated,[ORIGIN+'/studio/app.html'],'같은 주소로 새로 연다');
  const f=api.forced();assert.equal(f.from,OLD);assert.equal(f.to,api.CACHE);assert.equal(f.mins,10);
  assert.equal(await api.check(t0+11*MIN),0,'실패해도 25분 안에는 다시 하지 않는다');
  assert.equal(c.navigated.length,1);
});

test('보이는 탭·포커스 있는 탭은 아무리 오래돼도 건드리지 않고, 보이는 순간 숨김 기록을 지운다',async()=>{
  const c=client(),api=setup([c]);await api.bindClient('c1',OLD);
  const t0=1_000_000_000_000;
  await api.check(t0);
  c.visibilityState='visible';
  assert.equal(await api.check(t0+5*MIN),0);
  assert.equal(await api.hidden('c1'),null,'보였으면 처음부터 다시 잰다');
  c.visibilityState='hidden';
  await api.check(t0+6*MIN);
  assert.equal(await api.check(t0+12*MIN),0,'다시 숨은 지 6분');
  assert.equal(await api.check(t0+16*MIN),1,'다시 숨은 지 10분');
  const v=client({id:'c2',visibilityState:'visible'}),f=client({id:'c3',focused:true}),api2=setup([v,f]);
  await api2.bindClient('c2',OLD);await api2.bindClient('c3',OLD);
  for(let i=0;i<5;i++)await api2.check(1_000_000_000_000+i*15*MIN);
  assert.equal(v.navigated.length+f.navigated.length,0);
});

test('지금 판 문서·바인딩 없는 문서·iframe·다른 화면은 대상이 아니다',async()=>{
  const now=client({id:'n1'}),none=client({id:'n2'}),frame=client({id:'n3',frameType:'nested'}),admin=client({id:'n4',url:ORIGIN+'/admin.html'}),board=client({id:'n5',url:ORIGIN+'/studio/board.html?v=2.940'});
  const api=setup([now,none,frame,admin,board]);
  await api.bindClient('n1',api.CACHE);for(const id of ['n3','n4','n5'])await api.bindClient(id,OLD);
  const t0=1_000_000_000_000;
  for(let i=0;i<6;i++)await api.check(t0+i*10*MIN);
  for(const c of [now,none,frame,admin,board])assert.equal(c.navigated.length,0,c.id);
});

test('관찰 사이가 25분을 넘으면 그 사이를 모르므로 처음부터 다시 잰다',async()=>{
  const c=client(),api=setup([c]);await api.bindClient('c1',OLD);
  const t0=1_000_000_000_000;
  await api.check(t0);
  assert.equal(await api.check(t0+40*MIN),0,'40분 만에 처음 다시 봄 — 그 사이 보였을 수 있다');
  assert.equal((await api.hidden('c1')).since,t0+40*MIN);
  assert.equal(await api.check(t0+50*MIN),1);
});

test('1분에 한 번만 살펴본다',async()=>{
  const c=client(),api=setup([c]);await api.bindClient('c1',OLD);
  const t0=1_000_000_000_000;
  api.setLast(0);await api.stuckCheck(t0);
  api.setLast(t0);assert.equal(await api.stuckCheck(t0+30000),0);
  assert.deepEqual(await api.hidden('c1'),{since:t0,seen:t0},'30초 뒤 호출은 아무것도 안 함');
});

test('STUCK_RELOAD_ON=false 로 배포하면 아무것도 하지 않는다',async()=>{
  const c=client(),api=setup([c],{off:true});await api.bindClient('c1',OLD);
  const t0=1_000_000_000_000;
  for(let i=0;i<4;i++)await api.check(t0+i*10*MIN);
  assert.equal(c.navigated.length,0);assert.equal(await api.hidden('c1'),null);
});

test('관찰은 fetch 맨 앞(메서드·출처 거르기 전)과 활성화 직후에 붙어 있고, 응답에는 손대지 않는다',()=>{
  const f=sw.slice(sw.indexOf("self.addEventListener('fetch'"));
  assert.ok(f.indexOf('event.waitUntil(stuckCheck()')>0);
  assert.ok(f.indexOf('event.waitUntil(stuckCheck()')<f.indexOf("if (request.method !== 'GET') return;"),'POST·다른 출처 요청도 서비스워커를 깨운다');
  const a=sw.slice(sw.indexOf("self.addEventListener('activate'"),sw.indexOf('const CLIENT_CACHE'));
  assert.ok(a.indexOf('await self.clients.claim();')<a.indexOf('stuckCheck()'),'활성화가 끝난 뒤에만 관찰');
});

test('새로 열린 문서는 표식을 읽어 한 번 남기고 지운다(10분 안의 것만)',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
  const fn=app.slice(app.indexOf('function psUpdForcedReport(){'),app.indexOf('function psAutoReloadWhenSafe('));
  assert.match(fn,/caches\.open\('process-client-releases-v1'\)/);
  assert.match(fn,/'\/__ps_sw_forced__'/);
  assert.match(fn,/c\.delete\(key\)/);
  assert.match(fn,/Date\.now\(\)-\(\+d\.at\|\|0\)<600000/);
  assert.match(fn,/PSSync\.event\('update_forced'/);
  assert.match(sw,/const CLIENT_CACHE = 'process-client-releases-v1';/,'같은 캐시 이름');
});
