/* 3.279 — 개인 노트 «그림 넣기»(제보 09e84929): 양식의 한 칸에 그림을 맞춰 넣고, 옮기고 · 크기를 바꾸고 · 지우고, 다시 열어도 남는다.
   합성 팀 fixture. 그림은 시험이 만든 2:1 초록 그림(가운데 빨간 점). */
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const open=async()=>{
    await page.evaluate(()=>window.__psShowApp('note'));
    const f=await (await page.waitForSelector('#fNote')).contentFrame();
    await f.waitForFunction(()=>window.__psNotePicture&&document.getElementById('npBtn')&&typeof note!=='undefined'&&note,null,{timeout:30000});
    await f.waitForFunction(()=>{const b=document.getElementById('npBtn');return b&&b.getBoundingClientRect().width>0;},null,{timeout:15000});
    return f;
  };
  let f=await open();
  await f.evaluate(()=>{const s=document.getElementById('nTpl');s.value='training1horizontal_land_v1';s.dispatchEvent(new Event('change'));});
  await f.waitForFunction(()=>note&&note.orient==='l');
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#npMenu [data-np]')].map(b=>b.dataset.np)),['file','vault','edit']);
  /* 그림 없는 쪽에서 «고치기»는 알림만 */
  await f.locator('#npBtn').click();await f.locator('#npMenu [data-np="edit"]').click();
  assert.equal(await f.evaluate(()=>__psNotePic.mode()),'');
  /* 파일 고르기 → 놓기 모드 */
  await f.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=800;c.height=400;const g=c.getContext('2d');g.fillStyle='#1E7B45';g.fillRect(0,0,800,400);g.fillStyle='#D6453D';g.beginPath();g.arc(400,200,60,0,7);g.fill();
    const blob=await new Promise(r=>c.toBlob(r,'image/png')),dt=new DataTransfer();dt.items.add(new File([blob],'drill.png',{type:'image/png'}));
    const i=document.getElementById('npFile');i.files=dt.files;i.dispatchEvent(new Event('change'));
  });
  await f.waitForFunction(()=>__psNotePic.mode()==='place'&&document.getElementById('psNpLayer'));
  const bb=await (await f.$('#cv')).boundingBox();
  /* 칸을 끈다: 쪽의 20%~60% × 20%~70% (가로 0.4 · 세로 0.5 — 그림 2:1 은 폭에 맞고 세로 가운데로) */
  await page.mouse.move(bb.x+bb.width*.2,bb.y+bb.height*.2);await page.mouse.down();
  await page.mouse.move(bb.x+bb.width*.4,bb.y+bb.height*.5,{steps:4});await page.mouse.move(bb.x+bb.width*.6,bb.y+bb.height*.7,{steps:4});await page.mouse.up();
  await f.waitForFunction(()=>note.pages[pi].pics&&note.pages[pi].pics.length===1&&__psNotePic.mode()==='');
  const p1=await f.evaluate(()=>{const p=note.pages[pi].pics[0];return {x:p.x/LW,y:p.y/LH,w:p.w/LW,h:p.h/LH,ar:p.w/p.h,src:p.src.slice(0,23),len:p.src.length};});
  assert.equal(p1.src,'data:image/jpeg;base64,');assert.ok(Math.abs(p1.ar-2)<.02,'비율 유지 '+p1.ar);
  assert.ok(Math.abs(p1.x-.2)<.01&&Math.abs(p1.w-.4)<.01,'칸 폭에 맞춤 '+JSON.stringify(p1));
  assert.ok(p1.y>.2&&p1.y+p1.h<.7&&Math.abs((p1.y+p1.h/2)-.45)<.01,'칸 안 세로 가운데 '+JSON.stringify(p1));
  /* 화면 · 내보내기 그림에 실제로 그려졌다(가운데 빨간 점) */
  const px=()=>f.evaluate(async()=>{await loadBgs();const c=pageCanvas(pi),p=note.pages[pi].pics[0],g=c.getContext('2d');if(!p)return null;const d=g.getImageData(Math.round((p.x+p.w/2)*2),Math.round((p.y+p.h/2)*2),1,1).data;return [d[0],d[1],d[2]];});
  let c1=null;for(let i=0;i<40;i++){c1=await px();if(c1&&c1[0]>180&&c1[1]<110)break;await page.waitForTimeout(150);}
  assert.ok(c1&&c1[0]>180&&c1[1]<110,'내보내기 그림에 빨간 점 '+JSON.stringify(c1));
  await page.screenshot({path:path.join(SHOTS,'note-picture-'+engine+'-1-placed.png')});
  /* 고치기: 옮기기 · 크기 */
  await f.locator('#npBtn').click();await f.locator('#npMenu [data-np="edit"]').click();
  await f.waitForSelector('#psNpLayer .np-box');
  let b=await (await f.$('#psNpLayer .np-box')).boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+60,b.y+b.height/2+30,{steps:5});await page.mouse.up();
  const p2=await f.evaluate(()=>{const p=note.pages[pi].pics[0];return {x:p.x/LW,y:p.y/LH,w:p.w/LW};});
  assert.ok(p2.x>p1.x+.02&&p2.y>p1.y+.01&&Math.abs(p2.w-p1.w)<.001,'옮김 '+JSON.stringify(p2));
  const h=await (await f.$('#psNpLayer .np-h')).boundingBox();
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2-80,h.y+h.height/2-40,{steps:5});await page.mouse.up();
  const p3=await f.evaluate(()=>{const p=note.pages[pi].pics[0];return {w:p.w/LW,ar:p.w/p.h};});
  assert.ok(p3.w<p2.w-.03&&Math.abs(p3.ar-2)<.02,'줄임 · 비율 유지 '+JSON.stringify(p3));
  await page.screenshot({path:path.join(SHOTS,'note-picture-'+engine+'-2-edit.png')});
  await f.locator('#psNpBar button.ok').click();
  assert.equal(await f.evaluate(()=>__psNotePic.mode()),'');
  /* 저장 → 다시 열어도 남는다 */
  await f.evaluate(async()=>{save();if(window.__noteFlush)await window.__noteFlush();});
  await page.waitForTimeout(800);await page.reload();f=await open();
  await f.waitForFunction(()=>note&&note.pages[0]&&Array.isArray(note.pages[0].pics)&&note.pages[0].pics.length===1,null,{timeout:20000});
  let c2=null;for(let i=0;i<40;i++){c2=await px();if(c2&&c2[0]>180&&c2[1]<110)break;await page.waitForTimeout(150);}
  assert.ok(c2&&c2[0]>180&&c2[1]<110,'다시 연 뒤에도 그림 '+JSON.stringify(c2));
  /* 지우기 */
  await f.locator('#npBtn').click();await f.locator('#npMenu [data-np="edit"]').click();
  await f.locator('#psNpLayer .np-x').click();
  assert.equal(await f.evaluate(()=>note.pages[pi].pics.length),0);
  await f.locator('#psNpBar button.ok').click();
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],'no page errors');
  console.log(JSON.stringify({passed:true,engine,size}));
}catch(e){console.error(e);process.exitCode=1;}finally{process.exit(process.exitCode||0);}
