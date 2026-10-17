'use strict';
/* 3.077 — 사용자 «더 고급지게 · 3d 느낌으로» → «둘다 적용하고 고를 수 있게 · 다크모드도» */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sk=require('../studio/board-dock-skin.js');
const mem=()=>{const m={};return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);}};};

test('skins: auto follows dark mode (bevel in light, glass in dark); unknown values fall back to auto',()=>{
  assert.deepEqual(sk.SKINS,['auto','glass','bevel','flat']);
  assert.equal(sk.resolve('auto',false),'bevel');assert.equal(sk.resolve('auto',true),'glass');
  assert.equal(sk.resolve('glass',false),'glass');assert.equal(sk.resolve('flat',true),'flat');
  const ls=mem();assert.equal(sk.readSkin(ls),'auto');ls.setItem(sk.STORE,'nope');assert.equal(sk.readSkin(ls),'auto');ls.setItem(sk.STORE,'glass');assert.equal(sk.readSkin(ls),'glass');
});
test('css: each skin is scoped to the floating dock, bevel and flat get their own dark-mode look',()=>{
  const c=sk.css();
  assert.match(c,/body\.ps-dock-float\.ps-skin-glass #ps-command-dock/);
  assert.match(c,/body\.ps-dock-float\.ps-skin-bevel:not\(\.fmdark\) #ps-command-dock/);
  assert.match(c,/body\.ps-dock-float\.ps-skin-bevel\.fmdark #ps-command-dock/);
  assert.match(c,/body\.ps-dock-float\.ps-skin-flat\.fmdark #ps-command-dock/);
  assert.doesNotMatch(c,/ps-skin-flat:not\(\.fmdark\)/,'«기본» in light mode stays exactly as before');
  assert.match(sk.skinCSS('glass'),/#toolSeg>button\.on[^{]*\{[^}]*linear-gradient\(180deg,#3E6BFF/,'glossy raised active tool');
  assert.match(c,/body:not\(\.ps-dock-float\) #dockSkinRow/,'the setting only shows with the floating dock');
});
test('wiring: script tag, offline cache, storage key',()=>{
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),/<script src="board-dock-skin\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-dock-skin\.js'/);
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/storage-keys.js'),'utf8'),/\['ps_dock_skin_v1','device','ls','pref','board-dock-skin\.js'\]/);
});
