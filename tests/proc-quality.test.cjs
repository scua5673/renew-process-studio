const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..'),dir=path.join(root,'studio/packs');
const all=[];
for(let n=2;n<=46;n++){
 const p=JSON.parse(fs.readFileSync(path.join(dir,String(n).padStart(2,'0')+'.json'))),d=p.drills[0];
 d.trainings.forEach((t,i)=>all.push({id:String(n).padStart(2,'0')+'-'+(i+1),t,d}));
}
const get=id=>all.find(r=>r.id===id).t;
test('all 135 practices have complete, distinct and copy-safe coaching manuscripts',async()=>{
 const {profiles}=await import('../scripts/proc-quality.mjs');
 assert.equal(all.length,135);assert.equal(Object.keys(profiles).length,135);
 assert.equal(new Set(Object.values(profiles).map(p=>p.question)).size,135,'questions are written for each practice');
 assert.equal(new Set(Object.values(profiles).map(p=>p.change)).size,135,'adjustments are written for each practice');
 for(const {id,t} of all){
  for(const h of ['목적\n','준비\n','진행·득점\n','재시작·교대 · 운영 보완\n','난이도 조절\n','쉽게 —','어렵게 —'])assert.ok(t.method.includes(h),id+' '+h);
  for(const h of ['관찰 단서\n','핵심 지도\n','현장 개입 · 운영 보완\n','질문 —','한 가지 조정 —','재시도 —','다시 확인\n'])assert.ok(t.coaching.includes(h),id+' '+h);
  assert.ok(t.method.length<=4000&&t.coaching.length<=4000,id+' cannot be truncated on library import');
  assert.equal(t.practiceQuality.id,id);
  assert.equal((t.method.match(/재시작·교대 · 운영 보완/g)||[]).length,1,id+' no appended duplicates');
 }
});
test('source text is independently retained, operational additions do not masquerade as source',()=>{
 const src=JSON.parse(fs.readFileSync(path.join(root,'scripts/proc-practices-source.json'))).practices;
 for(const {id,t,d} of all){assert.equal(src[id].name,t.name);assert.ok(src[id].method.length>300&&src[id].coaching.length>100);assert.equal(d.letter.issue,+id.slice(0,2));assert.ok(t.method.includes('운영 보완')&&t.coaching.includes('운영 보완'));}
 assert.match(src['20-2'].method,/한 조 3명/);assert.match(get('20-2').method,/필드 3명 \+ GK 1명/,'arithmetic corrected with preserved source');
 assert.doesNotMatch(get('02-2').coaching,/모두 다섯 걸음/,'fixed-zone roles cannot all follow');
 assert.match(get('44-2').method,/공격은 총 다섯 명/,'thrower counts in the five');
});
test('authored restart rules preserve the exercise instead of silently changing it',()=>{
 const expect={
  '05-2':'나간 자리에서','07-3':'공격 팀 8번','08-2':'실점 조가 나가고','08-3':'언제나 앞선 팀 골키퍼',
  '09-3':'언제나 상대 센터백','12-3':'언제나 공격 팀 6번','13-3':'스로인·코너킥·골킥',
  '16-1':'코치가 가운데에 새 공','23-3':'발로 차 넣고','28-3':'언제나 공격 팀 4번','46-1':'탈취 즉시 차례를 끊지 않고'};
 for(const [id,text] of Object.entries(expect))assert.ok(get(id).method.split('재시작·교대 · 운영 보완')[1].includes(text),id+' restart');
});
test('physical goal orientation and original explicit widths are correct in every frame',()=>{
 let goals=0;
 for(const {id,t,d} of all){
  for(const f of t.frames){
   const s=f.snap;
   for(const g of s.equipment.filter(g=>/goal/.test(g.team))){
    assert.equal(g.anchor,'mouth',id);assert.equal(g.scale,1,id);assert.ok(g.mouthWidth>0&&g.mouthDepth>0,id);
    assert.ok([0,180].includes(g.rot),id);goals++;
   }
   assert.ok(s.players.every(p=>String(p.num||'').trim()),id+' identities persist');
   assert.ok(s.drawings.every(d=>(d.pts||[]).every(p=>p.x>=0&&p.x<=1110&&p.y>=0&&p.y<=740)),id+' no clipped static diagrams');
  }
  assert.deepEqual(d.snap,d.trainings[0].snap,id+' representative snapshot matches training');
 }
 assert.ok(goals>1500);
 assert.deepEqual(get('09-2').snap.equipment.filter(g=>/goal/.test(g.team)).map(g=>[g.x,g.rot]),[[375,180],[375,180]],'left goals face into the pitch');
 assert.equal(get('04-3').snap.equipment.find(g=>g.team==='goalV').mouthWidth,50,'the stated 5m goal remains 5m');
 assert.equal(get('23-3').snap.equipment.find(g=>g.team==='goalV').mouthWidth,70,'the stated 3m goal remains 3m on grid45');
 assert.equal(get('46-1').snap.equipment.find(g=>g.team==='goalV').x,298.33,'the goal mouth sits on the field boundary');
});
test('autonomy, return-to-training limits, and recording operations remain intentional',()=>{
 for(const id of ['15-3','16-1','26-2','26-3','34-1','34-2','34-3'])assert.match(get(id).coaching,/판 도중에는 해답을 주지 않는다/);
 for(const id of ['22-1','22-2','22-3'])assert.match(get(id).method,/담당/);
 assert.doesNotMatch(get('18-1').method,/처음 다섯 판은 8번이 공만 보고/,'opposed play keeps direct perception');
 for(const f of get('41-1').frames)assert.deepEqual(f.snap.players.find(p=>p.id===301).x,330,'recorder stays outside during live play');
 for(const id of ['41-1','41-2','41-3'])assert.match(get(id).method,/다음 시작 전에 치/);
 assert.match(get('41-1').method,/공격 세 번, 수비 두 번, 기록 한 번/);
});
