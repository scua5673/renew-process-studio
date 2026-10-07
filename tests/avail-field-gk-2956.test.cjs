'use strict';
/* 2.956 — 가용인원 날짜별 명단: 조 머리마다 «필드 n · GK n»(사용자 «필드와 GK 구별해줘 · 조별로 전부»). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SC=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function fn(name){const a=SC.indexOf('function '+name+'(');const b=SC.indexOf('\nfunction ',a+10);return SC.slice(a,b);}

test('field/GK split helper: same GK rule as the cockpit, hidden in position view and when nobody is counted',()=>{
  const c=vm.createContext({availView:'grp',avPosition:p=>p.pos});
  vm.runInContext(fn('avIsGk')+'\n'+fn('avFieldGk'),c);
  assert.equal(c.avIsGk({pos:'GK'}),true);assert.equal(c.avIsGk({pos:'골키퍼'}),true);assert.equal(c.avIsGk({pos:'CB'}),false);assert.equal(c.avIsGk({pos:''}),false);
  assert.equal(c.avFieldGk(19,2),'<span class="fgk">필드 <b>17</b> · GK <b>2</b></span>');
  assert.equal(c.avFieldGk(0,0),'');
  c.availView='pos';assert.equal(c.avFieldGk(5,1),'','포지션별 보기는 묶음이 곧 포지션');
});

test('every group header (desktop and phone «운동») carries the split; the count matches that header',()=>{
  const body=fn('renderAvailDaily');
  assert.ok(body.includes("'명</span>'+avFieldGk(participating,okGk)+'</div>"),'데스크톱 조 머리 = 가능(참여) 인원');
  assert.ok(body.includes("'명</span>'+avFieldGk(okN,splitGk)+'</div>"),'폰 «운동» 조 머리 = 쉼이 아닌 인원');
  assert.ok(/if\(_gk&&r\.s==='ok'\)okGk\+\+; if\(_gk&&!\(r\.s&&r\.s!=='ok'\)\)splitGk\+\+;/.test(body));
  assert.ok(/else if\(r\.s==='ok'\)\{if\(_gk\)rc\.gk\+\+;else rc\.field\+\+;\}/.test(body),'세션 만들기로 넘기는 인원과 같은 판정');
});
