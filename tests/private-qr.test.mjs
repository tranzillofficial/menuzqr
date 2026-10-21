import test from 'node:test';
import assert from 'node:assert/strict';
import {qrTemplateAvailable} from '../lib/qr-template-access.ts';
test('private QR designs are isolated by business, including unassigned branded posters',()=>{
 assert.equal(qrTemplateAvailable({layout:'counter'},'t9'),true);
 assert.equal(qrTemplateAvailable({layout:'cafe'},'t9'),false);
 assert.equal(qrTemplateAvailable({layout:'cafe',allowed_restaurant_ids:['hadota']},'hadota'),true);
 assert.equal(qrTemplateAvailable({layout:'cafe',allowed_restaurant_ids:['hadota']},'t9'),false);
 assert.equal(qrTemplateAvailable({layout:'counter',allowed_restaurant_ids:[]},'t9'),false);
});
