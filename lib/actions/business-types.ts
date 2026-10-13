"use server";
import {revalidatePath,revalidateTag} from 'next/cache';
import {createServerSupabase} from '@/lib/supabase/server';
import {CONFIGURATION_KEYS,canonicalModuleId} from '@/lib/business-configuration';
import {BUSINESS_MODULES} from '@/lib/business-modules';
import {BUSINESS_FEATURES,FEATURE_REGISTRY} from '@/lib/business-features';
import {assertAdmin,str,bool,fail,done} from './helpers';
import type {ActionState,Restaurant} from '@/lib/types';
export async function saveBusinessType(_prev:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const config={key:str(form,'key'),name_ar:str(form,'name_ar'),name_en:str(form,'name_en'),business_kind:str(form,'business_kind'),country_code:str(form,'country_code'),currency:str(form,'currency'),is_active:bool(form,'is_active'),available_modules:form.getAll('available_modules'),default_modules:form.getAll('default_modules'),available_capabilities:form.getAll('available_capabilities'),default_capabilities:form.getAll('default_capabilities')};
 const db=await createServerSupabase();const assigned=str(form,'id')?await db.from('restaurants').select('slug').eq('business_type_id',str(form,'id')):null;
 if(assigned?.error)return fail('Could not load inheriting accounts.');
 const {error}=await db.rpc('save_business_type',{p_id:str(form,'id')||null,p_config:config});
 if(error)return fail(error.message);
 for(const tenant of assigned?.data??[]){revalidatePath(`/${tenant.slug}/menu`);revalidateTag(`menu-products:${tenant.slug}`,{expire:0});}
 revalidatePath('/admin/business-types');revalidatePath('/admin/restaurants','layout');revalidatePath('/dashboard','layout');return done('تم حفظ النوع وتحديث الحسابات المرتبطة فقط. Type saved; inheriting accounts updated.');
}
export async function configureBusiness(_prev:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const db=await createServerSupabase();const id=str(form,'restaurant_id');const {data:r,error:loadError}=await db.from('restaurants').select('*').eq('id',id).maybeSingle();
 if(loadError||!r)return fail('Account not found.');
 const type=str(form,'business_type_id');const overrides:Record<string,boolean>={};
 for(const key of CONFIGURATION_KEYS){const value=str(form,`override_${key}`);if(value==='on'||value==='off')overrides[key]=value==='on';else if(value&&value!=='inherit')return fail('Invalid override.');}
 const selected=BUSINESS_MODULES.filter(m=>form.getAll('modules').includes(m));const features=BUSINESS_FEATURES.filter(f=>form.getAll('features').includes(f)&&selected.includes(FEATURE_REGISTRY[f].module));
 const unknown=(r as Restaurant).enabled_modules?.filter(k=>!CONFIGURATION_KEYS.includes(canonicalModuleId(k) as typeof CONFIGURATION_KEYS[number])&&!['features_v2','features_v3'].includes(k))??[];
 const manual=[...selected,...features,...unknown,'features_v2','features_v3'];
 if(!type&&selected.includes('service_calls')&&!selected.includes('tables'))return fail('نداءات الخدمة تحتاج قسم الطاولات. Service calls require tables.');
 const {error}=await db.rpc('configure_business',{p_restaurant:id,p_type:type||null,p_overrides:overrides,p_manual:type?null:manual,p_kind:str(form,'business_kind')||r.business_kind});
 if(error)return fail(error.message);
 revalidatePath(`/admin/restaurants/${id}`);revalidatePath('/dashboard','layout');revalidatePath(`/${r.slug}/menu`);revalidateTag(`menu-products:${r.slug}`,{expire:0});return done('تم حفظ الإعدادات بدون تغيير بيانات النشاط. Configuration saved; business data preserved.');
}
