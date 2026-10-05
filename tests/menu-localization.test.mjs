import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeMenu, withCatalogName } from '../lib/menu-localization.ts';

test('catalog fallback translates a retained source name and preserves customized names', () => {
  const source = {name:'بطاطس مقلية',name_en:'French Fries'};
  assert.equal(withCatalogName({name:'French Fries'},source).name_ar,'بطاطس مقلية');
  assert.deepEqual(withCatalogName({name:'بطاطس الفرع الخاصة'},source),{name:'بطاطس الفرع الخاصة'});
  assert.equal(withCatalogName({name:'بطاطس مقلية',name_en:'Merchant fries'},source).name_en,'Merchant fries');
  assert.equal(withCatalogName({name:'Vanilla Ice Cream (بولة فانيليا)'},{name:'آيس كريم فانيليا',name_en:'Vanilla Ice Cream',legacy_name:'Vanilla Ice Cream (بولة فانيليا)'}).name_ar,'آيس كريم فانيليا');
});

test('language changes preserve product IDs, prices, variant IDs and source data', () => {
  const data = {restaurant:{},categories:[{id:'category',name:'حلويات',name_en:'Sweets',products:[{id:'product',name:'شوكولاتة',name_en:'Chocolate',product_variants:[{id:'variant',name:'كبير',name_en:'Large',price:100}]}]}]};
  const en=localizeMenu(data,'en');
  assert.equal(en.categories[0].name,'Sweets');
  assert.equal(en.categories[0].products[0].name,'Chocolate');
  assert.deepEqual(en.categories[0].products[0].product_variants[0],{id:'variant',name:'Large',name_en:'Large',price:100});
  assert.equal(localizeMenu(data,'ar').categories[0].products[0].name,'شوكولاتة');
  assert.equal(data.categories[0].products[0].name,'شوكولاتة');
});
