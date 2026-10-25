import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PRODUCTION_SITE='51517b22-e1df-493a-ad81-5204303ded1b',TEST_SITE='52c8c8c7-f3ae-41e0-95ae-19233921a900';
export const PRODUCTION_PROJECT='jvtajoeptzfsdwizxejg';
const production={environment:'production',url:'https://'+PRODUCTION_PROJECT+'.supabase.co',anonKey:'sb_publishable_-Es-apybpr1zPTLzLE2sUw_kV-5ap-k',project:PRODUCTION_PROJECT};
function fail(code){throw new Error('backend-config: '+code);}
function validatePublicKey(key,project){
 if(/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key))return;
 try{const parts=key.split('.'),v=JSON.parse(Buffer.from(parts[1],'base64url'));if(parts.length===3&&v.role==='anon'&&(!v.ref||v.ref===project))return;}catch(_){}
 fail('a publishable/anon client key is required; server credentials are forbidden');
}
export function resolveBackend(env=process.env){
 const hosted=env.NETLIFY==='true';
 if(!hosted){
  if(env.SITE_ID||env.CONTEXT||env.BRANCH)fail('Netlify metadata is incomplete');
  if(env.PS_BACKEND_ROLE&&env.PS_BACKEND_ROLE!=='synthetic')fail('local builds must explicitly remain synthetic');
  const url=env.PS_SYNTHETIC_URL||'https://synthetic-backend.invalid',u=new URL(url);
  if(!['http:','https:'].includes(u.protocol)||(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&!u.hostname.endsWith('.invalid')))fail('synthetic backend must be HTTP(S) loopback or .invalid');
  if(u.username||u.password||u.pathname!=='/'||u.search||u.hash)fail('invalid synthetic backend URL');
  return {environment:'synthetic',url:u.origin,anonKey:env.PS_SYNTHETIC_PUBLIC_KEY||'synthetic-public-key',project:'synthetic'};
 }
 const site=env.SITE_ID,context=env.CONTEXT,branch=env.BRANCH;
 if(![PRODUCTION_SITE,TEST_SITE].includes(site)||!['production','deploy-preview','branch-deploy'].includes(context)||!branch)fail('unknown site/context/branch');
 const live=site===PRODUCTION_SITE&&context==='production'&&branch==='main';
 if(context==='production'&&((site===PRODUCTION_SITE&&branch!=='main')||(site===TEST_SITE&&branch!=='staging')))fail('production branch does not match its site');
 if(live){
  if(env.PS_BACKEND_ROLE!=='production')fail('explicit production backend role is required');
  return {...production};
 }
 if(env.PS_BACKEND_ROLE!=='test')fail('explicit test backend role is required');
 const url=env.PS_TEST_SUPABASE_URL,key=env.PS_TEST_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)fail('test backend is not configured; no production fallback');
 let u;try{u=new URL(url);}catch(_){fail('invalid test backend URL');}
 const match=/^([a-z0-9]{20})\.supabase\.co$/.exec(u.hostname);
 if(u.protocol!=='https:'||!match||u.username||u.password||u.pathname!=='/'||u.search||u.hash)fail('test backend must be a Supabase HTTPS project origin');
 if(match[1]===PRODUCTION_PROJECT)fail('test backend must differ from production');
 validatePublicKey(key,match[1]);return {environment:'test',url:u.origin,anonKey:key,project:match[1]};
}
export function configuredModule(config){
 const source=fs.readFileSync(path.join(root,'studio/backend-config.js'),'utf8'),marker=/var embedded=.*?; \/\/ PS_BACKEND_EMBED/;
 if((source.match(/PS_BACKEND_EMBED/g)||[]).length!==1)fail('runtime configuration marker must be unique');
 return source.replace(marker,'var embedded='+JSON.stringify(config).replace(/</g,'\\u003c')+'; // PS_BACKEND_EMBED');
}
export function backendHeaders(headers,config){
 const from='https://'+PRODUCTION_PROJECT+'.supabase.co',socket=from.replace(/^https:/,'wss:');
 if(!headers.includes(from)||!headers.includes(socket))fail('CSP backend origins are missing');
 const u=config.url,wss=u.replace(/^https:/,'wss:').replace(/^http:/,'ws:');
 let result=headers.replaceAll(from,u).replaceAll(socket,wss);
 // Non-production also enforces the same origin allowlist. Report-only alone
 // cannot stop an old stored configuration from contacting production.
 if(config.environment!=='production')result=result.replace("Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'self'",`Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'self'; connect-src 'self' data: blob: ${u} ${wss} https://process-letter.netlify.app https://process-letter-sessions.netlify.app https://api.open-meteo.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net`);
 return result;
}
export function validateBackend(env=process.env){const config=resolveBackend(env);return {environment:config.environment,project:config.project};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(validateBackend()));}catch(e){console.error(e.message);process.exitCode=1;}}
