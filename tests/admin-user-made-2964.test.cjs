'use strict';
/* 2.964 — 관리자 › 사용자 상세: «만든 것»(그 사람이 만든 보관함 자료 — 이름·종류·날짜만) · «요즘 하는 일»(최근 7일 핵심 행동·자주 연 화면).
   서버를 새로 묻지 않는다: 관리자 페이지가 이미 받아 둔 콘텐츠 목록과 사용 이벤트만 쓴다. 본문은 열지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../studio/admin-user-detail.js');
const U='11111111-1111-4111-8111-111111111111',V='22222222-2222-4222-8222-222222222222',W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',X='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const lib=(p={})=>({workspace_id:W,lib_id:'L'+Math.random().toString(36).slice(2),name:'가상 훈련',type:'train',owner_id:U,made_at:'2026-10-07T10:00:00Z',deleted_at:null,...p});

test('made items: only this owner, newest first, deleted counted apart, team scope respected',()=>{
  const rows=[lib({name:'옛 훈련',made_at:'2026-09-01T10:00:00Z'}),lib({name:'새 미팅',type:'meeting',made_at:'2026-10-07T12:00:00Z'}),
    lib({name:'남의 것',owner_id:V}),lib({name:'지운 것',deleted_at:'2026-10-01T00:00:00Z'}),lib({name:'다른 팀',workspace_id:X,made_at:'2026-10-02T00:00:00Z'})];
  const all=api.madeItems(rows,U,'');
  assert.deepEqual(all.live.map(r=>r.name),['새 미팅','다른 팀','옛 훈련']);
  assert.equal(all.deleted,1);
  assert.deepEqual(api.madeItems(rows,U,X).live.map(r=>r.name),['다른 팀'],'팀을 고르면 그 팀 것만');
  assert.deepEqual(api.madeItems(rows,'not-a-uuid','').live,[],'식별할 수 없는 사용자는 아무것도 붙이지 않는다');
  assert.deepEqual(api.madeItems(null,U,'').live,[]);
});

test('made by type: Korean labels, admin typeName wins only when it knows the type',()=>{
  const items=[lib(),lib(),lib({type:'meeting'}),lib({type:'analysis'}),lib({type:'drill'})];
  const adminTypeName=t=>({train:'훈련',meeting:'미팅'}[t]||t);   // admin.html 의 typeName 처럼 모르는 값은 그대로 돌려준다
  assert.deepEqual(api.madeByType(items,adminTypeName),[['훈련',2],['미팅',1],['경기 분석',1],['훈련',1]]);
});

test('week summary: last 7 days only, actions by label, screens by feature, sorted by count',()=>{
  const now=Date.parse('2026-10-08T12:00:00Z');
  const ev=(name,feature,at)=>({event_name:name,feature,created_at:at});
  const s=api.weekSummary([ev('a_week','schedule','2026-10-08T09:00:00Z'),ev('a_week','schedule','2026-10-06T09:00:00Z'),ev('a_review','scout','2026-10-05T09:00:00Z'),
    ev('a_week','schedule','2026-09-20T09:00:00Z'),ev('feature_opened','board','2026-10-07T09:00:00Z'),ev('feature_opened','board','2026-10-07T10:00:00Z'),
    ev('feature_opened','idp','2026-10-07T10:00:00Z'),ev('sync_failed','sync','2026-10-07T10:00:00Z')],now);
  assert.deepEqual(s.actions,[['주간 일정 편집',2],['경기 리뷰 저장',1]],'7일 지난 편집은 빠진다');
  assert.deepEqual(s.screens,[['보드',2],['IDP',1]],'동기화 실패 같은 운영 이벤트는 «한 일»이 아니다');
  assert.deepEqual(api.weekSummary([],now),{actions:[],screens:[]});
});

test('drawer: section order, no body reads, no new server calls for what was made',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../studio/admin-user-detail.js'),'utf8');
  assert.ok(code.includes("[['account','계정'],['teams','팀'],['made','만든 것'],['events','요즘 하는 일']"),'팀 다음에 «만든 것», 그 다음 «요즘 하는 일»');
  const fn=code.slice(code.indexOf('function renderMade('),code.indexOf('function render(view,state)'));
  assert.doesNotMatch(fn,/request\(|rpc\(|ps_admin_library_item|fetch\(/,'만든 것은 받아 둔 목록만 읽는다');
  assert.match(fn,/if\(!ready\)\{[^}]*return;\}/,'만든 사람 정보가 없으면 «없음»이라고 말하지 않는다');
  assert.doesNotMatch(code,/\.innerHTML\s*=|insertAdjacentHTML/);
});

test('admin wiring: library passed as a getter, item opens content preview, «모두 보기» filters by this author',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
  const a=html.indexOf('function openAdminUser(uid){'),b=html.indexOf('\n}\n',a);const fn=html.slice(a,b);
  assert.ok(fn.includes('library:function(){return ALL_LIB;}'),'다시 불러온 목록도 읽게 함수로');
  assert.ok(fn.includes('libraryReady:function(){return adminOwnersReady;}'));
  assert.ok(fn.includes('onContentItem:function(wid,lid){preview(wid,encodeURIComponent(lid));}'));
  assert.ok(/onContentAll:function\(id\)\{setTab\('all'\);resetContentFilters\(\);var a=\$\('alAuthor'\);if\(a\)\{a\.value='id:'\+id;renderAllLib\(\);\}\}/.test(fn),'작성자 필터 값은 admin-content.js authorKey 와 같은 id:<uid>');
  assert.ok(html.includes('studio/admin-user-detail.js?v=2.964')&&html.includes('studio/admin-user-detail.css?v=2.964'),'?v 를 올려야 캐시를 넘는다');
});
