// 3.300 휴대폰 빠른 보드(board-quick-depth.js) — 순수 함수 · 배선. 브라우저: tests/browser/board-quick-depth-3300.mjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Q=require('../studio/board-quick-depth.js');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const R=(n,f)=>({name:n,fam:f});

test('every formation slot has a known code and sits inside the pitch',()=>{
  for(const [k,F] of Object.entries(Q.FORMS)){
    assert.equal(F.s.length,F.n,k);
    for(const s of F.s){assert.ok(Q.META[s[0]],k+' '+s[0]);assert.ok(s[1]>0&&s[1]<100&&s[2]>0&&s[2]<100,k+' '+s[0]);}
    assert.equal(F.s[0][0],'GK','GK is the first slot (next-slot order)');
  }
  assert.deepEqual(Q.GROUPS.flatMap(g=>g[1]).sort(),Object.keys(Q.FORMS).sort(),'every formation is offered once');
});

test('squad position codes map to slot families',()=>{
  for(const [c,f] of [['GK','GK'],['LCB','CB'],['CB','CB'],['LB','LB'],['RWB','RB'],['FB','FB'],['RDM','DM'],['CM','CM'],['AM','AM'],['LW','LW'],['RM','RW'],['CF','ST'],['ST','ST'],['',''],['??','']])assert.equal(Q.famOf(c),f,c);
});

test('fill keeps squad depth order: starters first, then backups in turn, then near positions',()=>{
  const roster=[R('G1','GK'),R('G2','GK'),R('C1','CB'),R('C2','CB'),R('C3','CB'),R('L1','LB'),R('R1','RB'),R('F1','FB'),R('D1','DM'),R('D2','DM'),R('M1','CM'),R('A1','AM'),R('W1','LW'),R('W2','RW'),R('W3','LW'),R('S1','ST'),R('S2','ST'),R('X','')];
  const s=Q.fill('4-2-3-1',roster);
  assert.deepEqual(s[0],['G1','G2']);
  assert.deepEqual([s[2],s[3]],[['C1','C3'],['C2']],'two CB slots share the CB depth');
  assert.deepEqual(s[1],['L1','F1'],'a generic full-back backs up the first full-back slot');
  assert.deepEqual([s[5],s[6]],[['D1','M1'],['D2']],'CM has no slot in 4-2-3-1 → DM backup');
  assert.deepEqual(s[7],['W1','W3']);assert.deepEqual(s[10],['S1','S2']);
  assert.equal(s.flat().includes('X'),false,'no position → left for the chips');
  assert.equal(new Set(s.flat()).size,s.flat().length,'each player once');
  const g=Q.fill('3-3-1',[R('A','CM'),R('B','LW')]);
  assert.deepEqual(g[5],['A']);assert.deepEqual(g[4],['B'],'8-a-side LM takes a left winger');
  assert.deepEqual(Q.fill('4-4-2',[]).flat(),[]);
});

test('formation change carries names to the same place, same badge, then same family',()=>{
  const s=Q.FORMS['4-2-3-1'].s.map((x,i)=>[x[0]+'-1',x[0]+'-2']);
  const r=Q.remap('4-2-3-1',s,'4-4-2');
  assert.deepEqual(r.slots[0],['GK-1','GK-2']);
  assert.deepEqual(r.slots[2],['LCB-1','LCB-2']);
  assert.deepEqual(r.slots[5],['LW-1','LW-2'],'LW → LM (same family)');
  assert.deepEqual(r.slots[9],['ST-1','ST-2'],'ST → first striker slot');
  assert.ok(r.lost.some(x=>x.code==='AM'),'AM has no place in 4-4-2');
  const back=Q.remap('4-4-2',r.slots,'4-4-2');assert.deepEqual(back.slots,r.slots);
});

test('paste: one line per place, codes · Korean names · commas · spaces · two-slot badges alternate',()=>{
  const blank=Q.FORMS['4-2-3-1'].s.map(()=>[]);
  const r=Q.parse('GK 윤태오, 서지안\nCB: 오세찬, 장하율, 임준서\n공격형 미드필더 - 유시온 / 차민혁\n골키퍼 한도겸 문시우\nST Le Fée\n???',' 4-2-3-1'.trim(),blank);
  assert.deepEqual(r.slots[0],['한도겸','문시우'],'a later line for the same place replaces it');
  assert.deepEqual([r.slots[2],r.slots[3]],[['오세찬','임준서'],['장하율']]);
  assert.deepEqual(r.slots[8],['유시온','차민혁']);
  assert.deepEqual(r.slots[10],['Le Fée'],'Latin names keep their space');
  assert.equal(r.miss.length,1);
  assert.deepEqual(Q.parse('',' 4-2-3-1'.trim(),blank).hit,0);
  const keep=Q.parse('RW 길태양','4-2-3-1',[['A'],...blank.slice(1)]);assert.deepEqual(keep.slots[0],['A'],'untouched places stay');
});

test('board snap: vertical, position labels, starters as name, backups as depth, world coordinates',()=>{
  const s=Q.FORMS['4-2-3-1'].s.map((x,i)=>i===1?[]:[x[0]+' A',x[0]+' B',x[0]+' C']);
  const snap=Q.snapFor('4-2-3-1',s);
  assert.equal(snap.orientation,'v');assert.equal(snap.spFlip,false);assert.equal(snap.label,'pos');assert.equal(snap.tokV,2);assert.equal(snap.pitchSpec,'fifa');
  assert.equal(snap.players.length,11);
  const gk=snap.players[0];assert.deepEqual([gk.id,gk.pos,gk.name,gk.depth],[1,'GK','GK A',['GK B','GK C']]);
  assert.equal(snap.players[1].name,'');assert.equal('depth' in snap.players[1],false);
  assert.equal(snap.players[2].pos,'CB','LCB shows as CB');
  assert.ok(gk.x<555,'own goal is low x (bottom in the vertical view)');assert.equal(gk.y,370,'GK centred');
  const lb=snap.players[1];assert.ok(lb.y<370,'left back on the left (small y)');
  const st=snap.players[10];assert.ok(st.x>555);
  assert.equal(Q.snapFor('3-3-1',Q.FORMS['3-3-1'].s.map(()=>[])).pitchSpec,'u12');
  const f=Q.snapFor('1-2-1',Q.FORMS['1-2-1'].s.map(()=>[]));assert.equal(f.pitchSpec,'futsal');
  for(const p of f.players){assert.ok(p.x>=555-200&&p.x<=555+200&&p.y>=370-100&&p.y<=370+100,'futsal court is 40×20 around the centre');}
});

test('library item and edit-back: same item, same places, drawings and look kept',()=>{
  const s=Q.FORMS['4-3-3'].s.map((x,i)=>[x[0]+'1',x[0]+'2']);
  const it=Q.itemFor('4-3-3',s,'',Date.UTC(2026,10,15,3));
  assert.equal(it.type,'board');assert.deepEqual(it.tags,[Q.TAG]);assert.deepEqual(it.quick,{v:1,form:'4-3-3'});assert.match(it.name,/^4-3-3 뎁스 · 11\/15$/);
  assert.equal(it.editedAt,it.savedAt);assert.match(it.libId,/^V/);
  assert.ok(Q.editable(it));
  assert.deepEqual(Q.slotsFrom(it),s);
  it.snap.drawings=[{type:'line',pts:[{x:1,y:1},{x:2,y:2}]}];it.snap.pitchTheme='white';it.snap.players[3].x=999;it.snap.players[3].num='77';
  it.snap.players.push({id:500,team:'blue',num:'9',x:10,y:10});
  const next=s.map(a=>a.slice());next[3]=['새 이름'];
  Q.applyEdit(it,'4-3-3',next,'뎁스 차트',it.savedAt+5);
  assert.equal(it.name,'뎁스 차트');assert.equal(it.editedAt,it.savedAt);assert.ok(it.savedAt>Date.UTC(2026,10,15,3));
  assert.equal(it.snap.pitchTheme,'white');assert.equal(it.snap.drawings.length,1);
  const p4=it.snap.players.find(p=>p.id===4);assert.deepEqual([p4.x,p4.num,p4.name,'depth' in p4],[999,'77','새 이름',false]);
  assert.ok(it.snap.players.some(p=>p.id===500),'tokens added on the iPad stay');
  Q.applyEdit(it,'4-4-2',Q.remap('4-3-3',next,'4-4-2').slots,'',it.savedAt+5);
  assert.equal(it.quick.form,'4-4-2');assert.notEqual(it.snap.players.find(p=>p.id===4).x,999,'new formation → formation places');
  assert.equal(Q.editable({...it,pages:[{},{}]}),false,'two pages: edit on the iPad');
  assert.equal(Q.editable({...it,frames:[{},{}]}),false,'animation: edit on the iPad');
  assert.equal(Q.editable({...it,quick:null}),false);assert.equal(Q.editable({...it,type:'meeting'}),false);
});

test('moving a slot: stage percent ↔ world, only moved slots rewrite the token place, swap leaves places alone',()=>{
  // 창의 자리(왼쪽 % · 위 %) ↔ 세계 좌표 — 포메이션 자리와 같은 식
  for(const [k,F] of Object.entries(Q.FORMS))F.s.forEach((sl,i)=>assert.deepEqual(Q.world(k,sl[1],sl[2]),Q.at(k,i),k+' '+i));
  const w=Q.world('4-2-3-1',70,40);assert.deepEqual(w,{x:660,y:506});
  const back=Q.pct('4-2-3-1',w.x,w.y);assert.ok(Math.abs(back[0]-70)<0.2&&Math.abs(back[1]-40)<0.2,JSON.stringify(back));
  assert.deepEqual(Q.world('3-3-1',50,50),{x:555,y:370},'small pitches are centred');
  assert.deepEqual(Q.world('4-2-3-1',50,50,'u12'),Q.world('3-3-1',50,50),'saved pitch spec wins over the formation default');
  assert.notDeepEqual(Q.world('4-2-3-1',20,20,'u12'),Q.world('4-2-3-1',20,20));
  // 새 보드 — 옮긴 자리만 그 자리, 나머지는 포메이션 자리
  const s=Q.FORMS['4-2-3-1'].s.map((_,i)=>['선수'+i]),pos=s.map(()=>null);pos[8]=[70,40];
  const it=Q.itemFor('4-2-3-1',s,'',Date.UTC(2026,10,16),pos);
  assert.deepEqual([it.snap.players[8].x,it.snap.players[8].y],[660,506]);
  s.forEach((_,i)=>{if(i!==8)assert.deepEqual([it.snap.players[i].x,it.snap.players[i].y],[Q.at('4-2-3-1',i).x,Q.at('4-2-3-1',i).y],'slot '+i);});
  // 토큰이 서 있는 곳을 창의 자리로 읽는다(아이패드에서 옮긴 토큰도)
  it.snap.players[2].x=300;it.snap.players[2].y=200;
  const seen=Q.posFrom(it);
  assert.ok(Math.abs(seen[8][0]-70)<0.2&&Math.abs(seen[8][1]-40)<0.2);
  assert.deepEqual(seen[2],[25,74.3]);
  assert.ok(Math.abs(seen[0][0]-50)<0.2&&Math.abs(seen[0][1]-89)<0.2,'unmoved token reads as its formation place');
  const gone={...it,snap:{...it.snap,players:it.snap.players.filter(p=>p.id!==5)}};assert.equal(Q.posFrom(gone)[4],null,'a deleted token falls back to the formation place');
  // 고치기 — 옮긴 자리만 새로 쓰고, 안 옮긴 토큰은 글자 그대로(반올림도 없다)
  it.snap.players[3].x=123.4;it.snap.players[3].num='77';
  const moved=s.map(()=>null);moved[10]=[50,15];
  Q.applyEdit(it,'4-2-3-1',s,'',it.savedAt+5,moved);
  assert.deepEqual([it.snap.players[10].x,it.snap.players[10].y],[923,370]);
  assert.deepEqual([it.snap.players[3].x,it.snap.players[3].num],[123.4,'77']);
  assert.deepEqual([it.snap.players[2].x,it.snap.players[2].y],[300,200]);
  assert.deepEqual([it.snap.players[8].x,it.snap.players[8].y],[660,506]);
  // 운동장 밖으로는 못 나간다
  const edge=s.map(()=>null);edge[1]=[-30,140];Q.applyEdit(it,'4-2-3-1',s,'',it.savedAt+9,edge);
  const e=Q.pct('4-2-3-1',it.snap.players[1].x,it.snap.players[1].y);assert.ok(e[0]>=5.8&&e[0]<=94.2&&e[1]>=2.8&&e[1]<=95.2,JSON.stringify(e));
  // 포메이션을 바꾸면 새 포메이션 자리(옮긴 자리는 따라가지 않는다)
  Q.applyEdit(it,'4-3-3',Q.remap('4-2-3-1',s,'4-3-3').slots,'',it.savedAt+12,Q.FORMS['4-3-3'].s.map(sl=>[sl[1],sl[2]]));
  Q.FORMS['4-3-3'].s.forEach((_,i)=>assert.deepEqual([it.snap.players[i].x,it.snap.players[i].y],[Q.at('4-3-3',i).x,Q.at('4-3-3',i).y],'4-3-3 '+i));
});

test('drag wiring: token grabs at once, name labels after a long press, drop on a token swaps names',()=>{
  const q=read('studio/board-quick-depth.js'),v=read('studio/board-phone-view.js');
  assert.match(q,/\.pq-bdg\{[^}]*touch-action:none/,'the round token never starts a scroll');
  assert.match(q,/HOLD=280/,'same long press as the squad depth board');
  assert.match(q,/quick:e\.pointerType==='mouse'\|\|!!e\.target\.closest\('\.pq-bdg'\)/);
  assert.match(q,/doc\.addEventListener\('touchmove',block,\{passive:false\}\)/);
  assert.match(q,/if\(Date\.now\(\)-dragged<450\)return;/,'the click after a drop does not open the sheet');
  assert.match(q,/M\.slots\[d\.i\]=M\.slots\[d\.to\];M\.slots\[d\.to\]=a;/,'drop on another token swaps the two name lists');
  assert.match(q,/M\.pos\[d\.i\]=\[round1\(d\.l\),round1\(d\.t\)\];M\.moved\[d\.i\]=true;/);
  assert.match(q,/pos=movedPos\(\)/,'only moved slots are written');
  assert.match(q,/data-pq="pos-reset" id="pqPosReset" hidden/);
  assert.match(q,/label:'고치기'/);
  assert.match(v,/qe\.mode==='edit'/,'viewing my quick board: the tap hint points at the edit button');
  assert.match(v,/if\(\(e\.type==='click'\|\|tap\)&&!quickTap\(t\)\)tip\(\);/,'a finger tap (no click on a guarded canvas) opens the token sheet or shows the hint');
  assert.match(v,/id>=1&&id<=F\.n&&Q\.open\(win,\{token:id\}\)/,'only the quick board slot tokens open the sheet');
  const en=read('studio/i18n/en-board.js');
  for(const k of ['고치기','토큰 표시','이 자리에 이미 있는 이름이에요','포메이션 자리로','포메이션 자리로 돌렸어요','{} 자리를 옮겼어요','{} ↔ {} 이름을 맞바꿨어요','고친 내용을 버리고 닫을까요?','토큰을 누르거나 위의 «{}»에서 바꿔요'])assert.ok(en.includes('"'+k+'":'),k);
});

test('token text: position and number are written only where they were changed, the board label follows the choice',()=>{
  assert.equal(Q.cleanPos(' lcm '),'LCM');assert.equal(Q.cleanPos('수비형미드'),'수비형미');assert.equal(Q.cleanPos(null),'');
  assert.equal(Q.cleanNum('7번'),'7');assert.equal(Q.cleanNum('1234'),'123');assert.equal(Q.cleanNum('ab'),'');
  const s=Q.FORMS['4-2-3-1'].s.map((_,i)=>['선수'+i]),tok=s.map(()=>({pos:null,num:null}));
  // 새 보드 — 아무것도 안 적으면 포메이션 표시 · 자리 차례, 적으면 그 값
  let it=Q.itemFor('4-2-3-1',s,'',Date.UTC(2026,10,16),null,tok,'pos');
  assert.deepEqual(it.snap.players.map(p=>[p.pos,p.num]).slice(0,3),[['GK','1'],['LB','2'],['CB','3']]);assert.equal(it.snap.label,'pos');
  tok[7]={pos:'lm',num:'11'};tok[0]={pos:null,num:'21'};
  it=Q.itemFor('4-2-3-1',s,'',Date.UTC(2026,10,16),null,tok,'num');
  assert.deepEqual([it.snap.players[7].pos,it.snap.players[7].num],['LM','11']);
  assert.deepEqual([it.snap.players[0].pos,it.snap.players[0].num],['GK','21'],'the keeper keeps GK with any number');
  assert.equal(it.snap.label,'num','the board shows numbers');
  // 창으로 읽기 — 포메이션 표시와 다른 포지션만, 번호는 주전 이름(빈 자리는 #i)마다
  const empty={...it,snap:{...it.snap,players:it.snap.players.map(p=>p.id===3?{...p,name:'',num:'33'}:p)}};
  const t=Q.tokFrom(empty);
  assert.equal(t.label,'num');assert.equal(t.posBy[7],'LM');assert.equal(t.posBy[0],null);assert.equal(t.posBy[1],null);
  assert.equal(t.numBy['선수7'],'11');assert.equal(t.numBy['선수0'],'21');assert.equal(t.numBy['#2'],'33');
  assert.deepEqual(t.base[7],{name:'선수7',num:'11'});
  // 고치기 — null 인 칸은 글자 그대로(아이패드에서 적은 글자 번호 · 비운 포지션도), label 을 안 주면 판의 표시 그대로
  it.snap.players[4].num='RB2';it.snap.players[5].pos='';
  const keep=s.map(()=>({pos:null,num:null}));keep[9]={pos:'RM',num:null};keep[10]={pos:null,num:'9'};
  Q.applyEdit(it,'4-2-3-1',s,'',it.savedAt+5,null,keep,null);
  assert.deepEqual([it.snap.players[9].pos,it.snap.players[9].num],['RM','10']);
  assert.deepEqual([it.snap.players[10].pos,it.snap.players[10].num],['ST','9']);
  assert.deepEqual([it.snap.players[4].num,it.snap.players[5].pos,it.snap.players[7].pos],['RB2','','LM']);
  assert.equal(it.snap.label,'num');
  Q.applyEdit(it,'4-2-3-1',s,'',it.savedAt+9,null,keep,'pos');assert.equal(it.snap.label,'pos');
  it.snap.label='fpos';Q.applyEdit(it,'4-2-3-1',s,'',it.savedAt+12,null,keep,'pos');assert.equal(it.snap.label,'fpos','a position label stays the kind it was');
  const q=read('studio/board-quick-depth.js');
  assert.match(q,/id="pqPosCode" maxlength="4"/);assert.match(q,/id="pqNum" inputmode="numeric"/);
  assert.match(q,/data-pq="show-pos">포지션<\/button><button type="button" data-pq="show-num">번호</);
  assert.match(q,/return \{pos:M\.posDirty\[i\]\?posText\(i\):null,num:keep\?null:numOf\(i\)\};/,'only touched token text is written back');
  assert.match(q,/\$\('pqList'\)\.addEventListener\('change'/,'names are renamed when the field is left, not while typing (Korean composition)');
});

test('names are trimmed, capped and never empty',()=>{
  assert.deepEqual(Q.splitNames(' 가 ,, 나 / 다 '),['가','나','다']);
  assert.deepEqual(Q.splitNames('가 나 다'),['가','나','다'],'Korean names separated by spaces only');
  const long='가'.repeat(40);const snap=Q.snapFor('1-2-1',[[long],[],[],[],[]]);assert.equal(snap.players[0].name.length,20);
  const many=Q.parse('GK '+Array.from({length:20},(_,i)=>'선수'+i).join(','),'4-4-2',Q.FORMS['4-4-2'].s.map(()=>[]));
  assert.equal(many.slots[0].length,Q.MAX_NAMES);
});

test('backup names are drawn under the name label inside the token group',()=>{
  const made=[];const node=tag=>{const n={tag,attrs:{},children:[],textContent:'',setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.children.push(c);return c;},querySelector(){return this.children.find(c=>c.attrs.class==='ps-depth')||null;},ownerDocument:null};made.push(n);return n;};
  const doc={createElementNS:(ns,tag)=>{const n=node(tag);n.ownerDocument=doc;return n;}};
  const g=node('g');g.ownerDocument=doc;
  Q.decorate({__nameSize:'m'},g,{id:1,name:'주전',depth:['둘','셋','넷','다섯','여섯']});
  const box=g.children[0];assert.equal(box.attrs.class,'ps-depth');assert.equal(box.attrs['pointer-events'],'none');
  const texts=box.children.filter(c=>c.tag==='text').map(c=>c.textContent);
  assert.deepEqual(texts,['둘','셋','넷','+2명'],'four lines at most');
  const ys=box.children.filter(c=>c.tag==='rect').map(c=>+c.attrs.y);assert.ok(ys[0]>61&&ys.every((y,i)=>!i||y>ys[i-1]),'below the name pill, top to bottom');
  Q.decorate({},g,{id:1,name:'주전',depth:['둘']});assert.equal(g.children.length,1,'drawn once');
  const g2=node('g');g2.ownerDocument=doc;
  for(const p of [{id:2,name:'',depth:['둘']},{id:3,name:'a',depth:[]},{id:4,name:'a',depth:['b'],img:'x'},{id:5,name:'a',depth:['b'],coach:true}])Q.decorate({},g2,p);
  assert.equal(g2.children.length,0);
});

test('wired into the board: one script line, vault open hook, phone notice button, guard exemption, service worker, budget',()=>{
  const b=read('studio/board.html');
  assert.equal(b.split('<script src="board-quick-depth.js"></script>').length,2);
  assert.ok(b.indexOf('board-quick-depth.js')>b.indexOf('board-jersey.js'),'after the token modules');
  assert.match(b,/window\.__vaultOpenView=openItemView;/);
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  const v=read('studio/board-phone-view.js');
  assert.match(v,/data-quick hidden>＋ 빠른 보드</);assert.match(v,/#psPhoneBoardNotice,#psVvPlay,#psEyeDialog,#psQuick'/);
  assert.match(v,/PSQuickDepth\.entry\(win\)/);
  assert.match(read('sw.js'),/'\/studio\/board-quick-depth\.js'/);
});
