'use strict';
/* 오류 제보 8e143f85 «영상 내보내기 시, 운동장의 위치가 조금씩 다름» — «운동장 전체» 영상의 화면은 운동장만 보고 정한다.
   오류 제보 178c465c — 여러 페이지 영상의 페이지 이름 자막을 넣을지 이 기기에 기억한다. */
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../studio/board-export-frame.js');
const K=require('../studio/storage-keys.js');
const near=(a,b,msg)=>{ assert.equal(a.length,b.length,msg); a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,msg+' '+JSON.stringify(a)+' ≠ '+JSON.stringify(b))); };
const W=1110,H=740,M=30;   /* 판 크기 · 터치라인 밖 잔디(3m) — board.html 과 같은 값 */

test('the whole pitch sits in the middle of a 16:9 picture with 3m of grass beside the touchlines',()=>{
  const v=F.frame169([M,M,W-M,H-M],M,null);
  assert.ok(Math.abs(v[2]/v[3]-16/9)<1e-9,'16:9');
  near([v[0]+v[2]/2,v[1]+v[3]/2],[W/2,H/2],'centre = pitch centre');
  near([v[1],v[1]+v[3]],[0,H],'3m above and below the touchlines');
  assert.ok(v[0]<0&&v[0]+v[2]>W,'wider than the pitch along its length');
  const t=F.frame169([M,M,H-M,W-M],M,null);   /* 세로 판(돌린 좌표) */
  assert.ok(Math.abs(t[2]/t[3]-16/9)<1e-9);near([t[0]+t[2]/2,t[1]+t[3]/2],[H/2,W/2],'vertical pitch centred too');
  near([t[1],t[1]+t[3]],[0,W],'3m beyond the goal lines');
});

test('only pitch layers can widen the picture — the board frame itself changes nothing, a wider multi-pitch layout widens it around the same centre',()=>{
  const pb=[M,M,W-M,H-M],plain=F.frame169(pb,M,null);
  near(F.frame169(pb,M,[0,0,W,H]),plain,'the board frame (BASEVB) fits inside');
  const wide=F.frame169(pb,M,[-300,0,W+600,H]);
  assert.ok(wide[2]>plain[2]&&Math.abs(wide[2]/wide[3]-16/9)<1e-9,'wider, still 16:9');
  near([wide[0]+wide[2]/2,wide[1]+wide[3]/2],[W/2,H/2],'centre kept');
  near(F.frame169(pb,M,[-300,0,W+600,H]),wide,'same layout → same picture');
});

test('reels: the box grows to 9:16 around its own centre',()=>{
  const r=F.toAr([0,0,W,H],9/16);
  assert.ok(Math.abs(r[2]/r[3]-9/16)<1e-9);near([r[0],r[2]],[0,W],'full width kept');near([r[1]+r[3]/2],[H/2],'centred');
  const t=F.toAr([0,0,200,1000],9/16);near([t[1],t[3]],[0,1000],'a tall box keeps its height');near([t[0]+t[2]/2],[100],'centred');
});

test('page-name caption choice: on until turned off, remembered per device, broken storage keeps the old behaviour',()=>{
  const mem={},ls={getItem:k=>(k in mem)?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);}};
  assert.equal(F.capOn(ls),true,'nothing stored → names on (as before)');
  F.capSave(false,ls);assert.equal(mem[F.CAP_KEY],'0');assert.equal(F.capOn(ls),false);
  F.capSave(true,ls);assert.equal(mem[F.CAP_KEY],'1');assert.equal(F.capOn(ls),true);
  const bad={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.equal(F.capOn(bad),true);assert.doesNotThrow(()=>F.capSave(false,bad));
  const row=K.info(F.CAP_KEY);assert.ok(row,'registered in storage-keys.js');assert.equal(row.sync,'device');assert.equal(row.role,'pref');
});
