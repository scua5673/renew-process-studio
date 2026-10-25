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
  assert.match(all,/  Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'self'\n/);
  for(const d of ['default-src','script-src','style-src','img-src','font-src','connect-src','worker-src','frame-src','media-src','form-action','object-src','base-uri','frame-ancestors'])assert.ok(dir(d),d);
  assert.equal(dir('default-src'),"'self'"); assert.equal(dir('object-src'),"'none'");
  assert.doesNotMatch(ro,/'unsafe-eval'/,'eval 은 열지 않는다(앱에 eval · new Function 없음)');
  assert.doesNotMatch(dir('connect-src'),/(^| )(https:|\*)( |$)/,'connect-src 는 주소를 하나씩');
});

test('connect-src 는 앱이 실제로 닿는 곳과 같다 — Supabase(HTTP · 실시간) · 레터 두 곳 · 날씨 · 내려받는 라이브러리',async()=>{
  const {resolveBackend,PRODUCTION_SITE}=await import('../scripts/backend-config.mjs');
  const sb=resolveBackend({NETLIFY:'true',SITE_ID:PRODUCTION_SITE,CONTEXT:'production',BRANCH:'main',PS_BACKEND_ROLE:'production'}).url;
  assert.match(app,/window\.PS_SYNC=PSBackendConfig\.current\(\)/);assert.match(R('admin.html'),/var CFG=PSBackendConfig\.current\(\)/);
  const c=dir('connect-src').split(' ');
  assert.ok(c.includes(sb)&&c.includes(sb.replace(/^https/,'wss')),'Supabase '+sb);
  assert.match(R('admin.html'),/src="studio\/backend-config\.js"/,'관리자도 같은 중앙 설정 모듈');
  const letter=/var LETTER_PACK_ORIGINS=\[([^\]]+)\]/.exec(R('studio/board.html'))[1].match(/https:\/\/[^"]+/g);
  letter.forEach(o=>assert.ok(c.includes(o),o));
  assert.match(R('studio/scout.html'),/fetch\("https:\/\/api\.open-meteo\.com\//); assert.ok(c.includes('https://api.open-meteo.com'));
  for(const cdn of ['https://cdnjs.cloudflare.com','https://cdn.jsdelivr.net'])assert.ok(dir('script-src').split(' ').includes(cdn),cdn);
  assert.ok(dir('worker-src').includes('https://cdnjs.cloudflare.com'),'pdf.js 일꾼');
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
