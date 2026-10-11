import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
 await db.exec(`create role authenticated; create table public.products(id integer generated always as identity primary key, restaurant_id text not null, name text);alter table products enable row level security;create policy tenant on products to authenticated using(restaurant_id=current_setting('test.tenant',true)) with check(restaurant_id=current_setting('test.tenant',true));grant all on products to authenticated;grant usage on sequence products_id_seq to authenticated;insert into products(restaurant_id,name) values('a','Existing');`);
 const path=readdirSync('supabase/migrations').find(p=>p.endsWith('_product_barcodes.sql'));
 await db.exec(readFileSync(`supabase/migrations/${path}`,'utf8'));
 assert.equal((await db.query('select barcode from products')).rows[0].barcode,null);
 await db.exec(`insert into products(restaurant_id,barcode) values('a','001234'),('b','001234'),('a',null),('a',null);set role authenticated;select set_config('test.tenant','a',false);`);
 assert.equal((await db.query("select * from products where barcode='001234'")).rows.length,1);
 await assert.rejects(()=>db.query("insert into products(restaurant_id,barcode) values('a','001234')"),/unique/);
 await assert.rejects(()=>db.query("insert into products(restaurant_id,barcode) values('b','9999')"),/row-level security/);
 for(const bad of ['','abc def','abc\ndef','x'.repeat(129)])await assert.rejects(()=>db.query("insert into products(restaurant_id,barcode) values('a',$1)",[bad]),/check constraint/);
 assert.equal((await db.query("update products set barcode='9876' where restaurant_id='b' returning id")).rows.length,0);
 console.log('PASS barcode uniqueness, leading zeroes, optional values, validation and tenant isolation');
}finally{await db.close();}
