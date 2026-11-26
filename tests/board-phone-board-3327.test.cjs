// 3.327 폰보드 — 순수 규칙(좌표 · 판 만들기 · 다시 고칠 수 있는 판 · 고치면 다른 칸은 그대로)과 배선.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../studio/board-phone-board.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('editor metres and board world coordinates round-trip; own goal is the low-x end',()=>{
  for(const n of ['11','8','5']){
    const sp=P.SPECS[n];
    for(const [x,y] of [[0,0],[sp.w,sp.h],[sp.w/2,sp.h/2],[sp.w*0.3,sp.h*0.8]]){
      const w=P.world(n,x,y),b=P.local(n,w.x,w.y);
      assert.ok(Math.abs(b.x-x)<=0.06&&Math.abs(b.y-y)<=0.06,n+' '+x+','+y);
    }
    assert.deepEqual(P.world(n,sp.w/2,sp.h/2),{x:555,y:370},'centre spot');
    assert.ok(P.world(n,sp.w/2,sp.h).x<555,'bottom of the portrait pitch is the low-x goal');
    assert.ok(P.world(n,0,sp.h/2).y<370,'left is small y');
  }
});

test('every start layout fits its pitch and two teams stay in their own halves',()=>{
  for(const n of ['11','8','5'])for(const form of P.SPECS[n].forms){
    const sp=P.SPECS[n],one=P.docNew(n,form,false),two=P.docNew(n,form,true),k=(P.FORMS[form]||[]).length;
    assert.equal(one.players.length,k);assert.equal(two.players.length,k*2);
    for(const p of two.players){assert.ok(p.x>=0&&p.x<=sp.w&&p.y>=0&&p.y<=sp.h,form);assert.equal(p.team==='us',p.y>sp.h/2,form+' half');}
    assert.equal(new Set(two.players.map(p=>p.id)).size,k*2,'ids are unique');
    assert.equal(!!one.ball,k>0);
  }
  const mix=P.docNew('11','4-3-3','3-5-2');
  assert.equal(mix.players.filter(p=>p.team==='us').length,11);assert.equal(mix.players.filter(p=>p.team==='op').length,11);
  assert.deepEqual(mix.players.filter(p=>p.team==='op').map(p=>[p.x,p.y]),P.docNew('11','3-5-2',true).players.filter(p=>p.team==='op').map(p=>[p.x,p.y]),'the opponent stands in its own formation');
  assert.notDeepEqual(mix.players.filter(p=>p.team==='op').map(p=>p.x),P.docNew('11','4-3-3',true).players.filter(p=>p.team==='op').map(p=>p.x));
  const only=P.docNew('8','','2-4-1');assert.equal(only.players.length,8);assert.ok(only.players.every(p=>p.team==='op'),'an empty own side with an opponent formation');
  assert.equal(P.docNew('11','4-3-3','').players.length,11);assert.equal(P.docNew('11','4-3-3','9-9-9').players.length,11,'an unknown opponent formation places nobody');
});

test('a new item is a portrait board marked as a phone board',()=>{
  const doc=P.docNew('11','4-3-3',true);
  doc.cones.push({x:10,y:20});doc.lines.push({kind:'pass',x1:10,y1:90,x2:30,y2:60});doc.players[0].name='  김 민수  ';
  const it=P.itemFor(doc,'',Date.UTC(2026,10,18));
  assert.equal(it.type,'board');assert.deepEqual(it.tags,['폰보드']);assert.deepEqual(it.phone,{v:1,n:'11'});
  assert.equal(it.editedAt,it.savedAt);assert.match(it.libId,/^V[a-z0-9]+$/);assert.match(it.name,/^폰보드 \d+\/\d+$/);
  const s=it.snap;
  assert.equal(s.orientation,'v');assert.equal(s.pitchSpec,'fifa');assert.equal(s.label,'num');assert.equal(s.tokV,2);
  assert.equal(s.players.length,22);assert.equal(s.players.filter(p=>p.team==='blue').length,11);assert.equal(s.players.filter(p=>p.team==='red').length,11);
  assert.equal(s.players[0].name,'김 민수');assert.equal(s.players[0].num,'1');
  assert.deepEqual(s.equipment.map(e=>e.team),['cone']);assert.equal(s.drawings[0].type,'pass');assert.equal(s.drawings[0].pts.length,2);
  assert.deepEqual(s.ball,{x:555,y:370});
  assert.equal(new Set(s.players.map(p=>p.id).concat(s.equipment.map(e=>e.id))).size,23,'token ids do not collide');
  assert.equal(P.itemFor(P.docNew('8','3-3-1'),'토요일').snap.pitchSpec,'u12');assert.equal(P.itemFor(P.docNew('5','2-2'),'x').snap.pitchSpec,'futsal');
  assert.equal(P.itemFor(doc,'  토요일   경기  ').name,'토요일 경기');
});

test('edit-back keeps the same item, the look and unknown token fields; only what the phone knows changes',()=>{
  const it=P.itemFor(P.docNew('8','3-3-1',false),'A',1000);
  it.createdBy='u1';it.folder='팀/경기';it.snap.pitchTheme='navy';it.snap.players[2].photo='data:x';it.snap.players[2].color='#123456';
  assert.equal(P.editable(it),true);
  const doc=P.docFrom(it);
  assert.equal(doc.n,'8');assert.equal(doc.players.length,8);assert.equal(doc.players[0].team,'us');
  doc.players[2].x=5;doc.players[2].name='박';doc.players.pop();doc.cones.push({x:1,y:1});
  const before=JSON.stringify(it.snap.players[1]);
  P.applyEdit(it,doc,'B',2000);
  assert.equal(it.name,'B');assert.equal(it.savedAt,2000);assert.equal(it.editedAt,2000);assert.equal(it.createdBy,'u1');assert.equal(it.folder,'팀/경기');assert.deepEqual(it.phone,{v:1,n:'8'});
  assert.equal(it.snap.pitchTheme,'navy','board look is kept');
  assert.equal(it.snap.players.length,7);assert.equal(JSON.stringify(it.snap.players[1]),before,'an untouched player is byte-identical');
  assert.equal(it.snap.players[2].photo,'data:x');assert.equal(it.snap.players[2].color,'#123456');assert.equal(it.snap.players[2].name,'박');
  assert.equal(it.snap.players[2].y,P.world('8',5,0).y);
  assert.equal(it.snap.equipment.length,1);
  P.applyEdit(it,P.docFrom(it),'',3000);assert.equal(it.name,'B','an empty name keeps the old one');
});

test('boards touched on a bigger screen are view-only on the phone',()=>{
  const mk=()=>P.itemFor(P.docNew('11','4-4-2',true),'A',1);
  const cases={
    text:d=>d.snap.drawings.push({type:'text',pts:[{x:1,y:1}],text:'x'}),
    free:d=>d.snap.drawings.push({type:'free',pts:[{x:1,y:1},{x:2,y:2},{x:3,y:3}]}),
    anchored:d=>d.snap.drawings.push({type:'run',pts:[{x:1,y:1},{x:2,y:2}],tk:[1,null]}),
    goal:d=>d.snap.equipment.push({id:9,team:'tire',x:1,y:1}),   /* 3.381 — 장비 열 가지(미니골 포함)는 폰에서도 고친다 · 그 밖의 장비는 보기만 */
    fill:d=>d.snap.drawings.push({type:'rectline',pts:[{x:1,y:1},{x:20,y:20}]}),
    coach:d=>d.snap.players.push({id:99,team:'blue',coach:true,x:1,y:1}),
    third:d=>{d.snap.players[0].team='yellow';},
    pitch:d=>{d.snap.pitchSpec='u12';},
    pages:d=>{d.pages=[{snap:d.snap},{snap:d.snap}];},
    curve:d=>{d.frames=[{snap:d.snap,curves:{1:{mx:3,my:4}}},{snap:d.snap}];},
    caption:d=>{d.frames=[{snap:d.snap},{snap:d.snap,cap:'x'}];},
    roster:d=>{const b=JSON.parse(JSON.stringify(d.snap));b.players.pop();d.frames=[{snap:d.snap},{snap:b}];},
    sceneText:d=>{const b=JSON.parse(JSON.stringify(d.snap));b.drawings.push({type:'text',pts:[{x:1,y:1}]});d.frames=[{snap:d.snap},{snap:b}];},
    many:d=>{d.frames=Array.from({length:P.MAX_SCENES+1},()=>({snap:d.snap}));},
    book:d=>{d.book=1;},
    plain:d=>{delete d.phone;},
    training:d=>{d.type='train';}
  };
  assert.equal(P.editable(mk()),true);
  for(const k in cases){const d=mk();cases[k](d);assert.equal(P.editable(d),false,k);}
  const one=mk();one.pages=[{snap:one.snap}];one.frames=[{snap:one.snap}];assert.equal(P.editable(one),true,'one page · one scene is still a phone board');
});

test('the home list shows phone boards only, newest first',()=>{
  const a=P.itemFor(P.docNew('11','4-3-3'),'a',10),b=P.itemFor(P.docNew('11','4-3-3'),'b',30),c={libId:'x',type:'board',savedAt:99,snap:{}},d={libId:'y',type:'train',phone:{v:1,n:'11'},savedAt:98};
  b.editedAt=5;b.savedAt=5;a.editedAt=40;
  const q={libId:'q',type:'board',name:'q',quick:{v:1,form:'4-3-3'},savedAt:20,snap:{}};
  assert.deepEqual(P.mine([c,b,null,d,a,q]).map(x=>x.name),['a','q','b'],'depth charts (quick boards) are phone boards too');assert.deepEqual(P.mine(null),[]);
});

test('hit-testing picks tokens before arrows and names are escaped in the drawing',()=>{
  const doc=P.docNew('11','4-3-3');doc.lines.push({kind:'run',x1:5,y1:42,x2:5,y2:60});
  assert.equal(P.hit(doc,{x:5.5,y:50},false),null);assert.equal(P.hit(doc,{x:5.5,y:50},true).type,'line');
  assert.equal(P.hit(doc,{x:doc.players[0].x+0.5,y:doc.players[0].y},true).type,'player');
  doc.players[0].name='<img src=x>';
  const svg=P.docSVG(doc,P.SPECS['11']);assert.ok(!svg.includes('<img'));assert.ok(svg.includes('&lt;img'));
});

test('portrait lock reads the device orientation, not the window shape',()=>{
  assert.equal(P.landscape({screen:{orientation:{type:'landscape-primary'}}}),true);
  assert.equal(P.landscape({screen:{orientation:{type:'portrait-primary'}},innerWidth:400,innerHeight:300}),false,'a keyboard-squashed portrait window stays portrait');
  assert.equal(P.landscape({orientation:90}),true);assert.equal(P.landscape({orientation:0}),false);assert.equal(P.landscape({}),false);
});

test('wiring: board script, vault chip, phone guard, service worker, shell tab',()=>{
  const board=read('studio/board.html'),sw=read('sw.js'),app=read('studio/app.html'),nav=read('studio/mobile-navigation.js'),view=read('studio/board-phone-view.js'),mod=read('studio/board-phone-board.js'),tab=read('studio/board-phone-nav.js');
  assert.equal(board.split('<script src="board-phone-board.js"></script>').length,2);
  assert.ok(board.indexOf('board-quick-depth.js')<board.indexOf('board-phone-board.js'));
  assert.ok(board.includes(`if(d.phone||d.quick)_edc+='<span class="vc-phone">폰보드</span>'`),'vault rows carry the chip');
  assert.ok(sw.includes("'/studio/board-phone-board.js'")&&sw.includes("'/studio/board-phone-nav.js'"));
  assert.ok(app.indexOf('board-phone-nav.js')>0&&app.indexOf('board-phone-nav.js')<app.indexOf('<script src="mobile-navigation.js">'),'the tab module loads before the phone menu');
  assert.ok(nav.includes('PSPhoneBoardNav.button(seg)')&&nav.includes('primary.splice(1,0,phoneBoard)'),'the tab sits right after «보드»');
  assert.ok(view.includes('#psQuick,#psPhoneBoard'),'the read-only guard lets the overlay through');
  assert.ok(!/catch\([^)]*\)\{\}/.test(mod+tab),'no empty catch');
  assert.ok(!/localStorage|sessionStorage/.test(mod+tab),'no new storage keys');
  assert.ok(mod.includes("e.source!==win.parent||e.origin!==win.location.origin"),'only the same-origin parent can open it');
  assert.ok(tab.includes("getAttribute('data-ps-device')==='phone'"),'the tab exists on phones only');
});

test('3.333 — a flat pitch with standing chips, and a touch maps back to the same metres',()=>{
  for(const n of ['11','8','5']){
    const sp=P.SPECS[n],far=P.proj(sp,0,0),farR=P.proj(sp,sp.w,0),near=P.proj(sp,0,sp.h),nearR=P.proj(sp,sp.w,sp.h),mid=P.proj(sp,sp.w/2,sp.h/2);
    assert.ok(Math.abs((farR.x-far.x)-sp.w)<0.05,'the pitch is flat — the far goal line is as wide as the near one');
    assert.ok(Math.abs((nearR.x-near.x)-sp.w)<0.05,'the near goal line keeps its width');
    assert.ok(far.y>0&&near.y<=sp.h&&far.y<mid.y&&mid.y<near.y,'the pitch stays inside the view');
    assert.ok(Math.abs((mid.y-far.y)-(near.y-mid.y))<0.05,'no foreshortening');
    assert.equal(mid.x,sp.w/2);
    for(const [x,y] of [[0,0],[sp.w,sp.h],[sp.w*0.2,sp.h*0.33],[sp.w*0.9,sp.h*0.71],[sp.w/2,sp.h/2]]){
      const p=P.proj(sp,x,y),q=P.unproj(sp,p.x,p.y);
      assert.ok(Math.abs(q.x-x)<0.15&&Math.abs(q.y-y)<0.15,n+' round trip '+x+','+y+' → '+q.x+','+q.y);
    }
    const out=P.unproj(sp,-50,-50);assert.ok(Number.isFinite(out.x)&&Number.isFinite(out.y),'a touch outside the pitch stays finite');
  }
  { /* 칸을 꽉 채우게 세로를 늘여도(sp.vh) 왕복은 같다 */
    const sp=Object.assign({},P.SPECS['11'],{vh:150}),p=P.proj(sp,20,80),q=P.unproj(sp,p.x,p.y),near=P.proj(sp,0,sp.h);
    assert.ok(Math.abs(q.x-20)<0.15&&Math.abs(q.y-80)<0.15);assert.ok(near.y>sp.h&&near.y<=150,'the near goal line sits near the bottom of the taller view');
  }
  const sp=P.SPECS['11'],doc=P.docNew('11','4-3-3','4-4-2');doc.ball={x:34,y:50};doc.cones.push({x:10,y:50});
  const svg=P.docSVG(doc,sp);
  assert.equal(svg.split('class="phb-tok"').length-1,22,'every player is a standing chip');
  const ys=[...svg.matchAll(/class="phb-tok" data-id="(\d+)"/g)].map(m=>doc.players.find(p=>String(p.id)===m[1]).y);
  assert.deepEqual(ys,ys.slice().sort((a,b)=>a-b),'far players are drawn first');
  assert.ok(P.pitchSVG(sp).includes('class="phb-goal"'));
  assert.equal(P.snapFor(doc).chip3d,true,'a new phone board asks the big board for 3D chips');
  const old={pitchSpec:'fifa',tokShape:'circle',players:[],equipment:[],drawings:[]};
  assert.equal('chip3d' in P.snapFor(doc,old),false,'an existing board keeps its own look');
});

test('3.333 — token size is five steps, kept with the item and handed to the big board only when changed',()=>{
  const sp=P.SPECS['11'],doc=P.docNew('11','4-3-3','');
  assert.equal(P.tokOf(doc),3);assert.equal(P.tokOf({tok:9}),3);assert.equal(P.tokOf({tok:'5'}),5);
  const rOf=d=>+P.docSVG(d,sp).match(/class="phb-tok"[^>]*scale\(([0-9.]+)\)/)[1];
  const mid=rOf(doc);doc.tok=5;doc.tokSet=true;const big=rOf(doc);doc.tok=1;const small=rOf(doc);
  assert.ok(small<mid&&mid<big,'the chips grow with the step: '+[small,mid,big]);
  const it0=P.itemFor(P.docNew('11','4-3-3',''),'기본',1);assert.deepEqual(it0.phone,{v:1,n:'11'});assert.equal(it0.snap.tokenScale,0.8,'the default keeps the old board scale');
  doc.tok=5;const it=P.itemFor(doc,'큰 토큰',2);assert.equal(it.phone.tok,5);assert.equal(it.snap.tokenScale,1.04);
  assert.equal(P.editable(it),true);assert.equal(P.docFrom(it).tok,5,'reopening keeps the step');
  const again=P.docFrom(it);P.applyEdit(it,again,'',3);assert.equal(it.snap.tokenScale,1.04,'an untouched reopen leaves the board scale alone');
  const old={libId:'x',type:'board',phone:{v:1,n:'11'},snap:Object.assign(P.snapFor(P.docNew('11','4-3-3','')),{tokenScale:1.3})};
  const d2=P.docFrom(old);P.applyEdit(old,d2,'',4);assert.equal(old.snap.tokenScale,1.3,'a board sized on the iPad keeps its scale');assert.equal('tok' in old.phone,false);
  d2.tok=2;d2.tokSet=true;P.applyEdit(old,d2,'',5);assert.equal(old.phone.tok,2);assert.equal(old.snap.tokenScale,0.69);
  d2.tok=3;P.applyEdit(old,d2,'',6);assert.equal('tok' in old.phone,false,'back to the default drops the field');
});

/* 3.359 — 큰 작전판과 같은 모습 + 장면(애니메이션) */
test('3.359 — the drawing follows the big board: pitch colour, jersey chips, arrow styles, the board ball',()=>{
  const sp=P.SPECS['11'],doc=P.docNew('11','4-3-3','4-4-2');doc.cones.push({x:10,y:50});
  const pitch=P.pitchSVG(sp);
  assert.ok(pitch.includes('fill="#1b8044"'),'the board grass');assert.ok(!/phb-pitch2/.test(pitch),'no mown bands by default');assert.ok(pitch.includes('id="phbGloss"')&&pitch.includes('id="phbVig"'));
  const svg=P.docSVG(doc,sp);
  assert.equal(svg.split('class="phb-jersey"').length-1,22,'every player wears the board jersey');
  assert.ok(svg.includes('fill="#1a2f5c"')&&svg.includes('fill="#d12f38"'),'board team colours');
  assert.ok(svg.includes('fill="#3aa6dc"')&&svg.includes('fill="#d4a017"'),'number 1 takes the goalkeeper colours of each side');
  assert.ok(!/\{[FDC]\}/.test(svg),'no template holes left');
  assert.ok(svg.indexOf('class="phb-cone"')<svg.indexOf('class="phb-tok"')&&svg.lastIndexOf('class="phb-tok"')<svg.indexOf('class="phb-ball"'),'cones under players, the ball on top');
  assert.ok(P.docSVG(doc,sp,{ball:'<svg data-board-ball="1"></svg>'}).includes('data-board-ball'),'the big board ball is used when handed in');
  const L=k=>P.lineSVG({kind:k,x1:10,y1:60,x2:30,y2:30},sp);
  assert.ok(/stroke-dasharray/.test(L('run'))&&/stroke-linecap="butt"/.test(L('run')),'a run is dashed, as on the big board');
  assert.ok(!/stroke-dasharray/.test(L('pass')),'a pass is solid');
  assert.ok(L('dribble').split('L').length>12,'a dribble zigzags');
  assert.ok(/opacity="0.4"/.test(P.lineSVG({kind:'pass',x1:1,y1:1,x2:9,y2:9,op:0.4},sp)));
});

test('3.359 — scenes: the working scene is the top level, structure is shared, positions and arrows are per scene',()=>{
  const doc=P.docNew('11','4-3-3','');
  assert.equal(P.sceneCount(doc),1);assert.equal(P.sceneAt(doc),0);assert.equal(P.sceneDel(doc),false,'the only scene stays');
  const p9=doc.players[9],p8=doc.players[8];doc.ball={x:p9.x+1,y:p9.y};
  doc.lines.push({kind:'dribble',x1:p9.x,y1:p9.y,x2:p9.x+6,y2:p9.y-12},{kind:'run',x1:p8.x,y1:p8.y,x2:p8.x,y2:p8.y-10},{kind:'run',x1:1,y1:1,x2:5,y2:5});
  const before=JSON.stringify(doc.players),x9=p9.x,y9=p9.y,y8=p8.y;
  assert.equal(P.sceneAdd(doc),true);
  assert.equal(P.sceneCount(doc),2);assert.equal(P.sceneAt(doc),1);
  assert.equal(JSON.stringify(doc.scenes[0].players),before,'scene 1 is untouched');assert.equal(doc.scenes[0].lines.length,3);
  assert.deepEqual([doc.players[9].x,doc.players[9].y],[x9+6,y9-12],'the dribbler stands at the arrow end');
  assert.deepEqual(doc.ball,{x:x9+7,y:y9-12},'the ball went with the dribble');
  assert.equal(doc.players[8].y,y8-10,'the runner too');assert.equal(doc.lines.length,0,'arrows are not carried over');
  assert.equal(doc.players.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(JSON.parse(before)[i])).length,2,'nobody else moved');
  /* pass: the ball goes to the arrow end */
  const d2=P.docNew('11','4-3-3','');d2.ball={x:34,y:52.5};d2.lines.push({kind:'pass',x1:34,y1:52.5,x2:10,y2:20});P.sceneAdd(d2);assert.deepEqual(d2.ball,{x:10,y:20});
  /* 장면 오가기 — 고친 것은 그 장면에 남는다 */
  doc.players[0].x=11;P.sceneGo(doc,0);assert.equal(doc.at,0);assert.notEqual(doc.players[0].x,11);assert.equal(doc.lines.length,3);
  P.sceneGo(doc,1);assert.equal(doc.players[0].x,11);
  P.sceneAdd(doc);assert.equal(P.sceneCount(doc),3);assert.equal(doc.at,2);
  P.sceneGo(doc,1);assert.equal(P.sceneDel(doc),true);assert.equal(P.sceneCount(doc),2);assert.equal(doc.at,1);
  P.sceneDel(doc);assert.equal('scenes' in doc,false,'back to a single board');assert.equal(P.sceneCount(doc),1);
  const full=P.docNew('5','2-2','');for(let i=1;i<P.MAX_SCENES;i++)assert.equal(P.sceneAdd(full),true);assert.equal(P.sceneAdd(full),false,'at most '+P.MAX_SCENES);
});

test('3.359 — playback tween: straight moves, old arrows fade out first, new ones fade in',()=>{
  const A={players:[{id:1,team:'us',num:'9',name:'',x:10,y:10}],ball:{x:0,y:0},cones:[{x:1,y:1}],lines:[{kind:'run',x1:0,y1:0,x2:5,y2:5},{kind:'pass',x1:1,y1:1,x2:2,y2:2}]};
  const B={players:[{id:1,team:'us',num:'9',name:'',x:30,y:50}],ball:{x:20,y:40},cones:[{x:1,y:1}],lines:[{kind:'pass',x1:1,y1:1,x2:2,y2:2},{kind:'dribble',x1:3,y1:3,x2:9,y2:9}]};
  const h=P.tween(A,B,0.5);
  assert.deepEqual([h.players[0].x,h.players[0].y],[20,30]);assert.deepEqual(h.ball,{x:10,y:20});
  assert.deepEqual(P.tween(A,B,0).players[0],A.players[0]);assert.deepEqual([P.tween(A,B,1).players[0].x,P.tween(A,B,1).players[0].y],[30,50]);
  const q=P.tween(A,B,0.25);
  assert.equal(q.lines.find(l=>l.kind==='pass').op,undefined,'a kept arrow stays solid');assert.equal(q.lines.find(l=>l.kind==='run').op,0.5);assert.equal(q.lines.some(l=>l.kind==='dribble'),false);
  assert.equal(P.tween(A,B,0.5).lines.some(l=>l.kind==='run'),false);assert.equal(P.tween(A,B,1).lines.find(l=>l.kind==='dribble').op,1);
  assert.equal(P.ease(0),0);assert.equal(P.ease(1),1);assert.equal(P.ease(0.5),0.5);
  assert.equal(JSON.stringify(A.players[0]),JSON.stringify({id:1,team:'us',num:'9',name:'',x:10,y:10}),'inputs are not mutated');
});

test('3.359 — a phone board with scenes is saved as big-board frames and comes back editable',()=>{
  const doc=P.docNew('11','4-4-2','4-3-3');doc.cones.push({x:5,y:5});
  doc.lines.push({kind:'run',x1:doc.players[10].x,y1:doc.players[10].y,x2:40,y2:20});
  P.sceneAdd(doc);doc.scenes[0].dur=1.6;P.sceneAdd(doc);doc.players[3].x=20;
  const it=P.itemFor(doc,'역습',5);
  assert.equal(it.frames.length,3);assert.deepEqual(it.frames.map(f=>f.dur),[1.6,1,1]);assert.equal(it.frames[0].__hold,0.6);
  assert.deepEqual(it.snap,it.frames[0].snap,'the card shows scene 1');assert.notEqual(it.snap,it.frames[0].snap);
  assert.equal(it.frames[0].snap.drawings.length,1);assert.equal(it.frames[1].snap.drawings.length,0);
  assert.deepEqual(it.frames.map(f=>f.snap.players.map(p=>p.id)),Array(3).fill(it.snap.players.map(p=>p.id)),'the same token ids in every scene — the big board tweens by id');
  assert.deepEqual(it.frames.map(f=>f.snap.equipment.map(e=>e.id)),Array(3).fill([1000]));
  assert.notDeepEqual(it.frames[0].snap.players[10],it.frames[1].snap.players[10],'the runner moved between scenes');
  assert.equal(P.editable(it),true);
  const back=P.docFrom(it);
  assert.equal(P.sceneCount(back),3);assert.equal(back.at,0);assert.equal(back.scenes[0].dur,1.6);assert.equal(back.lines.length,1);
  assert.equal(back.scenes[2].players[3].x,20);
  /* 고쳐 저장 — 겉모습 · 첫 장면의 덧붙은 칸은 그대로, 장면을 하나로 줄이면 frames 를 걷는다 */
  it.frames.forEach(f=>{f.snap.pitchTheme='navy';});it.snap.pitchTheme='navy';it.frames[0].__t='제목';it.frames[1].snap.players[2].photo='data:x';
  P.sceneGo(back,2);P.sceneDel(back);P.applyEdit(it,back,'',9);
  assert.equal(it.frames.length,2);assert.equal(it.frames[0].__t,'제목');assert.equal(it.frames[1].snap.pitchTheme,'navy');assert.equal(it.frames[1].snap.players[2].photo,'data:x');
  P.sceneDel(back);P.applyEdit(it,back,'',10);assert.equal('frames' in it,false);assert.equal(it.snap.pitchTheme,'navy');assert.equal(P.editable(it),true);
  assert.equal(P.itemFor(P.docNew('11','4-3-3',''),'하나',1).frames,undefined,'a single scene has no frames');
});

/* 3.379 — 포지션별 등번호(사용자 11/25 «포지션별로 번호 제대로») */
test('3.379 formations number each slot by its position, for both sides', () => {
  const by=(d,team)=>Object.fromEntries(d.players.filter(p=>p.team===team).map((p,i)=>[i,p]));
  for(const form of Object.keys(P.FORMS)){
    const slots=P.FORMS[form],nums=P.NUMS[form];
    assert.equal(nums.length,slots.length,form+' has a number for every slot');
    assert.equal(new Set(nums).size,nums.length,form+' numbers are unique');
    assert.equal(nums[0],1,form+' goalkeeper is 1');
  }
  const d=P.docNew('11','4-3-3','4-4-2'),us=by(d,'us'),op=by(d,'op');
  const at=(o,num)=>Object.values(o).find(p=>p.num===String(num));
  /* 우리 팀은 위로 공격 — 오른쪽(x 큰 쪽)이 RB 2 · RW 7, 왼쪽이 LB 3 · LW 11, 가운데 앞이 9 */
  assert.ok(at(us,2).x>at(us,3).x,'RB 2 is on the right of LB 3');
  assert.ok(at(us,4).x>at(us,5).x,'RCB 4 is right of LCB 5');
  assert.ok(at(us,7).x>at(us,11).x,'RW 7 is right of LW 11');
  assert.ok(at(us,9).y<at(us,6).y&&at(us,6).y<at(us,4).y,'9 ahead of 6 ahead of the centre backs');
  /* 상대는 아래로 공격 — 상대의 오른쪽은 화면 왼쪽 */
  assert.ok(at(op,2).x<at(op,3).x,'the opponent RB 2 is on the screen left');
  assert.ok(at(op,7).x<at(op,11).x,'the opponent RM 7 is on the screen left');
  assert.deepEqual(P.docNew('5','1-2-1',false).players.map(p=>p.num),['1','4','11','7','9']);
  assert.deepEqual(P.docNew('11','',false).players,[],'no formation, no players');
});

test('3.379 a placed player takes the smallest free number, 1 only for a team with nobody yet', () => {
  assert.equal(P.freeNum([],'us'),'1');
  assert.equal(P.freeNum([{team:'op',num:'1'}],'us'),'1','other side numbers do not count');
  assert.equal(P.freeNum([{team:'us',num:'21'}],'us'),'2','1 stays for the goalkeeper once the team has a player');
  const d=P.docNew('11','4-3-3',false);
  assert.equal(P.freeNum(d.players,'us'),'12');
  d.players.splice(d.players.findIndex(p=>p.num==='8'),1);
  assert.equal(P.freeNum(d.players,'us'),'8','a removed number is reused');
});

/* 3.379 — 유니폼 색(사용자 11/25 «새로 만들기 할 때 유니폼 색상도») */
test('3.379 kits: chosen on a new board, drawn on chips, saved as the big board teamColors and read back', () => {
  assert.equal(P.KIT.length,10);assert.ok(P.KIT.every(k=>/^#[0-9a-f]{6}$/.test(k[0])),'palette hex');
  assert.equal(P.docNew('11','4-3-3','',{us:'#1a2f5c',op:'#d12f38'}).kit,undefined,'default colours keep no kit field');
  assert.equal(P.docNew('11','4-3-3','',{us:'nope',op:'#d12f38'}).kit,undefined,'a bad value is ignored');
  const d=P.docNew('11','4-3-3','4-4-2',{us:'#F4F5F7',op:'#f2c230'});
  assert.deepEqual(d.kit,{us:'#f4f5f7',op:'#f2c230'});
  assert.equal(P.kitOf(d,'us'),'#f4f5f7');assert.equal(P.kitOf({},'op'),'#d12f38');
  assert.equal(P.gkOf(d,'op'),'#3aa6dc','a yellow side gets the sky goalkeeper instead of the gold one');
  assert.equal(P.gkOf(d,'us'),'#3aa6dc');assert.equal(P.gkOf({},'op'),'#d4a017');
  const svg=P.docSVG(d,P.SPECS['11']);
  assert.ok(svg.includes('fill="#f4f5f7"')&&svg.includes('fill="#f2c230"'),'chips wear the kits');
  assert.ok(svg.includes('phb-light'),'a light kit is marked for dark numbers');
  const snap=P.snapFor(d,null);assert.deepEqual(snap.teamColors,{blue:'#f4f5f7',red:'#f2c230'});
  assert.equal(P.snapFor(P.docNew('11','4-3-3',''),null).teamColors,undefined,'no kit, no teamColors');
  const it=P.itemFor(d,'흰 유니폼',1);
  assert.deepEqual(P.docFrom(it).kit,{us:'#f4f5f7',op:'#f2c230'},'reopening keeps the kits');
  const prev={...P.snapFor(P.docNew('11','4-3-3',''),null),teamColors:{blue:'#000000',yellow:'#123456'}};
  assert.deepEqual(P.snapFor({...P.docNew('11','4-3-3',''),kit:{op:'#7a3fb0'}},prev).teamColors,{blue:'#000000',yellow:'#123456',red:'#7a3fb0'},'an edit keeps the other team colours of the old board');
});

test('3.381 training: grid paper, ten kinds of equipment and zones — saved as a vault training the big board reads',()=>{
  assert.deepEqual(['g20','g30','g45'].map(n=>[P.SPECS[n].spec,P.SPECS[n].h]),[['grid20',20],['grid30',30],['grid45',45]]);
  const sp=P.SPECS.g30;assert.deepEqual(P.world('g30',sp.w/2,sp.h/2),{x:555,y:370});
  const top=P.world('g30',0,0),bot=P.world('g30',sp.w,sp.h);assert.deepEqual([top.x,top.y,bot.x,bot.y],[1080,30,30,710],'the paper fills the big board grid board');
  for(const n of ['g20','g45','11','8']){const s=P.SPECS[n],q=P.local(n,P.world(n,3,7).x,P.world(n,3,7).y);assert.ok(Math.abs(q.x-3)<0.15&&Math.abs(q.y-7)<0.15,n);}
  const doc=P.docNew('g30','','',null,{min:20});
  assert.deepEqual([doc.kind,doc.n,doc.min,doc.players.length],['train','g30',20,0],'a training starts empty');
  doc.cones.push({x:3,y:4},{x:10,y:15,t:'minigoal'},{x:5,y:5,t:'pole'});
  doc.zones.push({k:'rect',x1:2,y1:2,x2:12,y2:10,c:'#2f6df0'},{k:'ellipse',x1:4,y1:14,x2:14,y2:24,c:'#ffd60a'});
  doc.players.push({id:1,team:'us',num:'7',name:'',x:9,y:9});
  P.sceneAdd(doc);P.sceneAdd(doc);
  const it=P.itemFor(doc,'론도 4v2',5);
  assert.equal(it.type,'train');assert.deepEqual(it.phone,{v:1,n:'g30',kind:'train'});assert.equal(it.minutes,20);
  assert.equal(it.snap.pitchSpec,'grid30');assert.equal(it.snap.pitchTheme,'white','paper is the white board theme');
  assert.deepEqual(it.snap.equipment.map(e=>e.team),['cone','minigoal','pole']);
  assert.deepEqual(it.snap.drawings.map(d=>[d.type,d.color]),[['rect','#2f6df0'],['ellipse','#ffd60a']]);
  assert.equal(it.frames.length,3);assert.ok(it.frames.every(f=>f.snap.drawings.length===2),'zones stand in every scene');
  assert.equal(it.trainings.length,1);const t=it.trainings[0];
  assert.deepEqual([t.type,t.name,t.minutes,t.sets,t.focus],['train','론도 4v2',20,1,'bp']);assert.deepEqual(t.snap,it.snap);assert.equal(t.frames.length,3);
  assert.equal(P.editable(it),true,'a phone training opens again on the phone');
  assert.deepEqual(P.mine([it]).map(d=>d.name),['론도 4v2']);
  const back=P.docFrom(it);
  assert.deepEqual([back.kind,back.n,back.min],['train','g30',20]);
  assert.deepEqual(back.cones.map(c=>c.t||'cone'),['cone','minigoal','pole']);
  assert.deepEqual(back.zones.map(z=>[z.k,z.c,z.x1,z.y2]),[['rect','#2f6df0',2,10],['ellipse','#ffd60a',4,24]]);
  assert.equal(back.scenes.length,3);
  back.zones.pop();P.applyEdit(it,back,'론도',9);
  assert.equal(it.trainings[0].snap.drawings.length,1);assert.equal(it.snap.drawings.length,1);assert.equal(it.editedAt,9);
  const many=JSON.parse(JSON.stringify(it));many.trainings.push(many.trainings[0]);assert.equal(P.editable(many),false,'two trainings on one card are view-only');
  const sc=JSON.parse(JSON.stringify(it));sc.scenes=[{snap:sc.snap}];assert.equal(P.editable(sc),false,'editor scenes from the big screen are view-only');
});

test('3.381 drawing: paper grid, dark arrows and the board equipment art',()=>{
  const sp=Object.assign({},P.SPECS.g20);
  const bg=P.pitchSVG(sp);assert.match(bg,/#f6f7f4/);assert.ok((bg.match(/<line /g)||[]).length>30,'a grid of lines');assert.doesNotMatch(bg,/phb-goal/,'no goals on paper');
  const doc=P.docNew('g20','','',null,{});doc.cones.push({x:3,y:3,t:'hurdle'});doc.zones.push({k:'rect',x1:1,y1:1,x2:5,y2:5,c:'#e23b3b'});doc.lines.push({kind:'pass',x1:2,y1:2,x2:8,y2:8});
  const fg=P.docSVG(doc,sp,{equip:t=>'<g data-art="'+t+'"/>'});
  assert.match(fg,/data-art="hurdle"/);assert.match(fg,/class="phb-zone"/);assert.match(fg,/stroke="#14213D"/,'arrows are dark on paper');
  assert.equal(P.hit(doc,{x:1.5,y:4.5},true).type,'zone','an empty spot inside a zone picks the zone');
});
