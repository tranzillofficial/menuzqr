// Calendar boundaries in an IANA zone, including 23/25 hour UK DST days.
export function businessDayRange(date:string,timezone:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const parsed=new Date(`${date}T00:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Invalid date');
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 function midnight(target:number){let instant=target;for(let i=0;i<4;i++){const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));const local=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));const difference=target-local;instant+=difference;if(!difference)break;}return new Date(instant).toISOString();}
 return {start:midnight(parsed.getTime()),end:midnight(parsed.getTime()+86400000)};
}

/** Convert a business-local wall-clock time; reject nonexistent DST times. */
export function businessLocalInstant(day:string,time:string,zone:string):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Invalid local time');
 businessDayRange(day,zone);
 const [y,m,d]=day.split('-').map(Number),[h,min]=time.split(':').map(Number),target=Date.UTC(y,m-1,d,h,min);
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let guess=target;for(let i=0;i<6;i++){const values=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));const actual=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute));if(actual===target)return new Date(guess).toISOString();guess+=target-actual;}
 throw Error('This local time does not exist');
}
