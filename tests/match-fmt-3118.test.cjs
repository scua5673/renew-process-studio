'use strict';
// 3.118 — 경기 인원(사용자 «경기 준비하면서 처음에 8v8 인지 11v11 을 설정할 수 있게»).
// 경기 머리의 «11 대 11 · 8 대 8»(match-formats.js) → «＋ 새 미팅» 재료에 fmt → 작전판 board-meet-8.js 가 8인제 9장을 만든다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../studio/match-formats.js');
const M8=require('../studio/board-meet-8.js');
const root=path.join(__dirname,'..');

test('경기 인원: 정한 값 · 앞 경기 값 · 기본 11',()=>{
  const a={id:'a',date:'2026-10-20',fmt:'8'},b={id:'b',date:'2026-10-27'},c={id:'c',date:'2026-11-03',fmt:'11'};
  assert.equal(F.fmtOf(a,[a,b,c]),'8','정한 값');
  assert.equal(F.fmtOf(b,[a,b,c]),'8','정하지 않으면 날짜가 늦지 않은 경기 중 가장 늦은 경기의 값');
  assert.equal(F.fmtOf({id:'x',date:'2026-10-01'},[a,c]),'11','앞 경기가 없으면 11');
  assert.equal(F.fmtOf({id:'y',date:'2026-11-10'},[a,c]),'11','가장 가까운 앞 경기(11)');
  assert.equal(F.fmtOf({id:'z',date:'2026-10-20'},[a,{id:'w',date:'2026-10-20',fmt:'11',updatedAt:9}]),'11','같은 날이면 나중에 고친 경기');
  assert.equal(F.fmtOf({id:'q',date:'2026-10-25',fmt:'9'},[a]),'8','이상한 값은 정하지 않은 것으로');
  assert.equal(F.fmtOf(null,[]),'11');
});

test('배치 분모: 선발 인원 → 경기 인원 → 상대 포메이션',()=>{
  assert.equal(F.denom(7,'442','8'),7);
  assert.equal(F.denom(0,'442','8'),8);
  assert.equal(F.denom(0,'232','11'),11);
  assert.equal(F.denom(0,'232'),8,'3.117 그대로(경기 인원을 모를 때)');
  assert.equal(F.denom(0,'433'),11);
});

const IN=(p,g)=>{const l=g.cx-65*g.mpp/2,t=g.cy-48*g.mpp/2;return [(p.x-l)/g.mpp,(p.y-t)/g.mpp];};
test('8인제 기본 9장 — 장마다 우리 8명(2-3-2 번호) · 상대 8명(3-3-1 번호) · 8인제 운동장',()=>{
  const g={mpp:10,cx:555,cy:370},base={pitchSpec:'fifa',players:[{id:1}],tokenScale:0.2,pitchTheme:'grass',teamColor:'#123'};
  const out=M8.slides(base,false,'v',g,0.36);
  assert.deepEqual(out.map(s=>s.title),['BEST 8','하이블록','미드블록','로우블록','빌드업','전진·전개','침투·마무리','코너킥 수비','코너킥 공격']);
  out.forEach((s,i)=>{
    const sn=s.snap,blue=sn.players.filter(p=>p.team==='blue'),red=sn.players.filter(p=>p.team==='red');
    assert.equal(sn.pitchSpec,'u12',s.title);assert.equal(sn.orientation,'v');assert.equal(sn.area,'full');assert.equal(sn.pitchTheme,'white');
    assert.equal(sn.teamColor,'#123','바탕의 겉모습은 빌린다');assert.equal(base.players.length,1,'바탕은 그대로');
    assert.equal(sn.tokenScale,0.36,'토큰 크기 바닥');
    assert.equal(blue.length,8,s.title);assert.equal(red.length,i===0?0:8,s.title);
    assert.deepEqual(blue.map(p=>p.num+p.pos),['1GK','2LCB','3RCB','4LM','5CM','6RM','7ST','8ST']);
    if(red.length)assert.deepEqual(red.map(p=>p.num).sort(),['1','2','3','4','5','6','7','8']);
    assert.equal(new Set(sn.players.map(p=>p.id)).size,sn.players.length,'id 겹침 없음');
    const pts=sn.players.map(p=>IN(p,g));
    pts.forEach(([x,y],k)=>{ const off=x<0||x>65||y<0||y>48; if(off)assert.ok(x>=-1.5&&x<=66.5&&y>=-1.5,s.title+' 코너 키커만 선 밖 '+[x,y]); });
    assert.ok(pts.filter(([x,y])=>x<0||x>65||y<0||y>48).length<=1,s.title+' 선 밖은 코너 키커 하나뿐');
    for(let a=0;a<pts.length;a++)for(let b=a+1;b<pts.length;b++){const d=Math.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1]);assert.ok(d>=3,s.title+' 토큰 '+a+'·'+b+' 이 '+d.toFixed(1)+'m — 3m 보다 가깝다');}
    if(i===0)assert.equal(sn.ball,null);else{const[bx,by]=IN(sn.ball,g);assert.ok(bx>=0&&bx<=65&&by>=0&&by<=48,s.title+' 공은 운동장 안');}
    // 썸네일이 내용에 맞춰 잘리지 않을 만큼 운동장을 쓴다(board.html thumbFitVB 의 72%)
    if(i>0){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);assert.ok(Math.max(...xs)-Math.min(...xs)>=0.6*65||Math.max(...ys)-Math.min(...ys)>=0.75*48,s.title+' 넓게');}
  });
  assert.equal(M8.slides(base,true,'h',g).length,8,'선발을 가져오면 BEST 8 은 뺀다');
  assert.equal(M8.slides(base,true,'h',g)[0].snap.orientation,'h');
});

test('작전판 감싸기 — fmt:"8" 인 경기에서 만들 때만 8인제 9장, 나머지는 원래 판',()=>{
  const calls=[];
  const win={document:{readyState:'complete'},defaultTokenScale:()=>0.3,
    __meetTplSlides(base,skip,oh){calls.push('orig');return [{title:'BEST 11',snap:{pitchSpec:'fifa'}}];},
    __meetingFromMatch(p){ if(p&&p.boom)throw new Error('boom'); return win.__meetTplSlides({},!!p.skipBest,'v'); }};
  M8.install(win);
  assert.equal(win.__meetingFromMatch.__ps8,true);assert.equal(win.__meetTplSlides.__ps8,true);
  const a=win.__meetingFromMatch({template:true,fmt:'8'});
  assert.equal(a.length,9);assert.equal(a[0].title,'BEST 8');assert.equal(a[0].snap.pitchSpec,'u12');assert.equal(a[0].snap.tokenScale,0.3);
  assert.equal(win.__meetingFromMatch({template:true,fmt:'8',skipBest:true}).length,8);
  assert.equal(win.__meetingFromMatch({template:true,fmt:'11'})[0].title,'BEST 11');
  assert.equal(win.__meetingFromMatch({template:true})[0].title,'BEST 11','fmt 없는 옛 재료는 그대로');
  assert.equal(win.__meetTplSlides({},false,'v')[0].title,'BEST 11','경기 밖(보관함 › 만들기)은 그대로');
  assert.throws(()=>win.__meetingFromMatch({fmt:'8',boom:true}));
  assert.equal(win.__meetTplSlides({},false,'v')[0].title,'BEST 11','실패해도 깃발이 남지 않는다');
  M8.install(win);assert.equal(win.__meetingFromMatch({fmt:'8'}).length,9,'두 번 설치해도 한 번만 감싼다');
});

test('모듈 연결 — 작전판 · 서비스워커 · 경기 화면',()=>{
  const board=fs.readFileSync(path.join(root,'studio/board.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),scout=fs.readFileSync(path.join(root,'studio/scout.html'),'utf8');
  const i=board.indexOf('<script src="board-meet-8.js"></script>'),body=board.indexOf('const NS="http://www.w3.org/2000/svg"');
  assert.ok(i>0&&i<body,'본문 스크립트보다 먼저(감싸기는 DOMContentLoaded 에)');
  assert.ok(sw.includes("'/studio/board-meet-8.js'"));
  assert.ok(scout.includes('match-formats.js'),'경기 화면은 match-formats.js 를 읽는다');
  assert.match(fs.readFileSync(path.join(root,'studio/storage-keys.js'),'utf8'),/cs_team_matches_v1/,'경기 인원은 경기 문서(cs_team_matches_v1)의 칸 — 새 저장 키 없음');
});
