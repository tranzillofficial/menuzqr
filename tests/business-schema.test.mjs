import {test} from 'node:test';import assert from 'node:assert/strict';import {businessSchemaMissing} from '../lib/business-schema.ts';
test('only missing business schema selects compatibility mode',()=>{
 for(const [code,message] of [['PGRST205',"Could not find table public.business_types"],['42703','column business_type_id does not exist'],['PGRST202','Could not find function public.configure_business']])assert.equal(businessSchemaMissing({code,message}),true);
 for(const error of [null,{code:'42501',message:'business_types denied'},{code:'PGRST205',message:'products missing'},{code:'23514',message:'configure_business invalid'}])assert.equal(businessSchemaMissing(error),false);
});
