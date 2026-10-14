const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.016 — 커뮤니티 «프로세스» 칸의 훈련 애니메이션이 너무 짧다(사용자 «지금보다 더 길게»).
   팩은 장면 이동 1.2~1.45초 · 장면 유지는 작전판 기본 0.6초(재생은 장면 0 의 __hold 를 쓰는데 팩엔 그 칸이 없다) → 훈련 하나가 10초 남짓.
   · 유지 2초 이상(재생 __hold · 영상 hold) · 이동 평균 2.2초(같은 비율로 늘린다 — 장면마다의 차이는 그대로, 이미 느리면 그대로)
   · 보는 곳(커뮤니티 procPace)과 담은 곳(작전판 letterPackPace — «보관함에 담기»)의 박자가 같다 */
const root=path.join(__dirname,'..');
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(root,'studio','board.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const fnSrc=(src,name)=>cut(src,'function '+name+'(fr){','\n}\n')+'\n}';
const plain=o=>JSON.parse(JSON.stringify(o));
const PROC=cut(comm,'/* ── 2.999 · 프로세스 칸 순수 구간 시작','/* ── 2.999 · 프로세스 칸 순수 구간 끝 ── */');
const LETTER=cut(board,'/* ── 2.997 · 레터 팩 순수 구간 시작','/* ── 2.997 · 레터 팩 순수 구간 끝 ── */');
function proc(){ const c=vm.createContext({}); vm.runInContext(PROC+';this.api={procPace,procRead,procItem};',c); return c.api; }
function letter(){ const c=vm.createContext({URL}); vm.runInContext(LETTER+';this.api={letterPackPace,letterPackCard};',c); return c.api; }
/* 작전판 재생(playAnim)이 쓰는 시간: 장면마다 animHold(장면 0 의 __hold, 없으면 0.6) + 장면 사이 이동 dur(최소 0.3) */
const playSec=fr=>{ const h=Math.max(.2,+fr[0].__hold||.6); let t=h*fr.length; for(let i=0;i<fr.length-1;i++)t+=Math.max(.3,+fr[i].dur||1); return t; };
const snap=k=>({players:[{id:101,team:'blue',num:'6',x:400+k*10,y:300}],equipment:[],drawings:[]});
// 훈련 세션 사이트의 팩 장면 모양: 첫 장면 0.9 · 가운데 0.6 · 마지막 1.7 유지, 이동 1.2~1.45
const scenes=durs=>durs.map((dur,i)=>({snap:snap(i),hold:i===0?.9:(i===durs.length-1?1.7:.6),dur,hl:[101],cap:i?('움직임 '+i):''}));

test('the community and the vault pace a process training the same way — one body, two names',()=>{
  const a=fnSrc(comm,'procPace'),b=fnSrc(board,'letterPackPace');
  assert.equal(a.replace('function procPace(','function X('),b.replace('function letterPackPace(','function X('),'보는 곳과 담은 곳의 박자가 어긋나지 않게');
  assert.match(comm,/var tf=dep\.frames\(t\.frames\); if\(tf\)t\.frames=procPace\(tf\);/,'훈련마다의 장면');
  assert.match(comm,/var fr=dep\.frames\(item\.frames\); if\(fr\)item\.frames=procPace\(fr\);/,'카드 대표 장면');
  assert.match(board,/if\(frames\.length>=2\)\{ frames=letterPackPace\(frames\); frames\[0\]\.thumb=th;/,'«보관함에 담기»의 카드');
});

test('a pack-like training holds each scene 2 s and moves 2.2 s on average — about twice as long as before',()=>{
  const g=proc(),src=scenes([1.15,1.3,1.45,1.25,1.35,1.2]),before=JSON.stringify(src),out=plain(g.procPace(src));
  assert.equal(JSON.stringify(src),before,'받은 장면은 고치지 않는다');
  assert.equal(out[0].__hold,2,'재생의 공통 유지(작전판 «장면 유지»의 가장 긴 값)');
  assert.deepEqual(out.map(f=>f.hold),[2,2,2,2,2,2],'영상 내보내기가 쓰는 장면마다의 유지도 2초 이상');
  const mv=out.slice(0,-1).map(f=>f.dur),avg=mv.reduce((a,v)=>a+v,0)/mv.length;
  assert.ok(Math.abs(avg-2.2)<.01,'이동 평균 2.2초 — '+avg);
  const k=2.2/((1.15+1.3+1.45+1.25+1.35)/5);   /* 마지막 장면의 dur 는 이동이 아니다(재생이 쓰지 않는다) — 평균에서 뺀다 */
  out.forEach((f,i)=>assert.ok(Math.abs(f.dur-[1.15,1.3,1.45,1.25,1.35,1.2][i]*k)<.006,'장면마다의 길고 짧은 차이는 그대로 '+i+': '+f.dur));
  assert.ok(out[2].dur>out[1].dur&&out[1].dur>out[0].dur);
  assert.deepEqual(out.map(f=>[f.cap,f.hl]),src.map(f=>[f.cap,f.hl]),'자막·강조는 그대로');
  const raw=g.procPace(src);
  assert.ok(raw.every((f,i)=>f!==src[i]&&f.snap===src[i].snap),'장면은 새 것 · 판은 복사하지 않고 그대로 쓴다');
  assert.ok(playSec(out)>=2*playSec(src),'재생 시간 '+playSec(src).toFixed(1)+'초 → '+playSec(out).toFixed(1)+'초');
});

test('pacing twice changes nothing, and a training that is already slow keeps its own pace',()=>{
  const g=proc(),once=plain(g.procPace(scenes([1.15,1.3,1.45,1.25,1.35,1.2])));
  assert.deepEqual(plain(g.procPace(once)),once,'훈련 세션 사이트가 나중에 박자를 늘려도 두 번 늘어나지 않는다');
  const slow=scenes([3,2.5,2.6]).map(f=>Object.assign(f,{hold:3})); slow[0].__hold=3.5;
  const s2=plain(g.procPace(slow));
  assert.deepEqual(s2.map(f=>[f.dur,f.hold]),[[3,3],[2.5,3],[2.6,3]]);
  assert.equal(s2[0].__hold,3.5);
});

test('odd values are kept in range, and one scene or no scenes is not an animation',()=>{
  const g=proc();
  for(const v of [null,undefined,[],[{dur:1}],'x'])assert.equal(g.procPace(v),v);
  const odd=plain(g.procPace([{dur:'abc',hold:-4,__hold:1e9},null,{dur:1e9,hold:Infinity},{dur:-1}]));
  assert.equal(odd[0].__hold,20,'유지는 20초를 넘지 않는다');
  assert.deepEqual(odd.map(f=>f.hold),[2,2,2,2]);
  assert.ok(odd.every(f=>f.dur>=.1&&f.dur<=20),JSON.stringify(odd.map(f=>f.dur)));
  assert.equal(typeof odd[1],'object','빈 장면도 장면 모양으로');
  const fast=plain(g.procPace([{dur:.1,hold:0},{dur:.1,hold:0}]));
  assert.deepEqual(fast.map(f=>[f.dur,f.hold]),[[2.2,2],[2.2,2]],'아주 빠른 장면도 같은 박자로');
});

test('every process training in the app\'s snapshot plays at least twice as long as before',()=>{
  const g=proc(),dir=path.join(root,'studio','packs');
  let n=0,sumB=0,sumA=0;
  for(const f of fs.readdirSync(dir).filter(x=>/^\d\d\.json$/.test(x))){
    const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).drills[0];
    for(const t of d.trainings){ if(!Array.isArray(t.frames)||t.frames.length<2)continue;
      const b=playSec(t.frames),a=playSec(plain(g.procPace(t.frames))); n++; sumB+=b; sumA+=a;
      assert.ok(a>=2*b,f+' '+t.name+': '+b.toFixed(1)+'초 → '+a.toFixed(1)+'초'); }
  }
  assert.ok(n>=100,'훈련 '+n+'개');
  assert.ok(sumA/n>=20,'평균 '+(sumB/n).toFixed(1)+'초 → '+(sumA/n).toFixed(1)+'초');
});

test('the viewer item and the vault card both carry the slower pace',()=>{
  const g=proc(),l=letter();
  const tr=(i,n)=>({type:'train',name:'연습 '+(i+1),minutes:15,sets:1,rpe:5,focus:'bp',method:'',coaching:'',snap:snap(i),animIdx:0,frames:scenes(Array(n).fill(1.2))});
  const pack={type:'process-studio-drillpack',version:1,drills:[{name:'레터 3호 · 가상 세션',type:'train',focus:'bp',snap:snap(0),trainings:[tr(0,3),tr(1,1),tr(2,4)],frames:scenes([1.2,1.2,1.2]),
    letter:{issue:3,title:'가상 호',session:'가상 세션',theme:'공격 조직 › 인지',url:'https://process-letter.netlify.app/03/'}}]};
  const row={n:3,session:'가상 세션',theme:'공격 조직 › 인지',trainings:[{name:'연습 1',minutes:15,scenes:3},{name:'연습 2',minutes:15,scenes:1},{name:'연습 3',minutes:15,scenes:4}]};
  const s=g.procRead({type:'process-studio-pack-index',sessions:[row]})[0];
  const dep={fields:['name','focus','minutes','sets','rpe','tags','type','snap','scenes','frames'],snap:x=>x,trainings:d=>plain(d.trainings),
    frames:fr=>(!Array.isArray(fr)||fr.length<2)?null:plain(fr)};
  const it=plain(g.procItem(plain(pack),s,dep));
  const pace=fr=>[fr[0].__hold,fr.map(f=>[f.hold,f.dur])];
  assert.deepEqual(pace(it.trainings[0].frames),[2,[[2,2.2],[2,2.2],[2,2.2]]],'뷰어가 받는 훈련 장면');
  assert.deepEqual(pace(it.trainings[2].frames),[2,[[2,2.2],[2,2.2],[2,2.2],[2,2.2]]]);
  assert.equal(it.trainings[1].frames,undefined,'장면 하나는 애니메이션이 아니다');
  assert.deepEqual(pace(it.frames),[2,[[2,2.2],[2,2.2],[2,2.2]]],'카드 대표 장면');
  const c=plain(l.letterPackCard(plain(pack),{draft:d=>Object.assign({},d),snap:x=>x,thumb:()=>'<svg></svg>',id:()=>'Lnew',now:1}));
  assert.deepEqual(pace(c.trainings[0].frames),pace(it.trainings[0].frames),'담은 카드도 본 것과 같은 박자');
  assert.deepEqual(pace(c.trainings[2].frames),pace(it.trainings[2].frames));
  assert.deepEqual(pace(c.frames),pace(c.trainings[0].frames));
  assert.deepEqual(Object.keys(c.trainings[0].frames[1]).sort(),['cap','dur','hl','hold','snap'],'장면 칸은 여전히 하나씩 고른 것만');
});

test('the desktop preview plays a process session at the same pace, and coach posts as before',()=>{
  const body=cut(comm,'function cpAnimGeneric(box,frames,p){','\nfunction openPost(p){');
  assert.match(body,/var pace=\(p&&p\.proc\)\?\{hold:Math\.max\(\.2,\+frames\[0\]\.__hold\|\|2\)\*1000,move:function\(k\)\{ return Math\.max\(\.3,\+frames\[k\]\.dur\|\|1\)\*1000; \}\}:null;/);
  assert.match(body,/_cpaT\.push\(setTimeout\(step,pace\?\(mv\+pace\.hold\):\(i===0\?1500:980\)\)\);/,'코치 글은 예전 박자');
  assert.match(body,/_cpaT\.push\(setTimeout\(step,pace\?pace\.hold:700\)\);/);
  assert.match(body,/if\(pace\)\[\]\.forEach\.call\(host\.querySelectorAll\('\.cpt,\.cpb'\),function\(t\)\{ t\.style\.transitionDuration=mv\+'ms'; \}\);/,'선수·공의 이동 시간도 장면의 dur');
});
