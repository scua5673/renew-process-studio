import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
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
 const manifest=buildManifest(out,files);fs.writeFileSync(path.join(out,MANIFEST),JSON.stringify(manifest));
 console.log('Packaged '+files.length+' runtime files into dist ('+manifest.release+', manifest '+Object.keys(manifest.files).length+' files).');return files;
}
/* 3.041 — 판 목록(피드백 TD-4). 배포되는 파일마다 SHA-256. 서비스워커는 install 때 옛 판 캐시의 같은 주소를 해시로 견주어
   같으면 옮겨 담고 다른 것만 받는다(판마다 13.6MB 를 전부 다시 받던 것). release-guard 는 이 목록으로
   «파일은 바뀌었는데 판 번호(CACHE)는 그대로»인 배포를 멈춘다. 이 파일은 dist 에만 생긴다(저장소에 두지 않는다). */
export const MANIFEST='sw-manifest.json';
export function releaseOf(root){
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
 const cache=(/^const CACHE = '(process-[0-9.]+)';/m.exec(sw)||[])[1],build=(/window\.PS_BUILD='([0-9.]+)'/.exec(app)||[])[1];
 if(!cache||!build||cache!=='process-'+build)throw Error('sw.js CACHE ('+cache+') must equal process-<PS_BUILD> ('+build+')');
 return {release:cache,build};
}
export function buildManifest(root,files){
 const out={v:1,...releaseOf(root),files:{}};
 for(const file of files.slice().sort())out.files['/'+file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)packageSite();
