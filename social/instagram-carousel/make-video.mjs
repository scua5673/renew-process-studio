// 작전판에서 내보낸 훈련 애니메이션(MP4·WebM)을 인스타 틀에 담는다.
//   캐러셀 영상 장(4:5 · 1080×1350) — 다른 장과 같은 머리글·제목·칩, 화면 자리에 애니메이션
//   릴스(9:16 · 1080×1920) — 제목·코칭 포인트 + 가운데 애니메이션 + 주소
// 한 편: --in 영상 --out 결과.mp4 --title …   ·   팩 전체: --list trainings.json(export-pack.mjs 의 출력) — 훈련마다 캐러셀 장·릴스 둘
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
if(!args.list&&(!args.in||!args.out||!args.title)){
  console.error('node make-video.mjs --in 훈련.mp4 --out 결과.mp4 --title "제목" [--mode post|reel] [--lead 설명] [--chips "U12,4v2,15분"] [--eyebrow ...] [--page "02 / 08"] [--badge 01] [--theme dark] [--url ...] [--fps 30]');
  console.error('node make-video.mjs --list 출력폴더/trainings.json');
  process.exit(1);
}
const fps=Number(args.fps)||30;

async function compose(o,browser){
  const mode=o.mode==='reel'?'reel':'post';
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height:stream_side_data=rotation','-of','json',o.in]).toString());
  const st=probe.streams&&probe.streams[0];if(!st)throw new Error('영상 줄을 찾지 못했어요: '+o.in);
  const rot=Math.abs(Number((st.side_data_list||[]).find(d=>'rotation' in d)?.rotation)||0)%180===90;
  const ar=rot?st.height/st.width:st.width/st.height;

  // ① 틀 한 장 — 영상 자리는 투명하게 뚫려 있다
  const q=new URLSearchParams({mode,ar:String(ar)});
  for(const k of ['eyebrow','title','lead','chips','page','badge','theme','url'])if(o[k])q.set(k,o[k]);
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ps-ig-')),frame=path.join(tmp,'frame.png');
  const page=await browser.newPage({viewport:{width:1080,height:mode==='reel'?1920:1350}});
  await page.goto(pathToFileURL(path.join(here,'video.html')).href+'?'+q);
  await page.evaluate(()=>document.fonts.ready);
  const {x,y,w,h,W,H}=await page.evaluate(()=>window.__hole);
  await page.screenshot({path:frame,omitBackground:true});
  await page.close();

  // ② 영상을 자리 크기로 맞춰 바닥에 깔고, 틀을 위에 덮는다(이미지는 끝까지 마지막 장 그대로)
  const fc=`[0:v]fps=${fps},scale=${w}:${h}:flags=lanczos,setsar=1,pad=${W}:${H}:${x}:${y}:color=0x0d1117[v];[v][1:v]overlay=0:0,format=yuv420p[o]`;
  execFileSync('ffmpeg',['-v','error','-y','-i',o.in,'-i',frame,'-filter_complex',fc,'-map','[o]','-an',
    '-c:v','libx264','-profile:v','high','-preset','slow','-crf','18','-r',String(fps),'-movflags','+faststart',o.out],{stdio:'inherit'});
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`${o.out} — ${W}×${H} (${mode==='reel'?'릴스':'캐러셀'}) · 애니메이션 ${w}×${h}`);
}

// 팩 목록 → 훈련마다 제목(훈련 이름) · 설명(코칭 포인트 첫 줄) · 칩(주제 · 분 · 레터 호)
function fromList(file){
  const dir=path.dirname(file),out=[];
  for(const t of JSON.parse(fs.readFileSync(file,'utf8'))){
    if(!t.file)continue;
    const theme=String(t.theme||'').split('›').pop().trim();
    const chips=[theme,t.minutes?t.minutes+'분':'',t.issue?'레터 '+t.issue+'호':''].filter(Boolean).join(',');
    const base=path.join(dir,path.basename(t.file,path.extname(t.file)));
    const one={in:path.join(dir,t.file),eyebrow:'PROCESS TRAINING',title:t.name,lead:t.point,chips};
    out.push({...one,mode:'post',out:base+'-post.mp4'},{...one,mode:'reel',out:base+'-reel.mp4'});
  }
  return out;
}

const jobs=args.list?fromList(args.list):[{...args,mode:args.mode==='reel'?'reel':'post'}];
const browser=await pw.chromium.launch({executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()});
try{ for(const j of jobs)await compose(j,browser); }
finally{ await browser.close(); }
