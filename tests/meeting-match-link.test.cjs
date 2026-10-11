'use strict';
/* 2.928 — 보관함 미팅 ↔ 팀 운영 경기 연결(목업 안 C) · 훈련 편집기 «PDF» · 코치 토큰 대비색.
   연결은 미팅 쪽(item.matchRef) 한 줄 — 경기 문서(cs_team_matches_v1)에는 쓰지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function fnAt(src,start){ const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1); }
const J=x=>JSON.parse(JSON.stringify(x));
/* 작전판 11인제 상수(board.html 4030 부근과 같은 값) */
const WORLD='const W=1110,H=740,M=30,L=M,R=W-M,T=M,B=H-M,PW=R-L,PH=B-T;';

function boardCtx(extra){
  const ctx=vm.createContext(Object.assign({JSON,Math,Date,Promise,setTimeout,isFinite},extra||{}));
  vm.runInContext(WORLD+[fnAt(board,'function meetPctPt(x,y)'),fnAt(board,'function meetSnapFromPct(base,sp)'),fnAt(board,'function meetPickLists(matches,today)'),
    fnAt(board,'function meetRefClean(r)'),fnAt(board,'function meetRefOf(m)')].join('\n')+';this.pt=meetPctPt;this.snap=meetSnapFromPct;this.lists=meetPickLists;this.clean=meetRefClean;this.refOf=meetRefOf;this.L=L;this.R=R;this.T=T;this.B=B;',ctx);
  return ctx;
}

test('경기 보드 % 좌표 → 작전판 운동장 — 선(1~104·1~67)이 운동장 네 변에 닿는다',()=>{
  const c=boardCtx();
  const a=c.pt(1/105*100,1/68*100),b=c.pt(104/105*100,67/68*100);
  assert.ok(Math.abs(a.x-c.L)<0.2&&Math.abs(a.y-c.T)<0.2,'왼쪽 위');
  assert.ok(Math.abs(b.x-c.R)<0.2&&Math.abs(b.y-c.B)<0.2,'오른쪽 아래');
  const far=c.pt(500,-500);assert.ok(far.x<=c.R+30&&far.y>=c.T-30,'판 밖으로 멀리 나가지 않는다');
});

test('슬라이드 재료 → 스냅 — 우리=팀1·상대=팀2, GK 역할, 그림·장비·공, 못 옮긴 것은 센다',()=>{
  const c=boardCtx();
  const r=c.snap({teamColors:{blue:'#000000'},players:[{id:9}],drawings:[{x:1}],ball:{x:1,y:1}},{
    us:[{x:10,y:50,num:'1',name:'골키',pos:'',gk:true},{x:40,y:30,num:'7',name:'윙',pos:'GK',gk:false},{x:'a',y:3}],
    opp:[{x:90,y:50,num:'9',pos:'ST'}],
    draw:[{type:'arrow',x:10,y:10,x2:30,y2:30,color:'#ff0000'},{type:'dashed',x:10,y:10,x2:20,y2:20},{type:'line',x:1,y:1,x2:2,y2:2},
      {type:'pen',x:5,y:5,points:[{x:5,y:5},{x:6,y:6},{x:7,y:7}]},{type:'rect',x:1,y:1,x2:9,y2:9},{type:'ellipse',x:1,y:1,x2:9,y2:9},
      {type:'text',x:50,y:50,text:'  압박  '},{type:'cone',x:20,y:20},{type:'mannequin',x:22,y:22},{type:'ball',x:50,y:50},{type:'ball',x:60,y:50},
      {type:'hologram',x:1,y:1},{type:'pen',x:1,y:1,points:[{x:1,y:1}]},{type:'text',x:1,y:1,text:'  '}]
  });
  const s=r.snap;
  assert.equal(s.teamColors.blue,'#000000','겉모습(팀 색)은 바탕에서');
  assert.equal(s.players.length,3);
  assert.deepEqual(J(s.players.map(p=>[p.team,p.num,p.pos])),[['blue','1','GK'],['blue','7',''],['red','9','ST']]);
  assert.equal(s.players[0].name,'골키');assert.equal(s.players[2].name,null);
  const ty=s.drawings.map(d=>d.type);
  assert.deepEqual(J(ty),['pass','run','line','free','rectline','ellipse','text']);
  assert.equal(s.drawings[0].color,'#ff0000');assert.equal(s.drawings[1].color,'#ffffff','색이 없으면 흰색');
  assert.equal(s.drawings[6].text,'압박');assert.equal(s.drawings[3].pts.length,3);
  assert.deepEqual(J(s.equipment.map(e=>e.team)),['cone','dummy','ball'],'두 번째 공은 장비 공');
  assert.ok(s.ball&&s.ball.x>0,'첫 공은 판의 공');
  assert.equal(r.skipped,4,'잘못된 토큰 1 + 모르는 그림 1 + 점 하나 펜 1 + 빈 글 1');
});

test('경기 고르기 목록 — 다가오는 경기는 가까운 순, 지난 경기는 최근 순, 날짜 없는 경기는 빠진다',()=>{
  const c=boardCtx();
  const ms=[{id:'a',date:'2026-09-27'},{id:'b',date:'2026-10-11'},{id:'c',date:'2026-10-04',time:'15:00'},{id:'d',date:'2026-10-01'},{id:'e'},{id:'f',date:'2026-09-20'}];
  const r=c.lists(ms,'2026-10-01');
  assert.deepEqual(J(r.up.map(m=>m.id)),['d','c','b']);
  assert.deepEqual(J(r.past.map(m=>m.id)),['a','f']);
});

test('연결 정보는 경기 id 와 표시용 사본만 — 다른 값은 잘라 낸다',()=>{
  const c=boardCtx();
  assert.equal(c.clean(null),null);assert.equal(c.clean({opp:'x'}),null,'경기 id 가 없으면 연결 아님');
  const r=c.clean({mid:'mt1',date:'2026-10-04T00:00',opp:'한빛FC'.repeat(20),evil:'<script>'});
  assert.equal(r.mid,'mt1');assert.equal(r.date,'2026-10-04');assert.equal(r.opp.length,60);assert.equal(r.evil,undefined);
  const f=c.refOf({id:'mt9',opponent:'한빛FC',date:'2026-10-04',time:'15:00',homeAway:'홈',kind:'official'});
  assert.deepEqual(J([f.mid,f.opp,f.date,f.time,f.ha,f.kind]),['mt9','한빛FC','2026-10-04','15:00','홈','official']);
});

function linkCtx(lib,editable){
  let store=J(lib),writes=0;
  const ctx=vm.createContext({JSON,Math,Date,Promise,setTimeout,window:{},
    libGet:async()=>J(store),libSet:async l=>{writes++;store=J(l);},canEditItem:d=>editable(d),renderDrillFiles(){}});
  vm.runInContext('var _vaultAutoWriting=false,_vaultAutoAgain=false,_libTurnTail=Promise.resolve();'+[fnAt(board,'function libTurn(task)'),fnAt(board,'function meetLinkable(d)'),fnAt(board,'function meetKindWord(d)'),fnAt(board,'function meetRefClean(r)'),'var _meetLibBusy=false;',fnAt(board,'function meetLibMutate(fn,_n)'),fnAt(board,'function meetSetMatch(libId,ref)')].join('\n')
    +';this.set=meetSetMatch;this.lock=function(v){_vaultAutoWriting=v;};this.again=function(){return _vaultAutoAgain;};',ctx);
  return {ctx,get store(){return store;},get writes(){return writes;}};
}
test('미팅·작전판 연결·끊기 — 만든 사람만, 미팅·작전판만(2.965), 다른 필드는 그대로',async()=>{
  const lib=[{libId:'A',type:'meeting',name:'전술 미팅',slides:[{title:'1'}],createdBy:'me'},{libId:'B',type:'meeting',name:'남의 것',createdBy:'you'},{libId:'C',type:'train',name:'훈련',createdBy:'me'},{libId:'D',type:'board',name:'빌드업 작전판',pages:[{name:'p1'}],createdBy:'me'}];
  const t=linkCtx(lib,d=>d.createdBy==='me');
  let r=await t.ctx.set('A',{mid:'mt1',date:'2026-10-04',opp:'한빛FC'});
  assert.equal(r.ok,true);assert.equal(t.store[0].matchRef.mid,'mt1');assert.equal(t.store[0].slides.length,1,'슬라이드는 건드리지 않는다');
  r=await t.ctx.set('B',{mid:'mt1'});assert.equal(r.reason,'denied');assert.equal(t.store[1].matchRef,undefined);
  r=await t.ctx.set('C',{mid:'mt1'});assert.equal(r.reason,'type');
  r=await t.ctx.set('Z',{mid:'mt1'});assert.equal(r.reason,'gone');
  assert.equal(t.writes,1,'거부는 쓰지 않는다');
  r=await t.ctx.set('D',{mid:'mt1'});assert.equal(r.ok,true,'2.965 — 작전판도 잇는다');assert.equal(t.store[3].matchRef.mid,'mt1');assert.equal(t.store[3].pages.length,1,'페이지는 그대로');assert.equal(r.name,'빌드업 작전판');
  r=await t.ctx.set('A',null);assert.equal(r.ok,true);assert.equal(t.store[0].matchRef,undefined,'끊기');
});
test('연결 쓰기는 보관함 자동 저장이 쓰는 동안 기다린다 — 둘이 목록을 통째로 써서 한쪽이 지워지지 않게',async()=>{
  const t=linkCtx([{libId:'A',type:'meeting',name:'m'}],()=>true);
  t.ctx.lock(true);
  const p=t.ctx.set('A',{mid:'mt1'});
  await new Promise(r=>setTimeout(r,200));
  assert.equal(t.writes,0,'자동 저장 중에는 쓰지 않는다');
  t.ctx.lock(false);
  const r=await p;assert.equal(r.ok,true);assert.equal(t.writes,1);
});

test('코치 토큰 색 — 유니폼·피치와 대비되는 후보(앞 후보 우선)',()=>{
  const ctx=vm.createContext({Math});
  vm.runInContext('const COACH_CANDS=["#16181d","#ffffff","#ff7a1a","#ff4fa3"];'+[fnAt(board,'function _hex2rgb(h)'),fnAt(board,'function _lab(h)'),fnAt(board,'function _labDist(a,b)'),fnAt(board,'function coachPick(uniforms,pitch)')].join('\n')+';this.pick=coachPick;this.d=_labDist;',ctx);
  const grass='#1b8044';
  assert.equal(ctx.pick(['#1a2f5c','#d12f38','#3aa6dc','#d4a017'],grass),'#ffffff','기본(남색·빨강) — 남색과 붙는 검정 대신 흰색');
  assert.equal(ctx.pick(['#ffffff','#d12f38','#3aa6dc','#d4a017'],grass),'#16181d','흰 유니폼이면 검정');
  assert.equal(ctx.pick(['#1a2f5c','#d12f38'],'#ffffff'),'#ff7a1a','흰 피치에서 흰색은 안 고르고 남색과 붙는 검정도 건너뛴다');
  assert.equal(ctx.pick(['#1a2f5c','#d12f38','#3aa6dc','#d4a017'],'#ffffff'),'#ff4fa3','금색 GK 가 있으면 주황 대신 분홍');
  [['#1a2f5c','#d12f38'],['#ffffff','#111111'],['#ff7a1a','#ffffff','#111111']].forEach(u=>{
    const c=ctx.pick(u,grass);u.forEach(x=>assert.ok(ctx.d(c,x)>25,c+' vs '+x));
  });
  /* 렌더·도크·팔레트가 같은 함수를 쓴다 */
  assert.match(board,/if\(p\.coach&&!p\.color\)\{col=coachColor\(\);txtc=autoTxt\(col\);\}/);
  assert.match(board,/var coach=id\("cmd-role-c"\);if\(coach\)\{var cc=coachColor\(\);/);
  assert.match(board,/if\(p\.coach\)return coachColor\(\);/);
});

test('훈련 편집기 «PDF» — 저장과 같은 직렬화, 보관함과 같은 종이(printDrill)',()=>{
  assert.match(board,/<button class="btn ghost" id="editorPdf"/);
  assert.match(board,/var trs=editorSerializeTrainings\(\);/,'저장도 같은 함수');
  const fn=fnAt(board,'function editorExportPdf()');
  assert.match(fn,/captureActiveTraining\(\)/);assert.match(fn,/printDrill\(d,d\.name\)/);
  assert.doesNotMatch(fn,/libSet|libWrite|saveToLib|store\.set/,'PDF 는 아무것도 저장하지 않는다');
  const ctx=vm.createContext({editorTrainings:[{draft:{name:'A',type:'train',minutes:10},scenes:[{snap:{p:1},thumb:'t1'},{snap:{p:2},thumb:'t2'}]},{draft:{name:'B',minutes:5},scenes:[],frames:[{a:1},{a:2}],animIdx:1}],
    dc:J,$:()=>({value:'카드'}),editorFileName:'',syncEpRosterUI:()=>({able:12,excluded:1,gk:1,field:11,rehab:1,out:0})});
  vm.runInContext(fnAt(board,'function editorSerializeTrainings()')+fnAt(board,'function editorCardForPdf()')+';this.card=editorCardForPdf();',ctx);
  const d=ctx.card;
  assert.equal(d.name,'카드');assert.equal(d.trainings.length,2);assert.equal(d.trainings[0].scenes.length,1);assert.equal(d.trainings[1].frames.length,2);
  assert.equal(d.minutes,15);assert.equal(d.pField,11);
});

/* ── 경기 화면(scout) ── */
function scoutCtx(over){
  const ctx=vm.createContext(Object.assign({JSON,Math,Date,localStorage:{getItem:()=>null},
    matchCarryLines:v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean),
    MB2_RV:[['attack','공격 시'],['defense','수비 시'],['attackTransition','수비→공격'],['defenseTransition','공격→수비'],['setPlay','세트피스']],
    data:{players:[{id:'p1',num:1,name:'골키'},{id:'p2',num:7,name:'윙'},{id:'p3',num:12,name:'교체'}]},
    matchStartersToSlots:()=>({ok:true,formLabel:'4-3-3',slots:[[8,50],[40,30]],picked:[{id:'p1'},{id:'p2'}],pool:[]}),
    matchLineupToken:(m,p,x,y)=>({pid:p.id,num:p.id==='p1'?'1':'7',name:p.id,pos:p.id==='p1'?'GK':'RW',x,y,gk:p.id==='p1',extra:'x'})},over||{}));
  vm.runInContext(['var MM_WD=["일","월","화","수","목","금","토"];',fnAt(scout,'function mmLinkable(d)'),fnAt(scout,'function mmDateLabel(ymd)'),fnAt(scout,'function mmFolderShared(folder,meta)'),fnAt(scout,'function matchMeetsFor(lib,mid)'),
    fnAt(scout,'function mmTok(t)'),fnAt(scout,'function mmBoardHas(b)'),fnAt(scout,'function mmOppBoard(m)'),fnAt(scout,'function mmPrepPages(m)'),fnAt(scout,'function mmStartXI(m)'),fnAt(scout,'function matchMeetParts(m)')].join('\n')
    +';this.meets=matchMeetsFor;this.shared=mmFolderShared;this.parts=matchMeetParts;this.dl=mmDateLabel;',ctx);
  return ctx;
}
test('경기 화면 — 그 경기에 이은 미팅·작전판(2.965)만, 최근 고친 순, 지운 것·다른 경기·안 이은 것 빼고',()=>{
  const c=scoutCtx();
  const lib=[{libId:'1',type:'meeting',matchRef:{mid:'m1'},savedAt:1},{libId:'2',type:'meeting',matchRef:{mid:'m2'},savedAt:9},{libId:'3',type:'board',matchRef:{mid:'m1'}},
    {libId:'4',type:'meeting',matchRef:{mid:'m1'},savedAt:5},{libId:'5',type:'meeting',savedAt:7},{libId:'6',type:'meeting',matchRef:{mid:'m1'},deletedAt:3}];
  assert.deepEqual(J(c.meets(lib,'m1').map(d=>d.libId)),['4','1','3']);
  assert.deepEqual(J(c.meets([{libId:'7',type:'train',matchRef:{mid:'m1'}}],'m1')),[],'훈련은 경기 보드에 안 뜬다');
  assert.deepEqual(J(c.meets(null,'m1')),[]);
  assert.equal(c.shared('팀 공유/세트피스',{'팀 공유':{shared:true}}),true,'상위 폴더 공유를 물려받는다');
  assert.equal(c.shared('내 폴더',{'팀 공유':{shared:true}}),false);assert.equal(c.shared('',{'':{shared:true}}),false);
  assert.equal(c.dl('2026-10-04'),'10/4 일');
});
test('경기 자료로 미팅 — 표지·상대 분석·게임플랜·경기 준비 보드, 빈 것은 고를 수 없다(2.971 — 선발 11 갈래 없음)',()=>{
  const c=scoutCtx();
  const m={id:'m1',opponent:'한빛FC',date:'2026-10-04',time:'15:00',homeAway:'홈',kind:'official',venue:'프로세스 구장',briefing:'압박은 GK 빌드업에서\n세트피스 지역+맨',
    oppConclusion:'왼쪽 뒷공간',oppStrengths:'오버래핑\n제공권',oppKeyPlayers:'10번',oppAttack:'측면 크로스',
    oppPB:{list:[['atk','공격 시'],['def','수비 시']],cur:'def',boards:{def:{frames:[{opp:[],us:[]}]},atk:{frames:[{opp:[{x:90,y:50,num:'9',pos:'ST',secret:1}],us:[]}],cur:0}}},
    attack:'짧게 빌드업',setPlay:'',captainId:'p2',startingIds:['p1','p2'],squadIds:['p1','p2','p3'],
    phaseBoards:{list:[['p1','페이지 1']],cur:'p1',boards:{p1:{us:[{x:30,y:30,num:'7'}],opp:[],drawings:[{type:'arrow',x:1,y:1,x2:2,y2:2}]}}}};
  const before=JSON.stringify(m);
  const P=c.parts(m),by=k=>P.find(p=>p.key===k);
  assert.deepEqual(J(P.map(p=>p.key)),['cover','opp','plan','pages'],'2.971 — 선발 명단이 저장돼 있어도 «선발 11» 갈래는 만들지 않는다(정하는 칸이 경기 준비에서 빠졌다)');
  assert.equal(JSON.stringify(m),before,'경기 문서는 바꾸지 않는다(읽기만)');
  const cov=by('cover').slides[0];assert.equal(cov.title,'vs 한빛FC');assert.equal(cov.points[0],'10/4 일 15:00 · 홈 · 정식');assert.ok(cov.points.includes('장소 — 프로세스 구장'));assert.ok(cov.points.includes('압박은 GK 빌드업에서'));
  const op=by('opp');assert.equal(op.ok,true);assert.equal(op.slides[0].points[0],'결론 — 왼쪽 뒷공간');assert.equal(op.slides[0].points[1],'강점 — 오버래핑 · 제공권');
  assert.equal(op.slides[0].opp.length,1,'빈 «수비 시» 대신 내용 있는 «공격 시» 장면');assert.equal(op.slides[0].opp[0].secret,undefined,'토큰은 필요한 칸만');
  const pl=by('plan');assert.deepEqual(J(pl.slides[0].points),['공격 시 — 짧게 빌드업']);assert.equal(pl.slides[0].us.length,0,'게임플랜 장에도 숨은 선발을 얹지 않는다');
  const pg=by('pages');assert.equal(pg.slides.length,1);assert.equal(pg.slides[0].title,'경기 준비 보드','기본 이름 «페이지 1» 하나면 쉬운 이름');assert.equal(pg.slides[0].draw.length,1);
  const empty=c.parts({id:'m2',opponent:'',date:''});
  assert.deepEqual(J(empty.map(p=>p.ok)),[true,false,false,false],'표지는 늘, 나머지는 내용이 있을 때만');
});
test('경기 화면은 경기 문서·보관함에 직접 쓰지 않는다 — 만들기·연결은 셸을 거쳐 보관함이',()=>{
  const a=scout.indexOf('/* ══ 2.928 · 이 경기 미팅'),b=scout.indexOf('window.addEventListener("message",e=>{const d=e.data||{};',a);
  assert.ok(a>0&&b>a);const block=scout.slice(a,b);
  assert.doesNotMatch(block,/matchQueueSave|matchSaveNow|store\.set\(|storage\.set\(|setItem\(/);
  assert.match(block,/type:"meetingFromMatch"/);assert.match(block,/type:"meetingLink"/);
  assert.match(block,/matchRole\(\)==="player"\)\{ card\.hidden=true/,'선수에게는 그리지 않는다');
  assert.match(app,/d\.source==='scout' && fScout && e\.source===fScout\.contentWindow && \(d\.type==='openMeeting'\|\|d\.type==='meetingFromMatch'\)/,'셸은 경기 프레임에서 온 것만 받는다');
  assert.match(app,/openMatchAt',mid:d\.mid\|\|''/,'보관함 «경기 열기»는 경기 id 로');
});
