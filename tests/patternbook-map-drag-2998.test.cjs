const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.998 — 사용자 «패턴북 지도에서 드래그로 이동할 수 있게». 국면 지도에서 시퀀스를 끌어 다른 국면·세부 국면 칸에 놓으면 그 자리로 가고,
   같은 칸 안에서는 차례가 바뀐다. 자리 정하기와 줄 세우기는 bkPlace(순수 함수) 하나가 맡고, book.place 는 그 줄을 페이지에 옮겨 담기만 한다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const c=vm.createContext({Object,Array,JSON,Number,Math,String});
vm.runInContext(cut('/* ══ 2.985 · 패턴북 순수 함수 ══','/* ══ 2.985 · 패턴북 순수 함수 끝 ══ */')
  +cut('/* ══ 2.990 · 패턴북 국면 순수 함수 ══ */','/* ══ 2.990 · 패턴북 국면 순수 함수 끝 ══ */')
  +';'+cut('const EP_STD_MOMENTS=[','\n/* ══ 2.282').replace('const EP_STD_MOMENTS','this.MO')
  +';this.api={bkPlace,bkSlotOf};',c);
const B=c.api,MO=c.MO;
const seq=(name,o)=>Object.assign({name,snap:{players:[],equipment:[],drawings:[],ball:null}},o||{});
const names=L=>L.map(p=>p.name);
const book=()=>[seq('a1',{mo:'ao',grp:'공격 조직',ph:'std_ao_1'}),seq('a2',{mo:'ao',grp:'공격 조직',ph:'std_ao_2'}),seq('a3',{mo:'ao',grp:'공격 조직',ph:'std_ao_1'}),
  seq('d1',{mo:'do',grp:'수비 조직',ph:'std_do_1'}),seq('s1',{mo:'set',grp:'세트피스'}),seq('g1',{grp:'우리 팀 약속'}),seq('n1')];

test('dropping on another phase\'s cell moves the sequence there, in front of the one it was dropped on',()=>{
  const L=book(),out=B.bkPlace(L,MO,0,'do','std_do_1',3,null);
  assert.deepEqual(names(out),['a2','a3','a1','d1','s1','g1','n1']);
  assert.deepEqual([L[0].mo,L[0].grp,L[0].ph],['do','수비 조직','std_do_1'],'phase, mirrored name and tag are written');
  assert.deepEqual(names(L),['a1','a2','a3','d1','s1','g1','n1'],'the input line is not reordered');
  assert.ok(out.every(p=>L.includes(p)),'the same page objects — nothing is copied');
});

test('dropping below the last one of a cell puts it right after that one',()=>{
  const L=book(),out=B.bkPlace(L,MO,4,'ao','std_ao_1',null,2);
  assert.deepEqual(names(out),['a1','a2','a3','s1','d1','g1','n1']);
  assert.deepEqual([L[4].mo,L[4].ph],['ao','std_ao_1']);
});

test('inside one cell only the order changes',()=>{
  const L=book(),out=B.bkPlace(L,MO,2,'ao','std_ao_1',0,null);
  assert.deepEqual(names(out),['a3','a1','a2','d1','s1','g1','n1']);
  const back=B.bkPlace(out,MO,0,'ao','std_ao_1',null,1);
  assert.deepEqual(names(back),['a1','a3','a2','d1','s1','g1','n1'],'and back down again');
});

test('dropping where it already stands leaves the line as it was — even with another sub-phase\'s sequence in between',()=>{
  const L=book();   /* 빌드업 칸 = a1 · a3 (사이에 전진 칸의 a2) */
  assert.deepEqual(names(B.bkPlace(L,MO,0,'ao','std_ao_1',2,null)),names(L),'in front of its own next one');
  assert.deepEqual(names(B.bkPlace(L,MO,2,'ao','std_ao_1',null,0)),names(L),'behind its own previous one');
  assert.deepEqual(names(B.bkPlace(L,MO,0,'ao','std_ao_1',0,null)),names(L),'on itself');
});

test('an empty cell: same phase keeps the spot (only the tag changes), a new phase goes to its end',()=>{
  const L=book(),out=B.bkPlace(L,MO,0,'ao','std_ao_3',null,null);
  assert.deepEqual(names(out),names(L)); assert.equal(L[0].ph,'std_ao_3');
  const L2=book(),out2=B.bkPlace(L2,MO,1,'dt','std_dt_1',null,null);
  assert.deepEqual(names(out2),['a1','a3','d1','a2','s1','g1','n1'],'an empty phase slots in after the phases before it');
  assert.deepEqual([L2[1].mo,L2[1].grp,L2[1].ph],['dt','공격 → 수비 전환','std_dt_1']);
  const L3=book(),out3=B.bkPlace(L3,MO,3,'set','',null,null);
  assert.deepEqual(names(out3),['a1','a2','a3','s1','d1','g1','n1']); assert.equal('ph' in L3[3],false,'the untagged cell clears the tag');
});

test('out of an old «묶음» or «국면 미정», and into «국면 미정»',()=>{
  const L=book(),out=B.bkPlace(L,MO,5,'ao','std_ao_2',1,null);
  assert.deepEqual(names(out),['a1','g1','a2','a3','d1','s1','n1']); assert.deepEqual([L[5].mo,L[5].grp,L[5].ph],['ao','공격 조직','std_ao_2']);
  const L2=book(),out2=B.bkPlace(L2,MO,6,'set','',null,4);
  assert.deepEqual(names(out2),['a1','a2','a3','d1','s1','n1','g1']); assert.deepEqual([L2[6].mo,'ph' in L2[6]],['set',false]);
  const L3=book(),out3=B.bkPlace(L3,MO,0,'','',6,null);
  assert.deepEqual(names(out3),['a2','a3','d1','s1','g1','a1','n1']); assert.equal(B.bkSlotOf(L3[0],MO),'');
  assert.deepEqual(['mo' in L3[0],'ph' in L3[0],'grp' in L3[0]],[false,false,false]);
});

test('the phase order always wins — a drop anchor from another phase cannot split a phase',()=>{
  const L=book(),out=B.bkPlace(L,MO,0,'set','',3,null);   /* d1 is not in the set cell — the line is still put back in phase order */
  assert.deepEqual(names(out),['a2','a3','d1','a1','s1','g1','n1']);
});

test('nothing to place: a missing sequence or an unknown phase',()=>{
  const L=book();
  assert.equal(B.bkPlace(L,MO,9,'ao','',null,null),null);
  assert.equal(B.bkPlace(L,MO,0,'zz','',null,null),null); assert.equal(L[0].mo,'ao','an unknown phase changes nothing');
});

test('the map screen: drag only where ＋ is, mouse after a small move, finger after a hold, and the page line follows bkPlace',()=>{
  assert.match(src,/mapEl\.classList\.toggle\("bkm-edit",edit\)/,'the editing screen is marked');
  assert.match(src,/if\(drag\|\|!mapEl\|\|!mapEl\.classList\.contains\("bkm-edit"\)\|\|\(e\.pointerType==="mouse"&&e\.button!==0\)\)return;/,'view-only and phone maps do not drag');
  assert.match(src,/if\(drag\.touch\)drag\.timer=setTimeout\(function\(\)\{ if\(drag&&!drag\.on\)dragLift\(\); \},200\);/,'a finger holds 0.2 s first');
  assert.match(src,/>\(d\.touch\?10:5\); if\(!far\)return; if\(d\.touch\)\{ dragEnd\(false\); return; \}/,'a finger that moves first is scrolling');
  assert.match(src,/document\.addEventListener\("touchmove",function\(e\)\{ if\(drag&&drag\.on\)e\.preventDefault\(\); \},\{passive:false\}\);/,'a held drag does not scroll the map');
  assert.match(src,/if\(c\.kind!=="grp"\)ce\.setAttribute\("data-drop","1"\);/,'old «묶음» columns take nothing');
  assert.match(src,/place:function\(i,key,phId,before,after\)\{ ensure\(\); var p=pages\[i\],_MO=bkMO\(\); if\(!p\)return false;[^\n]*np=bkPlace\(pages,_MO,i,key,phId,before,after\);/);
  assert.match(src,/pages\.length=0; Array\.prototype\.push\.apply\(pages,np\); idx=Math\.max\(0,pages\.indexOf\(_cur\)\); render\(\); _bkTouch\(\); return true; \}/,'the board follows its own sequence');
});
