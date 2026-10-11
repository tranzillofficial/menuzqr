import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBarcode,validBarcode} from '../lib/barcode.ts';
test('barcodes retain leading zeroes and normalize local digits',()=>{
  assert.equal(normalizeBarcode(' ٠٠١٢٣٤٥٦٧٨٩٠١\r\n'),'0012345678901');
  assert.equal(normalizeBarcode('۰۰۱۲۳'),'00123');
  assert.equal(normalizeBarcode('AbC-001'),'AbC-001');
});
test('reject empty, control, whitespace and oversized values',()=>{
  for(const value of ['', 'a b', '12\n34', '1'.repeat(129),'منتج'])assert.equal(validBarcode(value),false);
  for(const value of ['0000123456789','ABC-001','1'.repeat(128)])assert.equal(validBarcode(value),true);
});
