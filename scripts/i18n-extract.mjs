// 한국어 화면 글 뽑기 — node scripts/i18n-extract.mjs
// scripts/i18n-report.json 에 {files:{파일 → [글]}, areas:{영역 → 개수}} 를 쓴다(만든 파일 — git 에 넣지 않는다).
import fs from 'node:fs';
import path from 'node:path';
import {root,extractAll,byArea,areaOf,AREAS,OTHER_AREAS} from './i18n-lib.mjs';
const files=extractAll(),areas=byArea(files),summary={};
for(const a of [...AREAS,...OTHER_AREAS]){
  const list=Object.keys(files).filter(f=>areaOf(f)===a);
  summary[a]={files:list.length,strings:(areas[a]||new Set()).size,templates:[...(areas[a]||[])].filter(s=>s.includes('{}')).length};
}
const out=path.join(root,'scripts/i18n-report.json');
fs.writeFileSync(out,JSON.stringify({generated:'node scripts/i18n-extract.mjs',areas:summary,files},null,1));
console.table(summary);
console.log('wrote '+path.relative(root,out)+' — '+Object.keys(files).length+' files');
