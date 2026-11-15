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
