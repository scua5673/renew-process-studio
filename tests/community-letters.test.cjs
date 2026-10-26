const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../studio/community-letters.js');
const dir=path.join(__dirname,'../studio/letters');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,String(n).padStart(2,'0')+'.json'),'utf8'));
const index=L.indexRead(JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8')));

test('all 46 prepared letters have their complete original body, including 1 without training',()=>{
  assert.deepEqual(index.map(x=>x.number),Array.from({length:46},(_,i)=>i+1));
  for(const entry of index){
    const body=read(entry.number);assert.equal(body.number,entry.number);assert.equal(body.title,entry.title);
    assert.equal(body.pieces.length,3);assert.ok(body.intro.length);assert.ok(body.closing.length);
    const html=L.article(body);
    for(const text of [...body.intro,...body.closing,body.quote.ko,body.quote.en])assert.ok(html.includes(L.rich(text)));
    for(const p of body.pieces){assert.ok(html.includes(L.rich(p.lead)));for(const point of p.points)assert.ok(html.includes(L.rich(point)),`letter ${entry.number} must retain every paragraph`);}
    if(body.training){
      const pack=JSON.parse(fs.readFileSync(path.join(dir,'../packs',String(entry.number).padStart(2,'0')+'.json'),'utf8'));
      assert.equal(pack.drills[0].letter.issue,entry.number);assert.equal(pack.drills[0].trainings.length,body.training.exercises.length);
      const t=body.training;
      for(const text of [...t.intro,t.action])assert.ok(html.includes(L.rich(text)));
      if(t.why){
        for(const text of [t.why.scene,t.why.reason,t.why.after])assert.ok(html.includes(L.rich(text)));
        for(const evidence of t.why.evidence)for(const field of ['text','title','by'])assert.ok(html.includes(L.rich(evidence[field])),`letter ${entry.number} retains the training evidence ${field}`);
      }
      for(const e of body.training.exercises){for(const step of e.steps)assert.ok(html.includes(L.rich(step)));for(const point of e.cp)assert.ok(html.includes(L.rich(point[2])));}
    }
  }
  assert.equal(read(1).training,undefined);
  assert.match(L.article(read(1)),/연결된 훈련 세션이 없습니다/);
  assert.match(L.article(read(46)),/data-letter-play="46"/,'future-dated letters are explicitly included by user choice');
});

test('search covers issue number, letter, article and exercise titles; ordering retains all entries',()=>{
  assert.equal(L.select(index)[0].number,1,'the default is issue 1 first');
  assert.equal(L.select(index,'','new')[0].number,46);assert.equal(L.select(index,'','old')[0].number,1);
  assert.equal(L.select(index,'3호','old')[0].number,3);
  for(const query of [read(3).title,read(3).pieces[0].title,read(3).training.exercises[0].title])assert.ok(L.select(index,query).some(x=>x.number===3));
  assert.equal(L.select(index,'__없는_문장__').length,0);assert.equal(index[0].number,1,'sorting does not mutate the source');
});

test('reading history survives reload, merges other tabs, and separates signed-in and guest readers',()=>{
  const rows=new Map(),storage=()=>({getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)});
  let uid='coach-a';const options={storage,owner:()=>uid};
  const a=L.readHistory(options),b=L.readHistory(options);
  assert.deepEqual(a.list(),[]);assert.equal(a.mark(1,a.owner()),true);
  assert.deepEqual(L.readHistory(options).list(),[1]);
  b.mark(2,b.owner());a.mark(3,a.owner());assert.deepEqual(L.readHistory(options).list(),[1,2,3]);
  const originalOwner=a.owner();uid='coach-b';
  assert.deepEqual(a.list(),[]);assert.equal(a.mark(4,originalOwner),false,'a response from the previous reader is discarded');
  a.mark(5,a.owner());assert.deepEqual(a.list(),[5]);
  uid=null;assert.deepEqual(a.list(),[]);a.mark(6,a.owner());assert.deepEqual(a.list(),[6]);
  uid='coach-a';assert.deepEqual(a.list(),[1,2,3]);
});

test('invalid or unavailable reading storage does not break the reader',()=>{
  let raw='{"bad":"shape"}';const options={owner:()=>null,storage:()=>({getItem:()=>raw,setItem:(_,v)=>raw=v})};
  assert.deepEqual(L.readHistory(options).list(),[]);
  raw='not json';const h=L.readHistory(options);assert.deepEqual(h.list(),[]);
  raw='[1,1,2,"3",0,-1,1000,null]';assert.deepEqual(h.list(),[1,2]);
  for(const n of [0,-1,1.5,1000,'3'])assert.equal(h.mark(n,h.owner()),false);
  const blocked=L.readHistory({storage:()=>{throw Error('blocked');}});
  assert.doesNotThrow(()=>blocked.mark(7,blocked.owner()));assert.deepEqual(blocked.list(),[7]);
});

test('reading markup preserves simple emphasis while refusing executable markup and URL schemes',()=>{
  assert.equal(L.rich('<b>본문</b><br><img src=x onerror=alert(1)>'),'<b>본문</b><br>&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(L.href('javascript:alert(1)'),'');assert.equal(L.href('data:text/html,evil'),'');
  const d=structuredClone(read(3));d.title='<script>evil()</script>';d.pieces[0].src_url='javascript:evil()';d.pieces[0].points.push('<svg onload=evil()>');
  const html=L.article(d);assert.doesNotMatch(html,/<script>|<svg|href="javascript:/);assert.match(html,/&lt;script&gt;/);
});

test('the index rejects malformed rows and duplicate issue numbers',()=>{
  assert.throws(()=>L.indexRead({}));
  assert.deepEqual(L.indexRead({issues:[null,{number:'3',title:'x'},index[0],index[0],{number:-1,title:'x'}]}),[index[0]]);
});
