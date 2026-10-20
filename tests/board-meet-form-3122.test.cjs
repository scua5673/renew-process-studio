'use strict';
/* 3.122 — 새 미팅 «포메이션 고르기»(studio/board-meet-form.js) · 미팅 유니폼은 모든 슬라이드에(studio/board-tweaks.js).
   사용자 «시작할때 모달이 떠서 우리팀 포메이션, 상대 팀 포메이션 적용해서 페이지 마다 제대로 적용시켜줘» ·
   «미팅에서 우리팀 상대 팀 유니폼 바꾸면 모든 페이지에 적용되게». 실제 판은 tests/browser/meeting-formation.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MF=require('../studio/board-meet-form.js'),M8=require('../studio/board-meet-8.js'),TW=require('../studio/board-tweaks.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const B=read('studio/board.html');
const FORM=eval('('+B.slice(B.indexOf('const FORM={')+11,B.indexOf('\n};',B.indexOf('const FORM={'))+2)+')');
const T=new Function(B.slice(B.indexOf('var MEET_TPL_US='),B.indexOf('function meetTplPt'))+';return {US:MEET_TPL_US,OP:MEET_TPL_OPP,TPL:MEET_TPL};')();
const G={mpp:10,cx:555,cy:370};
// board.html meetTplSnap 과 같은 판(11인제 · 판 왼쪽 위 30,30)
function snap11(tp){let id=1001;const pl=[],pt=m=>({x:Math.round((30+m[0]*10)*10)/10,y:Math.round((30+m[1]*10)*10)/10});
  tp.us.forEach((m,i)=>{const q=pt(m),r=T.US[i];pl.push({id:id++,team:'blue',num:String(r[0]),pos:r[1],x:q.x,y:q.y});});
  tp.op.forEach((m,i)=>{const q=pt(m),r=T.OP[i];pl.push({id:id++,team:'red',num:String(r[0]),pos:r[1],x:q.x,y:q.y});});
  return {pitchSpec:'fifa',players:pl,ball:tp.ball?pt(tp.ball):null,orientation:'v',teamColors:{blue:'#1e5bc6'}};}
const S11=T.TPL.map(tp=>({title:tp.t,snap:snap11(tp)})),S8=M8.slides({},false,'h',G,0.4);
const meters=(sn)=>{const P=MF.PITCH[MF.fmtOf(sn)],l=G.cx-P.len*G.mpp/2,t=G.cy-P.wid*G.mpp/2;return sn.players.map(p=>({team:p.team,num:p.num,pos:p.pos,id:p.id,x:(p.x-l)/G.mpp,y:(p.y-t)/G.mpp}));};
const lab=(sn,tm)=>sn.players.filter(p=>p.team===tm).map(p=>p.num+p.pos);

test('the lists: 11-a-side and 8-a-side formations the board knows, defaults = the old 9 slides',()=>{
  assert.deepEqual(MF.DEF,{'11':{us:'433',op:'442'},'8':{us:'232',op:'331'}});
  for(const f of ['11','8'])for(const k of MF.LIST[f])assert.equal(FORM[k].length,f==='11'?11:8,k);
  assert.equal(MF.label('4231'),'4-2-3-1');
  assert.deepEqual(MF.norm(FORM,'11',{us:'352',op:'f22'}),{us:'352',op:'442'},'풋살 · 모르는 키는 기본');
  assert.deepEqual(MF.norm(FORM,'8',{us:'433'}),{us:'232',op:'331'},'11인제 키를 8인제에 쓰지 않는다');
  assert.equal(MF.kindOf('BEST 11'),'best');assert.equal(MF.kindOf('BEST 8'),'best');assert.equal(MF.kindOf('코너킥 수비'),'corner');assert.equal(MF.kindOf('빌드업'),'play');
});

test('template players map to the default FORM by role: us by number, the opponent mirrored (ST pair by side)',()=>{
  const us=S11[2].snap.players.filter(p=>p.team==='blue'),op=S11[2].snap.players.filter(p=>p.team==='red');
  assert.deepEqual(MF.baseIdx(us,FORM['433'],false).map(j=>FORM['433'][j][2]),us.map(p=>+p.num),'우리 = 같은 번호');
  assert.deepEqual(MF.baseIdx(op,FORM['442'],true),[0,4,3,2,1,8,7,6,5,10,9]);
  // 짝지은 기본 자리가 판에서도 같은 쪽: 상대는 v 가 클수록 판 위(y 작음)
  const m=meters(S11[2].snap).filter(p=>p.team==='red'),bi=MF.baseIdx(op,FORM['442'],true);
  for(let i=1;i<11;i++)for(let j=1;j<11;j++)if(FORM['442'][bi[i]][0]===FORM['442'][bi[j]][0]&&FORM['442'][bi[i]][1]>FORM['442'][bi[j]][1]+0.1)assert.ok(m[i].y<m[j].y+8,op[i].pos+' / '+op[j].pos);
  const u8=S8[2].snap.players.filter(p=>p.team==='blue'),o8=S8[2].snap.players.filter(p=>p.team==='red');
  assert.deepEqual(MF.baseIdx(u8,FORM['232'],false),[0,1,2,3,4,5,6,7]);assert.deepEqual(MF.baseIdx(o8,FORM['331'],true),[0,3,2,1,6,5,4,7]);
});

test('default formations leave the slides exactly as before (null = no change)',()=>{
  for(const s of S11)assert.equal(MF.remapSnap(s.snap,s.title,{us:'433',op:'442'},G,FORM),null);
  for(const s of S8)assert.equal(MF.remapSnap(s.snap,s.title,{us:'232',op:'331'},G,FORM),null);
  assert.equal(MF.remapSnap(S11[1].snap,S11[1].title,{},G,FORM),null,'고르지 않음 = 기본');
  // 한 팀만 바꾸면 다른 팀은 한 칸도 움직이지 않는다
  const r=MF.remapSnap(S11[2].snap,S11[2].title,{us:'433',op:'352'},G,FORM);
  assert.deepEqual(r.players.filter(p=>p.team==='blue'),S11[2].snap.players.filter(p=>p.team==='blue'));
});

test('every formation pair, every slide: numbers · positions of the chosen shape, same player across slides, GK and ball kept, nobody stacked or off the pitch',()=>{
  for(const [fmt,SL] of [['11',S11],['8',S8]]){
    const P=MF.PITCH[fmt],gap=fmt==='11'?[4.99,3.19]:[3.79,2.79];
    for(const us of MF.LIST[fmt])for(const op of MF.LIST[fmt]){
      const out=SL.map(s=>({s,r:MF.remapSnap(s.snap,s.title,{us,op},G,FORM)||s.snap}));
      out.forEach(({s,r},i)=>{
        const tag=fmt+' '+us+' v '+op+' «'+s.title+'»';
        assert.deepEqual(r.players.map(p=>p.id),s.snap.players.map(p=>p.id),tag+' ids');
        if(us!==MF.DEF[fmt].us)assert.deepEqual(lab(r,'blue'),FORM[us].map(e=>e[2]+e[3]),tag+' 우리 번호 · 포지션');
        if(op!==MF.DEF[fmt].op&&i>0)assert.deepEqual(lab(r,'red'),FORM[op].map(e=>e[2]+e[3]),tag+' 상대 번호 · 포지션');
        assert.deepEqual(r.ball,s.snap.ball,tag+' 공');
        const a=meters(r),b=meters(s.snap);
        for(const tm of ['blue','red']){const g=a.find(p=>p.team===tm&&p.pos==='GK'),g0=b.find(p=>p.team===tm&&p.pos==='GK');if(g0)assert.deepEqual([g.x,g.y],[g0.x,g0.y],tag+' 골키퍼');}
        if(MF.kindOf(s.title)==='corner'){const k=x=>x.map(p=>p.team+Math.round(p.x*10)+','+Math.round(p.y*10)).sort();assert.deepEqual(k(a),k(b),tag+' 코너킥 자리 그대로');return;}
        // 공을 가진 선수(기본 판에서 공 3m 안)가 있던 자리에 같은 팀 선수가 있다
        if(s.snap.ball){const bm=meters({...s.snap,players:[{...s.snap.ball,team:'ball'}]})[0],h=b.filter(p=>Math.hypot(p.x-bm.x,p.y-bm.y)<3).sort((p,q)=>Math.hypot(p.x-bm.x,p.y-bm.y)-Math.hypot(q.x-bm.x,q.y-bm.y))[0];
          if(h)assert.ok(a.some(p=>p.team===h.team&&Math.hypot(p.x-h.x,p.y-h.y)<0.2),tag+' 공 가진 선수');}
        a.forEach(p=>{if(p.pos==='GK')return;assert.ok(p.x>=P.mx-0.01&&p.x<=P.len-P.mx+0.01&&p.y>=P.my-0.01&&p.y<=P.wid-P.my+0.01,tag+' 운동장 안 '+JSON.stringify(p));});
        for(let x=0;x<a.length;x++)for(let y=x+1;y<a.length;y++){const d=Math.hypot(a[x].x-a[y].x,a[x].y-a[y].y);
          assert.ok(d>=(a[x].team===a[y].team?gap[0]:gap[1])-0.06,tag+' 겹침 '+a[x].team+a[x].num+'/'+a[y].team+a[y].num+' '+d.toFixed(2));}
      });
    }
  }
});

test('each slide keeps its phase: high block high, low block deep, build-up from our goal — for every shape',()=>{
  const cbX=(sn,tm)=>{const a=meters(sn).filter(p=>p.team===tm&&/CB$/.test(p.pos));return a.reduce((t,p)=>t+p.x,0)/a.length;};
  const front=(sn,tm)=>{const a=meters(sn).filter(p=>p.team===tm&&p.pos!=='GK');return Math.max(...a.map(p=>p.x));};
  for(const us of MF.LIST['11'])for(const op of MF.LIST['11']){
    const r=S11.map(s=>MF.remapSnap(s.snap,s.title,{us,op},G,FORM)||s.snap),tag=us+' v '+op;
    assert.ok(cbX(r[1],'blue')>44,tag+' 하이블록 우리 센터백 '+cbX(r[1],'blue'));
    assert.ok(cbX(r[3],'blue')<17,tag+' 로우블록 우리 센터백 '+cbX(r[3],'blue'));
    assert.ok(cbX(r[2],'blue')>cbX(r[3],'blue')+8&&cbX(r[1],'blue')>cbX(r[2],'blue')+8,tag+' 높이 차례');
    assert.ok(cbX(r[1],'red')>88,tag+' 하이블록 상대 수비는 자기 골 앞');
    assert.ok(front(r[6],'blue')>88,tag+' 마무리 — 우리 공격이 상자 안');
    assert.ok(cbX(r[4],'blue')<20,tag+' 빌드업은 우리 골대부터');
  }
});

test('preview picture is plain numbers and fixed words (no names, bad colours fall back)',()=>{
  const r=MF.remapSnap(S11[2].snap,S11[2].title,{us:'4231',op:'352'},G,FORM);
  r.players[0].name='<img src=x onerror=alert(1)>';
  const svg=MF.previewSVG(r,G,{blue:'red;x:1',red:'#ffffff'});
  assert.equal((svg.match(/<circle/g)||[]).length,22+1+1,'선수 22 · 공 · 센터서클');
  assert.doesNotMatch(svg,/img|onerror|red;x/);assert.match(svg,/fill="#1e5bc6"/);assert.match(svg,/fill="#ffffff" stroke="#5e6675"/,'밝은 색은 어두운 테두리');
});

test('remembered choice per size of game',()=>{
  const m=new Map(),ls={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)};
  MF.writeMem(ls,'11',{us:'4231',op:'352'});MF.writeMem(ls,'8',{us:'241',op:'322'});
  assert.deepEqual(MF.readMem(ls),{fmt:'8','11':{us:'4231',op:'352'},'8':{us:'241',op:'322'}});
  m.set(MF.KEY,'{bad');assert.deepEqual(MF.readMem(ls),{});
});

test('meeting kit: other slides and their scenes get the new kit, «이 슬라이드만» puts back the old one',()=>{
  const sl=[{snap:{teamColors:{blue:'#111'}}},{snap:{teamColors:{blue:'#111'},gkColors:{blue:'#0f0'}},frames:[{snap:{teamColors:{blue:'#111'}}},{snap:{}}]},{snap:{teamColors:{blue:'#e85a9b'}}}];
  const kit={teamColors:{blue:'#e85a9b',red:'#d71920'},gkColors:{blue:'#0f0'}};
  const recs=TW.spreadKit(sl,kit,0,TW.KIT_KEYS);
  assert.equal(recs.length,2,'지금 슬라이드(0)는 판에 이미 있다');
  assert.deepEqual(sl[1].snap.teamColors,kit.teamColors);assert.deepEqual(sl[1].frames.map(f=>f.snap.teamColors),[kit.teamColors,kit.teamColors]);
  assert.deepEqual(sl[2].snap.teamColors,kit.teamColors);assert.deepEqual(sl[0].snap.teamColors,{blue:'#111'});
  assert.notEqual(sl[1].snap.teamColors,kit.teamColors,'사본');
  TW.undoPitch(recs);
  assert.deepEqual(sl[1].snap.teamColors,{blue:'#111'});assert.deepEqual(sl[1].frames[1].snap,{});assert.deepEqual(sl[2].snap.teamColors,{blue:'#e85a9b'});
  assert.equal(TW.putKit({teamColors:{blue:'#1'}},{teamColors:{blue:'#1'}}),null,'같으면 바꾸지 않는다');
  const src=read('studio/board-tweaks.js');
  assert.match(src,/win\.kitPropagateIfChanged = g/);assert.match(src,/before != null && win\._kitBase !== before/,'보드가 «바뀌었다»고 본 때만');
  assert.deepEqual(TW.KIT_KEYS,JSON.parse(B.match(/var KIT_KEYS=(\[[^\]]*\])/)[1]),'보드의 유니폼 칸과 같다');
  assert.match(src,/P\.eachOther = function \(\) \{ return 0; \};/,'미팅에서는 작업 보드 페이지를 건드리지 않는다');assert.match(B,/function psEachSnapAll\(fn\)/);
  assert.match(B,/function kitPropagateIfChanged\(\)/);assert.match(B,/var _kitBase=null;/,'window 속성(var) — 감싼 쪽이 읽는다');
});

test('wired: after board-meet-8 (wraps on top of it), service worker, storage key, budget, version',()=>{
  const sw=read('sw.js'),keys=read('studio/storage-keys.js');
  const a=B.indexOf('<script src="board-meet-8.js"></script>'),b=B.indexOf('<script src="board-meet-form.js"></script>');
  assert.ok(a>0&&b>a,'board-meet-8 다음');
  assert.ok(sw.includes("'/studio/board-meet-form.js'"));assert.match(keys,/\['ps_meet_form_v1','device','ls','pref','board-meet-form\.js'\]/);
  assert.ok(Buffer.byteLength(B)<=2560000,'board.html budget '+Buffer.byteLength(B));
  assert.match(B,/window\.__meetSeed=function\(base\)/);assert.match(B,/window\.__meetingFromMatch=function\(p\)/);assert.match(B,/window\.__meetTplSlides=function\(base,skipFirst,oh\)/);
  const v=+(sw.match(/const CACHE = 'process-3\.(\d{3})'/)||[])[1];assert.ok(v>=122);
  assert.match(read('studio/release-notes.js'),/v3\.122 · 새 미팅을 우리 · 상대 포메이션으로 시작해요/);
});
