/* YouTube artwork and source links for Elmiha's tactical notes. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSCommunityYouTube=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var OWNER='33a9d4e2-1868-40f4-8f82-3ebb4ecf011e';
  /* Existing posts verified against @ELMIHA_TacticalNote on 2026-10-30.
     Explicit per-post metadata takes precedence; titles are never fuzzy-matched. */
  var LEGACY={
    Cmvrx0ojpstsx:'c5qzlz7t8hI',
    Cmvquqwqvag2b:'zVXyNQeFE5U',
    Cmvjm1wl966iv:'DEENs8TVPGY',
    Cmvat5mje0gnu:'MMG4OQ8EFgM',
    Cmvat3c6ssazc:'1fGEsnvyTdU'
  };
  function videoId(value){
    if(typeof value!=='string'||value.length>2048)return '';
    var u,id='',parts;
    try{u=new URL(value.trim());}catch(_){return '';}
    if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port)return '';
    if(u.hostname==='youtu.be')id=u.pathname.slice(1);
    else if(/^(www\.|m\.|music\.)?youtube\.com$/.test(u.hostname)){
      if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
      else {parts=u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/);if(parts)id=parts[1];}
    }
    return /^[\w-]{11}$/.test(id)?id:'';
  }
  function canonical(value){var id=videoId(value);return id?'https://www.youtube.com/watch?v='+id:'';}
  function metadata(post){
    if(post&&post.youtubeUrl!=null)return post.youtubeUrl;
    return post&&post.item&&post.item.youtubeUrl!=null?post.item.youtubeUrl:null;
  }
  function resolve(post){
    if(!post||post.owner!==OWNER)return null;
    var saved=metadata(post),id=saved===null?(Object.prototype.hasOwnProperty.call(LEGACY,post.id)?LEGACY[post.id]:''):videoId(saved);
    return id?{id:id,url:'https://www.youtube.com/watch?v='+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg',fallback:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'}:null;
  }
  function preserve(post,item){
    if(post&&post.owner===OWNER&&metadata(post)!==null)item.youtubeUrl=canonical(metadata(post));
    return item;
  }
  function artwork(host,video){
    var doc=host.ownerDocument,original=Array.prototype.slice.call(host.childNodes),img=doc.createElement('img'),stage=0;
    img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    function failed(){
      if(stage++===0){img.src=video.fallback;return;}
      img.onerror=img.onload=null;host.replaceChildren.apply(host,original);host.classList.remove('el-video-art');
    }
    img.onerror=failed;
    img.onload=function(){if(img.naturalWidth<=120)failed();};
    host.classList.add('el-video-art');host.replaceChildren(img);img.src=video.thumbnail;
  }
  function mountCard(card,post){
    var v=resolve(post);if(!v)return;
    var host=card.querySelector('.th'),body=card.querySelector('.bd');if(!host||!body)return;
    artwork(host,v);
    var link=card.ownerDocument.createElement('a');link.className='el-video-link';link.href=v.url;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='영상 보기 ↗';link.setAttribute('aria-label',(post.title||'전술노트')+' — 유튜브 영상 새 탭에서 보기');
    link.onclick=link.ondblclick=function(e){e.stopPropagation();};
    body.appendChild(link);
    var cue=body.querySelector('.open-cue');if(cue){cue.textContent='전술 보기 →';cue.setAttribute('aria-label',(post.title||'전술노트')+' — 전술 보기');}
    var meta=body.querySelector('.meta');if(meta&&!post.cat&&!post.age&&!post.players)meta.remove();
  }
  function uploadField(doc,host){
    if(!host||host.querySelector('#upYoutube'))return;
    var row=doc.createElement('div');row.className='fld el-video-field';
    row.innerHTML='<label for="upYoutube">유튜브 영상 링크 (선택)</label><input type="text" inputmode="url" id="upYoutube" maxlength="2048" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" aria-describedby="upYoutubeHint"><div class="hint" id="upYoutubeHint">영상 링크를 넣으면 카드에 썸네일과 유튜브 보기 링크가 나타나요.</div>';
    host.insertBefore(row,host.querySelector('.drow'));
    row.querySelector('input').oninput=function(){this.removeAttribute('aria-invalid');};
  }
  function readUpload(doc){
    var input=doc.getElementById('upYoutube');if(!input)return {ok:true,url:''};
    var raw=input.value.trim(),url=canonical(raw);
    if(raw&&!url){input.setAttribute('aria-invalid','true');input.focus();return {ok:false,url:''};}
    return {ok:true,url:url};
  }
  return {videoId:videoId,canonical:canonical,resolve:resolve,preserve:preserve,mountCard:mountCard,uploadField:uploadField,readUpload:readUpload};
});
