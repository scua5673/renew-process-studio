// 하루 한 편 게시 계획 — make-video.mjs --list 로 만든 영상을 날짜순으로 한 폴더에 모으고, 편마다 캡션을 붙인다.
// 인스타(또는 Meta Business Suite)의 예약 게시에 이 순서·날짜·캡션 그대로 걸면 된다.
//   node social/instagram-carousel/plan.mjs --start 2026-10-12 --time 19:00 --out 예약 ig-03/trainings.json ig-04/trainings.json
//   [--format reel|post] (기본 reel — 훈련마다 -reel.mp4, post 면 -post.mp4)
import fs from 'node:fs';
import path from 'node:path';

const args={_:[]};
for(let i=2;i<process.argv.length;i++){const a=process.argv[i];if(a.startsWith('--')){args[a.slice(2)]=process.argv[i+1];i++;}else args._.push(a);}
if(!args.start||!args.out||!args._.length||!/^\d{4}-\d{2}-\d{2}$/.test(args.start)){
  console.error('node plan.mjs --start 2026-10-12 [--time 19:00] [--format reel|post] --out 예약폴더 ig-03/trainings.json …');process.exit(1);}
const time=/^\d{1,2}:\d{2}$/.test(args.time||'')?args.time:'19:00',kind=args.format==='post'?'post':'reel';

const tag=s=>'#'+String(s||'').replace(/[^\p{L}\p{N}_]/gu,'');
function caption(t){
  const theme=String(t.theme||'').split('›').map(s=>s.trim()).filter(Boolean);
  const pts=(t.points&&t.points.length?t.points:[t.point]).filter(Boolean);
  const tags=[...new Set(['#프로세스스튜디오','#축구훈련','#유소년축구','#축구지도자',...theme.slice(-1).map(tag)])].filter(x=>x.length>1).slice(0,5);
  return [
    `${t.name} ⚽️`,
    '',
    ...(pts.length?['코칭 포인트',...pts.map((p,i)=>`${i+1}. ${p}`),'']:[]),
    [t.minutes?`⏱ ${t.minutes}분`:'',theme.join(' › ')].filter(Boolean).join(' · '),
    t.issue?`프로세스 레터 ${t.issue}호${t.session?` «${t.session}»`:''}의 훈련입니다.`:'',
    '',
    'PROCESS STUDIO 커뮤니티 «프로세스» 칸에서 이 훈련을 내 보관함에 바로 담을 수 있어요.',
    '👉 프로필 링크에서 열기',
    '',
    tags.join(' ')
  ].filter((l,i,a)=>l!==''||(i>0&&a[i-1]!=='')).join('\n').trim()+'\n';
}

const rows=[];
for(const list of args._){
  const dir=path.dirname(list);
  for(const t of JSON.parse(fs.readFileSync(list,'utf8'))){
    if(!t.file)continue;
    const src=path.join(dir,path.basename(t.file,path.extname(t.file))+'-'+kind+'.mp4');
    if(!fs.existsSync(src))throw new Error(src+' 이 없어요 — 먼저 make-video.mjs --list '+list);
    rows.push({t,src});
  }
}
fs.mkdirSync(args.out,{recursive:true});
const day0=new Date(args.start+'T00:00:00Z'),table=[];
rows.forEach(({t,src},i)=>{
  const d=new Date(day0.getTime()+i*864e5),ymd=d.toISOString().slice(0,10),md=ymd.slice(5);
  const base=`${String(i+1).padStart(2,'0')}_${md}_${String(t.name).replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'_')}`;
  fs.copyFileSync(src,path.join(args.out,base+'.mp4'));
  fs.writeFileSync(path.join(args.out,base+'.txt'),caption(t));
  table.push(`| ${i+1} | ${ymd} | ${time} | ${base}.mp4 | ${t.name} |`);
});
fs.writeFileSync(path.join(args.out,'schedule.md'),
  `# 하루 한 편 게시 계획 (${kind==='reel'?'릴스 9:16':'피드 4:5'})\n\n같은 이름의 .txt 가 그 편의 캡션입니다.\n\n| # | 날짜 | 시간 | 파일 | 훈련 |\n| --- | --- | --- | --- | --- |\n${table.join('\n')}\n`);
console.log(`${rows.length}편 — ${args.start}부터 매일 ${time} · ${path.join(args.out,'schedule.md')}`);
