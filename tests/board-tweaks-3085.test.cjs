// 3.085 — 오류 제보 고침 묶음(2026-10-17 제보: 속도 전체 · 페이지 이름 자막 · 영상 운동장 자리 · 저장하고 나가기 뒤 폴더 · 장면 유지 0.1초 · 토큰만 리셋)
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const tw=require('../studio/board-tweaks.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-6);
test('16:9 video frame: pitch centred, only two sizes (normal · wide) whatever sits off the pitch',()=>{
  const pb=[100,50,1150,730], m=30;   // 운동장 1050×680
  const base=tw.frame169(pb,m,null,true);
  assert.ok(Math.abs(base[0]+base[2]/2-625)<1e-6&&Math.abs(base[1]+base[3]/2-390)<1e-6,'pitch centre is the frame centre');
  assert.ok(Math.abs(base[2]/base[3]-16/9)<1e-9,'16:9');
  // 여유 안에 놓인 것 — 기본 화면 그대로
  assert.ok(near(tw.frame169(pb,m,[90,40,1080,700],true),base),'inside the margin: same frame');
  // 조금 · 많이 밖(넓게 안) — 둘 다 같은 «넓게» 화면(예전엔 놓인 만큼 조금씩 커졌다)
  const a=tw.frame169(pb,m,[-60,50,1100,680],true), b=tw.frame169(pb,m,[-120,50,1100,680],true);   // 기본 화면(x −33~1283) 밖으로 조금 · 더
  assert.ok(near(a,b),'two different spills → the same wide frame');
  assert.ok(a[2]>base[2],'wide is bigger');
  assert.ok(Math.abs(a[0]+a[2]/2-625)<1e-6,'still centred on the pitch');
  // 넓게도 넘으면 그때만 놓인 것에 맞춘다(가운데는 그대로)
  const far=tw.frame169(pb,m,[-600,50,2400,680],true);
  assert.ok(far[2]>a[2]&&Math.abs(far[0]+far[2]/2-625)<1e-6);
  // 하프 등 운동장 일부 보기는 놓인 것을 보지 않는다(예전과 같다)
  assert.ok(near(tw.frame169(pb,m,[-600,50,2400,680],false),base));
});
test('reel box is centred on the pitch, not on whatever is placed',()=>{
  const pb=[100,50,1150,730], m=30;
  const r=tw.reelBox(pb,m,[400,60,300,200]);
  assert.ok(Math.abs(r[0]+r[2]/2-625)<1e-6&&Math.abs(r[1]+r[3]/2-390)<1e-6);
  const off=tw.reelBox(pb,m,[1100,60,400,200]);   // 오른쪽 밖으로 나간 것 — 상자는 커지되 가운데는 운동장
  assert.ok(Math.abs(off[0]+off[2]/2-625)<1e-6&&off[2]>r[2]);
});
test('page-name captions can be left out; a caption written on the scene stays',()=>{
  const on=[{name:'빌드업',frames:[{},{cap:'  3번 침투 '}]},{name:'압박',frames:[{},{}]}];
  const seq=[{cap:'빌드업'},{cap:'3번 침투'},{cap:'압박'},{cap:'압박'}];
  tw.stripPageCaps(on,seq);
  assert.deepStrictEqual(seq.map(s=>s.cap),['','3번 침투','','']);
});
test('wiring: module loaded after the create frame, cached, keys registered; reels use the pitch box unless framing the training area',()=>{
  const b=read('studio/board.html');
  assert.match(b,/<script src="board-create-frame\.js"><\/script><script src="board-tweaks\.js"><\/script>/);
  assert.match(read('sw.js'),/'\/studio\/board-tweaks\.js'/);
  const k=read('studio/storage-keys.js');
  assert.match(k,/\['ps_anim_export_cap_v1','device','ls','pref','board-tweaks\.js'\]/);
  assert.match(k,/\['ps_anim_speed_all_v1','device','ls','pref','board-tweaks\.js'\]/);
  assert.match(b,/if\(uvb\)\{ uvb=_toAr\(\(!_fit&&window\.__psReelVB\)\?__psReelVB\(uvb\):uvb\); \}/);
});
test('0.1s hold: offered in the menu and not raised back to 0.2 when playing or exporting',()=>{
  const b=read('studio/board.html');
  assert.match(b,/<option value="0\.1">0\.1초<\/option><option value="0\.3">0\.3초<\/option>/);
  assert.match(b,/const holdMs=\(\)=>Math\.max\(\.1,animHold\|\|\.6\)\*1000;/);
  assert.match(b,/var holdMs=Math\.max\(\.1,animHold\|\|\.6\)\*1000;/);
  assert.match(b,/const hold=Math\.max\(\.1,\+o\.hold\|\|\.6\)/);
  assert.doesNotMatch(b,/Math\.max\(\.2,animHold/);
});
test('reset just this token: clear label, sits with «다음 장면» in the player card',()=>{
  assert.match(read('studio/board.html'),/id="tokAnimResetBtn"[^>]*>↺ 이 토큰만 리셋<\/button>/);
  assert.match(read('studio/board-inspector.js'),/'>#tokAnimResetBtn\{order:9!important;flex:1 1 100%!important/);
});
test('save and exit returns to the folder the item was opened from (not «내 자료» · «전체 자료»)',()=>{
  const s=read('studio/board-tweaks.js');
  assert.match(s,/win\.__vaultEnterReset = function \(\) \{ if \(backNow\(\)\) return; return origE\.apply\(this, arguments\); \};/);
  assert.match(s,/if \(v === 'session' && b\) \{ back = null; var lf = LF\(\); if \(lf && lf\.folder !== b\.folder\)/);
  assert.match(s,/function backNow\(\) \{ return back && Date\.now\(\) - back\.t < 6000 \? back : null; \}/);
});
