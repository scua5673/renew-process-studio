/* 저장 팀 선수 사진 — 이 기기에만(제보 4116fc54 · 사용자 «아이패드에도 따로 · 컴퓨터에도 따로»). 서버로 가지 않는다.
   사진 바이트는 PSImg(IndexedDB psimg_*), 선수 → 사진 표는 cs_team_photos_v1(IndexedDB, 이 기기 키)에 {v:1, teams:{팀 id:{선수 id:'psimg:…'}}}.
   ⚠ 동기화되는 저장 팀 문서(cs_analysis_team_library_v1)에는 사진 · 참조를 한 글자도 넣지 않는다 — 기기마다 참조가 달라 서로 덮고, 다른 기기엔 없는 참조가 간다.
   선수는 저장 팀의 선수 id 로 찾는다(순서 바꾸기 · 다른 선수 이름 바꾸기와 무관). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSTeamPhotos=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
var KEY='cs_team_photos_v1',SIZE=192,REF=/^psimg:psimg_[A-Za-z0-9_-]+$/;
function empty(){return {v:1,teams:{}};}
function parse(raw){try{var o=typeof raw==='string'?JSON.parse(raw):raw;if(o&&typeof o==='object'&&o.teams&&typeof o.teams==='object'&&!Array.isArray(o.teams))return o;}catch(_){}return empty();}
function team(map,teamId){var t=map&&map.teams&&map.teams[teamId];return t&&typeof t==='object'?t:{};}
/* 표만 바꾼다(순수). refs: {선수 id: 새 참조 | null(지우기)}, keep: 지금 팀에 있는 선수 id — 빠진 선수의 사진도 지운다. drop = 이제 아무도 안 쓰는 참조 */
function apply(map,teamId,refs,keep){
 var next=JSON.parse(JSON.stringify(parse(map))),cur=team(next,teamId),out={},drop=[],live={};
 (keep||[]).forEach(function(id){if(id)live[id]=1;});
 Object.keys(cur).forEach(function(id){var r=cur[id];if(!REF.test(r))return;if(!live[id]||(refs&&Object.prototype.hasOwnProperty.call(refs,id)&&refs[id]!==r))drop.push(r);else out[id]=r;});
 Object.keys(refs||{}).forEach(function(id){var r=refs[id];if(live[id]&&typeof r==='string'&&REF.test(r))out[id]=r;});
 if(Object.keys(out).length)next.teams[teamId]=out;else delete next.teams[teamId];
 return {map:next,drop:drop.filter(function(r,i){return drop.indexOf(r)===i&&!Object.keys(out).some(function(id){return out[id]===r;});})};
}
function read(w){return Promise.resolve(w.storage.get(KEY)).then(function(r){return parse(r&&r.value);});}
function bytes(w,ref){var s='';try{s=w.PSImg&&w.PSImg.src?w.PSImg.src(ref):'';}catch(_){}
 if(/^data:image\//.test(s||''))return Promise.resolve(s);
 /* 다른 화면이 방금 올린 사진은 이 화면 PSImg 메모리에 없다 — 저장소에서 바로 */
 return Promise.resolve(w.storage.get(ref.slice(6))).then(function(r){return r&&typeof r.value==='string'&&/^data:image\//.test(r.value)?r.value:'';},function(){return '';});}
/* 한 팀의 사진 {선수 id: data URL} — 작전판 불러오기 · 팀 등록 화면이 쓴다 */
function images(w,teamId){return read(w).then(function(map){var t=team(map,teamId),out={};
 return Promise.all(Object.keys(t).map(function(id){if(!REF.test(t[id]))return;return bytes(w,t[id]).then(function(s){if(s)out[id]=s;});})).then(function(){return out;});});}
/* 작전판 불러오기용 — 사진을 못 읽어도(저장소 멈춤 · 계정 전환) 2.5초 안에 사진 없이 이어 간다 */
function forLoad(w,teamId){return Promise.race([images(w,teamId).catch(function(){return {};}),new Promise(function(r){setTimeout(function(){r({});},2500);})]);}
/* 팀을 저장한 뒤 부른다. edits: {선수 id: data URL | null}. 새 사진을 먼저 넣고 → 표를 쓰고 → 안 쓰는 사진을 지운다(중간에 실패해도 표가 없는 사진을 가리키지 않게) */
function commit(w,teamId,edits,keep){
 function run(){
  var refs={},ids=Object.keys(edits||{}).filter(function(id){return (keep||[]).indexOf(id)>=0;});
  return ids.reduce(function(p,id){return p.then(function(){var v=edits[id];if(v==null){refs[id]=null;return;}
   return w.PSImg.put(v).then(function(r){if(!REF.test(r))throw Error('사진을 저장하지 못했습니다.');refs[id]=r;});});},Promise.resolve())
  .then(function(){return read(w);}).then(function(map){
   var res=apply(map,teamId,refs,keep),before=JSON.stringify(map),raw=JSON.stringify(res.map);
   return (raw===before?Promise.resolve():Promise.resolve(w.storage.set(KEY,raw))).then(function(){
    return Promise.all(res.drop.map(function(r){return Promise.resolve(w.PSImg.del(r)).catch(function(){});}));
   });
  }).catch(function(e){   /* 표를 못 썼으면 방금 넣은 사진도 지운다 — 남는 사진이 없게 */
   return Promise.all(Object.keys(refs).map(function(id){return refs[id]&&Promise.resolve(w.PSImg.del(refs[id])).catch(function(){});})).then(function(){throw e;});
  }).then(function(){return images(w,teamId);});
 }
 if(w.navigator&&w.navigator.locks&&w.navigator.locks.request)return w.navigator.locks.request('ps-team-photos-v1',run);
 return run();
}
/* 고른 그림을 가운데 정사각형으로 잘라 작게(192px JPEG) — 화면마다 PSImg 가 사진을 모두 메모리에 올리므로 작게 둔다. 투명한 곳은 흰색 */
function square(file,doc){
 doc=doc||document;
 return new Promise(function(res,rej){var url=URL.createObjectURL(file),img=new Image();
  img.onload=function(){try{var s=Math.min(img.naturalWidth,img.naturalHeight);if(!s)throw Error('empty');var c=doc.createElement('canvas');c.width=c.height=SIZE;var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,SIZE,SIZE);
   g.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,SIZE,SIZE);res(c.toDataURL('image/jpeg',0.82));}catch(e){rej(e);}finally{URL.revokeObjectURL(url);}};
  img.onerror=function(){URL.revokeObjectURL(url);rej(Error('이미지를 읽지 못했습니다.'));};img.src=url;});
}
return {key:KEY,size:SIZE,parse:parse,apply:apply,read:read,images:images,forLoad:forLoad,commit:commit,square:square};
});
