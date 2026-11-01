const test=require('node:test'),assert=require('node:assert/strict');
test('fixture week follows the browser across Korean midnight and year boundaries',async()=>{
 const {seoulWeek}=await import('./fixtures/seoul-week.mjs');
 for(const [time,anchorMonday,dayIndex] of [
  ['2026-11-01T14:59:59Z','2026-10-26',6],
  ['2026-11-01T15:00:00Z','2026-11-02',0],
  ['2026-12-31T15:00:00Z','2026-12-28',4],
  ['2027-01-03T15:00:00Z','2027-01-04',0]
 ])assert.deepEqual(seoulWeek(new Date(time)),{anchorMonday,dayIndex});
});
test('fixture schedule day does not depend on the host time zone',async()=>{
 const {seoulWeek}=await import('./fixtures/seoul-week.mjs'),original=process.env.TZ;
 try{for(const zone of ['UTC','Asia/Seoul','America/Los_Angeles']){
  process.env.TZ=zone;
  assert.deepEqual(seoulWeek(new Date('2026-11-01T15:01:00Z')),{anchorMonday:'2026-11-02',dayIndex:0},zone);
 }}finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
