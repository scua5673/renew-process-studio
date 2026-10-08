import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS,A,WT} from '../fixtures/team-app.mjs';
// 2.967 — 오류 제보(10/8) «팀공유 폴더 생성/삭제 과정에서 잘 안됩니다! 삭제가 되지 않습니다».
// 서버에서 본 그대로를 합성 팀(셸 전체, 가짜 서버)에 심는다: 폴더 목록에 «팀 공유/공격 /공격-수비»(공격 뒤 띄어쓰기)와
// «팀 공유/공격 · 팀 공유/공격/공격-수비»가 함께 있고, 자료 2개는 띄어쓰기 있는 쪽에 있다.
// 기대: 보관함을 열면 «공격»이 하나로 합쳐지고, 지우면 지워진 채로 있고, 공유 폴더 이름을 바꿔도 공유가 이어진다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const board=async()=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await f.waitForFunction(()=>typeof store==='object'&&typeof renderDrillFiles==='function');return f;};
  let bf=await board();
  await bf.evaluate(async A=>{
    const now=Date.now();
    const lib=(await store.get('cs_drill_lib_v1'))||[];
    lib.unshift(
      {libId:'Vqa_f1',type:'train',name:'가상 1v1 / 2v2',folder:'팀 공유/공격 /공격-수비',tags:[],savedAt:now,createdBy:A},
      {libId:'Vqa_f2',type:'train',name:'가상 2v2 사이드',folder:'팀 공유/공격 /공격-수비',tags:[],savedAt:now-1,createdBy:A},
      {libId:'Vqa_f3',type:'train',name:'가상 론도',folder:'팀 공유',tags:[],savedAt:now-2,createdBy:A});
    window.__qaLib=lib;
    await store.set('cs_vault_folders_v1',['팀 공유','tactice','팀 공유/공격 /공격-수비','팀 공유/공격','팀 공유/공격/수비','팀 공유/공격/공격-수비']);
    localStorage.setItem('cs_vault_folder_meta_v1',JSON.stringify({'팀 공유':{shared:true}}));
    localStorage.setItem('cs_vault_open_v1',JSON.stringify({'팀 공유':1,'팀 공유/공격':1}));
    localStorage.setItem('cs_lib_rev',String(now));
    window.dispatchEvent(new StorageEvent('storage',{key:'cs_vault_folders_v1'}));
  },A);
  await page.waitForTimeout(1500);   /* 폴더 목록을 다 읽은 뒤에 자료를 심는다 */
  await bf.evaluate(async()=>{await store.set('cs_drill_lib_v1',window.__qaLib);localStorage.setItem('cs_lib_rev',String(Date.now()));});
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  bf=await board();
  const rows=()=>bf.evaluate(()=>[...document.querySelectorAll('.vx-folder')].map(r=>({name:(r.querySelector('.vx-folder-name')||{}).textContent,pad:r.style.paddingLeft,share:(r.querySelector('.vx-share')||{className:''}).className})));
  const settle=async()=>{await page.evaluate(()=>window.PSSync&&PSSync.syncNow&&PSSync.syncNow('qa-settle')).catch(()=>{});return page.waitForFunction(()=>window.PSSync&&PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:20000}).catch(()=>{});};   /* 같은 키를 올리는 도중에 또 고치면 동기화가 충돌로 본다 — 별도 과제 */
  const named=async n=>(await rows()).filter(r=>(r.name||'').trim()===n);
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='팀 공유'),null,{timeout:20000});
  // 1) 열자마자 «공격»은 하나 — 자료도 그 하나 아래로
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].filter(e=>e.textContent.trim()==='공격').length===1,null,{timeout:15000});
  assert.equal((await named('공격')).length,1,'똑같아 보이는 «공격»이 하나로 합쳐진다 '+JSON.stringify(await rows()));
  const stored=async()=>bf.evaluate(async()=>({lib:((await store.get('cs_drill_lib_v1'))||[]).filter(d=>/^Vqa_f/.test(d.libId)).map(d=>({id:d.libId,folder:d.folder,ed:+d.editedAt||0})),list:await store.get('cs_vault_folders_v1'),meta:JSON.parse(localStorage.getItem('cs_vault_folder_meta_v1')||'{}')}));
  await bf.waitForFunction(async()=>{const l=(await store.get('cs_drill_lib_v1'))||[];return l.filter(d=>d.folder==='팀 공유/공격/공격-수비').length===2;},null,{timeout:15000});
  let st=await stored();
  assert.ok(!st.list.some(x=>/ \/|\/ | $/.test(x)),'저장된 폴더 목록에 끝 공백 칸이 없다 '+JSON.stringify(st.list));
  assert.equal(st.list.filter(x=>x==='팀 공유/공격/공격-수비').length,1);
  assert.ok(st.lib.filter(d=>d.folder==='팀 공유/공격/공격-수비').every(d=>d.ed>0),'옮긴 내 자료는 수정 시각이 올라 서버로 간다');
  // 2) «공격» 지우기 — ⋯ › 삭제 › 확인
  const menuOn=async(name,label)=>{
    await settle();
    await bf.waitForFunction(n=>[...document.querySelectorAll('.vx-folder')].some(r=>(r.querySelector('.vx-folder-name')||{}).textContent.trim()===n),name,{timeout:10000});   /* 목록을 다시 그리는 중일 수 있다 */
    await bf.evaluate(n=>{const r=[...document.querySelectorAll('.vx-folder')].find(r=>(r.querySelector('.vx-folder-name')||{}).textContent.trim()===n);r.querySelector('.vx-folder-more').click();},name);
    await bf.waitForSelector('#vMenu');
    await bf.evaluate(l=>{const b=[...document.querySelectorAll('#vMenu button')].find(b=>b.textContent.trim()===l);b.click();},label);
  };
  const okDialog=async(fill)=>{
    await bf.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='확인'&&b.offsetParent));
    const msg=await bf.evaluate(f=>{const ok=[...document.querySelectorAll('button')].find(b=>b.textContent==='확인'&&b.offsetParent);const box=ok.closest('div').parentNode;const inp=box.querySelector('input');if(inp&&f!=null){inp.value=f;}const t=box.firstChild.textContent;ok.click();return t;},fill??null);
    return msg;
  };
  await menuOn('공격','삭제');
  const delMsg=await okDialog();
  assert.match(delMsg,/항목 2개는 ‘팀 공유’으로 옮길까요/,delMsg);
  await bf.waitForFunction(async()=>{const l=(await store.get('cs_drill_lib_v1'))||[];return l.filter(d=>/^Vqa_f/.test(d.libId)).every(d=>d.folder==='팀 공유');},null,{timeout:15000});
  await bf.waitForFunction(()=>![...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent.trim()==='공격'),null,{timeout:15000});
  // 다시 그려도 되살아나지 않는다(예전엔 다음 그리기에서 자가 치유가 «공격»을 다시 만들었다)
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('.vx-nav button')].find(b=>/전체 자료/.test(b.textContent));b.click();});
  await page.waitForTimeout(800);
  await bf.evaluate(()=>{const r=[...document.querySelectorAll('.vx-folder')].find(r=>(r.querySelector('.vx-folder-name')||{}).textContent==='팀 공유');r.click();});
  await page.waitForTimeout(800);
  assert.equal((await named('공격')).length,0,'지운 «공격»은 다시 그려도 없다 '+JSON.stringify(await rows()));
  st=await stored();
  /* 2.968 — 지운 자리에 «나에게 숨김»이 남는다 */
  assert.ok(st.meta['팀 공유/공격']?.hid?.[A]>0,'나에게 숨김 '+JSON.stringify(st.meta));
  await page.waitForTimeout(2500);
  assert.equal((await named('공격')).length,0,'몇 초 뒤에도 지운 «공격»은 없다 '+JSON.stringify(await rows()));
  /* 2.973 — 하위 폴더째 지우면 목록이 5→2 로 크게 줄어 급감 보호에 걸렸고, 직전 판본이 없어 보류 → 자동 저장 재조정이
     1초 뒤 서버 옛 판으로 되돌렸다. 이제 저장된 목록·서버 목록 모두 지운 채이고, 확인창에서 고른 삭제라 되돌리기 바도 없다. */
  await settle();
  st=await stored();
  assert.ok(!st.list.some(x=>x==='팀 공유/공격'||x.indexOf('팀 공유/공격/')===0),'저장된 목록에서 지운 폴더가 빠진 채 '+JSON.stringify(st.list));
  const srvList=JSON.parse((fx.db.get(WT+'|cs_vault_folders_v1')||{v:'[]'}).v);
  assert.ok(!srvList.some(x=>x==='팀 공유/공격'||x.indexOf('팀 공유/공격/')===0),'서버 목록에서도 빠진다 '+JSON.stringify(srvList));
  const undoHold=await page.evaluate(()=>({undo:JSON.parse(localStorage.getItem('ps_undo_list_v1')||'[]').map(x=>x.k),hold:JSON.parse(localStorage.getItem('ps_hold_list_v1')||'[]').map(x=>x.k)}));
  assert.ok(!undoHold.undo.includes('cs_vault_folders_v1')&&!undoHold.hold.includes('cs_vault_folders_v1'),'확인한 삭제는 보류도 되돌리기 바도 없다 '+JSON.stringify(undoHold));
  // 3) 공유 폴더 이름 바꾸기 — 공유가 새 이름을 따라간다
  await menuOn('팀 공유','이름 변경');
  await okDialog('우리 팀 공유');
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='우리 팀 공유'),null,{timeout:15000});
  st=await stored();
  assert.equal(st.meta['우리 팀 공유']?.shared,true,'공유 표시가 새 이름으로 '+JSON.stringify(st.meta));
  assert.ok(!Object.keys(st.meta).some(k=>k==='팀 공유'||k.indexOf('팀 공유/')===0),'옛 이름에는 아무것도 남지 않는다 '+JSON.stringify(st.meta));   /* 2.968 부터 정보에 만든 사람(by)·숨김(hid)도 같이 간다 */
  assert.ok(st.lib.every(d=>d.folder==='우리 팀 공유'));
  assert.match((await named('우리 팀 공유'))[0].share,/\bon\b/,'☁ 가 켜진 채');
  // 4) 지우면 공유 표시도 사라진다 — 같은 이름으로 다시 만들어도 묻지 않고 공유되지 않는다
  await menuOn('tactice','삭제');await okDialog();
  await bf.waitForFunction(()=>![...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='tactice'),null,{timeout:15000});
  // 5) 빈 폴더 새로 만들기 — 이름에 «/» 를 쳐도 폴더 하나(／), 그리고 화면에 바로 보인다
  //    (예전엔 자료가 안 바뀌는 폴더 일은 렌더 서명이 같아 화면이 그대로였다)
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('.vx-nav button')].find(b=>/전체 자료/.test(b.textContent));b.click();});
  await page.waitForTimeout(500);
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='＋ 새 폴더'&&b.offsetParent);b.click();});
  await okDialog('공격/수비 ');
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='공격／수비'),null,{timeout:10000});
  st=await stored();
  assert.ok(st.list.includes('공격／수비')&&!st.list.some(x=>/^공격\//.test(x)),'«/» 는 폴더를 나누지 않는다 '+JSON.stringify(st.list));
  // 6) ☁ 공유 켜기 — 자료가 없어도 스위치가 바로 켜진 모양으로 바뀐다
  await bf.waitForFunction(()=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent==='공격／수비'));
  await bf.evaluate(()=>{const r=[...document.querySelectorAll('.vx-folder')].find(r=>(r.querySelector('.vx-folder-name')||{}).textContent==='공격／수비');r.querySelector('.vx-share').click();});
  await okDialog();
  await bf.waitForFunction(()=>{const r=[...document.querySelectorAll('.vx-folder')].find(r=>(r.querySelector('.vx-folder-name')||{}).textContent==='공격／수비');return r&&/\bon\b/.test(r.querySelector('.vx-share').className);},null,{timeout:10000});
  assert.equal((await stored()).meta['공격／수비']?.shared,true);
  await page.screenshot({path:path.join(SHOTS,'vault-folder-delete-'+size+'.png')});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('vault-folder-delete ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close?.();
}
