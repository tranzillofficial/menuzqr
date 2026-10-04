"use server";
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { BUSINESS_MODULES } from '@/lib/business-modules';
import { validateSlug } from '@/lib/slug';
import { assertAdmin, done, fail, str } from './helpers';
import type { ActionState } from '@/lib/types';
function modules(form:FormData){const values=form.getAll('modules');return [...BUSINESS_MODULES.filter(m=>values.includes(m)),"features_v2"];}
export async function saveBusinessAccount(_previous:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const id=str(form,'restaurant_id');const enabled=modules(form);const db=await createServerSupabase();
 const {data,error}=await db.from('restaurants').update({business_kind:str(form,'business_kind').slice(0,80)||'custom',enabled_modules:enabled}).eq('id',id).select('slug').maybeSingle();
 if(error||!data)return fail(error?.message??'Account not found.');
 await db.from('admin_actions').insert({restaurant_id:id,admin_id:admin.userId,action:'business:modules',notes:enabled.join(',')});
 revalidatePath('/dashboard','layout');revalidatePath(`/admin/restaurants/${id}`);revalidatePath(`/${data.slug}/menu`);
 return done('تم حفظ تخصيص الحساب. Account configuration saved.');
}
export async function createBusinessAccount(_previous:ActionState,form:FormData):Promise<ActionState>{
 const admin=await assertAdmin();if(!admin.ok)return admin.error;
 const name=str(form,'name'),email=str(form,'email').toLowerCase(),password=str(form,'password');
 const {value:slug,error:slugError}=validateSlug(str(form,'slug'));
 if(name.length<2||name.length>160||!email.includes('@')||password.length<12||slugError)return fail('راجع الاسم والإيميل والرابط. الباسورد 12 حرف على الأقل.');
 const db=createAdminSupabase();
 const {data:existing,error:lookupError}=await db.from('restaurants').select('id').eq('slug',slug).maybeSingle();
 if(lookupError||existing)return fail('الرابط مستخدم أو تعذر التحقق منه.');
 const {data:user,error:authError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
 if(authError||!user.user)return fail(authError?.message??'Could not create account.');
 const {data:business,error}=await db.from('restaurants').insert({owner_id:user.user.id,name,slug,currency:'EGP',tax_mode:'egypt',business_timezone:'Africa/Cairo',language:'ar',business_kind:str(form,'business_kind').slice(0,80)||'retail',enabled_modules:modules(form),waiter_calls_enabled:false,ordering_enabled:false}).select('id').single();
 if(error||!business){await db.auth.admin.deleteUser(user.user.id);return fail('تعذر إنشاء النشاط. '+(error?.message??''));}
 await db.from('admin_actions').insert({restaurant_id:business.id,admin_id:admin.userId,action:'business:created'});
 revalidatePath('/admin');return done(`الحساب جاهز: ${email}. رابط المنتجات: /${slug}/menu. التفعيل والاشتراك من صفحة الحساب.`);
}
