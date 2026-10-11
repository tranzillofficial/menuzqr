// Real POS + barcode component; mock only server calls and hardware printing.
const {build}=require(process.env.ESBUILD_MODULE||'esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
(async()=>{
const mocks={
 '@/components/i18n/I18nProvider':`export const useI18n=()=>({locale:'en'});`,
 '@/components/ui/SmartImage':`export const SmartImage=()=>null;`,
 '@/components/dashboard/ThermalPrinter':`export const ThermalPrinter=()=>null;`,
 'next/link':`import React from 'react';export default function Link(p){return <a {...p}/>}`,
 '@/lib/actions/pos':`export async function getPosTables(){return {ok:true,tables:[]}};export async function checkoutPos(){window.paid++;return {ok:false,message:'Mock checkout'}}`,
 '@/lib/actions/barcode':`export async function lookupPosBarcode(code){window.scans.push(code);await new Promise(r=>setTimeout(r,30));if(code==='9999')return {ok:false,message:'Barcode not found'};if(code==='8888')throw Error('offline');return {ok:true,product:{id:code,barcode:code,name:code==='000099'?'Boxes':'Milk',is_active:true,vat_code:'standard',product_variants:code==='000099'?[{id:'unit',name:'Unit',price:10,is_active:true,sort_order:0},{id:'box',name:'Box',price:100,is_active:true,sort_order:1}]:[{id:'milk',name:'Regular',price:20,is_active:true,sort_order:0}]}}}`
};
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PosScreen}from'./components/dashboard/PosScreen';const root=createRoot(document.getElementById('root'));window.scans=[];window.paid=0;window.render=(barcodeEnabled=true)=>root.render(<PosScreen key={String(barcodeEnabled)} barcodeEnabled={barcodeEnabled} restaurantId="test" restaurantName="Market" currency="EGP" products={[]} categories={[]} tables={[]} tablesEnabled={false} taxSettings={{tax_mode:'egypt',vat_registered:false,prices_include_vat:false}}/>);window.render();`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,jsx:'automatic',format:'iife',plugins:[{name:'mocks',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/app.js'?result.outputFiles[0].text:'<meta charset="utf-8"><div id="root"></div><script src="/app.js"></script>')}).listen(0,'127.0.0.1');
await new Promise(r=>server.on('listening',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu'],headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Enter barcode manually'}).waitFor();
 const scan=async(code)=>{await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type(code,{delay:5});await page.keyboard.press('Enter');};
 await scan('001234');await scan('001234');await page.waitForFunction(()=>document.querySelector('[data-testid="desktop-cart"]').innerText.includes('E£ 40'),null,{timeout:10000});
 assert.deepEqual(await page.evaluate(()=>window.scans),['001234','001234']);assert.equal(await page.evaluate(()=>window.paid),0);
 await page.getByLabel('Search products').fill('hidden by filter');await scan('001234');await page.waitForFunction(()=>document.querySelector('[data-testid="desktop-cart"]').innerText.includes('E£ 60'));
 await page.getByLabel('Amount received').fill('100');await page.getByLabel('Amount received').press('Enter');assert.equal((await page.evaluate(()=>window.scans)).length,3);
 await page.getByRole('button',{name:'Enter barcode manually'}).click();await page.locator('#manual-barcode').fill('000099');await page.getByRole('dialog').getByRole('button',{name:'Add by barcode'}).click();
 await page.getByRole('dialog',{name:'Choose sale unit'}).waitFor();assert.equal(await page.getByRole('button',{name:'Confirm payment'}).isDisabled(),true);await page.getByRole('button',{name:'Box · 100.00',exact:true}).click();await page.getByTestId('desktop-cart').getByText('Boxes',{exact:true}).waitFor();
 await scan('9999');await page.getByRole('alert').filter({hasText:'Barcode not found'}).waitFor();
 await scan('8888');await page.getByRole('alert').filter({hasText:'Connection failed'}).waitFor();
 await page.locator('#pos-barcode').fill('٠٠١٢٣٤');await page.locator('#pos-barcode').press('Enter');await page.waitForFunction(()=>window.scans.at(-1)==='001234');
 await page.evaluate(()=>window.render(false));await page.getByLabel('Search products').waitFor();assert.equal(await page.locator('#pos-barcode').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS repeated scans, hidden products, payment-field isolation, manual entry, variant selection, failed lookups, local digits, non-supermarket UI');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
