'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
function part(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return source.slice(i,j);}
function harness(){
 const nodes=new Map(),classes=()=>({s:new Set(),contains(k){return this.s.has(k);},add(k){this.s.add(k);},remove(k){this.s.delete(k);},toggle(k,on){if(on)this.s.add(k);else this.s.delete(k);}});
 function node(id=''){const attrs=new Map();return{id,style:{},dataset:{},classList:classes(),inert:false,setAttribute:(k,v)=>attrs.set(k,v),hasAttribute:k=>attrs.has(k),removeAttribute:k=>attrs.delete(k),remove(){nodes.delete(this.id);},querySelector:()=>({}),contains:()=>false};}
 for(const id of ['boardView','sessionView','drillLib','editorModal','vaultBar','drillFiles'])nodes.set(id,node(id));
 const c={document:{body:node(),documentElement:{dataset:{}},getElementById:id=>nodes.get(id)||null,createElement:()=>node(),querySelectorAll:()=>[]},parent:{postMessage(){}},$:id=>nodes.get(id)||null,
  _vaultBoardContext:null,_liveBoardAnimOpen:null,psVaultUnlocked:()=>false,psIsTeamWs:()=>false,csHintSeen:()=>true,libFilter:{},wbCloseText(){},boardFlushLive(){},renderLibDock(){},renderDrawings(){},exitMatch(){},boardSaveLive(){},captureSnap:()=>({players:[]})};
 c.document.body.appendChild=n=>nodes.set(n.id,n);c.window=c;c.__csView='board';vm.createContext(c);
 vm.runInContext(part('function psVaultInert(on){','/* 숨은 보관함도 부팅 중 다시 그려진다.')+part('function setView(v){','/* ===== 경기 모드'),c);
 c.renderSession=()=>c.psVaultRequireLogin();return{c,nodes};
}
test('guest can leave a locked vault repeatedly without reload; re-entry stays locked',()=>{
 const {c,nodes}=harness();
 for(let i=0;i<3;i++){
  c.setView('session');assert.ok(nodes.has('psVaultAuthLock'));assert.equal(nodes.get('boardView').inert,true);
  c.setView('board');assert.equal(c.__csView,'board');assert.equal(nodes.has('psVaultAuthLock'),false,'vault overlay must leave the canvas');assert.equal(nodes.get('boardView').inert,false);assert.equal(nodes.get('boardView').hasAttribute('aria-hidden'),false);
  assert.equal(c.psVaultUnlocked(),false,'navigation never grants library access');
 }
});
test('late locked-vault render cannot cover the board again',()=>{const{c,nodes}=harness();c.setView('session');c.setView('board');c.psVaultShowLock();assert.equal(nodes.has('psVaultAuthLock'),false);assert.equal(nodes.get('boardView').inert,false);});
