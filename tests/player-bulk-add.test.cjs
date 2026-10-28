const test=require('node:test');
const assert=require('node:assert/strict');
const bulk=require('../studio/player-bulk-add.js');

const ctx={posCodes:['GK','CB','LB','RB','DM','CM','AM','LW','RW','CF','ST'],positions:[{id:'p-gk',abbr:'GK',name:'GK'},{id:'p-cm',abbr:'CM',name:'중앙 미드필더'},{id:'p-lfb',abbr:'LFB',name:'좌측 풀백'}],groups:{'A팀':'A팀','grp_b':'B팀'},existing:[{name:'조수호',num:'79'},{name:'안종원',num:''}]};

test('붙여 넣은 명단은 탭·쉼표·여러 칸 띄움을 칸으로 보고 이름·포지션·조·등번호를 가른다',()=>{
  const rows=bulk.parsePaste('이름\t포지션\t조\t번호\n김민재 CB A팀 4\n이강인,AM,A팀,7\n손흥민\tLW\tA팀\n조규성   CF   B팀   9\n정우영 DM 3군\n\n박지성',ctx);
  assert.deepEqual(rows,[
    {name:'김민재',pos:'CB',grp:'A팀',num:'4'},{name:'이강인',pos:'AM',grp:'A팀',num:'7'},{name:'손흥민',pos:'LW',grp:'A팀',num:''},
    {name:'조규성',pos:'CF',grp:'B팀',num:'9'},{name:'정우영',pos:'DM',grp:'3군',num:''},{name:'박지성',pos:'',grp:'',num:''}]);
});
test('한 칸 띄움뿐인 줄: 아는 낱말(포지션 · 수 · 조 이름) 앞까지가 이름, 뒤의 모르는 낱말은 조',()=>{
  const rows=bulk.parsePaste('홍길동 cm 1군 10\n김철수 수비 2군\nKim Min Jae CB b팀 4\n박지성 B팀\n이영표\tLB\t수비 2군',ctx);
  assert.deepEqual(rows[0],{name:'홍길동',pos:'CM',grp:'1군',num:'10'});
  assert.deepEqual(rows[1],{name:'김철수 수비 2군',pos:'',grp:'',num:''},'아는 낱말이 없으면 통째로 이름');
  assert.deepEqual(rows[2],{name:'Kim Min Jae',pos:'CB',grp:'B팀',num:'4'},'띄어 쓴 이름 · 아는 조 이름은 대소문자 무시');
  assert.deepEqual(rows[3],{name:'박지성',pos:'',grp:'B팀',num:''});
  assert.deepEqual(rows[4],{name:'이영표',pos:'LB',grp:'수비 2군',num:''},'탭으로 자른 칸은 그대로');
});
test('계획: 같은 이름·번호는 건너뛰고, 조 이름은 키로 바꾸며, 없는 조는 한 번만 새 조로 모은다',()=>{
  const p=bulk.plan([
    {name:'김민재',pos:'CB',grp:'B팀',num:'4'},{name:'조수호',pos:'CM',grp:'A팀',num:'79'},{name:'안종원',pos:'',grp:'',num:''},
    {name:'정우영',pos:'DM',grp:'C팀',num:''},{name:'황희찬',pos:'rw',grp:'c팀',num:'11'},{name:'정우영',pos:'DM',grp:'C팀',num:''},{name:'  ',pos:'',grp:'',num:''}],ctx);
  assert.deepEqual(p.add.map(a=>[a.name,a.posId,a.grpKey,a.num]),[['김민재','','grp_b','4'],['정우영','','__new0',''],['황희찬','','__new0','11']]);
  assert.deepEqual(p.skipped.map(s=>s.name),['조수호','안종원','정우영']);
  assert.deepEqual(p.newGroups,[{key:'__new0',label:'C팀'}]);
});
test('계획: 줄의 posId·grpKey 를 그대로 쓰고, 포지션 코드는 줄임말이나 이름으로 찾는다',()=>{
  const p=bulk.plan([{name:'ㄱ',posId:'p-lfb',grpKey:'grp_b',num:''},{name:'ㄴ',pos:'lfb',grp:'',num:''},{name:'ㄷ',pos:'중앙 미드필더',grp:'',num:''},{name:'ㄹ',pos:'ZZ',grp:'',num:''}],ctx);
  assert.deepEqual(p.add.map(a=>a.posId),['p-lfb','p-lfb','p-cm','']);
  assert.equal(p.add[0].grpKey,'grp_b');
});
test('붙여 넣기는 60줄까지만 받는다',()=>{
  const rows=bulk.parsePaste(Array.from({length:70},(_,i)=>'선수'+i).join('\n'),ctx);
  assert.equal(rows.length,bulk.MAX);
});
