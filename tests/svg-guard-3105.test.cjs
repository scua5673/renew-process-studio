const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.105 — 커뮤니티 글로 남의 화면에서 스크립트가 돌 수 있던 길을 막는다.
   ① 경기 장면의 공 좌표가 숫자 검사 없이 style 에 들어갔다(mvPitchHtml) — 글의 JSON 은 누구나 고쳐 올릴 수 있다
   ② 보관함에 담을 때 장면·훈련마다의 그림(thumb)이 정리 없이 들어갔다 — 담은 뒤 작전판·일정이 그대로 innerHTML 로 그린다
   ③ 썸네일을 innerHTML 로 넣는 곳은 모두 PSSafe.svg(storage.js)를 거친다 — 새로 생기는 날것의 자리를 이 시험이 잡는다
   실제 브라우저 파서로 본 정리·메시지 차단은 tests/browser/svg-guard.mjs. */
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const comm=read('studio/community.html');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>=0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('a match scene draws the ball from numbers only — markup in the coordinates never reaches the page',()=>{
  const c=vm.createContext({esc,MV_LINES:''});
  vm.runInContext(cut(comm,'function mvMarks(marks){','function mvApply(host,f){')+';this.pitch=mvPitchHtml;',c);
  const evil='"><img src=x onerror=alert(1)>';
  const h=c.pitch({tvPlayers:[],tvFrames:[{p:{},ball:{x:evil,y:'50%;background:url(https://x.invalid)'}}]},0,{});
  assert.equal(h.includes('<img'),false,h);
  assert.equal(h.includes('url('),false,h);
  assert.match(h,/class="mv-ball" style="left:50%;top:50%"/);
  assert.match(c.pitch({tvPlayers:[],tvFrames:[{p:{},ball:{x:0,y:33.5}}]},0,{}),/left:0%;top:33\.5%/,'0 은 0 그대로');
});

test('copying a community post into the library cleans every picture at any depth, with the shared DOM cleaner',()=>{
  const seen=[];
  const c=vm.createContext({window:{PSSafe:{svg:s=>{seen.push(s);return s.indexOf('onload')>=0?'':'<svg ok="1"></svg>';}}}});
  vm.runInContext(cut(comm,'function sanSvg(s){','function thumbImg(svg,cls){')+';this.sanSvg=sanSvg;this.deep=sanThumbsDeep;',c);
  const item={thumb:'<svg onload=x>',snap:{players:[]},scenes:[{thumb:'<svg>a</svg>'}],trainings:[{thumb:'<svg>b</svg>',frames:[{thumb:'<svg>c</svg>'}],pages:[{thumb:'not svg'}]}],name:'훈련'};
  const out=JSON.parse(JSON.stringify(c.deep(item)));
  assert.deepEqual([out.thumb,out.scenes[0].thumb,out.trainings[0].thumb,out.trainings[0].frames[0].thumb,out.trainings[0].pages[0].thumb],['','<svg ok="1"></svg>','<svg ok="1"></svg>','<svg ok="1"></svg>','']);
  assert.equal(out.name,'훈련','글은 그대로');
  assert.equal(seen.length,4,'SVG 는 모두 PSSafe.svg 를 거친다(SVG 가 아닌 문자열은 바로 빈칸)');
  const bare=vm.createContext({window:{}});
  vm.runInContext(cut(comm,'function sanSvg(s){','function thumbImg(svg,cls){')+';this.sanSvg=sanSvg;',bare);
  assert.equal(bare.sanSvg('<svg><rect/></svg>'),'','정리 도구가 없으면 옛 정규식으로 돌아가지 않고 그림을 뺀다');
  assert.match(cut(comm,'function copyToLib(p,btn){','function '),/if\(src\.trainings\)d\.trainings=src\.trainings;[^\n]*\n\s*sanThumbsDeep\(d\);/,'담기 직전에 깊은 정리');
});

test('every place that writes a stored thumbnail into innerHTML goes through PSSafe.svg',()=>{
  const files=['board','process','scout','idp','gamemodel','playbook','community'].map(n=>'studio/'+n+'.html');
  const raw=[
    /innerHTML\s*=\s*\(?\s*[\w.\[\]]+\.thumb\b(?!\s*\?)/,              // x.innerHTML=d.thumb
    /'\+\s*\(?\s*[\w.\[\]]+\.thumb\s*(\|\|\s*''\s*\))?\s*\+'/,          // '...'+d.thumb+'...'
    /\$\{\s*[\w.\[\]]+\.thumb\s*\}/,                                   // `${d.thumb}`
    /\?\s*(d\.thumb|t0|it\.thumb)\s*:/                                 // svg?d.thumb:img
  ];
  const hits=[];
  for(const f of files){
    read(f).split('\n').forEach((line,i)=>{ for(const re of raw)if(re.test(line))hits.push(f+':'+(i+1)+'  '+line.trim().slice(0,140)); });
  }
  assert.deepEqual(hits,[],'날것의 썸네일 자리');
  const board=read('studio/board.html');
  assert.match(board,/function thumbView\(d\)\{ var t=thumbViewRaw\(d\); return \(typeof t==="string"&&t\)\?PSSafe\.svg\(t\):t; \}/);
  assert.match(board,/function printThumb\(s\)\{[^\n]*return PSSafe\.svg\(pdfFullBoardSVG\(t\|\|\(\(s&&s\.thumb\)\|\|""\)\)\); \}/,'PDF 전체 판 복원 뒤 SVG 정리');
});

test('messages from other sites are stopped before any screen listener, and the shell bridge checks the origin',()=>{
  const storage=read('studio/storage.js');
  const guard=storage.indexOf("if(e.origin!==location.origin)e.stopImmediatePropagation();");
  assert.ok(guard>0,'storage.js 의 출처 차단');
  assert.match(storage.slice(guard-200,guard+120),/addEventListener\('message',function\(e\)\{\s*if\(e\.origin!==location\.origin\)e\.stopImmediatePropagation\(\);\s*\},true\)/);
  for(const n of ['app','board','community','gamemodel','idp','note','playbook','process','scout','scouting','terms']){
    const s=read('studio/'+n+'.html'),load=s.indexOf('src="storage.js'),first=s.search(/addEventListener\(\s*['"]message['"]/);
    assert.ok(load>0,n+': storage.js');
    if(first>=0)assert.ok(load<first,n+': storage.js 가 첫 메시지 리스너보다 먼저 읽힌다');
  }
  const app=read('studio/app.html');
  const bridge=cut(app,'/* 커뮤니티 ↔ 작전판 편집기 브리지','else if(d.source===\'board\'&&d.type===\'commAct\')');
  assert.match(bridge,/if\(location\.protocol!=='file:'&&e\.origin!==location\.origin\)return;/,'commAct 브리지의 출처 확인');
  assert.match(cut(app,"d.type==='shareData'",'\n'),/./);
  assert.match(app,/addEventListener\('message',function\(e\)\{var d=e\.data\|\|\{\}; if\(location\.protocol!=='file:'&&e\.origin!==location\.origin\)return;[^\n]*\n\s*if\(!\(\(d\.source==='board'\|\|d\.source==='scout'\)&&d\.type==='shareData'/,'공유 링크 만들기의 출처 확인');
});

test('PDF.js never takes the eval path for fonts (CVE-2024-4367)',()=>{
  const note=read('studio/note.html');
  const calls=note.match(/getDocument\(\{[^}]*\}\)/g)||[];
  assert.ok(calls.length>0);
  for(const c of calls)assert.match(c,/isEvalSupported:false/,c);
});

/* 3.105 — 커뮤니티 보기(작전판 iframe)에서 글의 값이 HTML 로 들어가는 자리. 글의 JSON 은 누구나 고쳐 올릴 수 있다 */
test('the community viewer escapes post values it puts into markup (banner label, photo token, own pictures, kit colour)',()=>{
  const board=read('studio/board.html');
  assert.match(board,/'커뮤니티 '\+esc\(d\.kindLabel\|\|'작전판'\)/,'배너의 종류 이름');
  assert.match(board,/esc\(d\.unit\|\|\(d\.book\?'시퀀스 ':'페이지 '\)\)\+\(\+post\.pageN\)/,'배너의 단위 · 장 수');
  assert.match(board,/<image href="'\+esc\(p\.src\)\+'"/,'사진 토큰 주소');
  assert.match(board,/<img src="'\+esc\(im\.src\)\+'" alt="">/,'내 사진 장비');
  assert.match(board,/fill="'\+esc\(fill\)\+'" stroke="'\+esc\(teamStroke\(fill\)\)\+'"/,'경기 명단 유니폼 색');
  assert.doesNotMatch(board,/href="'\+p\.src\+'"|src="'\+im\.src\+'"/);
});
