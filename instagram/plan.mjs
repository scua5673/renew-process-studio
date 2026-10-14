// 오늘 올릴 인스타 게시물의 «브리프»를 만든다 — 무엇을(종류·주제·사실), 어떤 그림으로. 문구는 매일 도는 Claude 세션이 쓴다(PLAYBOOK.md).
// 쓰는 법: node instagram/plan.mjs [YYYY-MM-DD] [--kind update|feature|howto|term]   → JSON 을 찍고 instagram/out/<날짜>/brief.json 에 남긴다.
//
// 기억할 상태가 없다: 같은 날짜면 언제 돌려도 같은 브리프가 나온다(세션은 매일 새로 뜬다).
//   요일(한국 시간) → 종류:  월 feature · 화 term · 수 update · 목 howto · 금 term · 토 update · 일 howto
//   update 날은 앞선 며칠(수: 토~화, 토: 수~금)의 배포 안내(origin/main 의 studio/release-notes.js)를 모은다. 하나도 없으면 feature 로.
//   주제 순번 = 주차 × (그 종류의 주간 자리 수) + 자리 — 한 바퀴 돌기 전에는 같은 주제가 다시 나오지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ANCHOR='2026-10-12';   // 0주차 월요일
// 요일(0=일) → [종류, 그 종류 안에서의 주간 자리]. update 가 비면 feature 의 자리(1·2)로 넘어간다.
export const WEEK={1:['feature',0],2:['term',0],3:['update',1],4:['howto',0],5:['term',1],6:['update',2],0:['howto',1]};
export const SLOTS={feature:3,term:2,howto:2};
// update 날이 모으는 배포 안내의 날짜 범위(그날 기준 며칠 전부터 어제까지)
export const UPDATE_LOOKBACK={3:4,6:3};

export function todayKST(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
const DAY=86400000;
const toMs=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))throw Error('날짜는 YYYY-MM-DD: '+d);return Date.parse(d+'T00:00:00Z');};
export const addDays=(d,n)=>new Date(toMs(d)+n*DAY).toISOString().slice(0,10);
export const weekday=d=>new Date(toMs(d)).getUTCDay();
export const weekIndex=d=>Math.floor((toMs(d)-toMs(ANCHOR))/(7*DAY));

// 배포 안내: 배포된 판(origin/main)을 먼저, 없으면 작업 트리. 파일은 UMD — module.exports 로 받는다.
export function loadReleaseEntries({source}={}){
  let code=null,from='';
  if(source){code=fs.readFileSync(source,'utf8');from=source;}
  else{
    try{code=execFileSync('git',['show','origin/main:studio/release-notes.js'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:32*1024*1024});from='origin/main';}catch(_){}
    if(!code){code=fs.readFileSync(path.join(root,'studio/release-notes.js'),'utf8');from='working tree';}
  }
  const sandbox={module:{exports:{}},window:undefined};
  vm.runInNewContext(code,sandbox,{timeout:5000});
  const api=sandbox.module.exports;
  return {from,entries:(api&&typeof api.entries==='function'?api.entries():[]).map(e=>({id:e.id,date:e.date,title:e.title,changes:[...(e.changes||[])]}))};
}

export function updatesFor(date,entries){
  const back=UPDATE_LOOKBACK[weekday(date)];if(!back)return [];
  const from=addDays(date,-back),to=addDays(date,-1);
  return entries.filter(e=>e.date>=from&&e.date<=to).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
}

export function loadTopics(){return JSON.parse(fs.readFileSync(path.join(root,'instagram/topics.json'),'utf8'));}
export function loadTerms(){
  const sandbox={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'studio/football-language.js'),'utf8'),sandbox,{timeout:5000});
  const L=sandbox.window.PS_FOOTBALL_LANGUAGE;
  return {cats:{...L.cats},list:L.list.map(t=>({...t}))};
}
// 용어 사전은 분류 순서로 적혀 있다(경기 상태 7개가 맨 앞) — 성큼성큼(서로소 보폭) 건너 골라 분류가 섞이게 한다.
const gcd=(a,b)=>b?gcd(b,a%b):a;
export function strideOf(len,start=37){let s=start;while(len>1&&gcd(s,len)!==1)s++;return s;}
const pick=(list,kind,week,slot)=>{
  const n=week*SLOTS[kind]+slot,len=list.length,step=kind==='term'?strideOf(len):1;
  const index=(((n*step)%len)+len)%len;return {index,item:list[index]};
};

export function plan(date=todayKST(),{kind:forced,entries,topics=loadTopics(),terms=loadTerms()}={}){
  const wd=weekday(date),week=weekIndex(date);
  let [kind,slot]=WEEK[wd],note='';
  if(forced){if(!['update','feature','howto','term'].includes(forced))throw Error('모르는 종류: '+forced);if(forced!==kind)note='종류를 '+forced+' 로 지정해 만들었습니다(요일 기본은 '+kind+').';kind=forced;}
  const brief={date,weekday:['일','월','화','수','목','금','토'][wd],week,kind,note,hashtags:topics.hashtags};
  if(kind==='update'){
    const src=entries?{from:'given',entries}:loadReleaseEntries();
    let ups=updatesFor(date,src.entries);
    if(!ups.length&&forced){const latest=[...src.entries].sort((a,b)=>a.date<b.date?1:-1)[0];ups=src.entries.filter(e=>latest&&e.date===latest.date);}
    if(ups.length){
      const back=UPDATE_LOOKBACK[wd];
      brief.update={source:src.from,window:back?{from:addDays(date,-back),to:addDays(date,-1)}:null,entries:ups};
      return brief;
    }
    brief.kind=kind='feature';brief.note=(note?note+' ':'')+'이번 범위에 배포 안내가 없어 기능 소개로 넘어갑니다.';
    if(slot===0)slot=1;   // update 자리(1·2)가 곧 feature 의 자리 번호다(지정해서 만든 update 가 비었을 때만 0)
  }
  if(kind==='feature'||kind==='howto'){
    const s=WEEK[wd][0]===kind||WEEK[wd][0]==='update'?slot:0;
    const {index,item}=pick(topics[kind],kind,week,s);
    brief.topic={...item,index,of:topics[kind].length};
  }else if(kind==='term'){
    const s=WEEK[wd][0]==='term'?slot:0;
    const {index,item}=pick(terms.list,'term',week,s);
    brief.term={...item,catName:terms.cats[item.cat]||item.cat,index,of:terms.list.length};
  }
  return brief;
}

export function availableImages(){
  const list=d=>{try{return fs.readdirSync(path.join(root,d)).filter(f=>/\.(png|jpe?g|webp)$/i.test(f)).sort();}catch(_){return [];}};
  return {shot:'node instagram/capture.mjs 의 장면 — render.mjs 가 필요할 때 찍는다',guide:list('guide/img'),social:list('social/instagram-carousel/assets')};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),ki=args.indexOf('--kind');
  const forced=ki>=0?args[ki+1]:undefined,date=args.find(a=>/^\d{4}-\d{2}-\d{2}$/.test(a))||todayKST();
  const brief=plan(date,{kind:forced});
  const {SCENE_NAMES}=await import('./capture.mjs');
  brief.images={...availableImages(),shot:SCENE_NAMES};
  const dir=path.join(root,'instagram/out',date);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'brief.json'),JSON.stringify(brief,null,2));
  console.log(JSON.stringify(brief,null,2));
  console.error('\n브리프: '+path.relative(root,path.join(dir,'brief.json'))+' — 다음: 같은 폴더에 post.json 을 쓰고 node instagram/render.mjs '+date);
}
