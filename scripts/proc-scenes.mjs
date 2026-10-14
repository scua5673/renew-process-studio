// 커뮤니티 «프로세스» 칸 세션의 장면을 앱이 보강한다(3.019 — 사용자 «속도를 늦춰 길게가 아니라 애니메이션을 더해 훈련 애니메이션 퀄리티를»).
//   node scripts/proc-scenes.mjs 02        → studio/packs/02.json 의 훈련 장면 · studio/packs/index.json 의 그 줄(own:1 · 장면 수 · 지문)
// 장면은 scripts/proc-scenes/NN.mjs 에 적는다 — 훈련마다 장면 목록(바뀐 자리만 · 공 · 몸 방향 · 강조 · 자막 · 이동 시간 · 곡선).
// 판(운동장 · 장비 · 구역 선 · 선수 명단)은 팩의 훈련 판을 그대로 쓰고, 장면마다 선수·공 자리와 화살표만 바꾼다.
// 화살표는 장면 i 에서 i+1 로 가는 움직임에서 짓는다(재생은 장면 i 에 머무는 동안 보이고, 움직이며 사라진다):
//   공 — 같은 선수가 몰고 가면 드리블(물결), 다른 선수에게 가면 패스(실선 · 띄운 공이면 로빙), shot:1 이면 슈팅.
//   선수 — 우리 팀만(runs: 팀 이름들 · 없으면 빨강이 아닌 팀), 다음 장면에서 강조하거나 크게 움직인 선수의 이동(노란 점선). 상대는 그리지 않는다.
// 몇 번을 돌려도 같은 결과다. 사본 만들기(proc-snapshot.mjs)는 own:1 세션을 덮지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packs=path.join(root,'studio','packs');
export const ARROW_TYPES=['pass','run','dribble','shot'];
const r1=v=>Math.round(v*10)/10;
const clone=o=>JSON.parse(JSON.stringify(o));

/* 끝을 토큰 반지름만큼 잘라 화살촉이 토큰 밑에 숨지 않게 */
function trimmed(a,b,s0,s1){ const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
  return [[a[0]+dx/L*s0,a[1]+dy/L*s0],[b[0]-dx/L*s1,b[1]-dy/L*s1]]; }
function nearest(pos,ids,at,max){ let best=null,bd=max;
  for(const id of ids){ const p=pos[id],d=Math.hypot(p[0]-at[0],p[1]-at[1]); if(d<bd){bd=d;best=id;} } return best; }

/* 장면 목록 → 장면마다의 자리(앞 장면에서 이어받는다) */
export function resolveScenes(base,spec){
  const ids=base.players.map(p=>String(p.id));
  let pos=Object.fromEntries(base.players.map(p=>[String(p.id),[p.x,p.y]])),ball=[base.ball.x,base.ball.y],dir={};
  return spec.scenes.map((sc,i)=>{
    pos={...pos}; for(const [k,v] of Object.entries(sc.pos||{})){ if(!ids.includes(k))throw Error('장면 '+i+': 판에 없는 선수 '+k); pos[k]=v; }
    if(sc.ball)ball=sc.ball;
    dir={...dir}; for(const [k,v] of Object.entries(sc.dir||{})){ if(v==null)delete dir[k]; else dir[k]=v; }
    return {pos,ball,dir:{...dir},sc};
  });
}

export function arrowsFor(base,a,b,opt){
  const ts=opt.scale,lw=opt.lw,out=[],ids=Object.keys(a.pos),team=Object.fromEntries(base.players.map(p=>[String(p.id),p.team]));
  const sc=a.sc;
  if(Array.isArray(sc.arrows))return sc.arrows.map(x=>({type:x.type,color:x.type==='run'?'#ffd23f':'#ffffff',lw,op:.95,
    pts:trimmed(x.from,x.to,8*ts,(x.type==='run'?20:16)*ts).map(([x2,y2])=>({x:r1(x2),y:r1(y2)})),...(x.lob?{lob:true}:{})}));
  const moved=Math.hypot(b.ball[0]-a.ball[0],b.ball[1]-a.ball[1]);
  let carrier=null;
  if(moved>40*ts){
    const c0=nearest(a.pos,ids,a.ball,45*ts),c1=nearest(b.pos,ids,b.ball,45*ts);
    const type=sc.shot?'shot':(c0&&c0===c1?'dribble':'pass');
    if(type==='dribble')carrier=c0;
    const [p0,p1]=trimmed(a.ball,b.ball,8*ts,(type==='shot'?6:16)*ts);
    const d={type,color:'#ffffff',lw,op:.95,pts:[{x:r1(p0[0]),y:r1(p0[1])},{x:r1(p1[0]),y:r1(p1[1])}]};
    if(type==='pass'&&sc.air)d.lob=true;
    out.push(d);
  }
  const hl=new Set((b.sc.hl||[]).map(String));
  for(const id of ids){
    if((opt.runs?!opt.runs.includes(team[id]):team[id]==='red')||id===carrier)continue;
    const p0=a.pos[id],p1=b.pos[id],L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);
    if(L<45*ts||!(hl.has(id)||L>90*ts))continue;
    const [q0,q1]=trimmed(p0,p1,20*ts,18*ts),d={type:'run',color:'#ffd23f',lw,op:.95,pts:[{x:r1(q0[0]),y:r1(q0[1])},{x:r1(q1[0]),y:r1(q1[1])}]};
    const cv=sc.curves&&sc.curves[id];
    if(cv)d.pts.push({x:r1((p0[0]+p1[0])/2+2*cv[0]),y:r1((p0[1]+p1[1])/2+2*cv[1])});   /* 재생의 곡선과 같은 2차 곡선(제어점 = 가운데 + 2·비낌) */
    out.push(d);
  }
  return out;
}

/* 훈련 하나: 판(snap) + 장면 목록 → 재생 장면(frames) */
export function buildFrames(snap,spec,opt){
  const base=clone(snap);
  base.drawings=(base.drawings||[]).filter(d=>!ARROW_TYPES.includes(d.type));
  const scenes=resolveScenes(base,spec),n=scenes.length;
  return scenes.map((s,i)=>{
    const sn=clone(base);
    sn.players.forEach(p=>{ const k=String(p.id),q=s.pos[k]; p.x=r1(q[0]); p.y=r1(q[1]);
      if(s.dir[k]!=null){ p.dir=s.dir[k]; p.dirFix=1; } else { delete p.dir; delete p.dirFix; } });
    sn.ball={...sn.ball,x:r1(s.ball[0]),y:r1(s.ball[1])};
    if(i<n-1)sn.drawings=sn.drawings.concat(arrowsFor(base,s,scenes[i+1],opt));
    const f={snap:sn,hold:i===0?.9:(i===n-1?1.7:.6),dur:s.sc.dur||opt.dur,hl:(s.sc.hl||[]).map(Number),cap:s.sc.cap||''};
    const cv={};
    for(const [k,v] of Object.entries(s.sc.curves||{}))cv[k]={mx:v[0],my:v[1]};
    if(s.sc.air)cv.ball={...(cv.ball||{mx:0,my:0}),air:s.sc.air};
    if(Object.keys(cv).length)f.curves=cv;
    return f;
  });
}

export function rev(text){ return crypto.createHash('sha1').update(text).digest('hex').slice(0,10); }

export async function build(nn,{write=true}={}){
  const spec=(await import(pathToFileURL(path.join(root,'scripts','proc-scenes',nn+'.mjs')).href)).default;
  const file=path.join(packs,nn+'.json'),pack=JSON.parse(fs.readFileSync(file,'utf8')),d=pack.drills[0];
  if(spec.trainings.length!==d.trainings.length)throw Error(nn+': 훈련 수가 팩과 다릅니다');
  d.trainings.forEach((t,i)=>{
    const sp=spec.trainings[i];
    if(sp.name!==t.name)throw Error(nn+' 훈련 '+(i+1)+': 이름이 팩과 다릅니다 — '+sp.name);
    t.frames=buildFrames(t.snap,sp,{scale:sp.scale||1,lw:sp.lw||1,dur:sp.dur||1.2,runs:sp.runs||null});
    t.snap=clone(t.frames[0].snap);
    t.animIdx=0;
  });
  d.frames=clone(d.trainings[0].frames);   /* 카드 대표 = 첫 훈련(2.613) */
  const text=JSON.stringify(pack);
  const index=JSON.parse(fs.readFileSync(path.join(packs,'index.json'),'utf8'));
  const row=index.sessions.find(s=>s.n===+nn);
  if(!row)throw Error(nn+': 목록에 없는 세션');
  row.own=1; row.rev=rev(text);
  row.trainings.forEach((t,i)=>{ t.scenes=d.trainings[i].frames.length; });
  if(write){ fs.writeFileSync(file,text); fs.writeFileSync(path.join(packs,'index.json'),JSON.stringify(index)); }
  return {pack,row,text};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const list=process.argv.slice(2);
  if(!list.length){ console.error('어느 세션? 예: node scripts/proc-scenes.mjs 02'); process.exit(1); }
  for(const nn of list){ const {row}=await build(nn); console.log(nn+' · 장면 '+row.trainings.map(t=>t.scenes).join('/')+' · '+row.rev); }
}
