'use strict';
// 2.899 — 공지 읽은 시각(noticeSeen)은 새 공지가 있을 때만 자기 IDP 문서에 쓴다.
// 화면을 그릴 때마다 now 를 적어 저장하던 옛 코드는 IDP 가 열린 두 기기 사이에서 5초마다 저장을 주고받았다.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const impl=part('function ntcMarkSeen(){','function ntcWhen(ts){');

function setup({items,seen,readOnly=false}){
  const store={cs_team_notice_v1:JSON.stringify({items})};
  const state={saves:0};
  let clock=1790000000000;
  const c=vm.createContext({
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},
    Date:{now:()=>(clock+=1000)},
    doc:{noticeSeen:seen},_idpEditBase:{},
    ro:()=>readOnly,save:()=>{state.saves++;},
    ntcItems:()=>items
  });
  vm.runInContext(impl,c,{filename:'ntc-mark-seen.js'});
  return {c,state,store};
}

test('marking notices seen writes the IDP document once for a new notice, not on every redraw',()=>{
  const h=setup({items:[{id:'n1',text:'공지',at:1789999990000}],seen:1789999000000});
  for(let i=0;i<10;i++)h.c.ntcMarkSeen();
  assert.equal(h.state.saves,1);
  assert.ok(h.c.doc.noticeSeen>=1789999990000);
});

test('no write when every notice is already seen (another device already recorded a later time)',()=>{
  const h=setup({items:[{id:'n1',text:'공지',at:1789999990000}],seen:1790000500000});
  for(let i=0;i<10;i++)h.c.ntcMarkSeen();
  assert.equal(h.state.saves,0);
  assert.equal(h.c.doc.noticeSeen,1790000500000);
  assert.ok(+h.store.ps_notice_seen_v1>0,'device-local seen time still updates');
});

test('no write without notices and never for a read-only view',()=>{
  const none=setup({items:[],seen:0});none.c.ntcMarkSeen();assert.equal(none.state.saves,0);
  const ro=setup({items:[{id:'n1',text:'공지',at:1789999990000}],seen:0,readOnly:true});ro.c.ntcMarkSeen();assert.equal(ro.state.saves,0);
});
