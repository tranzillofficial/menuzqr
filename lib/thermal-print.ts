import type { FiscalSnapshot } from "./tax";
export type PosReceipt = {
  testPrint?: boolean; orderId?: string; documentNumber?: string; originalDocumentNumber?: string; currency?: string; fiscal?: FiscalSnapshot | null; paidAt?: string | null; creditNote?: boolean; creditDate?: string;
  number: number; total: number; received: number; tableLabel: string | null;
  payment: 'cash' | 'card' | 'transfer'; fiscalState?: string; createdAt: string; note: string;
  lines: { variantId: string; name: string; variant: string; price: number; quantity: number; gross?: number; net?: number; vat?: number; rate?: number; code?: string }[];
};
export type PrinterSettings = { token: string; printer: string; width: 58 | 80 };
export const DEFAULT_PRINTER: PrinterSettings = { token: '', printer: '', width: 80 };
export function printerDots(width: 58 | 80): 384 | 576 { return width === 58 ? 384 : 576; }

// Older Windows browsers do not implement AbortSignal.timeout.
async function timedFetch(url: string, options: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, {...options, signal: controller.signal}); }
  finally { clearTimeout(timer); }
}

// Loopback only: the printer is on the cashier's computer, not on Vercel.
export async function bridgeRequest(settings: PrinterSettings, path: '/printers' | '/print', body?: object) {
  const response = await timedFetch(`http://127.0.0.1:18191${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${settings.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  }, body ? 30000 : 8000);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Printer connection failed');
  return result as { printers?: string[]; ok?: boolean; version?: number; suggestedPrinter?:string|null; duplicate?:boolean };
}

export class PrintConnectionError extends Error {
  constructor(public code: 'unreachable' | 'outdated' | 'session' | 'pairing' | 'discovery') {
    super(code); this.name = 'PrintConnectionError';
  }
}
export async function bridgeHealth() {
  let response, result;
  try {
    response = await timedFetch('http://127.0.0.1:18191/health', {cache:'no-store'}, 2500);
    result = await response.json();
  } catch { throw new PrintConnectionError('unreachable'); }
  if (!response.ok || result.app !== 'MenuzQR Print') throw new PrintConnectionError('unreachable');
  if (!(result.version >= 5)) throw new PrintConnectionError('outdated');
  return result;
}
export async function pairPrintBridge() {
  await bridgeHealth();
  let ticket;
  try {
    const grant = await timedFetch('/api/print-pair', {method:'POST'}, 10000);
    const result = await grant.json();
    if (!grant.ok || typeof result.ticket !== 'string') throw new Error();
    ticket = result.ticket;
  } catch { throw new PrintConnectionError('session'); }
  try {
    const response = await timedFetch('http://127.0.0.1:18191/pair', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ticket})}, 12000);
    const result = await response.json();
    if (!response.ok || typeof result.token !== 'string') throw new Error();
    return result.token as string;
  } catch { throw new PrintConnectionError('pairing'); }
}

// Render Arabic with the browser's shaping engine, then send monochrome raster
// commands. This avoids dependence on the printer's Arabic code page support.
async function receiptCanvas(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80) {
  await document.fonts.ready;
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
    const total = amount(sign * (fiscal?.mode === 'egypt' ? line.price * line.quantity : line.gross ?? line.price * line.quantity));
    // Give the product name the full printable width on every roll size.
    wrap(`${line.name}${line.variant && line.variant !== 'Regular' ? ` (${line.variant})` : ''}`, true);
    wrap(`${line.quantity} × ${price} = ${total}`, true, false, 'right', 'ltr');
    if (fiscal?.registered && fiscal.mode !== 'egypt') wrap(`${line.code ?? ''} ${line.rate ?? 0}% | VAT ${money(sign * (line.vat ?? 0))}`);
  }

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
  // Send a monochrome document; Windows GDI and the installed driver render it.
  let binary = '';
  for (const byte of raster) binary += String.fromCharCode(byte);
  return { protocol: 'windows-gdi-v1', paperMm: width, width: dots, height: canvas.height, raster: btoa(binary) };
}
