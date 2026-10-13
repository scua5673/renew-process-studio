const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

test('3.012 the vault list keeps its scroll position when it is rebuilt (Safari clamps it to 0 while the list is empty)',()=>{
  const start=src.indexOf('var _vxSc=box.closest?box.closest(".sess-wrap"):null,_vxTop=_vxSc?_vxSc.scrollTop:0;');
  const clear=src.indexOf('box.innerHTML="";',start),settle=src.indexOf('vxSettleBar(); setTimeout(vxSettleBar,0);',start);
  const restore=src.indexOf('try{ if(_vxSc&&_vxTop&&_vxSc.scrollTop!==_vxTop)_vxSc.scrollTop=_vxTop; }catch(_){}',start);
  assert.ok(start>0,'the position is read before the list is emptied');
  assert.ok(clear>start,'… and the list is emptied after that');
  assert.ok(settle>clear&&restore>settle,'the position is put back after the rebuild and the search bar has settled');
  assert.ok(restore-start<12000,'capture and restore stay in the same rebuild');
});
