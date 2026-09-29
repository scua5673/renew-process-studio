import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {trackNavigationAborts} from './navigation-abort.mjs';

// Synthetic team app fixture for browser regressions (ported from the 2026-09-27 walkthrough). Synthetic team workspace, loopback
// Supabase-shaped API, every external request and websocket blocked. Never touches production.
const require=createRequire(import.meta.url);
export const pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const OUT=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/team-app');
export const SHOTS=path.join(OUT,'shots');fs.mkdirSync(SHOTS,{recursive:true});
const appHtml=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
export const build=appHtml.match(/window\.PS_BUILD='([^']+)'/)[1];
export const A='11111111-1111-4111-8111-111111111111';
export const WT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',WP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const teams=[{id:WT,kind:'team',name:'가상 테스트 FC',role:'owner',owner_id:A},{id:WP,kind:'personal',name:'가상 개인 공간',role:'owner',owner_id:A}];

const POS=['GK','CB','LCB','RCB','LB','RB','DM','CM','AM','LW','RW','CF'];
function players(){
  const plan=['GK','GK','LCB','RCB','CB','LB','RB','DM','DM','CM','CM','AM','LW','RW','LW','CF','CF','CM'];
  return plan.map((p,i)=>({id:'vp'+String(i+1).padStart(2,'0'),name:'가상 선수 '+(i+1),num:String(i+1),grp:i%2?'B팀':'A팀',type:'ours',posId:'pos_'+p,levels:{},profile:{}}));
}
function ymd(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function schedule(){
  const now=new Date(),monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7));
  const mk=()=>['월','화','수','목','금','토','일'].map((d,i)=>({d,n:i+1,rest:true,trainings:[]}));
  const tr=(time,grp,note)=>({slot:'S'+Math.random().toString(36).slice(2,8),time,grp,note,blocks:[]});
  const w0=mk(),w1=mk();
  for(const [w,di,time,grp,note] of [[w0,1,'17:00',['A팀'],'가상 훈련 화'],[w0,3,'17:00',['A팀','B팀'],'가상 훈련 목'],[w1,1,'17:00',['A팀'],'가상 훈련 다음주 화'],[w1,3,'10:00',['B팀'],'가상 훈련 다음주 목']]){w[di].rest=false;w[di].trainings.push(tr(time,grp,note));w[di].board={sched:'훈련',theme:''};}
  w0[5].rest=false;w0[5].board={sched:'경기',theme:'',opp:'가상 상대 FC',time:'15:00'};
  w1[5].rest=false;w1[5].board={sched:'경기',theme:'',opp:'가상 원정 유나이티드',time:'11:00'};
  // Today always has one session so 오늘 is not empty.
  const today=(now.getDay()+6)%7;if(!w0[today].trainings.length&&w0[today].board?.sched!=='경기'){w0[today].rest=false;w0[today].trainings.push(tr('18:00',['A팀'],'가상 오늘 훈련'));w0[today].board={sched:'훈련',theme:''};}
  return {version:1,anchorMonday:ymd(monday),scheduleRev:1,weeks:{0:w0,1:w1}};
}

let fx_opts={};
export async function startFixture(opts={}){
  fx_opts=opts;
  const db=new Map(),lib=new Map(),writes=[],calls=[];let step='init';
  const ps=players();
  const seed=[
    ['scout_tool_v1',{attrs:[],positions:POS.map(n=>({id:'pos_'+n,name:n,targets:{}})),players:ps,meta:{evalMode:'fifa',grpBase:['A팀','B팀']},_items:{build}}],
    ['cs_perms_v1',{members:{[A]:{role:'executive'}},defaultRole:'player'}],
    ['process_coach_v1',schedule()],
    ...ps.map(p=>['sq:'+p.id,p])
  ];
  for(const [k,v] of seed)db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:1000,updated_by:A});
  let base;
  async function api(req){
    const url=new URL(req.url),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':req.headers['access-control-request-headers']||'authorization, apikey, content-type, prefer, x-client-info','Vary':'Origin, Access-Control-Request-Headers'};
    if(req.method==='OPTIONS')return {status:204,headers,body:''};
    const auth=req.headers.authorization,uid=auth==='Bearer fixture-access-A'?A:null;
    if(!uid&&req.method==='GET'&&url.pathname==='/rest/v1/ps_community')return {status:200,headers,body:'[]'};
    if(!uid&&url.pathname==='/rest/v1/ps_err'){calls.push({step,m:req.method,p:url.pathname,body:JSON.stringify(req.body).slice(0,300)});return {status:201,headers,body:''};}
    if(!uid){calls.push({step,m:req.method,p:url.pathname,unauth:1});return {status:401,headers,body:'{}'};}
    calls.push({step,t:Date.now(),m:req.method,p:url.pathname,q:url.search.slice(0,200)});
    let body=[];
    if(url.pathname==='/auth/v1/user')body={id:uid,email:'a@example.invalid'};
    else if(url.pathname.endsWith('/ps_bootstrap'))body=teams;
    else if(url.pathname.endsWith('/ps_members_of_v2')||url.pathname.endsWith('/ps_members_of'))body=[{user_id:uid,name:'가상 코치',email:'a@example.invalid',role:'owner'}];
    else if(url.pathname.endsWith('/ps_key_scope'))body='team';
    else if(url.pathname==='/rest/v1/ps_kv'){
      const wid=(url.searchParams.get('workspace_id')||'eq.'+WT).slice(3),filter=url.searchParams.get('k');
      const matches=row=>row.workspace_id===wid&&(!filter||filter==='eq.'+row.k||(filter.startsWith('in.(')&&filter.slice(4,-1).split(',').map(k=>k.replace(/^"|"$/g,'')).includes(row.k))||(filter.startsWith('like.')&&row.k.startsWith(filter.slice(5).replace(/\*$/,''))));
      if(req.method==='GET'){const cols=(url.searchParams.get('select')||'').split(',').filter(Boolean);body=[...db.values()].filter(matches).map(row=>cols.length?Object.fromEntries(cols.map(k=>[k,row[k]])):{...row});}
      else if(req.method==='POST'){const posted=req.body,ignore=(req.headers.prefer||'').includes('resolution=ignore-duplicates');
        body=(Array.isArray(posted)?posted:[posted]).filter(row=>!(ignore&&db.has(row.workspace_id+'|'+row.k))).map(row=>{writes.push({step,t:Date.now(),m:'POST',wid:row.workspace_id,k:row.k,v:row.v});db.set(row.workspace_id+'|'+row.k,{...row});return row;});}
      else if(req.method==='PATCH'){const patch=req.body,expected=url.searchParams.get('cupd');body=[];
        for(const row of db.values())if(matches(row)&&(!expected||expected==='eq.'+row.cupd)){writes.push({step,t:Date.now(),m:'PATCH',wid,k:row.k,v:patch.v});Object.assign(row,patch);body.push(row);}
        if(!body.length)writes.push({step,t:Date.now(),m:'PATCH-NOMATCH',wid,k:filter,expected});}
      else if(req.method==='DELETE'){writes.push({step,t:Date.now(),m:'DELETE',wid,k:filter});}
    }else if(url.pathname==='/rest/v1/ps_library'){
      // Minimal PostgREST-shaped library table (item rows), so vault saves behave like the real server.
      const wid=(url.searchParams.get('workspace_id')||'').slice(3),ids=url.searchParams.get('lib_id'),prefer=req.headers.prefer||'';
      if(req.method==='GET'){const cols=(url.searchParams.get('select')||'').split(',').filter(Boolean);let rows=[...lib.values()].filter(r=>r.workspace_id===wid);
        if(ids&&ids.startsWith('eq.'))rows=rows.filter(r=>r.lib_id===ids.slice(3));
        if(ids&&ids.startsWith('in.(')){const set=ids.slice(4,-1).split(',').map(x=>x.replace(/^"|"$/g,''));rows=rows.filter(r=>set.includes(r.lib_id));}
        if(url.searchParams.get('limit'))rows=rows.slice(0,+url.searchParams.get('limit'));
        body=rows.map(r=>cols.length?Object.fromEntries(cols.map(k=>[k,r[k]??null])):r);
        if(prefer.includes('count=exact'))headers['Content-Range']='0-'+Math.max(0,body.length-1)+'/'+[...lib.values()].filter(r=>r.workspace_id===wid).length;}
      else if(req.method==='POST'){const rows=Array.isArray(req.body)?req.body:[req.body],ignore=prefer.includes('ignore-duplicates');body=[];
        for(const r of rows){const k=r.workspace_id+'|'+r.lib_id;if(ignore&&lib.has(k))continue;lib.set(k,{...(lib.get(k)||{}),...r,owner_id:r.owner_id||uid});writes.push({step,t:Date.now(),m:'POST',wid:r.workspace_id,k:'ps_library:'+r.lib_id,v:JSON.stringify(r.item||null)});body.push(lib.get(k));}
        if(!prefer.includes('return=representation'))body=[];
        if(fx_opts.emptyLibraryInsert&&ignore)body=[];   // 저장은 됐지만 응답 본문이 빈 경우(응답 유실·프록시)
      }
      else if(req.method==='PATCH'){body=[];for(const r of lib.values())if(r.workspace_id===wid&&(!ids||ids==='eq.'+r.lib_id)){Object.assign(r,req.body);writes.push({step,t:Date.now(),m:'PATCH',wid,k:'ps_library:'+r.lib_id});body.push(r);}}
    }else if(url.pathname.startsWith('/rest/v1/rpc/')){body=url.pathname.includes('report')?{}:[];}
    return {status:200,headers,body:JSON.stringify(body)};
  }
  const server=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;
    try{const r=await api({url:base+req.url,method:req.method,headers:req.headers,body:raw?JSON.parse(raw):null});res.writeHead(r.status,r.headers);res.end(r.body);}catch(e){res.writeHead(500);res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  return {db,lib,writes,calls,get base(){return base;},setStep(s){step=s;},close:()=>new Promise(r=>server.close(r))};
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json'};
export const SIZES={
  phone:{engine:'webkit',ctx:{viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'}},
  ipad:{engine:'webkit',ctx:{viewport:{width:1100,height:820},deviceScaleFactor:1,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'}},
  desktop:{engine:'chromium',ctx:{viewport:{width:1280,height:800},deviceScaleFactor:1}}
};

export async function openApp(fx,sizeName,{dark=false,browsers={}}={}){
  const S=SIZES[sizeName];
  const browser=browsers[S.engine]||(browsers[S.engine]=await pw[S.engine].launch({headless:true,...(S.engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})}));
  const context=await browser.newContext({...S.ctx,serviceWorkers:'block',timezoneId:'Asia/Seoul',locale:'ko-KR',colorScheme:dark?'dark':'light'});
  const base=fx.base;
  await context.addInitScript(({A,WT,teams,base,dark})=>{
    if(location.origin!==base||window.top!==window)return;
    if(localStorage.getItem('wt_seeded'))return;localStorage.setItem('wt_seeded','1');
    localStorage.setItem('ps_sync_session',JSON.stringify({uid:A,at:'fixture-access-A',rt:'fixture-refresh-A',exp:Date.now()+36000000,email:'a@example.invalid'}));
    localStorage.setItem('ps_active_ws',WT);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:A,wid:WT}));
    localStorage.setItem('ps_ws_list',JSON.stringify(teams));
    if(dark)localStorage.setItem('cs_theme','dark');
  },{A,WT,teams,base,dark});
  await context.routeWebSocket('**/*',s=>s.close());
  const blocked=[];
  await context.route(u=>!(u.origin===base&&(u.pathname.startsWith('/rest/v1/')||u.pathname.startsWith('/auth/v1/'))),async route=>{
    const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin+url.pathname);return route.abort('blockedbyclient');}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
    let content=fs.readFileSync(file);
    if(url.pathname==='/studio/app.html')content=Buffer.from(content.toString().replace(/(window\.PS_SYNC=\{url:")[^"]+("[,}])/,(_,a,b)=>a+base+b));
    return route.fulfill({body:content,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);
  const logs=[];
  const tag=()=>fx.curStep||'';
  page.on('console',m=>{const t=m.type();if(t==='error'||t==='warning'||/PSSync|\[ps/i.test(m.text()))logs.push({step:tag(),type:t,text:m.text().slice(0,500),url:(m.location()||{}).url?.replace(base,'')});});
  page.on('pageerror',e=>{logs.push({step:tag(),type:'pageerror',at:Date.now(),text:String(e.message).slice(0,500),stack:String(e.stack||'').slice(0,400)});navAborts.reclassify();});
  const navAborts=trackNavigationAborts(page,logs);   /* 2.912 — 이동이 끊은 fetch 의 WebKit 흔적은 'pageerror-navabort' 로 */
  page.on('dialog',d=>{logs.push({step:tag(),type:'dialog',text:d.type()+': '+d.message().slice(0,300)});(d.type()==='beforeunload'?d.accept():d.dismiss()).catch(()=>{});});
  await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await ready(page);
  return {browser,context,page,logs,blocked};
}

export async function ready(page){
  await page.waitForFunction(({WT,A})=>window.PSSync&&PSSync.dataUnlocked()&&PSSync.activeWs()===WT&&PSSync.session()?.uid===A,{WT,A},{timeout:45000});
  await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'),null,{timeout:45000}).catch(()=>{});
  await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  await page.waitForTimeout(1500);
}

// ---------- measurement ----------
export async function measure(page,{phone}){
  return page.evaluate(({phone})=>{
    const vw=innerWidth,vh=innerHeight,res={top:null,frames:[]};
    function vis(el,w){const cs=w.getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
    function label(el){const t=(el.innerText||el.value||el.getAttribute('aria-label')||el.title||'').replace(/\s+/g,' ').trim().slice(0,30);let id=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'');return id+(t?' «'+t+'»':'');}
    function scan(doc,w,off){
      const out={docOverflow:null,offscreen:[],small:[],smallCount:0,tinyCount:0,clipped:[],fixed:[],text:''};
      const de=doc.documentElement;out.docOverflow={sw:de.scrollWidth,cw:de.clientWidth,bodySw:doc.body?doc.body.scrollWidth:0};
      const W=w.innerWidth;
      const all=doc.body?doc.body.querySelectorAll('*'):[];
      for(const el of all){
        if(!vis(el,w))continue;
        const r=el.getBoundingClientRect(),cs=w.getComputedStyle(el);
        // offscreen horizontally, not clipped by a scrolling/hidden ancestor
        if((r.right>W+2||r.left<-2)&&r.width<W*3&&el.children.length===0){
          let clipped=false;for(let a=el.parentElement;a&&a!==doc.body;a=a.parentElement){const ox=w.getComputedStyle(a).overflowX;if(ox!=='visible'){const ar=a.getBoundingClientRect();if(ar.right<=W+2&&ar.left>=-2){clipped=true;break;}}}
          // skip hidden off-canvas (translated drawers) that are fully outside
          if(!clipped&&!(r.left>=W||r.right<=0))out.offscreen.push(label(el)+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']');
        }
        const tag=el.tagName;
        if(phone&&(tag==='BUTTON'||(tag==='A'&&el.href)||el.getAttribute('role')==='button'||(tag==='INPUT'&&/checkbox|radio/.test(el.type))||(tag==='SELECT'))&&r.right>0&&r.left<W&&r.bottom>0&&r.top<w.innerHeight){
          const m=Math.min(r.width,r.height);if(m<40){out.smallCount++;if(m<28)out.tinyCount++;if(out.small.length<25)out.small.push(label(el)+' '+Math.round(r.width)+'x'+Math.round(r.height));}
        }
        if((cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+1&&el.clientWidth>0&&(el.innerText||'').trim()&&el.children.length<=2&&r.top<w.innerHeight&&r.bottom>0){
          if(out.clipped.length<25)out.clipped.push(label(el)+' sw'+el.scrollWidth+'>cw'+el.clientWidth);
        }
        if((cs.position==='fixed'||cs.position==='sticky')&&r.width>40&&r.height>10&&r.top<w.innerHeight&&r.bottom>0)out.fixed.push({l:label(el),pos:cs.position,z:cs.zIndex,r:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]});
      }
      out.offscreenCount=out.offscreen.length;out.offscreen=out.offscreen.slice(0,15);
      out.fixed=out.fixed.slice(0,20);
      out.text=(doc.body?doc.body.innerText:'').replace(/\s+/g,' ').slice(0,600);
      return out;
    }
    res.top=scan(document,window,0);res.top.text=res.top.text.slice(0,200);
    res.syncText=[...document.querySelectorAll('#syncStatus,#psSyncChip,.ps-sync-chip,[id*="SyncChip"],[class*="sync-state"]')].map(e=>(e.id||e.className)+':'+(e.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,5);
    res.sync={state:PSSync.state(),pending:PSSync.pending()};
    for(const f of document.querySelectorAll('iframe')){
      if(!vis(f,window))continue;const r=f.getBoundingClientRect();
      try{const d=f.contentDocument;if(!d||!d.body)continue;const s=scan(d,f.contentWindow,r.left);s.id=f.id;s.src=(f.getAttribute('src')||'').slice(0,80);s.rect=[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];
        s.bodyScroll={sh:d.documentElement.scrollHeight,ch:d.documentElement.clientHeight};res.frames.push(s);}catch(e){res.frames.push({id:f.id,err:String(e)});}
    }
    return res;
  },{phone});
}

export function visibleFrameId(page){return page.evaluate(()=>{const f=[...document.querySelectorAll('iframe')].find(f=>{const r=f.getBoundingClientRect();return r.width>50&&r.height>50&&getComputedStyle(f).display!=='none'&&getComputedStyle(f).visibility!=='hidden';});return f?f.id:null;});}
