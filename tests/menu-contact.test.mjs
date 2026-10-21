import test from 'node:test';
import assert from 'node:assert/strict';
import {contactPhones,safeContactUrl} from '../lib/menu-contact.ts';
test('contact numbers preserve order, normalize digits, deduplicate and support legacy phone',()=>{
 assert.deepEqual(contactPhones(['٠١٢٢٢٢٨٥٦٤٦','010 3428 2929','01222285646'],'01222285646'),['01222285646','01034282929']);
 assert.deepEqual(contactPhones([], '+20 122 228 5646'),['+201222285646']);
});
test('contact links never accept script, credentials or dial control characters',()=>{
 assert.deepEqual(contactPhones(['javascript:alert(1)','01222285646;123','*123#','']),[]);
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com'])assert.equal(safeContactUrl(url),'');
 assert.equal(safeContactUrl('https://instagram.com/cilio'),'https://instagram.com/cilio');
});
