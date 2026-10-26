import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),store=require('../../studio/scouting-store.js');

// Synthetic only: 138 unique candidates, one unplaced and one with two placements.
export function depthCandidates(){
  const players=[];
  for(const [pos,total] of Object.entries({GK:8,LCB:24,RCB:18,LB:10,RB:9,DM:13,CM:16,AM:11,LW:10,RW:9,CF:9})){
    for(let i=1;i<=total;i++)players.push({id:pos==='GK'&&i===1?'gk-placement':pos+'-'+i,dbId:pos==='GK'&&i===1?'gk':pos.toLowerCase()+i,type:'target',name:pos==='GK'&&i===1?'가상 GK 후보':'가상 '+pos+' 후보 '+i,posId:'pos_'+pos,num:String(i),club:'가상 유나이티드',grade:i%3?'B':'A',scoutSt:['rep','go','done'][i%3],levels:{},profile:{}});
  }
  players[0].scoutSt='rep';
  players.push({...players[0],id:'gk-other-placement',posId:'pos_RCB',scoutSt:'go'});
  const target=store.reconcile(null,{v:1,players});
  target.scoutRegistry.candidates['manual:unplaced']={id:'manual:unplaced',info:{name:'가상 미배치 후보',profile:{}},points:{},ratings:{},variants:[],edits:{}};
  target.scoutRegistry.meta={pointSets:[{name:'공격수',positions:['ST'],text:'전방 공간을 만드는가?'},{name:'골키퍼',positions:['GK'],text:'슈팅을 안정적으로 막는가?'},{name:'수비수',positions:['CB'],text:'수비 간격을 유지하는가?'}]};
  return target;
}
