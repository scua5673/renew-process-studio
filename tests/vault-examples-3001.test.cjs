const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.001 — 보관함 예시(사용자 «보관함에 예시로 전부 하나씩 — 훈련도 미팅도 세트피스도 · 처음 들어온 사람들이 잘 볼 수 있게 · 제대로 만들어줘 조사해서»
   · «프로세스 폴더를 따로 만들어서 거기에 다 넣어줘 기본으로 있는것 처럼» · «모든 사용자에게 한 번씩»).
   vault-examples.js 가 종류마다 하나를 만든다 — 패턴북 · 훈련 · 세트피스 · 작전판 · 미팅. board.html 은 담기만 한다(«프로세스» 폴더 · ex 표식 · libTurn).
   여기서는 예시가 앱이 여는 모양 그대로인지 본다: 판 좌표 · 장면(같은 토큰 id) · 패턴북 국면 · 세트피스 판 · 미팅 A4 한 장 분량 · 글자 상한. */
const X=require('../studio/vault-examples.js');
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const c=vm.createContext({});
vm.runInContext(cut('const EP_STD_MOMENTS=[','\n/* ══ 2.282').replace('const EP_STD_MOMENTS','this.MO'),c);
const MO=c.MO;
const FOCUS=['warm','bp','poss','bpo','tr_att','tr_def','set','phys','tech','rec'];
const all=()=>X.keys().map(k=>X.make(k));
/* 한 항목 안의 모든 장면 스냅 — [이름, 스냅, 같은 줄의 장면들] */
function scenesOf(it){ const out=[];
  const run=(label,frames)=>{ (frames||[]).forEach((f,i)=>out.push({label:label+'#'+i,snap:f.snap,frames})); };
  out.push({label:'top',snap:it.snap,frames:null});
  if(it.frames)run('frames',it.frames);
  (it.pages||[]).forEach((p,i)=>{ out.push({label:'page'+i,snap:p.snap,frames:null}); if(p.anim)run('page'+i,p.anim.frames); });
  (it.trainings||[]).forEach((t,i)=>{ out.push({label:'tr'+i,snap:t.snap,frames:null}); run('tr'+i,t.frames); });
  (it.slides||[]).forEach((s,i)=>{ out.push({label:'slide'+i,snap:s.snap,frames:null}); run('slide'+i,s.frames); });
  return out; }

test('one example per kind, in the order a newcomer should meet them',()=>{
  assert.deepEqual(X.keys(),['book','train','setpiece','board','meeting']);
  assert.equal(X.FOLDER,'프로세스');
  const L=X.list();
  assert.deepEqual(L.map(x=>x.label),['패턴북','훈련 세션','세트피스','작전판','미팅 자료']);
  assert.ok(L.every(x=>/^<svg class="vs-pic" width="84" height="56"/.test(x.pic)&&!/<script|on\w+=/i.test(x.pic)),'small, inert pictures');
  assert.deepEqual(all().map(it=>[it.ex,it.type,it.book||0,it.folder]),[['book','board',1,'프로세스'],['train','train',0,'프로세스'],['setpiece','setpiece',0,'프로세스'],['board','board',0,'프로세스'],['meeting','meeting',0,'프로세스']]);
});

test('make() always hands out a fresh copy without vault identity',()=>{
  const a=X.make('book'),b=X.make('book');
  a.pages[0].name='바꿈'; a.pages[0].anim.frames[0].snap.players[0].x=1;
  assert.notEqual(b.pages[0].name,'바꿈'); assert.notEqual(b.pages[0].anim.frames[0].snap.players[0].x,1);
  for(const it of all()){ for(const k of ['libId','savedAt','createdBy','createdByEmail','createdByName','tpl','id'])assert.equal(k in it,false,it.ex+' has '+k); }
  assert.equal(X.make('nope'),null);
});

test('names and texts fit the app limits',()=>{
  for(const it of all()){
    assert.ok(it.name.length<=40,it.name); assert.ok(it.tags.includes('예시'));
    assert.ok(typeof it.overview==='string'&&it.overview.length>10,'the preview pane has something to say: '+it.ex);
  }
  const book=X.make('book');
  for(const p of book.pages){
    assert.ok(p.name.length<=40&&p.grp.length<=20&&p.call.length<=60&&p.when.length<=200,p.name);
    for(const f of p.anim.frames){ if('sg' in f)assert.ok(typeof f.sg==='string'&&f.sg.length<=20,f.sg); if(f.sgn)assert.ok(f.sgn.length<=140,f.sgn); if(f.cap)assert.ok(f.cap.length<=80,f.cap); }
  }
  for(const t of X.make('train').trainings.concat(X.make('setpiece').trainings)){
    assert.ok(t.name.length<=60&&t.method.length+t.coaching.length+t.spDesc.length<=4000,t.name);
    for(const f of t.frames)if(f.cap)assert.ok(f.cap.length<=80,f.cap);
  }
});

test('every scene is a board the app can load: world coordinates, unique ids, view keys, same tokens across a scene line',()=>{
  for(const it of all()){
    for(const s of scenesOf(it)){
      const sn=s.snap,where=it.ex+' '+s.label;
      assert.ok(sn&&Array.isArray(sn.players)&&Array.isArray(sn.equipment)&&Array.isArray(sn.drawings),where);
      for(const k of ['pitchSpec','orientation','area','pitchView','fieldMode','pitchN','pitchTheme','gridType','tokenScale','tokV','label'])assert.ok(k in sn,where+' lacks '+k);
      assert.equal(sn.gridType,'off',where); assert.equal(sn.tokV,2,where); assert.ok(sn.tokenScale>0.3&&sn.tokenScale<0.5,where);
      const ids=sn.players.map(p=>p.id).concat(sn.equipment.map(e=>e.id));
      assert.equal(new Set(ids).size,ids.length,where+' duplicate ids');
      for(const p of sn.players.concat(sn.equipment)){ assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1110&&p.y>=0&&p.y<=740,where+' '+JSON.stringify(p)); assert.equal(typeof p.id,'number'); }
      for(const p of sn.players){ assert.ok(['blue','red','yellow'].includes(p.team)&&typeof p.num==='string'&&p.num,where); if(p.pos==='GK')assert.equal(p.num,'1'); }
      if(sn.ball)assert.ok(sn.ball.x>=0&&sn.ball.x<=1110&&sn.ball.y>=0&&sn.ball.y<=740,where+' ball');
      for(const d of sn.drawings){ assert.ok(['pass','run','dribble','shot','line','rectline','rectdash','ellipse','text'].includes(d.type),where+' '+d.type);
        assert.ok(Array.isArray(d.pts)&&d.pts.length>=1&&d.pts.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)),where); if(d.label)assert.ok(d.label.length<=24,d.label); }
    }
    /* 장면 줄 — 같은 토큰이 장면 사이를 움직인다(보간은 id 로 짝짓는다) */
    for(const s of scenesOf(it))if(s.frames&&s.frames.length>1){ const sig=f=>f.snap.players.map(p=>p.id).sort((a,b)=>a-b).join(','); assert.ok(s.frames.every(f=>sig(f)===sig(s.frames[0])),it.ex+' '+s.label+' tokens change between scenes'); }
  }
});

test('the pattern book: one sequence per phase on the training-card table, stages on the scenes, top level mirrors the first sequence',()=>{
  const b=X.make('book');
  assert.equal(b.pages.length,6);
  const keys=b.pages.map(p=>p.mo+'/'+p.ph);
  assert.deepEqual(keys,['ao/std_ao_1','ao/std_ao_3','do/std_do_1','dt/std_dt_1','at/std_at_1','set/std_set_2']);
  for(const p of b.pages){ const m=MO.find(x=>x.key===p.mo); assert.ok(m,'phase '+p.mo); assert.ok(m.phases.some(x=>x.id===p.ph),'sub-phase '+p.ph); assert.equal(p.grp,m.name,'the phase name is mirrored for older builds');
    const fr=p.anim.frames; assert.ok(fr.length>=3,p.name); assert.equal(typeof fr[0].sg,'string','the first scene starts a stage'); assert.deepEqual(p.snap,fr[0].snap); assert.equal(p.anim.active,0); }
  assert.deepEqual(b.snap,b.pages[0].snap); assert.equal(b.frames.length,b.pages[0].anim.frames.length);
  assert.deepEqual([b.frames[0].__t,b.frames[0].__tc,b.frames[0].__hold],['','#e23b3b',0.6]);
  /* 단계 이름 — 사람이 읽는 차례 */
  assert.deepEqual(b.pages.map(p=>p.anim.frames.filter(f=>typeof f.sg==='string').map(f=>f.sg)),[['벌리기','6번 경유','전진'],['오버랩','컷백'],['신호','가두기','탈취'],['상실','세 명 압박','다시 공격'],['탈취','전진','3v2 마무리'],['자리','니어 걷어내기','역습']]);
});

test('the training card: three trainings on their own boards, method and coaching points the editor shows',()=>{
  const t=X.make('train');
  assert.deepEqual(t.trainings.map(x=>[x.name,x.snap.pitchSpec,x.minutes,x.frames.length]),[['4v2 론도 — 두 터치','grid20',15,4],['포지셔닝 게임 4v4+3','grid30',20,4],['하이 프레스를 풀어라 — 8v6','fifa',25,4]]);
  assert.equal(t.minutes,60); assert.deepEqual(t.roster,{gk:2,field:16,rehab:0,out:0});
  for(const x of t.trainings){ assert.equal(x.type,'train'); assert.ok(FOCUS.includes(x.focus)); assert.ok(x.rpe>=1&&x.rpe<=10);
    assert.ok(x.method&&x.coaching&&x.overview&&x.setup,'editor fields and the field sheet (overview · setup) have text: '+x.name);
    assert.ok(/^1\. /.test(x.coaching),'coaching points are numbered'); assert.deepEqual(x.snap,x.frames[0].snap);
    for(const id of x.gmPhases)assert.ok(MO.some(m=>m.phases.some(p=>p.id===id)),id); assert.equal(x.gmPhases.length,x.gmPhaseNames.length); }
  assert.deepEqual(t.snap,t.trainings[0].snap); assert.deepEqual(t.frames,t.trainings[0].frames,'the vault preview ▶ plays the first training');
});

test('the set piece: the dedicated vertical field in every scene, an attacking corner, a call',()=>{
  const s=X.make('setpiece'),tr=s.trainings[0];
  assert.equal(s.trainings.length,1); assert.equal(tr.type,'setpiece');
  assert.deepEqual(tr.sp,{side:'for',kind:'corner',spot:'R'}); assert.ok(tr.spCall&&tr.spCall.length<=40);
  assert.ok(tr.spDesc&&tr.coaching,'set-piece description and «주의 · 상대 대응»');
  for(const f of tr.frames){ const n=f.snap; assert.deepEqual([n.orientation,n.spFlip,n.area,n.pitchView,n.fieldMode,n.pitchTheme],['v',true,'half','half','setpiece','white']);
    /* 세트피스 판은 왼쪽 골 앞 40m 만 보인다 — 공격 선수는 그 안에 */
    for(const p of n.players)assert.ok(p.x<=430,'inside the set-piece field: '+JSON.stringify(p)); }
  assert.ok(tr.frames.length===4&&tr.frames.every(f=>f.cap),'four captioned scenes');
});

test('the board: two pages, the first animated — a static page carries no scene list, like the app saves it',()=>{
  const b=X.make('board');
  assert.deepEqual(b.pages.map(p=>p.name),['공격할 때 — 3-2-5','수비할 때 — 4-1-4-1 미드 블록']);
  assert.equal(b.pages[0].anim.frames.length,3); assert.equal('anim' in b.pages[1],false);
  assert.deepEqual(b.snap,b.pages[0].snap); assert.equal(b.frames.length,3);
});

test('the meeting: five portrait slides, one A4 page each, two animated',()=>{
  const m=X.make('meeting');
  assert.equal(m.slides.length,5);
  for(const s of m.slides){ assert.equal(s.pdfOrientation,'portrait'); assert.equal(s.snap.orientation,'v','the slide board matches the page');
    assert.ok(s.title.length<=30&&s.points.length===2&&s.points.every(p=>p.length<=30),'title + two short lines fit one portrait page (4 rows with the item name): '+s.title);
    assert.equal('pageBrand' in s,false,'no brand line — the editor would copy one across slides on open');
    assert.ok(s.players===undefined); if(s.frames){ assert.ok(s.frames.length>=2); assert.deepEqual(s.snap,s.frames[0].snap); } }
  assert.deepEqual(m.slides.map(s=>(s.frames||[]).length),[0,3,2,0,0]);
  assert.deepEqual(m.snap,m.slides[0].snap);
  for(const s of m.slides)for(const p of s.snap.players)assert.equal(p.name,undefined,'no names — the meeting upgrade would spread them');
});

test('board.html: examples are added in one turn into «프로세스», never twice, and never for view-only members',()=>{
  const add=cut('  function vaultAddExamples(keys,openKey){','  /* ── 3.001 · «프로세스» 폴더를 모든 사용자에게 한 번');
  assert.match(add,/if\(!psVaultRequireLogin\(\)\)return Promise\.resolve\(false\);/);
  assert.match(add,/if\(!vxExCanWrite\(\)\)\{/,'view-only cannot write the vault');
  assert.match(add,/return libTurn\(function\(\)\{return libGet\(\)\.then\(function\(lib\)\{/,'one turn: read and write together');
  assert.match(add,/if\(have\[it\.ex\]\)\{ if\(it\.ex===openKey\)open=have\[it\.ex\]; return; \}/,'an example already in the vault is opened, not copied again');
  assert.match(add,/it\.libId="V"\+now\.toString\(36\)/,'never a T… id (that reads as a built-in template)');
  assert.match(add,/stampCreator\(it\);/);
  assert.match(add,/return libSet\(add\.concat\(lib\)\)/);
  assert.match(src,/function vxExCanWrite\(\)\{ try\{ return !document\.body\.classList\.contains\('ps-viewonly'\); \}catch\(_\)\{ return true; \} \}/);
  assert.match(src,/<script src="vault-examples\.js" defer><\/script>/);
  /* 팀 공간은 «내 자료»로 열린다 — 통째로 빈 보관함이면 거기서도 첫 화면 */
  assert.match(src,/if\(!q&&!lib\.length&&\(cf===""\|\|cf==="__all"\|\|cf==="__mine"\)\)items\.appendChild\(vaultStarter\(\)\);/);
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
  assert.match(sw,/'\/studio\/vault-examples\.js'/,'the service worker caches the examples');
});

test('board.html: opening is not editing — thumbnails drawn on the side do not raise «변경 있음»; a stored set piece keeps its vertical field',()=>{
  const th=cut('window.__snapToThumb=function(snap,opts){','\n};');
  assert.match(th,/var _cap=window\.__psThumbCapturing;\s*try\{ window\.__psThumbCapturing=true; loadSnap\(snap\|\|\{\}\); window\.__psThumbCapturing=_cap; return boardThumbSVG\(\); \}/,'the flag is up while the board is swapped, down while drawing (boardThumbSVG returns the last picture when it is up)');
  assert.match(th,/finally\{ window\.__psThumbCapturing=true; try\{ loadSnap\(cur\); \}catch\(_\)\{\} window\.__psThumbCapturing=_cap; \}/);
  assert.match(src,/if\(state\.fieldMode==="setpiece"\)autoOrient=false;/);
  assert.match(src,/"#ksStrip \.ksc \.ktb>svg\{width:100%;height:100%;\}"/,'only the slide picture fills its cell, not the ball inside it');
  /* 공 토큰(안쪽 svg 28×28)은 어느 썸네일 칸에서도 칸만큼 커지지 않는다 — 앱 화면과 인쇄 문서 셋 */
  const ball='g.token>svg[width="28"][height="28"]{width:28px!important;height:28px!important}';
  assert.equal(src.split(ball).length-1,4,'app css + PRINT_B_CSS + DRILL_PDF_CSS + FIELD_SHEET_CSS');
  for(const k of ['const PRINT_B_CSS=`','const DRILL_PDF_CSS=`','const FIELD_SHEET_CSS=`'])assert.ok(cut(k,'`;').includes(ball),k);
});

test('board.html: every user gets the «프로세스» folder once — per account and workspace, from the vault screen, never back after a delete',()=>{
  const seed=cut('  function vxSeedSoon(){','  /* ══ 3.001 · 보관함 예시 끝 ══ */');
  assert.match(seed,/if\(_vxSeeding\|\|window\.__csView!=="session"\)return;/,'only on the vault screen — the thumbnails swap the board for a moment');
  assert.match(seed,/if\(document\.body\.classList\.contains\("editing"\)\|\|!psVaultUnlocked\(\)\)return;/,'only once the account data is open');
  assert.match(seed,/var who=vxSeedWho\(\); if\(!who\|\|vxSeedMap\(\)\[who\]\|\|!vxEx\(\)\|\|!vxExCanWrite\(\)\)return;/,'once per user and workspace on this device, never for view-only');
  assert.match(seed,/if\(tomb\[vxSeedId\(k\)\]\)return;/,'a deleted example (this device) is not added again');
  assert.match(seed,/it\.libId=vxSeedId\(k\); it\.savedAt=VX_SEED_AT-i\*60000; stampCreator\(it\);/,'a fixed number per user and an old date — another device\'s delete wins the merge, two devices meet on one row');
  assert.match(seed,/if\(d&&d\.ex\)have\[d\.ex\]=1; if\(d&&d\.libId\)have\["#"\+d\.libId\]=1;/,'an example already there is not doubled');
  assert.match(seed,/return libSet\(lib\.concat\(add\)\)/,'appended — old-dated examples never stand in front of a card added meanwhile (letter pack)');
  assert.match(seed,/vxSeedToast\("«"\+X\.FOLDER\+"» 폴더에 예시 "\+r\.n\+"개가 준비되어 있어요/,'the notice waits for another toast');
  assert.match(seed,/if\(t&&t\.getAttribute\("aria-hidden"\)==="false"&&n<10\)\{ setTimeout\(function\(\)\{ vxSeedToast\(msg,n\+1\); \},400\); return; \}/,'never overwrites «훈련 3개를 보관함에 담았어요»');
  assert.match(seed,/vxSeedMark\(who\);[\s\S]*if\(!r\.was\)\{ try\{ var cf=libFilter\.folder\|\|""; if\(cf===""\|\|cf==="__all"\|\|cf==="__mine"\)libFilter\.folder=X\.FOLDER; \}catch\(_\)\{\} \}/,'a newcomer lands in the folder; an existing user keeps their view');
  assert.match(seed,/\},function\(\)\{ return false; \}\);   \/\* 실패하면 표식을 남기지 않는다/,'a failed write is retried next time');
  assert.match(src,/function vxSeedId\(key\)\{ return "Vpx"\+String\(psMyUid\(\)\)\.replace\(\/\[\^a-z0-9\]\/gi,""\)\.slice\(0,12\)\+"-"\+key; \}/,'team members never share a number (one row per member)');
  assert.match(src,/var VX_SEED_KEY="ps_vault_px_v1",VX_SEED_AT=Date\.UTC\(2026,0,1\),_vxSeeding=false;/);
  assert.match(cut('  renderDrillFiles=function(){','  /* ── 빈 보관함 스타터:'),/psVaultReadForRender\(\)\.then\(function\(lib\)\{if\(!lib\)return; try\{vxSeedSoon\(\);\}catch\(_\)\{\}/,'the vault render asks for it');
  /* 동기화 병합 — 서버가 더 최신이면(지운 기록 포함) 서버가 이긴다: 옛 날짜의 예시는 다른 기기의 삭제를 이기지 못한다 */
  const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
  assert.match(sync,/if\(srvStamp\(s\)>=lt\)\{ if\(s\.deleted_at&&s\.deleted_at>=\(s\.saved_at\|\|0\)\)delLocal\.push\(id\); else pullIds\.push\(id\); return; \}/);
});
