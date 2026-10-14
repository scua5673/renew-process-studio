const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');

/* 3.018 — 커뮤니티 «프로세스» 세션의 장면을 앱이 보강한다(사용자 «속도를 늦춰 길게가 아니라 애니메이션을 더해 훈련 애니메이션 퀄리티를»).
   먼저 2호 한 세션(훈련 셋): 흐름 이어가기 · 패스·움직임 화살표 · 중간 움직임 · 실패·변형 상황. 장면은 scripts/proc-scenes/02.mjs, 짓는 것은 scripts/proc-scenes.mjs.
   보강한 세션은 앱에 실린 사본이 원본이다(목록의 own:1) — 커뮤니티는 그 세션만 사본에서 읽고, 사본 만들기는 그 세션을 덮지 않는다. */
const root=path.join(__dirname,'..');
const dir=path.join(root,'studio','packs');
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(root,'studio','board.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PROC=cut(comm,'/* ── 2.999 · 프로세스 칸 순수 구간 시작','/* ── 2.999 · 프로세스 칸 순수 구간 끝 ── */');
const LETTER=cut(board,'/* ── 2.997 · 레터 팩 순수 구간 시작','/* ── 2.997 · 레터 팩 순수 구간 끝 ── */');
function proc(){ const c=vm.createContext({}); vm.runInContext(PROC+';this.api={procRead,procItem,procMerge};',c); return c.api; }
function letter(){ const c=vm.createContext({URL}); vm.runInContext(LETTER+';this.api={letterPackRead,letterPackCard,_lpCurves};',c); return c.api; }
const text=fs.readFileSync(path.join(dir,'02.json'),'utf8'),pack=JSON.parse(text),index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
const row=index.sessions.find(s=>s.n===2),trs=pack.drills[0].trainings;
const ARROWS=['pass','run','dribble','shot'];

test('the builder is deterministic and what is committed is what it builds',async()=>{
  const {build}=await import('../scripts/proc-scenes.mjs');
  const r=await build('02',{write:false});
  assert.equal(r.text,text,'studio/packs/02.json = node scripts/proc-scenes.mjs 02');
  assert.deepEqual(plain(r.row),row,'목록의 2호 줄도');
  assert.equal(row.rev,crypto.createHash('sha1').update(text).digest('hex').slice(0,10),'지문 = 팩 내용 — 바뀌면 카드 그림 주소도 바뀐다');
});

test('session 2 is marked as the app\'s own and every training has more than twice its old scenes',()=>{
  assert.equal(row.own,1);
  assert.deepEqual(row.trainings.map(t=>t.scenes),trs.map(t=>t.frames.length),'목록의 장면 수 = 팩의 장면 수');
  assert.deepEqual(trs.map(t=>t.frames.length),[11,14,14],'예전 4 · 5 · 6');
  assert.equal(index.sessions.filter(s=>s.own).length,1,'지금은 2호 하나만(먼저 한 세션)');
  assert.deepEqual(plain(pack.drills[0].frames),plain(trs[0].frames),'카드 대표 장면 = 첫 훈련');
});

test('every scene is a sound board: same players, on the board, known arrows, short captions',()=>{
  for(const t of trs){
    const ids=t.snap.players.map(p=>p.id).sort().join(','),zone=JSON.stringify(t.snap.drawings.filter(d=>!ARROWS.includes(d.type)));
    t.frames.forEach((f,i)=>{
      const at=t.name.slice(0,8)+' 장면 '+i,sn=f.snap,last=i===t.frames.length-1;
      assert.equal(sn.players.map(p=>p.id).sort().join(','),ids,at+': 선수가 나타나거나 사라지지 않는다');
      for(const p of sn.players.concat([sn.ball]))assert.ok(p.x>=0&&p.x<=1110&&p.y>=0&&p.y<=740,at+': 판 안 '+JSON.stringify([p.id,p.x,p.y]));
      assert.equal(JSON.stringify(sn.drawings.filter(d=>!ARROWS.includes(d.type))),zone,at+': 구역 선 · 사각형은 그대로');
      const ar=sn.drawings.filter(d=>ARROWS.includes(d.type));
      assert.ok(ar.length<=3,at+': 화살표는 셋까지 '+ar.length);
      if(last)assert.equal(ar.length,0,at+': 마지막 장면엔 화살표가 없다(다음 움직임이 없다)');
      for(const d of ar){ assert.ok(d.pts.length===2||d.pts.length===3); assert.ok(['#ffffff','#ffd23f'].includes(d.color)); assert.ok(d.pts.every(q=>isFinite(q.x)&&isFinite(q.y))); }
      assert.ok(f.dur>=.8&&f.dur<=1.6,at+': 이동 시간 '+f.dur);
      if(i>0){ assert.ok(f.cap.length>=8&&f.cap.length<=30,at+': 자막 '+f.cap.length+'자 — 원래 속도로도 읽히게'); }
      for(const h of f.hl)assert.ok(sn.players.some(p=>p.id===h),at+': 강조는 판의 선수');
      assert.ok(!('__hold' in f),at+': 재생 속도는 늦추지 않는다(3.016 을 되돌림)');
    });
    assert.ok(t.frames.some(f=>f.snap.drawings.some(d=>d.type==='pass')),t.name+': 패스 화살표');
    assert.ok(t.frames.some(f=>f.snap.drawings.some(d=>d.type==='run')),t.name+': 움직임 화살표');
  }
  const t3=trs[2].frames;
  assert.ok(t3.some(f=>f.curves&&f.curves.ball&&f.curves.ball.air===1&&f.snap.drawings.some(d=>d.type==='pass'&&d.lob)),'띄운 패스: 공 높이 + 로빙 화살표');
  assert.ok(t3.some(f=>f.snap.drawings.some(d=>d.type==='shot')),'슈팅');
});

test('the viewer and the vault both take the reworked pack — curved runs and the lofted ball survive «보관함에 담기»',()=>{
  const g=proc(),l=letter(),s=g.procRead(index).find(x=>x.n===2);
  assert.equal(s.own,true);
  const dep={fields:['name','focus','minutes','sets','rpe','tags','type','snap','scenes','frames'],snap:x=>x,trainings:d=>plain(d.trainings),frames:fr=>(Array.isArray(fr)&&fr.length>1)?plain(fr):null};
  const it=g.procItem(plain(pack),s,dep);
  assert.deepEqual(plain(it.trainings).map(t=>t.frames.length),[11,14,14]);
  const info=l.letterPackRead(pack);
  assert.deepEqual(plain(info.trainings).map(t=>t.scenes),[11,14,14]);
  const c=plain(l.letterPackCard(plain(pack),{draft:d=>Object.assign({},d),snap:sn=>{ sn.equipment=sn.equipment||[]; sn.drawings=sn.drawings||[]; return sn; },thumb:()=>'<svg></svg>',id:()=>'Lnew',now:1}));
  const f6=c.trainings[2].frames[6];
  assert.deepEqual(f6.curves,{103:{mx:0,my:-10},ball:{mx:0,my:0,air:1}},'곡선 · 공 높이');
  assert.ok(f6.snap.drawings.some(d=>d.type==='pass'&&d.lob),'화살표도 그대로');
  assert.equal('curves' in c.trainings[2].frames[5],false,'곡선이 없는 장면엔 칸도 없다');
  assert.deepEqual(plain(l._lpCurves({ball:{mx:1,my:2,air:9},101:{mx:'x',my:1},'a b':{mx:1,my:1},7:{mx:3000,my:0},8:{mx:-4,my:5,air:2}})),{ball:{mx:1,my:2},8:{mx:-4,my:5}},
    '모르는 칸 · 범위 밖의 수는 버린다(공 높이는 1~3, 선수에겐 높이가 없다)');
  for(const bad of [null,[],'x',{}])assert.equal(l._lpCurves(bad),null);
});

test('refreshing the copy from the site keeps the sessions the app reworked',async()=>{
  const {keepOwn}=await import('../scripts/proc-snapshot.mjs');
  const r=keepOwn({sessions:[{n:2,own:1,v:'app'},{n:3,v:'old'},{n:9,own:1,v:'app9'}]},{type:'process-studio-pack-index',version:1,sessions:[{n:2,v:'site'},{n:3,v:'site3'},{n:4,v:'site4'}]});
  assert.deepEqual(r.sessions.map(s=>[s.n,s.v]),[[2,'app'],[3,'site3'],[4,'site4'],[9,'app9']]);
  assert.equal(r.type,'process-studio-pack-index');
  assert.deepEqual(keepOwn(null,{sessions:[{n:5}]}).sessions,[{n:5}]);
  const src=fs.readFileSync(path.join(root,'scripts','proc-snapshot.mjs'),'utf8');
  assert.match(src,/if \(s\.own === 1\) \{[^\n]*\n      files\.set\(nn\(s\.n\) \+ '\.json', fs\.readFileSync\(path\.join\(out, nn\(s\.n\) \+ '\.json'\), 'utf8'\)\);/,'보강한 세션의 팩은 지금 사본 그대로');
});
