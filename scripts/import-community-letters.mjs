import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Explicit source directory; never downloads or edits the editorial originals.
const source=process.argv[2];
if(!source)throw Error('Usage: node scripts/import-community-letters.mjs <letter site/src/issues>');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'studio/letters');
const docs=fs.readdirSync(source).filter(f=>/^\d+\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(source,f),'utf8'))).sort((a,b)=>a.number-b.number);
const seen=new Set();
for(const d of docs){
  if(!Number.isInteger(d.number)||d.number<1||d.number>999||seen.has(d.number)||!d.title||!Array.isArray(d.pieces))throw Error('Invalid letter '+d.number);
  seen.add(d.number);
  if(d.training){
    const pack=JSON.parse(fs.readFileSync(path.join(root,'studio/packs',String(d.number).padStart(2,'0')+'.json'),'utf8'));
    if(pack.drills[0].letter.issue!==d.number||pack.drills[0].trainings.length!==d.training.exercises.length)throw Error('Training pack mismatch '+d.number);
  }
}
fs.mkdirSync(out,{recursive:true});
for(const d of docs)fs.writeFileSync(path.join(out,String(d.number).padStart(2,'0')+'.json'),JSON.stringify(d)+'\n');
const issues=docs.map(d=>({number:d.number,title:d.title,sub:d.sub,read_min:d.read_min,pieces:d.pieces.map(p=>({id:p.id,title:p.title,pillar:p.pillar_ko})),training:d.training?{title:d.training.title,theme:d.training.theme,exercises:d.training.exercises.map(e=>({title:e.title,minutes:e.minutes}))}:null}));
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify({version:1,issues},null,2)+'\n');
console.log(`Imported ${issues.length} complete letters; originals unchanged.`);
