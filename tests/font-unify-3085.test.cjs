// 3.085 — 글꼴 하나(사용자 «폰트도 모두 하나로 통일해줘» · «앱의 모든 폰트 통일 해야되지 않아?»)
// 화면마다 system-ui · -apple-system · 고정폭 · Jost 가 섞여 기기마다 달라 보였다. 모든 글꼴 목록은 Pretendard 가 맨 앞이다.
// 예외: «PROCESS STUDIO» 로고 글자(Jost) — 브랜드 표시라 그대로.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const files=[...fs.readdirSync(path.join(root,'studio')).filter(f=>/\.(html|js|css)$/.test(f)).map(f=>'studio/'+f),'index.html','admin.html','guide/quick.html','guide/team.html','guide/index.html']
  .filter(f=>fs.existsSync(path.join(root,f)));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('no font stack starts with a system, generic or monospace font',()=>{
  const bad=[];
  const pats=[/font-family:\s*(-apple-system|system-ui|BlinkMacSystemFont|ui-monospace|sans-serif|Arial|Helvetica)/g,
    /\d(?:px|em|rem)(?:\/[\d.]+)?\s+(-apple-system|system-ui|ui-monospace|sans-serif)\b/g,
    /font-family="(sans-serif|-apple-system|system-ui)/g];
  for(const f of files){ const s=read(f); for(const p of pats){ let m; p.lastIndex=0; while((m=p.exec(s))){ const line=s.slice(0,m.index).split('\n').length; bad.push(f+':'+line+' '+m[0]); } } }
  assert.deepStrictEqual(bad,[],'Pretendard first everywhere');
});
test('Jost only for the «PROCESS STUDIO» wordmark',()=>{
  assert.match(read('studio/idp.html'),/--fk:var\(--f\)/,'IDP small labels follow the app font');
  assert.doesNotMatch(read('studio/figma-premium.css'),/\.export-format-icon\{[\s\S]{0,400}?font-family:Jost/,'MP4 · GIF badges use the app font');
});
test('every page loads the font file; buttons and fields inherit it',()=>{
  for(const f of ['index.html','studio/index.html','admin.html','guide/quick.html','guide/team.html','studio/app.html','studio/board.html','studio/analysis.html'])
    assert.match(read(f),/href="\/?vendor\/fonts\.css/,f+' loads Pretendard');
  const t=read('vendor/tokens.css');
  assert.match(t,/button,input,select,textarea,optgroup\{font-family:inherit\}/);
  assert.match(t,/--ps-font:'Pretendard Variable',Pretendard,/);
});
