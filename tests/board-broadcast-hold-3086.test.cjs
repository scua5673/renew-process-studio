// 3.086 — 사용자 «보드에서 애니메이션 만들고 재생해보니까 화면이 깜빡이는데».
// 중계 카메라는 판(svg)을 키워 잡는다(너비 · 높이 important). 작전판 applyView 는 그 너비 · 높이를 지운다 —
// 재생 중 장면마다 «1 / 7» → «2 / 7» 로 도크 폭이 1px 남짓 바뀌면 도크 크기 감시가 applyView 를 불렀고,
// 지운 채 한 프레임이 그려져 판이 원래 크기로 튀었다가 돌아왔다. 카메라가 잡고 있는 동안 applyView 는 판 크기를 그대로 둔다.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../studio/board-broadcast.js'),'utf8');
const film=fs.readFileSync(path.join(__dirname,'../studio/board-dock-film.js'),'utf8');

function Style(){ const m={}; return { getPropertyValue:k=>m[k]?m[k].v:'', getPropertyPriority:k=>m[k]?m[k].p:'', setProperty(k,v,p){ if(v===''||v==null)delete m[k]; else m[k]={v:String(v),p:p||''}; }, removeProperty(k){ delete m[k]; }, _m:m }; }
// 작전판 applyView 가 하는 일(줄 4941 · 4943): 너비를 지우고, 높이를 지우거나 calc 로 바꾼다
const clears=s=>{ s.removeProperty('width'); s.setProperty('height','calc(100% - 40px)'); return 'done'; };

function world(){
  const body={style:Style(),classList:{set:new Set(['bc-tilt3d']),contains(c){ return this.set.has(c); }}};
  const stage={clientWidth:1000,clientHeight:700,style:Style(),getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:700,width:1000,height:700})};
  const svg={style:Style(),viewBox:{baseVal:{width:1200,height:800}},getAttribute:()=>null};
  global.document={body,getElementById:id=>id==='boardStage'?stage:null,querySelector:()=>null};
  global.window={__tilt3d:{cam:'tv'},applyView(){ return clears(svg.style); },dispatchEvent(){}};
  global.svg=svg; global.tokenLayer={getCTM:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}; global.mppNow=()=>10;
  delete require.cache[require.resolve('../studio/board-broadcast.js')];
  const api=require('../studio/board-broadcast.js');
  return {api,body,svg};
}
const box=s=>({w:s.getPropertyValue('width'),wp:s.getPropertyPriority('width'),h:s.getPropertyValue('height'),hp:s.getPropertyPriority('height')});

test('while the broadcast camera holds the board, applyView leaves its size alone',()=>{
  const {api,svg}=world();
  api.tv({goalK:()=>({}),sync(){}});
  window.__tvCam(false);                                   // 카메라가 판을 키워 잡는다
  const held=box(svg.style);
  assert.ok(held.w&&held.wp==='important'&&held.h&&held.hp==='important','camera sized the board: '+JSON.stringify(held));
  assert.equal(window.applyView(),'done','applyView still runs and returns');
  assert.deepEqual(box(svg.style),held,'width and height survive — no frame at the default size');
});
test('outside the broadcast camera applyView clears as before',()=>{
  const {api,body,svg}=world();
  api.tv({goalK:()=>({}),sync(){}});
  window.applyView();                                       // 카메라가 아직 잡지 않았다 → 그대로 지운다
  assert.deepEqual(box(svg.style),{w:'',wp:'',h:'calc(100% - 40px)',hp:''});
  window.__tvCam(false); window.__tilt3d.cam='mid';         // 3D(중계 아님)로 바꾸면 카메라는 손을 뗀다
  window.applyView();
  assert.equal(svg.style.getPropertyValue('width'),'','3D view: the board fits the stage again');
  window.__tilt3d.cam='tv'; window.__tvCam(false); body.classList.set.delete('bc-tilt3d');
  window.applyView();
  assert.equal(svg.style.getPropertyValue('width'),'','flat view: cleared');
});
test('applyView is wrapped once and still runs if the camera cannot read the board',()=>{
  const {api}=world();
  api.tv({goalK:()=>({}),sync(){}}); const w=window.applyView; api.tv({goalK:()=>({}),sync(){}});
  assert.equal(window.applyView,w,'not wrapped twice');
  delete global.svg; window.__tvCam(false);
  assert.equal(window.applyView(),'done');
});
test('the scene counter keeps one width («1 / 7» → «2 / 7» moved the dock)',()=>{
  assert.match(film,/#cmd-scene-status\{[^}]*font:800 10px\/1\.2 [^}]*;font-variant-numeric:tabular-nums!important/,'after the font shorthand (it resets the numeric variant)');
  assert.match(src,/return \{ update: update, off: off, hold: hold,/);
});
