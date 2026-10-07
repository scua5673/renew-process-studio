const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.960 — 미팅의 «맨 위 문구»는 미팅 전체의 머리글. 사용자 «맨 위 문구는 쓰면 다른 페이지도 전부 적용시켜줘».
   저장 자리(slide.pageBrand · slide.textStyles.brand)는 그대로 — 쓸 때 모든 슬라이드에 같이 적는다(옛 판·PDF·PPT 가 장마다 읽는다). */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

test('the side panel field writes the top line to every slide and says so',()=>{
  assert.match(src,/ed\.querySelector\("#ksBrand"\)\.addEventListener\("input",function\(e\)\{var f=frames\(\)\[idx\(\)\];if\(f\)\{var _bv=e\.target\.value;frames\(\)\.forEach\(function\(s\)\{s\.pageBrand=_bv;\}\);ovRender\(\);\}/);
  assert.match(src,/<input id="ksBrand" maxlength="80" placeholder="PROCESS"><p class="ks-tip">모든 슬라이드에 같이 적용돼요\./);
});

test('editing the top line on the paper writes text and look to every slide, Esc puts each slide back',()=>{
  assert.match(src,/var brandBefore=isBrand\?anim\.slides\.map\(function\(s\)\{return s\.pageBrand;\}\):null;/);
  assert.match(src,/function write\(value\)\{if\(isBrand\)anim\.slides\.forEach\(function\(s\)\{s\.pageBrand=value;\}\);else if\(isTitle\)slide\.title=value;/);
  assert.match(src,/if\(ev\.key==='Escape'\)\{if\(brandBefore\)anim\.slides\.forEach\(function\(s,k\)\{s\.pageBrand=brandBefore\[k\];\}\);else write\(original\);editor\.blur\(\);\}/);
  assert.match(src,/if\(kind==='brand'\)\{var _bs=slide\.textStyles\.brand;anim\.slides\.forEach\(function\(s\)\{if\(s===slide\)return;s\.textStyles=s\.textStyles\|\|\{\};s\.textStyles\.brand=\{size:_bs\.size,weight:_bs\.weight,color:_bs\.color\};\}\);\}/);
  /* 제목·메모는 여전히 그 장만 */
  assert.match(src,/else if\(isTitle\)slide\.title=value;else if\(continuous\)slide\.points=value\.split\('\\n'\);/);
});

test('«새 슬라이드» starts with the same top line and look as the slide it follows',()=>{
  const a=src.indexOf('  window.__meet={');
  const code=src.slice(a,src.indexOf('  window.__meetReset=',a));
  const slides=[
    {title:'A',pageBrand:'우리 팀',textStyles:{brand:{size:20,weight:800,color:'#c00000'},title:{size:30}},snap:{}},
    {title:'B',pageBrand:'우리 팀',textStyles:{brand:{size:20,weight:800,color:'#c00000'}},snap:{}}
  ];
  const c=vm.createContext({window:{},anim:{slides},meetIdx:1,meetAutoTok:0,meetRaf:null,
    meetStore(){},meetCap:()=>({players:[]}),boardThumbSVG:()=>'<svg/>',meetBind:()=>null,meetingPdfOrientation:()=>'landscape',
    JSON,Math});
  vm.runInContext(code,c);
  c.window.__meet.add();
  assert.equal(slides.length,3);
  const f=slides[2];
  assert.equal(f.pageBrand,'우리 팀');
  assert.deepEqual(JSON.parse(JSON.stringify(f.textStyles)),{brand:{size:20,weight:800,color:'#c00000'}},'only the top-line look, not the title look');
  f.textStyles.brand.size=11;assert.equal(slides[1].textStyles.brand.size,20,'a copy, not the same object');
  /* 첫 미팅(문구를 안 고친 장)은 예전처럼 비워 둔다 — 종이는 «PROCESS» 를 그린다 */
  const plain=[{title:'X',snap:{}}];
  const c2=vm.createContext({window:{},anim:{slides:plain},meetIdx:0,meetAutoTok:0,meetRaf:null,
    meetStore(){},meetCap:()=>({}),boardThumbSVG:()=>'',meetBind:()=>null,meetingPdfOrientation:()=>'landscape',JSON,Math});
  vm.runInContext(code,c2);c2.window.__meet.add();
  assert.equal('pageBrand' in plain[1],false);assert.equal('textStyles' in plain[1],false);
});
