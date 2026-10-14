const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.029 — 사용자 «엘미하꺼는 이름 보이게». 커뮤니티에 올리는 판은 2.668 부터 선수 이름을 비운다(공개 글 · 유소년 실명).
   엘미하 계정(ELM_UID)이 올리거나 고치는 글만 이름을 남긴다 — 전술노트는 영상과 같은 선수 이름으로 읽힌다. 사진은 엘미하 글도 뺀다.
   같은 stripSnap 을 프로세스 팩(procItem)도 쓰므로, 엘미하 글을 짓는 동안만 켜고 곧바로 끈다. */
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const STRIP=cut(comm,'var __pubNames=[];','function openUpload(){');
const ELM=/var ELM_UID='([0-9a-f-]{36})'/.exec(comm)[1];
function strip(){ const c=vm.createContext({ELM_UID:ELM}); vm.runInContext(STRIP+';this.api={stripSnap,stripTrainings,stripThumbNames,pubKeepNames,names:function(){return __pubNames;},keep:function(v){__pubKeepNames=v;}};',c); return c.api; }
const snap=(name,k)=>({players:[{id:1,team:'blue',num:'7',name,x:100+k,y:200},{id:2,team:'img',src:'data:image/png;base64,AAAA',x:5,y:5}],customImages:[{src:'data:image/png;base64,BBBB'}]});

test('only the elmiha account keeps names — everyone else, and nobody signed in, still loses them',()=>{
  const g=strip();
  assert.equal(g.pubKeepNames({uid:ELM}),true);
  for(const me of [{uid:'22222222-2222-4222-8222-222222222222'},{uid:''},{},null,undefined])assert.equal(g.pubKeepNames(me),false,JSON.stringify(me));
});

test('an elmiha post keeps every player name — on the board, in each training and in each scene — but never a photo',()=>{
  const g=strip();
  g.keep(true);
  const s=plain(g.stripSnap(snap('손흥민',0)));
  const t=plain(g.stripTrainings({trainings:[{name:'전술노트',snap:snap('이강인',0),thumb:'<svg><text>이강인</text></svg>',frames:[{snap:snap('이강인',0)},{snap:snap('이강인',10)}]}]}));
  g.keep(false);
  assert.deepEqual(s.players.map(p=>[p.team,p.name||'','src' in p]),[['blue','손흥민',false],['blue','',false]],'이름은 남고 사진 토큰은 빠진다');
  assert.deepEqual(s.customImages,[]);
  assert.deepEqual(t[0].frames.map(f=>f.snap.players[0].name),['이강인','이강인'],'장면마다 이름 그대로');
  assert.equal(t[0].snap.players[0].name,'이강인');
  assert.equal(t[0].thumb,'<svg><text>이강인</text></svg>','그림의 이름도 그대로');
  assert.deepEqual(plain(g.names()),[],'지울 이름을 모으지 않는다');
  assert.equal(JSON.stringify([s,t]).includes('data:image'),false);
});

test('switched off again, the same functions strip names as before (process packs, other coaches)',()=>{
  const g=strip();
  const s=plain(g.stripSnap(snap('김가상',0)));
  assert.equal(s.players[0].name,'');assert.deepEqual(plain(g.names()),['김가상']);
});

test('the flag is set only while an elmiha post is built, and always switched off right after',()=>{
  assert.match(comm,/var __pubKeepNames=false;\nfunction pubKeepNames\(me\)\{ return !!\(me&&me\.uid&&me\.uid===ELM_UID\); \}/);
  assert.match(comm,/if\(!__pubKeepNames&&pl\.name&&String\(pl\.name\)\.trim\(\)\)\{/);
  assert.equal((comm.match(/__pubKeepNames=pubKeepNames\(/g)||[]).length,2,'new upload and edit');
  assert.match(comm,/__pubKeepNames=pubKeepNames\(me\);[^\n]*\n      try\{\n[\s\S]*?\}finally\{ __pubKeepNames=false; \}\n      var body=\{/,'upload: on → build → off');
  assert.match(comm,/__pubKeepNames=pubKeepNames\(meU\);[^\n]*\n    try\{\n[\s\S]*?\}finally\{ __pubKeepNames=false; \}\n    var patch=\{item:item\};/,'edit: on → build → off');
  assert.equal((comm.match(/__pubKeepNames=false;/g)||[]).length,3,'declared off, and switched off after each build');
  assert.match(comm,/\(pubKeepNames\(me\)\?'사진은 자동으로 빠지고, <b>선수 이름은 그대로 보여요<\/b>\(엘미하 계정\)\. ':'사진은 자동으로 빠져요\. '\)/,'the upload dialog says so');
});
