'use strict';
/* 2.970 — 미팅: 한 장의 토큰 이름 → 모든 장 · 세로형 먼저 · BEST 11 운동장 전체 · 슬라이드 MP4(장면 슬라이드는 장면대로) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const J=x=>JSON.parse(JSON.stringify(x));

test('a name typed on one slide reaches the same player (team + number) on every slide and scene, not the other team',()=>{
  const code=slice('  window.__meetSyncNames=function(p){','  window.__meet={');
  const T=n=>({team:'blue',num:'7',id:n}),R=n=>({team:'red',num:'7',id:n});
  const s1={snap:{players:[T(1007),R(1018)]}},s2={snap:{players:[T(1007),R(1018)]},frames:[{snap:{players:[T(1007)]},thumb:'a'},{snap:{players:[T(1007)]},thumb:'b'}]},s0={snap:{players:[Object.assign(T(1007),{name:'김민수'})]}};
  const lineup={snap:{players:[{team:'blue',num:'17',id:1007}]}};   /* 경기 «선발 11»: 같은 id 지만 다른 선수 */
  const c={document:{body:{classList:{contains:k=>k==='meet-mode'}}},anim:{slides:[s0,s1,s2,lineup],frames:[]},meetBound:null,meetIdx:0,window:{__snapToThumb:()=>'T'},toast(){},boardSaveLive(){},String};
  vm.createContext(c);vm.runInContext('var meetBound=null,meetIdx=0;'+code,c);
  assert.equal(c.window.__meetSyncNames({team:'blue',num:'7',id:1007,name:'김민수'}),2);
  assert.equal(s1.snap.players[0].name,'김민수');assert.equal(s1.snap.players[1].name,undefined,'red #7 untouched');
  assert.ok(s2.frames.every(f=>f.snap.players[0].name==='김민수'),'every scene of a scene slide');
  assert.equal(s2.frames[0].thumb,'a');assert.equal(s2.frames[1].thumb,undefined,'later scene thumbs are redrawn');
  assert.equal(lineup.snap.players[0].name,undefined,'a different number with the same id is not renamed');
  assert.equal(s1.thumb,'T');
  c.window.__meetSyncNames({team:'blue',num:'7',id:1007,name:null});
  assert.equal(s1.snap.players[0].name,null,'clearing a name clears it everywhere');
});

test('BEST 11 spans the whole pitch evenly; a match lineup is spread the same way',()=>{
  const best=slice('    {t:"BEST 11",','    {t:"하이블록",');
  const us=JSON.parse(best.match(/us:(\[\[[^\n]*\]\]),/)[1]);
  const xs=us.map(p=>p[0]);
  assert.ok(Math.max(...xs)-Math.min(...xs)>=80,'GK to forwards ≥ 80m');
  assert.deepEqual([...new Set(xs.slice(1,5))],[26],'back four on one line');
  const c={Object,Math,String,isFinite};vm.createContext(c);vm.runInContext(slice('  function meetSpreadLineup(sp){','  function meetSnapFromPct(base,sp){'),c);
  const sp={title:'선발 11',us:[{x:8,y:50,gk:true},{x:20,y:20},{x:20,y:80},{x:40,y:50},{x:62,y:30},{x:62,y:70}]};
  const out=c.meetSpreadLineup(sp);
  assert.deepEqual(J(out.us.map(t=>t.x)),[6,24,24,52.6,84,84]);
  assert.deepEqual(J(out.us.map(t=>t.y)),[50,20,80,50,30,70],'width untouched');
  assert.equal(sp.us[1].x,20,'source not mutated');
  assert.match(source,/sp&&\(sp\.lineup\|\|\/\^선발 11\/\.test/);
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8'),/opp:\[\],draw:\[\],lineup:1\}/);
});

test('portrait comes first and is the default for new meetings (old landscape memory is not reused)',()=>{
  assert.match(source,/\[\["portrait","세로형"\],\["landscape","가로형"\]\]\.forEach/);
  const d=slice('  window.__meetDefaultOrient=function(){','\n');
  const c={localStorage:{v:null,getItem(){return this.v;}},window:{}};vm.createContext(c);vm.runInContext(d,c);
  assert.equal(c.window.__meetDefaultOrient(),'portrait');
  c.localStorage.v='landscape';assert.equal(c.window.__meetDefaultOrient(),'landscape');
  assert.match(slice("  window.__meetingPageChoose=function(orientation){",'  };'),/ps_meet_orient_v2/);
  const fm=slice('  window.__meetingFromMatch=function(p){','    if(!slides.length)');
  assert.doesNotMatch(fm,/pdfOrientation:"landscape"/);assert.match(fm,/__meetTplSlides\(base,!!p\.skipBest,_oh\)/);
});

test('meeting MP4: menu entries, scene slides play, the slides are never written while recording, even video size',()=>{
  assert.equal((source.match(/\["MP4 영상으로 내보내기",function\(\)\{exportVideoSheet\("meeting"\);\}\]/g)||[]).length,2,'desktop menu and phone «더보기»');
  const ex=slice('async function exportMeetingVideo(opts){','\nlet ');
  assert.match(ex,/Array\.isArray\(sl\.frames\)&&sl\.frames\.length>1\)\?sl\.frames:\[\{snap:sl\.snap\}\]/);
  assert.match(ex,/window\.__meetVideoBusy=1;/);assert.match(ex,/finally\{ anim\.frames=keep; animActive=keepA; window\.__meetVideoBusy=0;/);
  for(const f of ['  function meetFlush(){','  function meetStore(i,thumb){','  window.__meetSyncCur=function(o){try{'])assert.match(slice(f,'\n  }'),/__meetVideoBusy/,f);
  const run=slice('async function _exportVideoRun(opts){','function exportVideoSheet(');
  assert.match(run,/canvas\.width=Math\.round\(w\*S\/2\)\*2;canvas\.height=Math\.round\(h\*S\/2\)\*2;/);
  assert.match(run,/badge=\(idx\+1\)\+'\/'\+NB/);assert.match(run,/planHold\(s\+1, _holdOf\(s\+1\)\)/);
});
