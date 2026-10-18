// 커뮤니티 «FIFA» 칸의 훈련 애니메이션(3.072 — 사용자 «FIFA 훈련들을 애니메이션으로 전부 만들고 싶어» → 시범 5개 먼저).
//   node scripts/fifa-scenes.mjs 001 002   → studio/fifa-packs/001.json … · studio/fifa-packs/index.json 의 그 줄
//   node scripts/fifa-scenes.mjs --all     → scripts/fifa-scenes/*.mjs 전부
// 세션 하나 = scripts/fifa-scenes/NNN.mjs. FIFA 훈련센터 페이지의 배치(인원 · 크기 · 규칙)만 참고해 우리 작전판으로 새로 그리고,
// 설명 · 코칭 포인트 · 자막은 우리말로 새로 쓴다(FIFA 글 · 그림은 옮기지 않는다). 카드와 뷰어에 «FIFA Training Centre 참고 · 원문 링크»가 남는다.
// 판(운동장 · 장비 · 선)은 spec 에서 짓고, 장면 → 재생 장면(frames)은 프로세스 칸과 같은 proc-scenes.mjs 의 buildFrames 를 쓴다.
//
// spec 모양(NNN.mjs 의 default):
//   { path: 'elite-sessions/…/x.php',  ← community-fifa.js ROWS 의 경로와 같아야 한다
//     name: '세션 이름(우리말)', focus: 'bpo',   ← board FOCUS 키: warm bp poss bpo tr_att tr_def set phys tech rec
//     trainings: [{
//       name, minutes, focus?, pitch: 'grid30'|'grid20'|'grid45'|'u12'|'futsal'|'fifa', tokenScale?, marks?(false = 운동장 라인 · 골을 그리지 않는다),
//       players: [{id:101, team:'blue'|'red'|'yellow', num:'1', gk:true?, x, y}],   ← 첫 장면의 자리
//       equipment: [{type:'cone'|'marker'|'minigoalV'|'goalV'|'dummy'|'pole', x, y, rot?, scale?, color?}],
//       lines: [{rect:[x1,y1,x2,y2]} | {line:[x1,y1,x2,y2], dash?:true}],
//       ball: [x, y],
//       method: '훈련 방법(우리말)', coaching: '코칭 포인트(우리말)',
//       scale?, lw?, dur?, runs?,   ← proc-scenes 와 같은 뜻
//       scenes: [{pos, ball, dir, hl, cap, dur, curves, air, shot, arrows}] ← proc-scenes/NN.mjs 와 같은 장면 문법 }]}
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildFrames,rev} from './proc-scenes.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'studio','fifa-packs');
const specs=path.join(root,'scripts','fifa-scenes');
export const BASE='https://www.fifatrainingcentre.com/en/practice/';
export const PITCHES=['grid20','grid30','grid45','u12','futsal','fifa'];
export const EQUIP=['cone','marker','minigoalV','goalV','dummy','pole','ladder','hurdle','minihurdle','ball'];
export const FOCUS=['warm','bp','poss','bpo','tr_att','tr_def','set','phys','tech','rec'];
/* 3.079 — 세부 국면(사용자 «세부 국면도 선택할 수 있게»). 작전판 편집기의 경기 국면 기본 골격(EP_STD_MOMENTS)과 같은 id · 이름.
   spec.subs = ['std_ao_3', …] → 팩의 gmPhases · gmPhaseNames(보관함에 담으면 편집기의 경기 국면 칩이 켜진 채로) · 목록 줄의 subs(커뮤니티 고르개) */
export const SUBS={std_ao_1:'공격 조직 › 빌드업',std_ao_2:'공격 조직 › 전진 · 전개',std_ao_3:'공격 조직 › 침투 · 마무리',
  std_do_1:'수비 조직 › 전방 압박',std_do_2:'수비 조직 › 미드 블록',std_do_3:'수비 조직 › 로우 블록',
  std_dt_1:'공격 → 수비 전환 › 즉시 반응 (역압박)',std_dt_2:'공격 → 수비 전환 › 후퇴 · 재정비',
  std_at_1:'수비 → 공격 전환 › 빠른 역습',std_at_2:'수비 → 공격 전환 › 점유 안정화',
  std_set_1:'세트피스 › 공격 세트피스',std_set_2:'세트피스 › 수비 세트피스'};
const clone=o=>JSON.parse(JSON.stringify(o));
const num=(v,lo,hi)=>typeof v==='number'&&isFinite(v)&&v>=lo&&v<=hi;
const xy=(v,what)=>{ if(!Array.isArray(v)||v.length!==2||!num(v[0],0,1110)||!num(v[1],0,740))throw Error(what+': 판 안의 [x, y] 가 아닙니다 — '+JSON.stringify(v)); return v; };

/* 판의 나머지 칸 — 프로세스 칸 팩(studio/packs/02.json 첫 훈련)과 같은 값 */
const TEMPLATE={teamColors:{blue:'#3a6df0',red:'#e5484d',yellow:'#ffd23f'},gkColors:{blue:'#3a6df0',red:'#e5484d'},teamColor2:{},teamPattern:{},teamStrokeC:{},teamTxtC:{},
  gkColor2:{},gkPattern:{},gkStrokeC:{},gkTxtC:{},orientation:'h',area:'full',pitchView:'full',pvSide:'own',fieldMode:'standard',halfSide:'L',gridType:'off',
  label:'num',lines:false,boardLocked:false,spFlip:false,tokenScale:1,pitchN:1,press:null,spMarks:null,spMark:null,pitchImg:null,matchNote:'',pitchTheme:'',
  pitchCustom:null,tokShape:'shaper',chip3d:false,grassM:0,trainGridM:'def',ballStyle:'1970',grassTone:'0|0',tokV:2};
const TOKEN_SCALE={grid20:1.2,grid30:1.015,grid45:.933,u12:.667,futsal:.6,fifa:.6};

export function snapOf(t,where){
  if(!PITCHES.includes(t.pitch))throw Error(where+': pitch 는 '+PITCHES.join(' · ')+' 중 하나');
  if(!Array.isArray(t.players)||!t.players.length)throw Error(where+': players 가 비었습니다');
  const ids=new Set();
  const players=t.players.map((p,i)=>{
    if(!Number.isInteger(p.id)||ids.has(p.id))throw Error(where+': 선수 번호가 겹치거나 정수가 아닙니다 — '+p.id); ids.add(p.id);
    if(!['blue','red','yellow'].includes(p.team))throw Error(where+': 팀은 blue · red · yellow — '+p.team);
    xy([p.x,p.y],where+' 선수 '+p.id);
    return {id:p.id,team:p.team,num:p.num==null?'':String(p.num),pos:p.gk?'GK':'',x:p.x,y:p.y,color:null,trail:1}; });
  const equipment=(t.equipment||[]).map((e,i)=>{
    if(!EQUIP.includes(e.type))throw Error(where+': 장비는 '+EQUIP.join(' · ')+' — '+e.type);
    xy([e.x,e.y],where+' 장비 '+i);
    return {id:900+i,team:e.type,x:e.x,y:e.y,color:e.color||null,src:null,rot:e.rot||0,scale:e.scale||(e.type==='cone'?.5:1)}; });
  const drawings=(t.lines||[]).map((l,i)=>{
    if(l.rect){ xy(l.rect.slice(0,2),where+' 선 '+i); xy(l.rect.slice(2),where+' 선 '+i);
      return {type:'rectline',color:'#ffffff',lw:1.22,op:.8,pts:[{x:l.rect[0],y:l.rect[1]},{x:l.rect[2],y:l.rect[3]}]}; }
    if(l.line){ xy(l.line.slice(0,2),where+' 선 '+i); xy(l.line.slice(2),where+' 선 '+i);
      const d={type:'line',color:'#ffffff',lw:1,op:.6,pts:[{x:l.line[0],y:l.line[1]},{x:l.line[2],y:l.line[3]}]}; if(l.dash)d.dash=true; return d; }
    throw Error(where+': 선은 {rect:[…]} 또는 {line:[…]}'); });
  const ball=xy(t.ball,where+' 공');
  /* 운동장 라인 · 골(lines) — 8인제 · 풋살 · 11인제는 그리고, 그리드 판은 원래 없다. marks:false 면 운동장 일부만 쓰는 훈련(직접 그린 칸)이라 끈다 */
  const marks=!t.pitch.startsWith('grid')&&t.marks!==false;
  return {pitchSpec:t.pitch,players,equipment,ball:{x:ball[0],y:ball[1],scale:.62,trail:1},drawings,...clone(TEMPLATE),lines:marks,tokenScale:t.tokenScale||TOKEN_SCALE[t.pitch]};
}

export function packOf(spec,id){
  if(typeof spec.path!=='string'||!/^[a-z0-9][a-z0-9_\-\/]*\.php$/.test(spec.path))throw Error(id+': path 가 없습니다');
  if(!spec.name)throw Error(id+': name 이 없습니다');
  if(!FOCUS.includes(spec.focus))throw Error(id+': focus 는 '+FOCUS.join(' · '));
  if(!Array.isArray(spec.trainings)||spec.trainings.length<1||spec.trainings.length>6)throw Error(id+': 훈련은 1~6개');
  const subs=spec.subs==null?[]:spec.subs;
  if(!Array.isArray(subs)||subs.length>3||new Set(subs).size!==subs.length||!subs.every(k=>Object.prototype.hasOwnProperty.call(SUBS,k)))throw Error(id+': subs 는 '+Object.keys(SUBS).join(' · ')+' 중 0~3개');
  const gm=()=>({gmPhases:subs.slice(),gmPhaseNames:subs.map(k=>SUBS[k])});
  const trainings=spec.trainings.map((t,i)=>{
    const where=id+' 훈련 '+(i+1);
    if(!t.name||!num(t.minutes,1,120))throw Error(where+': name · minutes');
    if(!t.method||!t.coaching)throw Error(where+': method · coaching(우리말 설명)이 없습니다');
    if(!Array.isArray(t.scenes)||t.scenes.length<4||t.scenes.length>40)throw Error(where+': 장면은 4~40개');
    t.scenes.forEach((sc,k)=>{ if(sc.ball)xy(sc.ball,where+' 장면 '+(k+1)+' 공'); for(const [pid,v] of Object.entries(sc.pos||{}))xy(v,where+' 장면 '+(k+1)+' 선수 '+pid); });
    const snap=snapOf(t,where);
    const frames=buildFrames(snap,t,{scale:t.scale||1,lw:t.lw||1,dur:t.dur||1.2,runs:t.runs||null});
    return {type:'train',name:t.name,minutes:t.minutes,sets:1,rpe:t.rpe||5,focus:t.focus||spec.focus,...gm(),memoQuick:'',overview:'',
      method:t.method,spDesc:t.method,setup:'',func:'',coaching:t.coaching,prog:'',tags:[],sp:null,spCall:'',snap:clone(frames[0].snap),frames,animIdx:0};
  });
  const drill={name:spec.name,type:'train',snap:clone(trainings[0].snap),trainings,frames:clone(trainings[0].frames),
    minutes:trainings.reduce((a,t)=>a+t.minutes,0),sets:1,focus:spec.focus,...gm(),rpe:5,tags:[],method:'',coaching:'',
    fifa:{path:spec.path,url:BASE+spec.path,by:spec.by||''}};
  return {type:'process-studio-drillpack',version:1,date:'2026-10-17T00:00:00.000Z',source:'fifa',drills:[drill]};
}

/* 목록은 팩 파일들에서 다시 짓는다(읽고 고쳐 쓰지 않는다) — 여러 사람이 동시에 지어도 마지막에 쓴 목록이 그때 있는 팩 전부를 담는다 */
export function rowOf(id,text){ const d=JSON.parse(text).drills[0];
  /* 3.075 — 커뮤니티 공통 분류: 주제(작전판 FOCUS)와 인원(훈련마다 판 위 선수 수의 가장 작은 ~ 가장 큰 값) */
  const ns=d.trainings.map(t=>t.snap.players.length);
  return {id,path:d.fifa.path,rev:rev(text),focus:d.focus,...((d.gmPhases||[]).length?{subs:d.gmPhases.slice()}:{}),players:[Math.min(...ns),Math.max(...ns)],trainings:d.trainings.map(t=>({name:t.name,minutes:t.minutes,scenes:t.frames.length}))}; }
export function indexOf(){
  const ids=fs.readdirSync(out).filter(f=>/^\d{3}\.json$/.test(f)).map(f=>f.slice(0,3)).sort();
  return {type:'process-studio-fifa-index',version:1,sessions:ids.map(id=>rowOf(id,fs.readFileSync(path.join(out,id+'.json'),'utf8')))};
}
function writeIndex(){ const f=path.join(out,'index.json'),tmp=f+'.'+process.pid+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(indexOf())); fs.renameSync(tmp,f); }
export async function build(id,{write=true}={}){
  if(!/^\d{3}$/.test(id))throw Error('번호는 세 자리: '+id);
  const spec=(await import(pathToFileURL(path.join(specs,id+'.mjs')).href+'?t='+Date.now())).default;
  const pack=packOf(spec,id),text=JSON.stringify(pack),d=pack.drills[0];
  const row=rowOf(id,text);
  if(write){
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,id+'.json'),text);
    writeIndex();
  }
  return {pack,row,text};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let list=process.argv.slice(2);
  if(list[0]==='--all')list=fs.readdirSync(specs).filter(f=>/^\d{3}\.mjs$/.test(f)).map(f=>f.slice(0,3)).sort();
  if(!list.length){ console.error('어느 세션? 예: node scripts/fifa-scenes.mjs 001  (전부: --all)'); process.exit(1); }
  for(const id of list){ const {row,text}=await build(id); console.log(id+' · '+row.path+' · 장면 '+row.trainings.map(t=>t.scenes).join('/')+' · '+Math.round(text.length/1024)+'KB · '+row.rev); }
}
