// Exercise actual picker, settings and menu renderers; only save actions are mocked.
const {build}=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const next=require('node:child_process').spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{cwd:root,stdio:'ignore'});
 for(let i=0;i<100;i++){try{const response=await fetch('http://127.0.0.1:3100/preview/menu-theme/modern');if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,200));if(i===99){next.kill();throw Error('Preview server did not start')}}
 const mocks={
  'next/image':`export default function Image({fill,priority,unoptimized,sizes,loader,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:undefined}/>} `,
  'next/navigation':`export const useRouter=()=>({refresh(){window.refreshes=(window.refreshes||0)+1}});`,
  'next/link':`export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
  '@/lib/actions/restaurant':`export async function updateMenuThemeAction(theme){window.savedThemes.push(theme);return {ok:true,message:'Saved'}}`,
  '@/lib/actions/admin':`export async function updateDemoMenuThemeAction(theme){window.savedThemes.push(theme);return {ok:true,message:'Saved'}}`,
  '@/lib/actions/menu-contact':`export async function saveMenuContact(previous,form){window.savedProfile=Object.fromEntries(form);return {ok:true,message:'Saved'}}`,
  '@/lib/supabase/client':`export function createClient(){return {storage:{from(){return {async upload(){await new Promise(r=>setTimeout(r,100));return {error:null}},getPublicUrl(path){return {data:{publicUrl:'https://example.com/'+path}}}}}}}}`,
  '@/lib/actions/dashboard-settings':`export async function saveDashboardSettings(previous,form){window.savedSettings=Object.fromEntries(form);return {ok:true,message:'Saved'}}`,
 };
 const app=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {useState} from 'react';import {ThemePicker} from '@/components/dashboard/ThemePicker';import {SettingsForm} from '@/components/dashboard/SettingsForm';import {MenuContactForm} from '@/components/dashboard/MenuContactForm';import {I18nProvider} from '@/components/i18n/I18nProvider';import {ToastProvider} from '@/components/ui/Toast';import {MENU_ONLY_MODULES} from '@/lib/business-modules';import {MENU_ONLY_FEATURES} from '@/lib/business-features';
 const params=new URLSearchParams(location.search),locale=params.get('lang')||'ar';document.documentElement.dir=locale==='ar'?'rtl':'ltr';window.savedThemes=[];
 const restaurant={id:'sample',slug:'sample',menu_theme:'modern',name:'Sample',business_kind:'restaurant',enabled_modules:[...MENU_ONLY_MODULES,...MENU_ONLY_FEATURES,'features_v2','features_v3'],ordering_enabled:false,waiter_calls_enabled:false};
 function App(){return <I18nProvider locale={locale}><ToastProvider><main className="mx-auto max-w-5xl p-4 sm:p-6">{params.has('settings')?<SettingsForm restaurant={restaurant} hasTables={false} settings={{sound_enabled:true,show_prices:true,show_ingredients:true}} sections={[{id:'profile',ar:'البروفايل',en:'Profile',content:<MenuContactForm restaurant={{...restaurant,logo_url:'/images/clients/t9-logo.jpg',cover_url:'/images/clients/t9-cover.jpg'}} settings={{}}/>}]}/>:<ThemePicker current="modern" slug="sample" isActive/>}</main></ToastProvider></I18nProvider>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',absWorkingDir:root,plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
 const css=['chunks','css'].flatMap(dir=>{const folder=path.join(root,'.next/static',dir);return fs.existsSync(folder)?fs.readdirSync(folder).filter(p=>p.endsWith('.css')).map(p=>fs.readFileSync(path.join(folder,p),'utf8')):[]}).join('\n');
 const server=http.createServer((req,res)=>{
  if(req.url==='/test.js'){res.setHeader('content-type','text/javascript');return res.end(app.outputFiles[0].text)}
  if(req.url==='/test.css'){res.setHeader('content-type','text/css');return res.end(css)}
  if(req.url.startsWith('/test')){res.setHeader('content-type','text/html');return res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>')}
  const proxy=http.request({hostname:'127.0.0.1',port:3100,path:req.url,headers:{...req.headers,host:'localhost:3100'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});proxy.on('error',e=>{res.statusCode=502;res.end(e.message)});req.pipe(proxy);
 }).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const imported=process.env.CHROMIUM_MODULE?await import(process.env.CHROMIUM_MODULE):null;
 const binary=imported?.default;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (binary?await binary.executablePath():undefined),args:binary?binary.args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/test');await page.getByRole('button',{name:'معاينة أنيق',exact:true}).waitFor();
   await page.waitForFunction(()=>document.querySelectorAll('iframe').length===5);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
   assert.equal(await page.locator('article').count(),5);
   const preview=page.getByRole('button',{name:'معاينة أنيق',exact:true});await preview.click();
   const modal=page.getByRole('dialog');await modal.waitFor();
   const frame=page.frameLocator('iframe[title="معاينة المنيو كاملة"]');await frame.getByRole('heading',{name:'كافيه بلوم'}).waitFor();
   assert.equal(await page.evaluate(()=>window.savedThemes.length),0);
   await modal.getByRole('button',{name:'اختيار القالب',exact:true}).click();await modal.waitFor({state:'hidden'});
   assert.equal(await page.locator('article').first().getByRole('button',{name:'محدد',exact:true}).getAttribute('aria-pressed'),'true');
   await page.getByRole('button',{name:'استخدم أنيق',exact:true}).click();await page.waitForFunction(()=>window.savedThemes.length===1);
   assert.deepEqual(await page.evaluate(()=>window.savedThemes),['elegant']);
   await page.screenshot({path:`/tmp/menu-design-${width}.png`,fullPage:true});
  }
  await page.goto(origin+'/test?settings=1');
  assert.equal(await page.getByRole('switch').count(),2);
  assert.equal(await page.getByText('صوت الإشعارات',{exact:true}).count(),0);
  await page.getByRole('tab',{name:'البروفايل',exact:true}).click();
  await page.getByLabel('رابط اللوكيشن',{exact:true}).fill('https://maps.example.com/cafe');
  await page.getByRole('button',{name:'حفظ البروفايل',exact:true}).click();
  await page.waitForFunction(()=>window.savedProfile?.location_url==='https://maps.example.com/cafe');
  assert.equal(await page.evaluate(()=>window.savedProfile.logo_url),'/images/clients/t9-logo.jpg');
  assert.equal(await page.evaluate(()=>window.savedProfile.cover_url),'/images/clients/t9-cover.jpg');
  assert.equal(await page.getByLabel('رقم محفظة كاش',{exact:true}).count(),0);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/test?settings=1');
   await page.getByRole('tab',{name:'البروفايل',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`profile overflow at ${width}`);
   await page.screenshot({path:`/tmp/menu-profile-${width}.png`,fullPage:true});
  }
  await page.locator('input[type=file]').first().setInputFiles(path.join(root,'public/images/clients/t9-logo.jpg'));
  await page.waitForFunction(()=>document.querySelector('input[name=logo_url]').value.startsWith('https://example.com/'));
  await page.getByRole('button',{name:'حفظ البروفايل',exact:true}).click();
  await page.waitForFunction(()=>window.savedProfile?.logo_url.startsWith('https://example.com/'));
  await page.goto(origin+'/test?lang=en');await page.getByRole('button',{name:'Preview Elegant',exact:true}).click();
  await page.frameLocator('iframe[title="Full menu preview"]').getByRole('heading',{name:'Bloom Café'}).waitFor();
  await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
  for(const theme of ['elegant','modern','minimal','noir','market']){
   await page.goto(origin+'/preview/menu-theme/'+theme+'?lang=ar');await page.getByRole('heading',{name:'كافيه بلوم'}).waitFor();
   assert.equal(await page.getByRole('button',{name:/أضف إلى الطلب|Add to order/}).count(),0);
  }
  assert.deepEqual(errors,[]);console.log('PASS: five real theme previews, AR/EN, 320/390/768/1440 without overflow, preview/select/save isolation, dialog close and settings save with paid controls hidden');
 }catch(error){console.error('Browser errors:',errors);await page.screenshot({path:'/tmp/menu-profile-failure.png',fullPage:true});throw error;}finally{await browser.close();await new Promise(r=>server.close(r));next.kill()}
})().catch(e=>{console.error(e);process.exit(1)});
