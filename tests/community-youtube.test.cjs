const test=require('node:test');
const assert=require('node:assert/strict');
const yt=require('../studio/community-youtube.js');
const owner='33a9d4e2-1868-40f4-8f82-3ebb4ecf011e',id='c5qzlz7t8hI';
test('video links accept YouTube share/watch/shorts/embed/live formats and strip tracking',()=>{
  for(const url of ['https://youtu.be/'+id+'?si=tracking','https://www.youtube.com/watch?v='+id+'&t=32','https://m.youtube.com/watch?v='+id,'https://youtube.com/shorts/'+id,'https://youtube.com/embed/'+id,'https://youtube.com/live/'+id]){
    assert.equal(yt.videoId(url),id);assert.equal(yt.canonical(url),'https://www.youtube.com/watch?v='+id);
  }
});
test('invalid links cannot turn a thumbnail or source link into a foreign URL or HTML',()=>{
  for(const value of [null,{},'<img onerror=alert(1)>','javascript:alert(1)','https://youtube.com.evil.test/watch?v='+id,'https://youtube.com@evil.test/watch?v='+id,'https://evil.test/youtu.be/'+id,'https://youtu.be/'+id+'/extra','https://youtube.com/playlist?list='+id,'https://youtube.com/watch?v=short','https://youtube.com:999/watch?v='+id,'https://user:pass@youtube.com/watch?v='+id])assert.equal(yt.videoId(value),'');
});
test('all five existing posts map to their source videos and never by a spoofed name',()=>{
  const expected={Cmvrx0ojpstsx:id,Cmvquqwqvag2b:'zVXyNQeFE5U',Cmvjm1wl966iv:'DEENs8TVPGY',Cmvat5mje0gnu:'MMG4OQ8EFgM',Cmvat3c6ssazc:'1fGEsnvyTdU'};
  for(const [postId,videoId] of Object.entries(expected)){
    assert.equal(yt.resolve({owner,id:postId}).id,videoId);
    assert.equal(yt.resolve({owner:'someone-else',owner_name:'엘미하',id:postId}),null);
  }
  assert.equal(yt.resolve({owner,id:'toString'}),null);
  assert.equal(yt.resolve({owner,id:'new',title:'26.10.25.(일) 첼시 0:2 토트넘 | PL'}),null);
});
test('saved metadata overrides the initial catalog, survives board edits and does not change board data',()=>{
  const post={owner,id:'Cmvrx0ojpstsx',youtubeUrl:'https://youtu.be/zVXyNQeFE5U'},item={name:'전술',snap:{players:[]},frames:[{hold:1}]};
  assert.equal(yt.resolve(post).id,'zVXyNQeFE5U');
  const result=yt.preserve(post,structuredClone(item));
  assert.deepEqual(result,{...item,youtubeUrl:'https://www.youtube.com/watch?v=zVXyNQeFE5U'});
  assert.equal(yt.resolve({owner,id:'new',item:result}).id,'zVXyNQeFE5U');
  assert.equal(yt.resolve({...post,youtubeUrl:''}),null);
  assert.equal(yt.resolve({...post,youtubeUrl:'https://evil.test/'}),null);
  assert.deepEqual(yt.preserve({owner:'someone-else',youtubeUrl:post.youtubeUrl},structuredClone(item)),item);
});
