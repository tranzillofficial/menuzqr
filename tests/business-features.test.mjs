import test from 'node:test';
import assert from 'node:assert/strict';
import {featureEnabled} from '../lib/business-features.ts';
import {normalizeWhatsapp} from '../lib/phone.ts';
test('Egyptian WhatsApp normalization preserves international numbers and leading zero semantics',()=>{
 for(const number of ['01012345678','1012345678','+20 101 234 5678','00201012345678','٠١٠١٢٣٤٥٦٧٨'])assert.equal(normalizeWhatsapp(number),'201012345678');
 assert.equal(normalizeWhatsapp('+44 7700 900123'),'447700900123');assert.equal(normalizeWhatsapp(''),'');assert.equal(normalizeWhatsapp('bad'),'bad');
});
test('business feature defaults and admin selections fail closed under disabled modules',()=>{
 const market={business_kind:'supermarket'};
 assert.equal(featureEnabled(market,'product_barcode'),true);assert.equal(featureEnabled(market,'product_english'),false);assert.equal(featureEnabled(market,'tax_settings'),false);
 const custom={enabled_modules:['features_v2','features_v3','products','product_english']};
 assert.equal(featureEnabled(custom,'product_english'),true);assert.equal(featureEnabled(custom,'product_barcode'),false);
 assert.equal(featureEnabled({enabled_modules:['features_v3','product_barcode']},'product_barcode'),false);
});
