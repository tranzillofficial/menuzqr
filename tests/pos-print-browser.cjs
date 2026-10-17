// Browser regression: real receipt renderer and React print component, mocked QZ and journal.
const {build}=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http');const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
const root=path.resolve(__dirname,'..');
const mocks={
 'next/font/google':`export const Aref_Ruqaa=()=>({style:{fontFamily:"Arial"},className:"receipt-ruqaa"});`,
 '@/components/i18n/I18nProvider':`export const useI18n=()=>({locale:'ar'});`,
 '@/lib/actions/fiscal':`export async function recordReceiptPrint(){window.journal++;return {ok:true}}`,
 '@/lib/qz-print':`export async function qzConnection(){if(window.failConnection)throw Error('offline');return {printers:{find:async()=>['XP-80C'],getDefault:async()=> 'XP-80C'},configs:{create:(printer,options)=>({printer,options})},print:async(config,data)=>{window.jobs.push({config,data});if(window.failPrint)throw Error('unknown response');await new Promise(r=>setTimeout(r,150));}};}`,
 'next/link':`import React from 'react';export default function Link(p){return <a {...p}/>}`,
};
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ThermalPrinter}from'./components/dashboard/ThermalPrinter';window.jobs=[];window.journal=0;window.handle=React.createRef();window.receipt={orderId:'order-1',number:1,total:100,received:100,payment:'cash',tableLabel:null,createdAt:'2026-10-12T12:00:00Z',note:'',lines:[{variantId:'v',name:'منتج عربي English product',variant:'1 كيلو',price:100,quantity:1}]};createRoot(document.getElementById('root')).render(<ThermalPrinter printRef={window.handle} restaurantId="test" restaurantName="Store" currency="EGP" receipt={window.receipt}/>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/app.js'?'application/javascript':'text/html');res.end(req.url==='/app.js'?result.outputFiles[0].text:'<html dir="rtl"><body><div id="root"></div><script src="/app.js"></script></body></html>')}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let executablePath=process.env.CHROMIUM_EXECUTABLE;let args=['--no-sandbox'];if(process.env.CHROMIUM_MODULE){const c=require(process.env.CHROMIUM_MODULE);executablePath=await c.executablePath();args=c.args;}const browser=await chromium.launch({executablePath,headless:true,args});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.handle.current);
 await page.evaluate(()=>Promise.all([window.handle.current.printReceipt(window.receipt),window.handle.current.printReceipt(window.receipt)]));
 assert.equal(await page.evaluate(()=>window.jobs.length),1);assert.equal(await page.evaluate(()=>window.journal),1);
 await page.evaluate(()=>window.handle.current.printReceipt(window.receipt));assert.equal(await page.evaluate(()=>window.jobs.length),1);
 const job=await page.evaluate(()=>window.jobs[0]);assert.equal(job.config.options.copies,1);assert.equal(job.config.options.orientation,'portrait');assert.equal(job.config.options.size.width,80);assert.ok(job.config.options.size.height<90);assert.equal(job.data[0].format,'image');assert.ok(job.data[0].data.startsWith('iVBOR'));
 await page.getByRole('button',{name:'اختبار صغير',exact:true}).first().click();await page.waitForFunction(()=>window.jobs.length===2);await page.waitForFunction(()=>window.journal===1);const test=await page.evaluate(()=>window.jobs[1]);assert.ok(test.config.options.size.height<20);
 await page.reload();await page.waitForFunction(()=>window.handle.current);await page.evaluate(()=>{window.failConnection=true;return window.handle.current.printReceipt(window.receipt)});assert.equal(await page.evaluate(()=>window.jobs.length),0);await page.getByRole('heading',{name:'إعداد الطابعة'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: QZ WebSocket adapter, one checkout job, concurrency lock, duplicate prevention, portrait 80mm receipt, compact test and connection failure without automatic retries');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
