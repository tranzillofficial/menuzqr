import QRCode from "qrcode";
import {receiptRuqaa,hasArabicBrand} from "./receipt-brand";
import type { FiscalSnapshot } from "./tax";
export type PosReceipt = {
  menuUrl?: string; testPrint?: boolean; orderId?: string; documentNumber?: string; originalDocumentNumber?: string; currency?: string; fiscal?: FiscalSnapshot | null; paidAt?: string | null; creditNote?: boolean; creditDate?: string;
  number: number; total: number; received: number; tableLabel: string | null;
  payment: 'cash' | 'card' | 'transfer'; fiscalState?: string; createdAt: string; note: string;
  lines: { variantId: string; name: string; variant: string; price: number; quantity: number; baseTotal?: number; discount?: number; gross?: number; net?: number; vat?: number; rate?: number; code?: string }[];
};
export type PrinterSettings = { token: string; printer: string; width: 58 | 80 };
export const DEFAULT_PRINTER: PrinterSettings = { token: '', printer: '', width: 80 };
export function printerDots(width: 58 | 80): 384 | 576 { return width === 58 ? 384 : 576; }

// Render Arabic with the browser's shaping engine, then send monochrome raster
// commands. This avoids dependence on the printer's Arabic code page support.
async function receiptCanvas(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80) {
  const brandName = receipt.fiscal?.legal_name || restaurantName;
  const brandFont = hasArabicBrand(brandName) ? receiptRuqaa.style.fontFamily : 'Arial, sans-serif';
  if (hasArabicBrand(brandName)) await Promise.race([document.fonts.load(`700 40px ${brandFont}`,brandName).catch(()=>[]),new Promise(resolve=>setTimeout(resolve,2000))]);
  let qr:HTMLCanvasElement|undefined;
  if (receipt.menuUrl && !receipt.testPrint) { qr=document.createElement('canvas'); const modules=QRCode.create(receipt.menuUrl,{errorCorrectionLevel:'M'}).modules.size; await QRCode.toCanvas(qr,receipt.menuUrl,{errorCorrectionLevel:'M',margin:4,scale:Math.max(3,Math.floor((width===58?190:220)/(modules+8)))}); }
  // Do not let a stalled web font request block the cashier indefinitely.
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 2000);
    void document.fonts.ready.then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); resolve(); });
  });
  const canvas = document.createElement('canvas');
  const dots = printerDots(width);
  const padding = 12, usable = dots - padding * 2;
  const fontSize = width === 58 ? 25 : 30;
  const rows: {text?: string; value?: string; size: number; height: number; align?: CanvasTextAlign; direction?: CanvasDirection; rule?: boolean; font?:string}[] = [];
  canvas.width = dots; canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt rendering is unavailable');
  const split = (text: string, available: number, size: number, font = "Arial, sans-serif") => {
    context.font = `bold ${size}px ${font}`;
    const lines: string[] = []; let line = '';
    for (const word of text.replace(/[\r\n]/g, ' ').split(/\s+/)) {
      if (line && context.measureText(`${line} ${word}`).width > available) { lines.push(line); line = ''; }
      for (const char of (line ? ' ' : '') + word) {
        if (line && context.measureText(line + char).width > available) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (value: string, size = fontSize, align: CanvasTextAlign = ar ? 'right' : 'left', direction: CanvasDirection = ar ? 'rtl' : 'ltr', font = 'Arial, sans-serif') => {
    for (const line of split(value, usable, size, font)) rows.push({text: line, size, height: size + (font !== 'Arial, sans-serif' ? 22 : 12), align, direction, font});
  };
  const gap = (height = 8) => rows.push({size: 0, height});
  const rule = () => rows.push({size: 0, height: 18, rule: true});
  const pair = (name: string, value: string, size = fontSize) => {
    context.font = `bold ${size}px Arial, sans-serif`;
    if (context.measureText(name).width + context.measureText(value).width + 24 > usable) {
      text(name, size); text(value, size, ar ? 'left' : 'right', 'ltr');
    } else rows.push({text: name, value, size, height: size + 14});
  };
  const label = (a: string, e: string) => ar ? a : e;
  const fiscal = receipt.fiscal, sign = receipt.creditNote ? -1 : 1;
  const amount = (n: number) => n.toFixed(2);
  const money = (n: number) => `${amount(n)} ${receipt.currency || currency}`;
  if (receipt.testPrint) {
    text(restaurantName + ' TEST', fontSize, 'center', 'ltr');
    text(label('اختبار الطباعة', 'Print test'), fontSize, 'center');
  } else {
    text(brandName, fontSize + 14, 'center', hasArabicBrand(brandName)?'rtl':'ltr', brandFont);
    if (fiscal?.address) text(fiscal.address, fontSize - 2, 'center');
    if (fiscal?.registered && fiscal.vat_number) text(`VAT / TRN: ${fiscal.vat_number}`, fontSize - 2, 'center', 'ltr');
    gap();
    const title = receipt.creditNote ? label('إشعار دائن', 'Credit note') : fiscal?.invoice_kind === 'full' || fiscal?.invoice_kind === 'simplified' ? label('فاتورة ضريبية', 'VAT invoice') : label('فاتورة بيع', 'Sales receipt');
    pair(title, receipt.creditNote ? `CN-${receipt.number}` : receipt.documentNumber ?? `#${receipt.number}`);
    text(new Date(receipt.creditNote ? receipt.creditDate ?? receipt.createdAt : receipt.createdAt).toLocaleString('en-GB', {timeZone: fiscal?.timezone ?? 'Africa/Cairo'}), fontSize - 3, 'center', 'ltr');
    if (receipt.creditNote) pair(label('الفاتورة الأصلية', 'Original invoice'), receipt.originalDocumentNumber ?? String(receipt.number));
    if (receipt.paidAt && fiscal?.invoice_kind === 'full') text(`${label('تاريخ التوريد', 'Supply date')}: ${new Date(receipt.paidAt).toLocaleString('en-GB', {timeZone: fiscal?.timezone ?? 'Africa/Cairo'})}`);
    if (receipt.tableLabel) pair(label('الطاولة', 'Table'), receipt.tableLabel);
    if (fiscal?.customer?.name) text(`${label('العميل', 'Customer')}: ${fiscal.customer.name}`);
    if (fiscal?.customer?.phone) pair(label('الموبايل', 'Phone'), fiscal.customer.phone);
    if (fiscal?.customer?.code) pair(label('كود العميل', 'Customer code'), fiscal.customer.code);
    if (fiscal?.customer?.address) text(fiscal.customer.address);
    if (fiscal?.customer?.vat_number) text(`Customer VAT: ${fiscal.customer.vat_number}`);
    rule();
    pair(label('الصنف / الكمية × السعر', 'Item / Qty × price'), label('القيمة', 'Amount'), fontSize - 4);
    gap(4);
    for (const line of receipt.lines) {
      const price = amount(fiscal?.registered && fiscal.mode !== 'egypt' && line.net !== undefined && line.quantity > 0 ? line.net / line.quantity : line.price);
      const total = amount(sign * (fiscal?.mode === 'egypt' ? line.baseTotal ?? line.price * line.quantity : line.gross ?? line.price * line.quantity));
      text(`${line.name}${line.variant && line.variant !== 'Regular' ? ` (${line.variant})` : ''}`);
      // Separate columns keep numbers ordered and names readable in either language.
      pair(`${line.quantity} × ${(line.discount ?? 0) > 0 ? amount(line.price) : price}`, total, fontSize - 2);
      if ((line.discount ?? 0) > 0) pair(label('خصم العرض', 'Offer discount'), `-${amount(sign * line.discount!)}`, fontSize - 3);
      if (fiscal?.registered && fiscal.mode !== 'egypt') pair(`${label('ضريبة', 'VAT')} ${line.rate ?? 0}%`, money(sign * (line.vat ?? 0)), fontSize - 3);
      gap(8);
    }
    rule();
    if (fiscal?.discount_total) pair(label('خصم العروض', 'Offer discount'), `-${money(sign * fiscal.discount_total)}`);
    if (fiscal?.delivery_fee) pair(label('التوصيل', 'Delivery'), money(sign * fiscal.delivery_fee));
    if (fiscal?.registered) {
      pair(label('قبل الضريبة', 'Subtotal'), money(sign * fiscal.net));
      pair(label('الضريبة', 'VAT'), money(sign * fiscal.vat));
    }
    pair(label('الإجمالي', 'TOTAL'), money(sign * receipt.total), fontSize + 5);
    const paid = receipt.fiscalState !== 'unpaid' && receipt.fiscalState !== 'voided';
    if (!paid) pair(label('المتبقي', 'Due'), money(sign * receipt.total));
    if (paid && receipt.payment === 'cash' && !receipt.creditNote && receipt.received > receipt.total) {
      pair(label('المدفوع', 'Received'), money(receipt.received));
      pair(label('الباقي', 'Change'), money(receipt.received - receipt.total));
    }
    if (fiscal?.registered && fiscal.mode !== 'egypt') {
      for (const b of fiscal.breakdown ?? []) {
        text(`${b.code} ${b.rate}% | Net ${money(sign * b.net)} | VAT ${money(sign * b.vat)}`, fontSize - 3, ar ? 'right' : 'left', 'ltr');
      }
    }
    if (fiscal?.registered && fiscal.invoice_kind === 'receipt') text(fiscal.mode === 'saudi' ? label('إيصال بيع. الربط بالفوترة الإلكترونية غير مفعّل.', 'Sales receipt. Electronic invoicing is not connected.') : label('ليس فاتورة ضريبية كاملة.', 'Not a full VAT invoice.'), fontSize - 3);
    if (receipt.note) { rule(); text(receipt.note); }
    gap();
    text(label('شكرًا لزيارتكم', 'Thank you for your visit'), fontSize - 3, 'center');
  }
  canvas.height = rows.reduce((height, row) => height + row.height, 8 + (qr ? qr.height + 12 : 0));
  if (receipt.testPrint && canvas.height > 160) throw new Error('Test receipt exceeds 20 mm');
  if (canvas.height > 20000) throw new Error('Receipt is too long');
  context.fillStyle = '#fff'; context.fillRect(0, 0, dots, canvas.height);
  context.textBaseline = 'middle';
  let top = 4;
  const draw = (value: string, x: number, y: number, align: CanvasTextAlign, direction: CanvasDirection) => {
    context.direction = direction; context.textAlign = align;
    context.fillText(value, x, y);
  };
  for (const row of rows) {
    context.fillStyle = '#000';
    context.font = `bold ${row.size}px ${row.font ?? "Arial, sans-serif"}`;
    const y = top + row.height / 2;
    if (row.rule) context.fillRect(padding, Math.floor(y), usable, 2);
    else if (row.value !== undefined) {
      draw(row.text ?? '', ar ? dots - padding : padding, y, ar ? 'right' : 'left', /^[\d\s×.]+$/.test(row.text ?? '') ? 'ltr' : ar ? 'rtl' : 'ltr');
      draw(row.value, ar ? padding : dots - padding, y, ar ? 'left' : 'right', /[\u0600-\u06ff]/.test(row.value) ? 'rtl' : 'ltr');
    } else if (row.text) {
      const align = row.align ?? (ar ? 'right' : 'left');
      draw(row.text, align === 'center' ? dots / 2 : align === 'right' ? dots - padding : padding, y, align, row.direction ?? (ar ? 'rtl' : 'ltr'));
    }
    top += row.height;
  }
  if(qr) { context.imageSmoothingEnabled=false; context.drawImage(qr,Math.floor((dots-qr.width)/2),top+4); }
  return canvas;
}

export async function receiptRaster(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80) {
  const canvas = await receiptCanvas(receipt, restaurantName, currency, ar, width);
  const dots = canvas.width;
  const context = canvas.getContext('2d')!;
  const pixels = context.getImageData(0, 0, dots, canvas.height).data;
  const bytesPerRow = dots / 8;
  const raster = new Uint8Array(bytesPerRow * canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < dots; x++) {
    const i = (y * dots + x) * 4;
    if ((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 < 160) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
  }
  // Crop empty rows, keeping only two pixels of whitespace around the ink.
  const inkRow = (row: number) => raster.subarray(row * bytesPerRow, (row + 1) * bytesPerRow).some(byte => byte !== 0);
  let first = 0, last = canvas.height - 1;
  while (first <= last && !inkRow(first)) first++;
  if (first > last) throw new Error('Receipt contains no printable content');
  while (!inkRow(last)) last--;
  first = Math.max(0, first - 2); last = Math.min(canvas.height - 1, last + 2);
  let binary = '';
  for (const byte of raster.subarray(first * bytesPerRow, (last + 1) * bytesPerRow)) binary += String.fromCharCode(byte);
  return { protocol: 'windows-gdi-v1', paperMm: width, width: dots, height: last - first + 1, raster: btoa(binary) };
}

export async function receiptImage(receipt:PosReceipt,name:string,currency:string,ar:boolean,width:58|80){
 const canvas=await receiptCanvas(receipt,name,currency,ar,width);
 return {png:canvas.toDataURL('image/png'),height:canvas.height,width:canvas.width};
}
