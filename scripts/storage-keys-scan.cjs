#!/usr/bin/env node
/* 저장 키 찾기 — studio/storage-keys.js(키 표)와 견줄 «코드가 실제로 쓰는 키».
   tests/storage-keys-registry.test.cjs 가 쓰고, 혼자 돌리면 표에 없는 키를 적어 준다:
     node scripts/storage-keys-scan.cjs
   찾는 곳 두 가지(이 규칙이 곧 «등록 안 된 키 쓰기 금지»의 범위다):
   ① 저장 호출의 글자 그대로인 키 — localStorage/sessionStorage.getItem·setItem·removeItem,
      window.storage.get·set·delete, 페이지 저장소(boardStore · scoutStore · libStore).get·set,
      psSaveShared, PSStorage.auxGet·auxSet. 뒤에 «+»가 붙으면 접두사다.
   ② 키 이름을 담는 상수 — 이름이 KEY · PREFIX · _K 로 끝나거나 대문자인 변수에 키 모양 글자를 넣는 곳. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

function sourceFiles(){
  const dir=path.join(root,'studio');
  return fs.readdirSync(dir).filter(f=>/\.(html|js)$/.test(f)&&f!=='storage-keys.js').map(f=>'studio/'+f).concat(['sw.js']).sort();
}
const Q=String.raw`(['"])([A-Za-z0-9_:.\-]+)\1(\s*\+)?`;
const CALLS=[
  String.raw`(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\(\s*`,
  String.raw`\b(?:window\.)?storage\s*\.\s*(?:get|set|delete|remove)\(\s*`,
  String.raw`\b(?:boardStore|scoutStore|libStore)\s*\.\s*(?:get|set|del|remove)\(\s*`,
  String.raw`\bpsSaveShared\(\s*`,
  String.raw`\bPSStorage\s*\.\s*aux(?:Get|Set)\(\s*`
].map(p=>new RegExp(p+Q,'g'));
const KEYISH=/^(?:(?:ps|cs)_[A-Za-z0-9_]+:?|[a-z][a-z0-9]*(?:_[a-z0-9]+)*_v\d+[:_]?)$/;
const CONST=/\b([A-Z_][A-Z0-9_]*|[a-z][A-Za-z0-9_]*(?:KEY|Key|PREFIX|Prefix|_K|K))\s*[:=]\s*(['"])([A-Za-z0-9_:]+)\2(\s*\+)?/g;

function scan(files){
  const out=new Map();
  const add=(k,file,prefix)=>{ let r=out.get(k); if(!r)out.set(k,r={key:k,files:new Set(),prefix:false}); r.files.add(file); if(prefix)r.prefix=true; };
  for(const f of files||sourceFiles()){
    const s=fs.readFileSync(path.join(root,f),'utf8');
    for(const re of CALLS){ re.lastIndex=0; let m; while((m=re.exec(s))){ if(KEYISH.test(m[2])||/_v\d+/.test(m[2])||/^[a-z]+(?:_[a-z0-9]+)+$/.test(m[2]))add(m[2],f,!!m[3]||/[:_]$/.test(m[2])); } }
    CONST.lastIndex=0; let m; while((m=CONST.exec(s))){ if(KEYISH.test(m[3]))add(m[3],f,!!m[4]||/[:_]$/.test(m[3])); }
  }
  return out;
}

function unregistered(reg,found){
  const miss=[];
  for(const r of found.values())if(!reg.info(r.key))miss.push(r);
  return miss.sort((a,b)=>a.key<b.key?-1:1);
}

if(require.main===module){
  const reg=require(path.join(root,'studio/storage-keys.js'));
  const found=scan(), miss=unregistered(reg,found);
  if(!miss.length){ console.log('storage-keys: '+found.size+' keys in code, all registered'); process.exit(0); }
  console.log('storage-keys: not in studio/storage-keys.js —');
  for(const r of miss)console.log('  '+r.key+(r.prefix?'  (prefix)':'')+'  '+[...r.files].join(', '));
  process.exit(1);
}
module.exports={scan,sourceFiles,unregistered,KEYISH};
