import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export function sourceBackend(root){
 const app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8'),legacy=/window\.PS_SYNC=\{url:"([^"]+)",anonKey:"([^"]+)"/.exec(app);
 return legacy?{url:legacy[1],anonKey:legacy[2]}:require(path.join(root,'studio/backend-config.js')).config();
}
export function fixtureBackend(bytes,url,anonKey='synthetic-public-key'){
 const source=bytes.toString();if(!source.includes('PS_BACKEND_EMBED'))return bytes;
 return Buffer.from(source.replace(/var embedded=.*?; \/\/ PS_BACKEND_EMBED/,function(){return 'var embedded='+JSON.stringify({environment:'synthetic',url,anonKey,project:'synthetic'})+'; // PS_BACKEND_EMBED';}));
}
