"use server";
import {businessSchemaMissing} from '@/lib/business-schema';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { BUSINESS_FEATURES, FEATURE_REGISTRY, MENU_ONLY_FEATURES } from '@/lib/business-features';
import { BUSINESS_MODULES, MENU_ONLY_MODULES } from '@/lib/business-modules';
import {MARKET,type TaxMode} from '@/lib/tax';
import {CONFIGURATION_KEYS} from '@/lib/business-configuration';
import { validateSlug } from '@/lib/slug';
import { assertAdmin, done, fail, str } from './helpers';
import type { ActionState } from '@/lib/types';
function modules(form:FormData){if(form.get('account_package')==='menu_only')return [...MENU_ONLY_MODULES,...MENU_ONLY_FEATURES,'features_v2','features_v3'];const values=form.getAll('modules');const selected=BUSINESS_MODULES.filter(m=>values.includes(m));const features=form.getAll("features");return [...selected,...BUSINESS_FEATURES.filter(f=>features.includes(f)&&selected.includes(FEATURE_REGISTRY[f].module)),"features_v2","features_v3"];}
export async function saveBusinessAccount(_previous:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const id=str(form,'restaurant_id');const enabled=modules(form);const db=await createServerSupabase();
 if(enabled.includes('service_calls')&&!enabled.includes('tables'))return fail('Service calls require tables.');
 const {data:tenant,error:lookup}=await db.from('restaurants').select('*').eq('id',id).maybeSingle();
 if(lookup||!tenant)return fail('Account not found.');
 const {error}=await db.rpc('configure_business',{p_restaurant:id,p_type:null,p_overrides:{},p_manual:enabled,p_kind:str(form,'business_kind').slice(0,80)||'custom'});
 if(error){
  if(!businessSchemaMissing(error)||tenant.business_type_id)return fail(error.message);
  const legacy=await db.from('restaurants').update({business_kind:str(form,'business_kind').slice(0,80)||'custom',enabled_modules:enabled}).eq('id',id).select('id').maybeSingle();
  if(legacy.error||!legacy.data)return fail(legacy.error?.message??'Could not save account configuration.');
 }
 await db.from('admin_actions').insert({restaurant_id:id,admin_id:admin.userId,action:'business:modules',notes:enabled.join(',')});
 revalidatePath('/dashboard','layout');revalidatePath(`/admin/restaurants/${id}`);revalidatePath(`/${tenant.slug}/menu`);
 return done('تم حفظ تخصيص الحساب. Account configuration saved.');
}
export async function createBusinessAccount(_previous:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const name=str(form,'name'),email=str(form,'email').toLowerCase(),password=str(form,'password');
 const {value:slug,error:slugError}=validateSlug(str(form,'slug'));
 if(name.length<2||name.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||slugError)return fail('راجع الاسم والإيميل والرابط. الباسورد 8 حروف على الأقل.');
 const typeId=form.get('account_package')==='menu_only'?'':str(form,'business_type_id');const sessionDb=await createServerSupabase();
 const template=typeId?await sessionDb.from('business_types').select('*').eq('id',typeId).eq('is_active',true).maybeSingle():null;
 if(typeId&&(template?.error||!template?.data))return fail('Business template unavailable.');
 const selectedModules=modules(form);
 if(selectedModules.includes("service_calls")&&!selectedModules.includes("tables"))return fail("Service calls require tables.");
 if(template?.data){if(selectedModules.filter(m=>CONFIGURATION_KEYS.includes(m as typeof CONFIGURATION_KEYS[number])).some(m=>!([...template.data.available_modules,...template.data.available_capabilities] as string[]).includes(m)))return fail('Feature unavailable for this template.');}
 const taxMode:TaxMode=({EG:'egypt',GB:'uk',AE:'uae',SA:'saudi'} as Record<string,TaxMode>)[template?.data?.country_code??'EG']??'none';
 const db=createAdminSupabase();
 const {data:existing,error:lookupError}=await db.from('restaurants').select('id').eq('slug',slug).maybeSingle();
 if(lookupError||existing)return fail('الرابط مستخدم أو تعذر التحقق منه.');
 const {data:user,error:authError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
 if(authError||!user.user)return fail(authError?.message??'Could not create account.');
 const {data:business,error}=await db.from('restaurants').insert({owner_id:user.user.id,name,slug,currency:template?.data?.currency??'EGP',tax_mode:taxMode,business_timezone:MARKET[taxMode].timezone,language:'ar',business_kind:str(form,'business_kind').slice(0,80)||'retail',enabled_modules:selectedModules,waiter_calls_enabled:false,ordering_enabled:false}).select('id').single();
 if(error||!business){await db.auth.admin.deleteUser(user.user.id);return fail('تعذر إنشاء النشاط. '+(error?.message??''));}
 if(template?.data){const defaults=new Set([...template.data.default_modules,...template.data.default_capabilities]);const chosen=new Set(selectedModules);const overrides=Object.fromEntries(CONFIGURATION_KEYS.filter(key=>defaults.has(key)!==chosen.has(key)).map(key=>[key,chosen.has(key)]));const assigned=await sessionDb.rpc('configure_business',{p_restaurant:business.id,p_type:template.data.id,p_overrides:overrides,p_manual:null,p_kind:null});if(assigned.error)return fail(`الحساب اتعمل، لكن ربط القالب لم يكتمل. افتح /admin/restaurants/${business.id} لمراجعة الإعدادات. Account created; template assignment needs review.`);}
 await db.from('admin_actions').insert({restaurant_id:business.id,admin_id:admin.userId,action:'business:created'});
 revalidatePath('/admin');return done(`الحساب جاهز: ${email}. رابط المنتجات: /${slug}/menu. التفعيل والاشتراك من صفحة الحساب.`);
}
