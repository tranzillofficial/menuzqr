import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {catalogActivityMatches,CATALOG_ACTIVITIES} from '../lib/catalog-activities.ts';

test('activity filters share categories without duplicating products and tolerate legacy rows',()=>{
  const soda={business_types:['cafe','restaurant','supermarket']};
  assert.equal(catalogActivityMatches(soda,'supermarket'),true);
  assert.equal(catalogActivityMatches(soda,'sweets'),false);
  assert.equal(catalogActivityMatches({business_types:['cafe']},'restaurant'),false);
  assert.equal(catalogActivityMatches(soda,'all'),true);
  assert.equal(catalogActivityMatches({},'restaurant'),true);
  assert.equal(new Set(CATALOG_ACTIVITIES.map(a=>a.id)).size,CATALOG_ACTIVITIES.length);
});

test('photo beverages have unique bilingual names, positive editable prices, and exclude the omitted drink',()=>{
  const drinks=JSON.parse(readFileSync(new URL('../docs/catalog-beverages.json',import.meta.url)));
  assert.equal(drinks.length,48);
  assert.equal(new Set(drinks.map(d=>d.name)).size,48);
  assert.equal(new Set(drinks.map(d=>d.name_en)).size,48);
  for(const drink of drinks){
    assert.match(drink.name,/[\u0600-\u06ff]/);
    assert.ok(drink.name_en && drink.image && drink.category && drink.price>0);
    assert.ok(!drink.name.includes('صحتك'));
    for(const variant of drink.variants)assert.ok(variant.price>0 && variant.name && variant.name_en);
  }
  assert.deepEqual(drinks.find(d=>d.name==='إسبريسو').variants.map(v=>v.price),[20,30]);
  assert.deepEqual(drinks.find(d=>d.name==='عصير مانجو').variants.map(v=>v.price),[25,35]);
  assert.deepEqual(drinks.find(d=>d.name==='عصير مانجو').variants.map(v=>v.name),['عادي','سفاري']);
});
