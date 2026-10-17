import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 오류 제보 0d7c9cca · b3ee171e · 6cbcf0d1 — 장면 속도 «모든 장면에 적용» · 유지 0.1초 · 토큰 하나만 리셋. 합성 팀 fixture 에서만 돈다(실계정·서버 없음).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&document.getElementById('animSpeedSel')&&window.PSBoardAnimTools);
  await page.waitForTimeout(1200);
  const isDesk=size==='desktop';
  /* 장면 n 개 — 선수 셋(801·802·803)이 장면마다 오른쪽으로. 장면 0 의 801·802 는 휘어 뛰는 곡선이 있다 */
  const scenes=n=>f.evaluate(n=>{ try{stopAnim();}catch(_){}
    const P=k=>[{id:801,team:'blue',num:'7',x:200+k*60,y:300},{id:802,team:'blue',num:'9',x:200+k*60,y:500},{id:803,team:'red',num:'4',x:200+k*60,y:700}];
    state.drawings=[];state.equipment=[];sel=null;multiSel=[];
    anim.frames=Array.from({length:n},(_,k)=>({snap:Object.assign(captureSnap(),{players:P(k)}),dur:1}));
    anim.frames[0].curves={801:{mx:9,my:9},802:{mx:-9,my:9}};
    animActive=0;loadSnap(anim.frames[0].snap);ensureAnimMode(false);renderTokens();renderAnimFrames();updateDelUI(); },n);
  const speeds=()=>f.evaluate(()=>anim.frames.map(fr=>fr.moveSpeed===undefined?null:fr.moveSpeed));
  const pick=(id,v)=>f.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));return s.value;},[id,v]);

  // ① 속도 — 목록이 «이 장면만 / 모든 장면에 적용» 두 묶음, 아래 묶음을 고르면 모든 장면이 같은 속도 · ⌘Z
  step('speed-all');
  await scenes(4);
  const groups=await f.evaluate(()=>[...document.querySelectorAll('#animSpeedSel optgroup')].map(g=>[g.label,[...g.querySelectorAll('option')].map(o=>o.value).join(',')]));
  assert.deepEqual(groups.map(g=>g[0]),['이 장면만','모든 장면에 적용']);
  assert.match(groups[1][1],/^all:0\.5,all:0\.75,all:1,/,'모든 장면 묶음은 같은 속도 목록 '+groups[1][1]);
  if(isDesk)assert.equal(await f.evaluate(()=>{const r=document.getElementById('animSpeedSel').getBoundingClientRect();return r.width>0&&r.height>0;}),true,'속도 목록이 화면에 있다');
  await f.evaluate(()=>{selectAnimFrame(1);});
  await pick('animSpeedSel','2');
  assert.deepEqual(await speeds(),[null,2,null,null],'«이 장면만»은 고른 장면 하나만');
  const sig0=await f.evaluate(()=>window.__vaultEditSig&&window.__vaultEditSig());
  const shown=await pick('animSpeedSel','all:1.5');
  assert.deepEqual(await speeds(),[1.5,1.5,1.5,1.5],'모든 장면이 1.5×');
  assert.equal(shown,'1.5','고른 뒤 목록은 이 장면 속도(1.5×)를 보여 준다');
  if(sig0!=null)assert.notEqual(await f.evaluate(()=>window.__vaultEditSig()),sig0,'속도만 바꿔도 «변경 있음»');
  await f.evaluate(()=>undoLast());
  assert.deepEqual(await speeds(),[null,2,null,null],'⌘Z 한 번이면 모든 장면 속도가 돌아온다');
  assert.equal(await f.evaluate(()=>document.getElementById('animSpeedSel').value),'2','되돌린 뒤 목록도 이 장면 속도');
  await f.evaluate(()=>redoLast());
  assert.deepEqual(await speeds(),[1.5,1.5,1.5,1.5],'다시 실행');
  // 새 장면은 앞 장면 속도를 이어받는다(모든 장면에 맞춘 속도가 1× 로 돌아가지 않게)
  await f.evaluate(()=>{selectAnimFrame(3);document.getElementById('animAdd').click();});
  assert.deepEqual(await speeds(),[1.5,1.5,1.5,1.5,1.5],'더한 장면도 1.5×');
  await f.evaluate(()=>selectAnimFrame(0));
  await pick('animSpeedSel','all:1');
  assert.deepEqual(await speeds(),[1,1,1,1,1],'1× 로 모두 되돌리기');

  // ② 유지 시간 0.1초 — 목록에 있고, 재생 · GIF 가 0.1초로 쓴다(전에는 0.2초로 잘렸다)
  step('hold-0.1');
  const hold=await f.evaluate(()=>({vals:[...document.querySelectorAll('#animHoldSel option')].map(o=>o.value),grp:[...document.querySelectorAll('#animHoldSel optgroup')].map(g=>g.label)}));
  assert.equal(hold.vals[0],'0.1','가장 짧은 유지 시간 0.1초 '+hold.vals);
  assert.deepEqual(hold.grp,['모든 장면 공통']);
  assert.equal(await pick('animHoldSel','0.1'),'0.1');
  assert.equal(await f.evaluate(()=>animHold),0.1);
  await scenes(6);
  await pick('animSpeedSel','all:4');   /* 이동은 짧게(장면 사이 0.25초) — 유지 시간 차이가 잘 보이게 */
  const playMs=()=>f.evaluate(()=>new Promise(res=>{ animActive=0; const t0=performance.now(); playAnim();
    (function w(){ if(!animPlaying)res(performance.now()-t0); else requestAnimationFrame(w); })(); }));
  /* 첫 재생은 장면 그림 · 처음 도는 코드 값이 붙어 느리다(CI 웹킷에서 0.1초 쪽만 0.7초 더 걸려 차이가 0.65초로 보였다) — 한 번 데우고, 두 번 재서 짧은 쪽 */
  await playMs();
  const best=async()=>Math.min(await playMs(),await playMs());
  const ms01=await best();
  await pick('animHoldSel','0.3');
  const ms03=await best();
  /* 장면 6 개 = 머묾 6번. 0.1초면 0.3초보다 6×0.2 = 1.2초 짧다(예전처럼 0.2초로 잘리면 0.6초만 짧다) */
  assert.ok(ms03-ms01>900,`0.1초 유지가 재생에 그대로 쓰인다: 0.1 → ${Math.round(ms01)}ms, 0.3 → ${Math.round(ms03)}ms`);
  assert.ok(ms01<3000,'0.1초 재생 '+Math.round(ms01)+'ms');
  // 저장본에 0.1 이 남고 다시 읽어도 0.1
  await pick('animHoldSel','0.1');
  assert.equal(await f.evaluate(()=>{const a=window.__animGet();window.__animRestoreMeta({hold:a.hold,title:'',titleColor:''});return [a.hold,animHold,document.getElementById('animHoldSel').value].join('|');}),'0.1|0.1|0.1');
  // GIF — 첫 장면 머묾 지연이 10cs(0.1초)
  const delays=await f.evaluate(async()=>{ const restore=captureSnap();
    try{ const g=await _gifEncode(anim.frames.slice(0,2),{hold:.1,fps:25,width:160});
      const b=g.bytes,out=[]; for(let i=0;i+5<b.length&&out.length<3;i++){ if(b[i]===0x21&&b[i+1]===0xF9&&b[i+2]===0x04)out.push(b[i+4]|(b[i+5]<<8)); } return out;
    }finally{ loadSnap(restore); } });
  assert.equal(delays[0],10,'GIF 첫 장면 머묾 0.1초 '+delays);

  // ③ 토큰 하나만 리셋 — 오른쪽 클릭(손가락은 탭) 정보 창의 «↺ 이 토큰만 리셋». 다른 토큰 · 다른 곡선은 그대로 · ⌘Z
  step('token-reset');
  await scenes(3);
  const xs=()=>f.evaluate(()=>anim.frames.map(fr=>fr.snap.players.map(p=>p.id+':'+p.x).join(',')));
  const btn=()=>f.evaluate(()=>{const b=document.getElementById('tokAnimResetBtn'),cs=getComputedStyle(b),r=b.getBoundingClientRect();
    return {shown:cs.display!=='none'&&r.width>0,text:b.textContent.trim(),op:+cs.opacity,inView:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth};});
  await page.waitForTimeout(400);   /* 장면을 새로 깐 뒤 판이 자리 잡을 틈 */
  if(isDesk){
    const box=await (await page.$('#fBoard')).boundingBox();
    const r=await f.evaluate(()=>{const e=document.querySelector('#tokenLayer [data-id="801"]').getBoundingClientRect();return {x:e.x+e.width/2,y:e.y+e.height/2};});
    await page.mouse.click(box.x+r.x,box.y+r.y,{button:'right'});
  }else{
    await f.evaluate(()=>{sel={type:'player',ref:state.players.find(p=>p.id===801)};multiSel=[];window.__selPanelOpen(true);});
  }
  await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>sel&&sel.ref&&sel.ref.id),801,'801 을 골랐다');
  let b=await btn();
  assert.equal(b.shown,true,'정보 창에 리셋 단추');assert.equal(b.text,'↺ 이 토큰만 리셋');assert.equal(b.op,1);
  assert.equal(b.inView,true,'단추가 화면 안에 있다');
  await page.screenshot({path:path.join(SHOTS,`anim-scene-tools-${engine}-panel.png`)});
  // 지금 장면(1)에서 801 을 옮기고 리셋 → 801 만 뒤 장면 전부 지금 자리로
  await f.evaluate(()=>{const p=state.players.find(p=>p.id===801);p.x=640;renderTokens();});
  await f.evaluate(()=>document.getElementById('tokAnimResetBtn').click());
  assert.deepEqual(await xs(),['801:640,802:200,803:200','801:640,802:260,803:260','801:640,802:320,803:320'],'801 만 바뀐다');
  assert.deepEqual(await f.evaluate(()=>Object.keys(anim.frames[0].curves||{})),['802'],'801 곡선만 지운다');
  // 리셋이 지운 뒤 장면 그림을 다시 그려도(판을 잠깐 바꿨다 되돌림) 고른 토큰 · 정보 창은 그대로
  await f.waitForFunction(()=>anim.frames.every(fr=>!!fr.thumb),null,{timeout:5000});
  await page.waitForTimeout(200);
  assert.equal(await f.evaluate(()=>sel&&sel.ref&&sel.ref.id),801,'장면 그림을 다시 그린 뒤에도 801 이 골라져 있다');
  b=await btn();assert.equal(b.shown,true,'정보 창도 그대로');
  await f.evaluate(()=>undoLast());
  assert.deepEqual(await xs(),['801:200,802:200,803:200','801:260,802:260,803:260','801:320,802:320,803:320'],'⌘Z 로 되돌린다');
  // 여럿 골라서
  await f.evaluate(()=>{loadSnap(anim.frames[0].snap);sel=null;multiSel=[state.players.find(p=>p.id===801),state.players.find(p=>p.id===803)];window.__selPanelOpen(true);});
  await page.waitForTimeout(150);
  b=await btn();assert.equal(b.text,'↺ 고른 토큰만 리셋');
  await f.evaluate(()=>{state.players.forEach(p=>{if(p.id!==802)p.x=700;});renderTokens();document.getElementById('tokAnimResetBtn').click();});
  assert.deepEqual(await xs(),['801:700,802:200,803:700','801:700,802:260,803:700','801:700,802:320,803:700'],'고른 801 · 803 만, 802 는 그대로');
  await f.waitForFunction(()=>anim.frames.every(fr=>!!fr.thumb),null,{timeout:5000});await page.waitForTimeout(200);
  assert.deepEqual(await f.evaluate(()=>multiSel.map(p=>p.id).sort()),[801,803],'여럿 고른 것도 장면 그림을 다시 그린 뒤 그대로');
  // 마지막 장면 — 단추는 보이되 흐리고, 누르면 까닭을 알리고 아무것도 안 바꾼다
  await f.evaluate(()=>{selectAnimFrame(2);sel={type:'player',ref:state.players.find(p=>p.id===802)};multiSel=[];window.__selPanelOpen(true);window.__toastLog=[];const t=window.toast;window.toast=function(m){window.__toastLog.push(m);return t.apply(this,arguments);};});
  await page.waitForTimeout(150);
  b=await btn();assert.equal(b.shown,true,'마지막 장면에서도 보인다');assert.ok(b.op<1,'흐리게 '+b.op);
  const before=await xs();
  await f.evaluate(()=>document.getElementById('tokAnimResetBtn').click());
  assert.deepEqual(await xs(),before,'마지막 장면에선 바꾸지 않는다');
  assert.ok(await f.evaluate(()=>window.__toastLog.some(m=>/마지막 장면/.test(m))),'까닭을 알린다');

  const bad=logs.filter(l=>l.type==='pageerror');
  assert.equal(bad.length,0,'페이지 오류 '+JSON.stringify(bad.slice(0,3)));
  console.log(JSON.stringify({engine,size,ok:true,playMs:{h01:Math.round(ms01),h03:Math.round(ms03)},gif:delays}));
}catch(e){ console.error('step',cur);throw e; }
finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close(); }
