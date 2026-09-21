'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/board2474.html'),'utf8');
function setup(id,players=[{id:'a',name:'원래',num:'7'}]){
 const start=source.indexOf('(function(){const ni=$("'+id+'")'),end=source.indexOf('})();',start)+5;
 assert.ok(start>=0&&end>start);
 const handlers={},counts={blur:0,paint:0,sync:0};
 const input={value:'',addEventListener(k,fn){handlers[k]=fn;},blur(){counts.blur++;fire('blur');}};
 function fire(k,props={}){const e={prevented:false,preventDefault(){this.prevented=true;},...props};handlers[k]?.(e);return e;}
 vm.runInNewContext(source.slice(start,end),{$:()=>input,selectedPlayers:()=>players,syncNameToScenes(){counts.sync++;},renderTokens(){counts.paint++;},updateDelUI(){},positionSelCtl(){},boardSaveLive(){},pushUndo(){},clearTimeout(){},setTimeout(){return 1;}});
 fire('focus');return {input,players,counts,fire};
}
for(const id of ['nameInput','numInput']){
 for(const mode of ['composition-state','isComposing','keyCode229'])test(id+' leaves IME Enter to browser: '+mode,()=>{
  const h=setup(id);h.input.value=id==='nameInput'?'이슬기':'김';
  if(mode==='composition-state')h.fire('compositionstart');
  h.fire('input');const before=h.counts.paint;
  const e=h.fire('keydown',{key:'Enter',...(mode==='isComposing'?{isComposing:true}:mode==='keyCode229'?{keyCode:229}:{})});
  assert.equal(e.prevented,false);assert.equal(h.counts.blur,0);assert.equal(h.counts.paint,before);
 });
 test(id+' composition commit then ordinary Enter finalizes once',()=>{
  const h=setup(id);h.fire('compositionstart');h.input.value=id==='nameInput'?'황진성':'김';h.fire('input');h.fire('keydown',{key:'Enter',isComposing:true});h.fire('compositionend');h.fire('input');
  assert.equal(h.counts.blur,0);const e=h.fire('keydown',{key:'Enter'});assert.equal(e.prevented,true);assert.equal(h.counts.blur,1);assert.equal(h.players[0][id==='nameInput'?'name':'num'],h.input.value);
 });
 test(id+' focus and Enter do not overwrite a multiple selection',()=>{
  const players=[{id:'a',name:'하나',num:'1'},{id:'b',name:'둘',num:'2'}],before=JSON.stringify(players),h=setup(id,players);
  h.fire('keydown',{key:'Enter'});assert.equal(JSON.stringify(players),before);
 });
}
test('name edit applies complete Hangul to each selected player and scenes',()=>{
 const h=setup('nameInput',[{id:'a',name:'a'},{id:'b',name:'b'}]);h.fire('compositionstart');h.input.value='이슬기';h.fire('input');h.fire('compositionend');h.fire('keydown',{key:'Enter'});
 assert.deepEqual(h.players.map(p=>p.name),['이슬기','이슬기']);assert.equal(h.counts.sync,2);
});
