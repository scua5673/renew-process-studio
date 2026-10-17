// 3.086 — 사용자 «이름도 다양하게 쓸수 있게 하고 싶어 — 폰트를». 보드 설정 › 이름표 글꼴: 기본 · 굵게 · 둥글게 · 손글씨 · 명조.
// 보드마다 저장(겉모습 설정 nameFont), 2D · 3D 이름표가 따르고, 내보내기(그림 · GIF · 영상)에는 쓰인 글자의 조각을 SVG 안에 넣는다.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const NF=require('../studio/board-name-font.js');
test('five choices; «기본» keeps the board font, the others put their font first',()=>{
  assert.deepStrictEqual(NF.ORDER,['base','bold','round','hand','serif']);
  assert.deepStrictEqual(NF.ORDER.map(k=>NF.FONTS[k].label),['기본','굵게','둥글게','손글씨','명조']);
  assert.equal(NF.stack('base'),''); assert.equal(NF.stack('nope'),'');
  assert.match(NF.stack('round'),/^'PSN Jua',Pretendard,/);
});
test('every font is self-hosted (font-src self) with its licence, and every piece its CSS names exists',()=>{
  for(const k of NF.ORDER.filter(k=>NF.FONTS[k].dir)){
    const dir='vendor/name-fonts/'+NF.FONTS[k].dir, css=read(dir+'/font.css'), faces=NF.parseCss(css);
    assert.ok(faces.length>=80,k+' pieces '+faces.length);
    assert.ok(faces.every(f=>fs.existsSync(path.join(root,dir,f.file))),k+' files');
    assert.ok(css.includes("font-family:'"+NF.FONTS[k].family+"'")&&/font-weight:100 900/.test(css),k+' one face for every weight (no fake bold)');
    assert.match(read(dir+'/OFL.txt'),/SIL Open Font License/);
    const pick=NF.pick(faces,'김민준 이유찬 Son 10');
    assert.ok(pick.length>=1&&pick.length<=6,k+' only the pieces the names need: '+pick.map(f=>f.file));
    const cps=[...'김민준이유찬Son'].map(c=>c.codePointAt(0));
    assert.ok(cps.every(cp=>pick.some(f=>f.ranges.some(r=>cp>=r[0]&&cp<=r[1]))),k+' covers every letter');
  }
});
test('export SVG gets the font inside it (an SVG picture cannot see the page fonts)',()=>{
  const faces=[{file:'1.woff2',ur:'U+AC00-AC01',ranges:[[0xac00,0xac01]]},{file:'2.woff2',ur:'U+41',ranges:[[0x41,0x41]]}];
  const css=NF.faceCss('PSN Jua',faces,{'1.woff2':'QUJD'});
  assert.equal(css,"@font-face{font-family:'PSN Jua';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,QUJD) format('woff2');unicode-range:U+AC00-AC01}",'only pieces already fetched');
  assert.equal(NF.embed('<svg xmlns="x" width="1"><g/></svg>',css),'<svg xmlns="x" width="1"><style>'+css+'</style><g/></svg>');
  assert.equal(NF.embed('<svg><g/></svg>',''),'<svg><g/></svg>');
});
test('the board saves it per board and both name drawings use it',()=>{
  const b=read('studio/board.html'),d=read('studio/board-token-depth.js'),m=read('studio/board-name-font.js');
  // 3.087 — 보드마다 저장하는 설정은 모듈이 window.__psLookExt 에 적고 board.html 이 다섯 곳에서 읽는다(키를 board.html 에 하나씩 적지 않는다)
  assert.match(b,/"realScale"\]\.concat\(Object\.keys\(window\.__psLookExt\|\|\{\}\)\);\}/,'look key');
  assert.match(b,/var x=\(window\.__psLookExt\|\|\{\}\)\[k\]; return x\?x\.def:null; \}/,'default');
  assert.match(b,/var x=\(window\.__psLookExt\|\|\{\}\)\[k\]; return x\?!!x\.ok\(v\):true; \}/,'validated');
  assert.match(b,/for\(var x in window\.__psLookExt\|\|\{\}\)o\[x\]=window\["__"\+x\];/,'saved');
  assert.match(b,/for\(var x in window\.__psLookExt\|\|\{\}\)window\["__"\+x\]=o\[x\];/,'applied');
  assert.match(m,/ext\.nameFont = \{ def: 'base', ok: ok \};/);
  for(const k of NF.ORDER)assert.ok(NF.ok(k),k); assert.ok(!NF.ok('zzz'));
  assert.match(b,/"font-weight":_nt\?"800":"700","font-family":window\.__nameFF\|\|"Pretendard,/,'2D name');
  assert.match(d,/'font-family': nameFF\(doc\) \|\| \(label && label\.getAttribute\('font-family'\)\) \|\| FONT/,'3D name');
  assert.match(b,/\["look","이름표",\["namePosSeg","nameSizeSeg","nameStyleSeg","nameFontSeg"\]\]/,'settings row under 이름표');
  // 보드를 여는 길(restoreLiveBoard)이 본문 스크립트 안에서 바로 돈다 — 그 전에 window.__nameFont 받이가 있어야 한다
  const i=b.indexOf('<script src="board-name-font.js"></script>'),j=b.indexOf('function restoreLiveBoard()');
  assert.ok(i>0&&i<j,'loaded before the board script');
  assert.match(read('sw.js'),/'\/studio\/board-name-font\.js'/,'offline');
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
});
