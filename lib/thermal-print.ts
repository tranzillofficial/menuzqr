import type { FiscalSnapshot } from "./tax";
export type PosReceipt = {
  orderId?: string; documentNumber?: string; originalDocumentNumber?: string; currency?: string; fiscal?: FiscalSnapshot | null; paidAt?: string | null; creditNote?: boolean; creditDate?: string;
  number: number; total: number; received: number; tableLabel: string | null;
  payment: 'cash' | 'card' | 'transfer'; fiscalState?: string; createdAt: string; note: string;
  lines: { variantId: string; name: string; variant: string; price: number; quantity: number; gross?: number; net?: number; vat?: number; rate?: number; code?: string }[];
};
export type PrinterSettings = { token: string; printer: string; width: 58 | 80; cut: boolean; mode?: 'browser' | 'bridge' };
export const DEFAULT_PRINTER: PrinterSettings = { token: '', printer: '', width: 80, cut: true, mode: 'browser' };

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
  return result as { printers?: string[]; ok?: boolean };
}

// Render Arabic with the browser's shaping engine, then send monochrome raster
// commands. This avoids dependence on the printer's Arabic code page support.
async function receiptCanvas(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const dots = width === 58 ? 384 : 576;
  canvas.width = dots;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt rendering is unavailable');
  const font = '32px Arial, sans-serif';
  const rowHeight = 48;
  context.font = font;
  const rows: { text: string; bold?: boolean; center?: boolean }[] = [];
  const wrap = (text: string, bold = false, center = false) => {
    context.font = `${bold ? 'bold ' : ''}${font}`;
    let line = '';
    for (const word of text.replace(/[\r\n]/g, ' ').split(/\s+/)) {
      if (context.measureText(`${line} ${word}`).width > dots - 32 && line) {
        rows.push({ text: line, bold, center }); line = '';
      }
      // Split long unbroken names as well as normal words.
      for (const char of word) {
        if (context.measureText(line + char).width > dots - 32 && line) {
          rows.push({ text: line, bold, center }); line = '';
        }
        line += char;
      }
      line += ' ';
    }
    if (line.trim()) rows.push({ text: line.trim(), bold, center });
  };
  const label = (arabic: string, english: string) => ar ? arabic : english;
  const money = (n: number) => `${n.toFixed(2)} ${currency}`;
  const fiscal = receipt.fiscal;
  const sign = receipt.creditNote ? -1 : 1;
  wrap(fiscal?.legal_name ?? restaurantName, true, true);
  if (fiscal?.address) wrap(fiscal.address);
  if (fiscal?.registered) wrap(`VAT / TRN: ${fiscal.vat_number}`);
  if (fiscal?.customer?.name) { wrap(`${label('العميل', 'Customer')}: ${fiscal.customer.name}`); if(fiscal.customer.address) wrap(fiscal.customer.address); if(fiscal.customer.vat_number) wrap(`Customer VAT / TRN: ${fiscal.customer.vat_number}`); }
  wrap(`${receipt.creditNote ? label('إشعار دائن', 'Credit note') : fiscal?.invoice_kind === 'full' || fiscal?.invoice_kind === 'simplified' ? label('فاتورة ضريبية', 'VAT invoice') : label('إيصال', 'Receipt')} ${receipt.creditNote ? `CN-${receipt.number}` : receipt.documentNumber ?? `#${receipt.number}`}`, true, true);
  if(receipt.creditNote) wrap(`Original invoice: ${receipt.originalDocumentNumber ?? `#${receipt.number}`}`);
  wrap(new Date(receipt.creditNote ? receipt.creditDate ?? receipt.createdAt : receipt.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: fiscal?.timezone ?? 'UTC' }), false, true);
  if(receipt.paidAt) wrap(`${label('تاريخ التوريد', 'Supply date')}: ${new Date(receipt.paidAt).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: fiscal?.timezone ?? 'UTC' })}`);
  wrap(receipt.tableLabel ? `${label('الطاولة', 'Table')}: ${receipt.tableLabel}` : label('تيك أواي', 'Takeaway'));
  rows.push({ text: '________________________', center: true });
  for (const line of receipt.lines) {
    wrap(`${line.name} ${line.variant}`, true);
    if(fiscal?.registered && fiscal.mode !== 'egypt') wrap(`${line.code ?? ''} ${line.rate ?? 0}% | VAT ${money(sign * (line.vat ?? 0))}`);
    if(fiscal && fiscal.mode !== 'egypt') wrap(`${line.quantity} × ${money((line.net ?? 0) / line.quantity)} ${label('قبل VAT', 'ex VAT')}`);
    else wrap(`${line.quantity} × ${money(line.price)}`);
    wrap(`${label('إجمالي الصنف', 'Line total')}: ${money(sign * (fiscal?.mode === 'egypt' ? line.price * line.quantity : line.gross ?? line.price * line.quantity))}`);
  }
  rows.push({ text: '________________________', center: true });
  wrap(`${label('قبل الضريبة', 'Subtotal')}: ${money(sign * (fiscal?.net ?? receipt.total))}`);
  if (fiscal?.registered) wrap(`${label('الضريبة', 'VAT')}: ${money(sign * fiscal.vat)}`, true);
  wrap(`${label('الإجمالي', 'Total')}: ${money(sign * receipt.total)}`, true);
  for(const b of fiscal?.mode === 'egypt' ? [] : fiscal?.breakdown ?? []) wrap(`${b.code} ${b.rate}% | Net ${money(sign*b.net)} | VAT ${money(sign*b.vat)} | Gross ${money(sign*b.gross)}`);
  if(fiscal?.mode === 'saudi') wrap(label('إيصال بيع. الربط بالفوترة الإلكترونية غير مفعّل.', 'Sales receipt. Electronic invoicing is not connected.'));
  else if(fiscal?.registered && fiscal.invoice_kind === 'receipt') wrap(label('ليس فاتورة ضريبية كاملة.', 'Not a full VAT invoice.'));
  wrap(`${label('الدفع', 'Payment')}: ${receipt.fiscalState==='unpaid'?label('غير مدفوع','Unpaid'):receipt.payment === 'cash' ? label('كاش', 'Cash') : receipt.payment === 'transfer' ? label('تحويل خارجي — تأكيد يدوي','External transfer — manually confirmed') : label('بطاقة', 'Card')}`);
  if (receipt.fiscalState!=='unpaid' && receipt.payment === 'cash' && !receipt.creditNote) {
    wrap(`${label('المستلم', 'Received')}: ${money(receipt.received)}`);
    wrap(`${label('الباقي', 'Change')}: ${money(receipt.received - receipt.total)}`);
  }
  if (receipt.note) wrap(receipt.note);
  wrap(label('شكرًا لزيارتك', 'Thank you for visiting'), false, true);
  canvas.height = rows.length * rowHeight + 32;
  if (canvas.height > 20000) throw new Error('Receipt is too long');
  context.fillStyle = '#fff'; context.fillRect(0, 0, dots, canvas.height);
  context.fillStyle = '#000'; context.textBaseline = 'top';
  context.direction = ar ? 'rtl' : 'ltr';
  rows.forEach((row, index) => {
    context.font = `${row.bold ? 'bold ' : ''}${font}`;
    context.textAlign = row.center ? 'center' : ar ? 'right' : 'left';
    context.fillText(row.text, row.center ? dots / 2 : ar ? dots - 16 : 16, index * rowHeight + 16, dots - 32);
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
  // Send raster only; the bridge constructs the permitted ESC/POS commands.
  let binary = '';
  for (const byte of raster) binary += String.fromCharCode(byte);
  return { width: dots, height: canvas.height, raster: btoa(binary) };
}

// Use the installed OS driver for printers that do not speak ESC/POS.
// A print request is not proof of physical output (the user can cancel).
export async function printBrowserReceipt(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80) {
  const canvas = await receiptCanvas(receipt, restaurantName, currency, ar, width);
  const frame = document.createElement('iframe');
  frame.title = `MenuzQR receipt ${receipt.number}`;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    const target = frame.contentWindow;
    if (!doc || !target) throw new Error('Print window unavailable');
    doc.title = frame.title;
    const style = doc.createElement('style');
    style.textContent = `@page { size: auto; margin: 3mm; } body { margin:0; width:${width - 8}mm; } img { display:block; width:100%; height:auto; break-inside:avoid; page-break-inside:avoid; }`;
    doc.head.appendChild(style);
    // One text row per image permits page breaks without clipping a long receipt.
    const images: HTMLImageElement[] = [];
    for (let y = 0; y < canvas.height;) {
      const height = Math.min(y === 0 ? 16 : 48, canvas.height - y);
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
