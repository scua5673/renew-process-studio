/* 2.912 — Linux WebKit 은 페이지·프레임 이동이 끊은 fetch 를
     «Fetch API cannot load <url> due to access control checks.»
   라는 pageerror 로 보고한다. CORS 가 맞는 합성 서버에서도 그렇다(CI 2.905·2.908·2.911 — account-team-switch·gamemodel-anim).
   이 흔적을 진짜 오류와 가른다. 길은 둘이다.
   A. 나간 요청이 이동에 끊김 — 셋 다:
     ① 문장이 바로 그 모양이고
     ② 같은 주소의 요청이 실제로 실패(requestfailed)했으며
     ③ 그 실패가 «취소»로 보고됐거나, 어떤 프레임의 이동·분리(framenavigated/framedetached)와 2초 안에 겹친다.
   B. (2026-10-02 · 테스트만) 내려가는 문서가 새로 시작한 요청 — 넷 다:
     ① 문장이 바로 그 모양이고
     ② 주소가 이 페이지 문서와 같은 출처다(같은 출처 요청에는 CORS 가 걸리지 않는다 — 진짜 CORS 거부일 수 없다)
        또는 테스트가 «내가 직접 응답하는 API 출처»로 밝힌 출처다(opts.apiOrigins — 픽스처가 맞는 CORS 헤더로 응답하므로 역시 CORS 거부일 수 없다).
        밝히지 않은 다른 출처는 일부러 흔적으로 보지 않는다.
     ③ 그 주소로 나가 있던 요청이 없다 — 요청이 네트워크에 아예 나가지 않았다(request·requestfailed 둘 다 없음)
     ④ 오류가 «문서가 내려가는 구간» 안이다: 어떤 프레임의 이동 요청(문서 request)부터 그 프레임 커밋(framenavigated)
        1.5초 뒤까지, 또는 프레임 분리(framedetached) 앞뒤 1.5초.
     실측(2026-10-02, macOS·Linux WebKit 1.62.1 — 진단 기록은 PR 본문): pagehide·unload·visibilitychange 안에서, 또는
     location.reload() 30ms 뒤(커밋 전 틈)에 시작한 fetch 는 WebKit 로더가 시작을 거부해 이 문장만 남기고 요청 이벤트는 0, 서버 도달 0.
     main CI 를 두 번 멈춘 gamemodel-anim(2.925 · 2.933 머지 3523255 — ps_sync_report_put)이 이 모양이었다: 앱 셸의 부팅 새로고침
     직후 기기 상태 보고(sync.js syncObservationSend)가 그 틈에 시작됐다. A 는 requestfailed 가 있어야 하므로 이것을 못 알아봤다.
   ⚠ 진짜 CORS 거부는 WebKit 에서 늘 request 이벤트와 «… not allowed by Access-Control-Allow-…» 또는
     «Preflight response is not successful …» 실패 문장을 남긴다(같은 날 실측). 그런 실패가 같은 주소에 6초 안에 있으면
     A·B 어느 길로도 흔적으로 보지 않는다.
   가른 항목은 지우지 않고 type 을 'pageerror-navabort' 로 바꿔 남긴다 — 진단 기록에는 그대로 보인다.
   새 증거가 올 때마다 다시 판정한다(뒤에 온 CORS 실패가 앞의 판정을 되돌릴 수 있게).
   모양은 맞는데 흔적이 아닌 항목에는 navabortWhy 로 이유를 붙인다 — 다음에 실패하면 원인이 assert 출력에 같이 보인다.
   2.930 — WebKit 이 이 문장을 «TypeError:» 없이 콘솔 오류로 보내면 Playwright(splitErrorMessage)가
   첫 콜론(http: 의 그것)에서 이름/메시지를 갈라 메시지가 «/127.0.0.1:…/… due to access control checks.» 로 온다
   (CI PR #264 account-team-switch). 그 잘린 모양도 같은 문장으로 읽는다 — 주소는 스킴만 떼고 맞춘다. */
const RE=/Fetch API cannot load (\S+?) due to access control checks\.?$/;
const RE_SPLIT=/^\/([^\s/]\S*?) due to access control checks\.?$/;
const CORS=/Access-Control|not allowed|preflight|\bCORS\b/i;
const NAV_TAIL=1500,DETACH_PAD=1500,OPEN_NAV=15000;
const noScheme=u=>String(u||'').replace(/^[a-z][a-z0-9+.-]*:\/\//i,'');
const originOf=u=>{try{const o=new URL(String(u)).origin;return o&&o!=='null'?o:'';}catch(_){return '';}};
export function trackNavigationAborts(page,entries,opts){
  const fails=[],navs=[],reqs=[],windows=[],origins=new Set(),byReq=new Map();
  for(const u of (opts&&opts.apiOrigins)||[]){const o=originOf(u);if(o)origins.add(o);}   // 테스트가 직접 응답하는 API 출처
  const parse=message=>{
    const txt=String(message||'').trim(),m=RE.exec(txt),ms=m?null:RE_SPLIT.exec(txt);if(!m&&!ms)return null;
    return m?{url:m[1],same:u=>u===m[1],sameOrigin:o=>originOf(m[1])===o}
            :{url:ms[1],same:u=>noScheme(u)===ms[1],sameOrigin:o=>ms[1].startsWith(noScheme(o)+'/')};
  };
  const inWindow=t=>windows.some(w=>{
    if(w.detach!=null)return Math.abs(t-w.detach)<=DETACH_PAD;
    const end=w.end!=null?w.end+NAV_TAIL:w.start+OPEN_NAV;
    return t>=w.start&&t<=end;
  });
  const judge=(message,at)=>{
    const p=parse(message);if(!p)return {match:false};
    const t=at||Date.now(),near=fails.filter(f=>p.same(f.url)&&Math.abs(f.at-t)<6000);
    if(near.some(f=>CORS.test(f.text)))return {match:true,abort:false,why:'CORS 실패 문장이 같은 주소에 있음: '+near.find(f=>CORS.test(f.text)).text.slice(0,120)};
    /* A — 나간 요청이 끊겼다 */
    if(near.some(f=>/cancel|abort/i.test(f.text)||navs.some(n=>Math.abs(n-f.at)<=2000)))return {match:true,abort:true,path:'A'};
    /* B — 내려가는 문서가 새로 시작한 요청(네트워크에 안 나감) */
    const sameOrigin=[...origins].some(o=>p.sameOrigin(o));
    const inflight=reqs.some(r=>p.same(r.url)&&r.at<=t&&(r.end==null||r.end>=t));
    const win=inWindow(t);
    if(sameOrigin&&!inflight&&!near.length&&win)return {match:true,abort:true,path:'B'};
    return {match:true,abort:false,why:JSON.stringify({failed:near.map(f=>f.text.slice(0,60)),sameOrigin,inflight,inNavWindow:win,navs:navs.filter(n=>Math.abs(n-t)<6000).map(n=>n-t)})};
  };
  const isAbort=(message,at)=>judge(message,at).abort===true;
  const reclassify=()=>{ if(!entries)return; for(const e of entries){
    if(!e||(e.type!=='pageerror'&&e.type!=='pageerror-navabort'))continue;
    const j=judge(e.text,e.at);if(!j.match)continue;
    e.type=j.abort?'pageerror-navabort':'pageerror';
    if(j.abort){e.navabortPath=j.path;delete e.navabortWhy;}else{e.navabortWhy=j.why;delete e.navabortPath;}
  } };
  const ended=r=>{const rec=byReq.get(r);if(rec&&rec.end==null)rec.end=Date.now();return rec;};
  page.on('request',r=>{
    const at=Date.now(),url=String(r.url()),rec={url,at,end:null};reqs.push(rec);byReq.set(r,rec);
    let nav=false;try{nav=!!(r.isNavigationRequest&&r.isNavigationRequest());}catch(_){}
    if(nav){const o=originOf(url);if(o)origins.add(o);let frame=null;try{frame=r.frame&&r.frame();}catch(_){}
      windows.push({frame,req:r,start:at,end:null});}
    reclassify();
  });
  page.on('requestfinished',r=>{ended(r);});
  page.on('requestfailed',r=>{const now=Date.now();ended(r);
    for(const w of windows)if(w.req===r&&w.end==null)w.end=now;   // 커밋 없이 끝난 이동
    fails.push({url:String(r.url()),at:now,text:String((r.failure()||{}).errorText||'')});reclassify();});
  const closeFrame=(f,now)=>{for(const w of windows)if(w.end==null&&w.detach==null&&w.frame===f)w.end=now;};
  page.on('framenavigated',f=>{const now=Date.now();navs.push(now);closeFrame(f,now);reclassify();});
  page.on('framedetached',f=>{const now=Date.now();navs.push(now);closeFrame(f,now);windows.push({frame:f,detach:now});reclassify();});
  return {isAbort,judge,reclassify,fails,navs,reqs,windows,origins};
}
