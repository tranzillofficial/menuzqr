import {createHash, sign} from 'node:crypto';

// Only the receipt operations used by our POS may receive trusted signatures.
// In particular, never sign a caller-supplied digest or file/network/RAW command.
export function validateQzRequest(raw: string, now = Date.now()): boolean {
  if (Buffer.byteLength(raw) > 3_000_000) return false;
  try {
    const value = JSON.parse(raw);
    if (Object.keys(value).some(k => !['call','params','timestamp'].includes(k))) return false;
    if (!Number.isSafeInteger(value.timestamp) || Math.abs(now - value.timestamp) > 60_000) return false;
    const params = value.params;
    if (value.call === 'printers.getDefault' && params == null) return true;
    if (!params || typeof params !== 'object' || Array.isArray(params)) return false;
    if (value.call === 'printers.getDefault') return Object.keys(params).length === 0;
    if (value.call === 'printers.find') return Object.keys(params).every(k => k === 'query') && (params.query == null || typeof params.query === 'string' && params.query.length <= 256);
    if (value.call !== 'print' || Object.keys(params).some(k => !['printer','options','data'].includes(k))) return false;
    if (!params.printer || typeof params.printer.name !== 'string' || !params.printer.name.trim() || params.printer.name.length > 256 || Object.keys(params.printer).some(k => k !== 'name')) return false;
    const options = params.options;
    if (!options || options.copies !== 1 || options.units !== 'mm' || options.orientation !== 'portrait') return false;
    if (![58,80].includes(options.size?.width) || !Number.isFinite(options.size?.height) || options.size.height < 1 || options.size.height > 2502) return false;
    if (options.forceRaw || options.altPrinting || options.retainTemp || options.rotation) return false;
    if (!Array.isArray(params.data) || params.data.length !== 1) return false;
    const item = params.data[0];
    if (!item || Object.keys(item).some(k => !['type','format','flavor','data','options'].includes(k))) return false;
    if (item.options && Object.keys(item.options).length) return false;
    if (item.type !== 'pixel' || item.format !== 'image' || item.flavor !== 'base64' || typeof item.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.data)) return false;
    const png = Buffer.from(item.data, 'base64');
    return png.length >= 24 && png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && png.toString('ascii',12,16) === 'IHDR' && [384,576].includes(png.readUInt32BE(16)) && png.readUInt32BE(20) > 0 && png.readUInt32BE(20) <= 20000;
  } catch { return false; }
}

export function signQzRequest(raw: string, privateKey: string): string {
  if (!validateQzRequest(raw)) throw new Error('Unsupported print request');
  // QZ verifies RSA-SHA512 over the UTF-8 hexadecimal SHA256 of the exact JSON.
  const digest = createHash('sha256').update(raw, 'utf8').digest('hex');
  return sign('RSA-SHA512', Buffer.from(digest, 'utf8'), privateKey).toString('base64');
}
