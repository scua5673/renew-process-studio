const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('studio/app.html','utf8');
const start=html.indexOf("if(app==='board'){try{var _bw=fBoard.contentWindow"),end=html.indexOf("else if(app==='note')",start);
assert.ok(start>0&&end>start);
function enter(done,cap,fail=false,dirty=false,base={},restoring=0,loaded=true){const w={_boardPrivateLoaded:loaded,__boardRestoreDone:done,_boardPrivateBase:base,__boardRestoring:restoring,__capLock:cap,dirty,boardShowDefault(){this.seen=this.__capLock;if(!this.__capLock)this.dirty=true;if(fail)throw Error('synthetic render failure');}};vm.runInNewContext(html.slice(start,end),{app:'board',fBoard:{contentWindow:w}});return w;}
test('initial routing render cannot turn a pending server restore into a local edit',()=>{const w=enter(false,undefined);assert.equal(w.seen,1);assert.equal(w.dirty,false);assert.equal(w.__capLock,undefined);});
test('routing preserves an existing user edit and capture lock, including render failure',()=>{for(const cap of [undefined,7]){const w=enter(false,cap,true,true);assert.equal(w.dirty,true);assert.equal(w.__capLock,cap);}});
test('normal board activation after restore keeps its existing save behavior',()=>{const w=enter(true,undefined);assert.equal(w.seen,undefined);assert.equal(w.dirty,true);});

test('a completed bootstrap without a verified server base still cannot manufacture an edit',()=>{const w=enter(true,undefined,false,false,null);assert.equal(w.dirty,false);});
test('a later server restore with a cached base also suppresses routing renders',()=>{const w=enter(true,undefined,false,false,{},3);assert.equal(w.dirty,false);assert.equal(w.__capLock,undefined);});

test('a guest with no personal restore keeps ordinary board routing',()=>{const w=enter(true,undefined,false,false,null,0,false);assert.equal(w.dirty,true);assert.equal(w.seen,undefined);});
