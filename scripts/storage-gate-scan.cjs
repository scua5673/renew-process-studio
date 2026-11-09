#!/usr/bin/env node
/* 저장 계층의 문 — 늘어나면 안 되는 것을 센다(설계: 문서 저장소 processstudio-문서/저장계층-정리-설계-2026-11-05.md 0단계).
   tests/storage-gate.test.cjs 가 쓰고, 혼자 돌리면 기준(tests/storage-gate.baseline.json)보다 늘어난 파일을 적어 준다:
     node scripts/storage-gate-scan.cjs            지금 숫자와 기준의 차이
     node scripts/storage-gate-scan.cjs --write    기준을 지금 숫자로 고쳐 쓴다(줄였을 때만 — 증가가 있으면 거부한다)
   세는 것 두 가지:
   ① direct — localStorage.setItem 을 직접 부르는 곳 가운데, 키가 화면 설정류(pref · seen · session · cache · diag …)가 아닌 것.
      키가 글자 그대로가 아니면(변수) 내용 자료일 수 있으므로 센다. 내용 자료는 psSaveShared / psSaveSharedAsync 로 쓴다.
   ② silent — 아무것도 하지 않는 catch. 실패를 삼키면 거울만 뒤처지고 화면은 «직전 그대로»가 된다.
   정본 목록(truthLists) — 화면마다 따로 적어 둔 «IndexedDB 에 사는 키» 목록. 키 표(studio/storage-keys.js)와 견준다. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const {sourceFiles}=require('./storage-keys-scan.cjs');
const K=require('../studio/storage-keys.js');
const BASELINE=path.join(root,'tests','storage-gate.baseline.json');

/* 내용 자료로 치는 구실. 나머지 구실의 키는 localStorage 에 직접 써도 된다. */
const CONTENT={data:1,draft:1,queue:1,recovery:1};
const SET=/localStorage\s*\.\s*setItem\(\s*(?:(['"])([A-Za-z0-9_:.\-]+)\1)?/g;
const SILENT=[
  /catch\s*\(\s*[\w$]*\s*\)\s*\{\s*\}/g,
  /\.catch\(\s*function\s*\(\s*[\w$]*\s*\)\s*\{\s*\}\s*\)/g,
  /\.catch\(\s*\(?\s*[\w$]*\s*\)?\s*=>\s*\{\s*\}\s*\)/g
];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const code=s=>s.replace(/\/\*[\s\S]*?\*\//g,'');   /* 주석 속 글자는 세지 않는다 */

function countSource(source){
  const s=code(source);
  let direct=0, silent=0, m;
  SET.lastIndex=0;
  while((m=SET.exec(s))){
    const row=m[2]?K.info(m[2]):null;
    if(!row||CONTENT[row.role])direct++;
  }
  for(const re of SILENT){ re.lastIndex=0; silent+=(s.match(re)||[]).length; }
  return {direct,silent};
}

function counts(files){
  const out={direct:{},silent:{}};
  for(const f of files||sourceFiles()){
    const c=countSource(read(f));
    if(c.direct)out.direct[f]=c.direct;
    if(c.silent)out.silent[f]=c.silent;
  }
  return out;
}

function baseline(){ return JSON.parse(fs.readFileSync(BASELINE,'utf8')); }

/* 기준보다 늘어난 파일. 기준에 없는 파일은 0 에서 시작한다. */
function over(now,base){
  const rows=[];
  for(const kind of ['direct','silent'])
    for(const f of Object.keys(now[kind])){
      const was=(base[kind]&&base[kind][f])||0;
      if(now[kind][f]>was)rows.push({kind,file:f,was,now:now[kind][f]});
    }
  return rows;
}

/* 이름으로 적힌 목록 한 개: «NAME={…}» 안의 키들 */
function listIn(file,name){
  const s=code(read(file)), i=s.search(new RegExp('\\b'+name+'\\s*=\\s*\\{'));
  if(i<0)return null;
  return [...s.slice(i,s.indexOf('}',i)).matchAll(/["']?([A-Za-z][A-Za-z0-9_]*_v\d+)["']?\s*:/g)].map(m=>m[1]).sort();
}
const LISTS=[
  ['studio/scout.html','SHARED_IDB'],
  ['studio/team-files.js','IDB_MIRROR'],
  ['studio/app.html','KNOWN_IDB'],
  ['studio/app.html','MIRRORED_IDB']
];
function truthLists(){ return LISTS.map(([file,name])=>({file,name,keys:listIn(file,name)})); }

/* 표와 목록의 어긋남 — 시험이 막는 것. 한 줄 = «파일 목록: 무엇이 어긋났나».
   목록에 적힌 키는 표에 있어야 하고, 표에서도 IndexedDB 정본이어야 한다. */
function gaps(){
  const out=[];
  for(const L of truthLists()){
    if(!L.keys){ out.push(L.file+' '+L.name+': 목록을 찾지 못함'); continue; }
    for(const k of L.keys){
      const row=K.info(k);
      if(!row)out.push(L.file+' '+L.name+': 표에 없는 키 '+k);
      else if(row.home!=='idb')out.push(L.file+' '+L.name+': 표에서는 localStorage 정본 '+k);
    }
  }
  if(!K.info('sq:x'))out.push('studio/storage-keys.js: 선수별 행 접두사 sq: 가 표에 없음');
  return out.sort();
}

/* 살펴볼 곳 — 시험이 막지는 않는다. 표에서 «IndexedDB 정본 + 거울»인 키를 그 파일이 글자 그대로 다루는데 목록에는 없다.
   읽기만 하는 것일 수도 있다. 쓰는 곳이면 거울만 고치고 IndexedDB 를 건너뛰는 길이다(예: team-files.js 의 scout_tool_v1). */
function hints(){
  const out=[];
  for(const L of truthLists()){
    if(!L.keys)continue;
    const src=code(read(L.file)), has=new Set(L.keys);
    for(const row of K.list())
      if(row.home==='idb'&&row.mirror&&!row.prefix&&!has.has(row.key)&&new RegExp('["\']'+row.key+'["\']').test(src))
        out.push(L.file+' '+L.name+': 다루는데 목록에 없음 '+row.key);
  }
  return out.sort();
}

if(require.main===module){
  const now=counts();
  if(process.argv.includes('--write')){
    const increases=fs.existsSync(BASELINE)?over(now,baseline()):[];
    if(increases.length){
      console.error('storage-gate: 기준 증가를 거부했다. 기존 기준을 유지한다.');
      for(const r of increases)console.error('  '+r.kind+' '+r.file+' '+r.was+' → '+r.now);
      process.exit(1);
    }
    const sorted=o=>Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]]));
    fs.writeFileSync(BASELINE,JSON.stringify({direct:sorted(now.direct),silent:sorted(now.silent)},null,2)+'\n');
    console.log('storage-gate: 기준을 고쳐 썼다 — '+path.relative(root,BASELINE));
    process.exit(0);
  }
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
  console.log('storage-gate: 직접 쓰기 '+sum(now.direct)+'곳 · 빈 catch '+sum(now.silent)+'곳');
  const rows=fs.existsSync(BASELINE)?over(now,baseline()):[];
  for(const r of rows)console.log('  늘어남 '+r.kind+'  '+r.file+'  '+r.was+' → '+r.now);
  console.log('정본 목록의 어긋남(시험이 막는다):');
  for(const g of gaps())console.log('  '+g);
  console.log('살펴볼 곳(막지 않는다):');
  for(const g of hints())console.log('  '+g);
  process.exit(rows.length?1:0);
}
module.exports={countSource,counts,baseline,over,truthLists,gaps,hints,CONTENT};
