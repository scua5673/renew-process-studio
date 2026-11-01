// The browser fixtures use Asia/Seoul even when the CI host runs in UTC.
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export function seoulWeek(now=new Date()){
 const p=Object.fromEntries(dateFormat.formatToParts(now).map(p=>[p.type,p.value]));
 const day=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)));
 const dayIndex=(day.getUTCDay()+6)%7;
 day.setUTCDate(day.getUTCDate()-dayIndex);
 return {anchorMonday:day.toISOString().slice(0,10),dayIndex};
}
