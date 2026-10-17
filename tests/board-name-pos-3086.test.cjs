// 3.086 — 사용자 «이름표가 위 아래 선택이 안돼 무조건 위로만 나와»(훈련 만들기 · 3D).
// 3D 칩(board-token-depth.js)은 보드 설정 «이름표 위치»를 읽지 않고 늘 머리 위에 두었다. 이제 아래(기본) · 위를 따른다.
// 같이: 토큰 번호 · 이름 글자(SVG 글꼴 속성)도 Pretendard 가 먼저(3.085 «글꼴 하나»에서 빠졌던 곳).
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const D=require('../studio/board-token-depth.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('3D names sit under the chip when the board says «아래», over it when «위»',()=>{
  for(const kind of ['circle','shirt','shaper','person']){
    const below=D.nameY(kind,8,15,0,true),above=D.nameY(kind,8,15,0,false);
    assert.ok(below>0,kind+' below the foot: '+below); assert.ok(above<0,kind+' above the head: '+above);
  }
  assert.ok(D.nameY('shaper',8,15,90,true)>D.nameY('shaper',8,15,0,true),'a beak pointing down pushes the name further down');
  assert.ok(D.nameY('shaper',8,15,-90,false)<D.nameY('shaper',8,15,0,false),'a beak pointing up pushes it further up (as before)');
});
test('the chip reads the board setting; turning a shaper keeps its side',()=>{
  const src=read('studio/board-token-depth.js');
  assert.match(src,/below = nameBelow\(doc, opts\), y0 = nameY\(kind, h, font, opts && opts\.dir, below\)/);
  assert.match(src,/doc\.defaultView\.__namePos/);
  assert.match(src,/return v !== 'above';/,'default «아래», like the 2D board');
  assert.match(src,/nameY\('shaper', CHIP_H, font, deg, name\.getAttribute\('data-np'\) === 'below'\)/);
});
test('token numbers and names use the app font first',()=>{
  // SVG 글꼴 속성(«"font-family":"…"») · 3D 칩의 FONT — 시스템 글꼴이 맨 앞이면 안 된다
  for(const f of ['studio/board.html','studio/board-token-depth.js'])assert.deepStrictEqual(read(f).match(/["']font-family["']\s*:\s*["'](?:-apple-system|BlinkMacSystemFont|system-ui|Arial(?!,sans-serif'))[^"']*/g)||[],[],f+' has no system-first SVG font stack');
  assert.match(read('studio/board-token-depth.js'),/var FONT = "Pretendard,-apple-system,/);
  assert.ok((read('studio/board.html').match(/"font-family":(window\.__nameFF\|\|)?"Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif"/g)||[]).length>=4,'board token labels');
});
test('«사람» shows the chip label under the feet; a 3D pill name has no outline',()=>{
  const src=read('studio/board-token-depth.js');
  assert.match(src,/tagTxt = kind === 'person' && label \? String\(label\.textContent \|\| ''\)\.trim\(\) : ''/,'the board\'s chip label (번호 · 포지션 · 없음)');
  assert.match(src,/'class': 'ps-person-tag', .*rx: r1\(tagH \* \.3\), fill: fill,/,'in the team colour');
  assert.match(src,/if \(below && tagH\) y0 = r1\(y0 \+ tagH \+ 2\)/,'a name below goes under it');
  assert.match(src,/pill \? \{\} : \{ stroke: 'rgba\(6,12,8,\.82\)'/,'pill = no outline');
});
