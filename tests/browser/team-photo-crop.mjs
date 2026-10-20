import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.125 — 오류 제보 70307dd9 «팀 등록에서 선수 사진을 넣을 때도 보드 토큰처럼 사진 영역(확대 · 좌우 · 위아래)을 편집».
// 사진을 고르면 영역 편집 창이 뜨고, 끌기 · 막대로 정한 정사각형이 그 선수 사진이 된다. 취소하면 아무것도 바뀌지 않는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof openAnalysisTeamLibrary==='function'&&window.PSTeamLibrary);
  await f.evaluate(()=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-crop',name:'사진 FC',players:[{id:'cp1',no:'1',name:'골키퍼',pos:'GK'},{id:'cp2',no:'9',name:'공격수',pos:'ST'}]}]));});
  await f.evaluate(()=>openAnalysisTeamLibrary());await f.waitForSelector('#alManage');await f.click('#alManage');
  const a=await (await page.waitForSelector('#fAnalysis[src]',{state:'attached'})).contentFrame();
  await a.waitForSelector('#teamList button.team');await a.click('#teamList button.team');
  await a.waitForSelector('#playerRows .row .ph');
  // 가로 200 × 세로 100 — 왼쪽 반 빨강 · 오른쪽 반 파랑. 확대 1 · 가운데면 반반이 보인다
  const b64=await a.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=100;const g=c.getContext('2d');g.fillStyle='#ff0000';g.fillRect(0,0,100,100);g.fillStyle='#0000ff';g.fillRect(100,0,100,100);return c.toDataURL('image/png').split(',')[1];});
  const pickFile=async(row)=>{const [ch]=await Promise.all([page.waitForEvent('filechooser'),a.click('#playerRows .row:nth-child('+row+') .ph')]);
    await ch.setFiles({name:'two.png',mimeType:'image/png',buffer:Buffer.from(b64,'base64')});await a.waitForSelector('#psCropDlg[open]',{timeout:15000});};
  // 사진 색: 가운데 한 점의 빨강 · 파랑
  const rowColor=row=>a.evaluate(async row=>{const im=document.querySelector('#playerRows .row:nth-child('+row+') .ph img');if(!im)return null;await (im.decode?im.decode().catch(()=>{}):0);
    const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.drawImage(im,0,0,16,16);const d=g.getImageData(8,8,1,1).data;return {r:d[0],b:d[2],src:im.src.slice(0,23)};},row);

  // 1) 막대로 «좌우» 를 왼쪽 끝 → 빨강만
  await pickFile(1);
  const dlg=await a.evaluate(()=>{const d=document.getElementById('psCropDlg');return {title:d.querySelector('h2').textContent,ranges:[...d.querySelectorAll('input[type=range]')].map(i=>i.getAttribute('aria-label'))};});
  assert.deepEqual(dlg,{title:'선수 사진 영역',ranges:['확대','좌우 자리','위아래 자리']});
  await a.evaluate(()=>{const i=document.querySelector('#psCropDlg [data-k=fx]');i.value='0';i.dispatchEvent(new Event('input'));});
  await page.screenshot({path:path.join(SHOTS,`team-photo-crop-${engine}-${size}-1-dialog.png`)});
  await a.click('#psCropDlg [data-ok]');
  await a.waitForFunction(()=>document.querySelector('#playerRows .row:nth-child(1) .ph img')&&!document.getElementById('psCropDlg'));
  let c1=await rowColor(1);
  assert.equal(c1.src,'data:image/jpeg;base64,','작은 JPEG');
  assert.ok(c1.r>200&&c1.b<60,'왼쪽(빨강)만 '+JSON.stringify(c1));

  // 2) 끌기 — 미리보기를 오른쪽으로 끌면 사진의 왼쪽(빨강)이 보인다 · 확대 2배
  await pickFile(2);
  await a.evaluate(()=>{const i=document.querySelector('#psCropDlg [data-k=zoom]');i.value='2';i.dispatchEvent(new Event('input'));});
  const box=await a.locator('#psCropDlg canvas').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+box.width*0.9,box.y+box.height/2,{steps:8});await page.mouse.up();
  const fx2=await a.evaluate(()=>+document.querySelector('#psCropDlg [data-k=fx]').value);
  assert.ok(fx2<50,'오른쪽으로 끌면 좌우 자리가 왼쪽으로 '+fx2);
  await page.screenshot({path:path.join(SHOTS,`team-photo-crop-${engine}-${size}-2-drag.png`)});
  await a.click('#psCropDlg [data-ok]');
  await a.waitForFunction(()=>document.querySelector('#playerRows .row:nth-child(2) .ph img')&&!document.getElementById('psCropDlg'));
  const c2=await rowColor(2);
  assert.ok(c2.r>200&&c2.b<60,'끌어 맞춘 왼쪽(빨강) '+JSON.stringify(c2));

  // 3) 취소 — 사진 그대로 · 안내
  // 사진이 있는 줄은 «선수 사진» 창이 먼저 뜬다 — «다른 사진으로»
  await a.click('#playerRows .row:nth-child(1) .ph');await a.waitForSelector('#photoDlg[open]');
  const [ch3]=await Promise.all([page.waitForEvent('filechooser'),a.click('#photoReplace')]);
  await ch3.setFiles({name:'two.png',mimeType:'image/png',buffer:Buffer.from(b64,'base64')});
  await a.waitForSelector('#psCropDlg[open]',{timeout:15000});await a.click('#psCropDlg [data-cancel]');
  await a.waitForFunction(()=>!document.getElementById('psCropDlg'));
  await a.waitForFunction(()=>/사진을 넣지 않았습니다/.test(document.getElementById('status').textContent));
  c1=await rowColor(1);assert.ok(c1.r>200&&c1.b<60,'취소하면 앞 사진 그대로');

  // 저장 → 이 기기 표에 둘
  await a.click('button[type=submit]');
  await a.waitForFunction(()=>/^기기에 저장했습니다\./.test(document.getElementById('status').textContent));
  const kept=await a.evaluate(async()=>{const m=JSON.parse((await storage.get('cs_team_photos_v1')).value);return Object.keys(m.teams['lib-crop']||{}).sort();});
  assert.deepEqual(kept,['cp1','cp2']);
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({ok:true,engine,size,c1,c2,fx2}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
