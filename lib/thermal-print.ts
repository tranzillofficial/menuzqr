export type PosReceipt = {
  number: number; total: number; received: number; tableLabel: string | null;
  payment: 'cash' | 'card'; createdAt: string; note: string;
  lines: { variantId: string; name: string; variant: string; price: number; quantity: number }[];
};
export type PrinterSettings = { token: string; printer: string; width: 58 | 80; cut: boolean };
export const DEFAULT_PRINTER: PrinterSettings = { token: '', printer: '', width: 80, cut: true };

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
export async function receiptRaster(receipt: PosReceipt, restaurantName: string, currency: string, ar: boolean, width: 58 | 80) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const dots = width === 58 ? 384 : 576;
  canvas.width = dots;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt rendering is unavailable');
  const font = '24px Arial, sans-serif';
  context.font = font;
  const rows: { text: string; bold?: boolean; center?: boolean }[] = [];
  const wrap = (text: string, bold = false, center = false) => {
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
  wrap(restaurantName, true, true);
  wrap(`${label('إيصال', 'Receipt')} #${receipt.number}`, true, true);
  wrap(new Date(receipt.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-GB'), false, true);
  wrap(receipt.tableLabel ? `${label('الطاولة', 'Table')}: ${receipt.tableLabel}` : label('تيك أواي', 'Takeaway'));
  rows.push({ text: '________________________', center: true });
  for (const line of receipt.lines) {
    wrap(`${line.name} ${line.variant}`, true);
    wrap(`${line.quantity} × ${money(line.price)} = ${money(line.price * line.quantity)}`);
  }
  rows.push({ text: '________________________', center: true });
  wrap(`${label('الإجمالي', 'Total')}: ${money(receipt.total)}`, true);
  wrap(`${label('الدفع', 'Payment')}: ${receipt.payment === 'cash' ? label('كاش', 'Cash') : label('بطاقة', 'Card')}`);
  if (receipt.payment === 'cash') {
    wrap(`${label('المستلم', 'Received')}: ${money(receipt.received)}`);
    wrap(`${label('الباقي', 'Change')}: ${money(receipt.received - receipt.total)}`);
  }
  if (receipt.note) wrap(receipt.note);
  wrap(label('شكرًا لزيارتك', 'Thank you for visiting'), false, true);
  canvas.height = rows.length * 36 + 32;
  if (canvas.height > 20000) throw new Error('Receipt is too long');
  context.fillStyle = '#fff'; context.fillRect(0, 0, dots, canvas.height);
  context.fillStyle = '#000'; context.textBaseline = 'top';
  context.direction = ar ? 'rtl' : 'ltr';
  rows.forEach((row, index) => {
    context.font = `${row.bold ? 'bold ' : ''}${font}`;
    context.textAlign = row.center ? 'center' : ar ? 'right' : 'left';
    context.fillText(row.text, row.center ? dots / 2 : ar ? dots - 16 : 16, index * 36 + 16, dots - 32);
  });
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
