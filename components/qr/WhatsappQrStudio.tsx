"use client";
import {useState} from 'react';
import {QrLabelPreview} from './QrLabelPreview';
import {renderQrLabel,canvasToPngUrl,downloadUrl,type QrStyle} from '@/lib/qr-label';
const styles:Record<string,QrStyle>={
 cream:{layout:'square',bgColor:'#faf7f2',panelColor:'#ffffff',accentColor:'#704728',textColor:'#39281e',qrColor:'#39281e',headline:'WhatsApp',ctaText:'تواصل معنا · Contact us'},
 green:{layout:'counter',bgColor:'#ecfdf5',panelColor:'#ffffff',accentColor:'#047857',textColor:'#064e3b',qrColor:'#064e3b',headline:'WhatsApp',ctaText:'تواصل معنا · Contact us'},
 dark:{layout:'square',bgColor:'#171719',panelColor:'#ffffff',accentColor:'#c9a227',textColor:'#c9a227',qrColor:'#171719',headline:'WhatsApp',ctaText:'تواصل معنا · Contact us'},
};
export function WhatsappQrStudio({number,name='WhatsApp'}:{number:string;name?:string}){
 const [theme,setTheme]=useState('cream'),[busy,setBusy]=useState(false);const input={url:`https://wa.me/${number}`,title:name,subtitle:`+${number}`,style:styles[theme]};
 async function download(){setBusy(true);try{const canvas=await renderQrLabel({...input,width:1600});downloadUrl(canvasToPngUrl(canvas),'whatsapp-qr.png');}finally{setBusy(false);}}
 return <div className="space-y-3"><label className="block text-sm">تصميم QR · QR design<select value={theme} onChange={e=>setTheme(e.target.value)} className="mt-1 w-full rounded-xl border border-ink-100 p-3"><option value="cream">كريمي · Cream</option><option value="green">أخضر · Green</option><option value="dark">أسود · Dark</option></select></label><QrLabelPreview input={input}/><button type="button" disabled={busy} onClick={()=>download()} className="rounded-xl bg-ink-900 px-4 py-3 text-sm text-white">تحميل PNG · Download PNG</button></div>;
}
