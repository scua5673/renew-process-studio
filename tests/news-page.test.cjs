'use strict';
/* 업데이트 소식(guide/news.html · /news) — 글은 앱의 «새 기능» 안내(studio/release-notes.js)를 그대로 읽고, 그림만 SHOTS 표로 단다.
   소개(landing.html)의 «NEW» 띠도 같은 안내의 맨 앞 소식을 읽는다. 안내를 적으면 두 곳에 저절로 실린다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const N=fs.readFileSync(path.join(root,'guide/news.html'),'utf8'),L=fs.readFileSync(path.join(root,'landing.html'),'utf8');
const notes=require('../studio/release-notes.js').entries();
function shots(){
  const m=/var SHOTS=(\{[\s\S]*?\n {2}\});/.exec(N);assert.ok(m,'SHOTS 표');
  return vm.runInNewContext('('+m[1]+')');
}

test('/news 는 소식 페이지로 — 짧은 주소 그대로(200)',()=>{
  assert.match(fs.readFileSync(path.join(root,'_redirects'),'utf8'),/^\/news\s+\/guide\/news\.html\s+200$/m);
});

test('글은 release-notes.js 에서 — 주소는 /news 에서도 맞도록 절대 경로',()=>{
  assert.match(N,/<script src="\/studio\/release-notes\.js"><\/script>/);
  assert.match(N,/PSReleaseNotes\.entries\(\)/);
  assert.match(N,/var IMG='\/guide\/img\/news\/'/);
  assert.doesNotMatch(N,/(?:src|href)="(?!\/|https:|#)[^"]+"/,'상대 경로는 /news 에서 깨진다');
});

test('SHOTS 의 항목은 실제 안내 id · 그림은 있고 배포에 실리며 가볍다',async()=>{
  const {isRuntimeFile}=await import('../scripts/package-site.mjs');
  const ids=new Set(notes.map(e=>e.id)),table=shots();
  assert.ok(Object.keys(table).length>0);
  for(const [id,list] of Object.entries(table)){
    assert.ok(ids.has(id),'없는 안내 id: '+id);
    assert.ok(Array.isArray(list)&&list.length>0,id);
    for(const s of list){
      const rel='guide/img/news/'+s.src,file=path.join(root,rel);
      assert.ok(fs.existsSync(file),rel);
      assert.ok(isRuntimeFile(rel),'배포에 실린다: '+rel);
      assert.ok(fs.statSync(file).size<=400*1024,'400KB 이하: '+rel);
      assert.ok(typeof s.cap==='string'&&s.cap.trim(),'그림 설명(대체 글): '+rel);
    }
  }
  assert.ok(isRuntimeFile('guide/news.html'));
});

test('링크 미리보기 그림은 배포되는 그림',()=>{
  const m=/<meta property="og:image" content="https:\/\/processstudio\.netlify\.app\/([^"]+)">/.exec(N);
  assert.ok(m,'og:image');assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
});

test('소개 페이지: 메뉴·바닥에 /news, «NEW» 띠는 화면이 뜬 뒤 맨 앞 소식으로',()=>{
  assert.match(L,/<nav class="links">[\s\S]*?<a href="\/news">업데이트 소식<\/a>[\s\S]*?<\/nav>/);
  assert.match(L,/<footer>[\s\S]*?<a href="\/news">업데이트 소식<\/a>[\s\S]*?<\/footer>/);
  assert.match(L,/<a class="newsbar" id="newsBar" href="\/news">/);
  const m=/<script>\n(\/\* 첫 줄의 «NEW» 띠[\s\S]*?)<\/script>/.exec(L);assert.ok(m);
  // 실제로 돌려 본다 — load 뒤 release-notes.js 를 붙이고, 읽히면 띠의 글·주소가 맨 앞 소식이 된다
  const els={newsBarT:{textContent:'업데이트 소식 보기'},newsBar:{href:'/news'}},added=[];let onload=null;
  const window={addEventListener:(t,f)=>{assert.equal(t,'load');onload=f;},PSReleaseNotes:require('../studio/release-notes.js')};
  const document={createElement:()=>({}),head:{appendChild:s=>added.push(s)},getElementById:id=>els[id]};
  vm.runInNewContext(m[1],{window,document});
  assert.equal(added.length,0,'화면이 뜨기 전에는 받지 않는다');
  onload();assert.equal(added[0].src,'/studio/release-notes.js');
  added[0].onload();
  assert.deepEqual([els.newsBarT.textContent,els.newsBar.href],[notes[0].title,'/news#'+notes[0].id]);
});
