const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const board=R('studio/board.html'),depth=R('studio/board-token-depth.js'),notes=require('../studio/release-notes.js');

/* 3.029 — 사용자 «3D 연출 — 시간대 · 분석 그래픽»(목업 ①): 분위기 낮·해질녘·야간 · 분석 그래픽 다섯 · 팀 브랜딩 */
test('3.029 mood is a device option with night (today\'s look) as the default, and reaches the stadium, the stage and the chips',()=>{
  assert.match(board,/var TILT_MOOD=\{night:\{key:"night",ga:"#2c6a2a",gb:"#367a33",tint:null,cone:\.9,lamp:1,vig:\.62,warm:0\},/,'night keeps the colours the stadium had');
  assert.match(board,/day:\{key:"day",ga:"#3b9a4e",gb:"#348c46",tint:\["#fff",\.06\],cone:0,lamp:\.2,vig:\.3,warm:0\}/);
  assert.match(board,/dusk:\{key:"dusk",ga:"#3a8a45",gb:"#327d3e",tint:\["#ff9a3c",\.1\],cone:\.45,lamp:\.7,vig:\.52,warm:\.12\}/);
  assert.match(board,/mood:TILT_MOOD\[o\.mood\]\?o\.mood:"night",brand:!!o\.brand\}; \}/,'read with the other 3D options');
  assert.match(board,/function tiltMoodApply\(\)\{ try\{ var m=\(window\.__tilt3d&&TILT_MOOD\[window\.__tilt3d\.mood\]\)\?window\.__tilt3d\.mood:"night"; document\.body\.setAttribute\("data-tilt-mood",m\);/);
  assert.match(board,/else if\(k==="mood"\)\{ if\(!TILT_MOOD\[v\]\)return; n\.mood=v; \} else if\(k==="brand"\)\{ n\.brand=\(v===true\|\|v==="1"\|\|v===1\); \}/);
  assert.match(board,/if\(n\.mood!==o\.mood\)\{ try\{ if\(document\.body\.classList\.contains\("bc-tilt3d"\)\)renderTokens\(\); \}catch\(_\)\{\} \}/,'chips are rebuilt so their shadows follow');
  /* stadium picture */
  assert.match(board,/md=TILT_MOOD\[t3\.mood\]\|\|TILT_MOOD\.night,brand=!!t3\.brand,tname=brand\?tiltTeamName\(\):"",tcol=brand\?String\(teamHex\("blue"\)\|\|""\):"",ad=String\(t3\.ad\|\|""\)\.trim\(\)\|\|tname\|\|"PROCESS STUDIO"/);
  assert.match(board,/const sig=\[wt,L,R,T,B,goals\?sp\.goal:0,turf\?1:0,deco,ad,md\.key,brand\?1:0,tcol(?:,bleed\?1:0)?\]\.join\('\|'\);/,'mood and branding redraw the picture');
  assert.match(board,/fill="'\+md\.ga\+'"\/><rect width="'\+f\(5\*m\)\+'" height="'\+f\(10\*m\)\+'" fill="'\+md\.gb\+'"\/>/,'grass tone');
  assert.match(board,/stop-opacity="'\+md\.vig\+'"\/><\/radialGradient>'/,'outer darkness');
  assert.match(board,/<radialGradient id="psStCone">/);assert.match(board,/<clipPath id="psStPitchClip"><path d="'\+rr\(0\)\+'"\/><\/clipPath>/,'light cones stay on the grass');
  assert.match(board,/if\(md\.cone>0\)\{ o\+='<g clip-path="url\(#psStPitchClip\)" fill="url\(#psStCone\)" fill-opacity="'\+md\.cone\+'">'; \[\[L,T\],\[R,T\],\[R,B\],\[L,B\]\]/);
  assert.match(board,/<g fill="url\(#psStLamp\)" fill-opacity="'\+md\.lamp\+'">'\+lamps\+'<\/g>'/,'roof lamps dim by day');
  assert.match(board,/\(md\.warm\?'<path d="'\+rr\(dE\)\+'" fill="#ff9a3c" fill-opacity="'\+md\.warm\+'"\/>':''\)\+'<path d="'\+rr\(dE\)\+'" fill="url\(#psStVig\)"\/><\/g>'/,'dusk wash under the vignette');
  /* stage + screen layer */
  assert.match(board,/html body\.bc-tilt3d\[data-tilt-mood="day"\] #boardStage\{background:#3c4753!important\}/);
  assert.match(board,/html body\.bc-tilt3d\[data-tilt-mood="dusk"\] #boardStage\{background:#241c27!important\}/);
  assert.match(board,/#tiltMood\{display:none;position:absolute;inset:0;pointer-events:none;z-index:5\}\nbody\.bc-tilt3d #tiltMood\{display:block\}/);
  assert.match(board,/mood=document\.createElement\("div"\); mood\.id="tiltMood"; mood\.setAttribute\("aria-hidden","true"\); stage\.appendChild\(mood\);/);
  /* chips */
  assert.match(board,/nameStyle:window\.__nameStyle==="pill"\?"pill":"text",mood:\(window\.__tilt3d&&window\.__tilt3d\.mood\)\|\|"night"\}; \}/);
  assert.match(depth,/var mood = opts && opts\.mood;\n    if \(mood === 'day'\) body\.appendChild\(node\(doc, 'ellipse', \{ cx: 3, cy: 3, rx: R \+ 2, ry: R \* \.8, fill: '#000', 'fill-opacity': '\.22'/,'day: one short shadow');
  assert.match(depth,/else if \(mood === 'dusk'\) body\.appendChild\(node\(doc, 'ellipse', \{ cx: R \* 1\.1, cy: 3, rx: R \* 2\.1, ry: R \* \.62, fill: '#000', 'fill-opacity': '\.3'[^\n]*transform: 'rotate\(12\)'/,'dusk: one long shadow');
  assert.match(depth,/else \[\[6, 5\], \[-6, 5\], \[6, -3\], \[-6, -3\]\]\.forEach\(/,'night: the four masts as before');
  /* settings rows, 3D only, synced */
  assert.match(board,/<div class="menurow ps-tilt-row" id="tiltMoodRow"><span class="menulbl">분위기<\/span><div class="seg" id="tiltMoodSeg"[^>]*><button type="button" data-mood="day"[^>]*>낮<\/button><button type="button" data-mood="dusk"[^>]*>해질녘<\/button><button type="button" data-mood="night" class="on" aria-pressed="true"[^>]*>야간<\/button><\/div><\/div>/);
  assert.match(board,/<div class="menurow ps-tilt-row" id="tiltBrandRow"><span class="menulbl">팀 브랜딩<\/span>/);
  assert.match(board,/document\.querySelectorAll\("#tiltMoodSeg button\[data-mood\]"\)\.forEach\(function\(b\)\{ var on=b\.getAttribute\("data-mood"\)===o\.mood;/);
  assert.match(board,/closest\("#tiltCamSeg button\[data-cam\],#tiltDecoSeg button\[data-deco\],#tiltMoodSeg button\[data-mood\],#tiltBrandSeg button\[data-brand\]"\)/);
  assert.match(board,/\["view","3D 경기장",\["tiltCamSeg","tiltDecoSeg","tiltAdInput","tiltMoodSeg","tiltBrandSeg"\],"ps-tilt-row"\]/,'settings sections (3.036: 3D rows under «내 화면», analysis under «선수 표시»)');
  assert.match(board,/\["look","분석",\["analysisSeg"\]\]/);
});

test('3.029 analysis graphics live on the board (snapshot), under the drawings, and recompute with the players',()=>{
  assert.match(board,/let svg,world,drawLayer,tokenLayer,drawCatch,analysisLayer=null;/);
  assert.match(board,/buildLines\(\);\n  analysisLayer=el\("g",\{id:"analysisLayer","pointer-events":"none"\}\);world\.appendChild\(analysisLayer\);[^\n]*\n  drawLayer=el\("g",\{id:"drawLayer"\}\);/,'above the lines, below drawings and tokens');
  assert.match(board,/try\{_setSelRings\(\);\}catch\(_\)\{\}\n  try\{renderAnalysis\(\);\}catch\(_\)\{\}/,'every renderTokens');
  assert.match(board,/pitchN:state\.pitchN\|\|1,analysis:anNorm\(state\.analysis\),/,'captured');
  assert.match(board,/state\.press=\(s\.press&&s\.press\.on\)\?\{\.\.\.s\.press\}:null;\n  state\.analysis=anNorm\(s\.analysis\);/,'restored');
  assert.match(board,/pitchN:1,analysis:null,tool:"move",/,'default off');
  assert.match(board,/const ANALYSIS_KEYS=\["hull","gap","off","vor","press"\];/);
  assert.match(board,/<div class="menurow" id="analysisRow"><span class="menulbl">분석 그래픽<\/span><div class="seg ps-multi" id="analysisSeg"[^>]*><button type="button" data-an="hull"[^>]*>팀 형태<\/button><button type="button" data-an="gap"[^>]*>라인 간격<\/button><button type="button" data-an="off"[^>]*>오프사이드<\/button><button type="button" data-an="vor"[^>]*>공간 점유<\/button><button type="button" data-an="press"[^>]*>압박 거리<\/button><\/div><\/div>/,'five toggles, several at once');
  assert.match(board,/closest\("#analysisSeg button\[data-an\]"\); if\(!b\)return; e\.stopPropagation\(\); var k=b\.getAttribute\("data-an"\); setAnalysis\(k,!anOn\(k\)\);/);
  assert.doesNotMatch(board,/<span class="menulbl">분석<\/span>/,'the row label is unique (the player «표시» row must stay the first «표시»)');
  /* the geometry helpers, run for real */
  const src=[/const ANALYSIS_KEYS=[^\n]*\n/,/function anNorm\(a\)[^\n]*\n/,/function _anGK\(p\)[^\n]*\n/,/function _anM\(u\)[^\n]*\n/,/function _anHull\(pts\)\{[\s\S]*?return lo\.slice\(0,-1\)\.concat\(up\.slice\(0,-1\)\); \}\n/,/function _anClip\(poly,a,b,c\)\{[\s\S]*?return res; \}\n/,/function _anLines\(ps,dir\)\{[\s\S]*?return out\.filter\(function\(x\)\{return x\.length;\}\); \}\n/]
    .map(re=>{const m=re.exec(board);assert.ok(m,String(re).slice(0,40));return m[0];}).join('\n');
  const c=vm.createContext({MPP:10,posGroup:v=>v==='GK'?'GK':/CB|LB|RB/.test(v||'')?'DF':/DM|CM|AM/.test(v||'')?'MF':v?'FW':''});
  vm.runInContext(src+'\nthis.H=_anHull;this.C=_anClip;this.L=_anLines;this.N=anNorm;this.M=_anM;this.GK=_anGK;',c);
  assert.equal(JSON.stringify(c.N({hull:1,vor:0,bogus:1})),'{"hull":true}','only known keys, truthy ones');   /* vm 쪽 객체라 JSON 으로 비교 */assert.equal(c.N({}),null);assert.equal(c.N('x'),null);
  assert.equal(c.M(123),'12.3m');assert.equal(c.GK({num:1}),true);assert.equal(c.GK({pos:'GK',num:12}),true);assert.equal(c.GK({num:9}),false);
  const hull=c.H([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10},{x:5,y:5},{x:3,y:7}]);
  assert.equal(hull.length,4,'inner points are dropped');assert.equal(JSON.stringify(hull.map(p=>[p.x,p.y])),'[[0,0],[10,0],[10,10],[0,10]]','counter-clockwise from the left-bottom corner');
  const half=c.C([[0,0],[10,0],[10,10],[0,10]],1,0,5);   /* x<=5 */
  assert.equal(JSON.stringify(half),'[[0,0],[5,0],[5,10],[0,10]]');
  const byPos=c.L([{x:20,pos:'CB'},{x:22,pos:'LB'},{x:21,pos:'RB'},{x:40,pos:'CM'},{x:41,pos:'DM'},{x:60,pos:'ST'}],1);
  assert.equal(JSON.stringify(byPos.map(l=>l.length)),'[3,2,1]','positions make the lines');
  const byGap=c.L([{x:20},{x:22},{x:21},{x:40},{x:41},{x:60}],1);
  assert.equal(JSON.stringify(byGap.map(l=>l.map(p=>p.x))),'[[20,21,22],[40,41],[60]]','without positions, the two widest gaps split the lines');
  assert.equal(JSON.stringify(c.L([{x:1},{x:2}],1).map(l=>l.length)),'[2]','two players are one line');
});

test('3.029 team branding: the ad text defaults to the team name and the crowd wears the team colour',()=>{
  assert.match(board,/function tiltTeamName\(\)\{ try\{ var n=\(typeof squad!=="undefined"&&squad&&squad\.name&&squad\.name!=="우리 선수단"\)\?squad\.name:"";\n    if\(!n&&typeof matchClock!=="undefined"&&matchClock&&matchClock\.homeName&&matchClock\.homeName!=="우리"\)n=matchClock\.homeName;/);
  assert.match(board,/var _crowdTiles=\{\};[^\n]*\n  function crowdTile\(teamCol\)\{ var key=String\(teamCol\|\|""\);\n    if\(_crowdTiles\[key\]!=null\)return _crowdTiles\[key\];/);
  assert.match(board,/if\(\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(key\)\)for\(let i=0;i<6;i\+\+\)shirts\.push\(key\);/,'about a third of the crowd');
  assert.match(board,/const crowd=deco==="full"\?crowdTile\(brand\?tcol:""\):'',ct=S\*\.046;/);
});

test('3.029 version, release note',()=>{
  /* 뒤 PR 이 판을 올려도 깨지지 않게 — 3.029 이상 · sw.js CACHE = app.html PS_BUILD */
  const cache=(R('sw.js').match(/^const CACHE = 'process-(3\.\d{3})';/m)||[])[1],build=(R('studio/app.html').match(/window\.PS_BUILD='(3\.\d{3})'/)||[])[1];
  assert.ok(cache&&build);assert.equal(cache,build);assert.ok(+build.slice(2)>=29,build);
  const e=notes.entries().find(x=>x.id==='2026-10-14-v3-029-3d-look');
  assert.ok(e,'3.029 note');
  assert.ok(e.changes.some(c=>/낮 · 해질녘 · 야간/.test(c)&&/«야간»/.test(c))&&e.changes.some(c=>/팀 형태/.test(c)&&/압박 거리/.test(c)&&/사진 · 영상/.test(c))&&e.changes.some(c=>/«팀 브랜딩»/.test(c)));
});
