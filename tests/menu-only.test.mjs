import test from 'node:test';
import assert from 'node:assert/strict';
import {MENU_ONLY_MODULES, BUSINESS_MODULES, moduleEnabled, dashboardPathEnabled, isMenuOnly} from '../lib/business-modules.ts';
import {MENU_ONLY_FEATURES, BUSINESS_FEATURES, featureEnabled} from '../lib/business-features.ts';
import {businessPolicy} from '../lib/business-policy.ts';
const config={enabled_modules:[...MENU_ONLY_MODULES,...MENU_ONLY_FEATURES,'features_v2','features_v3']};
test('menu-only account grants menu tools and denies other module actions',()=>{
 assert.equal(isMenuOnly(config),true);
 for(const moduleId of BUSINESS_MODULES){
  const expected=MENU_ONLY_MODULES.includes(moduleId);
  assert.equal(moduleEnabled(config,moduleId),expected,moduleId);
  assert.equal(businessPolicy(config,moduleId,{role:'owner'}).allowed,expected,moduleId);
 }
 for(const feature of BUSINESS_FEATURES)assert.equal(featureEnabled(config,feature),MENU_ONLY_FEATURES.includes(feature),feature);
});
test('direct dashboard URLs and nested routes cannot open unrelated tools',()=>{
 for(const path of ['products','categories','design','qr-codes'])assert.equal(dashboardPathEnabled(config,'/dashboard/'+path),true,path);
 for(const path of ['billing','billing/upgrade','settings','pos','pos/history','orders','inventory','restaurant','staff','unknown'])assert.equal(dashboardPathEnabled(config,'/dashboard/'+path),false,path);
 assert.equal(dashboardPathEnabled(config,'/dashboard'),false);
});
test('legacy and upgraded accounts retain their navigation',()=>{
 assert.equal(isMenuOnly({}),false);
 assert.equal(dashboardPathEnabled({},'/dashboard/billing'),true);
 const upgraded={enabled_modules:[...config.enabled_modules,'pos']};
 assert.equal(isMenuOnly(upgraded),false);
 assert.equal(dashboardPathEnabled(upgraded,'/dashboard/pos'),true);
 assert.equal(dashboardPathEnabled(upgraded,'/dashboard/inventory'),false);
});
