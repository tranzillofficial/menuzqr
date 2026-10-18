import 'server-only';
import {createServerSupabase} from '@/lib/supabase/server';
export async function belmirAccess() {
 const db=await createServerSupabase();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return {ok:false,status:401} as const;
 if(user.app_metadata?.belmir_admin===true)return {ok:true,status:200} as const;
 const {data:profile}=await db.from('profiles').select('is_admin').eq('id',user.id).maybeSingle();
 if(!profile?.is_admin)return {ok:false,status:403} as const;
 return {ok:true,status:200} as const;
}
export function sameOrigin(request: Request) {
 const origin=request.headers.get('origin');return request.headers.get('sec-fetch-site')!=='cross-site' && (!origin || origin===new URL(request.url).origin);
}
