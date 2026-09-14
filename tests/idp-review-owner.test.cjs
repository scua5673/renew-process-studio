'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const code=section('  function adoptViewing(key){','  /* 2.747')+
 section('  function idpSaveApi(){','  function idpSaveOwnerCurrent(')+
 section('  function coachFeedbackKey(key){','  function migrateLegacyCoachFeedback(')+
 section('  function rvRec(key){','  /* 2.042')+section('  function rvSave(list,draft){','  function rvDaysTo(')+
 section('  function rvDraftOwner(){','  /* 대조 자료')+section('  function bindReviews(){','  function rProfileSum(');
function fixture(){
 const local=new Map([['ps_active_ws','team-a'],['ps_cache_owner_v1','seal-a']]),nodes={'[data-rv-start]':{},'[data-rv-cancel]':{},'[data-rv-save]':{}},toasts=[],sync=[];
 const state={uid:'coach-a',apiUid:'coach-a',ready:true,coach:true,fail:false};
 const api={session:()=>({uid:state.apiUid}),dataUnlocked:()=>state.ready,syncNow:r=>sync.push(r)};
 const c=vm.createContext({JSON,Date,String,Object,Array,Math,viewing:'cs_idp_v1_player-a',doc:{v:1},PREFIX:'cs_idp_v1_',PUBP:'cs_idp_pub_v1_',_rvOpen:false,_rvDraft:null,
  _saveT:null,_privateWriteConflict:false,visionEdit:false,_idpRecovery:null,myKey:()=> 'cs_idp_v1_'+state.uid,load:()=>({v:1}),idpRecoveryBlocked:()=>false,
  sess:()=>state.uid?{uid:state.uid}:null,wrap:{querySelector:s=>nodes[s]||null,querySelectorAll:()=>[]},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>{if(state.fail)throw Error('quota');local.set(k,v);}},
  parent:{PSSync:api},psAct(){},isCoach:()=>state.coach,ro:()=>true,render(){},gToast:s=>toasts.push(s),lrCoachName:()=> 'SYNTHETIC COACH',
  uid:()=> 'synthetic-goal',ymd:d=>d.toISOString().slice(0,10),rvFmt:s=>s,KPI_LIB:{}});c.window=c;
 vm.runInContext(code,c);c.bindReviews();nodes['[data-rv-start]'].onclick();c._rvDraft.strengths.push('SYNTHETIC player A strength');c.bindReviews();
 return {c,local,state,toasts,sync,nodes,save:()=>nodes['[data-rv-save]'].onclick()};
}
test('a review is saved to its original player and retains other feedback',()=>{
 const h=fixture();h.local.set('cs_idp_pub_v1_player-a',JSON.stringify({v:1,reacts:{day:{t:'existing reply'}}}));h.save();
 const saved=JSON.parse(h.local.get('cs_idp_pub_v1_player-a'));assert.equal(saved.reviews[0].strengths[0],'SYNTHETIC player A strength');assert.equal(saved.reacts.day.t,'existing reply');assert.equal(h.sync.length,1);assert.equal(h.c._rvDraft,null);
});
test('player navigation keeps the original review draft until save or cancel',()=>{
 const h=fixture(),draft=h.c._rvDraft;assert.equal(h.c.adoptViewing('cs_idp_v1_player-b'),false);assert.equal(h.c.viewing,'cs_idp_v1_player-a');assert.equal(h.c._rvDraft,draft);assert.equal(h.local.size,2);
 h.nodes['[data-rv-cancel]'].onclick();assert.equal(h.c.adoptViewing('cs_idp_v1_player-b'),true);assert.equal(h.local.has('cs_idp_pub_v1_player-b'),false);
});
for(const [name,change] of [
 ['player',h=>{h.c.viewing='cs_idp_v1_player-b';}],['account',h=>{h.state.uid=h.state.apiUid='coach-b';}],
 ['logout',h=>{h.state.uid=h.state.apiUid='';}],['workspace',h=>h.local.set('ps_active_ws','team-b')],
 ['owner generation',h=>h.local.set('ps_cache_owner_v1','seal-b')],['locked data',h=>{h.state.ready=false;}],
 ['API owner mismatch',h=>{h.state.apiUid='coach-b';}],['lost coach role',h=>{h.state.coach=false;}]
])test('an old review save handler cannot write after '+name+' changes',()=>{
 const h=fixture(),draft=h.c._rvDraft;change(h);h.save();assert.equal([...h.local.keys()].some(k=>k.startsWith('cs_idp_pub_')),false);assert.equal(h.sync.length,0);assert.equal(h.c._rvDraft,draft);
});
for(const malformed of ['{broken','[]','{"v":2}'])test('review save preserves unsupported public data: '+malformed,()=>{
 const h=fixture();h.local.set('cs_idp_pub_v1_player-a',malformed);h.save();assert.equal(h.local.get('cs_idp_pub_v1_player-a'),malformed);assert.ok(h.c._rvDraft);assert.equal(h.sync.length,0);
});
test('failed storage keeps the draft and never claims success',()=>{
 const h=fixture();h.state.fail=true;h.save();assert.ok(h.c._rvDraft);assert.equal(h.sync.length,0);assert.equal(h.toasts.at(-1),'저장하지 못했어요');
});
