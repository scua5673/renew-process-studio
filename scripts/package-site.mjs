import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const runtimeRoots=new Set(['studio','vendor','guide','start','social','assets']);
export function isRuntimeFile(file){
 if(!file||file.split('/').some(p=>p.startsWith('.')||p==='..'))return false;
 if(file.includes('/'))return runtimeRoots.has(file.split('/')[0]);
 return ['_headers','_redirects'].includes(file)||/\.(?:html|js|css|json|webmanifest|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp[34]|webm|wav|pdf|txt|wasm)$/i.test(file)&&!file.startsWith('package');
}
export function packageSite(root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')){
 const files=execFileSync(process.env.PS_GIT_BIN||'git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(isRuntimeFile);
 const out=path.join(root,'dist');
 // dist is generated exclusively by this script; stale build files must not ship.
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 // Only known runtime paths from the committed repository can reach the site.
 for(const file of files){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
 for(const required of ['studio/app.html','studio/board.html','studio/board-token-depth.js','sw.js','_headers','_redirects'])if(!files.includes(required))throw Error('Missing deploy file: '+required);
 console.log('Packaged '+files.length+' runtime files into dist.');return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)packageSite();
