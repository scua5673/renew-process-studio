// 3.039 — CSP 보고 모드(피드백 SEC-2): _headers 의 Report-Only 정책 · 앱의 위반 수집기. 실제 탭을 도는 확인은 tests/browser/csp-report-only.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const headers=R('_headers'), app=R('studio/app.html');
const all=/\n\/\*\n((?:  .+\n)+)/.exec(headers)[1];
const ro=(/  Content-Security-Policy-Report-Only: (.+)\n/.exec(all)||[])[1]||'';
const dir=n=>((new RegExp('(?:^|; )'+n+' ([^;]+)')).exec(ro)||[])[1]||'';

test('모든 페이지에 보고 모드 정책 — 막는 정책(object-src · base-uri · frame-ancestors)은 그대로',()=>{
  assert.ok(ro,'/* 묶음에 Content-Security-Policy-Report-Only');
  assert.match(all,/  Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'self'; connect-src /,'막는 정책의 첫 셋은 그대로(3.272 — 그 뒤에 여섯 지시어를 더했다)');
  for(const d of ['default-src','script-src','style-src','img-src','font-src','connect-src','worker-src','frame-src','media-src','form-action','object-src','base-uri','frame-ancestors'])assert.ok(dir(d),d);
  assert.equal(dir('default-src'),"'self'"); assert.equal(dir('object-src'),"'none'");
  assert.doesNotMatch(ro,/'unsafe-eval'/,'eval 은 열지 않는다(앱에 eval · new Function 없음)');
  assert.doesNotMatch(dir('connect-src'),/(^| )(https:|\*)( |$)/,'connect-src 는 주소를 하나씩');
});

test('connect-src 는 앱이 실제로 닿는 곳과 같다 — Supabase(HTTP · 실시간) · 레터 두 곳 · 날씨 · 내려받는 라이브러리',()=>{
  const sb=/window\.PS_SYNC=\{url:"(https:\/\/[^"]+)"/.exec(app)[1], adm=/var CFG=\{url:"(https:\/\/[^"]+)"/.exec(R('admin.html'))[1];
  const c=dir('connect-src').split(' ');
  assert.ok(c.includes(sb)&&c.includes(sb.replace(/^https/,'wss')),'Supabase '+sb);
  assert.ok(c.includes(adm),'관리자 화면도 같은 Supabase');
  const letter=/var LETTER_PACK_ORIGINS=\[([^\]]+)\]/.exec(R('studio/board.html'))[1].match(/https:\/\/[^"]+/g);
  letter.forEach(o=>assert.ok(c.includes(o),o));
  assert.match(R('studio/scout.html'),/fetch\("https:\/\/api\.open-meteo\.com\//); assert.ok(c.includes('https://api.open-meteo.com'));
  /* 3.272 — PPT · PDF 라이브러리는 실린 사본만 쓴다(무결성 확인 없는 CDN 되받기를 걷었다). 정책에도 CDN 이 없다 */
  for(const cdn of ['cdnjs.cloudflare.com','cdn.jsdelivr.net']){
    assert.ok(!headers.includes(cdn),'_headers: '+cdn);
    for(const f of ['studio/board.html','studio/gamemodel.html','studio/note.html','studio/app.html','admin.html'])assert.ok(!R(f).includes(cdn),f+': '+cdn);
  }
  assert.ok(fs.existsSync(path.join(__dirname,'../pptxgen.bundle.js'))&&fs.existsSync(path.join(__dirname,'../vendor/pdfjs/pdf.min.js'))&&fs.existsSync(path.join(__dirname,'../vendor/pdfjs/pdf.worker.min.js')),'실린 사본');
  assert.equal(dir('worker-src'),"'self' blob:",'pdf.js 일꾼은 같은 출처 · blob');
});

test('수집기 — 같은 출처 프레임까지, 지시어 + 호스트만, 한 창 20건, 화면 띠 없이',()=>{
  const a=app.indexOf('if(window.__psCspInit)return;'), b=app.indexOf('})();</script>',a), s=app.slice(a,b);
  assert.ok(a>0&&a<app.indexOf('if(window.__psErrInit)return;'),'오류 수집기보다 먼저');
  assert.match(s,/PSSync\.event\('app_error',\{status:'error',feature:'app',error_code:'csp_report',meta:\{stage:'csp',source:\(d\+' '\+b\)\.slice\(0,120\),msg:at\}\}\)/);
  assert.match(s,/x\.origin===location\.origin\?'self':x\.protocol\+'\/\/'\+x\.host/,'경로 · 질의는 버린다');
  assert.match(s,/if\(!d\|\|seen\[k\]\|\|n>=20\)return;/);
  assert.match(s,/document\.addEventListener\('load',function\(e\)\{ var t=e\.target; if\(t&&t\.tagName==='IFRAME'\)hook\(t\.contentWindow\); \},true\);/);
  assert.doesNotMatch(s,/ps-errbar|show\(/,'사용자 화면에 띠를 띄우지 않는다');
  assert.match(R('tests/browser/run-critical.mjs'),/'csp-report-only'\]/,'CI 브라우저 묶음에');
});

/* 3.272 — 보고 모드가 이미 지키던 여섯 지시어는 막는다(script-src · style-src 는 inline 코드가 많아 아직 보고만) */
const enforced=(/  Content-Security-Policy: (.+)\n/.exec(all)||[])[1]||'';
const edir=n=>((new RegExp('(?:^|; )'+n+' ([^;]+)')).exec(enforced)||[])[1]||'';
test('막는 정책 — connect · frame · worker · media · manifest · form-action 은 보고 모드와 글자까지 같다',()=>{
  for(const d of ['connect-src','frame-src','worker-src','media-src','manifest-src','form-action','object-src','base-uri','frame-ancestors'])assert.equal(edir(d),dir(d),d);
  for(const d of ['default-src','script-src','style-src','img-src','font-src'])assert.equal(edir(d),'',d+' 는 아직 막지 않는다');
  assert.doesNotMatch(enforced,/report-uri|report-to/);
  assert.doesNotMatch(edir('connect-src'),/(^| )(https:|http:|wss:|\*)( |$)/,'주소를 하나씩');
});
test('막는 connect-src 는 실린 코드가 부르는 모든 바깥 주소를 덮는다',()=>{
  const allow=edir('connect-src').split(' ');
  const cp=require('node:child_process');
  const files=cp.execSync('git ls-files',{cwd:path.join(__dirname,'..'),encoding:'utf8'}).split('\n').filter(f=>/\.(html|js)$/.test(f)&&!/^(tests|scripts|docs|node_modules|migrations)\//.test(f)&&!/^vendor\/(three|pdfjs)\/|pptxgen\.bundle\.js$/.test(f));
  assert.ok(files.length>150,'실린 파일 '+files.length);
  const seen=new Map();
  for(const f of files){
    const src=R(f);
    /* fetch · XHR · WebSocket · EventSource · sendBeacon · Worker 에 글자로 적힌 주소 */
    for(const m of src.matchAll(/(?:\bfetch|\.open|new WebSocket|new EventSource|sendBeacon|new Worker|new SharedWorker|importScripts)\(\s*(?:['"](?:GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*)?['"`]((?:https?|wss?):\/\/[^'"`\/?#]+)/g))seen.set(m[1],f);
    /* 주소를 변수에 담아 부르는 곳: 서버 설정 · 레터 꾸러미 · 날씨 */
    for(const m of src.matchAll(/(?:url|URL|origin|ORIGINS?|SRC|BASE(?:_URL)?|CONFIG|CFG|PS_SYNC)\s*[:=]\s*[\[{]?[^;\n]{0,160}?['"]((?:https|wss):\/\/[a-z0-9.-]+)/g))if(/supabase\.co|process-letter|open-meteo/.test(m[1]))seen.set(m[1],f);
  }
  assert.ok(seen.size>=4,'찾은 주소 '+[...seen.keys()]);
  for(const [origin,f] of seen)assert.ok(allow.includes(origin),f+' 가 부르는 '+origin+' 이 막는 connect-src 에 없다 — _headers 에 먼저 더한다');
  assert.ok(allow.includes(sbUrl())&&allow.includes(sbUrl().replace(/^https/,'wss')));
});
function sbUrl(){return /window\.PS_SYNC=\{url:"(https:\/\/[^"]+)"/.exec(app)[1];}
test('막는 frame · form · media 가 걸릴 바깥 주소가 실린 화면에 없다',()=>{
  const cp=require('node:child_process');
  const files=cp.execSync('git ls-files',{cwd:path.join(__dirname,'..'),encoding:'utf8'}).split('\n').filter(f=>/\.(html|js)$/.test(f)&&!/^(tests|scripts|docs|node_modules|migrations)\//.test(f)&&!/^vendor\/(three|pdfjs)\/|pptxgen\.bundle\.js$/.test(f));
  for(const f of files){
    const src=R(f);
    assert.doesNotMatch(src,/<(?:iframe|frame|embed)\b[^>]{0,300}\bsrc\s*=\s*['"]?https?:\/\//i,f+': 바깥 주소 iframe');
    assert.doesNotMatch(src,/<form\b[^>]{0,300}\baction\s*=\s*['"]?https?:\/\//i,f+': 바깥 주소 form');
    assert.doesNotMatch(src,/<(?:video|audio|source|track)\b[^>]{0,300}\bsrc\s*=\s*['"]?https?:\/\//i,f+': 바깥 주소 media');
    assert.doesNotMatch(src,/new (?:Shared)?Worker\(\s*['"`]https?:\/\//,f+': 바깥 주소 worker');
  }
});
