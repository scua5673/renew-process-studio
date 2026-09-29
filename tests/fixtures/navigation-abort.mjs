/* 2.912 — Linux WebKit 은 페이지·프레임 이동이 끊은 fetch 를
     «Fetch API cannot load <url> due to access control checks.»
   라는 pageerror 로 보고한다. CORS 가 맞는 합성 서버에서도 그렇다(CI 2.905·2.908·2.911 — account-team-switch·gamemodel-anim).
   이 흔적을 진짜 오류와 가른다. 조건은 셋 다:
     ① 문장이 바로 그 모양이고
     ② 같은 주소의 요청이 실제로 실패(requestfailed)했으며
     ③ 그 실패가 «취소»로 보고됐거나, 어떤 프레임의 이동·분리(framenavigated/framedetached)와 2초 안에 겹친다.
   ⚠ 실패 문장에 Access-Control-Allow 가 있으면(진짜 CORS 거부) 절대 흔적으로 보지 않는다.
   가른 항목은 지우지 않고 type 을 'pageerror-navabort' 로 바꿔 남긴다 — 진단 기록에는 그대로 보인다. */
const RE=/Fetch API cannot load (\S+?) due to access control checks\.?$/;
export function trackNavigationAborts(page,entries){
  const fails=[],navs=[];
  const isAbort=(message,at)=>{
    const m=RE.exec(String(message||'').trim()); if(!m)return false;
    const url=m[1],t=at||Date.now();
    return fails.some(f=>f.url===url&&Math.abs(f.at-t)<6000&&!/Access-Control-Allow|not allowed/i.test(f.text)
      &&(/cancel|abort/i.test(f.text)||navs.some(n=>Math.abs(n-f.at)<=2000)));
  };
  const reclassify=()=>{ if(!entries)return; for(const e of entries)if(e&&e.type==='pageerror'&&isAbort(e.text,e.at))e.type='pageerror-navabort'; };
  page.on('requestfailed',r=>{fails.push({url:r.url(),at:Date.now(),text:String((r.failure()||{}).errorText||'')});reclassify();});
  page.on('framenavigated',()=>{navs.push(Date.now());reclassify();});
  page.on('framedetached',()=>{navs.push(Date.now());reclassify();});
  return {isAbort,reclassify,fails,navs};
}
