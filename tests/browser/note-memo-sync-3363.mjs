/* 3.363 — 개인 노트 «메모»가 내 계정(개인 공간의 cs_notes_memo_sync_v1)에 저장된다.
   기기 A 에서 적은 메모가 새 기기 B 에 보이고, B 에서 따로 적은 메모와 합쳐지고, B 에서 지우면 A 에서도 빠진다. 팀 공간에는 쓰지 않는다. 합성 팀 fixture. */
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const KEY='cs_notes_memo_sync_v1';
const memoFrame=async page=>{
  await page.evaluate(()=>window.__psShowApp('note'));
  const f=await (await page.waitForSelector('#fNote')).contentFrame();
  await f.waitForFunction(()=>window.PSNoteMemoSync&&window.__memoSync&&typeof window.__noteSetMode==='function',null,{timeout:30000});
  await f.evaluate(()=>window.__noteSetMode('memo'));
  await f.waitForFunction(()=>document.body.classList.contains('memo-mode')&&document.getElementById('memoText').getBoundingClientRect().width>0);
  return f;
};
const type=async(f,text)=>{
  await f.locator('#memoNew').click();
  await f.locator('#memoText').click();
  /* 한 번에 넣는다 — 웹킷 시험 브라우저는 이 편집기에 글쇠를 하나씩 치면 첫 글자 뒤 커서가 맨 앞으로 간다(이 판 전에도 같다 · probe 로 확인) */
  await f.evaluate(t=>{document.getElementById('memoText').focus();document.execCommand('insertText',false,t);},text);
};
const texts=f=>f.evaluate(()=>window.__memoSync.get().memos.map(m=>m.text).filter(Boolean).sort());
const last=()=>{const w=fx.writes.filter(x=>x.k===KEY&&typeof x.v==='string').pop();return w?JSON.parse(w.v):null;};
const waitServer=async(page,ok,why)=>{for(let i=0;i<80;i++){const d=last();if(d&&ok(d))return d;await page.waitForTimeout(250);}assert.fail(why+' — 서버 문서 '+JSON.stringify(last()));};
let fail=null;
try{
  const A=await openApp(fx,size,{browsers});
  await A.page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  const owner=await A.page.evaluate(()=>PSSync.memo.owner());
  assert.ok(owner&&owner.wid&&owner.wid!==owner.active,'팀 공간이 열려 있어도 개인 공간에 쓴다');
  const fa=await memoFrame(A.page);
  await type(fa,'기기 A 의 메모');
  await waitServer(A.page,d=>d.m.some(m=>m.text==='기기 A 의 메모'),'A 의 메모가 올라간다');
  assert.ok(fx.writes.filter(w=>w.k===KEY&&typeof w.v==='string').every(w=>w.wid===owner.wid),'개인 공간 키로만 쓴다');
  assert.ok(last().m.every(m=>m.text.trim()),'빈 메모는 올리지 않는다');

  /* 새 기기 B — 빈 저장소. 받기 전에 제 메모를 하나 적는다 */
  const B=await openApp(fx,size,{browsers});
  await B.page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  const fb=await memoFrame(B.page);
  await type(fb,'기기 B 의 메모');
  await fb.waitForFunction(()=>window.__memoSync.get().memos.some(m=>m.text==='기기 A 의 메모'),null,{timeout:20000});
  assert.deepEqual(await texts(fb),['기기 A 의 메모','기기 B 의 메모'],'B 에 두 메모가 다 보인다');
  await waitServer(B.page,d=>d.m.length===2,'서버에 두 메모');
  assert.equal(await fb.evaluate(()=>document.getElementById('memoText').innerText.trim()),'기기 B 의 메모','치던 메모는 그대로');

  /* A 가 다시 보면 B 의 메모가 온다 */
  await fa.evaluate(()=>{document.activeElement&&document.activeElement.blur();});
  await A.page.waitForTimeout(1700);
  await fa.evaluate(()=>window.PSNoteMemoSync.pull());
  await fa.waitForFunction(()=>window.__memoSync.get().memos.some(m=>m.text==='기기 B 의 메모'),null,{timeout:20000});
  assert.ok(await fa.evaluate(()=>[...document.querySelectorAll('#memoItems .memo-item .mi-t')].some(e=>e.textContent.includes('기기 B 의 메모'))),'A 의 목록에 그려진다');

  /* B 에서 A 의 메모를 지운다 → 서버에서 빠지고 지운 기록이 남는다 → A 에서도 빠진다 */
  await fb.evaluate(()=>{const it=[...document.querySelectorAll('#memoItems .memo-item')].find(e=>e.textContent.includes('기기 A 의 메모'));it.querySelector('.mi-x').click();});
  await fb.getByRole('button',{name:'확인',exact:true}).click();
  const gone=await waitServer(B.page,d=>d.m.length===1&&d.m[0].text==='기기 B 의 메모','B 에서 지운 메모가 서버에서 빠진다');
  assert.equal(Object.keys(gone.d).length>=1,true,'지운 기록');
  await A.page.waitForTimeout(1700);
  await fa.evaluate(()=>window.PSNoteMemoSync.pull());
  await fa.waitForFunction(()=>!window.__memoSync.get().memos.some(m=>m.text==='기기 A 의 메모'),null,{timeout:20000});
  assert.deepEqual(await texts(fa),['기기 B 의 메모']);

  /* A 를 새로고침해도 그대로 · 지운 메모가 되살아나지 않는다 */
  await A.page.reload();
  await A.page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  const fa2=await memoFrame(A.page);
  await A.page.waitForTimeout(3000);
  assert.deepEqual(await texts(fa2),['기기 B 의 메모']);
  assert.equal(last().m.length,1);
  for(const p of [A,B]){ const errs=p.logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],'페이지 오류 없음'); }
  console.log(JSON.stringify({engine,size,passed:true}));
}catch(e){ fail=e; console.error(e); process.exitCode=1; }
finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close(); }
if(fail)throw fail;
