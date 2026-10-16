/** Idempotent insert-only staging import. Existing reviewed rows are never overwritten.
 * Dry-run by default. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY only in the server shell.
 * Usage: node scripts/import-supermarket-staging.mjs <prepared-dir> [--apply]
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const directory=process.argv[2];if(!directory)throw Error('Pass the prepared directory.');
const sets=[['supermarket_catalog_products','products.json','id'],['supermarket_catalog_images','images.json','id']];
const apply=process.argv.includes('--apply');
for(const [table,file,conflict] of sets){
 const rows=JSON.parse(readFileSync(join(directory,file),'utf8'));
 if(!Array.isArray(rows)||rows.some(row=>!row.id||!row.source_data))throw Error('Invalid prepared records.');
 if(rows.some(row=>table.endsWith('products')?row.review_status!=='pending':row.rights_status!=='pending'))throw Error('Import must start pending; approval is a separate review.');
 if(!apply){console.log(`${table}: ${rows.length} records, dry run`);continue;}
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Set server-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
 const u=new URL(base);if(u.protocol!=='https:')throw Error('HTTPS required.');
 for(let offset=0;offset<rows.length;offset+=200){
  const response=await fetch(`${u.origin}/rest/v1/${table}?on_conflict=${conflict}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows.slice(offset,offset+200))});
  if(!response.ok)throw Error(`${table} batch ${offset}: HTTP ${response.status}; inspect database logs. Safe to retry.`);
 }
 console.log(`${table}: submitted ${rows.length} records; duplicates preserved`);
}
