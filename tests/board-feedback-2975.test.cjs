'use strict';
// 2.975 — 작전판 피드백: 단축키 조합 읽기 · 선수단을 «지금 판의 자리»에 · MP4 묶기
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const between=(a,b)=>{const i=src.indexOf(a);assert.ok(i>=0,'anchor '+a);const j=src.indexOf(b,i);assert.ok(j>i,'anchor '+b);return src.slice(i,j);};

function comboCtx(platform){
  const code=between('var _PS_MAC=','    var _KC_SHOW=');
  const ctx={navigator:{platform,userAgent:''}};vm.createContext(ctx);
  vm.runInContext(code+';this.comboOf=comboOf;this.comboFix=comboFix;this.normToolKey=normToolKey;this.MOD=_KC_MOD;',ctx);
  return ctx;
}

test('combo shortcuts read the physical key, modifiers and named keys (2.975)',()=>{
  const mac=comboCtx('MacIntel');
  const k=(o)=>mac.comboOf(Object.assign({metaKey:false,ctrlKey:false,altKey:false,shiftKey:false},o));
  assert.equal(k({key:'s',code:'KeyS',metaKey:true}),'cmd+s');
  assert.equal(k({key:'ㄴ',code:'KeyS',metaKey:true}),'cmd+s','한글 자판이어도 물리 키로 읽는다');
  assert.equal(k({key:'N',code:'KeyN',shiftKey:true}),'shift+n');
  assert.equal(k({key:' ',code:'Space'}),'space');
  assert.equal(k({key:'ArrowRight',code:'ArrowRight'}),'right');
  assert.equal(k({key:'ArrowLeft',code:'ArrowLeft',altKey:true,shiftKey:true}),'alt+shift+left');
  assert.equal(k({key:'!',code:'Digit1',shiftKey:true}),'shift+1');
  assert.equal(k({key:'Shift',code:'ShiftLeft',shiftKey:true}),'','수정키만 눌린 keydown 은 조합이 아니다(떼면 «톡»으로 따로 받는다)');
  assert.equal(k({key:'F5',code:'F5'}),'f5');
  assert.equal(mac.comboFix('mod+s'),'cmd+s');
  const win=comboCtx('Win32');
  assert.equal(win.comboFix('mod+s'),'ctrl+s');
  assert.equal(win.comboFix('Shift+N'),'shift+n');
  assert.equal(mac.normToolKey({key:'p',code:'KeyP'}),'p','옛 한 글자 키도 그대로');
});

function squadCtx(){
  const code=between('const SQ_POS=','async function squadLoad')+between('const SQ_SPOT=','/* ══ 2.975 · 선수단을')+src.slice(src.indexOf('function _sqTokSlots'),src.indexOf('function _sqDress'))+between('function _sqDress','\n');
  const ctx={PR:()=>({L:0,T:0,PW:1000,PH:680})};vm.createContext(ctx);
  vm.runInContext(code+';this._sqTokSlots=_sqTokSlots;this._sqAssign=_sqAssign;this._sqDress=_sqDress;',ctx);
  return ctx;
}

test('squad goes onto the positions already on the board, not a fixed 4-3-3 (2.975)',()=>{
  const c=squadCtx();
  const toks=[{id:1,num:'1',pos:'GK',x:45,y:340},{id:2,num:'3',pos:'LCB',x:150,y:240},{id:3,num:'5',pos:'RCB',x:150,y:440},{id:4,num:'9',pos:'ST',x:460,y:340},{id:5,num:'7',pos:'',x:430,y:100}];
  const slots=c._sqTokSlots(toks,false);
  assert.deepEqual(Array.from(slots,s=>s[3]),['GK','LCB','RCB','ST','LW'],'자리 이름은 표시 그대로, 없으면 위치로 짐작');
  const pool=[{id:'a',name:'키퍼',pos:'GK'},{id:'b',name:'센터백1',pos:'CB'},{id:'c',name:'센터백2',pos:'CB'},{id:'d',name:'공격수',pos:'ST'},{id:'e',name:'왼쪽 미드',pos:'LM'},{id:'f',name:'중앙',pos:'CM'}];
  const r=c._sqAssign(slots,pool,false);
  assert.deepEqual(Array.from(r.picked,p=>p&&p.name),['키퍼','센터백1','센터백2','공격수','왼쪽 미드'],'CB 둘은 LCB·RCB 로, LM 은 LW 자리로');
  assert.deepEqual(Array.from(r.extra,p=>p.name),['중앙'],'자리 없는 선수는 따로(같은 포지션 뒤 대기)');
  const t={id:2,num:'3',pos:'LCB',x:150,y:240};c._sqDress(t,pool[1]);
  assert.deepEqual({name:t.name,num:t.num,pos:t.pos,sqId:t.sqId,x:t.x},{name:'센터백1',num:'3',pos:'LCB',sqId:'b',x:150},'위치·자리는 그대로, 이름만 입힌다(번호는 선수 번호가 있을 때만)');
  const s=c._sqAssign(slots,[{id:'z',name:'아무나',pos:'CM'}],true);
  assert.equal(s.picked.filter(Boolean).length,1,'선발은 남는 자리에 아무나라도 채운다');
  const flipped=c._sqTokSlots([{id:9,num:'1',x:955,y:340}],true);
  assert.equal(flipped[0][3],'GK','반대편(오른쪽) 골대 쪽 1번도 키퍼');
});

test('MP4 muxer writes a playable ISO BMFF layout (2.975)',async()=>{
  const code=between('function _mp4Mux','window.__mp4Mux=_mp4Mux;');
  const ctx={Blob};vm.createContext(ctx);vm.runInContext(code+';this._mp4Mux=_mp4Mux;',ctx);
  const avcC=new Uint8Array([1,0x42,0xE0,0x28,0xFF,0xE1,0,4,0x67,0x42,0xE0,0x28,1,0,4,0x68,0xCE,0x3C,0x80]);
  const samples=[{key:true,data:new Uint8Array([0,0,0,3,0x65,1,2])},{key:false,data:new Uint8Array([0,0,0,2,0x41,9])},{key:true,data:new Uint8Array([0,0,0,1,0x65])}];
  const blob=ctx._mp4Mux(samples,avcC,1280,720,30);
  assert.equal(blob.type,'video/mp4');
  const b=new Uint8Array(await blob.arrayBuffer());
  const u32=o=>((b[o]<<24)>>>0)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3];
  const tag=o=>String.fromCharCode(b[o+4],b[o+5],b[o+6],b[o+7]);
  const top=[];for(let o=0;o<b.length;){const n=u32(o);assert.ok(n>=8,'box size');top.push([tag(o),o,n]);o+=n;}
  assert.deepEqual(top.map(x=>x[0]),['ftyp','moov','mdat'],'상자 순서');
  assert.equal(top[2][1]+top[2][2],b.length,'mdat 가 파일 끝까지');
  const find=t=>{const i=Buffer.from(b).indexOf(Buffer.from(t));assert.ok(i>=4,t);return i-4;};
  const stco=find('stco');assert.equal(u32(stco+16),top[2][1]+8,'stco 가 mdat 내용 시작을 가리킨다');
  const stsz=find('stsz');assert.equal(u32(stsz+16),3);assert.deepEqual([u32(stsz+20),u32(stsz+24),u32(stsz+28)],[7,6,5]);
  const stss=find('stss');assert.equal(u32(stss+12),2);assert.deepEqual([u32(stss+16),u32(stss+20)],[1,3],'열쇠 장면 1·3');
  const mdhd=find('mdhd');assert.equal(u32(mdhd+20),30000);assert.equal(u32(mdhd+24),3000,'3장면 · 1/30초씩');
  const tkhd=find('tkhd');assert.equal(u32(tkhd+84)>>>16,1280);assert.equal(u32(tkhd+88)>>>16,720);
  const avc=find('avcC');assert.deepEqual(Array.from(b.slice(avc+8,avc+8+avcC.length)),Array.from(avcC),'avcC 그대로');
  assert.deepEqual(Array.from(b.slice(top[2][1]+8)),[0,0,0,3,0x65,1,2,0,0,0,2,0x41,9,0,0,0,1,0x65]);
});
