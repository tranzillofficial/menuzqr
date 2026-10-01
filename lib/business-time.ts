// Calendar boundaries in an IANA zone, including 23/25 hour UK DST days.
export function businessDayRange(date:string,timezone:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const parsed=new Date(`${date}T00:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Invalid date');
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 function midnight(target:number){let instant=target;for(let i=0;i<4;i++){const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));const local=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));const difference=target-local;instant+=difference;if(!difference)break;}return new Date(instant).toISOString();}
 return {start:midnight(parsed.getTime()),end:midnight(parsed.getTime()+86400000)};
}
