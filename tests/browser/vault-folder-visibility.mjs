import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS,A} from '../fixtures/team-app.mjs';
// 2.968 — 팀 공간 보관함은 «내게 보일 폴더»만. 10/8 제보 팀처럼 폴더 목록이 팀 공용 문서 한 벌이라
// 다른 코치의 비공개 폴더가 빈 폴더로 보이고, 지운 폴더를 다른 기기·옛 판이 목록째 올려 되살렸다.
const B='22222222-2222-4222-8222-222222222222';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const board=async()=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await f.waitForFunction(()=>typeof store==='object'&&typeof renderDrillFiles==='function');return f;};
  let bf=await board();
  // 폴더 목록을 먼저 심고 작전판이 다 읽은 뒤에 자료를 심는다(읽기 전에 그리면 자가 치유가 목록을 덮는다 — 시험 순서 문제)
  await bf.evaluate(async([A,B])=>{
    await store.set('cs_vault_folders_v1',['팀 공유','세트피스 수비','legacy 빈','내 빈 폴더','코치B 공유']);
    localStorage.setItem('cs_vault_folder_meta_v1',JSON.stringify({'팀 공유':{shared:true},'세트피스 수비':{by:B},'내 빈 폴더':{by:A},'코치B 공유':{shared:true,by:B}}));
    window.dispatchEvent(new StorageEvent('storage',{key:'cs_vault_folders_v1'}));
  },[A,B]);
  await page.waitForTimeout(1500);
  await bf.evaluate(async A=>{
    const lib=(await store.get('cs_drill_lib_v1'))||[];
    lib.unshift({libId:'Vqa_v1',type:'train',name:'가상 공유 훈련',folder:'팀 공유',tags:[],savedAt:Date.now(),createdBy:A});
    await store.set('cs_drill_lib_v1',lib);localStorage.setItem('cs_lib_rev',String(Date.now()));
  },A);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  bf=await board();
  const settle=async()=>{await page.evaluate(()=>window.PSSync&&PSSync.syncNow&&PSSync.syncNow('qa-settle')).catch(()=>{});return page.waitForFunction(()=>window.PSSync&&PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:20000}).catch(()=>{});};   /* 같은 키를 올리는 도중에 또 고치면 동기화가 충돌로 본다 — 별도 과제 */
  const names=()=>bf.evaluate(()=>[...document.querySelectorAll('.vx-folder-name')].map(e=>e.textContent));
  const stored=()=>bf.evaluate(async()=>({list:await store.get('cs_vault_folders_v1'),meta:JSON.parse(localStorage.getItem('cs_vault_folder_meta_v1')||'{}')}));
  const menuOn=async(name,label)=>{
    await settle();
    await bf.waitForFunction(n=>[...document.querySelectorAll('.vx-folder')].some(r=>(r.querySelector('.vx-folder-name')||{}).textContent===n),name,{timeout:10000});
    await bf.evaluate(n=>{const r=[...document.querySelectorAll('.vx-folder')].find(r=>(r.querySelector('.vx-folder-name')||{}).textContent===n);r.querySelector('.vx-folder-more').click();},name);
    await bf.waitForSelector('#vMenu');
    await bf.evaluate(l=>{const b=[...document.querySelectorAll('#vMenu button')].find(b=>b.textContent.trim()===l);b.click();},label);
  };
  const okDialog=async(fill)=>{
    await bf.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='확인'&&b.offsetParent));
    return bf.evaluate(f=>{const ok=[...document.querySelectorAll('button')].find(b=>b.textContent==='확인'&&b.offsetParent);const box=ok.closest('div').parentNode;const inp=box.querySelector('input');if(inp&&f!=null)inp.value=f;const t=box.firstChild.textContent;ok.click();return t;},fill??null);
  };
  // 1) 다른 코치가 만든 빈 비공개 폴더는 안 보인다 · 공유·내 것·옛 것은 보인다
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='팀 공유'),null,{timeout:20000});
  let n=await names();
  for(const want of ['팀 공유','legacy 빈','내 빈 폴더','코치B 공유'])assert.ok(n.includes(want),want+' 보임 '+JSON.stringify(n));
  assert.ok(!n.includes('세트피스 수비'),'다른 코치의 빈 비공개 폴더는 안 보인다 '+JSON.stringify(n));
  // 2) 보관함을 열기만 해서는 만든 사람 도장을 쓰지 않는다
  assert.equal(JSON.parse(await bf.evaluate(()=>localStorage.getItem('cs_vault_folder_meta_v1')))['팀 공유'].by,undefined);
  // 3) 옛 폴더 지우기 → 숨김 표시, 옛 목록이 다시 넣어도 안 보인다
  await menuOn('legacy 빈','삭제');await okDialog();
  await bf.waitForFunction(()=>![...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='legacy 빈'),null,{timeout:10000});
  let st=await stored();
  assert.ok(!st.list.includes('legacy 빈'));assert.ok(st.meta['legacy 빈']?.hid?.[A]>0,'나에게 숨김 '+JSON.stringify(st.meta));
  await settle();
  await bf.evaluate(async()=>{const l=await store.get('cs_vault_folders_v1');l.push('legacy 빈');await store.set('cs_vault_folders_v1',l);window.dispatchEvent(new StorageEvent('storage',{key:'cs_vault_folders_v1'}));});
  await bf.waitForFunction(async()=>(await store.get('cs_vault_folders_v1')).includes('legacy 빈'));
  await page.waitForTimeout(1200);
  assert.ok(!(await names()).includes('legacy 빈'),'다른 기기·옛 판이 목록에 다시 넣어도 내 화면엔 안 나온다');
  // 4) 같은 이름으로 내가 다시 만들면 보인다(숨김 풀림·만든 사람 나)
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('.vx-nav button')].find(b=>/전체 자료/.test(b.textContent));b.click();});
  await page.waitForTimeout(400);
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='＋ 새 폴더'&&b.offsetParent);b.click();});
  await okDialog('legacy 빈');
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='legacy 빈'),null,{timeout:10000});
  st=await stored();assert.deepEqual(st.meta['legacy 빈'],{by:A});
  // 5) 다른 코치가 만든 공유 폴더 «삭제» = 내 보관함에서만 숨김 — 팀 목록·공유는 그대로
  await menuOn('코치B 공유','삭제');
  const msg=await okDialog();
  assert.match(msg,/다른 코치가 만든 폴더예요 — 내 보관함에서만 숨길까요/,msg);
  await bf.waitForFunction(()=>![...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='코치B 공유'),null,{timeout:10000});
  st=await stored();
  assert.ok(st.list.includes('코치B 공유'),'팀 목록은 그대로');
  assert.equal(st.meta['코치B 공유'].shared,true);assert.equal(st.meta['코치B 공유'].by,B);assert.ok(st.meta['코치B 공유'].hid[A]>0);
  await page.screenshot({path:path.join(SHOTS,'vault-folder-visibility-'+size+'.png')});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('vault-folder-visibility ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
