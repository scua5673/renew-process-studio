// 작전판에서 내보낸 훈련 애니메이션(MP4·WebM)을 인스타 틀에 담는다.
//   캐러셀 영상 장(4:5 · 1080×1350) — 다른 장과 같은 머리글·제목·칩, 화면 자리에 애니메이션
//   릴스(9:16 · 1080×1920) — 제목·코칭 포인트 + 가운데 애니메이션 + 주소
// 쓰는 법은 README.md. 필요한 것: ffmpeg, playwright(+ 크로미움).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const here=path.dirname(fileURLToPath(import.meta.url));

const args={};
for(let i=2;i<process.argv.length;i++){const a=process.argv[i];if(!a.startsWith('--'))continue;const k=a.slice(2),v=process.argv[i+1];
  if(v===undefined||v.startsWith('--'))args[k]='1';else{args[k]=v;i++;}}
if(!args.in||!args.out||!args.title){
  console.error('node make-video.mjs --in 훈련.mp4 --out 결과.mp4 --title "제목" [--mode post|reel] [--lead 설명] [--chips "U12,4v2,15분"] [--eyebrow ...] [--page "02 / 08"] [--badge 01] [--theme dark] [--url ...] [--fps 30]');
  process.exit(1);
}
const mode=args.mode==='reel'?'reel':'post',fps=Number(args.fps)||30;

const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height:stream_side_data=rotation','-of','json',args.in]).toString());
const st=probe.streams&&probe.streams[0];if(!st)throw new Error('영상 줄을 찾지 못했어요: '+args.in);
const rot=Math.abs(Number((st.side_data_list||[]).find(d=>'rotation' in d)?.rotation)||0)%180===90;
const ar=rot?st.height/st.width:st.width/st.height;

// ① 틀 한 장 — 영상 자리는 투명하게 뚫려 있다
const q=new URLSearchParams({mode,ar:String(ar)});
for(const k of ['eyebrow','title','lead','chips','page','badge','theme','url'])if(args[k])q.set(k,args[k]);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ps-ig-')),frame=path.join(tmp,'frame.png');
const browser=await pw.chromium.launch({executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()});
let hole;
try{
  const page=await browser.newPage({viewport:{width:1080,height:mode==='reel'?1920:1350}});
  await page.goto(pathToFileURL(path.join(here,'video.html')).href+'?'+q);
  await page.evaluate(()=>document.fonts.ready);
  hole=await page.evaluate(()=>window.__hole);
  await page.screenshot({path:frame,omitBackground:true});
}finally{await browser.close();}

// ② 영상을 자리 크기로 맞춰 바닥에 깔고, 틀을 위에 덮는다(이미지는 끝까지 마지막 장 그대로)
const {x,y,w,h,W,H}=hole;
const fc=`[0:v]fps=${fps},scale=${w}:${h}:flags=lanczos,setsar=1,pad=${W}:${H}:${x}:${y}:color=0x0d1117[v];[v][1:v]overlay=0:0,format=yuv420p[o]`;
execFileSync('ffmpeg',['-v','error','-y','-i',args.in,'-i',frame,'-filter_complex',fc,'-map','[o]','-an',
  '-c:v','libx264','-profile:v','high','-preset','slow','-crf','18','-r',String(fps),'-movflags','+faststart',args.out],{stdio:'inherit'});
fs.rmSync(tmp,{recursive:true,force:true});
console.log(`${args.out} — ${W}×${H} (${mode==='reel'?'릴스':'캐러셀'}) · 애니메이션 ${w}×${h}`);
