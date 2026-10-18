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

// 3.093 — 선수 프로필 한 장 · 평가표(이력서 + 세부평가)도 담백하게 · 같은 창(사용자 «개인 프로필과 평가표도 만들어보자»)
test('player docs: plain profile sheet, no purple on the evaluation sheet, same export window with per-page orientation',async()=>{
  global.window={};delete require.cache[require.resolve('../studio/profile-sheet.js')];require('../studio/profile-sheet.js');
  const html=window.PSProfileSheet.docHTML({nameKr:'가상 선수',nameEn:'Test Player',pos:'CM',num:'8',club:'가상 FC',strengths:'패스',develop:'수비'});
  const css=/<style>([\s\S]*?)<\/style>/.exec(html)[1];
  assert.doesNotMatch(css,/#1F2D4A|#C9A24A/i,'남색 띠 · 금색 선 없음');
  assert.match(css,/\.hd\{margin:0 10mm;padding:10mm 0 5mm;border-bottom:2px solid #111418;/,'여백 줄임(«여백이 최소화 되게»)');
  assert.match(css,/\.ft\{margin:auto 10mm 0;padding:4mm 0 8mm;border-top:1px solid #E5E7EB;/);
  assert.match(css,/\.bd>\.arr,\.bd>\.str\{flex:1 1 auto;[^}]*max-height:calc\(var\(--n,1\)\*var\(--rh\)\)\}/,'줄이 적으면 줄 높이를 늘려 장을 채운다');
  const ps=read('studio/profile-sheet.js');
  assert.match(ps,/window\.PSPdfExport\.open\(\{title:"프로필 한 장 — PDF",html:html,fname:fn,land:false,pages:\{sel:"\.a4"/);
  const sc=read('studio/scout.html');
  assert.match(sc,/<script src="pdf-export\.js"><\/script>/);assert.match(read('studio/scouting.html'),/<script src="pdf-export\.js"><\/script>/);
  assert.match(sc,/function printStandalone\(html,rebuild,size\)\{[^\n]*\n  if\(pdfxOpen\(html,rebuild\)\)return;/);
  assert.match(sc,/\{sel:'section\.pg-resume,section\.pg-eval',land:el=>el\.classList\.contains\('pg-eval'\)\}/,'이력서 세로 · 세부평가 가로');
  const es=sc.slice(sc.indexOf('function esPageHTML('),sc.indexOf('function printPlayerReport('));
  assert.doesNotMatch(es,/#7C4DFF|#CBB8FF/,'세부평가에 보라 없음');
  assert.match(sc,/\.es-tot b\{font-size:34px;font-weight:800;letter-spacing:-1px;color:#14161A;line-height:1\}/);
  assert.match(read('studio/app.html'),/if\(fScout&&e\.source===fScout\.contentWindow&&d\.source==='scout'&&d\.type==='notePdfReady'&&d\.buffer\)\{queueNotePdf\(d\);return;\}/);
  const jpg={data:new Uint8Array([0xff,0xd8,0xff,0xd9]),w:10,h:10};
  const out=px.jpegPagesToPdf([Object.assign({land:false},jpg),Object.assign({land:true},jpg)],false);
  const t=Buffer.from(new Uint8Array(await out.arrayBuffer())).toString('latin1');
  assert.match(t,/MediaBox \[0 0 595\.28 841\.89\][\s\S]*MediaBox \[0 0 841\.89 595\.28\]/,'PDF 쪽도 장마다 방향');
});

// 3.093 — 한 장 선수 카드(프로필 요점 + 평가 요약) · 점수는 막대 + 숫자(사용자 «한 장 선수 카드» · «점수를 막대 + 숫자로»)
test('player card: one A4 page with overall, area bars and item bars; evaluation sheet uses bars instead of dots',()=>{
  delete require.cache[require.resolve('../studio/player-card.js')];
  const PC=require('../studio/player-card.js');
  const html=PC.docHTML({team:'가상 FC',nameKr:'가상 선수',nameEn:'Test Player',pos:'LCM',num:'8',foot:'R',dob:'2011-03-14',
    strengths:'',develop:'',areas:[{name:'전술',items:[{name:'스캔·판단',v:4},{name:'전환 반응',v:2}]},{name:'기술',items:[{name:'패스',v:5},{name:'슛·마무리',v:0}]},
      {name:'포지션',sub:'중앙 미드필더',pos:1,items:[{name:'템포 조절',v:1}]}]});
  assert.equal((html.match(/class="a4"/g)||[]).length,1,'한 장');
  assert.match(html,/<i>CENTRAL MIDFIELDER<\/i>/,'LCM → 가운데 이름');
  assert.match(html,/<b>4\.0<i>\/ 5<\/i><\/b><small>평가한 항목 3 \/ 4<\/small>/,'종합 = 영역 평균의 평균(전술 3.0 · 기술 5.0) · 포지션은 빼고');
  assert.match(html,/<span>전술<\/span><span class="tr"><i style="width:60\.0%"><\/i><\/span><b>3\.0<\/b>/,'영역 막대 + 숫자');
  assert.match(html,/<div class="it na"><span>슛·마무리<\/span><span class="tr"><i style="width:0\.0%"><\/i><\/span><b>—<\/b><\/div>/,'안 매긴 항목은 빈 막대 · —');
  assert.match(html,/강점 · 높은 점수[\s\S]*<div>패스<\/div><b>5<\/b>/,'강점 글이 없으면 높은 점수에서');
  assert.match(html,/보완 · 낮은 점수[\s\S]*<div>템포 조절<\/div><b>1<\/b>/);
  assert.match(html,/<title>가상 선수_선수카드_\d{4}-\d\d-\d\d<\/title>/);
  assert.doesNotMatch(html,/#3A6DF0|#7C4DFF/i,'파랑 · 보라 없음');
  assert.equal(PC.overall([{name:'a',items:[{name:'x',v:3}]},{name:'b',items:[{name:'y',v:0}]}]).v,3);
  const sc=read('studio/scout.html');
  assert.match(sc,/<script src="player-card\.js"><\/script>/);assert.match(read('sw.js'),/'\/studio\/player-card\.js'/);
  assert.match(sc,/function printPlayerCard\(id\)\{ const h=playerCardDocHTML\(id\);[^\n]*printStandalone\(h,null,\{W:794,H:1123\}\); \}/);
  assert.match(sc,/id="plCard"[^>]*>선수 카드<\/button>/);assert.match(sc,/if\(\$\("plCard"\)\)\$\("plCard"\)\.onclick=\(\)=>printPlayerCard\(pl\.id\);/);
  assert.doesNotMatch(sc,/PLCARD_CSS|es-dots/,'옛 점(●) 카드 · 점 칸 없음');
  assert.match(html,/\.hd\{margin:0 10mm;padding:10mm 0 5mm;/,'카드 여백 10mm');
  assert.match(html,/<div class="det" style="max-height:\d+px">/);assert.match(html,/<div class="blk" style="grid-template-rows:auto repeat\(2,1fr\)">/,'한 줄 칸끼리 행 높이 맞춤');
  const fill=PC.reportCSS;
  assert.match(fill,/\.pg-resume\{height:296\.5mm;/);assert.match(fill,/\.pg-eval\{height:209\.5mm;/);assert.match(fill,/\.rz-rfoot\{margin-top:auto\}/);
  assert.doesNotMatch(fill,/font:[^;]*inherit/,'font 축약형에 inherit 금지');
  assert.match(sc,/\$\{\(window\.PSPlayerCard&&PSPlayerCard\.reportCSS\)\|\|""\}<\/style>/);assert.match(sc,/resumePageHTML\(pl,lang,'1 \/ 2',1\)/);
  assert.match(read('studio/rpt-i18n.js'),/clubs:'클럽 경력', strengths:'장점', develop:'보완할 점'/);
  const es=sc.slice(sc.indexOf('function esPageHTML('),sc.indexOf('function printPlayerReport('));
  assert.match(es,/'<div class="es-bar"><i style="width:'/);assert.match(es,/<b class="es-n">/);
  assert.match(es,/'<div class="es-main" style="grid-template-rows:'\+R\.map\(x=>\(x\+1\.6\)\+'fr'\)/,'세부평가 칸이 장 높이를 나눠 갖는다');
});
