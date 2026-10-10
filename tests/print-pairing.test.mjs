import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrintTicket,validPrintTicket} from '../lib/print-pairing.ts';

test('printer pairing grants expire, bind the website and reject tampering',()=>{
 const origin='https://mastermart.shop',secret='test-secret',now=100000;
 const ticket=createPrintTicket(origin,secret,now);
 assert.equal(validPrintTicket(ticket,origin,secret,now),true);
 assert.equal(validPrintTicket(ticket,'https://evil.example',secret,now),false);
 assert.equal(validPrintTicket(ticket,origin,'different-key',now),false);
 assert.equal(validPrintTicket(ticket,origin,secret,now+120000),false);
 assert.equal(validPrintTicket(ticket+'x',origin,secret,now),false);
 assert.equal(validPrintTicket(ticket+'.extra',origin,secret,now),false);
 for(const value of [null,{},123,'garbage'])assert.equal(validPrintTicket(value,origin,secret,now),false);
 assert.notEqual(createPrintTicket(origin,secret,now),ticket);
});
