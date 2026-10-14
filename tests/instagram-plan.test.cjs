const test=require('node:test');
const assert=require('node:assert/strict');

// 인스타 자동 제작(instagram/) — 요일별 종류, 배포 안내 범위, 주제 순번, post.json 검사. 브라우저는 띄우지 않는다.
const load=()=>Promise.all([import('../instagram/plan.mjs'),import('../instagram/render.mjs')]);
const entry=(date,title)=>({id:date+'-'+title,date,title,changes:['바뀐 점']});

test('weekday decides the kind (KST week starting 2026-10-12)',async()=>{
  const [{plan}]=await load();
  const kinds=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'].map(d=>plan(d,{entries:[entry('2026-10-13','a'),entry('2026-10-15','b')]}).kind);
  assert.deepEqual(kinds,['feature','term','update','howto','term','update','howto']);
});

test('update days gather the release notes since the previous update day',async()=>{
  const [{plan}]=await load();
  const entries=[entry('2026-10-09','old'),entry('2026-10-10','sat'),entry('2026-10-13','tue'),entry('2026-10-14','wed'),entry('2026-10-16','fri'),entry('2026-10-17','sat2')];
  const wed=plan('2026-10-14',{entries});
  assert.equal(wed.kind,'update');assert.deepEqual(wed.update.window,{from:'2026-10-10',to:'2026-10-13'});
  assert.deepEqual(wed.update.entries.map(e=>e.title),['sat','tue'],'Wednesday covers Saturday..Tuesday, not today');
  const sat=plan('2026-10-17',{entries});
  assert.deepEqual(sat.update.entries.map(e=>e.title),['wed','fri'],'Saturday covers Wednesday..Friday');
});

test('an update day without release notes becomes a feature post',async()=>{
  const [{plan}]=await load();
  const b=plan('2026-10-17',{entries:[]});
  assert.equal(b.kind,'feature');assert.ok(b.topic&&b.topic.id);assert.match(b.note,/배포 안내가 없어/);
});

test('topics do not repeat before the bank is used up',async()=>{
  const [{plan,addDays,loadTopics}]=await load();
  const topics=loadTopics(),seen={feature:[],howto:[],term:[]};
  for(let i=0;i<7*20;i++){const b=plan(addDays('2026-10-12',i),{entries:[]});const id=b.topic?b.topic.id:b.term&&b.term.id;if(id)seen[b.kind].push(id);}
  for(const k of ['feature','howto']){const first=seen[k].slice(0,topics[k].length);assert.equal(new Set(first).size,first.length,k+' repeats too early: '+first.join(','));}
  const terms=seen.term.slice(0,40);assert.equal(new Set(terms).size,terms.length,'terms repeat too early');
});

test('every topic image reference resolves',async()=>{
  const [{loadTopics},{resolveImage}]=await load();
  const t=loadTopics();
  for(const item of [...t.feature,...t.howto])for(const ref of item.images||[])assert.doesNotThrow(()=>resolveImage(ref,'2026-10-14'),item.id+' → '+ref);
});

test('post.json checks: Instagram hashtag cap, layouts, images',async()=>{
  const [,{validate,finalCaption,MAX_HASHTAGS}]=await load();
  const ok={slides:[{layout:'cover',title:'제목',image:'shot:board-3d'},{layout:'cta'}],caption:'첫 줄',hashtags:['#프로세스스튜디오','#축구전술']};
  assert.deepEqual(validate(ok,'2026-10-14'),[]);
  assert.equal(finalCaption(ok),'첫 줄\n\n#프로세스스튜디오 #축구전술');
  const six={...ok,caption:'첫 줄 #하나',hashtags:['#a','#b','#c','#d','#e']};
  assert.ok(validate(six,'2026-10-14').some(e=>e.includes(MAX_HASHTAGS+'개까지')),'hashtags in the caption body count toward the cap');
  const bad={slides:[{layout:'poster',title:'x'},{layout:'shot',title:'y',image:'shot:nope'},{layout:'term',ko:'용어'}],caption:'c',hashtags:['no hash']};
  const errs=validate(bad,'2026-10-14').join('\n');
  assert.match(errs,/layout/);assert.match(errs,/없는 장면/);assert.match(errs,/ko·def/);assert.match(errs,/해시태그 모양/);
  assert.throws(()=>validate({slides:[{layout:'shot',title:'x',image:'guide:../../secret.png'}],caption:'c',hashtags:[]},'2026-10-14').forEach(e=>{throw Error(e);}),/이상합니다/);
});
