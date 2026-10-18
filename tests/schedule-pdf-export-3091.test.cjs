// 3.091 — 일정 PDF(연간 · 월간 · 주간 · 일간 · 부하 리포트)도 작전판 · 훈련 PDF 와 같은 내보내기 창
// (사용자 «일정 연간 월간 주간 PDF — PDF 내보내기 디자인»). 창과 «PDF 내려받기»는 studio/pdf-export.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const px=require('../studio/pdf-export.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('fonts: picks only the Pretendard pieces the page uses, under both family names',()=>{
  const faces=px.parseFaces(read('vendor/fonts.css'));
  assert.ok(faces.length>=184,'92 조각 × 두 이름');
  assert.ok(faces.every(f=>/^\/vendor\/pretendard\/PretendardVariable\.subset\.\d+\.woff2$/.test(f.file)),'local() 은 건너뛰고 파일만');
  const need=px.pick(faces,'주간 일정 RPE 17:00');
  const files=[...new Set(need.map(f=>f.file))];
  assert.ok(files.length>=1&&files.length<=8,'쓰인 글자의 조각만 '+files.length);
  assert.deepEqual([...new Set(need.map(f=>f.family))].sort(),['Pretendard','Pretendard Variable']);
  const css=px.faceCss(need,{[files[0]]:'QUJD'});
  assert.match(css,/@font-face\{font-family:'Pretendard';font-style:normal;font-weight:45 920;src:url\(data:font\/woff2;base64,QUJD\) format\('woff2'\);unicode-range:U\+/);
});

const bytes=async o=>Buffer.from(o instanceof Uint8Array?o:new Uint8Array(await o.arrayBuffer())).toString('latin1');
test('pdf: one A4 page per JPEG, landscape and portrait',async()=>{
  const jpg={data:new Uint8Array([0xff,0xd8,0xff,0xd9]),w:2246,h:1588};
  const out=px.jpegPagesToPdf([jpg,jpg],true),txt=await bytes(out);
  assert.equal(out.type,'application/pdf');
  assert.match(txt,/^%PDF-1\.4/);assert.match(txt,/\/Count 2/);assert.match(txt,/\/MediaBox \[0 0 841\.89 595\.28\]/);assert.match(txt,/%%EOF$/);
  const port=await bytes(px.jpegPagesToPdf([jpg],false));
  assert.match(port,/\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.equal(px.safeName('주간/일정:10월'),'주간_일정_10월');
});

test('window: same bar as the board training PDF — 개인 노트로 · PDF 내려받기 · 인쇄 · 닫기',()=>{
  const s=read('studio/pdf-export.js');
  for(const b of ['data-px="note">개인 노트로','data-px="save">PDF 내려받기','data-px="print">인쇄','data-px="close">닫기'])assert.ok(s.includes(b),b);
  assert.match(s,/#psPdfX\{position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;background:rgba\(10,12,18,\.8\)/,'작전판 printPrevB 와 같은 바탕');
  assert.match(s,/showSaveFilePicker/,'크롬 · 엣지는 저장 위치를 고른다');
});

test('schedule: every schedule PDF opens the new window; the app takes «개인 노트로» from the schedule frame',()=>{
  const p=read('studio/process.html');
  assert.match(p,/<script src="pdf-export\.js"><\/script>/);
  assert.match(p,/const PDF_TITLE=\{week:'주간 일정',weekboard:'주간 일정',month:'월간 일정',season:'연간 일정',yearReview:'연간 돌아보기',yearPlan:'연간 계획',day:'일간 일정',today:'일간 일정',review:'부하 리포트'\};/);
  assert.match(p,/PSPdfExport\.open\(\{title:t\+' — PDF',html:doc,fname:[^\n]*land:land,source:'process',noteKind:'schedule-pdf',/);
  for(const k of ["exportPDF('month')","exportPDF('season')","exportPDF('day')","exportPDF('review')"])assert.ok(p.includes(k),k);
  const a=read('studio/app.html');
  assert.match(a,/if\(fProcess&&e\.source===fProcess\.contentWindow&&d\.source==='process'&&d\.type==='notePdfReady'&&d\.buffer\)\{queueNotePdf\(d\);return;\}/);
  assert.match(read('sw.js'),/'\/studio\/pdf-export\.js'/);
});

// 3.091 — 락커룸에 붙이는 종이(사용자 «팀의 락커룸에 붙힐수 있는 퀄리티에 일정 PDF» → «깔끔하게 · 심플하게 · 최대한 담백하게»)
const poster=require('../studio/schedule-poster.js');
test('clean: one header line — team · title small, the dates big, this period\'s match on the right',()=>{
  const h=poster.head({team:{name:'FC 프로세스 U15',logo:'data:image/png;base64,AAA'},title:'2026 주간 일정',big:'10월 12일 – 18일',
    matches:[{when:'토 10.17',opp:'광주FC U15',sub:'15:00 · 컵'}]});
  assert.equal(h,'<div class="pp-head"><img class="pp-emb" src="data:image/png;base64,AAA" alt=""><div class="pp-id"><div class="pp-eye">FC 프로세스 U15 · 2026 주간 일정</div><div class="pp-big">10월 12일 – 18일</div></div><div class="pp-sp"></div><div class="pp-match"><span class="pp-ml">경기</span><b>vs 광주FC U15</b><span>토 10.17 · 15:00 · 컵</span></div></div>');
  assert.doesNotMatch(poster.head({team:{name:'팀'},big:'x'}),/<img/,'엠블럼이 없으면 그림 자리도 없다');
  assert.match(poster.head({team:{name:'<b>x'},matches:[{},{},{},{}]}),/&lt;b&gt;x[\s\S]*<div class="pp-more">외 2경기<\/div>/,'글자는 이스케이프 · 경기는 둘 + «외 n»');
});
test('clean: white page, thin lines, red only for matches; colour blocks, legend, load chart and pen lines go to «자세히»',()=>{
  const css=poster.css;
  assert.ok(css.split('\n').every(r=>r.startsWith('#printDoc')&&/#printDoc\.(pl-(weekboard|month)\.)?poster/.test(r)),'이 CSS 는 #printDoc.poster 에만 — «자세히»는 예전 모양 그대로');
  const hex=[...new Set(css.match(/#[0-9A-Fa-f]{6}\b/g))].map(x=>x.toUpperCase()).sort();
  assert.deepEqual(hex,['#111418','#6B7280','#9CA3AF','#B0B5BC','#C8322D','#E5E7EB'],'글자 · 회색 · 선 · 빨강(경기)뿐');
  assert.match(css,/\.pwb-leg,#printDoc\.pl-weekboard\.poster \.pwb-foot\{display:none\}/);
  assert.match(css,/\.pwb-fill\{display:none\}/);
  assert.match(css,/\.pwb-b\.meet\{min-height:0!important;background:transparent!important/,'훈련은 목록(높이 = 시간은 «자세히»)');
  assert.doesNotMatch(css,/background:#(0F1B33|C8322D)/,'색 면 없음');
});
test('clean: weekly and monthly docs use it; «깔끔하게 · 자세히» is remembered on this device',()=>{
  const p=read('studio/process.html');
  assert.match(p,/<script src="schedule-poster\.js"><\/script>/);
  assert.match(p,/let __pPoster=\(function\(\)\{ try\{ return localStorage\.getItem\('ps_sched_pdf_style'\)!=='plain'; \}/);
  assert.match(p,/head=PSSchedPoster\.head\(\{team:\{name:t\.name,logo:[^}]*\},title:`\$\{y\} 주간 일정/);
  assert.match(p,/mhead=PSSchedPoster\.head\(\{team:\{name:t\.name,logo:[^}]*\},title:'월간 일정'/);
  assert.match(p,/class="pl-'\+cls\+\(\(!blank&&__pPoster&&window\.PSSchedPoster&&\(cls==='weekboard'\|\|cls==='month'\)\)\?' poster':''\)/,'빈 양식에는 입히지 않는다');
  assert.match(p,/options:styled\?\[\{key:'style',label:'모양',choices:\[\['poster','깔끔하게'\],\['plain','자세히'\]\]\}\]:\[\]/);
  assert.match(p,/<td class="\$\{\[isMatch\?'pm-match':'',isOff\?'pm-off':'',out\?'pm-out':''/);
  assert.match(read('studio/storage-keys.js'),/\['ps_sched_pdf_style','device','ls','pref','process\.html'\]/);
  assert.match(read('sw.js'),/'\/studio\/schedule-poster\.js'/);
});
