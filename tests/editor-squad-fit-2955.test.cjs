'use strict';
/* 2.955 — 훈련 편집기 «선수단 올리기»의 «전체 선수»가 «전체 선»으로 잘렸다 · 말풍선이 화면 오른쪽 끝에서 잘렸다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');

test('squad buttons never shrink below their text; the group wraps under the label instead',()=>{
  assert.ok(/#epSquadRow\.ep-squad-row:not\(#_\):not\(#__\)\{display:flex!important;flex-wrap:wrap;/.test(B));
  assert.ok(/#epSquadRow \.ep-sq-btns:not\(#_\):not\(#__\)\{display:flex!important;flex-wrap:wrap;[^}]*flex:1 1 200px;/.test(B));
  assert.ok(/#epSquadRow \.ep-sq-btn:not\(#_\):not\(#__\)\{[^}]*min-width:max-content;/.test(B),'글자 폭 아래로 안 준다');
  /* 데스크톱 편집기 블록(@media min-width:760px) 안, 여백을 키운 규칙 바로 뒤에 있어야 이긴다 */
  const a=B.indexOf('html body #editorPanel .ep-sq-btn:not(#_):not(#__){height:32px'),b=B.indexOf('#epSquadRow.ep-squad-row:not(#_)');
  assert.ok(a>0&&b>a&&b-a<1200);
});

test('tooltip is content-sized, clamped inside the viewport, and its tail points at the element',()=>{
  assert.ok(/\.tipbox\{width:max-content;max-width:min\(320px,calc\(100vw - 16px\)\);white-space:normal;/.test(B),'왼쪽 좌표에 따라 폭이 눌리지 않게');
  assert.ok(/\.tipbox::after\{[^}]*left:var\(--ax,50%\)/.test(B));
  /* show() 의 위치 계산만 떼어 돌린다 */
  const s=B.indexOf('function show(el){'),e=B.indexOf('function hide(){',s);
  const tip={textContent:'',style:{props:{},setProperty(k,v){this.props[k]=v;}},offsetWidth:300,offsetHeight:28,classList:{add(){},remove(){}}};
  const c=vm.createContext({tip,window:{innerWidth:1310,innerHeight:820},Math,hide(){}});
  vm.runInContext(B.slice(s,e),c);
  const el={getAttribute:()=>'설명',getBoundingClientRect:()=>({left:1188,width:82,bottom:243,top:211})};
  c.show(el);
  const left=parseFloat(tip.style.left);
  assert.ok(left+150<=1310-8,'오른쪽 끝 안 '+left);
  assert.equal(Math.round(left-150+parseFloat(tip.style.props['--ax'])),1229,'꼬리는 버튼 가운데');
  const el2={getAttribute:()=>'설명',getBoundingClientRect:()=>({left:4,width:40,bottom:60,top:28})};
  c.show(el2);assert.ok(parseFloat(tip.style.left)-150>=8,'왼쪽 끝 안');
});
