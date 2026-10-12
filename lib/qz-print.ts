let connecting:Promise<void>|null=null;
export async function qzConnection(){
 const {default:qz}=await import('qz-tray');
 if(!qz.websocket.isActive()){
  if(!connecting)connecting=qz.websocket.connect().finally(()=>{connecting=null;});
  await connecting;
 }
 return qz;
}
