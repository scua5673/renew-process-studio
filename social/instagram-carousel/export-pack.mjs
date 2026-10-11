// 프로세스 훈련 세션 팩(커뮤니티 «프로세스» 칸 · packs/NN.json)의 훈련마다 장면 애니메이션을 영상으로 뽑는다.
// 앱의 «영상 내보내기»(훈련 구역 · 1080p · 30fps)를 그대로 쓴다 — 합성 팀 fixture 에서 돌고 운영 서버에는 닿지 않는다.
//   node social/instagram-carousel/export-pack.mjs --issue 3 --out 출력폴더      (훈련 세션 사이트에서 받기)
//   node social/instagram-carousel/export-pack.mjs --pack 03.json --out 출력폴더  (받아 둔 파일)
// 출력: 훈련마다 NN-K.mp4(브라우저에 따라 .webm) + trainings.json(이름·분·코칭 포인트 — make-video.mjs 의 글감)
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp} from '../../tests/fixtures/team-app.mjs';

const PROC_BASE='https://process-letter-sessions.netlify.app/packs/';
const args={};
for(let i=2;i<process.argv.length;i++){const a=process.argv[i];if(a.startsWith('--')){args[a.slice(2)]=process.argv[i+1];i++;}}
if((!args.pack&&!args.issue)||!args.out){console.error('node export-pack.mjs (--issue 3 | --pack 03.json) --out 출력폴더');process.exit(1);}

let pack;
if(args.pack)pack=JSON.parse(fs.readFileSync(args.pack,'utf8'));
else{const nn=String(+args.issue).padStart(2,'0'),r=await fetch(PROC_BASE+nn+'.json');if(!r.ok)throw new Error(PROC_BASE+nn+'.json — '+r.status);pack=await r.json();}
const d=pack&&pack.type==='process-studio-drillpack'&&Array.isArray(pack.drills)&&pack.drills[0];
if(!d||!Array.isArray(d.trainings))throw new Error('훈련 세션 팩이 아니에요');
const lt=d.letter||{},nn=String(+lt.issue||+args.issue||0).padStart(2,'0');
fs.mkdirSync(args.out,{recursive:true});

// 코칭 포인트 줄들(«1. » 같은 번호는 뗀다) — 첫 줄은 영상 설명, 셋까지는 캡션(plan.mjs)
const points=s=>String(s||'').split('\n').map(l=>l.replace(/^\s*(\d+[.)]|[-•·])\s*/,'').trim()).filter(Boolean);
const list=[];
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof window.__animLoad==='function'&&document.getElementById('dfNew'));
  await bf.evaluate(()=>document.getElementById('dfNew').click());
  await bf.waitForSelector('.vcc-item');
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
  await bf.waitForFunction(()=>window.__csView==='board',null,{timeout:10000});
  await page.waitForTimeout(600);

  for(let k=0;k<d.trainings.length;k++){
    const t=d.trainings[k],frames=Array.isArray(t.frames)?t.frames:[];
    const row={file:null,issue:+nn,session:lt.session||d.name||'',theme:lt.theme||'',name:t.name||('훈련 '+(k+1)),minutes:+t.minutes||0,point:points(t.coaching)[0]||'',points:points(t.coaching).slice(0,3),scenes:frames.length};
    list.push(row);
    if(frames.length<2){console.log(`- ${row.name}: 장면이 ${frames.length}개라 영상이 없어요`);continue;}
    if(!await bf.evaluate(fr=>window.__animLoad(fr),frames))throw new Error(row.name+' — 장면을 열지 못했어요');
    await page.waitForTimeout(500);
    // 저장 창은 흉내만 — MP4 는 여기로, WebM 은 내려받기로 온다
    await bf.evaluate(()=>{window.__ev={blob:null};
      window.showSaveFilePicker=async o=>({name:o.suggestedName,remove:async()=>{},createWritable:async()=>({write:async b=>{window.__ev.blob=b;},close:async()=>{}})});});
    await bf.evaluate(()=>{document.getElementById('cmd-export-btn')?.click();document.getElementById('animExport').click();});
    await bf.waitForSelector('#evSheet #evGo');
    await bf.evaluate(()=>{const pick=t=>{const b=[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===t);if(b&&!b.classList.contains('on'))b.click();};
      pick('가로 16:9');pick('훈련 구역');pick('1080p');pick('30fps');});
    const dl=page.waitForEvent('download',{timeout:300000}).catch(()=>null);
    await bf.locator('#evSheet #evGo').click();
    await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='done';},null,{timeout:300000});
    const base=path.join(args.out,`${nn}-${k+1}`);
    const r=await bf.evaluate(async()=>{const b=window.__ev.blob;if(!b)return null;const u=new Uint8Array(await b.arrayBuffer());let s='';
      for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return {type:b.type,b64:btoa(s)};});
    if(r){row.file=base+(/mp4/.test(r.type)?'.mp4':'.webm');fs.writeFileSync(row.file,Buffer.from(r.b64,'base64'));}
    else{const got=await dl;if(!got)throw new Error(row.name+' — 영상이 나오지 않았어요');await got.saveAs(base);
      // 내려받기 이름에 확장자가 없을 때가 있다 — 파일 머리로 가린다(WebM 1A45DFA3 · MP4 ftyp)
      const head=fs.readFileSync(base).subarray(0,12);row.file=base+(head.subarray(4,8).toString()==='ftyp'?'.mp4':'.webm');fs.renameSync(base,row.file);}
    await bf.evaluate(()=>{const b=[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='닫기');if(b)b.click();});
    row.file=path.basename(row.file);
    console.log(`- ${row.name}: ${row.file} (장면 ${frames.length})`);
  }
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
fs.writeFileSync(path.join(args.out,'trainings.json'),JSON.stringify(list,null,2));
console.log(path.join(args.out,'trainings.json'));
