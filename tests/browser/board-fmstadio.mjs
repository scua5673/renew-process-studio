import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.902 — FmStadio 참고 작전판 기능: 로빙 패스, 역할 링(버튼·H), 구역 이름, 선 끝 모양,
// 새 장면에서 화살표 모두 지우기, 입체 칩. 관중석·광고판은 넣지 않기로 했다(2026-09-28). 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderDrawings==='function'&&typeof cycleRoleRing==='function');
  await page.waitForTimeout(1500);

  // 로빙: 선 스타일의 «로빙»을 누르면 패스가 공중 곡선 + 바닥 그림자
  const lob=await f.evaluate(()=>{
    const d={type:'pass',color:'#ffffff',lw:1,op:1,pts:[{x:250,y:450},{x:720,y:260}]};
    state.drawings.push(d);selectItem('drawing',d);
    document.getElementById('lineStyleBtn').click();
    document.querySelector('#lsLob [data-v="lob"]').click();
    const curved=[...document.querySelectorAll('#drawLayer path, svg path')].some(p=>/ Q /.test(p.getAttribute('d')||''));
    const r={lob:d.lob,shadows:document.querySelectorAll('.lob-shadow').length,curved};
    document.querySelector('#lsHead [data-v="bar"]').click();r.head=d.head;
    document.getElementById('lineStyleBtn').click();
    return r;});
  assert.equal(lob.lob,true,'로빙 토글이 패스에 저장된다');
  assert.ok(lob.shadows>=2,'바닥 그림자 선과 끝 그림자가 그려진다');
  assert.ok(lob.curved,'조절점이 없어도 곡선으로 그린다');
  assert.equal(lob.head,'bar','끝 모양을 막기로 바꾼다');

  // 역할 링: 버튼과 H 로 없음 → 압박 → 목표
  const ring=await f.evaluate(()=>{
    state.players=[{id:'r1',team:'red',num:'7',x:400,y:300}];renderTokens();
    selectItem('player',state.players[0]);
    document.getElementById('ringBtn').click();const first=state.players[0].ring;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'h',bubbles:true,cancelable:true}));
    return {first,second:state.players[0].ring,drawn:document.querySelectorAll('.ps-rolering').length,label:document.getElementById('ringLb').textContent,tool:state.tool};});
  assert.equal(ring.first,'press');assert.equal(ring.second,'target');
  assert.equal(ring.drawn,1,'링이 칩에 그려진다');assert.equal(ring.label,'목표');assert.equal(ring.tool,'move','H 가 도구를 바꾸지 않는다');

  // 구역 이름
  const zone=await f.evaluate(()=>{
    const z={type:'rect',color:'#ffffff',lw:1,op:1,pts:[{x:360,y:220},{x:520,y:380}]};
    state.drawings.push(z);selectItem('drawing',z);
    document.getElementById('lineStyleBtn').click();
    const i=document.getElementById('lsZoneName');if(!i)return {noInput:true};
    const lobRow=!!document.getElementById('lsLob');
    i.value='압박 함정';i.dispatchEvent(new Event('input'));
    document.getElementById('lineStyleBtn').click();
    return {label:z.label,text:[...document.querySelectorAll('.zone-label text')].map(t=>t.textContent),lobRow};});
  assert.equal(zone.label,'압박 함정');assert.deepEqual(zone.text,['압박 함정']);
  assert.equal(zone.lobRow,false,'구역만 고르면 «패스» 줄은 없다');

  // 새 장면에서 화살표 모두 지우기: 다음 장면에는 구역만 남는다
  const clear=await f.evaluate(()=>{
    const p=state.drawings.find(d=>d.type==='pass');selectItem('drawing',p);
    document.getElementById('lineStyleBtn').click();
    document.getElementById('lsClearNext').click();
    return {frames:anim.frames.length,active:animActive,types:state.drawings.map(d=>d.type),prev:anim.frames[animActive-1].snap.drawings.map(d=>d.type)};});
  assert.ok(clear.frames>=2&&clear.active===clear.frames-1,'다음 장면이 생긴다');
  assert.deepEqual(clear.types,['rect'],'새 장면에는 화살표가 없다');
  assert.ok(clear.prev.includes('pass'),'앞 장면의 화살표는 그대로다');

  // 입체 칩
  const look=await f.evaluate(()=>{
    window.__setChip3d(true);renderTokens();
    const r={c3:document.querySelectorAll('.ps-c3').length,rim:!!document.getElementById('stadiumRim')};
    window.__setChip3d(false);r.offC3=document.querySelectorAll('.ps-c3').length;return r;});
  assert.equal(look.c3,2,'칩마다 그림자·광택');assert.equal(look.offC3,0);assert.equal(look.rim,false,'관중석은 그리지 않는다');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,passed:true,lob,ring,zone,clear:{frames:clear.frames},look}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
