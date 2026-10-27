'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

function pdfFit(){
  const start=board.indexOf('function pdfFullBoardSVG(svg){');
  const end=board.indexOf('\nfunction printThumb(',start);
  assert.ok(start>=0&&end>start,'PDF 전체 판 함수');
  const c={};vm.createContext(c);vm.runInContext(board.slice(start,end),c);return c.pdfFullBoardSVG;
}

test('PDF restores the full saved board instead of the content-fit thumbnail crop',()=>{
  const fit=pdfFit();
  const svg='<svg class="board" viewBox="0 535 603.3 471.2" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" data-psfit="1" data-psvb="0 535 740 577.93"><g/></svg>';
  const out=fit(svg);
  assert.match(out,/viewBox="0 535 740 577\.93"/);
  assert.match(out,/preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(out,/viewBox="0 535 603\.3 471\.2"/);
});

test('PDF leaves ordinary and malformed SVG view boxes unchanged',()=>{
  const fit=pdfFit();
  const plain='<svg viewBox="0 0 1110 740"><g/></svg>';
  const bad='<svg viewBox="1 2 3 4" data-psvb="bad"><g/></svg>';
  assert.equal(fit(plain),plain);assert.equal(fit(bad),bad);
});

test('training PDF sanitizes after restoring the full board',()=>{
  assert.match(board,/return PSSafe\.svg\(pdfFullBoardSVG\(t\|\|\(\(s&&s\.thumb\)\|\|""\)\)\)/);
});
