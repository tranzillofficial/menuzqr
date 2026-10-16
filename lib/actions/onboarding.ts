'use server';
import {createServerSupabase} from '@/lib/supabase/server';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {normalizeDraft,SETUP_MODULES} from '@/lib/onboarding';
import {validateSlug} from '@/lib/slug';
import {revalidatePath} from 'next/cache';
import {getLocale} from '@/lib/i18n/server';
import {sanitiseImageUrl} from './helpers';

export async function saveOnboardingDraft(value:unknown){
 const db=await createServerSupabase();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return {ok:false};
 // Editable metadata records intent only. It is never read for authorization.
 const {error}=await db.auth.updateUser({data:{menuzqr_onboarding:normalizeDraft(value)}});
 return {ok:!error};
}
export async function checkOnboardingSlug(raw:string){
 const db=await createServerSupabase();const {data:{user}}=await db.auth.getUser();
 if(!user)return {available:false,error:'Sign in first.'};
 const {value,error}=validateSlug(typeof raw==='string'?raw:'');
 if(error)return {available:false,error};
 const result=await createAdminSupabase().from('restaurants').select('id').eq('slug',value).limit(1);
 if(result.error)return {available:false,error:'تعذر التحقق. حاول مرة أخرى. Could not check availability.'};
 return {available:!result.data?.length};
}
export async function completeOnboarding(value:unknown){
 const draft=normalizeDraft(value);const db=await createServerSupabase();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return {ok:false,message:'Sign in first.'};
 const {value:slug,error:slugError}=validateSlug(draft.slug);
 if(!draft.activity||draft.name.trim().length<2||slugError)return {ok:false,message:slugError??'راجع الاسم والنشاط. Check name and activity.'};
 const accepted=draft.activity==='supermarket'?['qr','starter','business','pro']:['qr','pos','business','pro'];
 if(!accepted.includes(draft.plan))return {ok:false,message:'اختر باقة صحيحة. Choose a valid plan.'};
 for(const key of ['website_url','instagram_url','facebook_url','logo_url'] as const){if(!draft[key])continue;try{const u=new URL(draft[key]);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{return {ok:false,message:'الروابط يجب أن تبدأ بـ https://. Links must use HTTPS.'};}}
 if(draft.logo_url&&!sanitiseImageUrl(draft.logo_url))return {ok:false,message:'يمكنك رفع الشعار من صفحة بيانات النشاط بعد الإنشاء. Upload your logo from the business profile after signup.'};
 const admin=createAdminSupabase();
 const existing=await admin.from('restaurants').select('id').eq('owner_id',user.id).limit(1);
 if(existing.error)return {ok:false,message:'Could not verify account.'};
 if(existing.data?.length)return {ok:true};
 const memberships=await admin.from('restaurant_members').select('id').eq('user_id',user.id).limit(1);
 if(memberships.error||memberships.data?.length)return {ok:false,message:'This login is already associated with a business.'};
 const available=await checkOnboardingSlug(slug);if(!available.available)return {ok:false,message:available.error??'الرابط مستخدم. Link already taken.'};
 // Deterministic primary key makes concurrent retries safe without modifying existing tenants.
 const {error}=await admin.from('restaurants').insert({id:user.id,owner_id:user.id,name:draft.name.trim(),slug,restaurant_type:draft.activity,business_kind:draft.activity,enabled_modules:SETUP_MODULES,status:'inactive',payment_status:'unpaid',price_cents:80000,subscription_type:'one_time',ordering_enabled:false,waiter_calls_enabled:false,currency:'EGP',language:await getLocale(),phone:draft.phone||null,description:draft.description||null,logo_url:draft.logo_url||null});
 if(error){return {ok:false,message:error.code==='23505'?'الحساب أو الرابط موجود بالفعل. أعد تحميل الصفحة. Account or link already exists; refresh.':'تعذر إنشاء الحساب. حاول مرة أخرى. Could not create business.'};}
 const social=await admin.from('restaurant_settings').upsert({restaurant_id:user.id,website_url:draft.website_url,instagram_url:draft.instagram_url,facebook_url:draft.facebook_url},{onConflict:'restaurant_id'});
 await db.auth.updateUser({data:{menuzqr_onboarding:{...draft,step:2},menuzqr_requested_plan:{activity:draft.activity,plan:draft.plan,yearly:draft.yearly}}});
 revalidatePath('/dashboard','layout');
 return {ok:true,message:social.error?'تم إنشاء النشاط. راجع روابط التواصل من الإعدادات. Business created; check social links in Settings.':undefined};
}
