const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.962 — 공의 기본 크기는 «크기 ＋» 두 칸(×1.18²). 사용자 «기본적으로 공 크기를 두칸 더 키워줘». */
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

test('the ball is drawn two «size +» steps bigger by default, the main ball and equipment balls alike',()=>{
  const c=tt({tokenScale:1});
  assert.equal(Math.round(c.ballBaseScale()*10000)/10000,1.3924);
  assert.equal(Math.round(scaleOf(c.tokenTransform({team:'ball',id:'ball',x:1,y:2}))*10000)/10000,1.3924);
  assert.equal(Math.round(scaleOf(c.tokenTransform({team:'ball',id:9,x:1,y:2}))*10000)/10000,1.3924);
});

test('players, coaches and other equipment keep their size',()=>{
  const c=tt({tokenScale:1});
  assert.equal(scaleOf(c.tokenTransform({team:'blue',num:'9',x:1,y:2})),1);
  assert.equal(scaleOf(c.tokenTransform({team:'cone',x:1,y:2})),1.8);
});

test('a saved ball size stays a multiple of the new default, and the board token size still applies',()=>{
  const c=tt({tokenScale:.5});
  const s=scaleOf(c.tokenTransform({team:'ball',id:'ball',scale:1/1.18/1.18,x:0,y:0}));
  assert.ok(Math.abs(s-.5)<1e-3,'two «size −» steps land back on the old default size ('+s+')');
});

test('the onion ghost of the ball uses the same size',()=>{
  assert.match(src,/r:13\*ballBaseScale\(\)\*\(snap\.ball\.scale\|\|1\)/);
});
