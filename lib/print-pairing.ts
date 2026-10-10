import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

function signature(payload:string,secret:string){
 return createHmac('sha256',secret).update('menuzqr-print-pair-v1:'+payload).digest('base64url');
}
export function createPrintTicket(origin:string,secret:string,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({origin,expires:now+120_000,nonce:randomUUID()})).toString('base64url');
 return `${payload}.${signature(payload,secret)}`;
}
export function validPrintTicket(ticket:unknown,origin:unknown,secret:string,now=Date.now()){
 if(typeof ticket!=='string'||ticket.length>2048||typeof origin!=='string')return false;
 try{
  const [payload,sig,...extra]=ticket.split('.');
  const expected=Buffer.from(signature(payload,secret)),actual=Buffer.from(sig??'');
  if(extra.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
  const data=JSON.parse(Buffer.from(payload,'base64url').toString());
  return data.origin===origin&&data.expires>now&&data.expires<=now+120_000;
 }catch{return false;}
}
