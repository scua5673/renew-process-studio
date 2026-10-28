// 3.203 — 선수단 «＋ 여러 명 추가»(한 줄에 한 명 · 붙여 넣기 · 새 조) · 뎁스 판 선수 끌기(포지션 · 순서 · 되돌리기) · 판 편집(포지션 카드 줄 옮기기 · ＋ 포지션).
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS,WT,A} from '../fixtures/team-app.mjs';
const fx=await startFixture(),browsers={},engine=process.env.PS_BROWSER_ENGINE||'chromium';
const shots=process.env.PS_SHOTS_DIR||SHOTS;
try{
  const app=await openApp(fx,'desktop',{browsers}),{page}=app,errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator('#teamNav [data-team-key="players"]').click();
  const frame=await (await page.waitForSelector('#fScout')).contentFrame();
  await frame.locator('#pwTeam .pw-depth-pitch').waitFor();
  const roster=()=>frame.evaluate(()=>({players:data.players.filter(p=>p.type!=='target').map(p=>({id:p.id,name:p.name,num:p.num,posId:p.posId||'',grp:p.grp||''})),positions:data.positions.map(p=>({id:p.id,name:p.name})),meta:JSON.parse(JSON.stringify(data.meta||{}))}));
  const before=await roster();assert.equal(before.players.length,18);

  // 1) 여러 명 한 번에 추가 — 붙여 넣기로 줄이 채워지고 새 조는 저장 때 만든다
  await frame.getByRole('button',{name:'＋ 여러 명 추가',exact:true}).click();
  const sheet=frame.locator('.pw-bulk-overlay');await sheet.waitFor();
  assert.equal(await sheet.locator('.pw-bulk-row').count(),3);
  await sheet.locator('.pw-bulk-row [data-f="name"]').first().evaluate(el=>{const dt=new DataTransfer();dt.setData('text/plain','김민재 CB A팀 4\n이강인\tAM\tB팀\t7\n정우영, DM, C팀\n가상 선수 1\tGK\tA팀\t1');el.focus();el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
  const rowNames=async()=>sheet.locator('.pw-bulk-row [data-f="name"]').evaluateAll(els=>els.map(e=>e.value));
  assert.deepEqual(await rowNames(),['김민재','이강인','정우영','가상 선수 1','']);
  assert.equal(await sheet.locator('.pw-bulk-row').nth(0).locator('[data-f="posId"]').inputValue(),'pos_CB');
  assert.equal(await sheet.locator('.pw-bulk-row').nth(1).locator('[data-f="grpKey"]').inputValue(),'B팀');
  assert.match(await sheet.locator('.pw-bulk-row').nth(2).locator('[data-f="grpKey"]').inputValue(),/^__new/,'없는 조는 새 조로');
  assert.match(await sheet.locator('.pw-bulk-sum').innerText(),/3명 추가.*건너뜀/s,'이미 있는 «가상 선수 1 · 1번»은 건너뛴다');
  // 마지막 빈 줄에 손으로 한 명 더(포지션 · 조 고르기)
  await sheet.locator('.pw-bulk-row').nth(4).locator('[data-f="name"]').fill('황희찬');
  await sheet.locator('.pw-bulk-row').nth(4).locator('[data-f="posId"]').selectOption('pos_RW');
  await sheet.locator('.pw-bulk-row').nth(4).locator('[data-f="grpKey"]').selectOption('A팀');
  await sheet.locator('.pw-bulk-row').nth(4).locator('[data-f="num"]').fill('11');
  assert.equal(await sheet.locator('.pw-bulk-row').count(),6,'이름을 치면 빈 줄이 하나 더 붙는다');
  assert.equal(await sheet.locator('[data-ok]').innerText(),'4명 추가');
  await page.screenshot({path:path.join(shots,'bulk-sheet-'+engine+'.png')});
  await sheet.locator('[data-ok]').click();
  await sheet.waitFor({state:'detached'});
  const after=await roster();
  assert.equal(after.players.length,22);
  const byName=Object.fromEntries(after.players.map(p=>[p.name,p]));
  assert.equal(byName['김민재'].posId,'pos_CB');assert.equal(byName['김민재'].grp,'A팀');assert.equal(byName['김민재'].num,'4');
  assert.equal(byName['이강인'].grp,'B팀');assert.equal(byName['황희찬'].posId,'pos_RW');assert.equal(byName['황희찬'].num,'11');
  const newKey=byName['정우영'].grp;assert.match(newKey,/^grp/);assert.equal(after.meta.grpLabels[newKey],'C팀');assert.ok(after.meta.grpBase.includes(newKey));
  assert.equal(after.players.filter(p=>p.name==='가상 선수 1').length,1,'같은 이름 · 번호는 안 늘어난다');
  await frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="pos_CB"] .pw-depth-name:has-text("김민재")').waitFor();
  await page.waitForTimeout(700); // scout.html 의 400ms 지연 renderTeam(__tmWaitT) 이 지나간 뒤에 끈다

  /* 판을 화면 안으로 — Playwright 마우스는 뷰포트 밖 좌표엔 이벤트를 못 보낸다(CI 글꼴이 달라 판이 아래로 밀리면 끌기가 조용히 안 된다) */
  async function showPitch(){await frame.evaluate(()=>document.querySelector('#pwTeam .pw-depth-pitch').scrollIntoView({block:'start'}));await page.waitForTimeout(250);}
  /* 3.205 — 느린 WebKit 은 여러 명 추가 뒤의 지연 재그리기가 700ms 를 넘겨 막 찾은 요소가 바뀐다(boundingBox null) — 보일 때까지 다시 찾는다 */
  async function box(loc){for(let i=0;i<40;i++){const b=await loc.boundingBox().catch(()=>null);if(b)return b;await page.waitForTimeout(100);}return null;}
  function inView(b,what){const vp=page.viewportSize();assert.ok(b&&b.y>=0&&b.y+b.height<=vp.height&&b.x>=0&&b.x+b.width<=vp.width,what+' 가 화면 안에 있어야 한다 '+JSON.stringify(b)+' / '+JSON.stringify(vp));}
  /* 끌기: 마우스를 옮긴 뒤 표식이 보일 때까지 1px 씩 흔들며 기다린다(느린 실행기에서 마지막 move 와 검사 사이에 그림이 늦는다) */
  async function dragTo(from,to,seen){
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(from.x+12,from.y+6,{steps:3});
    await page.mouse.move(to.x,to.y,{steps:6});
    for(let i=0;i<20;i++){if(await seen())return true;await page.mouse.move(to.x+(i%2?1:-1),to.y,{steps:1});await page.waitForTimeout(100);}
    return false;
  }
  // 2) 선수 끌기: LB 의 가상 선수 6 → CM 2번째. 되돌리기로 제자리.
  const src=frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="pos_LB"] .pw-depth-name',{hasText:'가상 선수 6'}).first();
  const cmSlot=frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="pos_CM"]');
  const cmNames=cmSlot.locator('.pw-depth-name');
  const cmBefore=await cmNames.evaluateAll(els=>els.map(e=>e.querySelector('strong').textContent));
  assert.ok(cmBefore.length>=2,'CM 에 둘 이상');
  await showPitch();
  const sb=await box(src),t1=await box(cmNames.nth(1));inView(sb,'LB 의 가상 선수 6');inView(t1,'CM 2번째');
  const marked=await dragTo({x:sb.x+sb.width/2,y:sb.y+sb.height/2},{x:t1.x+t1.width/2,y:t1.y+4},()=>cmSlot.evaluate(el=>el.classList.contains('is-dropping')&&!!el.querySelector('.pw-depth-drop')));
  assert.equal(marked,true,'놓을 칸이 켜지고 선이 보인다');
  assert.equal(await frame.locator('.pw-depth-ghost').count(),1);
  await page.mouse.up();
  await frame.locator('.pw-undo').waitFor();
  const moved=await roster();
  assert.equal(moved.players.find(p=>p.name==='가상 선수 6').posId,'pos_CM');
  const cmOrder=moved.players.filter(p=>p.posId==='pos_CM').map(p=>p.name);
  assert.equal(cmOrder[1],'가상 선수 6',JSON.stringify(cmOrder));
  assert.equal(await frame.locator('.pw-depth-ghost').count(),0);
  assert.equal(await frame.locator('#pwDrawer[open]').count(),0,'끌기가 상세창을 열지 않는다');
  await page.screenshot({path:path.join(shots,'depth-dropped-'+engine+'.png')});
  await frame.locator('.pw-undo button').click();
  await frame.waitForFunction(()=>data.players.find(p=>p.name==='가상 선수 6').posId==='pos_LB');
  const back=await roster();
  assert.deepEqual(back.players.filter(p=>p.posId==='pos_CM').map(p=>p.name),cmBefore,'되돌리면 CM 차례도 그대로');

  // 3) 판 편집: AM 카드를 FW 줄 CF 와 RW 사이로. 저장 모양은 meta.depthRows.
  await page.waitForTimeout(700);
  await frame.getByRole('button',{name:'판 편집',exact:true}).click();
  await frame.locator('#pwTeam .pw-depth-slot.is-editing').first().waitFor();
  await page.waitForTimeout(300);
  const fwRow=frame.locator('#pwTeam .pw-depth-line[data-pw-row="0"]');
  const fwBefore=await fwRow.locator('.pw-depth-slot').evaluateAll(els=>els.map(e=>e.dataset.pwSlot));
  assert.ok(fwBefore.length<=4&&fwBefore.includes('pos_CF'));
  const amHead=frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="pos_AM"] .pw-depth-slothead');
  await showPitch();
  const hb=await box(amHead),rw=await box(fwRow.locator('.pw-depth-slot[data-pw-slot="pos_RW"]'));inView(hb,'AM 카드 머리');inView(rw,'RW 카드');
  assert.equal(await dragTo({x:hb.x+hb.width/2,y:hb.y+hb.height/2},{x:rw.x+8,y:rw.y+40},async()=>(await fwRow.locator('.pw-depth-placeholder').count())===1),true,'들어갈 자리가 보인다');
  await page.mouse.up();
  await frame.waitForFunction(()=>Array.isArray((data.meta||{}).depthRows)&&data.meta.depthRows[0].includes('pos_AM'));
  const laid=await roster();
  assert.deepEqual(laid.meta.depthRows[0].filter(id=>id!=='pos_AM'),fwBefore);
  assert.equal(laid.meta.depthRows[0].indexOf('pos_AM'),fwBefore.indexOf('pos_RW'),'RW 바로 앞');
  assert.ok(laid.meta.depthRows.every(r=>r.length<=4));
  assert.deepEqual(await fwRow.locator('.pw-depth-slot').evaluateAll(els=>els.map(e=>e.dataset.pwSlot)),laid.meta.depthRows[0]);
  await page.waitForTimeout(700);
  // 가득 찬 줄에는 못 넣는다
  const dmHead=frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="pos_DM"] .pw-depth-slothead');
  await showPitch();
  const db=await box(dmHead),cf=await box(fwRow.locator('.pw-depth-slot[data-pw-slot="pos_CF"]'));inView(db,'DM 카드 머리');inView(cf,'CF 카드');
  assert.equal(await dragTo({x:db.x+db.width/2,y:db.y+db.height/2},{x:cf.x+8,y:cf.y+40},()=>fwRow.evaluate(el=>el.classList.contains('is-full'))),true,'가득 찬 줄은 빨간 점선');
  await page.mouse.up();
  assert.deepEqual((await roster()).meta.depthRows,laid.meta.depthRows,'가득 찬 줄로의 끌기는 저장을 바꾸지 않는다');

  // 4) ＋ 포지션: 우리 팀 포지션(이름 · 줄임말) → positions 에 생기고 그 줄 카드로 보인다
  await frame.evaluate(()=>{window.__pwRowsBefore=JSON.stringify(data.meta.depthRows);});
  const addBtns=frame.locator('#pwTeam .pw-depth-addpos');
  const addRow=await addBtns.first().getAttribute('data-pw-addpos');
  await addBtns.first().click();
  const form=frame.locator('[data-k="name"]').first();await form.waitFor();
  await form.fill('좌측 풀백');await frame.locator('[data-k="abbr"]').fill('lfb');
  await frame.locator('button[data-act="ok"]').click();
  await frame.waitForFunction(()=>data.positions.some(p=>p.name==='좌측 풀백'));
  const withPos=await roster();
  const np=withPos.positions.find(p=>p.name==='좌측 풀백');
  assert.equal(withPos.meta.posAbbr[np.id],'LFB');
  assert.ok(withPos.meta.depthRows[+addRow].includes(np.id),'고른 줄에 들어간다');
  await frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="'+np.id+'"] .pw-depth-slothead b:has-text("LFB")').waitFor();
  await page.screenshot({path:path.join(shots,'depth-edit-'+engine+'.png')});
  // 이름 바꾸기(⋯)
  await frame.locator('#pwTeam .pw-depth-slot[data-pw-slot="'+np.id+'"] .pw-depth-posmenu').click();
  await frame.locator('[data-k="name"]').first().fill('왼쪽 풀백');await frame.locator('[data-k="abbr"]').fill('');
  await frame.locator('button[data-act="ok"]').click();
  await frame.waitForFunction(()=>data.positions.some(p=>p.name==='왼쪽 풀백'));
  assert.equal((await roster()).meta.posAbbr[np.id],undefined,'줄임말을 비우면 자동(posAbbr)');
  await frame.getByRole('button',{name:'판 편집 끝',exact:true}).click();
  await frame.waitForFunction(()=>!document.querySelector('#pwTeam .pw-depth-slot.is-editing'));
  assert.equal(await frame.locator('#pwTeam .pw-depth-addpos').count(),0);
  // 3.205 — 줄마다 자리 넷: 카드 폭은 모두 같고(줄의 1/4 — 넷 든 줄이 줄 폭을 채운다), 혼자인 GK 는 줄 가운데
  await showPitch();
  const widths=await frame.locator('#pwTeam .pw-depth-slot').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().width)));
  assert.ok(widths.length>=8&&Math.max(...widths)-Math.min(...widths)<=2,'카드 폭이 다 같다 '+widths.join(','));
  const gkSlot=frame.locator('#pwTeam .pw-depth-slot',{has:frame.locator('.pw-depth-slothead b',{hasText:/^GK$/})}).first();
  const gkLine=gkSlot.locator('xpath=ancestor::section[contains(@class,"pw-depth-line")]');
  assert.equal(await gkLine.locator('.pw-depth-slot').count(),1,'GK 는 혼자인 줄');
  const gb=await box(gkSlot),lb=await box(gkLine.locator('.pw-depth-slots'));
  assert.ok(Math.abs((gb.x+gb.width/2)-(lb.x+lb.width/2))<=3,'혼자인 GK 는 줄 가운데 '+JSON.stringify([gb,lb]));
  assert.ok(gb.width<lb.width/3&&gb.width>lb.width/6,'GK 카드도 넷 든 줄과 같은 폭(줄의 1/4) '+gb.width+'/'+lb.width);

  // 5) 스카우팅 «＋ 여러 명» — 등록부에 들어가고 포지션을 고른 후보는 배치된다
  await page.locator('#teamNav [data-team-key="scouting"]').click().catch(()=>{});
  const scoutBtn=frame.getByRole('button',{name:'＋ 여러 명',exact:true});
  if(await scoutBtn.count()){
    await scoutBtn.click();
    const sc=frame.locator('.pw-bulk-overlay.pw-bulk-scout');await sc.waitFor();
    await sc.locator('.pw-bulk-row').nth(0).locator('[data-f="name"]').fill('가상 후보 하나');
    await sc.locator('.pw-bulk-row').nth(0).locator('[data-f="posId"]').selectOption('pos_CM');
    await sc.locator('.pw-bulk-row').nth(0).locator('[data-f="club"]').fill('가상 유나이티드');
    await sc.locator('.pw-bulk-row').nth(0).locator('[data-f="grade"]').selectOption('B');
    await sc.locator('.pw-bulk-row').nth(1).locator('[data-f="name"]').fill('가상 후보 둘');
    await sc.locator('[data-ok]').click();
    await sc.waitFor({state:'detached'});
    await frame.waitForFunction(()=>data.players.some(p=>p.type==='target'&&p.name==='가상 후보 하나'&&p.posId==='pos_CM'));
    const reg=await frame.evaluate(()=>{const c=scStore().state.doc.scoutRegistry.candidates;return Object.values(c).filter(x=>/가상 후보/.test(x.info.name)).map(x=>[x.info.name,x.info.club,x.info.grade]).sort();});
    assert.deepEqual(reg,[['가상 후보 둘','',''],['가상 후보 하나','가상 유나이티드','B']]);
  }
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[]);
  console.log(JSON.stringify({ok:true,engine,added:after.players.length-before.players.length}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
