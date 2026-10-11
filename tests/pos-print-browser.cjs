// Isolated browser regression test: real POS/printer components, mocked checkout,
// journal and loopback transport. Never connects to a live restaurant or printer.
// Requires esbuild, playwright and @sparticuz/chromium (optional test tooling).
// Module paths can be supplied via ESBUILD_MODULE, PLAYWRIGHT_MODULE, CHROMIUM_MODULE.
const {build}=require(process.env.ESBUILD_MODULE || 'esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chrome=process.env.CHROMIUM_EXECUTABLE ? {args:['--no-sandbox','--disable-gpu']} : require(process.env.CHROMIUM_MODULE || '@sparticuz/chromium').default;
const http=require('node:http');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname, '..');
(async()=>{
const mocks={
'@/lib/actions/barcode':`export async function lookupPosBarcode(){return {ok:false,message:'Barcode not found'}};`,
'@/components/i18n/I18nProvider':`export const useI18n=()=>({locale:'en'});`,
'@/components/ui/Toast':`export const useToast=()=>((message)=>window.toasts.push(message));`,
'@/components/ui/SmartImage':`export const SmartImage=()=>null;`,
'next/link':`import React from 'react'; export default function Link(p){return <a {...p}/>}`,
'@/lib/actions/fiscal':`export async function recordReceiptPrint(...args){window.journal.push(args);if(window.failAudit)throw Error('audit offline');return {ok:true}}`,
'@/lib/actions/pos':`export async function getPosTables(){return {ok:true,tables:[]}}; export async function checkoutPos(){window.orders++; if(window.failCheckout)return {ok:false,message:'Checkout failed'};return {ok:true,receipt:{orderId:'order-'+window.orders,number:window.orders,total:114,received:120,payment:'cash',tableLabel:null,createdAt:'2026-10-03T10:00:00Z',note:'',fiscal:{legal_name:'Restaurant',registered:true,vat_number:'123',timezone:'UTC',net:100,vat:14,gross:114,breakdown:[{code:'standard',rate:14,net:100,vat:14,gross:114}]},lines:[{variantId:'v',name:'عصير Juice',variant:'Regular',price:100,quantity:1,gross:114,net:100,vat:14,rate:14,code:'standard'}]}}}`
};
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PosScreen}from'./components/dashboard/PosScreen';window.orders=0;window.journal=[];window.toasts=[];createRoot(document.getElementById('root')).render(<PosScreen restaurantId="test" restaurantName="Test" currency="EGP" categories={[]} tables={[]} taxSettings={{tax_mode:'egypt',vat_registered:true,prices_include_vat:false,tax_rates:{egypt:{standard:14,reduced:0}}}} products={[{id:'p',name:'Juice',vat_code:'standard',product_variants:[{id:'v',name:'Regular',price:100,is_active:true}]}]}/>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
const server=http.createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/app.js'?'application/javascript; charset=utf-8':'text/html; charset=utf-8');r.end(q.url==='/app.js'?result.outputFiles[0].text:'<html><body><div id="root"></div><script src="/app.js"></script></body></html>')}).listen(0,'127.0.0.1');
await new Promise(r=>server.on('listening',r));
let executablePath=process.env.CHROMIUM_EXECUTABLE; if(!executablePath){try{executablePath=await chrome.executablePath()}catch(e){if(require('fs').existsSync('/tmp/chromium'))executablePath='/tmp/chromium';else throw e}}
const browser=await chromium.launch({executablePath,args:process.env.PRINT_TEST_DISABLE_GPU ? [...chrome.args.filter(a=>!a.startsWith('--use-gl=')&&!a.startsWith('--use-angle=')), '--disable-gpu','--disable-software-rasterizer'] : chrome.args,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
try{
for(const scenario of ['delayedBridge','unpairedOldBridge','sessionFailure','pairFailure','discoveryFailure','setup','autoPair','installThenConnect','choosePrinter','browser','thermal','thermal512','oldBridge','thermalFailure','auditFailure','checkoutFailure']){
 const page=await context.newPage();let sent=[];let tests=[];let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({scenario})=>{
 localStorage.clear();window.printRequests=0;AbortSignal.timeout=undefined;window.receiptFonts=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(...args){window.receiptFonts.push(this.font);return fill.apply(this,args)};
 window.failAudit=scenario==='auditFailure';window.failCheckout=scenario==='checkoutFailure';
 if(scenario==='browser')localStorage.setItem('menuzqr-printer:test',JSON.stringify({token:'',printer:'',width:80,cut:true,mode:'browser'}));
 if(['thermal','thermal512','oldBridge','thermalFailure','auditFailure'].includes(scenario))localStorage.setItem('menuzqr-printer:test',JSON.stringify({token:'test',printer:'Thermal',width:scenario==='thermal512'?80:58,dots:scenario==='thermal512'?512:384,feedMm:0,cut:true,encoding:'column',calibrated:JSON.stringify([4,'Thermal',scenario==='thermal512'?80:58,scenario==='thermal512'?512:384,'column',0,true])}));
 const original=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');
 Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get(){const w=original.get.call(this);if(w)w.print=()=>{window.printRequests++;window.printImages=w.document.images.length;w.dispatchEvent(new Event('afterprint'))};return w;}});
 },{scenario});
 let bridgeAvailable = !['setup','installThenConnect'].includes(scenario), pairings=0;
 await page.route('**/api/print-pair',route=>route.fulfill({status:scenario==='sessionFailure'?401:200,contentType:'application/json',body:JSON.stringify({ticket:'signed-ticket'})}));
 await page.route('http://127.0.0.1:18191/**',async route=>{
   if(!bridgeAvailable){await route.abort();return;}
   const url=route.request().url();
   if(url.endsWith('/health')){if(scenario==='delayedBridge')await new Promise(resolve=>setTimeout(resolve,1000));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({app:'MenuzQR Print',version:['oldBridge','unpairedOldBridge'].includes(scenario)?1:5})});return;}
   if(url.endsWith('/pair')){pairings++;assert.equal(JSON.parse(route.request().postData()).ticket,'signed-ticket');await route.fulfill({status:scenario==='pairFailure'?403:200,contentType:'application/json',body:JSON.stringify({token:'paired',version:5})});return;}
   if(route.request().method()==='GET'){await route.fulfill({status:scenario==='discoveryFailure'?503:200,contentType:'application/json',body:JSON.stringify({printers:['Thermal'],suggestedPrinter:scenario==='choosePrinter'?null:'Thermal',version:['oldBridge','unpairedOldBridge'].includes(scenario)?1:5})});return;}
   const payload=JSON.parse(route.request().postData());if(payload.testPrint){tests.push(payload);assert.ok(payload.height<=160);assert.equal(payload.protocol,'windows-gdi-v1');assert.ok([58,80].includes(payload.paperMm));assert.equal(payload.encoding,undefined);}else sent.push(payload);await route.fulfill({status:scenario==='thermalFailure'?503:200,contentType:'application/json',body:JSON.stringify({ok:scenario!=='thermalFailure'})});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Add Juice Regular',exact:true}).click();
 await page.getByLabel('Amount received').fill('120');
 await page.getByRole('button',{name:'Confirm payment',exact:true}).click();
 if(scenario==='delayedBridge'){
   await page.getByTestId('printer-status').filter({hasText:'Connecting to printer'}).waitFor();
   const bounds=await page.getByTestId('printer-status').boundingBox();assert.ok(bounds && bounds.y>=0 && bounds.y+bounds.height<=1100,'Status stays in viewport');
 }
 if(scenario==='checkoutFailure'){
   await page.getByRole('alert').waitFor();assert.equal(sent.length,0);
 }else if(['setup','oldBridge','unpairedOldBridge','sessionFailure','pairFailure','discoveryFailure'].includes(scenario)){
   const error = {setup:/Cannot reach MenuzQR Print/,oldBridge:/new installer/,unpairedOldBridge:/new installer/,sessionFailure:/Could not authorize/,pairFailure:/connecting it to the site failed/,discoveryFailure:/could not read Windows printers/}[scenario];
   await page.getByText(error).waitFor();assert.equal(sent.length,0);
   assert.equal(await page.getByRole('dialog').count(),0,'Connection failure must not open settings');
   await page.getByRole('button',{name:'Test print',exact:true}).click();
   await page.getByText(error).waitFor();
   assert.equal(await page.getByRole('dialog').count(),0,'Failed test must not open settings');
 }else if(scenario==='installThenConnect'||scenario==='choosePrinter'){
   await page.getByText(scenario==='installThenConnect'? /Cannot reach MenuzQR Print/ : /Open Printer settings and choose/).waitFor();
   assert.equal(await page.getByRole('dialog').count(),0);assert.equal(sent.length,0);
   await page.getByRole('button',{name:'Printer settings',exact:true}).click();
   await page.getByRole('dialog').waitFor();
   if(scenario==='installThenConnect'){bridgeAvailable=true;await page.getByRole('button',{name:'Print saved receipt',exact:true}).waitFor({timeout:20000});}
   else await page.locator('select').filter({has:page.locator('option[value="Thermal"]')}).selectOption('Thermal');
   await page.getByRole('button',{name:'Print saved receipt',exact:true}).click();
   await page.getByText('Receipt sent to the printer.',{exact:true}).waitFor();assert.equal(sent.length,1);
   assert.equal(await page.getByRole('dialog').count(),0);
 }else if(scenario==='thermalFailure'){
   await page.getByText(/Printing could not be confirmed/).waitFor();assert.equal(sent.length,1);
   await page.getByRole('button',{name:'Print receipt #1',exact:true}).click();
   await page.waitForFunction(()=>window.toasts.filter(x=>x.includes('Printing could not be confirmed')).length===2);
   assert.equal(sent.length,2);assert.equal(sent[0].jobId,sent[1].jobId);
 }else{
   await page.getByText('Receipt sent to the printer.',{exact:true}).waitFor();assert.equal(sent.length,1);
   assert.equal(await page.getByRole('dialog').count(),0,'Ready printer must not open setup on payment');
   if(scenario==='autoPair'||scenario==='browser'||scenario==='delayedBridge')assert.equal(pairings,1);
   else assert.equal(sent[0].width,scenario==='thermal512'?576:384);
   if(scenario==='auditFailure')assert.match((await page.evaluate(()=>window.toasts)).join(' '),/journal/);
   await page.getByRole('button',{name:'Test print',exact:true}).click();
   await page.waitForFunction(()=>window.toasts.filter(x=>x==='Receipt sent to the printer.').length===2);
   assert.equal(tests.length,1);assert.ok(tests[0].height<=80,'Two-line test stays compact');assert.equal(sent.length,1);
   assert.equal(await page.getByRole('dialog').count(),0);
 }
 for(const bitmap of [...sent,...tests]){
   const raw=Buffer.from(bitmap.raster,'base64'),stride=bitmap.width/8;
   assert.ok(raw.subarray(0,3*stride).some(v=>v!==0),'At most two leading blank rows');
   assert.ok(raw.subarray(raw.length-3*stride).some(v=>v!==0),'At most two trailing blank rows');
 }
 assert.equal(await page.evaluate(()=>window.printRequests),0,'Checkout and test must never invoke PDF/browser printing');
 assert.equal(await page.evaluate(()=>window.orders),1);
 if(process.env.RECEIPT_PREVIEW && scenario==='thermal512'){
   const url=await page.evaluate(({width,height,raster})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d'),im=ctx.createImageData(width,height),raw=atob(raster);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=(raw.charCodeAt(y*width/8+(x>>3))&(128>>(x%8)))?0:255;const i=(y*width+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}ctx.putImageData(im,0,0);return c.toDataURL();},sent[0]);
   require('fs').writeFileSync(process.env.RECEIPT_PREVIEW,Buffer.from(url.split(',')[1],'base64'));
 }
 if(sent.length){const fonts=await page.evaluate(()=>window.receiptFonts);assert.ok(fonts.length>0);assert.ok(fonts.every(f=>f.includes('bold')),'Every receipt text row must be bold');}assert.deepEqual(errors,[]);console.log('PASS',scenario);await page.close();
}
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
