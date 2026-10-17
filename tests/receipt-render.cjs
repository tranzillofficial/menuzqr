const {build}=require('esbuild');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
 const result=await build({stdin:{contents:"export {receiptImage} from './lib/thermal-print'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'font',setup(b){b.onResolve({filter:/^next\/font\/google$/},()=>({path:'font',namespace:'font'}));b.onLoad({filter:/.*/,namespace:'font'},()=>({contents:`export const Aref_Ruqaa=()=>({style:{fontFamily:'ReceiptRuqaa'},className:'ruqaa'})`}))}}]});
 const canvases=[];
 const document={fonts:{ready:Promise.resolve(),load:()=>Promise.resolve([])},createElement(){const draws=[];const ctx={font:'',measureText(t){return {width:t.length*14}},fillText(text){draws.push({text,font:this.font})},fillRect(){},clearRect(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},putImageData(data){this.pixels=data},drawImage(qr,x,y){draws.push({qr,x,y})}};const canvas={width:0,height:0,draws,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test',style:{}};canvases.push(canvas);return canvas;}};
 const sandbox={exports:{},module:{exports:{}},require,document,setTimeout,clearTimeout,Uint8ClampedArray,Uint8Array,TextEncoder,console};sandbox.exports=sandbox.module.exports;vm.runInNewContext(result.outputFiles[0].text,sandbox);
 const receipt={number:1,total:10,received:10,payment:'cash',tableLabel:null,createdAt:'2026-10-17T00:00:00Z',note:'',lines:[{variantId:'v',name:'لبن كامل الدسم',variant:'عبوة',price:10,quantity:1}]};
 for(const width of [58,80]){
  const base=await sandbox.module.exports.receiptImage(receipt,'كافيه حدوته','EGP',true,width);
  const before=canvases.length;
  const image=await sandbox.module.exports.receiptImage({...receipt,menuUrl:'https://menuzqr.shop/hadota/menu'},'كافيه حدوته','EGP',true,width);
  const created=canvases.slice(before);const main=created.find(c=>c.draws.some(d=>d.text==='كافيه حدوته'));
  assert.ok(main.draws.find(d=>d.text==='كافيه حدوته').font.includes('ReceiptRuqaa'));
  assert.ok(main.draws.find(d=>d.text?.includes('لبن كامل الدسم')).font.includes('Arial'));
  assert.equal(main.draws.filter(d=>d.font?.includes('ReceiptRuqaa')).length,1);
  const qr=main.draws.find(d=>d.qr);assert.ok(qr);assert.ok(qr.y+qr.qr.height<=image.height);assert.ok(image.height>base.height);assert.equal(image.width,width===58?384:576);
 }
 const image=await sandbox.module.exports.receiptImage({...receipt,testPrint:true,menuUrl:'https://menuzqr.shop/test/menu'},'Store','EGP',false,58);assert.ok(image.height<=160);
 console.log('PASS: Arabic brand alone uses Ruqaa, items retain Arial, 58/80mm QR fits below receipt, compact print test stays short');
})().catch(e=>{console.error(e);process.exit(1)});
