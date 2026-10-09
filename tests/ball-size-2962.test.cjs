const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.962 — 공의 기본 크기는 «크기 ＋» 두 칸(×1.18²). 사용자 «기본적으로 공 크기를 두칸 더 키워줘».
   2.977 — 기준을 선수 토큰으로: 공 지름 = 선수 원 지름(42) × 1.18 (사용자 «볼만 선수토큰보다 1단계 크게»). */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

function tt(state){
  const a=src.indexOf('function ballBaseScale(){');
  const b=src.indexOf('\nconst SHIRT_D=',a);
  assert.ok(a>0&&b>a,'ballBaseScale + tokenTransform block');
  const c=vm.createContext({document:{body:{classList:{contains:()=>false}}},window:{},state,
    equipKey:t=>['ball','cone','marker','minigoal','pole'].includes(t)?t:null,specTokFactor:()=>1,phoneTokFactor:()=>1});
  vm.runInContext(src.slice(a,b)+';this.tokenTransform=tokenTransform;this.ballBaseScale=ballBaseScale;',c);
  return c;
}
const scaleOf=t=>{const m=/scale\(([\d.]+)\)/.exec(t);return m?+m[1]:1;};

test('2.977 the ball is one «size +» step bigger than a player token — main ball and equipment balls alike',()=>{
  const c=tt({tokenScale:1});
  const ballD=s=>28*226/240*s, playerD=s=>42*s;   /* 공: 28칸 그림 안의 원 r113/240 · 선수: 원 r21 */
  assert.equal(Math.round(c.ballBaseScale()*10000)/10000,1.8796);
  for(const b of [{team:'ball',id:'ball',x:1,y:2},{team:'ball',id:9,x:1,y:2}]){
    const r=ballD(scaleOf(c.tokenTransform(b)))/playerD(scaleOf(c.tokenTransform({team:'blue',num:'7',x:1,y:2})));
    assert.ok(Math.abs(r-1.18)<1e-3,'ball/player diameter '+r);
  }
});

test('players, coaches and other equipment keep their size',()=>{
  const c=tt({tokenScale:1});
  assert.equal(scaleOf(c.tokenTransform({team:'blue',num:'9',x:1,y:2})),1);
  assert.equal(scaleOf(c.tokenTransform({team:'cone',x:1,y:2})),1.8);
});

test('the relation holds at any board token size, and a ball sized by hand keeps its own multiple',()=>{
  for(const ts of [.355,.55,1.2]){ const c=tt({tokenScale:ts});
    const r=(28*226/240*scaleOf(c.tokenTransform({team:'ball',id:'ball',x:0,y:0})))/(42*scaleOf(c.tokenTransform({team:'red',x:0,y:0})));
    assert.ok(Math.abs(r-1.18)<1e-3,ts+' → '+r); }
  const c=tt({tokenScale:.5});
  const s=scaleOf(c.tokenTransform({team:'ball',id:'ball',scale:1/1.18,x:0,y:0}));
  assert.ok(Math.abs(28*226/240*s-42*.5)<1e-2,'one «size −» on the ball = the player size ('+s+')');
});

test('the onion ghost of the ball uses the same size',()=>{
  assert.match(src,/r:13\*ballBaseScale\(\)\*\(snap\.ball\.scale\|\|1\)/);
});
