// 운영 데이터베이스 구조 기준본 — migrations/00000000_baseline.catalog.sql(읽기 전용)을 운영에 묻고
// 결과 DDL 을 migrations/00000000_baseline.sql 로 저장한다. 행 값은 읽지 않는다.
//   node scripts/schema-baseline.mjs           운영 구조를 받아 기준본 파일을 새로 쓴다
//   node scripts/schema-baseline.mjs --check   저장된 기준본과 운영이 다르면 첫 차이를 보여 주고 1로 끝난다
// 토큰은 ~/.supabase-pat(사람이 만든 Supabase 개인 접근 토큰)에서만 읽고 화면·파일 어디에도 쓰지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const PROJECT_REF='jvtajoeptzfsdwizxejg';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const CATALOG_FILE=path.join(ROOT,'migrations/00000000_baseline.catalog.sql');
export const BASELINE_FILE=path.join(ROOT,'migrations/00000000_baseline.sql');
const CRON_PROBE="select to_regclass('cron.job') is not null as has";
const CRON_QUERY="select string_agg(format('select cron.schedule(%L, %L, %L);', jobname, schedule, command), E'\\n' order by jobname) as ddl from cron.job";
const BODY_MARK='-- ↓ 기준본 본문';

export function readToken(home=os.homedir()){
  const f=path.join(home,'.supabase-pat');
  if(!fs.existsSync(f))throw Error('토큰 파일이 없습니다: ~/.supabase-pat (만들기: https://supabase.com/dashboard/account/tokens → printf \'%s\' \'sbp_…\' > ~/.supabase-pat && chmod 600 ~/.supabase-pat)');
  const t=fs.readFileSync(f,'utf8').trim();
  if(!/^sbp_[A-Za-z0-9_]+$/.test(t))throw Error('~/.supabase-pat 의 내용이 Supabase 개인 접근 토큰(sbp_…) 모양이 아닙니다.');
  return t;
}
export async function runQuery(sql,{token,fetcher=fetch,ref=PROJECT_REF}){
  const r=await fetcher(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
  const text=await r.text();
  if(!r.ok)throw Error(`운영 조회 실패 (HTTP ${r.status}): ${text.replace(token,'[토큰]').slice(0,300)}`);
  const rows=JSON.parse(text);
  if(!Array.isArray(rows))throw Error('운영 조회 응답이 행 배열이 아닙니다.');
  return rows;
}
export async function liveBody({token,fetcher=fetch,catalog=fs.readFileSync(CATALOG_FILE,'utf8')}){
  const rows=await runQuery(catalog,{token,fetcher});
  if(rows.length!==1||typeof rows[0].ddl!=='string'||!rows[0].ddl)throw Error('기준본 쿼리가 DDL 한 칸을 돌려주지 않았습니다.');
  let body=rows[0].ddl.replace(/\s+$/,'')+'\n';
  const probe=await runQuery(CRON_PROBE,{token,fetcher});
  if(probe[0]&&probe[0].has){
    const cron=await runQuery(CRON_QUERY,{token,fetcher});
    body+='\n-- 18. pg_cron 작업\n'+((cron[0]&&cron[0].ddl)||'-- (없음)')+'\n';
  }
  return body;
}
export function fileText(body,{catalog=fs.readFileSync(CATALOG_FILE,'utf8'),now=new Date()}={}){
  const sha=crypto.createHash('sha256').update(catalog).digest('hex').slice(0,16);
  return ['-- PROCESS STUDIO 운영 데이터베이스 구조 기준본 — 손으로 고치지 말 것.',
    `-- 프로젝트 ${PROJECT_REF} · 받은 날 ${now.toISOString().slice(0,10)} · 추출 쿼리 sha256 ${sha}`,
    '-- 새로 받기: node scripts/schema-baseline.mjs · 운영과 비교: node scripts/schema-baseline.mjs --check',
    '-- 복원 순서·담기지 않는 것: migrations/00000000_baseline.runbook.md','',BODY_MARK,body].join('\n');
}
export function bodyOf(text){const i=text.indexOf(BODY_MARK+'\n');return i<0?null:text.slice(i+BODY_MARK.length+1);}
export function firstDiff(a,b){
  const x=a.split('\n'),y=b.split('\n');
  for(let i=0;i<Math.max(x.length,y.length);i++)if(x[i]!==y[i])return {line:i+1,saved:x[i]??'(끝)',live:y[i]??'(끝)'};
  return null;
}
export async function main({argv=process.argv.slice(2),fetcher=fetch,home=os.homedir(),log=console.log,write=(f,t)=>fs.writeFileSync(f,t),baselineFile=BASELINE_FILE}={}){
  const token=readToken(home);
  const body=await liveBody({token,fetcher});
  if(argv.includes('--check')){
    if(!fs.existsSync(baselineFile))throw Error('저장된 기준본이 없습니다. 먼저 node scripts/schema-baseline.mjs 로 받으세요.');
    const saved=bodyOf(fs.readFileSync(baselineFile,'utf8'));
    const d=firstDiff(saved||'',body);
    if(!d){log('운영 구조 = 저장된 기준본 ('+body.split('\n').length+'줄)');return 0;}
    log(`운영 구조가 저장된 기준본과 다릅니다 — 본문 ${d.line}줄\n  저장: ${d.saved}\n  운영: ${d.live}`);return 1;
  }
  write(baselineFile,fileText(body));
  log('기준본 저장: migrations/00000000_baseline.sql ('+body.split('\n').length+'줄, '+Buffer.byteLength(body)+'바이트)');
  return 0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().then(code=>{process.exitCode=code;}).catch(e=>{console.error(e.message);process.exitCode=1;});
