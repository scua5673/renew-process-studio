/* 3.093 — 사람 발밑 알약 = 그 선수 유니폼의 단색(사용자 «포지션 알약이 상대 팀과 비교 되게 · 최대한 티가 안 나게 · 색상을 유니폼색상으로 ·
   스트라이프 적용되게 하지 말고 단색만») · 커뮤니티 뷰어 «보기 › 글자»(«포지션으로 볼건지 등번호로 볼건지 이름으로 볼건지 선택하게»). */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const CL=require(path.join(root,'studio','board-comm-look.js'));
const mem=(o)=>{const m=Object.assign({},o||{});return {getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v);}};};

test('the foot pill: solid kit colour (never the stripe pattern), see-through, thin, letters by brightness',()=>{
  const d=read('studio/board-token-depth.js');
  assert.match(d,/function kitMain\(doc, item, fill, stroke\) \{\n\s*var c = hex6\(item && item\.color\); if \(c\) return c;/,'the player\'s own colour first');
  assert.match(d,/w\.playerTeamCol\(item\)/,'then the board\'s solid team colour (keeper · coach)');
  assert.match(d,/return c \|\| hex6\(fill\) \|\| hex6\(stroke\) \|\| '#3a6df0';/,'a url(#pattern) fill is never used');
  assert.match(d,/rx: r1\(tagH \/ 2\), fill: kitC, 'fill-opacity': '\.72' \}/,'a full round, see-through pill with no border');
  assert.match(d,/return l > 150 \? '#14161a' : '#ffffff';/);
  assert.doesNotMatch(d,/'class': 'ps-person-tag'[^\n]*stroke/,'no outline');
});

test('«이름»: the name goes into the foot pill and the separate name label steps aside',()=>{
  const d=read('studio/board-token-depth.js');
  assert.match(d,/doc\.defaultView\.__tagName/);
  assert.match(d,/tagTxt = kind === 'person' \? \(tagNm \|\| /);
  assert.match(d,/if \(item\.name && !tagNm\) \{/);
});

test('viewer «보기 › 글자»: remembered per device, only what the post has, the board label swapped scene by scene',()=>{
  assert.deepEqual(CL.LABELS,['pos','num','name']);
  assert.deepEqual(CL.read(mem({ps_comm_look_v1:JSON.stringify({label:'name'})})),{shape:'',tilt:'',label:'name'});
  assert.deepEqual(CL.read(mem({ps_comm_look_v1:JSON.stringify({label:'초록'})})),{shape:'',tilt:'',label:''},'모르는 값은 올린 그대로');
  const ls=mem();CL.write(ls,{shape:'person',tilt:'3d',label:'num'});assert.deepEqual(CL.read(ls),{shape:'person',tilt:'3d',label:'num'});
  const cur={is3d:true,pref:{shape:'person',tilt:'3d',label:''}},D={phone:false,touch:false};
  assert.deepEqual(CL.choose(cur,{label:'pos'},D,true),{on:null,shape:null,pref:{shape:'person',tilt:'3d',label:'pos'}},'글자만 바뀐다');
  assert.deepEqual(CL.choose({is3d:true,pref:{shape:'',tilt:'',label:'name'}},{shape:'circle'},D,true).pref.label,'name','모양을 바꿔도 글자는 남는다');
  assert.equal(CL.labelFor('pos','fpos'),'fpos','풋살 글은 풋살 포지션');
  assert.equal(CL.labelFor('pos','num'),'pos'); assert.equal(CL.labelFor('num','pos'),'num');
  assert.equal(CL.labelFor('name','pos'),'pos','이름 = 칩 글자는 글 그대로 · 사람 알약만 이름');
  assert.deepEqual(CL.has([{pos:'ST',num:''},{num:7},{name:' '}]),{pos:true,num:true,name:false});
  assert.deepEqual(CL.has([]),{pos:false,num:false,name:false});
  const src=read('studio/board-comm-look.js');
  assert.match(src,/win\.loadSnap = function \(s, o\) \{/,'장면마다 바꿔 싣는다');
  assert.match(src,/b\.disabled = !ok;/,'글에 없는 것은 못 고른다');
  assert.match(src,/win\.__commWantLabel = null; win\.__tagName = false;/,'닫으면 걷는다');
});
