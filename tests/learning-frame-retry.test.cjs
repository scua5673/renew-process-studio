'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../studio/app.html'),'utf8');
function fnSrc(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);let depth=0,i=html.indexOf('{',start);for(;i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}'&&!--depth)break;}return html.slice(start,i+1);}
const ctx=vm.createContext({});vm.runInContext(fnSrc('psBlankFrameStalled')+'\n'+fnSrc('ensureAppFrame'),ctx);
function frame(url,at=1000,src='scout.html'){return {getAttribute:()=>src,__psLoadAt:at,contentWindow:{location:{href:url}}};}
test('cancelled preloads can retry after the grace period without reloading a real document',()=>{
 assert.equal(ctx.psBlankFrameStalled(frame('about:blank'),9000),false);
 assert.equal(ctx.psBlankFrameStalled(frame('about:blank'),9001),true);
 assert.equal(ctx.psBlankFrameStalled(frame('about:blank#empty'),9001),true);
 assert.equal(ctx.psBlankFrameStalled(frame('https://example.invalid/studio/scout.html'),9001),false);
 assert.equal(ctx.psBlankFrameStalled(frame('about:blank',1000,''),9001),false);
 assert.equal(ctx.psBlankFrameStalled(frame('about:blank',0),9001),false);
 assert.equal(ctx.psBlankFrameStalled(null,9001),false);
 const denied={getAttribute:()=> 'frame.html',__psLoadAt:1000,get contentWindow(){throw Error('cross-origin');}};
 assert.equal(ctx.psBlankFrameStalled(denied,9001),false);
});
test('frame loader preserves a loaded editor and reloads only an empty stalled preload',()=>{
 let writes=0,removes=0,src='scout.html',url='about:blank';
 const fr={dataset:{},__psLoadAt:1000,contentWindow:{location:{get href(){return url;}}},getAttribute:()=>src,removeAttribute:()=>{src='';removes++;},setAttribute:(k,v)=>{src=v;writes++;},addEventListener:()=>{}};
 Object.assign(ctx,{Date:{now:()=>10000},shellSwitchBlocked:false,PS_BUILD:'test',currentTeamKey:'team',psSchedOpenMode:x=>x});
 for(const name of ['fScout','fProcess','fGameModel','fTerms','fIdp','fNote','fScouting','fComm','fAnalysis','fPlaybook','fLearning'])ctx[name]=fr;
 assert.equal(ctx.ensureAppFrame('scout'),fr);assert.equal(writes,1);assert.equal(removes,1);assert.equal(fr.__psLoadAt,10000);assert.equal(fr.__psReady,false);
 // A second click inside the grace period must not cancel the replacement request.
 ctx.ensureAppFrame('scout');assert.equal(writes,1);
 url='https://example.invalid/studio/scout.html';fr.__psLoadAt=1;ctx.ensureAppFrame('scout');assert.equal(writes,1);
 ctx.shellSwitchBlocked=true;assert.equal(ctx.ensureAppFrame('scout'),null);assert.equal(writes,1);
});
