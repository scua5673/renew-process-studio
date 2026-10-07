const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.959 — 보관함 › 만들기 › 미팅: 새 미팅은 기본 9장(우리 11 + 상대 11 + 공)으로 시작한다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const J=x=>JSON.parse(JSON.stringify(x));
const TITLES=['BEST 11','하이블록','미드블록','로우블록','빌드업','전진·전개','침투·마무리','코너킥 수비','코너킥 공격'];

function tplContext(){
  const a=src.indexOf('  var MEET_TPL_US=');
  const b=src.indexOf('  window.__meetTpl=');
  assert.ok(a>0&&b>a,'template block');
  const c=vm.createContext({L:30,T:30,MPP:10});
  vm.runInContext(src.slice(a,b)+';this.MEET_TPL=MEET_TPL;this.US=MEET_TPL_US;this.OP=MEET_TPL_OPP;this.snap=meetTplSnap;',c);
  return c;
}

test('nine pages in the order the coach asked for',()=>{
  const c=tplContext();
  assert.deepEqual(J(c.MEET_TPL.map(t=>t.t)),TITLES);
});

test('BEST 11 is our eleven only (2.960) · every other page has 11 + 11 and a ball · all on the pitch (runoff allowed)',()=>{
  const c=tplContext();
  assert.equal(c.US.length,11);assert.equal(c.OP.length,11);
  assert.equal(new Set(c.US.map(r=>r[0])).size,11,'our numbers unique');
  assert.equal(new Set(c.OP.map(r=>r[0])).size,11,'their numbers unique');
  const best=c.MEET_TPL[0];
  assert.equal(best.t,'BEST 11');assert.equal(best.us.length,11);assert.equal(best.op.length,0,'no opponents on BEST 11');assert.equal(best.ball,null,'no ball on BEST 11');
  for(const tp of c.MEET_TPL){
    assert.equal(tp.us.length,11,tp.t);
    if(tp!==best){assert.equal(tp.op.length,11,tp.t);assert.ok(Array.isArray(tp.ball)&&tp.ball.length===2,tp.t);}
    for(const m of tp.us.concat(tp.op,tp.ball?[tp.ball]:[])){
      assert.ok(m[0]>=-2.5&&m[0]<=107.5&&m[1]>=-2.5&&m[1]<=70.5,tp.t+' '+m);   /* 런오프 3m 안 */
    }
    /* 토큰이 서로 덮지 않게 — 선수끼리 3m 이상(대인 마크도 3m) */
    const pts=tp.us.concat(tp.op);
    for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
      const d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]);
      assert.ok(d>=2.95,tp.t+' players '+i+'/'+j+' only '+d.toFixed(2)+'m apart');
    }
  }
});

test('a page becomes an 11-a-side full-pitch snap in world units, keepers marked GK, colours from the base',()=>{
  const c=tplContext();
  const base={players:[{id:1}],equipment:[{id:2}],drawings:[{type:'line'}],tokenScale:.2,teamColors:{blue:'#123456'},area:'half',pitchView:'half',pitchSpec:'futsal',pitchN:4};
  const b11=c.snap(base,c.MEET_TPL[0]);
  assert.equal(b11.players.length,11);assert.equal(b11.players.filter(p=>p.team==='blue').length,11);assert.equal(b11.ball,null);
  const bgk=b11.players.find(p=>p.pos==='GK');
  assert.deepEqual(J([bgk.x,bgk.y]),[30+5*10,30+34*10]);   /* 미터 → 세계 좌표(1m = 10단위, 라인 밖 30) */
  const s=c.snap(base,c.MEET_TPL[1]);
  assert.equal(s.players.length,22);
  assert.equal(s.players.filter(p=>p.team==='blue').length,11);
  assert.equal(s.players.filter(p=>p.team==='red').length,11);
  assert.equal(s.players.filter(p=>p.pos==='GK').length,2);
  assert.equal(new Set(s.players.map(p=>p.id)).size,22,'ids unique');
  assert.deepEqual(J(s.equipment),[]);assert.deepEqual(J(s.drawings),[]);
  assert.equal(s.pitchTheme,'white','2.961 — meeting pitch starts white');assert.equal(s.pitchImg,null);assert.equal(s.pitchCustom,null);assert.equal(b11.pitchTheme,'white');
  assert.equal(s.pitchSpec,'fifa');assert.equal(s.area,'full');assert.equal(s.pitchView,'full');assert.equal(s.pitchN,1);
  assert.equal(s.teamColors.blue,'#123456','team colours of the board are kept');
  assert.equal(s.tokenScale,.4,'tokens not smaller than the default XI floor');
  const gk=s.players.find(p=>p.team==='blue'&&p.pos==='GK');
  assert.deepEqual(J([gk.x,gk.y]),[30+38*10,30+34*10]);   /* 하이블록 — GK 는 뒤 공간 정리(38m) */
  assert.deepEqual(J([s.ball.x,s.ball.y]),[30+98.7*10,30+35*10]);
  assert.equal(base.players.length,1,'base untouched');
});

test('corner pages put the ball at the corner flag on the right goal',()=>{
  const c=tplContext();
  const def=c.MEET_TPL.find(t=>t.t==='코너킥 수비'),att=c.MEET_TPL.find(t=>t.t==='코너킥 공격');
  assert.ok(def.ball[0]<2&&def.ball[1]<2,'their corner at our goal (left)');
  assert.ok(att.ball[0]>103&&att.ball[1]<2,'our corner at their goal (right)');
});

test('the seed builds slides like «새 슬라이드» and only on an empty meeting',()=>{
  const a=src.indexOf('  window.__meetSeed=function(base){');
  const seed=src.slice(a,src.indexOf('\n  };\n',a)+5);
  assert.match(seed,/if\(anim\.slides\.length\)return false;/);
  assert.match(seed,/out\.push\(\{pdfOrientation:po,snap:meetCap\(\),thumb:th,title:tp\.t,points:\[\]\}\)/);
  assert.match(seed,/meetIdx=0;var to=meetBind\(0,"first"\);/);
  /* add() 를 부르지 않는다 — add 는 지금 판을 앞 슬라이드에 먼저 담아(meetStore) 다음 장 판이 앞 장에 덮인다 */
  assert.equal(/\.add\(\)|meetStore\(/.test(seed),false);
  /* 들어갈 때: 빈 새 미팅이면 9장, 실패하면 예전처럼 빈 한 장 */
  const enter=src.slice(src.indexOf('  window.__ksEnter=function(){'),src.indexOf('\n',src.indexOf('  window.__ksEnter=function(){')));
  assert.match(enter,/window\.__meetBlank=false; var _seeded=false; try\{_seeded=!!\(window\.__meetSeed&&window\.__meetSeed\(_mb\)\);\}catch\(_\)\{\}/);
  assert.match(enter,/if\(!_seeded\)\{try\{loadSnap\(_mb\);\}catch\(_\)\{\} M\(\)\.add\(\);\}/);
});

test('the seed runs end to end on a stub board',()=>{
  const a=src.indexOf('  var MEET_TPL_US=');
  const b=src.indexOf('\n  };\n',src.indexOf('  window.__meetSeed=function(base){'))+5;
  let loaded=null,bound=null;
  const c=vm.createContext({window:{},L:30,T:30,MPP:10,anim:{slides:[]},meetIdx:-1,meetAutoTok:0,
    meetingPdfOrientation:()=> 'portrait',
    loadSnap:s=>{loaded=s;},boardThumbSVG:()=>'<svg/>',
    meetCap:()=>Object.assign(JSON.parse(JSON.stringify(loaded)),{orientation:'v'}),
    meetBind:(i)=>{bound=i;return null;}});
  vm.runInContext(src.slice(a,b),c);
  assert.equal(c.window.__meetSeed({players:[],teamColors:{}}),true);
  assert.equal(c.anim.slides.length,9);
  assert.deepEqual(J(c.anim.slides.map(s=>s.title)),TITLES);
  c.anim.slides.forEach((s,k)=>{assert.equal(s.pdfOrientation,'portrait');assert.equal(s.snap.orientation,'v');assert.equal(s.thumb,'<svg/>');
    if(k===0){assert.equal(s.snap.players.length,11);assert.equal(s.snap.ball,null);}else{assert.equal(s.snap.players.length,22);assert.ok(s.snap.ball);}});
  assert.equal(bound,0);assert.equal(loaded.players.length,11,'the meeting opens on BEST 11');
  assert.equal(c.window.__meetSeed({}),false,'never on a meeting that already has slides');
  assert.equal(c.anim.slides.length,9);
});
