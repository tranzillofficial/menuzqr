"use client";
import {useImperativeHandle,useRef,useState,type Ref} from 'react';
import {useReactToPrint} from 'react-to-print';
import {qzConnection} from '@/lib/qz-print';
import {receiptImage,type PosReceipt} from '@/lib/thermal-print';
import {recordReceiptPrint} from '@/lib/actions/fiscal';
import {alhamdUnitLabel} from '@/lib/alhamd-units';
import {Button} from '@/components/ui/Button';
import {Modal} from '@/components/ui/Modal';
import {useI18n} from '@/components/i18n/I18nProvider';
export type ReceiptPrinterHandle={printReceipt:(receipt:PosReceipt)=>Promise<void>};
let printBusy=false;
export function ThermalPrinter({restaurantId,restaurantName,currency,receipt,printRef,compact=false}:{compact?:boolean;printRef?:Ref<ReceiptPrinterHandle>;restaurantId:string;restaurantName:string;currency:string;receipt:PosReceipt|null}){
 const {locale}=useI18n();const ar=locale==='ar';const l=(a:string,e:string)=>ar?a:e;
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[printers,setPrinters]=useState<string[]>([]),[printer,setPrinter]=useState(''),[width,setWidth]=useState<58|80>(80),[message,setMessage]=useState(''),[preview,setPreview]=useState<string>(''),[pendingReceipt,setPendingReceipt]=useState<PosReceipt|null>(null);
 const content=useRef<HTMLDivElement>(null);const pending=useRef<PosReceipt|null>(null);const printed=useRef(new Set<string>());const prepared=useRef<PosReceipt|null>(null);
 const key=`menuzqr-qz:${restaurantId}`;
 const [receiptLanguage,setReceiptLanguage]=useState<'ar'|'en'|null>(null);
 function savedLanguage(){try{const value=JSON.parse(localStorage.getItem(key)||'{}').language;return value==='ar'||value==='en'?value:locale;}catch{return locale;}}
 function chooseLanguage(value:'ar'|'en'){setReceiptLanguage(value);setPreview('');try{const saved=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...saved,language:value}));}catch{}}
 async function journal(data:PosReceipt,method:'thermal'|'browser'){if(data.orderId)await recordReceiptPrint(data.orderId,data.creditNote?'credit':'invoice',method);}
 const browserPrint=useReactToPrint({contentRef:content,documentTitle:'Receipt',pageStyle:`@page { size: ${width}mm auto; margin: 0; } body { margin:0; }`,onAfterPrint:()=>{if(prepared.current)void journal(prepared.current,'browser');}});
 function save(name:string,paper:58|80){setPrinter(name);setWidth(paper);try{localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)||'{}'),printer:name,width:paper}));}catch{}}
 async function connect(){
  setBusy(true);try{
   setReceiptLanguage(savedLanguage());const qz=await qzConnection();const names=await qz.printers.find();let saved:{printer?:string;width?:number}={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
   const preferred=names.includes(printer)?printer:names.includes(saved.printer??'')?saved.printer!:await qz.printers.getDefault().catch(()=>names[0]??'');
   const paper=saved.width===58?58:width;setPrinters(names);save(preferred,paper);setMessage(l('تم الاتصال بالطابعة.','Printer connected.'));return {qz,printer:preferred,width:paper};
  }catch{setOpen(true);setMessage(l('شغّل QZ Tray على جهاز الطابعة واسمح باتصال الموقع، ثم اضغط اتصال.','Start QZ Tray on the printer computer, allow the site connection, then press Connect.'));return null;}finally{setBusy(false);}
 }
 async function image(data:PosReceipt,paper:58|80){return receiptImage({...data,lines:data.lines.map(line=>({...line,variant:alhamdUnitLabel(line.variant,restaurantId)}))},restaurantName,currency,savedLanguage()==='ar',paper);}
 async function print(data:PosReceipt,reprint=false){
  if(printBusy)return;printBusy=true;setBusy(true);pending.current=data;setPendingReceipt(data);
  const job=`${data.orderId??data.number}:${data.creditNote?'credit':'sale'}`;
  try{
   if(!data.testPrint&&!reprint&&printed.current.has(job)){setMessage(l('تم إرسال هذه الفاتورة للطابعة.','This receipt was already sent.'));return;}
   const connection=await connect();if(!connection?.printer)return;
   setBusy(true);const bitmap=await image(data,connection.width);
   const config=connection.qz.configs.create(connection.printer,{units:'mm',size:{width:connection.width,height:Math.max(12,bitmap.height/8+2)},margins:{top:0,bottom:0,left:(connection.width-bitmap.width/8)/2,right:(connection.width-bitmap.width/8)/2},orientation:'portrait',copies:1,scaleContent:true,interpolation:'nearest-neighbor',jobName:`MenuzQR #${data.number}`});
   await connection.qz.print(config,[{type:'pixel',format:'image',flavor:'base64',data:bitmap.png.split(',')[1]}]);
   if(!data.testPrint)printed.current.add(job);pending.current=null;setPendingReceipt(null);setMessage(l('تم إرسال فاتورة واحدة للطابعة.','One receipt sent to the printer.'));await journal(data,'thermal');
  }catch{setOpen(true);setMessage(l('تعذر تأكيد الطباعة. راجع قائمة الطابعة قبل إعادة المحاولة لتجنب نسخة إضافية.','Could not confirm printing. Check the printer queue before retrying to avoid an extra copy.'));}finally{printBusy=false;setBusy(false);}
 }
 useImperativeHandle(printRef,()=>({printReceipt:data=>print(data)}));
 async function previewReceipt(){const data=receipt??pending.current;if(!data)return;const bitmap=await image(data,width);prepared.current=data;setPreview(bitmap.png);setOpen(true);}
 const test:PosReceipt={testPrint:true,number:0,total:0,received:0,payment:'cash',tableLabel:null,createdAt:new Date().toISOString(),note:'',lines:[]};
 return <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>{setOpen(true);void connect();}}>{l('الطابعة','Printer')}</Button>{receipt&&<Button size="sm" loading={busy} disabled={busy} onClick={()=>print(receipt,true)}>{l('طباعة الفاتورة','Print receipt')}</Button>}{!compact&&<Button size="sm" variant="secondary" disabled={busy} onClick={()=>print(test)}>{l('اختبار صغير','Small test')}</Button>}</div>{message&&<p role="status" className="text-xs text-ink-500">{message}</p>}
 <Modal open={open} onClose={()=>setOpen(false)} title={l('إعداد الطابعة','Printer setup')} size="md"><div className="space-y-4"><p className="text-sm">{l('ثبّت QZ Tray على جهاز الطابعة، ثم اختر الطابعة وعرض الورق مرة واحدة. اختر ملف التثبيت المناسب لويندوز عندك.','Install QZ Tray on the printer computer, then choose a printer and paper width once. Choose the installer for your Windows version.')}</p><a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="text-brand-700 underline">{l('تحميل QZ للأجهزة الحديثة — 64-bit','Download QZ for modern computers — 64-bit')}</a><a href="https://github.com/tranzillofficial/menuzqr/releases/download/qz-win7-x86-v2/MenuzQR-QZ-Win7-x86-Setup.exe" className="block text-brand-700 underline">{l('تثبيت / تحديث الطباعة لـ Windows 7 SP1 — 32-bit','Install / update Windows 7 SP1 — 32-bit printing')}</a><p className="text-xs text-ink-500">{l('نسخة Windows 7 تشمل Java داخل ملف التثبيت؛ لا تحتاج تثبيت برامج إضافية. تستخدم QZ 2.1 القديم خارج الدعم الحالي. أعد تشغيل المثبّت المحدّث مرة واحدة لاعتماد الموقع وإيقاف طلب الموافقة المتكرر.','The Windows 7 installer includes Java; no separate runtime installation is needed. It uses legacy QZ 2.1, outside current support. Run the updated installer once to authorize MenuzQR and stop repeated approval prompts.')}</p><p className="text-xs text-ink-500">{l('الطباعة الموقّعة تعمل بدون تأكيد متكرر بعد تثبيت تحديث الاعتماد. قص الورق يعتمد على تعريف الطابعة. على الهاتف استخدم طباعة المتصفح أو جهاز كاشير عليه QZ.','Signed printing avoids repeated prompts after the trust update is installed. Cutting depends on the printer driver. On phones, use browser printing or a cashier computer running QZ.')}</p><Button onClick={()=>connect()} disabled={busy}>{l('اتصال','Connect')}</Button><label className="block text-sm">{l('الطابعة','Printer')}<select className="mt-1 w-full rounded-xl border border-ink-100 p-3" value={printer} onChange={e=>save(e.target.value,width)}><option value="">{l('اختر الطابعة','Choose printer')}</option>{printers.map(name=><option key={name}>{name}</option>)}</select></label><label className="block text-sm">{l('عرض الورق','Paper width')}<select className="mt-1 w-full rounded-xl border border-ink-100 p-3" value={width} onChange={e=>save(printer,e.target.value==='58'?58:80)}><option value="80">80 mm</option><option value="58">58 mm</option></select></label><fieldset className="rounded-xl border border-ink-100 p-3"><legend className="px-1 text-sm">{l('لغة واتجاه الفاتورة','Receipt language and direction')}</legend><div className="flex gap-2"><Button size="sm" disabled={busy} variant={(receiptLanguage??locale)==='ar'?'primary':'secondary'} onClick={()=>chooseLanguage('ar')}>عربي ← RTL</Button><Button size="sm" disabled={busy} variant={(receiptLanguage??locale)==='en'?'primary':'secondary'} onClick={()=>chooseLanguage('en')}>English → LTR</Button></div><p className="mt-2 text-xs text-ink-500">{l('محفوظ على هذا الجهاز. أسماء المنتجات تظل كما سجلتها.','Saved on this computer. Product names stay as entered.')}</p></fieldset><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>print(test)}>{l('اختبار صغير','Small test')}</Button>{(receipt||pendingReceipt)&&<><Button disabled={busy} onClick={()=>print((receipt??pending.current)!,true)}>{l('طباعة الفاتورة','Print receipt')}</Button><Button variant="secondary" onClick={()=>previewReceipt()}>{l('معاينة / طباعة المتصفح','Preview / browser print')}</Button></>}</div>{preview&&<><div ref={content} style={{width:`${width}mm`,margin:0}}><img src={preview} alt="Receipt" style={{display:'block',width:'100%',height:'auto'}}/></div><Button onClick={()=>browserPrint()}>{l('فتح طباعة المتصفح','Open browser printing')}</Button></>}</div></Modal></div>;
}
