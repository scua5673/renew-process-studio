const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.091 — 폰 강제 종료(설치 앱이 켜진 지 5초에 꺼짐). 동기화는 회차마다 보관함 자료마다 지문(libHash)을 잰다.
   예전 지문은 자료를 통째로 복사(libShareCopy: 직렬화 · 해석 · 훑기)한 뒤 다시 직렬화했다 — 21MB 보관함이면 회차마다 0.3GB 의 쓰레기.
   새 지문(libShareJSON)은 같은 규칙을 JSON.stringify 의 replacer 로 한 번에 적는다.
   지문 글이 한 글자라도 다르면 기기에 적어 둔 기준(m.li[id].h)과 어긋나 모든 자료가 «바뀜»으로 다시 올라간다 — 그래서 옛 글과 똑같은지 본다. */
const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const CODE=cut(sync,'function hash(s){','\n')+'\n'+cut(sync,'function libShareCopy(it){','\nfunction libHash(it)')+'\n'+cut(sync,'function libHash(it){','\n');
function api(){ const c=vm.createContext({}); vm.runInContext(CODE+';this.api={libShareCopy,libShareJSON,libHash,hash};',c); return c.api; }
const g=api();
const old=it=>JSON.stringify(g.libShareCopy(it));

const IMG='data:image/png;base64,iVBORw0KGgo=',VID='DATA:Video/mp4;base64,AAAA';
function rng(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
const KEYS=['x','y','name','thumb','photo','Image','video','logo','avatar','dataUrl','dataURL','_teamSource','_teamSharedAt','_teamSharePending','','0','12','__proto__','constructor','snap','frames','tags','선수','imageUrl','photos'];
function val(r,d){
  const p=r();
  if(d>4||p<0.30){
    const q=r();
    if(q<0.10)return IMG; if(q<0.14)return VID; if(q<0.18)return 'data:text/plain,hi'; if(q<0.22)return ' '+IMG;
    if(q<0.30)return Math.round(r()*1e6)/1e3; if(q<0.34)return -0; if(q<0.36)return NaN; if(q<0.38)return Infinity;
    if(q<0.42)return null; if(q<0.46)return undefined; if(q<0.50)return r()<0.5; if(q<0.54)return '\ud800 홀로'; if(q<0.58)return '"따옴표"\n\\';
    if(q<0.62)return new Date(1700000000000+Math.floor(r()*1e9)); if(q<0.64)return ()=>1;
    return 'txt'+Math.floor(r()*100);
  }
  if(p<0.55){ const n=Math.floor(r()*5); const a=[]; for(let i=0;i<n;i++)a.push(val(r,d+1)); if(r()<0.1)a[n+2]=val(r,d+1); return a; }   // 구멍 있는 배열도
  const o={}; const n=Math.floor(r()*6);
  for(let i=0;i<n;i++)o[KEYS[Math.floor(r()*KEYS.length)]]=val(r,d+1);
  if(r()<0.05)o.toJSON=function(){ return {fromToJSON:true,photo:'p',inner:IMG}; };
  return o;
}

test('the new fingerprint text is exactly the old one — random items with every rule and JSON corner',()=>{
  let n=0;
  for(let seed=1;seed<=4000;seed++){
    const r=rng(seed),it={libId:'L'+seed,type:'board',name:'자료 '+seed};
    const k=Math.floor(r()*8); for(let i=0;i<k;i++)it[KEYS[Math.floor(r()*KEYS.length)]]=val(r,0);
    assert.equal(g.libShareJSON(it),old(it),'seed '+seed); n++;
    assert.equal(g.libHash(it),g.hash(old(it)));
  }
  assert.equal(n,4000);
});

test('the rules themselves: top-level card fields go, inner thumbs stay, pictures and videos go everywhere',()=>{
  const it={libId:'L1',type:'board',name:'작전판',thumb:'<svg/>',_teamSource:'mine',_teamSharedAt:5,_teamSharePending:true,
    photo:'https://x/y.png',pages:[{thumb:'<svg data-p/>',snap:{players:[{id:1,photo:'face',avatar:IMG,x:1}]},bg:IMG}],frames:[IMG,'keep',VID],
    trainings:[{logo:{nested:IMG},image:7}]};
  const s=g.libShareJSON(it);
  assert.equal(s,old(it));
  const o=JSON.parse(s);
  assert.equal(o.thumb,undefined); assert.equal(o._teamSource,undefined); assert.equal(o._teamSharedAt,undefined); assert.equal(o._teamSharePending,undefined);
  assert.equal(o.photo,undefined,'열쇠가 photo 인 글은 어디서든 뺀다');
  assert.equal(o.pages[0].thumb,'<svg data-p/>','안쪽 thumb 은 남는다');
  assert.equal(o.pages[0].bg,undefined); assert.deepEqual(o.pages[0].snap.players[0],{id:1,x:1});
  assert.deepEqual(o.frames,[null,'keep',null],'배열 칸의 그림은 null — delete 로 생긴 구멍과 같다');
  assert.deepEqual(o.trainings[0],{logo:{},image:7},'글이 아닌 photo · image 값은 남는다(안의 그림만 빠짐)');
});

test('odd inputs keep the old behaviour (same text, or both throw)',()=>{
  const run=f=>{ try{ return {ok:f()}; }catch(e){ return {threw:true}; } };
  const cyc={libId:'C',name:'고리'}; cyc.self=cyc;
  const topCyc={libId:'T',name:'맨 위 고리'}; topCyc._teamSource={}; topCyc._teamSource.me=topCyc._teamSource;
  const odd=[null,undefined,'abc',IMG,42,true,[1,IMG,{thumb:'t',photo:'p'}],{a:1n},{libId:'B',thumb:1n},{libId:'B2',_teamSharedAt:5n},topCyc,cyc,
    {thumb:{x:1n}},{toJSON(){ return undefined; }},{toJSON(){ return IMG; }},{toJSON(){ return [IMG,{photo:'x'}]; }},{toJSON(){ return null; }},
    {libId:'G',get photo(){ throw new Error('getter'); }},{libId:'H',get thumb(){ throw new Error('getter'); }},{libId:'F',thumb:()=>1,_teamSource:Symbol('s')},
    Object.assign(Object.create(new Date(0)),{libId:'D'}),{libId:'S',nested:{when:new Date(5),photo:new Date(6)}}];
  for(const it of odd)assert.deepEqual(run(()=>g.libShareJSON(it)),run(()=>old(it)),Object.prototype.toString.call(it));
  assert.equal(old(cyc),'{}'); assert.equal(old(topCyc),'{}','빠질 칸에 고리가 있어도 옛 길은 통째로 {} — 새 길도 같다');
});

test('a big board shaped like the phone report gives the same text',()=>{
  const r=rng(7),pt=()=>Math.round(r()*300000)/1000;
  const snap=()=>({area:'full',ball:{x:pt(),y:pt(),id:'ball'},players:Array.from({length:22},(_,i)=>({id:'p'+i,x:pt(),y:pt(),num:String(i+1),name:'선수 '+(i+1),photo:i%5?undefined:'face'+i})),arrows:[{x1:pt(),y1:pt(),x2:pt(),y2:pt()}]});
  const it={libId:'B',type:'board',name:'큰 작전판',thumb:IMG,pages:Array.from({length:8},(_,p)=>({name:'페이지 '+p,thumb:IMG+p,snap:snap(),anim:{frames:Array.from({length:8},()=>({dur:1,snap:snap()}))}}))};
  assert.equal(g.libShareJSON(it),old(it));
});

test('sync uses the new fingerprint and still builds upload rows from libShareCopy',()=>{
  assert.match(sync,/\nfunction libHash\(it\)\{return hash\(libShareJSON\(it\)\);\}/);
  assert.match(sync,/function libRow\(it,t,wid,priv\)\{ var clean=libShareCopy\(it\);/,'올리는 줄(공유본)은 그대로 libShareCopy');
});
