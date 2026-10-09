import type { FiscalSnapshot } from "./tax";
export type PosReceipt = {
  orderId?: string; documentNumber?: string; originalDocumentNumber?: string; currency?: string; fiscal?: FiscalSnapshot | null; paidAt?: string | null; creditNote?: boolean; creditDate?: string;
  number: number; total: number; received: number; tableLabel: string | null;
  payment: 'cash' | 'card' | 'transfer'; fiscalState?: string; createdAt: string; note: string;
  lines: { variantId: string; name: string; variant: string; price: number; quantity: number; gross?: number; net?: number; vat?: number; rate?: number; code?: string }[];
};
export type PrinterSettings = { token: string; printer: string; width: 58 | 80; cut: boolean; mode?: 'browser' | 'bridge'; dots?: 384 | 512 | 576; feedMm?: number };
export const DEFAULT_PRINTER: PrinterSettings = { token: '', printer: '', width: 80, cut: true, mode: 'bridge', dots: 576, feedMm: 3 };

export function printerDots(width: 58 | 80, dots?: number): 384 | 512 | 576 {
  return width === 58 ? 384 : dots === 512 ? 512 : 576;
}

// Loopback only: the printer is on the cashier's computer, not on Vercel.
export async function bridgeRequest(settings: PrinterSettings, path: '/printers' | '/print', body?: object) {
  const response = await fetch(`http://127.0.0.1:18191${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${settings.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(body ? 30000 : 8000),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Printer connection failed');
  return result as { printers?: string[]; ok?: boolean; version?: number };
}

// Render Arabic with the browser's shaping engine, then send monochrome raster
// commands. This avoids dependence on the printer's Arabic code page support.
async function receiptCanvas(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80, printDots?: number) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const dots = printerDots(width, printDots);
  const padding = 8, usable = dots - padding * 2;
  const fontSize = width === 58 ? 22 : 28;
  const rowHeight = width === 58 ? 30 : 36;
  const font = `${fontSize}px Arial, sans-serif`;
  canvas.width = dots; canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt rendering is unavailable');
  type Row = { text?: string; cells?: string[]; bold?: boolean; band?: boolean };
  const rows: Row[] = [];
  const split = (text: string, available: number, bold = false, size = fontSize) => {
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
  const wrap = (text: string, bold = false, band = false) => {
    for (const line of split(text, usable - 8, bold)) rows.push({text: line, bold, band});
  };
  const proportions = [.12, .16, .34, .18, .20];
  const cellSize = (i: number) => i >= 3 ? (width === 58 ? 14 : 22) : i < 2 ? (width === 58 ? 14 : 18) : (width === 58 ? 20 : 24);
  const table = (cells: string[], bold = false) => {
    const lines = cells.map((text, i) => split(text, usable * proportions[i] - 6, bold, cellSize(i)));
    for (let i = 0; i < Math.max(...lines.map(c => c.length)); i++) rows.push({cells: lines.map(c => c[i] ?? ''), bold});
  };
  const label = (a: string, e: string) => ar ? a : e;
  const fiscal = receipt.fiscal, sign = receipt.creditNote ? -1 : 1;
  const amount = (n: number) => n.toFixed(2);
  const money = (n: number) => `${amount(n)} ${currency}`;
  wrap(fiscal?.legal_name || restaurantName, true);
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
  if (width !== 58) table([label('كمية','Qty'),label('وحدة','Unit'),label('الصنف','Item'),label('السعر','Price'),label('إجمالي','Total')],true);
  for (const line of receipt.lines) {
    const price = amount(fiscal && fiscal.mode !== 'egypt' ? (line.net ?? 0)/line.quantity : line.price);
    const total = amount(sign * (fiscal?.mode === 'egypt' ? line.price * line.quantity : line.gross ?? line.price * line.quantity));
    // Five columns on a 48 mm print head made Arabic and amounts unreadable.
    if (width === 58) {
      wrap(`${line.name}${line.variant ? ` (${line.variant})` : ''}`, true);
      wrap(`${line.quantity} × ${price} = ${total}`, true);
    } else table([String(line.quantity),line.variant,line.name,price,total],true);
    if (fiscal?.registered && fiscal.mode !== 'egypt') wrap(`${line.code ?? ''} ${line.rate ?? 0}% | VAT ${money(sign * (line.vat ?? 0))}`);
  }
  wrap(`${label('إجمالي الكميات','Total quantity')}: ${receipt.lines.reduce((sum,line)=>sum+line.quantity,0)}`,true,true);
  wrap(`${label('الإجمالي قبل الضريبة','Subtotal')}: ${money(sign * (fiscal?.net ?? receipt.total))}`);
  if (fiscal?.registered) wrap(`${label('الضريبة','VAT')}: ${money(sign * fiscal.vat)}`);
  wrap(`${label('الصافي','Total')}: ${money(sign * receipt.total)}`,true,true);
  const paid = receipt.fiscalState !== 'unpaid' && receipt.fiscalState !== 'voided';
  wrap(`${label('المدفوع','Paid')}: ${money(paid ? sign * receipt.total : 0)}`);
  wrap(`${label('المتبقي','Due')}: ${money(paid ? 0 : sign * receipt.total)}`);
  if (paid && receipt.payment === 'cash' && !receipt.creditNote && receipt.received > receipt.total) wrap(`${label('الباقي للعميل','Change')}: ${money(receipt.received - receipt.total)}`);
  for (const b of fiscal?.mode === 'egypt' ? [] : fiscal?.breakdown ?? []) wrap(`${b.code} ${b.rate}% | Net ${money(sign*b.net)} | VAT ${money(sign*b.vat)}`);
  if (fiscal?.registered && fiscal.invoice_kind === 'receipt') wrap(fiscal.mode === 'saudi' ? label('إيصال بيع. الربط بالفوترة الإلكترونية غير مفعّل.','Sales receipt. Electronic invoicing is not connected.') : label('ليس فاتورة ضريبية كاملة.','Not a full VAT invoice.'));
  if (receipt.note) wrap(receipt.note);
  canvas.height = rows.length * rowHeight + 16;
  if (canvas.height > 20000) throw new Error('Receipt is too long');
  context.fillStyle = '#fff'; context.fillRect(0,0,dots,canvas.height);
  context.textBaseline = 'middle';
  rows.forEach((row,index)=>{
    const top = index * rowHeight + 8;
    context.fillStyle = row.band ? '#000' : '#fff';
    context.fillRect(padding,top,usable,rowHeight);
    context.fillStyle = row.band ? '#fff' : '#000';
    context.font = `${row.bold ? 'bold ' : ''}${font}`;
    context.direction = ar ? 'rtl' : 'ltr'; context.textAlign = 'center';
    if (row.cells) {
      let offset = 0;
      row.cells.forEach((text,i)=>{
        const size = usable * proportions[i];
        context.font = `${row.bold ? 'bold ' : ''}${cellSize(i)}px Arial, sans-serif`;
        const x = ar ? dots - padding - offset - size : padding + offset;
        context.strokeStyle = '#000'; context.lineWidth = 1;
        context.strokeRect(x,top,size,rowHeight);
        context.fillText(text,x+size/2,top+rowHeight/2,size-6);
        offset += size;
      });
    } else context.fillText(row.text ?? '', dots/2,top+rowHeight/2,usable-8);
  });
  return canvas;
}

export async function receiptRaster(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80, printDots?: number) {
  const canvas = await receiptCanvas(receipt, restaurantName, currency, ar, width, printDots);
  const dots = canvas.width;
  const context = canvas.getContext('2d')!;
  const pixels = context.getImageData(0, 0, dots, canvas.height).data;
  const bytesPerRow = dots / 8;
  const raster = new Uint8Array(bytesPerRow * canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < dots; x++) {
    const i = (y * dots + x) * 4;
    if ((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 < 160) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
  }
  // Send raster only; the bridge constructs the permitted ESC/POS commands.
  let binary = '';
  for (const byte of raster) binary += String.fromCharCode(byte);
  return { width: dots, height: canvas.height, raster: btoa(binary) };
}

// Use the installed OS driver for printers that do not speak ESC/POS.
// A print request is not proof of physical output (the user can cancel).
export async function printBrowserReceipt(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80, printDots?: number) {
  const canvas = await receiptCanvas(receipt, restaurantName, currency, ar, width, printDots);
  // Match the physical 203 dpi print head; never stretch 48/64/72 mm to the
  // roll width. Drivers can still override CSS sizes, so this is a fallback.
  const imageWidthMm = canvas.width * 25.4 / 203;
  const pageHeightMm = Math.ceil(canvas.height * 25.4 / 203 + 4);
  const frame = document.createElement('iframe');
  frame.title = `MenuzQR receipt ${receipt.number}`;
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}mm;height:${pageHeightMm}mm;border:0`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    const target = frame.contentWindow;
    if (!doc || !target) throw new Error('Print window unavailable');
    doc.title = frame.title;
    const style = doc.createElement('style');
    style.textContent = `@page { size: ${width}mm ${pageHeightMm}mm; page-orientation: upright; margin: 2mm; } html, body { margin:0; padding:0; writing-mode:horizontal-tb; direction:ltr; } body { width:${imageWidthMm}mm; } img { display:block; width:100%; height:auto; break-inside:avoid; page-break-inside:avoid; }`;
    doc.head.appendChild(style);
    // One text row per image permits page breaks without clipping a long receipt.
    const images: HTMLImageElement[] = [];
    for (let y = 0; y < canvas.height;) {
      const height = Math.min(y === 0 ? 8 : width === 58 ? 30 : 36, canvas.height - y);
      const strip = document.createElement('canvas');
      strip.width = canvas.width; strip.height = height;
      strip.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, height, 0, 0, canvas.width, height);
      const img = doc.createElement('img');
      img.alt = ''; img.src = strip.toDataURL('image/png');
      doc.body.appendChild(img); images.push(img); y += height;
    }
    await Promise.all(images.map(img => img.decode()));
    // Keep the document alive until the dialog closes; Safari can return early.
    target.addEventListener('afterprint', () => frame.remove(), { once: true });
    target.focus(); target.print();
  } catch (error) { frame.remove(); throw error; }
}
