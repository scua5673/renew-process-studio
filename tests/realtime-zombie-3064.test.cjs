'use strict';
/* 3.064 — 잠에서 깬 아이패드의 «열림인데 죽은» 실시간 소켓을 알아채고 다시 붙는다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
function slice(a,b){const i=S.indexOf(a),j=S.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return S.slice(i,j);}
const RT=slice('var RT_STALE_MS=','function kvPullValues(');
function harness(){
  let now=1e6;const sockets=[],timers=[],intervals=[],docL=[],syncs=[];
  class WS{constructor(u){this.url=u;this.readyState=0;this.sent=[];sockets.push(this);}send(x){this.sent.push(JSON.parse(x));}close(){this.readyState=3;}}
  const c={Date:{now:()=>now},JSON,Math,String,Error,CustomEvent:function(){},
    window:{WebSocket:WS,addEventListener(){},dispatchEvent(){}},WebSocket:WS,
    navigator:{onLine:true},document:{visibilityState:'visible',addEventListener:(e,f)=>docL.push(f)},
    BASE:'https://x.supabase.co',CFG:{anonKey:'k'},getSess:()=>({at:'t'}),dataUnlocked:()=>true,activeWs:()=>'w1',
    ensureToken:()=>({then:f=>{f(c.__tok);return {catch(){}};}}),__tok:'eyJa.eyJb.sig',meta:()=>({c:{}}),syncNow:r=>syncs.push(r),syncDiagnostic(){},
    setTimeout:(f,d)=>{timers.push({f,d});return timers.length;},clearTimeout(){},setInterval:(f,d)=>{intervals.push({f,d});return intervals.length;},clearInterval(i){if(intervals[i-1])intervals[i-1].dead=1;}};
  c.window.WebSocket=WS;vm.createContext(c);vm.runInContext(RT,c);
  function join(ws){ws.readyState=1;ws.onopen();ws.onmessage({data:JSON.stringify({event:'phx_reply',topic:'realtime:ps_kv_ping:w1',payload:{status:'ok'}})});}
  return {c,sockets,timers,intervals,docL,syncs,tick:ms=>{now+=ms;},join};
}
test('하트비트 답이 끊긴 소켓은 연결로 치지 않고 다시 붙는다',()=>{
  const h=harness();h.c.rtConnect();assert.equal(h.sockets.length,1);h.join(h.sockets[0]);
  assert.equal(h.c.rtConnected(),true);
  h.tick(80000);
  assert.equal(h.c.rtConnected(),false,'열림이어도 75초 조용하면 죽은 소켓 — 폴링이 3분으로 늘지 않는다');
  h.c.rtConnect();assert.equal(h.sockets.length,2,'좀비 소켓 대신 새로 붙는다');
});
test('하트비트 틱이 조용한 소켓을 끊고 다시 붙기를 건다',()=>{
  const h=harness();h.c.rtConnect();h.join(h.sockets[0]);
  const hb=h.intervals.find(i=>i.d===30000&&!i.dead);h.tick(76000);h.timers.length=0;hb.f();
  assert.equal(h.sockets[0].readyState,3);assert.ok(h.timers.some(t=>t.f===h.c.rtConnect),'다시 붙기 예약');
});
test('살아 있는 소켓은 그대로 두고 하트비트를 보낸다',()=>{
  const h=harness();h.c.rtConnect();h.join(h.sockets[0]);
  const hb=h.intervals.find(i=>i.d===30000&&!i.dead);h.tick(30000);h.sockets[0].onmessage({data:'{"event":"phx_reply","topic":"phoenix","payload":{"status":"ok"}}'});hb.f();
  assert.equal(h.sockets[0].readyState,1);assert.equal(h.sockets[0].sent.at(-1).event,'heartbeat');
  h.c.rtConnect();assert.equal(h.sockets.length,1);
});
test('화면이 다시 보일 때 오래 조용했으면 갈아 끼우고, 다시 붙으면 한 번 당겨온다',()=>{
  const h=harness();h.c.rtConnect();h.join(h.sockets[0]);
  h.tick(40000);h.docL.forEach(f=>f());assert.equal(h.sockets[0].readyState,3,'깨어난 좀비 소켓 닫음');
  h.c.rtConnect();assert.equal(h.sockets.length,2);h.timers.length=0;h.join(h.sockets[1]);
  const pull=h.timers.find(t=>t.d===1200);assert.ok(pull,'다시 붙은 뒤 놓친 변경 당겨오기');pull.f();assert.deepEqual(h.syncs,['realtime']);
});
test('첫 연결은 따로 당겨오지 않는다(부팅 회차가 이미 받는다)',()=>{
  const h=harness();h.c.rtConnect();h.timers.length=0;h.join(h.sockets[0]);
  assert.equal(h.timers.filter(t=>t.d===1200).length,0);
});
test('JWT 가 아닌 토큰(시험용 가짜 세션)으로는 실시간에 붙지 않는다',()=>{
  const h=harness();h.c.__tok='fixture-access-A';h.c.rtConnect();assert.equal(h.sockets.length,0);
  h.c.__tok='';h.c.rtConnect();assert.equal(h.sockets.length,0);
  h.c.__tok='eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln';h.c.rtConnect();assert.equal(h.sockets.length,1);
});
