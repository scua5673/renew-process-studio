'use strict';
/* 3.304 — 전체화면 «접기 / 펴기»(사용자 «전체 화면 누르면 아예 안 보이게끔 접고 펴고 할 수 있게») */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tf=require('../studio/board-tv-fold.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

/* 아주 작은 가짜 문서 — 모듈이 쓰는 것만 */
function fake(classes){
  const byId={},docL=[];
  class El{
    constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this._cls=new Set();this._style={};this._l={};this.h=0;
      const self=this;
      this.classList={contains:c=>self._cls.has(c),add:c=>{self._cls.add(c);},remove:c=>{self._cls.delete(c);},toggle:(c,on)=>{const v=on===undefined?!self._cls.has(c):!!on;if(v)self._cls.add(c);else self._cls.delete(c);return v;}};
      this.style={setProperty:(k,v,p)=>{self._style[k]=v+(p?' !'+p:'');},removeProperty:k=>{delete self._style[k];},getPropertyValue:k=>self._style[k]||''};}
    set id(v){this._id=v;byId[v]=this;} get id(){return this._id;}
    appendChild(c){c.parentNode=this;this.children.push(c);return c;}
    insertBefore(c,ref){c.parentNode=this;this.children.splice(this.children.indexOf(ref),0,c);return c;}
    addEventListener(t,fn){(this._l[t]=this._l[t]||[]).push(fn);}
    click(){const e=ev(this);(this._l.click||[]).forEach(fn=>fn(e));return e;}
    setAttribute(){} focus(){this.focused=true;} get offsetWidth(){return 1;}
    getBoundingClientRect(){return {height:this.h};}
    closest(sel){let n=this;while(n){if(sel==='#'+n.id)return n;n=n.parentNode;}return null;}
  }
  const ev=target=>({target,key:'',stopped:false,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;}});
  const body=new El('body');(classes||[]).forEach(c=>body._cls.add(c));
  const doc={body,head:new El('head'),createElement:t=>new El(t),getElementById:id=>byId[id]||null,addEventListener:(t,fn,cap)=>docL.push({t,fn,cap})};
  const sent=[],observers=[];
  const win={document:doc,parent:{postMessage:m=>sent.push(m)},MutationObserver:function(fn){observers.push(fn);this.observe=()=>{};},setTimeout:()=>0,fits:0,fitBoardAspect(){win.fits++;}};
  const mk=(id,parent)=>{const e=new El('div');e.id=id;(parent||body).appendChild(e);return e;};
  const fire=(t,over)=>{const e=Object.assign(ev(over&&over.target||body),over||{});docL.filter(l=>l.t===t).forEach(l=>l.fn(e));return e;};
  return {win,doc,body,byId,sent,mk,fire,mutate:()=>observers.forEach(fn=>fn()),El};
}

test('css: folded full screen hides every control; the unfold handle is always visible (no hover-only UI), small and faint',()=>{
  const c=tf.css();
  assert.match(c,/body\.vault-full\.ps-tv-fold #vvBar,[^{]*body\.vault-full\.ps-tv-fold #vvPg\{display:none!important\}/,'close group · pager');
  assert.match(c,/body\.vault-full\.ps-tv-fold #ps-command-dock(:not\(#tf\d+\)){20},/,'the dock — as strong as the dock\'s own display!important rules');
  for(const id of ['ps-dock','ps-df-opts','ps-df-tray','psVvPlay'])assert.match(c,new RegExp('body\\.vault-full\\.ps-tv-fold #'+id+'(:not\\(#tf\\d+\\)){20}'),id);
  assert.match(c,/#psTvFold\{position:fixed;left:50%;bottom:/);assert.match(c,/body\.vault-full\.ps-tv-fold #psTvFold\{display:flex\}/,'shown without hover');
  assert.match(c,/#psTvFold\{[^}]*display:none/,'and only while folded');
  assert.match(c,/#psTvFold::before\{content:"";position:absolute;inset:-14px -18px\}/,'a finger-sized target around a small pill');
  assert.doesNotMatch(c,/ps-tv-fold[^{]*#board\b|ps-tv-fold[^{]*#boardStage/,'the pitch itself is never hidden');
});

test('fold only inside full screen: adds the button, hides everything, frees the stage, tells the shell; unfold restores the dock room',()=>{
  const f=fake(['vcreating']);const stage=f.mk('boardStage');const dock=f.mk('ps-command-dock');dock.h=112;
  const api=tf.install(f.win);assert.ok(api);
  assert.equal(api.set(true),false,'not full screen → nothing');assert.equal(f.body._cls.has('ps-tv-fold'),false);assert.deepEqual(f.sent,[]);
  /* 전체화면에 들어온다(본문이 body class 와 닫기 묶음을 만든다) */
  f.body._cls.add('vault-full');const bar=f.mk('vvBar');const edit=f.mk('vvEdit',bar);f.mk('vvClose',bar);stage._style['padding-bottom']='126px !important';
  f.mutate();
  const btn=f.byId.vvFold;assert.ok(btn,'«접기» in the close group');assert.equal(bar.children[0],btn,'before «편집»');assert.equal(btn.title.includes('Esc'),true);
  f.mutate();assert.equal(bar.children.filter(c=>c.id==='vvFold').length,1,'added once');
  assert.equal(f.body._cls.has('ps-tv-fold'),false,'entering full screen starts unfolded');
  btn.click();
  assert.equal(f.body._cls.has('ps-tv-fold'),true);assert.equal(stage._style['padding-bottom'],'12px !important','the dock room is given back to the pitch (12 = the board\'s own no-dock margin, so its padding watcher agrees)');
  assert.deepEqual(f.sent,[{source:'board',type:'tvFold',on:true}],'the shell hides its status strip');assert.ok(f.win.fits>=1,'board refit');
  const handle=f.byId.psTvFold;assert.ok(handle,'unfold handle');assert.equal(handle.parentNode,f.body);assert.equal(handle._cls.has('fresh'),true,'it shows itself once');
  handle.click();
  assert.equal(f.body._cls.has('ps-tv-fold'),false);assert.equal(stage._style['padding-bottom'],'126px !important','dock height + 14 again (creating · editing keeps the dock)');
  assert.deepEqual(f.sent[1],{source:'board',type:'tvFold',on:false});assert.equal(btn.focused,true);
  void edit;
});

test('Esc unfolds first (never closes the view while folded); the dock\'s own «도구 접기» folds everything in full screen only',()=>{
  const f=fake(['vault-full']);f.mk('boardStage');const bar=f.mk('vvBar');f.mk('vvClose',bar);const dock=f.mk('ps-command-dock');const fold=f.mk('ps-df-fold',dock);
  const api=tf.install(f.win);
  let e=f.fire('keydown',{key:'Escape'});assert.equal(e.stopped,false,'unfolded: Esc is left to the board (close)');
  e=f.fire('click',{target:fold});assert.equal(e.stopped,true,'the pill-fold is replaced');assert.equal(api.folded(),true);
  e=f.fire('click',{target:fold});assert.equal(e.stopped,false,'already folded → not ours');
  e=f.fire('keydown',{key:'a'});assert.equal(api.folded(),true);
  e=f.fire('keydown',{key:'Escape'});assert.equal(e.stopped,true);assert.equal(e.prevented,true);assert.equal(api.folded(),false,'Esc = unfold');
  /* 전체화면이 아니면 «도구 접기»는 원래 동작 */
  f.body._cls.delete('vault-full');f.mutate();
  e=f.fire('click',{target:fold});assert.equal(e.stopped,false);assert.equal(api.folded(),false);
});

test('the read-only view has no dock room to give back; the module never fights the board\'s padding watcher',()=>{
  const f=fake(['vault-full']);const stage=f.mk('boardStage');f.mk('vvBar');
  f.win.psSelBarLayout=function(){return 'laid';};const orig=f.win.psSelBarLayout;
  const api=tf.install(f.win);f.mutate();
  assert.equal(f.win.psSelBarLayout,orig,'psSelBarLayout is left alone');
  api.set(true);assert.equal('padding-bottom' in stage._style,false,'no dock → nothing written');
  api.set(false);assert.equal('padding-bottom' in stage._style,false);
  assert.doesNotMatch(require('node:fs').readFileSync(require('node:path').join(__dirname,'../studio/board-tv-fold.js'),'utf8'),/setProperty\('padding-bottom', '0px'/,'never 0 — the 2.607 watcher would rewrite it to 12 and the two would keep writing');
});

test('leaving full screen while folded clears the fold (board and shell)',()=>{
  const f=fake(['vault-full']);const stage=f.mk('boardStage');f.mk('vvBar');
  const api=tf.install(f.win);f.mutate();api.set(true);assert.equal(api.folded(),true);
  f.body._cls.delete('vault-full');stage._style={};f.mutate();
  assert.equal(api.folded(),false);assert.deepEqual(f.sent.map(m=>m.on),[true,false]);assert.equal('padding-bottom' in stage._style,false,'the board\'s own padding rules apply again');
  assert.equal(tf.install(f.win),null,'installed once');
});

test('wiring: board script after the film dock and inspector, offline cache, shell message (inline styles — no new !important rule in the shell), English, browser suite',()=>{
  assert.match(read('studio/board.html'),/<script src="board-inspector\.js"><\/script><script src="board-tv-fold\.js"><\/script>/);
  assert.match(read('sw.js'),/'\/studio\/board-tv-fold\.js'/);
  const app=read('studio/app.html');
  assert.match(app,/d\.source==='board' && \(d\.type==='vaultFull'\|\|d\.type==='tvFold'\)\)\{/);
  assert.match(app,/if\(d\.type==='vaultFull'\)\{ bc\.toggle\('vfull', !!d\.on\); if\(!d\.on\)bc\.remove\('tvfold'\); \} else bc\.toggle\('tvfold', !!d\.on\);/,'leaving full screen always clears the fold flag');
  assert.match(app,/hide\('psSideFold',vf\); hide\('psSyncStrip',vf&&bc\.contains\('tvfold'\)\);/,'the status strip is hidden only while the shell is in full screen — a stale flag cannot hide save status elsewhere');
  assert.doesNotMatch(app,/tvfold[^\n]*!important/,'no new !important rule in the shell (style ratchet) — inline setProperty instead');
  assert.ok(read('studio/i18n/en-board.js').includes('"도구 · 단추를 모두 접어 운동장만 보이게 — 다시 펴기: 아래 가운데 손잡이 · Esc"'));
  assert.ok(read('studio/i18n/en-common.js').includes('"접기"')&&read('studio/i18n/en-common.js').includes('"펴기"'));
  assert.ok(read('tests/browser/run-critical.mjs').includes("'board-tv-clean-3304'"));
});
