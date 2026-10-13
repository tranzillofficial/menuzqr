import type { FiscalSnapshot } from "./tax";
export type PosReceipt = {
  testPrint?: boolean; orderId?: string; documentNumber?: string; originalDocumentNumber?: string; currency?: string; fiscal?: FiscalSnapshot | null; paidAt?: string | null; creditNote?: boolean; creditDate?: string;
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
  // Do not let a stalled web font request block the cashier indefinitely.
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 2000);
    void document.fonts.ready.then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); resolve(); });
  });
  const canvas = document.createElement('canvas');
  const dots = printerDots(width);
  const padding = 8, usable = dots - padding * 2;
  const fontSize = width === 58 ? 22 : 26;
  const rowHeight = width === 58 ? 26 : 30;
  const font = `${fontSize}px Arial, sans-serif`;
  canvas.width = dots; canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt rendering is unavailable');
  type Row = { text?: string; bold?: boolean; band?: boolean; align?: CanvasTextAlign; direction?: CanvasDirection };
  const rows: Row[] = [];
  const split = (text: string, available: number, bold = true, size = fontSize) => {
    context.font = `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`;
    const lines: string[] = []; let line = '';
    for (const word of text.replace(/[\r\n]/g, ' ').split(/\s+/)) {
      if (line && context.measureText(`${line} ${word}`).width > available) { lines.push(line); line = ''; }
      for (const char of (line ? ' ' : '') + word) {
        if (line && context.measureText(line + char).width > available) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const wrap = (text: string, bold = true, band = false, align: CanvasTextAlign = ar ? 'right' : 'left', direction: CanvasDirection = ar ? 'rtl' : 'ltr') => {
    if (!text.trim()) return;
    for (const line of split(text, usable - 8, bold)) rows.push({text: line, bold, band, align, direction});
  };
  const label = (a: string, e: string) => ar ? a : e;
  const fiscal = receipt.fiscal, sign = receipt.creditNote ? -1 : 1;
  const amount = (n: number) => n.toFixed(2);
  const money = (n: number) => `${amount(n)} ${currency}`;
  if (receipt.testPrint) {
    wrap('MenuzQR TEST', true, false, 'center', 'ltr');
    wrap('عربي واضح / English', true, false, 'center');
  } else {
  wrap(fiscal?.legal_name || restaurantName, true, false, 'center');
  if (fiscal?.address) wrap(fiscal.address);
  if (fiscal?.registered) wrap(`VAT / TRN: ${fiscal.vat_number}`);
  wrap(`${receipt.creditNote ? label('إشعار دائن', 'Credit note') : fiscal?.invoice_kind === 'full' || fiscal?.invoice_kind === 'simplified' ? label('فاتورة ضريبية', 'VAT invoice') : label('فاتورة بيع', 'Sales receipt')} ${receipt.creditNote ? `CN-${receipt.number}` : receipt.documentNumber ?? `#${receipt.number}`}`, true);
  wrap(new Date(receipt.creditNote ? receipt.creditDate ?? receipt.createdAt : receipt.createdAt).toLocaleString('en-GB', {timeZone: fiscal?.timezone ?? 'Africa/Cairo'}));
  if (receipt.creditNote) wrap(`${label('الفاتورة الأصلية', 'Original invoice')}: ${receipt.originalDocumentNumber ?? receipt.number}`);
  if (receipt.paidAt && fiscal?.invoice_kind === 'full') wrap(`${label('تاريخ التوريد', 'Supply date')}: ${new Date(receipt.paidAt).toLocaleString('en-GB', {timeZone: fiscal?.timezone ?? 'Africa/Cairo'})}`);
  if (receipt.tableLabel) wrap(`${label('الطاولة', 'Table')}: ${receipt.tableLabel}`);
  if (fiscal?.customer?.name) wrap(`${label('العميل', 'Customer')}: ${fiscal.customer.name}`);
  if (fiscal?.customer?.phone) wrap(`${label('الموبايل', 'Phone')}: ${fiscal.customer.phone}`);
  if (fiscal?.customer?.code) wrap(`${label('كود العميل', 'Customer code')}: ${fiscal.customer.code}`);
  if (fiscal?.customer?.address) wrap(fiscal.customer.address);
  if (fiscal?.customer?.vat_number) wrap(`Customer VAT: ${fiscal.customer.vat_number}`);
  for (const line of receipt.lines) {
    const price = amount(fiscal && fiscal.mode !== 'egypt' ? (line.net ?? 0)/line.quantity : line.price);
    const total = amount(sign * (fiscal?.mode === 'egypt' ? line.baseTotal ?? line.price * line.quantity : line.gross ?? line.price * line.quantity));
    // Give the product name the full printable width on every roll size.
    wrap(`${line.name}${line.variant && line.variant !== 'Regular' ? ` (${line.variant})` : ''}`, true);
    wrap((line.discount??0)>0 ? `${line.quantity} × ${amount(line.price)} | ${label('الإجمالي','Total')}: ${total}` : `${line.quantity} × ${price} = ${total}`, true, false, 'right', 'ltr');
    if ((line.discount??0)>0) wrap(`${label('خصم العرض','Offer discount')}: -${amount(sign*line.discount!)}`);
    if (fiscal?.registered && fiscal.mode !== 'egypt') wrap(`${line.code ?? ''} ${line.rate ?? 0}% | VAT ${money(sign * (line.vat ?? 0))}`);
  }

  if (fiscal?.discount_total) wrap(`${label('خصم العروض','Offer discount')}: -${money(sign * fiscal.discount_total)}`);
  if (fiscal?.delivery_fee) wrap(`${label('التوصيل','Delivery')}: ${money(sign * fiscal.delivery_fee)}`);
  if (fiscal?.registered) wrap(`${label('الإجمالي قبل الضريبة','Subtotal')}: ${money(sign * fiscal.net)}`);
  if (fiscal?.registered) wrap(`${label('الضريبة','VAT')}: ${money(sign * fiscal.vat)}`);
  wrap(`${label('الصافي','Total')}: ${money(sign * receipt.total)}`,true,true);
  const paid = receipt.fiscalState !== 'unpaid' && receipt.fiscalState !== 'voided';
  if (!paid) wrap(`${label('المتبقي','Due')}: ${money(sign * receipt.total)}`);
  if (paid && receipt.payment === 'cash' && !receipt.creditNote && receipt.received > receipt.total) wrap(`${label('الباقي للعميل','Change')}: ${money(receipt.received - receipt.total)}`);
  for (const b of fiscal?.mode === 'egypt' ? [] : fiscal?.breakdown ?? []) wrap(`${b.code} ${b.rate}% | Net ${money(sign*b.net)} | VAT ${money(sign*b.vat)}`);
  if (fiscal?.registered && fiscal.invoice_kind === 'receipt') wrap(fiscal.mode === 'saudi' ? label('إيصال بيع. الربط بالفوترة الإلكترونية غير مفعّل.','Sales receipt. Electronic invoicing is not connected.') : label('ليس فاتورة ضريبية كاملة.','Not a full VAT invoice.'));
  if (receipt.note) wrap(receipt.note);
  }
  canvas.height = rows.length * rowHeight + 8;
  if (receipt.testPrint && canvas.height > 160) throw new Error('Test receipt exceeds 20 mm');
  if (canvas.height > 20000) throw new Error('Receipt is too long');
  context.fillStyle = '#fff'; context.fillRect(0,0,dots,canvas.height);
  context.textBaseline = 'middle';
  rows.forEach((row,index)=>{
    const top = index * rowHeight + 4;
    context.fillStyle = row.band ? '#000' : '#fff';
    context.fillRect(padding,top,usable,rowHeight);
    context.fillStyle = row.band ? '#fff' : '#000';
    context.font = `${row.bold ? 'bold ' : ''}${font}`;
    context.direction = row.direction ?? (ar ? 'rtl' : 'ltr'); context.textAlign = row.align ?? 'center';
    const x = row.align === 'right' ? dots-padding-4 : row.align === 'left' ? padding+4 : dots/2;
    context.fillText(row.text ?? '', x,top+rowHeight/2,usable-8);
  });
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
