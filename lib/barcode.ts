// Keep barcodes as text: leading zeroes are meaningful (EAN/UPC and Code 128).
export function normalizeBarcode(value: string): string {
  return value.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
}
export function validBarcode(value: string): boolean {
  return /^[\x21-\x7e]{1,128}$/.test(value);
}
