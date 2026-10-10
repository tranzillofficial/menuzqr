// Isolated browser regression test: real POS/printer components, mocked checkout,
// journal and loopback transport. Never connects to a live restaurant or printer.
// Requires esbuild, playwright and @sparticuz/chromium (optional test tooling).
// Module paths can be supplied via ESBUILD_MODULE, PLAYWRIGHT_MODULE, CHROMIUM_MODULE.
const {build}=require(process.env.ESBUILD_MODULE || 'esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chrome=require(process.env.CHROMIUM_MODULE || '@sparticuz/chromium').default;
const http=require('node:http');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname, '..');
(async()=>{
const mocks={
'@/components/i18n/I18nProvider':`export const useI18n=()=>({locale:'en'});`,
'@/components/ui/Toast':`export const useToast=()=>((message)=>window.toasts.push(message));`,
'@/components/ui/SmartImage':`export const SmartImage=()=>null;`,
'next/link':`import React from 'react'; export default function Link(p){return <a {...p}/>}`,
'@/lib/actions/fiscal':`export async function recordReceiptPrint(...args){window.journal.push(args);if(window.failAudit)throw Error('audit offline');return {ok:true}}`,
'@/lib/actions/pos':`export async function getPosTables(){return {ok:true,tables:[]}}; export async function checkoutPos(){window.orders++; if(window.failCheckout)return {ok:false,message:'Checkout failed'};return {ok:true,receipt:{orderId:'order-'+window.orders,number:window.orders,total:114,received:120,payment:'cash',tableLabel:null,createdAt:'2026-10-03T10:00:00Z',note:'',fiscal:{legal_name:'Restaurant',registered:true,vat_number:'123',timezone:'UTC',net:100,vat:14,gross:114,breakdown:[{code:'standard',rate:14,net:100,vat:14,gross:114}]},lines:[{variantId:'v',name:'عصير Juice',variant:'Regular',price:100,quantity:1,gross:114,net:100,vat:14,rate:14,code:'standard'}]}}}`
};
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PosScreen}from'./components/dashboard/PosScreen';window.orders=0;window.journal=[];window.toasts=[];createRoot(document.getElementById('root')).render(<PosScreen restaurantId="test" restaurantName="Test" currency="EGP" categories={[]} tables={[]} taxSettings={{tax_mode:'egypt',vat_registered:true,prices_include_vat:false,tax_rates:{egypt:{standard:14,reduced:0}}}} products={[{id:'p',name:'Juice',vat_code:'standard',product_variants:[{id:'v',name:'Regular',price:100,is_active:true}]}]}/>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
const server=http.createServer((q,r)=>{r.end(q.url==='/app.js'?result.outputFiles[0].text:'<html><body><div id="root"></div><script src="/app.js"></script></body></html>')}).listen(0,'127.0.0.1');
await new Promise(r=>server.on('listening',r));
let executablePath=process.env.CHROMIUM_EXECUTABLE; if(!executablePath){try{executablePath=await chrome.executablePath()}catch(e){if(require('fs').existsSync('/tmp/chromium'))executablePath='/tmp/chromium';else throw e}}
const browser=await chromium.launch({executablePath,args:process.env.PRINT_TEST_DISABLE_GPU ? [...chrome.args.filter(a=>!a.startsWith('--use-gl=')&&!a.startsWith('--use-angle=')), '--disable-gpu','--disable-software-rasterizer'] : chrome.args,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
try{
for(const scenario of ['setup','autoPair','installThenConnect','choosePrinter','browser','thermal','thermal512','oldBridge','thermalFailure','auditFailure','checkoutFailure']){
 const page=await context.newPage();let sent=[];let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({scenario})=>{
 localStorage.clear();window.printRequests=0;
 window.failAudit=scenario==='auditFailure';window.failCheckout=scenario==='checkoutFailure';
 if(scenario==='browser')localStorage.setItem('menuzqr-printer:test',JSON.stringify({token:'',printer:'',width:80,cut:true,mode:'browser'}));
 if(['thermal','thermal512','oldBridge','thermalFailure','auditFailure'].includes(scenario))localStorage.setItem('menuzqr-printer:test',JSON.stringify({token:'test',printer:'Thermal',width:scenario==='thermal512'?80:58,dots:scenario==='thermal512'?512:384,feedMm:0,cut:true}));
 const original=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');
 Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get(){const w=original.get.call(this);if(w)w.print=()=>{window.printRequests++;window.printImages=w.document.images.length;w.dispatchEvent(new Event('afterprint'))};return w;}});
 },{scenario});
 let bridgeAvailable = !['setup','installThenConnect'].includes(scenario), pairings=0;
 await page.route('**/api/print-pair',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ticket:'signed-ticket'})}));
 await page.route('http://127.0.0.1:18191/**',async route=>{
   if(!bridgeAvailable){await route.abort();return;}
   const url=route.request().url();
   if(url.endsWith('/health')){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({app:'MenuzQR Print',version:scenario==='oldBridge'?1:3})});return;}
   if(url.endsWith('/pair')){pairings++;assert.equal(JSON.parse(route.request().postData()).ticket,'signed-ticket');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:'paired',version:3})});return;}
   if(route.request().method()==='GET'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({printers:['Thermal'],suggestedPrinter:scenario==='choosePrinter'?null:'Thermal',version:scenario==='oldBridge'?1:3})});return;}
   sent.push(JSON.parse(route.request().postData()));await route.fulfill({status:scenario==='thermalFailure'?503:200,contentType:'application/json',body:JSON.stringify({ok:scenario!=='thermalFailure'})});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Add Juice Regular',exact:true}).click();
 await page.getByLabel('Amount received').fill('120');
 await page.getByRole('button',{name:'Confirm payment',exact:true}).click();
 if(scenario==='checkoutFailure'){await page.getByRole('alert').waitFor();assert.equal(sent.length,0);assert.equal(await page.evaluate(()=>window.printRequests),0)}
 else if(scenario==='autoPair'){
 await page.getByText('Receipt sent to the printer.',{exact:true}).waitFor();assert.equal(pairings,1);assert.equal(sent.length,1);assert.equal(sent[0].printer,'Thermal');assert.equal(await page.evaluate(()=>window.printRequests),0);
 }else if(scenario==='installThenConnect'||scenario==='choosePrinter'){
 await page.getByRole('dialog').waitFor();assert.equal(sent.length,0);assert.equal(await page.evaluate(()=>window.orders),1);
 if(scenario==='installThenConnect'){bridgeAvailable=true;await page.getByRole('button',{name:'Print saved receipt',exact:true}).waitFor({timeout:20000});}
 else {await page.locator('select').filter({has:page.locator('option[value="Thermal"]')}).selectOption('Thermal');}
 await page.getByRole('button',{name:'Print saved receipt',exact:true}).click();await page.waitForFunction(()=>window.toasts.includes('Receipt sent to the printer.'));assert.equal(sent.length,1);assert.equal(pairings,1);assert.equal(await page.evaluate(()=>window.orders),1);
 }else if(scenario==='setup'||scenario==='oldBridge'){
 await page.getByRole('dialog').waitFor();assert.equal(sent.length,0);assert.equal(await page.evaluate(()=>window.printRequests),0);assert.equal(await page.evaluate(()=>window.orders),1);
 assert.ok((await page.getByRole('dialog').innerText()).includes(scenario==='oldBridge'?'Nothing was sent to the old bridge':'Set up direct printing'));
 }else if(scenario==='browser'){
 await page.getByText(/Print dialog requested/).waitFor();assert.equal(await page.evaluate(()=>window.printRequests),1);assert.ok(await page.evaluate(()=>window.printImages>15));assert.equal(sent.length,0);
 await page.getByRole('button',{name:'Print receipt #1',exact:true}).click();assert.equal(await page.evaluate(()=>window.orders),1);
 }else if(scenario==='thermalFailure'){
 await page.getByText(/Printing could not be confirmed/).waitFor();assert.equal(sent.length,1);assert.equal(await page.evaluate(()=>window.printRequests),0);
 await page.getByRole('button',{name:'Print receipt #1',exact:true}).click();await page.waitForFunction(()=>document.body.innerText.includes('Printing could not be confirmed'));assert.equal(sent.length,2);assert.equal(sent[0].jobId,sent[1].jobId);
 await page.getByRole('button',{name:'Print using system driver'}).click();await page.getByText(/Print dialog requested/).waitFor();assert.equal(await page.evaluate(()=>window.orders),1);
 }else{await page.getByText('Receipt sent to the printer.',{exact:true}).waitFor();assert.equal(sent.length,1);assert.equal(sent[0].width,scenario==='thermal512'?512:384);assert.equal(sent[0].feedMm,0);assert.equal(await page.evaluate(()=>window.printRequests),0);if(scenario==='auditFailure')assert.match((await page.evaluate(()=>window.toasts)).join(' '),/journal/)}
 assert.deepEqual(errors,[]);console.log('PASS',scenario);await page.close();
}
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
