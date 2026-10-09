import test from 'node:test';
import assert from 'node:assert/strict';
import {activeOffers} from '../lib/offers.ts';

test('only active offers within their time window appear, preserving carousel order',()=>{
 const now=Date.parse('2026-10-09T12:00:00Z');
 const base={is_active:true,starts_at:null,ends_at:null};
 const offers=[
  {...base,id:'always'},
  {...base,id:'disabled',is_active:false},
  {...base,id:'future',starts_at:'2026-10-09T12:00:01Z'},
  {...base,id:'starting-now',starts_at:'2026-10-09T12:00:00Z'},
  {...base,id:'expired',ends_at:'2026-10-09T11:59:59Z'},
  {...base,id:'ending-now',ends_at:'2026-10-09T12:00:00Z'},
  {...base,id:'ongoing',starts_at:'2026-10-08T12:00:00Z',ends_at:'2026-10-10T12:00:00Z'},
 ];
 assert.deepEqual(activeOffers(offers,now).map(o=>o.id),['always','starting-now','ongoing']);
 assert.equal(offers.length,7);
});
