// post.json → 인스타 PNG. 캐러셀(1080×1350) 한 장씩 + 스토리(1080×1920) + caption.txt + preview.png(한눈에 보기).
// 쓰는 법: node instagram/render.mjs [YYYY-MM-DD | 이름] [--recapture]   (instagram/out/<날짜 또는 이름>/post.json 을 읽는다)
// 글이 넘치거나 그림이 없거나 해시태그가 5개를 넘으면 아무것도 지우지 않고 실패로 끝난다 — 메시지대로 post.json 을 고쳐 다시 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {capture,launchChromium,SCENE_NAMES} from './capture.mjs';
import {todayKST} from './plan.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='https://render.process-studio.invalid';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};
export const MAX_HASHTAGS=5,MAX_CAPTION=2200,MAX_SLIDES=10;
const LAYOUTS=['cover','shot','list','steps','term','statement','cta'];

// 그림 참조 → 사이트 경로. shot 은 이 날짜 폴더의 shots/ 에 찍어 둔다.
export function resolveImage(ref,date){
  if(!ref)return null;
  const m=/^(shot|guide|social|out):(.+)$/.exec(ref);if(!m)throw Error('그림 참조는 shot:·guide:·social:·out: 로 시작합니다: '+ref);
  const [,kind,name]=m;if(name.includes('..')||name.startsWith('/'))throw Error('그림 이름이 이상합니다: '+ref);
  if(kind==='shot'){if(!SCENE_NAMES.includes(name))throw Error('없는 장면: '+name+' (가능: '+SCENE_NAMES.join(', ')+')');return {kind,url:'/instagram/out/'+date+'/shots/'+name+'.png',file:path.join(root,'instagram/out',date,'shots',name+'.png'),scene:name};}
  const rel={guide:'guide/img/',social:'social/instagram-carousel/assets/',out:'instagram/out/'+date+'/'}[kind]+name;
  if(!fs.existsSync(path.join(root,rel)))throw Error('그림 파일이 없습니다: '+rel);
  return {kind,url:'/'+rel,file:path.join(root,rel)};
}

export function finalCaption(post){
  const tags=(post.hashtags||[]).map(t=>t.trim()).filter(Boolean);
  return (String(post.caption||'').trim()+(tags.length?'\n\n'+tags.join(' '):'')).trim();
}

export function validate(post,date){
  const errs=[];
  if(!post||typeof post!=='object')return ['post.json 이 비었습니다'];
  if(!Array.isArray(post.slides)||!post.slides.length)errs.push('slides 가 비었습니다');
  else if(post.slides.length>MAX_SLIDES)errs.push('캐러셀은 '+MAX_SLIDES+'장까지입니다 (지금 '+post.slides.length+')');
  (post.slides||[]).forEach((s,i)=>{
    const n=(i+1)+'번 장';
    if(!LAYOUTS.includes(s.layout))errs.push(n+': layout 은 '+LAYOUTS.join('·')+' 중 하나 (지금 '+s.layout+')');
    if(s.layout==='term'){if(!s.ko||!s.def)errs.push(n+': term 은 ko·def 가 필요합니다');}
    else if(s.layout!=='cta'&&!s.title)errs.push(n+': title 이 없습니다');
    if(s.layout==='list'&&!(s.items&&s.items.length))errs.push(n+': list 는 items 가 필요합니다');
    if(s.layout==='steps'&&!(s.steps&&s.steps.length))errs.push(n+': steps 가 필요합니다');
    try{resolveImage(s.image,date);}catch(e){errs.push(n+': '+e.message);}
  });
  if(post.story){if(!post.story.title)errs.push('story.title 이 없습니다');try{resolveImage(post.story.image,date);}catch(e){errs.push('story: '+e.message);}}
  const tags=post.hashtags||[];
  if(!Array.isArray(tags))errs.push('hashtags 는 배열입니다');
  else tags.forEach(t=>{if(!/^#[^\s#]+$/.test(t))errs.push('해시태그 모양이 이상합니다: '+t);});
  const cap=finalCaption(post),count=(cap.match(/(^|\s)#[^\s#]+/g)||[]).length;
  if(!post.caption)errs.push('caption 이 없습니다');
  if(count>MAX_HASHTAGS)errs.push('해시태그는 게시물당 '+MAX_HASHTAGS+'개까지입니다 (본문 포함 '+count+'개)');
  if(cap.length>MAX_CAPTION)errs.push('캡션이 '+MAX_CAPTION+'자를 넘습니다 ('+cap.length+')');
  return errs;
}

async function openTemplate(browser){
  const context=await browser.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:1,locale:'ko-KR',serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
    const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(file),contentType:MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  });
  const page=await context.newPage();
  await page.goto(base+'/instagram/template.html');
  await page.waitForFunction(()=>typeof window.renderSlide==='function');
  return {context,page};
}

async function shoot(page,slide,meta,size,file){
  await page.setViewportSize(size);
  const r=await page.evaluate(({slide,meta})=>window.renderSlide(slide,meta),{slide,meta});
  await page.waitForTimeout(80);
  await (await page.$('#slide')).screenshot({path:file});
  return r;
}

export async function render(date=todayKST(),{recapture=false}={}){
  const dir=path.join(root,'instagram/out',date),postFile=path.join(dir,'post.json');
  if(!fs.existsSync(postFile))throw Error('post.json 이 없습니다: '+path.relative(root,postFile)+' — 먼저 node instagram/plan.mjs '+date+' 로 브리프를 보고 post.json 을 쓰세요.');
  const post=JSON.parse(fs.readFileSync(postFile,'utf8'));
  const errs=validate(post,date);if(errs.length)throw Error('post.json 을 고쳐 주세요:\n- '+errs.join('\n- '));
  // 필요한 앱 화면만 찍는다(이미 있으면 그대로)
  const scenes=[...new Set([...post.slides.map(s=>s.image),post.story&&post.story.image].filter(Boolean).map(r=>resolveImage(r,date)).filter(x=>x.kind==='shot'&&(recapture||!fs.existsSync(x.file))).map(x=>x.scene))];
  if(scenes.length)await capture(scenes,path.join(dir,'shots'));
  for(const f of fs.readdirSync(dir))if(/^(\d\d|story|preview)\.png$/.test(f))fs.rmSync(path.join(dir,f));
  const browser=await launchChromium(),files=[],problems=[];
  try{
    const {context,page}=await openTemplate(browser);
    const prep=s=>{const im=resolveImage(s.image,date);return {...s,imageUrl:im&&im.url,chrome:s.chrome!=null?s.chrome:!!(im&&im.kind!=='shot')};};
    for(let i=0;i<post.slides.length;i++){
      const file=path.join(dir,String(i+1).padStart(2,'0')+'.png');
      const r=await shoot(page,prep(post.slides[i]),{index:i+1,total:post.slides.length},{width:1080,height:1350},file);
      files.push(file);r.problems.forEach(p=>problems.push((i+1)+'번 장: '+p));
    }
    if(post.story){
      const file=path.join(dir,'story.png');
      const r=await shoot(page,{...prep(post.story),layout:'story'},{index:1,total:1},{width:1080,height:1920},file);
      files.push(file);r.problems.forEach(p=>problems.push('스토리: '+p));
    }
    // 한눈에 보기 — 휴대폰에서 한 장으로 훑어볼 수 있게
    const thumbs=files.map(f=>'/'+path.relative(root,f).split(path.sep).join('/'));
    await page.setViewportSize({width:1240,height:800});
    await page.setContent('<body style="margin:0;background:#0d1117;font-family:sans-serif"><div id="sheet" style="display:flex;flex-wrap:wrap;gap:16px;padding:20px;width:1200px;align-items:flex-start">'+
      thumbs.map((t,i)=>'<figure style="margin:0;width:'+(t.endsWith('story.png')?216:288)+'px"><img src="'+base+t+'" style="width:100%;display:block;border-radius:10px"><figcaption style="color:#8b97a5;font-size:14px;margin-top:6px">'+(t.endsWith('story.png')?'스토리':String(i+1).padStart(2,'0'))+'</figcaption></figure>').join('')+'</div></body>');
    await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
    const preview=path.join(dir,'preview.png');await (await page.$('#sheet')).screenshot({path:preview});
    await context.close();
    fs.writeFileSync(path.join(dir,'caption.txt'),finalCaption(post)+'\n');
    return {dir,files,preview,caption:path.join(dir,'caption.txt'),problems};
  }finally{await browser.close();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // 날짜 대신 이름(예: intro)을 주면 instagram/out/<이름>/ 에서 한 번짜리 게시물을 만든다(프로필 고정 소개 등).
  const args=process.argv.slice(2),date=args.find(a=>!a.startsWith('--'))||todayKST();
  if(!/^[A-Za-z0-9][\w-]*$/.test(date))throw Error('폴더 이름은 날짜(YYYY-MM-DD)나 영문·숫자·-·_ 로: '+date);
  render(date,{recapture:args.includes('--recapture')}).then(r=>{
    console.log(JSON.stringify({...r,dir:path.relative(root,r.dir),files:r.files.map(f=>path.relative(root,f)),preview:path.relative(root,r.preview),caption:path.relative(root,r.caption)},null,2));
    if(r.problems.length){console.error('\n넘침·배치 문제 — 문구를 줄이거나 장을 나눠 다시 돌리세요:\n- '+r.problems.join('\n- '));process.exitCode=2;}
  }).catch(e=>{console.error(e.message||e);process.exitCode=1;});
}
