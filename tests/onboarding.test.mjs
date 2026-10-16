import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDraft,SETUP_MODULES} from '../lib/onboarding.ts';
import {suggestedSlug,allowedModules} from '../lib/activity-onboarding-config.ts';
import {moduleEnabled} from '../lib/business-modules.ts';
test('untrusted draft cannot become paid entitlements',()=>{const draft=normalizeDraft({activity:'supermarket',step:90,plan:'pro',status:'active',enabled_modules:['pos']});assert.equal(draft.step,2);assert.equal(draft.status,undefined);assert.equal(draft.enabled_modules,undefined);for(const feature of ['pos','orders','staff','inventory','reports'])assert.equal(moduleEnabled({business_kind:draft.activity,enabled_modules:SETUP_MODULES},feature),false);});
test('malformed drafts normalize and legacy modules keep existing behavior',()=>{assert.equal(normalizeDraft(null).step,0);assert.equal(normalizeDraft({activity:'invented',step:2}).step,0);assert.equal(moduleEnabled({enabled_modules:['pos','reports']},'reports'),true);assert.equal(moduleEnabled({business_kind:'supermarket'},'tables'),false);});
test('activity filter does not add permissions and slugs have safe endings',()=>{assert.deepEqual(allowedModules('supermarket',['tables','pos','kitchen']),['pos']);assert.ok(!suggestedSlug('a'.repeat(47)+' - name').endsWith('-'));});
