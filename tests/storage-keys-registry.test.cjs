// 3.053 — 피드백 16(TD-2): 저장 키 표(studio/storage-keys.js) 하나가 «무엇이 어디에 사는가»의 정본이다.
// 코드가 쓰는 키는 전부 표에 있어야 하고(등록 안 된 키 쓰기 금지), 표는 sync.js · storage.js 의 목록과 어긋나지 않는다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');
const K=require('../studio/storage-keys.js');
const {scan,sourceFiles,unregistered}=require('../scripts/storage-keys-scan.cjs');
const rows=K.list();
const sync=R('studio/sync.js'),storage=R('studio/storage.js');
const listIn=(src,name,close)=>{ const i=src.indexOf(name); assert.ok(i>=0,name); return [...src.slice(i,src.indexOf(close,i)).replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/'([A-Za-z0-9_:]+)'/g)].map(m=>m[1]); };

test('코드가 쓰는 키는 전부 표에 있다 — 새 키는 studio/storage-keys.js 에 한 줄 더하고 쓴다',()=>{
  const miss=unregistered(K,scan());
  assert.deepEqual(miss.map(r=>r.key+' ('+[...r.files].join(', ')+')'),[],'표에 없는 키 — node scripts/storage-keys-scan.cjs');
});

test('표의 줄은 모양이 맞고, 지금도 코드에 있다(죽은 줄 없음)',()=>{
  const seen=new Set(), src=sourceFiles().map(R).join('\n');
  for(const r of rows){
    assert.ok(!seen.has(r.key),'두 번 적힌 키 '+r.key); seen.add(r.key);
    assert.ok(K.SYNC[r.sync],r.key+' 동기화 '+r.sync); assert.ok(K.HOME[r.home],r.key+' 위치 '+r.home); assert.ok(K.ROLE[r.role],r.key+' 구실 '+r.role);
    assert.ok(fs.existsSync(path.join(root,'studio',r.owner))||r.owner==='sw.js',r.key+' 파일 '+r.owner);
    if(r.prefix)assert.match(r.key,/[:_]$|^gm_ppt_meta_v1$/,'접두사는 : 또는 _ 로 끝난다(gm_ppt_meta_v1 은 «_personal» 이 붙는 옛 이름) '+r.key);
    assert.ok(src.includes("'"+r.key)||src.includes('"'+r.key),'코드에 없는 줄 '+r.key);
    if(r.role==='recovery')assert.ok(r.of==='*'||K.info(r.of),r.key+' 의 of — 지키는 키를 적는다');
    if(/^ps_/.test(r.key))assert.equal(r.sync==='team'||r.sync==='personal',false,'ps_* 는 동기화 키가 아니다 '+r.key);
  }
  assert.equal(K.info('cs_idp_v1_'+'u-123').key,'cs_idp_v1_','접두사 키는 가장 긴 접두사 줄');
  assert.equal(K.info('nope_v9'),null);
  assert.equal(K.label('cs_board_recovery_v1'),'복구 사본 · 이 기기만');
});

test('표 = sync.js 목록 — KEYS · PERSONAL · IDBK · PLAYER_BLIND · BOARD_LOCAL, storage.js DEVICE_LOCAL',()=>{
  const KEYS=listIn(sync,'var KEYS=[','];'), PERSONAL=listIn(sync,'var PERSONAL={','};'), IDBK=listIn(sync,'var IDBK={','};').filter(k=>sync.includes("'"+k+"':1"));
  const BLIND=listIn(sync,'var PLAYER_BLIND=[','];'), BOARD=listIn(sync,'var BOARD_LOCAL=[','];'), DEV=listIn(storage,'var DEVICE_LOCAL={','};');
  const of=s=>rows.filter(r=>r.sync===s).map(r=>r.key).sort();
  assert.deepEqual(of('team').concat(of('personal')).sort(),KEYS.slice().sort(),'team · personal 줄 = KEYS');
  assert.deepEqual(of('personal'),PERSONAL.slice().sort(),'personal 줄 = PERSONAL');
  for(const k of IDBK)assert.equal(K.info(k).home,'idb',k+' 는 IndexedDB 에서 읽어 올린다(sync.js IDBK)');
  for(const k of DEV)assert.equal(K.info(k).home,'idb',k+' 는 IndexedDB 만(storage.js DEVICE_LOCAL)');
  for(const k of BLIND)assert.equal(K.info(k).sync,'team',k+' 선수에게 안 내려 주는 팀 키');
  for(const k of BOARD)assert.ok(K.info(k),k);
  assert.equal(K.info('cs_drill_lib_v1').sync,'library');
});

test('페이지 저장소 이름은 하나에 하나 — boardStore(IndexedDB) · scoutStore(localStorage) · libStore, «store» 는 더 없다',()=>{
  for(const [f,name] of [['studio/board.html','boardStore'],['studio/scout.html','scoutStore'],['studio/community.html','libStore']]){
    const s=R(f);
    assert.match(s,new RegExp('\\b(const|var) '+name+'=\\{'),f);
    assert.doesNotMatch(s,/(?<![\w.$-])store\.(get|set|ready|owner|hasPending|hasFailed)\(/,f+' 에 옛 이름 store. 이 남았다');
    assert.doesNotMatch(s,/\b(const|var|let) store\s*=/,f);
  }
  assert.match(R('studio/app.html'),/<script src="storage-keys\.js"><\/script>\n<script src="backend-config\.js"><\/script>\n<script src="storage\.js"><\/script>/,'셸이 표와 환경 경계를 저장소보다 먼저 읽는다');
  assert.match(R('sw.js'),/'\/studio\/storage-keys\.js'/,'오프라인 필수 파일');
  assert.match(storage,/PSStorageKeys/,'«지금 자리를 많이 쓰는 것»이 표의 구실을 보여 준다');
});
