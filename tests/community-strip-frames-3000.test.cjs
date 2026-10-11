const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.000 — 커뮤니티에 올릴 때 훈련마다의 애니메이션 장면도 이름·사진 정리를 거친다.
   2.668 이 올리는 판에서 선수 이름을 비우기 시작했고(stripSnap), 2.613 부터 애니메이션은 훈련마다(trainings[i].frames) 저장된다.
   stripTrainings 는 훈련의 판(snap)과 옛 장면(scenes)만 정리하고 frames 는 그대로 두었다 — 장면 속 이름·사진 토큰이 공개 글에 실릴 수 있었다.
   (2026-10-11 서버 실측: 훈련별 장면이 있는 글 7개 중 이름·사진이 든 글 0개.) */
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const STRIP=cut(comm,'var __pubNames=[];','function openUpload(){');
function strip(){ const c=vm.createContext({}); vm.runInContext(STRIP+';this.api={stripSnap,stripFrames,stripTrainings,stripThumbNames,names:function(){return __pubNames;}};',c); return c.api; }

const snap=(name,k)=>({pitchSpec:'fifa',players:[{id:1,team:'blue',num:'7',name,x:100+k,y:200},{id:2,team:'img',src:'data:image/png;base64,AAAA',x:5,y:5},{id:3,team:'red',num:'4',x:300,y:220}],
  customImages:[{src:'data:image/png;base64,BBBB'}],equipment:[],drawings:[]});
const frames=(names)=>names.map((n,s)=>({snap:snap(n,s*10),hold:.6,dur:1.2+s,hl:[1],cap:'움직임 '+s,ease:'out',thumb:'<svg><text>'+n+'</text></svg>'}));

test('every scene of a training loses player names and photos before it goes public',()=>{
  const g=strip();
  const out=plain(g.stripTrainings({trainings:[{name:'가상 훈련',method:'방법',coaching:'포인트',snap:snap('김가상',0),thumb:'<svg><text>김가상</text><text>7</text></svg>',animIdx:1,
    frames:frames(['김가상','이장면','박둘째'])}]}));
  const t=out[0],json=JSON.stringify(out);
  for(const bad of ['김가상','이장면','박둘째','data:image','BBBB'])assert.equal(json.includes(bad),false,'올라가는 글에 «'+bad+'» 가 없다');
  assert.equal(t.frames.length,3,'장면 수는 그대로');
  assert.deepEqual(t.frames.map(f=>[f.hold,f.dur,f.cap,f.ease,plain(f.hl),f.thumb]),[[.6,1.2,'움직임 0','out',[1],''],[.6,2.2,'움직임 1','out',[1],''],[.6,3.2,'움직임 2','out',[1],'']],'움직임·자막·강조는 그대로, 장면 그림은 비운다');
  assert.deepEqual(t.frames.map(f=>f.snap.players.map(p=>[p.team,p.num||'',p.name||'','src' in p])),Array(3).fill([['blue','7','',false],['blue','','',false],['red','4','',false]]),'번호·자리는 남고 이름·사진만 빠진다');
  assert.ok(t.frames.every(f=>Array.isArray(f.snap.customImages)&&f.snap.customImages.length===0));
  assert.deepEqual([t.name,t.method,t.coaching,t.animIdx],['가상 훈련','방법','포인트',1],'글은 그대로');
  assert.equal(t.thumb,'<svg><text>7</text></svg>','훈련 그림의 이름도 지운다');
  assert.deepEqual(plain(g.names()).sort(),['김가상','박둘째','이장면'],'장면에만 나온 이름도 모아 둔다 — 글의 대표 그림에서도 지우려고');
});

test('a single scene is not an animation, and a training without scenes stays as it was',()=>{
  const g=strip();
  const out=plain(g.stripTrainings({trainings:[{name:'하나',snap:snap('',0),animIdx:0,frames:frames(['최하나'])},{name:'없음',snap:snap('',0)},{name:'옛 장면',snap:snap('',0),scenes:[{snap:snap('정옛날',0),thumb:'<svg><text>정옛날</text></svg>'}]}]}));
  assert.deepEqual(out.map(t=>['frames' in t,'animIdx' in t]),[[false,false],[false,false],[false,false]]);
  assert.equal(JSON.stringify(out).includes('최하나'),false);
  assert.equal(JSON.stringify(out).includes('정옛날'),false,'옛 장면(scenes)의 정리는 그대로');
  assert.equal(g.stripTrainings({trainings:[]}),null);
  assert.equal(g.stripTrainings(null),null);
});

test('both ways a post reaches the server go through the same cleaning',()=>{
  assert.match(comm,/var _trsUp=stripTrainings\(sel\); if\(_trsUp\)item\.trainings=_trsUp;/,'올리기');
  assert.match(comm,/var _trsU=stripTrainings\(src\); if\(_trsU\)item\.trainings=_trsU;/,'내 글 고치기');
  assert.match(STRIP,/if\(tt\.frames!=null\)\{ var tf=stripFrames\(tt\.frames\); if\(tf\)tt\.frames=tf; else\{ delete tt\.frames; delete tt\.animIdx; \} \}\n    if\(tt\.thumb\)/,'장면을 먼저 정리한 뒤 그림의 이름을 지운다');
});

test('a chosen chip keeps a readable ground in the dark — its tint comes from a token that has a dark value',()=>{
  assert.equal(/var\(--act-soft/.test(comm),false,'--act-soft 는 정의가 없어 어두운 화면에서도 밝은 기본값이 쓰였다');
  const grammar=fs.readFileSync(path.join(__dirname,'..','studio','ui-grammar.css'),'utf8');
  assert.match(grammar,/body\.fmdark\{[^}]*--accent-soft:#1E2A47/,'어두운 화면의 --accent-soft');
  for(const sel of ['.ps-fsheet .ps-fsheet-row button.on{background:var(--accent-soft,#EEF3FF)','.chip.on:not(#_):not(#__){background:var(--accent-soft,#EEF3FF)!important','.pr-cvtabs button[aria-pressed="true"]{border-color:var(--c-act,#3A6DF0);background:var(--accent-soft,#EEF3FF)'])
    assert.ok(comm.includes(sel),sel);
});
