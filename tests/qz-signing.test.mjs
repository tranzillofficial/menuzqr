import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, createHash, verify} from 'node:crypto';
import {validateQzRequest, signQzRequest} from '../lib/qz-signing.ts';
const now = Date.now();
const request = (call,params) => JSON.stringify({call,params,timestamp:now});
const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(576,16);png.writeUInt32BE(200,20);
const params={printer:{name:'XP-80C'},options:{copies:1,units:'mm',orientation:'portrait',size:{width:80,height:27}},data:[{type:'pixel',format:'image',flavor:'base64',data:png.toString('base64')}]};
test('allows printer discovery and bounded receipt PNGs',()=>{
 assert.equal(validateQzRequest(request('printers.find',{})),true);
 assert.equal(validateQzRequest(request('printers.getDefault',null)),true);
 assert.equal(validateQzRequest(request('print',params)),true);
});
test('denies unsigned digests, stale requests, file/network/RAW access and duplicate copies',()=>{
 for(const raw of ['deadbeef',JSON.stringify({call:'printers.find',params:{},timestamp:0}),request('file.read',{path:'secret'}),request('print',{...params,printer:{file:'C:/output'}}),request('print',{...params,printer:{host:'localhost',port:9100}}),request('print',{...params,options:{...params.options,copies:2}}),request('print',{...params,data:[{type:'raw',data:'test'}]})]) assert.equal(validateQzRequest(raw),false,raw);
});
test('signature matches QZ SHA256-hex then RSA-SHA512 and rejects tampering',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const raw=request('print',params);
 const signature=signQzRequest(raw,privateKey);
 const hash=value=>Buffer.from(createHash('sha256').update(value).digest('hex'));
 assert.equal(verify('RSA-SHA512',hash(raw),publicKey,Buffer.from(signature,'base64')),true);
 assert.equal(verify('RSA-SHA512',hash(raw+' '),publicKey,Buffer.from(signature,'base64')),false);
});
