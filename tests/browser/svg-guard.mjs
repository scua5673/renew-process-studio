import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// 3.105 — 저장된 썸네일 SVG 정리(PSSafe.svg)와 다른 사이트 postMessage 차단을 진짜 브라우저 파서로 본다.
//  ① 날것으로 넣으면 실행되는 문자열(대조군)이, 정리한 뒤에는 하나도 실행되지 않는다 — 옛 정규식(sanSvg)이 놓친 <animate/onbegin> · 엔티티 javascript: 포함
//  ② 작전판이 실제로 만드는 그림(그라디언트·클립·패턴·#참조·공 사진 data:image)은 모양 그대로 남는다
//  ③ 다른 출처 iframe 이 보낸 메시지는 storage.js 뒤에 붙은 리스너에 닿지 않고, 같은 출처는 그대로 닿는다
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const storageJs=fs.readFileSync(path.join(root,'studio/storage.js'),'utf8');
const APP='https://app.invalid',EVIL='https://evil.invalid';
const page0=`<!doctype html><meta charset="utf-8"><script src="/storage.js"></script>
<script>window.__got=[];window.addEventListener('message',function(e){window.__got.push(e.data&&e.data.who);});</script>
<body><div id="host"></div><iframe id="evil" src="${EVIL}/send"></iframe><iframe id="same" src="${APP}/send"></iframe></body>`;
const sender=who=>`<!doctype html><script>setTimeout(function(){parent.postMessage({who:${JSON.stringify(who)},source:'board',type:'commAct',act:'delete',id:'p1'},'*');},50);</script>`;

const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin===APP&&u.pathname==='/storage.js')return route.fulfill({contentType:'text/javascript',body:storageJs});
    if(u.pathname==='/send')return route.fulfill({contentType:'text/html',body:sender(u.origin===APP?'same':'evil')});
    if(u.origin===APP&&u.pathname==='/')return route.fulfill({contentType:'text/html',body:page0});
    return route.fulfill({status:404,body:''});
  });
  const page=await context.newPage();
  await page.goto(APP+'/',{waitUntil:'load'});
  await page.waitForFunction(()=>window.PSSafe&&typeof PSSafe.svg==='function');

  // ③ 다른 사이트의 메시지
  await page.waitForFunction(()=>window.__got.includes('same'),null,{timeout:10000});
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>window.__got),['same'],'같은 출처만 닿는다 — 다른 출처(evil)의 commAct 는 막힌다');

  // ① 실행되는 문자열 모음 — 각 문자열은 window.__pwned 에 자기 번호를 쓴다
  const attacks=[
    '<svg><animate onbegin="window.__pwned=1" attributeName="x" dur="0.01s"/></svg>',
    '<svg><animate/onbegin=window.__pwned=2 attributeName=x dur=0.01s></svg>',
    '<svg><image href="x" onerror="window.__pwned=3"/></svg>',
    '<svg><a id="lnk" href="jav&#x61;script:window.__pwned=4"><rect width="9" height="9"/></a></svg>',
    '<svg><foreignObject><img src="x" onerror="window.__pwned=5"></foreignObject></svg>',
    '<svg><script>window.__pwned=6</script></svg>',
    '<svg><set attributeName="onmouseover" to="window.__pwned=7"/><rect width="9" height="9"/></svg>',
    '<svg><p><img src="x" onerror="window.__pwned=8"></p></svg>',
    '<svg></svg><img src="x" onerror="window.__pwned=9">',
    '<svg/onload=window.__pwned=10>',
    '<svg><image xlink:href="x" onerror="window.__pwned=11"/></svg>',
    '<svg><style><img src="x" onerror="window.__pwned=12"></style></svg>',
    '<svg><a href="javascript:window.__pwned=13"><text>t</text></a></svg>',
  ];
  // 대조군 — 이 브라우저가 날것의 문자열을 실제로 실행한다는 것부터 확인(시험이 헛돌지 않게)
  const raw=await page.evaluate(async list=>{
    const host=document.getElementById('host'),hits=[];
    for(const s of list){ window.__pwned=0; host.innerHTML=s; const a=host.querySelector('a'); if(a)a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); await new Promise(r=>setTimeout(r,250)); if(window.__pwned)hits.push(window.__pwned); host.innerHTML=''; }
    return hits;
  },[attacks[0],attacks[2],attacks[9]]);
  assert.ok(raw.length>=2,'대조군: 정리하지 않은 문자열은 실행된다 '+JSON.stringify(raw));

  const res=await page.evaluate(async list=>{
    const host=document.getElementById('host'),out=[];
    for(const s of list){
      window.__pwned=0; const clean=PSSafe.svg(s); host.innerHTML=clean;
      host.querySelectorAll('a').forEach(a=>a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
      host.querySelectorAll('rect,text').forEach(n=>n.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})));
      await new Promise(r=>setTimeout(r,250));
      const bad=[...host.querySelectorAll('*')].filter(n=>n.namespaceURI!=='http://www.w3.org/2000/svg'||/^(script|foreignobject|style|animate|set)$/i.test(n.localName)||[...n.attributes].some(a=>/^on/i.test(a.name)||/javascript:/i.test(a.value))).map(n=>n.localName);
      out.push({clean,pwned:window.__pwned,bad}); host.innerHTML='';
    }
    return out;
  },attacks);
  res.forEach((r,i)=>assert.notEqual(r.clean,attacks[i],'공격 문자열은 빠른 길을 통과하지 못한다: #'+(i+1)));
  res.forEach((r,i)=>{
    assert.equal(r.pwned,0,'정리한 뒤 실행되지 않는다: #'+(i+1)+' '+attacks[i]+' → '+r.clean);
    assert.deepEqual(r.bad,[],'남은 요소에 처리기·스크립트가 없다: #'+(i+1)+' → '+r.clean);
  });
  assert.equal(await page.evaluate(()=>[PSSafe.svg(''),PSSafe.svg('<div>x</div>'),PSSafe.svg('data:image/png;base64,AAAA'),PSSafe.svg(null)].join('|')),'|||','SVG 가 아니면 빈 문자열');

  // ② 작전판이 만드는 그림은 그대로
  const BALL='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const real='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1110 740" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" data-psfit="1" data-psvb="0 0 1110 740">'
    +'<defs><radialGradient id="grassVig_th1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></radialGradient>'
    +'<clipPath id="pitchClip_th1"><rect width="1110" height="740"/></clipPath><pattern id="psGoalNet_th1" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0 0L6 6" stroke="#fff"/></pattern>'
    +'<g id="tokBase_th1"><circle r="14"/></g></defs>'
    +'<rect width="1110" height="740" fill="#1e8c4c"/><rect width="1110" height="740" fill="url(#grassVig_th1)" style="fill:url(#grassVig_th1)"/>'
    +'<g clip-path="url(#pitchClip_th1)"><line x1="555" y1="0" x2="555" y2="740" stroke="#fff"/><rect x="0" y="300" width="20" height="140" fill="url(#psGoalNet_th1)"/></g>'
    +'<g class="token" data-id="7" transform="translate(400 300)"><use href="#tokBase_th1" fill="#3a6df0"/><use xlink:href="#tokBase_th1"/><text text-anchor="middle" dominant-baseline="central" font-size="13" fill="#fff">7<tspan dx="2">a</tspan></text></g>'
    +'<svg x="-14" y="-14" width="28" height="28" viewBox="0 0 240 240" style="overflow:visible"><image x="2" y="2" width="236" height="236" href="'+BALL+'"/></svg>'
    +'<polygon points="1,2 3,4 5,6" fill="#c84a47" opacity=".8"/><ellipse cx="9" cy="9" rx="3" ry="2"/></svg>';
  const kept=await page.evaluate(s=>{
    const shape=str=>{const t=document.createElement('template');t.innerHTML=str;return [...t.content.querySelectorAll('*')].map(n=>n.localName+'['+[...n.attributes].map(a=>a.name+'='+a.value).sort().join(',')+']');};
    const clean=PSSafe.svg(s);
    return {before:shape(s),after:shape(clean),same:PSSafe.svg(s)===clean,untouched:clean===s};
  },real);
  assert.deepEqual(kept.after,kept.before,'작전판 그림은 요소·속성이 그대로 남는다');
  assert.equal(kept.same,true,'같은 문자열은 같은 결과(메모)');
  assert.equal(kept.untouched,true,'작전판 그림은 빠른 길(허용 문법)로 고치지 않고 그대로 — 보관함 수백 장도 DOM 으로 읽지 않는다');
  console.log(JSON.stringify({engine,passed:true,cases:['cross-origin-message-blocked','same-origin-message-delivered','raw-control-executes','13-payloads-neutralized','non-svg-empty','board-thumbnail-preserved']}));
  await context.close();
}finally{await browser.close();}
