'use strict';
/* 3.272 — 3.271 이 남긴 자리(명단 · 경기 · 일정 사전). 브라우저 탐침(tests/browser/xss-synced-docs-team)이 찾은 구멍을 규칙으로 못 박는다.
   ① 포지션 목표 칸(scout.html «팀 기준» 표)은 숫자만 그린다  ② «선수 추가» 창(psForm)의 고르개 글은 esc 한다
   ③ 명단 · 경기 문서는 읽을 때 id 칸 · 점수 칸을 제 모양으로(PSSafe.doc — scoutStore.get 이 지난다)
   ④ 일정 사전(주제 · 일정 · 미팅 · 웜업 · 훈련 고르개)의 이름 · 색은 읽을 때 한 번(PSSafe.presets)
   ⑤ 세션 조 고르개 · 추천 드릴의 처리기 값은 PSSafe.arg  ⑥ 일정 문서를 직접 읽는 다른 화면도 PSSafe.sched 를 지난다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function cut(src,from,to){const a=src.indexOf(from);assert.ok(a>=0,'start marker: '+from);const b=src.indexOf(to,a+from.length);assert.ok(b>a,'end marker: '+to);return src.slice(a,b);}
const storage=read('studio/storage.js'),scout=read('studio/scout.html'),proc=read('studio/process.html');
function safeApi(){const c=vm.createContext({});c.window=c;vm.runInContext(cut(storage,'window.PSSafe=window.PSSafe||{};','var SVG_NS='),c);return c.PSSafe;}
const plain=x=>JSON.parse(JSON.stringify(x));
const BAD=`x');PWN();//" class="p" onerror="PWN()" x='><img src=x onerror="PWN()"></script><script>PWN()</script>`;
const STRUCT=/[<>"'&\\`\u0000-\u001f\u2028\u2029]/;

test('③ PSSafe.doc: id fields lose the characters HTML and JS read as structure; text is left for esc',()=>{
  const S=safeApi();
  const roster={attrs:[{id:BAD,cat:BAD,name:BAD}],positions:[{id:BAD,name:BAD,targets:{fifa_pass:BAD,fifa_shot:'4',[BAD]:3,ok:5},req:{a:BAD,b:2}}],
    players:[{id:BAD,posId:BAD,type:BAD,status:BAD,scoutSt:BAD,name:BAD,memo:BAD,grp:"O'Neil 조",levels:{fifa_pass:BAD,fifa_shot:4,[BAD]:BAD,txt:'3.5'},profile:{photo:BAD}}],
    meta:{grpBase:["O'Neil 조"],grpLabels:{"O'Neil 조":'A & B'},cats:[{id:BAD,name:BAD}]}};
  const out=plain(S.doc('scout_tool_v1',plain(roster))),p=out.players[0],po=out.positions[0];
  for(const v of [p.id,p.posId,p.type,p.status,p.scoutSt,po.id,out.attrs[0].id,out.attrs[0].cat,out.meta.cats[0].id])assert.ok(v&&!STRUCT.test(v),'id-like field cleaned: '+v);
  assert.equal(p.name,BAD);assert.equal(p.memo,BAD);assert.equal(p.profile.photo,BAD,'text and image fields are for the drawing side (esc · PSImg)');
  assert.equal(p.grp,"O'Neil 조");assert.deepEqual(out.meta.grpBase,["O'Neil 조"]);assert.equal(out.meta.grpLabels["O'Neil 조"],'A & B','group names with quotes stay as typed');
  assert.deepEqual(p.levels,{fifa_shot:4,txt:'3.5'},'scores: numbers and numeric text only, hostile keys dropped');
  assert.deepEqual(po.targets,{fifa_shot:'4',ok:5});assert.deepEqual(po.req,{b:2});
  const ordinary={players:[{id:'plmf3k2a9x1b',posId:'pos_GK',type:'ours',status:'injured',levels:{fifa_pass:3}}],positions:[{id:'pos_GK',targets:{fifa_pass:4}}],attrs:[{id:'fifa_pass',cat:'tech'}]};
  assert.deepEqual(plain(S.doc('scout_tool_v1',plain(ordinary))),ordinary,'documents the app wrote are unchanged');
});
test('③ PSSafe.doc: match documents — ids, id lists and kinds; and the schedule goes through PSSafe.sched',()=>{
  const S=safeApi();
  const m=plain(S.doc('cs_team_matches_v1',{version:1,matches:[{id:BAD,sourceId:BAD,captainId:BAD,squadIds:[BAD,'vp01'],startingIds:[BAD],kind:BAD,fmt:BAD,fifaMode:BAD,homeAway:BAD,opponent:BAD,reviewGood:BAD,
    goals:[{id:BAD,side:BAD,scorer:BAD,assist:BAD,note:BAD}],boardLinks:[{id:BAD,libId:BAD,name:BAD}],phaseBoards:{boards:{atk:{snap:{tokens:[{id:BAD}]}}}}}]})).matches[0];
  for(const v of [m.id,m.sourceId,m.captainId,m.squadIds[0],m.startingIds[0],m.kind,m.fmt,m.fifaMode,m.homeAway,m.goals[0].id,m.goals[0].side,m.goals[0].scorer,m.goals[0].assist,m.boardLinks[0].id,m.boardLinks[0].libId])
    assert.ok(!STRUCT.test(v),'cleaned: '+v);
  assert.equal(m.squadIds[1],'vp01');assert.equal(m.opponent,BAD);assert.equal(m.reviewGood,BAD);assert.equal(m.goals[0].note,BAD);
  assert.equal(m.phaseBoards.boards.atk.snap.tokens[0].id,BAD,'board pictures are not walked');
  const sch=plain(S.doc('process_coach_v1',{weeks:{0:[{trainings:[{slot:BAD,time:BAD,note:BAD}]}]}})).weeks[0][0].trainings[0];
  assert.ok(!STRUCT.test(sch.slot)&&!STRUCT.test(sch.time));assert.equal(sch.note,BAD);
  for(const v of [null,undefined,'text',7])assert.equal(S.doc('scout_tool_v1',v),v,'non-documents pass through');
});
test('③ scout.html reads every shared document through the normaliser (and still reads when it is missing)',()=>{
  const get=cut(scout,'const scoutStore={','set(k,v){');
  assert.match(get,/const d=JSON\.parse\(v\);return typeof PSSafe!=="undefined"&&PSSafe\.doc\?PSSafe\.doc\(k,d\):d;/);
});
test('④ PSSafe.presets: names cannot end a handler string or open a tag, colours are colours',()=>{
  const S=safeApi();
  const themes=[[BAD,BAD],['패스 & 무브','#2E7D63'],["GK's",'red'],['&#39;);PWN();//','var(--accent)'],['ok','rgb(1, 2, 3)'],['x','url(javascript:PWN())'],['y','#fff;background:url(x)'],
    ['z','red" onmouseover="PWN()'],[{a:1},'#000'],'junk',['', '#000'],[42,'#123456',1]];
  const out=plain(S.presets([themes,null,'x']))[0];
  for(const o of out){
    if(typeof o[0]==='string')assert.ok(!/[<>"'`\\]|&#?\w+;/.test(o[0]),'name: '+o[0]);
    assert.match(o[1],/^(?:#[0-9a-f]{3,8}|var\(--[a-z0-9-]+\)|rgb\(1, 2, 3\)|red)$/i,'colour: '+o[1]);
  }
  assert.deepEqual(out.map(o=>o[0]),["x);PWN();// class=p onerror=PWN() x=img src=x onerror=PWN()/scriptscriptPWN()/script",'패스 & 무브','GKs','#39;);PWN();//','ok','x','y','z',42]);
  assert.deepEqual(out.map(o=>o[1]),['#8A9099','#2E7D63','red','var(--accent)','rgb(1, 2, 3)','#8A9099','#8A9099','#8A9099','#123456']);
  assert.equal(out[8][2],1,'the flag column is kept');
  assert.equal(S.color('#3A6DF0'),'#3A6DF0');assert.equal(S.color(undefined,'#111'),'#111');assert.equal(S.color('expression(alert(1))'),'#8A9099');
});
test('④ process.html cleans the dictionaries once, right after they are read and before anything is drawn',()=>{
  const at=proc.indexOf('\nloadBPresets();PSSafe.presets&&PSSafe.presets([BSCHED,BTHEME,BLOAD,BMEET,BWARM,BTRAIN]);');
  assert.ok(at>0,'call after loadBPresets()');
  assert.ok(proc.indexOf("localStorage.getItem('cs_themes_v1')")<at,'the theme dictionary is read before the cleaning');
  assert.equal((proc.match(/loadBPresets\(\)/g)||[]).length,2,'declared once, called once — no later reload skips the cleaning');
});
test('⑤ handler arguments from team text use PSSafe.arg',()=>{
  const ses=cut(proc,'window.sesGrp=function(di,slot){','공통 (전체)');
  assert.ok(ses.includes('var q=_fillEsc;'),'session group picker');
  assert.ok(!/replace\(\/\['\\\\\]\/g,''\)/.test(ses),'the old strip helper let " and < through');
  assert.ok(proc.includes("onclick=\"wizAddRec('${_fillEsc(r.libId)}')\""),'recommended drill id');
  assert.ok(proc.includes('RPE ${+r.rpe||5}'),'library numbers are drawn as numbers');
});
test('①② scout.html: target cells draw numbers, form option labels are escaped',()=>{
  assert.ok(scout.includes(`cell.innerHTML=(core?'<span class="st">★</span>':'')+(+tgt(p,a.id)||3);`),'criteria table cell');
  const form=cut(scout,"if(f.type==='select'){","else { h+='<input data-k=");
  assert.equal((form.match(/'\+PSSafe\.html\(l\)\+'/g)||[]).length,2,'select option and segment button labels');
  assert.ok(!/>'\+l\+'</.test(form));
});
test('⑥ pages that read the schedule document themselves normalise it too',()=>{
  const gm=read('studio/gamemodel.html'),idp=read('studio/idp.html');
  for(const [name,src] of [['gamemodel.html',gm],['idp.html',idp],['scout.html',scout]]){
    const raw=(src.match(/(?<!PSSafe\.sched\()JSON\.parse\(\(*(?:\(window\.PSSchedule&&PSSchedule\.raw\)\?PSSchedule\.raw\(\):)?localStorage\.getItem\(["']process_coach_v1["']\)\)*\|\|["']null["']\)/g)||[]);
    assert.deepEqual(raw,[],name+' parses the schedule without PSSafe.sched');
  }
  assert.equal((gm.match(/var doc=raw\?PSSafe\.sched\(JSON\.parse\(raw\)\):null;/g)||[]).length,2,'gamemodel.html week readers');
  assert.ok(!/var doc=raw\?JSON\.parse\(raw\):null; var weeks=doc&&doc\.weeks/.test(gm));
});
test('byte budgets hold',()=>{
  assert.ok(Buffer.byteLength(proc)<=820*1024,'process.html '+Buffer.byteLength(proc));
  assert.ok(Buffer.byteLength(scout)<=1900*1024,'scout.html '+Buffer.byteLength(scout));
});
