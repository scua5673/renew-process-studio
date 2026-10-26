// Loopback-only visual QA: synthetic accounts and database; external connections blocked.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startFixture,root,A,WT,WP} from '../tests/fixtures/team-app.mjs';
const require=createRequire(import.meta.url),store=require('../studio/scouting-store.js');
const fx=await startFixture(),main=JSON.parse(fx.db.get(WT+'|scout_tool_v1').v);
main.meta.grpLabels={'A팀':'1군','B팀':'육성팀'};
main.players.forEach((p,i)=>{p.name=['가상 김민준','가상 이도윤','가상 박서준','가상 최지호','가상 정하준','가상 윤시우','가상 강주원','가상 조현우','가상 한지훈','가상 오서진','가상 장건우','가상 임도현','가상 신예준','가상 유민재','가상 문준서','가상 백시윤','가상 홍준우','가상 노도빈'][i];p.schoolYear=String(i%3+1);p.foot=i%3?'R':'L';p.status=i===2?'injury':i===4?'rehab':'ok';p.profile={height:String(175+i%8),weight:String(68+i%7),strengths:i<3?'넓은 시야와 침착한 연결':'',develop:i<3?'압박 상황에서 전진 패스 선택':''};p.levels=i===0?{tech_pass:3}:{};if(!i)p.evalAt=100;});
for(const p of main.players){const row=fx.db.get(WT+'|sq:'+p.id);row.v=JSON.stringify(p);}
fx.db.get(WT+'|scout_tool_v1').v=JSON.stringify(main);
const candidates=[['가상 골키퍼','GK','A','rep'],['가상 수비수','CB','','go'],['가상 미드필더','CM','B','done'],['가상 공격수','CF','','rep']].map((x,i)=>({id:'cp'+i,dbId:'candidate'+i,type:'target',name:x[0],posId:'pos_'+x[1],grade:x[2],scoutSt:x[3],num:String(i+21),foot:'R',club:'가상 유나이티드',profile:{height:'181',strengths:'관찰 기록 예시'},levels:{},memo:i?'':'합성 검증용 관찰 메모'}));
const target=store.reconcile(null,{v:1,players:candidates});
target.scoutRegistry.meta={pointSets:[{name:'공격수',positions:['ST','FW'],text:'공격\n전방에서 공간을 만드는가?'},{name:'골키퍼',positions:['GK'],text:'수비\n슈팅에 안정적으로 반응하는가?\n빌드업\n압박 속에서 패스를 연결하는가?'},{name:'수비수',positions:['CB'],text:'수비\n배후 공간을 관리하는가?'}]};
target.scoutRegistry.candidates['db:unplaced']={id:'db:unplaced',info:{name:'가상 미배치',club:'가상 FC',profile:{}},source:{pos:['LW']},points:{},ratings:{},edits:{}};
fx.db.set(WT+'|cs_scout_targets_v1',{workspace_id:WT,k:'cs_scout_targets_v1',v:JSON.stringify(target),cupd:1000,updated_by:A});
const teams=[{id:WT,kind:'team',name:'가상 검증 FC',role:'owner',owner_id:A},{id:WP,kind:'personal',name:'가상 개인 공간',role:'owner',owner_id:A}];
const init=`<script>if(!localStorage.getItem('pw_preview_seed')){localStorage.setItem('pw_preview_seed','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid:${JSON.stringify(A)},at:'fixture-access-A',rt:'fixture-refresh-A',exp:Date.now()+36000000,email:'a@example.invalid'}));localStorage.setItem('ps_active_ws',${JSON.stringify(WT)});localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:${JSON.stringify(A)},wid:${JSON.stringify(WT)}}));localStorage.setItem('ps_ws_list',${JSON.stringify(JSON.stringify(teams))});localStorage.setItem('ps_vault_px_v1',${JSON.stringify(JSON.stringify({[A+'|'+WT]:1}))});}if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('Synthetic preview: worker disabled'));</script>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),base='http://127.0.0.1:'+server.address().port;
  if(url.pathname==='/workspace-preview.html'){
    const seed={scout_tool_v1:main,cs_scout_targets_v1:target,cs_perms_v1:{members:{[A]:{role:'executive'}}}};
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"connect-src 'none'; frame-src 'self'; worker-src 'none'"});
    res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>선수단 · 스카우팅 구현 미리보기</title>'+init+'<style>html,body{margin:0;height:100%;font-family:system-ui}header{height:42px;display:flex;align-items:center;gap:14px;padding:0 20px;background:#14213d;color:white;font-size:12px}header b{margin-right:auto}iframe{display:block;width:100%;height:calc(100% - 42px);border:0}</style><script>const seed='+JSON.stringify(seed)+';if(!localStorage.getItem("pw_standalone_seed")){Object.keys(seed).forEach(k=>localStorage.setItem(k,JSON.stringify(seed[k])));localStorage.setItem("pw_standalone_seed","1");}window.PSSync={dataUnlocked:()=>true,keyReady:()=>true,rosterReady:()=>true,activeWs:()=>'+JSON.stringify(WT)+',session:()=>({uid:'+JSON.stringify(A)+'}),syncNow:async()=>({pushed:0,applied:0})};</script></head><body><header><b>PROCESS STUDIO</b><span>구현 미리보기 · 가상 데이터</span></header><iframe id="preview" title="선수단·스카우팅" src="/studio/scout.html?preview=1" onload="this.contentWindow.setView(\'team\')"></iframe></body></html>');return;
  }
  if(url.pathname==='/__preview_status'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({writes:fx.writes,errors:fx.calls.filter(c=>c.p==='/rest/v1/ps_err'),roster:JSON.parse(fx.db.get(WT+'|scout_tool_v1').v).players,targets:JSON.parse(fx.db.get(WT+'|cs_scout_targets_v1').v)}));return;}
  if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/auth/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await fetch(fx.base+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||url.pathname==='/sw.js'){res.writeHead(404);res.end();return;}
  let content=fs.readFileSync(file);if(url.pathname==='/studio/scout.html'&&url.searchParams.has('preview'))content=Buffer.from(content.toString().replace('<head>','<head><script>window.PSSync=parent.PSSync;window.PSItems={active:()=>false,write(){},flush:async()=>true};window.addEventListener("load",()=>setTimeout(()=>storage.set("cs_scout_targets_v1",localStorage.getItem("cs_scout_targets_v1")).then(()=>scStore().prepare()).then(()=>scRefreshCandidates()).catch(e=>{var p=document.createElement("p");p.id="previewDiagnostic";p.textContent="Preview diagnostic: "+e.name+" · "+e.message+" · "+e.psCode;document.body.appendChild(p);}),1000));</script>'));if(url.pathname==='/studio/app.html')content=Buffer.from(content.toString().replace('<head>','<head>'+init).replace(/(window\.PS_SYNC=\{url:")[^"]+("[,}])/,(_,a,b)=>a+base+b));
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"connect-src 'self'; frame-src 'self' blob:; worker-src 'none'"});res.end(content);
});
await new Promise(resolve=>server.listen(Number(process.env.PS_PREVIEW_PORT)||0,'127.0.0.1',resolve));
console.log('Synthetic preview: http://127.0.0.1:'+server.address().port+'/studio/app.html');
process.on('SIGINT',()=>{server.close();fx.close().then(()=>process.exit());});
