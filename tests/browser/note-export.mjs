import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.265 — 개인 노트 «내보내기»(합성 팀 fixture 에서만):
//  · 위쪽 막대 제목 옆 «내보내기 ▾» → PDF로 저장: 모든 페이지 · 손글씨까지 A4 PDF(노트 방향) · 파일 이름 = 노트 제목
//  · 인쇄 → 원래 A4 인쇄(window.print) · 이미지 저장 → 원래 PNG(지금 페이지)
//  · «노트 선택» 팝오버의 이미지 저장 · A4 인쇄는 숨고 가져오기 · 새 노트는 그대로 · 메모 보기에선 단추가 숨는다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('note-export '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  step('open');
  await page.evaluate(()=>window.__psShowApp('note'));
  const f=await (await page.waitForSelector('#fNote')).contentFrame();
  await f.waitForFunction(()=>window.__psNoteExport&&document.getElementById('nxBtn')&&typeof note!=='undefined'&&note,null,{timeout:30000});
  await f.waitForFunction(()=>{const b=document.getElementById('nxBtn');return b&&b.getBoundingClientRect().width>0;},null,{timeout:15000});
  await f.evaluate(()=>{const t=document.getElementById('nTitle');t.value='화요일 훈련 메모';t.dispatchEvent(new Event('input'));
    const s=document.getElementById('nTpl');s.value='training3vertical_land_v1';s.dispatchEvent(new Event('change'));
    window.__dl=[];const oc=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__dl.push(this.download);return;}return oc.call(this);};
    window.__blobs=[];const ou=URL.createObjectURL;URL.createObjectURL=function(b){try{if(b&&b.type)window.__blobs.push(b);}catch(_){}return ou.call(URL,b);};
    window.__printed=0;window.print=function(){window.__printed++;};});
  await f.waitForFunction(()=>note&&note.orient==='l');

  step('ink');
  const bb=await (await f.$('#cv')).boundingBox();
  await page.mouse.move(bb.x+bb.width*.2,bb.y+bb.height*.3);await page.mouse.down();
  for(let i=1;i<=10;i++)await page.mouse.move(bb.x+bb.width*(.2+i*.04),bb.y+bb.height*(.3+i*.02));
  await page.mouse.up();
  await f.waitForFunction(()=>note.pages[0].strokes&&note.pages[0].strokes.length>0);
  await f.evaluate(()=>document.getElementById('pgAdd').click());
  await f.waitForFunction(()=>note.pages.length===2);

  step('place');
  const place=await f.evaluate(()=>{const b=document.getElementById('nxBtn').getBoundingClientRect(),t=document.getElementById('nTitle').getBoundingClientRect();return {sameRow:Math.abs((b.top+b.bottom)/2-(t.top+t.bottom)/2)<8,after:b.left>=t.right-1};});
  assert.deepEqual(place,{sameRow:true,after:true},'제목 바로 오른쪽');

  step('pdf');
  await f.click('#nxBtn');
  assert.equal(await f.evaluate(()=>document.getElementById('nxWrap').classList.contains('open')),true);
  await f.click('#nxMenu [data-nx="pdf"]');
  await f.waitForFunction(()=>window.__dl.some(n=>/\.pdf$/.test(n))&&window.__blobs.some(b=>b.type==='application/pdf'),null,{timeout:30000});
  const pdf=await f.evaluate(async()=>{const b=window.__blobs.find(b=>b.type==='application/pdf'),u=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
    const busy=document.getElementById('nxBtn').getAttribute('aria-busy');
    return {name:window.__dl.find(n=>/\.pdf$/.test(n)),len:u.length,head:s.slice(0,8),pages:(s.match(/\/Type \/Page /g)||[]).length,land:(s.match(/MediaBox \[0 0 841\.89 595\.28\]/g)||[]).length,jpegW:(s.match(/\/Width (\d+) \/Height (\d+)/)||[]).slice(1).map(Number),busy};});
  assert.equal(pdf.name,'화요일 훈련 메모.pdf');assert.equal(pdf.head,'%PDF-1.4');
  assert.equal(pdf.pages,2,'모든 페이지');assert.equal(pdf.land,2,'노트 방향(가로) A4');
  assert.deepEqual(pdf.jpegW,[2828,2000],'인쇄와 같은 크기(1414×1000 의 두 배)');assert.ok(pdf.len>20000,'그림이 든 파일 '+pdf.len);
  await f.waitForFunction(()=>!document.getElementById('nxBtn').hasAttribute('aria-busy'));
  // 손글씨가 첫 쪽 그림에 들었는지 — 같은 pageCanvas 의 빨강이 아닌 검정 획: 그은 자리 가운데 화소가 종이(흰색)보다 어둡다
  const ink=await f.evaluate(()=>{const c=pageCanvas(0),g=c.getContext('2d'),s=note.pages[0].strokes[0],p=s.pts||s.p||s.points;if(!p||!p.length)return null;const q=p[Math.floor(p.length/2)];
    const x=Math.round((Array.isArray(q)?q[0]:q.x)*2),y=Math.round((Array.isArray(q)?q[1]:q.y)*2),d=g.getImageData(x-2,y-2,5,5).data;let m=255;for(let i=0;i<d.length;i+=4)m=Math.min(m,(d[i]+d[i+1]+d[i+2])/3);return m;});
  if(ink!=null)assert.ok(ink<160,'손글씨가 그림에 든다 '+ink);

  step('print-png');
  await f.click('#nxBtn');await f.click('#nxMenu [data-nx="print"]');
  await f.waitForFunction(()=>window.__printed===1,null,{timeout:15000});
  await f.waitForFunction(()=>note.title==='화요일 훈련 메모',null,{timeout:15000});   // 원래 이미지 저장은 저장된 제목(note.title)을 쓴다
  await f.click('#nxBtn');await f.click('#nxMenu [data-nx="png"]');
  await f.waitForFunction(()=>window.__dl.some(n=>/\.png$/.test(n)),null,{timeout:15000});
  assert.equal(await f.evaluate(()=>window.__dl.find(n=>/\.png$/.test(n))),'화요일 훈련 메모-p2.png','지금 페이지 한 장');

  step('popover');
  await f.click('#nTplBtn');await f.waitForSelector('#nTplPop:not([hidden])');
  const pop=await f.evaluate(()=>{const v=s=>{const e=document.querySelector('#nTplPop .tplp-act[data-click="'+s+'"]');return e?getComputedStyle(e).display:'missing';};return {png:v('pngB'),print:v('printB'),pdfIn:v('pdfB'),vault:v('vaultPdfB'),newB:v('newB')};});
  assert.equal(pop.png,'none');assert.equal(pop.print,'none');
  for(const k of ['pdfIn','vault','newB'])assert.notEqual(pop[k],'none',k+' 은 그대로');
  await page.keyboard.press('Escape').catch(()=>{});

  step('memo');
  assert.equal(await f.evaluate(()=>{document.body.classList.add('memo-mode');const d=getComputedStyle(document.getElementById('nxWrap')).display;document.body.classList.remove('memo-mode');return d;}),'none');

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('note-export ok',engine,size);
}catch(e){console.error('note-export 실패 단계:',cur);throw e;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
