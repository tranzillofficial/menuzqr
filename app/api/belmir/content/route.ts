import {NextResponse} from 'next/server';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {belmirAccess,sameOrigin} from '@/lib/belmir/server';
import {validateBelmirContent} from '@/lib/belmir/validation';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){
 const {data,error}=await createAdminSupabase().from('belmir_site_content').select('payload,revision').eq('id','belmir').single();
 if(error)return NextResponse.json({error:'Menu temporarily unavailable. Please try again.'},{status:503,headers});
 return NextResponse.json({content:data.payload,revision:data.revision},{headers});
}
export async function PUT(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403,headers});
 const access=await belmirAccess();if(!access.ok)return NextResponse.json({error:access.status===401?'Please sign in.':'Admin access required.'},{status:access.status,headers});
 const body=await request.text();if(body.length>400000)return NextResponse.json({error:'Content is too large.'},{status:413,headers});
 let content,revision;try{const input=JSON.parse(body);content=validateBelmirContent(input.content);revision=input.revision;if(!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid revision.');}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid data.'},{status:400,headers});}
 const {data,error}=await createAdminSupabase().from('belmir_site_content').update({payload:content,revision:revision+1,updated_at:new Date().toISOString()}).eq('id','belmir').eq('revision',revision).select('revision').maybeSingle();
 if(error)return NextResponse.json({error:'Could not save. Your changes are still in the form.'},{status:500,headers});
 if(!data)return NextResponse.json({error:'Another editor saved changes. Reload the page before saving again.'},{status:409,headers});
 return NextResponse.json({revision:data.revision},{headers});
}
