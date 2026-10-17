// 3.083 — 유니폼 상의 · 하의 · 스타킹(사용자 «유니폼도 상의 하의 스타킹까지도 할 수 있게»)
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const kit=require('../studio/board-kit.js');
test('kit per team, GK separate (number 1 or GK), coach none, empty = auto',()=>{
  const kits={blue:{shorts:'#FFFFFF',socks:'#d00000'},'gk:blue':{socks:'#00ff00'},red:{shorts:'bad'}};
  assert.deepStrictEqual(kit.kitOf(kits,{team:'blue',num:7}),{shorts:'#ffffff',socks:'#d00000'});
  assert.deepStrictEqual(kit.kitOf(kits,{team:'blue',num:1}),{socks:'#00ff00'});
  assert.deepStrictEqual(kit.kitOf(kits,{team:'blue',num:5,pos:'GK'}),{socks:'#00ff00'});
  assert.strictEqual(kit.kitOf(kits,{team:'blue',num:9,coach:true}),null);
  assert.strictEqual(kit.kitOf(kits,{team:'red',num:9}),null,'invalid colours are ignored');
  assert.strictEqual(kit.kitOf(null,{team:'blue',num:9}),null);
  assert.strictEqual(kit.auto('socks','#3366ff'),'#3366ff');
  assert.match(kit.auto('shorts','#3366ff'),/^#[0-9a-f]{6}$/);
});
test('wiring: saved with the board (snap · load · interp · every scene · new page · reset), module loaded and cached, figure reads pose.kit',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/teamKit:dc\(state\.teamKit\|\|\{\}\)/);
  assert.match(b,/state\.teamKit=s\.teamKit\?dc\(s\.teamKit\):\{\};/);
  assert.match(b,/state\.teamKit=dc\(styleSnap\.teamKit\|\|\{\}\);/);
  assert.match(b,/var KIT_KEYS=\[[^\]]*"teamKit"/);
  assert.match(b,/teamKit:dc\(src\.teamKit\|\|\{\}\)/);
  assert.match(b,/teamKit:s\.teamKit,/);
  assert.match(b,/state\.teamKit=\{\};/);
  assert.match(b,/<script src="board-kit\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-kit\.js'/);
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board-token-depth.js'),'utf8'),/var kit = \(pose && pose\.kit\) \|\| \{\}/);
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board-broadcast.js'),'utf8'),/r\.kit = kit;/);
});
test('easy to find: menu item, tray pen + header button, inspector button, old chip re-tap opens the new editor',()=>{
  const tb=fs.readFileSync(path.join(__dirname,'../studio/board-topbar.js'),'utf8');
  assert.match(tb,/kit\.setAttribute\('data-ps-kit-open', 'menu'\)/);
  const src=fs.readFileSync(path.join(__dirname,'../studio/board-kit.js'),'utf8');
  for(const s of ["className = 'ps-kit-pen'","className = 'ps-kit-hd'","className = 'ps-kit-insp'","getElementById('teamStylePop')","win.__psKitOpen = open"])assert.ok(src.includes(s),s);
});
test('quick combos are whole kits (shirt · accent · pattern · shorts · socks) and the pattern geometry matches the board',()=>{
  assert.ok(kit.COMBOS.length>=8);
  for(const c of kit.COMBOS){ for(const i of [0,1,3,4])assert.match(c[i],/^#[0-9a-f]{6}$/); assert.ok(['solid','v','thinv','h','half','quarters','band','hoop','sash','diag'].includes(c[2])); assert.ok(c[5]); }
  assert.strictEqual(kit.SWATCH.length,16);
  assert.strictEqual(kit.cssBG('#111111','#222222','band'),'linear-gradient(90deg,#111111 0 36%,#222222 36% 64%,#111111 64%)');
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.ok(b.includes('if(p==="band")return "linear-gradient(90deg,"+m+" 0 36%,"+a+" 36% 64%,"+m+" 64%)";'),'same band geometry as kitCSSBG');
});
