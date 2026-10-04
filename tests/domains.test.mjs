import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDomain,isPlatformHost} from '../lib/domain-names.ts';
test('domains normalize case and IDN without accepting URLs or reserved hosts',()=>{
 assert.equal(normalizeDomain('Shop.Example.com.'),'shop.example.com');
 assert.equal(normalizeDomain('bücher.example'),'xn--bcher-kva.example');
 for(const name of ['https://example.com','example.com/path','example.com:443','a@b.com','127.0.0.1','localhost','menuzqr.shop','www.menuzqr.shop','foo.vercel.app','-bad.example','foo..example','foo.example?x=1'])assert.equal(normalizeDomain(name),null,name);
 assert.equal(isPlatformHost('menuzqr.shop'),true);assert.equal(isPlatformHost('customer.example'),false);
});
