// Browser regression: actual POS component with bounded server search responses.
const {build}=require('esbuild');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const mocks={
 '@/components/i18n/I18nProvider':`export const useI18n=()=>({locale:'ar'});`,
 '@/components/ui/SmartImage':`export function SmartImage(){return null}`,
 './PosBarcode':`export function PosBarcode(){return null}`,
 '@/components/dashboard/ThermalPrinter':`export function ThermalPrinter(){return null}`,
 'next/link':`import React from 'react';export default function Link(p){return <a {...p}/>}`,
 '@/lib/actions/pos':`export async function searchPosProducts(input){window.searches.push(input);await new Promise(r=>setTimeout(r,input.query==='slow'?700:20));if(input.query==='error')return {ok:false,message:'Search failed'};return {ok:true,products:[window.product(input.query||('Page '+input.page))],hasMore:input.page===0};}export async function getPosTables(){return {ok:true,tables:[]}};export async function checkoutPos(){throw Error('Not part of this test')}`,
 };
 const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PosScreen}from'./components/dashboard/PosScreen';window.searches=[];window.product=(name)=>({id:name,name,category_id:'c',description:'',image_url:null,vat_code:'standard',product_variants:[{id:name+'-v',name:'قطعة',is_active:true,price:10}]});createRoot(document.getElementById('root')).render(<PosScreen restaurantId="test" restaurantName="Store" currency="EGP" products={[window.product('Initial')]} initialHasMore categories={[]} tables={[]} tablesEnabled={false} printingEnabled={false} taxSettings={{tax_mode:'none',vat_registered:false,prices_include_vat:false}}/>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/app.js'?'application/javascript':'text/html');res.end(req.url==='/app.js'?result.outputFiles[0].text:'<html dir="rtl"><body><div id="root"></div><script src="/app.js"></script></body></html>')}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const c=process.env.CHROMIUM_MODULE?require(process.env.CHROMIUM_MODULE):null;
 const browser=await chromium.launch({executablePath:c?await c.executablePath():process.env.CHROMIUM_EXECUTABLE,headless:true,args:c?c.args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'إضافة Initial قطعة',exact:true}).click();
 await page.getByRole('button',{name:'التالي',exact:true}).click();await page.getByRole('heading',{name:'Page 1',exact:true}).waitFor();
 assert.equal(await page.locator('[data-testid="cart-lines"]').first().getByText('Initial',{exact:true}).count(),1);
 const search=page.getByRole('searchbox',{name:'ابحث عن منتج'});await search.fill('Barcode 123');await page.getByRole('heading',{name:'Barcode 123',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.searches.at(-1)),{query:'Barcode 123',category:'all',page:0});
 await search.fill('slow');await page.waitForFunction(()=>window.searches.some(s=>s.query==='slow'));await search.fill('fast');await page.getByRole('heading',{name:'fast',exact:true}).waitFor();await page.waitForTimeout(750);assert.equal(await page.getByRole('heading',{name:'slow',exact:true}).count(),0);
 await search.fill('error');await page.getByRole('alert').filter({hasText:'Search failed'}).waitFor();assert.equal(await page.locator('[data-testid="product-grid"] article').count(),0);
 assert.equal(await page.locator('[data-testid="cart-lines"]').first().getByText('Initial',{exact:true}).count(),1);assert.deepEqual(errors,[]);
 console.log('PASS: server pagination, query resets page, cart survives searches, stale responses discarded and failed search hides old results');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
