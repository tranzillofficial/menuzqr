import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { belmirMenuData } from '../lib/belmir/menu-data.ts';
const content = JSON.parse(readFileSync(new URL('../lib/belmir/defaults.json', import.meta.url)));
test('shared templates receive all managed products, actual images and only known prices', () => {
 const menu = belmirMenuData(content, 'modern');
 const products = menu.categories.flatMap(c => c.products);
 assert.equal(products.length, 91);
 assert.equal(products.filter(p => p.image_url).length, 5);
 assert.equal(products.filter(p => p.product_variants.length).length, 5);
 assert.ok(products.filter(p => p.product_variants.length).every(p => p.description.includes('Estimated price')));
 assert.equal(menu.restaurant.slug, 'belmir');
 assert.equal(menu.restaurant.ordering_enabled, false);
 assert.equal(menu.restaurant.address, content.address);
});
test('Belmir uses the selected modern template with no public design switcher', () => {
 const source = readFileSync(new URL('../components/menu/BelmirNativeMenu.tsx',import.meta.url),'utf8');
 assert.ok(source.includes("from './themes/DemoMenu'"));
 assert.ok(!source.includes('<details'));
 const config=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');
 assert.ok(config.includes('/belmir/template?theme=modern'));
});
