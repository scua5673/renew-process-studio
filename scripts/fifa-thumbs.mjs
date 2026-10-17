// 커뮤니티 «FIFA» 칸 애니메이션 카드의 미리보기 그림(3.074 — 사용자 «카드에 미리보기를 넣어줘»).
//   node scripts/fifa-thumbs.mjs            → studio/fifa-packs/thumbs/NNN-K.svg (팩마다 훈련 K 의 첫 장면)
//   node scripts/fifa-thumbs.mjs 001 002    → 그 세션만
// 그림은 작전판이 보관함 카드 그림을 만드는 함수(window.__snapToThumb)로 짓는다 — 프로세스 칸 카드(studio/packs/thumbs)와 같은 모양.
// 저장소 뿌리를 잠깐 정적 서버로 띄우고 Chromium(Playwright)으로 board.html 을 연다. 그림 주소의 ?v= 는 팩 지문(index.json rev)이라 팩이 바뀌면 그림도 새로 받는다.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'studio','fifa-packs'),out=path.join(dir,'thumbs');
const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.avif':'image/avif'};

export function frameFor(t){ return t.frames&&t.frames.length?t.frames[0].snap:t.snap; }   /* 첫 장면 — 배치와 첫 움직임 화살표가 함께 보인다 */

async function main(){
  const {chromium}=await import('playwright');
  const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
  const want=process.argv.slice(2),list=index.sessions.filter(s=>!want.length||want.includes(s.id));
  const server=http.createServer((q,r)=>{ const p=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));
    if(!p.startsWith(root)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; }
    r.writeHead(200,{'content-type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const exe=process.env.PS_CHROME_PATH||(fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?'/opt/pw-browsers/chromium-1194/chrome-linux/chrome':undefined);
  const b=await chromium.launch(exe?{executablePath:exe}:{});
  try{
    const page=await b.newPage({viewport:{width:1280,height:860}});
    await page.goto('http://127.0.0.1:'+server.address().port+'/studio/board.html',{waitUntil:'load'});
    await page.waitForFunction(()=>typeof window.__snapToThumb==='function',null,{timeout:30000});
    fs.mkdirSync(out,{recursive:true});
    for(const s of list){
      const pk=JSON.parse(fs.readFileSync(path.join(dir,s.id+'.json'),'utf8'));
      const trs=pk.drills[0].trainings;
      for(let k=0;k<trs.length;k++){
        const svg=await page.evaluate(sn=>window.__snapToThumb(sn),frameFor(trs[k]));
        if(typeof svg!=='string'||!svg.startsWith('<svg'))throw Error(s.id+' 훈련 '+(k+1)+': 그림을 만들지 못했습니다');
        fs.writeFileSync(path.join(out,s.id+'-'+(k+1)+'.svg'),svg);
      }
      console.log(s.id+' · 그림 '+trs.length);
    }
  }finally{ await b.close(); server.close(); }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
