const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
/* 3.051 — 손으로 적은 목록 대신 migrations/*.local-test.cjs 전부(피드백 TD-10 — 18개 중 12개만 돌았다. 빠진 6개도 통과).
   기준본(00000000_baseline)이 맨 앞, 나머지는 파일 이름(날짜) 차례. 새 마이그레이션은 local-test 를 두면 저절로 들어온다. */
const dir=path.join(__dirname,'..','migrations');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.local-test.cjs')).map(f=>f.replace(/\.local-test\.cjs$/,'')).sort();
const env={...process.env,PGLITE_MODULE:process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite')};
for(const file of files){const r=spawnSync(process.execPath,['migrations/'+file+'.local-test.cjs'],{env,stdio:'inherit',timeout:120000});if(r.status!==0)process.exit(r.status||1);}
