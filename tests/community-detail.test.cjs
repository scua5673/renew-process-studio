const test=require('node:test');
const assert=require('node:assert/strict');
const {model}=require('../studio/community-detail.js');
test('selected training owns its text and metadata; the shared source stays intact',()=>{
  const p={title:'세션 제목',owner_name:'코치',summary:'공유 소개',item:{minutes:60,trainings:[{name:'선택한 훈련',minutes:15,method:'목적\n패스 길 찾기\n\n난이도 조절\n쉽게 — 공간을 넓힌다.',coaching:'받기 전 확인',setup:'크기 12 × 12m · 인원 4v2 (한 조 6명)',prog:'수비 한 명 추가'}]}};
  const before=JSON.stringify(p),m=model(p,{age:'U12',players:'6'});
  assert.equal(m.title,'선택한 훈련');assert.equal(m.sessionTitle,'세션 제목');
  assert.ok(m.panels.description.some(r=>r.text==='목적\n패스 길 찾기'));
  assert.deepEqual(m.panels.coaching,[{label:'코칭 포인트',text:'받기 전 확인'}]);
  assert.deepEqual(m.panels.progressions.map(r=>r.text),['수비 한 명 추가','쉽게 — 공간을 넓힌다.']);
  assert.deepEqual(m.facts.map(r=>r.value),['U12','6명','15분','12 × 12 m']);
  assert.equal(JSON.stringify(p),before);
});
test('unknown facts are omitted rather than guessed from drawn players or cones',()=>{
  const m=model({title:'작전판',item:{snap:{players:[{pos:'GK'}],pitchSpec:'grid30'},overview:'<img src=x onerror=alert(1)>'}});
  assert.deepEqual(m.facts,[]);assert.equal(m.panels.description[0].text,'<img src=x onerror=alert(1)>');
  assert.deepEqual(m.panels.coaching,[]);assert.deepEqual(m.panels.progressions,[]);
});
test('actual bundled training methods and coaching remain available in every session',()=>{
  const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'../studio/packs');
  const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json')));
  for(const row of index.sessions){
    const pack=JSON.parse(fs.readFileSync(path.join(dir,String(row.n).padStart(2,'0')+'.json')));
    for(const t of pack.drills[0].trainings){
      const m=model({title:row.session,item:{trainings:[t]}});
      const shown=Object.values(m.panels).flat().map(r=>r.text).join('\n');
      assert.ok(shown.includes(t.coaching.trim()),t.name+' coaching retained');
      for(const line of t.method.split('\n').map(s=>s.trim()).filter(s=>s&&!/^(난이도 조절|응용·발전|응용 및 발전|발전)$/.test(s)))assert.ok(shown.includes(line),t.name+' method retained: '+line);
    }
  }
});
