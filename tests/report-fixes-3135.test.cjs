// 3.135 — 오류 제보 고침 묶음(2026-10-21): 0ce6d0cc 경기 글 칸은 «팀 자료 확인 중»에도 받아 둔다(match-edit-hold.js) ·
// 738f37d1 저장 팀 불러오기는 모든 페이지 · 슬라이드에(board-tweaks.js 8) · 0917a39f «저장»으로 담은 보관함 자료와 잇는다 + «보관함에 담기…»(board-tweaks.js 9).
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tw=require('../studio/board-tweaks.js'),hold=require('../studio/match-edit-hold.js'),T=require('../studio/team-load.js');

test('wiring: scout loads the hold module after the match parts, cached, build 3.135, release note',()=>{
  assert.match(read('studio/scout.html'),/<script src="match-meet-parts\.js"><\/script><script src="match-edit-hold\.js"><\/script>/);
  const sw=read('sw.js');
  assert.match(sw,/'\/studio\/match-edit-hold\.js'/);assert.match(sw,/CACHE = 'process-3\.135'/);
  assert.match(read('studio/app.html'),/PS_BUILD='3\.135'/);
  assert.match(read('studio/release-notes.js'),/v3-135-report-fixes/);
  assert.ok(Buffer.byteLength(read('studio/board.html'))<=2560000,'board.html budget');
  assert.ok(Buffer.byteLength(read('studio/scout.html'))<=1900*1024,'scout.html budget');
  // «저장» 단추 설명의 옛 글은 board.html 그대로 — 모듈이 바꿔 단다(둘이 어긋나면 바꿔 달 수 없다)
  const twSrc=read('studio/board-tweaks.js');
  assert.ok(read('studio/board.html').indexOf('보관함 자료와 이어져 있으면 그 자료에도 저장해요(아니면 보관함에 담을지 물어요)')>=0);
  assert.match(twSrc,/TIP_OLD = '보관함 자료와 이어져 있으면 그 자료에도 저장해요\(아니면 보관함에 담을지 물어요\)'/);
  assert.doesNotMatch(twSrc,/linkTag\(\{ libId: id/,'새로 담은 자료와 페이지를 저절로 잇지 않는다(3.077 · 2.907)');
});

test('hold: only text fields are held, never the date; held text goes into the match doc',()=>{
  const el=(tag,type,k)=>({tagName:tag,type,getAttribute:a=>a==='data-match-field'?k:null,hasAttribute:a=>a==='data-match-field'});
  assert.equal(hold.fieldOk(el('TEXTAREA','textarea','attack')),true);
  assert.equal(hold.fieldOk(el('INPUT','text','venue')),true);
  assert.equal(hold.fieldOk(el('INPUT','checkbox','prepPublished')),false);
  assert.equal(hold.fieldOk(el('SELECT','select-one','homeAway')),false);
  assert.equal(hold.fieldOk(el('INPUT','date','date')),false);
  assert.equal(hold.fieldOk({tagName:'TEXTAREA',getAttribute:()=>null,hasAttribute:()=>false}),false,'경기 칸이 아니면');
  const m={id:'m1',attack:'old'};
  assert.equal(hold.applyHold(m,{attack:'new',defense:'d'}),2);
  assert.deepStrictEqual(m,{id:'m1',attack:'new',defense:'d'});
  assert.equal(hold.applyHold(null,{a:1}),0);
  assert.match(hold.CSS,/\.match-shell\.readonly\.ps-hold \[data-match-field\]\{pointer-events:auto!important\}/);
});

// 다른 페이지의 토큰: 같은 id 는 그대로, 아니면 포지션으로(지금 페이지와 같은 규칙) — 상대 쪽 · 코치는 건드리지 않는다
test('team spread: same ids copy the dressed token, other ids match by position, undo restores',()=>{
  const list=[{id:'p1',no:'1',name:'골키퍼',pos:'GK'},{id:'p2',no:'9',name:'공격수',pos:'ST'},{id:'p3',no:'4',name:'센터백',pos:'CB'}];
  const toks=[{id:1,team:'blue',num:'1',pos:'GK',name:'골키퍼',x:10,y:50,img:'data:x',imgTeam:T.mark('data:x')},{id:2,team:'blue',num:'9',pos:'ST',name:'공격수',x:90,y:50}];
  const fresh=[{id:3,team:'blue',num:'4',pos:'CB',name:'센터백',x:30,y:50}];
  const slotsOf=rest=>rest.map((t,i)=>[t.x/100,t.y/100,i+1,t.pos]);
  const imgOf=p=>p.id==='p1'?'data:x':'';
  const apply=tw.teamSpreadFn(T,'blue',toks,fresh,list,{code:T.code,base:T.base,group:T.group},slotsOf,imgOf);
  // 복제한 페이지(같은 id)
  const dup={players:[{id:1,team:'blue',num:'1',pos:'GK',x:12,y:50},{id:2,team:'blue',num:'9',pos:'ST',x:88,y:50},{id:7,team:'red',num:'7',pos:'GK',x:95,y:50}]};
  const u1=apply(dup);
  assert.deepStrictEqual(dup.players.map(p=>[p.id,p.name||null,p.img||null]),[[1,'골키퍼','data:x'],[2,'공격수',null],[7,null,null]]);
  assert.equal(u1.length,2,'바꾼 토큰마다 되돌릴 값');
  tw.teamUndo(u1);
  assert.deepStrictEqual(dup.players.map(p=>[p.id,p.name||null,p.img||null]),[[1,null,null],[2,null,null],[7,null,null]],'되돌리기');
  // 따로 만든 페이지(다른 id) — 포지션으로: GK 자리엔 골키퍼, CB 자리엔 센터백, ST 자리엔 공격수
  const own={players:[{id:21,team:'blue',num:'1',pos:'ST',x:90,y:50},{id:22,team:'blue',num:'2',pos:'GK',x:5,y:50},{id:23,team:'blue',num:'3',pos:'CB',x:20,y:50},{id:24,team:'blue',num:'5',pos:'LW',x:70,y:10},{id:30,team:'blue',coach:true,x:0,y:0}]};
  const u2=apply(own);
  assert.deepStrictEqual(own.players.map(p=>[p.pos,p.name||null,p.num]),[['ST','공격수','9'],['GK','골키퍼','1'],['CB','센터백','4'],['LW',null,'5'],[undefined,null,undefined]]);
  assert.equal(own.players[1].img,'data:x','사진도');
  assert.equal(u2.length,4,'코치는 빼고');
  // 그 쪽 토큰이 없는 페이지는 그대로
  assert.equal(apply({players:[{id:7,team:'red',num:'7',x:1,y:1}]}),null);
  assert.equal(apply({players:[]}),null);
});
