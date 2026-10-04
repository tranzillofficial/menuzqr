import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleEnabled,dashboardPathEnabled,RETAIL_MODULES} from '../lib/business-modules.ts';
import {categoryPath,categoryDescendants,visibleCategories} from '../lib/category-tree.ts';
test('legacy accounts preserve tools and retail accounts hide irrelevant routes',()=>{
 for(const m of ['pos','reports','tables','catalog','design','orders','staff'])assert.equal(moduleEnabled({},m),true);
 assert.equal(moduleEnabled({},'subcategories'),false);
 const retail={enabled_modules:RETAIL_MODULES};
 for(const p of ['/dashboard/tables','/dashboard/design','/dashboard/catalog'])assert.equal(dashboardPathEnabled(retail,p),false);
 for(const p of ['/dashboard','/dashboard/restaurant','/dashboard/products','/dashboard/orders/receipt','/dashboard/pos'])assert.equal(dashboardPathEnabled(retail,p),true);
 assert.equal(moduleEnabled({enabled_modules:[]},'pos'),false);
});
test('category paths and recursive filters respect hidden ancestors',()=>{
 const categories=[{id:'root',name:'Chocolate',is_active:true},{id:'brand',name:'Brand',parent_id:'root',is_active:true},{id:'kind',name:'Type',parent_id:'brand',is_active:true},{id:'other',name:'Nuts',is_active:true}];
 assert.equal(categoryPath(categories,'kind'),'Chocolate / Brand / Type');
 assert.deepEqual([...categoryDescendants(categories,'root')],['root','brand','kind']);
 assert.equal(visibleCategories(categories).length,4);categories[0].is_active=false;
 assert.deepEqual(visibleCategories(categories).map(c=>c.id),['other']);
 const cycle=[{id:'a',name:'A',parent_id:'b',is_active:true},{id:'b',name:'B',parent_id:'a',is_active:true}];
 assert.equal(visibleCategories(cycle).length,0);assert.equal(categoryDescendants(cycle,'a').size,2);
});
