"use client";
import {useState} from 'react';
import {Button} from '@/components/ui/Button';
import {useI18n} from '@/components/i18n/I18nProvider';
import {exportInvoiceBatch} from '@/lib/actions/invoice-export';
import {zipFiles} from '@/lib/invoice-export';
type Directory={getDirectoryHandle:(name:string,options:{create:boolean})=>Promise<Directory>;getFileHandle:(name:string,options:{create:boolean})=>Promise<{createWritable:()=>Promise<{write:(content:string)=>Promise<void>;close:()=>Promise<void>}>}>};
export function InvoiceExport(){
 const {locale}=useI18n();const ar=locale==='ar';const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(folder:boolean){
  setBusy(true);setMessage('');let count=0;
  const date=new Date(),cutoff=date.toISOString(),stamp=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}-${String(date.getMinutes()).padStart(2,'0')}-${String(date.getSeconds()).padStart(2,'0')}_${date.getMilliseconds()}`;
  const dirname=`invoices-${stamp}`;
  try{
   const picker=(window as unknown as {showDirectoryPicker?:(options:{mode:string;id:string})=>Promise<Directory>}).showDirectoryPicker;
   let dir:Directory|undefined;
   // Must open synchronously from the click, before fetching invoice batches.
   if(folder&&picker){const parent=await picker.call(window,{mode:'readwrite',id:'menuzqr-invoices'});dir=await parent.getDirectoryHandle(dirname,{create:true});}
   else if(folder){setMessage(ar?'المتصفح لا يدعم اختيار مجلد؛ سيتم تنزيل ZIP بتاريخ التحميل.':'This browser does not support directory selection; downloading a dated ZIP.');}
   const files:{name:string;content:string}[]=[];let after=0;
   async function save(file:{name:string;content:string}){if(dir){const h=await dir.getFileHandle(file.name,{create:true});const writer=await h.createWritable();try{await writer.write(file.content);}finally{await writer.close();}}else files.push({name:`${dirname}/${file.name}`,content:file.content});}
   while(true){const batch=await exportInvoiceBatch(after,cutoff);for(const file of batch.files)await save(file);count+=batch.count;setMessage(`${ar?'جاري حفظ الفواتير':'Saving invoices'}: ${count}`);if(batch.done)break;if(batch.next<=after)throw new Error('Invalid pagination');after=batch.next;}
   await save({name:'manifest.json',content:JSON.stringify({exportedAt:cutoff,invoices:count,format:'HTML receipts + JSON financial records'},null,2)});
   if(!dir){const bytes=zipFiles(files);const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download=`${dirname}.zip`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
   setMessage(ar?`تم تجهيز ${count} فاتورة في ${dirname}${dir?'':' (ZIP)'}.`:`Exported ${count} invoices to ${dirname}${dir?'':' (ZIP)'}.`);
  }catch(e){if(e instanceof DOMException&&e.name==='AbortError')setMessage(ar?'تم إلغاء اختيار المجلد.':'Directory selection cancelled.');else setMessage(ar?`تعذر إكمال التحميل. تم حفظ ${count} فاتورة؛ أعد المحاولة في مجلد جديد.`:`Export interrupted after ${count} invoices; retry in a new folder.`);}finally{setBusy(false);}
 }
 return <section className="mb-5 rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center gap-2"><span className="me-auto text-sm font-semibold">{ar?'حفظ الفواتير على الجهاز':'Save invoices locally'}</span><Button size="sm" variant="secondary" disabled={busy} onClick={()=>download(true)}>{ar?'اختيار مجلد وحفظ':'Choose folder and save'}</Button><Button size="sm" variant="secondary" disabled={busy} onClick={()=>download(false)}>{ar?'تحميل ZIP':'Download ZIP'}</Button></div><p className="mt-2 text-xs text-ink-500">{ar?'كل تحميل ينشئ مجلدًا بالتاريخ والوقت، يحتوي الفواتير وسجلها المالي. افتح ملف HTML لطباعة الفاتورة أو حفظ PDF. اختيار المسار حسب دعم المتصفح، والبديل ملف ZIP.':'Each export creates a dated folder of receipts and financial records. Open HTML to print or save PDF. Directory selection depends on browser support; ZIP is available as a fallback.'}</p>{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</section>;
}
