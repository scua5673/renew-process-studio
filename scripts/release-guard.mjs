import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
/* 3.051 — «판 번호를 깜빡하면 사용자는 영원히 옛 판»을 배포에서 막는다(피드백 TD-4).
   HTML 까지 캐시 우선이라 sw.js 의 CACHE 가 그대로면 서비스워커가 바뀌지 않고, 기기는 새 파일을 받지 않는다.
   그래서 배포(Netlify production — 운영 main · testprocess staging 둘 다) 직전에 지금 사이트의 판 목록(/sw-manifest.json)과
   새 dist 의 목록을 견준다:
     · 판 번호가 같은데 실행 파일이 하나라도 다르면 → 멈춘다(«판 번호를 올리세요»).
     · 새 판 번호가 지금보다 낮으면 → 멈춘다(되돌리기는 Netlify 의 이전 배포 복원으로 — docs/OPERATIONS.md).
   지금 사이트에 목록이 없으면(첫 배포 · 미리보기 · 네트워크 실패) 견주지 않고 지나간다 — 막는 장치가 배포를 막는 고장이 되지 않게. */
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function num(release){ const m=/^process-(\d+)\.(\d+)/.exec(String(release||'')); return m?(+m[1])*1000+(+m[2]):NaN; }
export function compare(live,next){
  if(!live||!live.files||!live.release)return {ok:true,why:'no live manifest'};
  if(!next||!next.files||!next.release)throw Error('dist/sw-manifest.json is missing — run scripts/package-site.mjs first');
  const a=num(live.release),b=num(next.release);
  if(b<a)return {ok:false,why:'새 판 '+next.release+' 이 지금 사이트의 '+live.release+' 보다 낮아요 — 판 번호를 확인하세요(되돌리기는 Netlify 의 이전 배포 복원으로)'};
  if(b>a)return {ok:true,why:live.release+' → '+next.release};
  const changed=[...new Set(Object.keys(live.files).concat(Object.keys(next.files)))].filter(f=>live.files[f]!==next.files[f]).sort();
  if(!changed.length)return {ok:true,why:'같은 판 · 같은 파일 ('+next.release+')'};
  return {ok:false,why:'실행 파일 '+changed.length+'개가 바뀌었는데 판 번호는 '+next.release+' 그대로예요 — sw.js CACHE · app.html PS_BUILD · ?v= · release-notes.js 를 올리세요(docs/OPERATIONS.md §2). 바뀐 파일: '+changed.slice(0,12).join(', ')+(changed.length>12?' …':''),changed};
}
export async function guard({env=process.env,fetcher=fetch,log=console.log}={}){
  if(env.CONTEXT!=='production'){ log('release-guard: production deploys only ('+(env.CONTEXT||'local')+')'); return {ok:true}; }
  const next=JSON.parse(fs.readFileSync(path.join(root,'dist','sw-manifest.json'),'utf8'));
  const site=String(env.URL||'').replace(/\/$/,''); let live=null;
  if(site){ try{ const r=await fetcher(site+'/sw-manifest.json',{headers:{'Cache-Control':'no-cache'}}); if(r.ok)live=await r.json(); else log('release-guard: live manifest '+r.status+' — skipped'); }catch(e){ log('release-guard: live manifest unreachable — skipped ('+e.message+')'); } }
  const v=compare(live,next); log('release-guard: '+v.why);
  if(!v.ok)throw Error(v.why);
  return v;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)guard().catch(e=>{console.error(e.message);process.exitCode=1;});
