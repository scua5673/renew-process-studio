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
    goal:d=>d.snap.equipment.push({id:9,team:'minigoal',x:1,y:1}),
    coach:d=>d.snap.players.push({id:99,team:'blue',coach:true,x:1,y:1}),
    third:d=>{d.snap.players[0].team='yellow';},
    pitch:d=>{d.snap.pitchSpec='u12';},
    pages:d=>{d.pages=[{snap:d.snap},{snap:d.snap}];},
    frames:d=>{d.frames=[{snap:d.snap},{snap:d.snap}];},
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

test('3.333 — the editor draws in perspective and maps a touch back to the same metres',()=>{
  for(const n of ['11','8','5']){
    const sp=P.SPECS[n],far=P.proj(sp,0,0),farR=P.proj(sp,sp.w,0),near=P.proj(sp,0,sp.h),nearR=P.proj(sp,sp.w,sp.h),mid=P.proj(sp,sp.w/2,sp.h/2);
    assert.ok(farR.x-far.x<(nearR.x-near.x)*0.75,'the far goal line is narrower');
    assert.ok(Math.abs((nearR.x-near.x)-sp.w)<0.05,'the near goal line keeps its width');
    assert.ok(far.y>0&&near.y<=sp.h&&far.y<mid.y&&mid.y<near.y,'the pitch stays inside the view');
    assert.ok(mid.y-far.y<near.y-mid.y,'the far half is foreshortened');
    assert.equal(mid.x,sp.w/2);
    for(const [x,y] of [[0,0],[sp.w,sp.h],[sp.w*0.2,sp.h*0.33],[sp.w*0.9,sp.h*0.71],[sp.w/2,sp.h/2]]){
      const p=P.proj(sp,x,y),q=P.unproj(sp,p.x,p.y);
      assert.ok(Math.abs(q.x-x)<0.15&&Math.abs(q.y-y)<0.15,n+' round trip '+x+','+y+' → '+q.x+','+q.y);
    }
    const out=P.unproj(sp,-50,-50);assert.ok(Number.isFinite(out.x)&&Number.isFinite(out.y),'a touch outside the pitch stays finite');
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
