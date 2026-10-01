import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taxAmounts,vatRate,summarizeSales} from '../lib/tax.ts';
import {businessDayRange} from '../lib/business-time.ts';
test('Inclusive 20%, 5%, UAE and Saudi prices preserve gross and remove the right VAT',()=>{
 assert.deepEqual(taxAmounts(120,1,20,true),{net:100,vat:20,gross:120});
 assert.deepEqual(taxAmounts(105,1,5,true),{net:100,vat:5,gross:105});
 assert.deepEqual(taxAmounts(115,1,15,true),{net:100,vat:15,gross:115});
 assert.deepEqual(taxAmounts(100,1,20,false),{net:100,vat:20,gross:120});
 assert.equal(vatRate('uk',false,'standard'),0);assert.equal(vatRate('uk',true,'exempt'),0);
});
test('Rounding is per line and handles quantities without accumulating unit rounding errors',()=>{
 assert.deepEqual(taxAmounts(0.05,3,20,false),{net:0.15,vat:0.03,gross:0.18});
 const {net,vat,gross}=taxAmounts(19.99,3,20,true);assert.equal(Math.round((net+vat)*100),Math.round(gross*100));
});
test('Sale, refund and unpaid void stay distinct; rates and currencies never merge',()=>{
 const event={id:1,order_id:'a',kind:'sale',currency:'GBP',gross:120,net:100,vat:20,payment_method:'cash',reason:null,actor_id:null,actor_name:null,created_at:'2026-01-01',document_number:'1',breakdown:[{code:'standard',rate:20,net:100,vat:20,gross:120}]};
 const report=summarizeSales([event,{...event,id:2,kind:'refund'},{...event,id:3,kind:'void',payment_method:null},{...event,id:4,currency:'AED',payment_method:'card',gross:105,net:100,vat:5,breakdown:[{code:'standard',rate:5,net:100,vat:5,gross:105}]}]);
 assert.equal(report.currencies[0].netSales,0);assert.equal(report.currencies[0].cash,0);assert.equal(report.currencies[0].voids,120);assert.equal(report.currencies[1].vat,5);assert.equal(report.currencies.length,2);
});
test('UK daily boundaries honor summer time and both DST transitions',()=>{
 const spring=businessDayRange('2026-03-29','Europe/London'),autumn=businessDayRange('2026-10-25','Europe/London');
 assert.equal((Date.parse(spring.end)-Date.parse(spring.start))/3600000,23);
 assert.equal((Date.parse(autumn.end)-Date.parse(autumn.start))/3600000,25);
 assert.equal(businessDayRange('2026-07-01','Europe/London').start,'2026-06-30T23:00:00.000Z');
 assert.equal(businessDayRange('2026-10-01','Asia/Dubai').start,'2026-09-30T20:00:00.000Z');
 assert.throws(()=>businessDayRange('2026-02-30','Europe/London'));
});
