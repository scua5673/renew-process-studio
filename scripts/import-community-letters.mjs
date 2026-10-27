import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export function planImport(source,root=ROOT){
  if(!source)throw Error('A canonical letter source directory is required');
  const files=fs.readdirSync(source).filter(f=>/^\d+\.json$/.test(f));
  const rows=files.map(file=>{const raw=fs.readFileSync(path.join(source,file));return {file,raw,doc:JSON.parse(raw)};}).sort((a,b)=>a.doc.number-b.doc.number);
  if(!rows.length)throw Error('Empty letter source; existing letters preserved');
  const seen=new Set();
  for(const {file,doc:d} of rows){
    if(!Number.isInteger(d.number)||d.number<1||d.number>999||seen.has(d.number)||Number(file.slice(0,-5))!==d.number||!d.title||!Array.isArray(d.pieces)||d.pieces.length!==3||!Array.isArray(d.intro)||!Array.isArray(d.closing))throw Error('Invalid letter '+file);
    seen.add(d.number);
    for(const p of d.pieces)if(!p.id||!p.title||!Array.isArray(p.points))throw Error('Invalid article in letter '+d.number);
    if(d.training){
      const pack=JSON.parse(fs.readFileSync(path.join(root,'studio/packs',String(d.number).padStart(2,'0')+'.json'),'utf8'));
      if(pack.drills?.[0]?.letter?.issue!==d.number||!Array.isArray(d.training.exercises)||pack.drills[0].trainings.length!==d.training.exercises.length)throw Error('Training pack mismatch '+d.number);
    }
  }
  const out=path.join(root,'studio/letters'),oldIndex=path.join(out,'index.json');
  if(fs.existsSync(oldIndex))for(const entry of JSON.parse(fs.readFileSync(oldIndex)).issues)if(!seen.has(entry.number))throw Error('Source is missing existing letter '+entry.number+'; nothing written');
  const docs=rows.map(x=>x.doc),issues=docs.map(d=>({number:d.number,title:d.title,sub:d.sub,read_min:d.read_min,pieces:d.pieces.map(p=>({id:p.id,title:p.title,pillar:p.pillar_ko})),training:d.training?{title:d.training.title,theme:d.training.theme,exercises:d.training.exercises.map(e=>({title:e.title,minutes:e.minutes}))}:null}));
  const entries=rows.map(({doc,raw})=>({number:doc.number,sourceSha256:hash(raw)}));
  const revision=hash(entries.map(x=>String(x.number).padStart(2,'0')+':'+x.sourceSha256+'\n').join(''));
  const next=docs.map(d=>[String(d.number).padStart(2,'0')+'.json',JSON.stringify(d)+'\n']);
  next.push(['index.json',JSON.stringify({version:1,issues},null,2)+'\n'],['revision.json',JSON.stringify({version:1,revision,issues:entries},null,2)+'\n']);
  const changes=next.filter(([file,body])=>!fs.existsSync(path.join(out,file))||fs.readFileSync(path.join(out,file),'utf8')!==body);
  return {out,changes,revision,count:docs.length};
}
export function importLetters(source,{root=ROOT,check=false}={}){
  const plan=planImport(source,root);
  if(!check){fs.mkdirSync(plan.out,{recursive:true});for(const [file,body] of plan.changes){const dest=path.join(plan.out,file),temp=dest+'.import-'+process.pid;fs.writeFileSync(temp,body);fs.renameSync(temp,dest);}}
  return {revision:plan.revision,count:plan.count,changed:plan.changes.map(([file])=>file),written:!check};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(importLetters(process.argv[2],{check:process.argv.includes('--check')})));
}
