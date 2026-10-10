const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.990 — 패턴북에 «국면» 층: 패턴북 › 국면(고정 여섯) › 시퀀스 › 단계 › 장면.
   시퀀스(페이지)의 자리 = mo(국면 키) + ph(세부 국면 id — 꼬리표). 국면 표의 주인은 훈련 카드의 EP_STD_MOMENTS 하나다.
   옛 판(2.985~2.989)은 grp(묶음 글자)로 머리를 그리므로 국면 이름을 grp 에도 적고, 줄을 국면 순서로 세워 둔다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const c=vm.createContext({Object,Array,JSON,Number,Math,String});
vm.runInContext(cut('/* ══ 2.985 · 패턴북 순수 함수 ══','/* ══ 2.985 · 패턴북 순수 함수 끝 ══ */')
  +cut('/* ══ 2.990 · 패턴북 국면 순수 함수 ══ */','/* ══ 2.990 · 패턴북 국면 순수 함수 끝 ══ */')
  +';'+cut('const EP_STD_MOMENTS=[','\n/* ══ 2.282').replace('const EP_STD_MOMENTS','this.MO')
  +';this.api={bkMoFind,bkMoKeyOf,bkPhOf,bkSlotOf,bkOrder,bkTree,bkMapOf,bkInsertAt,bkSetSlot,bkSeqsFromBoard};',c);
const B=c.api,MO=c.MO;
const seq=(name,o)=>Object.assign({name,snap:{players:[],equipment:[],drawings:[],ball:null}},o||{});

test('the phase table is the training card\'s fixed six — the pattern book keeps no copy of its own',()=>{
  assert.deepEqual(plain(MO).map(m=>m.key),['ao','do','dt','at','ic','set']);
  assert.ok(MO.every(m=>m.name&&Array.isArray(m.phases)&&m.phases.length>=1&&m.phases.every(p=>/^std_/.test(p.id)&&p.name)));
  assert.equal((src.match(/const EP_STD_MOMENTS=/g)||[]).length,1);
  assert.match(src,/function bkMO\(\)\{ try\{ return Array\.isArray\(EP_STD_MOMENTS\)\?EP_STD_MOMENTS:\[\]; \}catch\(_\)\{ return \[\]; \} \}/);
});

test('a sequence\'s phase: the key wins, an old «묶음» that spells a phase name is read as that phase',()=>{
  assert.equal(B.bkMoKeyOf(seq('a',{mo:'do'}),MO),'do');
  assert.equal(B.bkMoKeyOf(seq('a',{grp:'공격 조직'}),MO),'ao');
  assert.equal(B.bkMoKeyOf(seq('a',{grp:'공격→수비 전환'}),MO),'dt','spacing does not matter');
  assert.equal(B.bkMoKeyOf(seq('a',{grp:'세트피스'}),MO),'set');
  assert.equal(B.bkMoKeyOf(seq('a',{grp:'우리 팀 약속'}),MO),'','a custom word is not a phase');
  assert.equal(B.bkMoKeyOf(seq('a',{mo:'zz',grp:'수비 조직'}),MO),'do','an unknown key falls back to the word');
  assert.equal(B.bkMoKeyOf(seq('a'),MO),'');
  assert.equal(B.bkSlotOf(seq('a',{mo:'ao'}),MO),'m:ao');
  assert.equal(B.bkSlotOf(seq('a',{grp:'우리 팀 약속'}),MO),'g:우리 팀 약속');
  assert.equal(B.bkSlotOf(seq('a'),MO),'');
});

test('the sub-phase is a tag — it only counts inside its own phase',()=>{
  assert.equal(B.bkPhOf(seq('a',{mo:'ao',ph:'std_ao_1'}),MO).name,'빌드업');
  assert.equal(B.bkPhOf(seq('a',{mo:'ao',ph:'std_do_1'}),MO),null,'another phase\'s tag is ignored');
  assert.equal(B.bkPhOf(seq('a',{ph:'std_ao_1'}),MO),null,'no phase, no tag');
});

test('choosing a phase writes the key, mirrors the name for older versions, and drops a tag that belongs elsewhere',()=>{
  const p=seq('a',{grp:'우리 팀 약속'});
  assert.equal(B.bkSetSlot(p,MO,'ao','std_ao_2'),true);
  assert.deepEqual([p.mo,p.grp,p.ph],['ao','공격 조직','std_ao_2']);
  B.bkSetSlot(p,MO,'do','std_ao_2');
  assert.deepEqual([p.mo,p.grp,p.ph],['do','수비 조직',undefined]);
  B.bkSetSlot(p,MO,'do','std_do_3'); assert.equal(p.ph,'std_do_3');
  B.bkSetSlot(p,MO,'do',''); assert.equal('ph' in p,false,'tapping the tag again removes it');
  assert.equal(B.bkSetSlot(p,MO,'zz',''),false); assert.equal(p.mo,'do','an unknown phase changes nothing');
  B.bkSetSlot(p,MO,'',''); assert.deepEqual(['mo' in p,'ph' in p,'grp' in p],[false,false,false],'«국면 미정» clears all three');
  assert.equal(p.name,'a');
});

test('the tree: six phases always, custom groups and «국면 미정» only when someone is there',()=>{
  const L=[seq('s0',{mo:'set'}),seq('s1',{mo:'ao',ph:'std_ao_1'}),seq('s2'),seq('s3',{grp:'우리 팀 약속'}),seq('s4',{mo:'ao'})];
  const T=plain(B.bkTree(L,MO));
  assert.deepEqual(T.map(g=>[g.kind,g.name,g.items]),[['mo','공격 조직',[1,4]],['mo','수비 조직',[]],['mo','공격 → 수비 전환',[]],['mo','수비 → 공격 전환',[]],['mo','경합 · 세컨드 볼',[]],['mo','세트피스',[0]],['grp','우리 팀 약속',[3]],['none','국면 미정',[2]]]);
  assert.deepEqual(plain(B.bkTree([seq('a',{mo:'ao'})],MO)).map(g=>g.kind),['mo','mo','mo','mo','mo','mo']);
});

test('the line-up follows the phase order and keeps the order inside a phase',()=>{
  const L=[seq('s0',{mo:'set'}),seq('s1',{mo:'ao'}),seq('s2'),seq('s3',{grp:'우리 팀 약속'}),seq('s4',{mo:'ao'}),seq('s5',{mo:'do'})];
  assert.deepEqual(plain(B.bkOrder(L,MO)),[1,4,5,0,3,2]);
  const sorted=B.bkOrder(L,MO).map(i=>L[i]);
  assert.deepEqual(plain(B.bkOrder(sorted,MO)),[0,1,2,3,4,5],'already in order: nothing moves');
  // 새 시퀀스가 설 자리 — 그 국면의 마지막 뒤. 빈 국면이면 표에서 앞선 자리들의 뒤
  assert.equal(B.bkInsertAt(sorted,MO,'ao'),2);
  assert.equal(B.bkInsertAt(sorted,MO,'do'),3);
  assert.equal(B.bkInsertAt(sorted,MO,'dt'),3,'an empty phase slots in after the phases before it');
  assert.equal(B.bkInsertAt(sorted,MO,'set'),4,'before the custom group and the unplaced');
  assert.equal(B.bkInsertAt([],MO,'ao'),0);
  assert.equal(B.bkInsertAt(sorted,MO,'zz'),6);
});

test('the map: one cell per sub-phase, untagged sequences wait in «rest»',()=>{
  const L=[seq('s0',{mo:'ao',ph:'std_ao_1'}),seq('s1',{mo:'ao',ph:'std_ao_3'}),seq('s2',{mo:'ao'}),seq('s3',{mo:'set',ph:'std_set_2'}),seq('s4')];
  const M=plain(B.bkMapOf(L,MO));
  assert.deepEqual(M.map(c=>[c.name,c.n]),[['공격 조직',3],['수비 조직',0],['공격 → 수비 전환',0],['수비 → 공격 전환',0],['경합 · 세컨드 볼',0],['세트피스',1],['국면 미정',1]]);
  assert.deepEqual(M[0].cells.map(k=>[k.name,k.items]),[['빌드업',[0]],['전진 · 전개',[]],['침투 · 마무리',[1]]]); assert.deepEqual(M[0].rest,[2]);
  assert.deepEqual(M[5].cells.map(k=>k.items),[[],[3]]);
  assert.deepEqual([M[6].kind,M[6].cells,M[6].rest],['none',[],[4]]);
});

test('copies carry the place — duplicating or importing a sequence keeps its phase and tag',()=>{
  const out=plain(B.bkSeqsFromBoard({name:'원본',pages:[seq('p1',{mo:'do',ph:'std_do_1',grp:'수비 조직',call:'올려'}),seq('p2')]}));
  assert.deepEqual(out.map(q=>[q.name,q.mo,q.ph,q.grp,q.call]),[['p1','do','std_do_1','수비 조직','올려'],['p2',undefined,undefined,undefined,undefined]]);
  assert.match(src,/\["grp","when","call","mo","ph"\]\.forEach\(function\(k\)\{ if\(typeof src\[k\]==="string"&&src\[k\]\)_cp\[k\]=src\[k\]; \}\);/,'dup()');
  assert.match(src,/p&&p\.call\|\|"",p&&p\.mo\|\|"",p&&p\.ph\|\|""\]\.join\("~"\)/,'the «변경 있음» fingerprint sees the place');
});

test('the screen: the rail is a phase tree, the map opens first and steps aside when a sequence is chosen',()=>{
  assert.match(src,/if\(want&&!bookWas\)\{ bookWas=true; openG=\{\}; mapWant=true; \}/,'opening a pattern book raises the map');
  assert.match(src,/else if\(!want&&bookWas\)\{ bookWas=false; mapWant=false; closeMap\(\); \}/,'leaving it takes the map down');
  assert.match(src,/function switchTo\(i\)\{ if\(!pages\|\|i===idx\|\|!pages\[i\]\)return; try\{ if\(window\.__bkMap\)window\.__bkMap\.close\(\); \}catch\(_\)\{\} capture\(\);/,'choosing a sequence closes the map');
  assert.match(src,/var edit=|,edit=!ro\(\)&&wide\(\),/,'only the wide editing screen gets ＋ on the map');
  assert.match(src,/if\(bkSlotOf\(p,_MO\)!==_was\)\{ var _cur=pages\[idx\]; pages\.splice\(i,1\); pages\.splice\(key\?bkInsertAt\(pages,_MO,key\):pages\.length,0,p\); idx=Math\.max\(0,pages\.indexOf\(_cur\)\); \}\s+_bkResort\(\); render\(\); _bkTouch\(\); return true;/,'a sequence that changes phase joins the end of the new one, and the board follows its own sequence');
  assert.match(src,/if\(_mo&&pages\.length===1&&_bkBlank\(pages\[0\]\)&&!bkSlotOf\(pages\[0\],_MO\)\)\{ bkSetSlot\(pages\[0\],_MO,_mo,_mp\); render\(\); _bkTouch\(\); return true; \}/,'a fresh book: the first ＋ places the blank sequence instead of making a second one');
  const css=cut('/* 2.990 — 패턴북 국면 층.','</style>');
  assert.match(css,/#bkMap\{position:fixed;z-index:195;/); assert.match(css,/body\.focus-board #bkMap,body\.vault-full #bkMap,body\.editing #bkMap,body\.meet-mode #bkMap\{display:none!important\}/);
  for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(['12','14','16'].includes(m[1]),'font-size '+m[1]);
  for(const m of css.matchAll(/font-weight:(\d+)/g))assert.ok(['500','600','700'].includes(m[1]),'font-weight '+m[1]);
  for(const m of css.matchAll(/border-radius:([^;}]+)/g))assert.ok(['0','6px','10px','999px'].includes(m[1].trim()),'radius '+m[1]);
});
