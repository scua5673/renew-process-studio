import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.255 — 3D 잔디결(합성 팀 fixture 에서만). 실제 경기장 그림(<img> SVG)을 풀어 본다:
//  · 운동장 5개: 카드마다 띠 무늬가 그 카드의 골라인(data-pitch-rect 위)에서 시작, 27개 띠(11인제 · 3.263 — 예전 21) — 가운데 띠가 하프라인에 걸친다
//  · 운동장 1개: 예전 psStMow(골라인에서 5m) 그대로 · 카드 띠 없음
//  · 잎결 타일은 실제 PNG(이음새 없는 256 타일) · 바둑판 원인이던 큰 얼룩 없음
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-grass-mow-3255 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:true});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window.__setTilt&&window.PSStadiumGround,null,{timeout:30000});
  await page.waitForTimeout(800);
  const look=(n,o)=>f.evaluate(async ([n,o])=>{
    const s=captureSnap();s.pitchTheme='grass';s.pitchImg='@real';s.orientation=o;s.spFlip=false;s.players=[];s.drawings=[];s.pitchView='full';s.pitchSpec='fifa';loadSnap(s);
    window.__setPitchN(n);window.__setTilt(true);
    const t0=Date.now();let h=null,src='';
    while(Date.now()-t0<15000){h=document.querySelector('#tiltSurface .tilt-stadium');src=h?decodeURIComponent(h.getAttribute('src')||''):'';
      if(src&&(n>1?/ps-mow-card/.test(src):/id="psStMow" patternUnits="userSpaceOnUse" x=/.test(src)))break;await new Promise(r=>setTimeout(r,200));}
    const cards=[...svg.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>g.getAttribute('data-pitch-rect').split(',').map(Number));
    const pat=id=>{const m=new RegExp('<pattern id="'+id+'"([^>]*)>').exec(src);if(!m)return null;const a={};m[1].replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{a[k]=v;});return a;};
    const grain=/<pattern id="psStGrain"[^>]*><image href="(data:image\/png;base64,[^"]+)"/.exec(src);
    let tile=null;if(grain){const img=new Image();img.src=grain[1];await img.decode();tile={w:img.naturalWidth,h:img.naturalHeight};}
    return {cards,mow:pat('psStMow'),cardPats:cards.map((_,i)=>pat('psStMowC'+i)),cardRects:(src.match(/class="ps-mow-card"/g)||[]).length,grainPat:pat('psStGrain'),tile,grainFill:/fill="url\(#psStGrain\)"/.test(src)};
  },[n,o]);

  for(const o of ['h','v']){
    step('five-'+o);
    const r=await look(5,o);
    assert.equal(r.cards.length,5,'카드 다섯');assert.equal(r.cardRects,5,'카드마다 띠');
    assert.deepEqual(r.mow,{patternUnits:'userSpaceOnUse',width:'1',height:'1'},'경기장 전체 x 줄은 빈 무늬');
    r.cards.forEach((c,i)=>{const p=r.cardPats[i],band=c[3]/27;   /* 3.263 — 약 4m(예전 21) */
      assert.ok(p,'카드 '+i+' 무늬');assert.ok(Math.abs(+p.x-c[0])<.06&&Math.abs(+p.y-c[1])<.06,'골라인에서 시작');
      assert.ok(Math.abs(+p.height-2*band)<.06,'11인제 27개 띠 '+p.height+' vs '+2*band);});
    assert.equal(r.grainPat.patternTransform,'rotate(90)','잎결은 카드의 깎는 방향(x)');
    assert.deepEqual(r.tile,{w:256,h:256});assert.equal(r.grainFill,true);
  }
  step('one');
  const one=await look(1,'h');
  assert.equal(one.cardRects,0);assert.ok(one.mow&&+one.mow.width>1,'운동장 하나는 예전 psStMow 줄');
  assert.equal(one.grainPat.patternTransform,undefined,'잎결은 y(깎는 방향) 그대로');assert.equal(one.grainFill,true);

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('board-grass-mow-3255 ok',engine,size);
}catch(e){console.error('board-grass-mow-3255 실패 단계:',cur);throw e;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
