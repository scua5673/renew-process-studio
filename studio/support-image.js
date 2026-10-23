/* One bounded private support image. Its draft never enters team storage or logs. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSSupportImage=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var MAX_BYTES=524288,MAX_SOURCE=10*1024*1024,MAX_PIXELS=12000000,PREFIX='ps_support_image_v1:';
  function fault(code){var e=new Error(code);e.code=code;return e;}
  function dimensions(bytes){
    var a=new Uint8Array(bytes),v=new DataView(a.buffer,a.byteOffset,a.byteLength),n=a.length,w=0,h=0,i,len,m;
    if(n>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a){
      w=v.getUint32(16);h=v.getUint32(20);
      var foundData=false;
      for(i=8;i+12<=n;){len=v.getUint32(i);m=v.getUint32(i+4);if(m===0x6163544c)throw fault('image_format');if(m===0x49444154){foundData=true;break;}i+=len+12;}
      if(!foundData)throw fault('image_format');
    }else if(n>4&&a[0]===255&&a[1]===216){
      i=2;while(i+4<n){if(a[i]!==255)break;while(a[i]===255)i++;m=a[i++];if(i+2>n||m===218||m===217)break;len=v.getUint16(i);if(len<2||i+len>n)break;
        if([192,193,194,195,197,198,199,201,202,203,205,206,207].indexOf(m)>=0&&len>=8){h=v.getUint16(i+3);w=v.getUint16(i+5);break;}i+=len;}
    }else if(n>=30&&v.getUint32(0)===0x52494646&&v.getUint32(8)===0x57454250){
      m=v.getUint32(12);
      if(m===0x56503858){if(a[20]&2)throw fault('image_format');w=1+a[24]+(a[25]<<8)+(a[26]<<16);h=1+a[27]+(a[28]<<8)+(a[29]<<16);}
      else if(m===0x5650384c&&a[20]===47){w=1+a[21]+((a[22]&63)<<8);h=1+(a[22]>>6)+(a[23]<<2)+((a[24]&15)<<10);}
      else if(m===0x56503820&&a[23]===157&&a[24]===1&&a[25]===42){w=v.getUint16(26,true)&16383;h=v.getUint16(28,true)&16383;}
    }
    if(!w||!h)throw fault('image_format');
    if(w*h>MAX_PIXELS||w>16384||h>16384)throw fault('image_resolution');
    return {width:w,height:h};
  }
  function valid(image){if(!image||image.mime!=='image/jpeg'||typeof image.data!=='string'||image.data.length>699052||image.data.length%4||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image.data))return false;var bytes=image.data.length*3/4-(image.data.endsWith('==')?2:image.data.endsWith('=')?1:0);return bytes===image.bytes&&bytes>0&&bytes<=MAX_BYTES&&Number.isInteger(image.width)&&image.width>0&&image.width<=2048&&Number.isInteger(image.height)&&image.height>0&&image.height<=2048;}
  function message(e){return {
    image_size:'10MB 이하의 이미지를 골라 주세요.',image_resolution:'이미지 해상도가 너무 큽니다. 필요한 부분을 잘라 다시 첨부해 주세요.',
    image_format:'PNG·JPG·WebP 정지 이미지를 골라 주세요. 이 파일은 읽을 수 없습니다.',image_compress:'이미지를 충분히 줄이지 못했습니다. 필요한 부분을 잘라 다시 첨부해 주세요.',
    image_storage:'이미지는 현재 창에만 보관됐습니다. 접수가 끝날 때까지 이 창을 닫지 마세요.',image_missing:'임시 이미지를 읽지 못했습니다. 작성한 글은 유지됩니다. 접수 내역을 확인하거나 이미지를 다시 선택해 주세요.'
  }[e&&e.code]||'이미지를 준비하지 못했습니다. 다른 이미지로 다시 시도해 주세요.';}
  async function prepare(file,w){
    if(!file||!file.size||file.size>MAX_SOURCE)throw fault('image_size');
    if(!/^image\/(png|jpeg|webp)$/.test(file.type||''))throw fault('image_format');
    dimensions(await file.slice(0,262144).arrayBuffer());
    var url=w.URL.createObjectURL(file),img=new w.Image(),canvas=w.document.createElement('canvas'),timer;
    try{
      await new Promise(function(resolve,reject){timer=w.setTimeout(function(){reject(fault('image_format'));},15000);img.onload=resolve;img.onerror=function(){reject(fault('image_format'));};img.src=url;});
      if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>MAX_PIXELS)throw fault('image_resolution');
      var ratio=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight)),result,raw;
      for(var scale=0;scale<4;scale++){
        canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
        var ctx=canvas.getContext('2d');if(!ctx)throw fault('image_compress');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        for(var quality of [.85,.72,.58]){
          raw=canvas.toDataURL('image/jpeg',quality).split(',')[1]||'';
          var size=Math.floor(raw.length*3/4)-(raw.endsWith('==')?2:raw.endsWith('=')?1:0);
          if(size<=MAX_BYTES){result={mime:'image/jpeg',data:raw,bytes:size,width:canvas.width,height:canvas.height};break;}
        }
        if(result)break;ratio*=.75;
      }
      if(!valid(result))throw fault('image_compress');
      var binary=w.atob(result.data),bytes=Uint8Array.from(binary,function(c){return c.charCodeAt(0);});
      var digest=await w.crypto.subtle.digest('SHA-256',bytes);result.hash=Array.from(new Uint8Array(digest),function(b){return b.toString(16).padStart(2,'0');}).join('');
      return result;
    }finally{w.clearTimeout(timer);img.onload=null;img.onerror=null;img.src='';w.URL.revokeObjectURL(url);canvas.width=canvas.height=1;}
  }
  function createStore(w){
    var dbPromise=null;
    function open(){
      if(dbPromise)return dbPromise;
      dbPromise=new Promise(function(resolve,reject){
        var req,done=false,timer=w.setTimeout(function(){done=true;dbPromise=null;reject(fault('image_storage'));},3000);
        function fail(){if(done)return;done=true;w.clearTimeout(timer);dbPromise=null;reject(fault('image_storage'));}
        try{req=w.indexedDB.open('ps-support-images',1);}catch(_){fail();return;}
        req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains('drafts'))req.result.createObjectStore('drafts');};
        req.onerror=fail;req.onblocked=fail;req.onsuccess=function(){if(done){req.result.close();return;}done=true;w.clearTimeout(timer);var db=req.result;db.onversionchange=function(){db.close();dbPromise=null;};resolve(db);};
      }).catch(function(e){dbPromise=null;throw e;});return dbPromise;
    }
    function transaction(uid,mode,action){
      if(!uid)return Promise.reject(fault('image_storage'));
      return open().then(function(db){return new Promise(function(resolve,reject){var tx,value,timer;
        try{tx=db.transaction('drafts',mode);timer=w.setTimeout(function(){try{tx.abort();}catch(_){}reject(fault('image_storage'));},5000);tx.onerror=tx.onabort=function(){w.clearTimeout(timer);reject(fault('image_storage'));};tx.oncomplete=function(){w.clearTimeout(timer);resolve(value);};action(tx.objectStore('drafts'),PREFIX+uid,function(v){value=v;});}catch(_){w.clearTimeout(timer);reject(fault('image_storage'));}
      });});
    }
    return {
      get:function(uid){return transaction(uid,'readonly',function(s,k,set){var req=s.get(k);req.onsuccess=function(){set(req.result||null);};});},
      put:function(uid,image){if(!valid(image)||typeof image.id!=='string')return Promise.reject(fault('image_storage'));return transaction(uid,'readwrite',function(s,k){s.put(image,k);});},
      remove:function(uid,id){return transaction(uid,'readwrite',function(s,k){var req=s.get(k);req.onsuccess=function(){if(req.result&&req.result.id===id)s.delete(k);};});}
    };
  }
  function viewer(w,host,request){
    if(!host||host.dataset.imageMounted)return;host.dataset.imageMounted='1';
    var button=w.document.createElement('button');button.type='button';button.textContent='첨부 이미지 보기';host.appendChild(button);
    button.addEventListener('click',function(){
      button.disabled=true;button.textContent='이미지를 불러오는 중…';
      Promise.resolve().then(request).then(function(image){
        if(!host.isConnected)return;if(!valid(image))throw fault('image_format');
        var img=w.document.createElement('img');img.alt='제보에 첨부한 이미지';img.src='data:image/jpeg;base64,'+image.data;img.width=image.width;img.height=image.height;img.tabIndex=0;
        img.title='누르면 원래 크기로 볼 수 있습니다';img.setAttribute('role','button');img.setAttribute('aria-expanded','false');function zoom(){img.setAttribute('aria-expanded',String(host.classList.toggle('is-expanded')));}img.addEventListener('click',zoom);img.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();zoom();}});
        host.replaceChildren(img);var hint=w.document.createElement('p');hint.textContent='이미지를 누르면 확대·축소할 수 있습니다.';host.appendChild(hint);
      }).catch(function(){if(host.isConnected){button.disabled=false;button.textContent='이미지를 불러오지 못했습니다 · 다시 시도';}});
    });
  }
  return {MAX_BYTES:MAX_BYTES,MAX_SOURCE:MAX_SOURCE,PREFIX:PREFIX,dimensions:dimensions,valid:valid,message:message,prepare:prepare,createStore:createStore,viewer:viewer};
});
