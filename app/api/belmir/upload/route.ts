import {NextResponse} from 'next/server';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {belmirAccess,sameOrigin} from '@/lib/belmir/server';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403});
 const access=await belmirAccess();if(!access.ok)return NextResponse.json({error:'Admin access required.'},{status:access.status});
 if(Number(request.headers.get('content-length'))>3400000)return NextResponse.json({error:'Choose an image smaller than 3 MB.'},{status:413});
 let file:FormDataEntryValue|null;try{file=(await request.formData()).get('file');}catch{return NextResponse.json({error:'Invalid upload.'},{status:400});}
 if(!(file instanceof File)||file.size===0||file.size>3145728)return NextResponse.json({error:'Choose an image smaller than 3 MB.'},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 const ext=file.type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216?'jpg':file.type==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':file.type==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
 if(!ext)return NextResponse.json({error:'Please upload a JPG, PNG or WebP image.'},{status:400});
 const db=createAdminSupabase();const path=`belmir/${crypto.randomUUID()}.${ext}`;
 const {error}=await db.storage.from('belmir-assets').upload(path,bytes,{contentType:file.type,cacheControl:'31536000',upsert:false});
 if(error)return NextResponse.json({error:'Upload failed. Please try again.'},{status:500});
 return NextResponse.json({url:db.storage.from('belmir-assets').getPublicUrl(path).data.publicUrl});
}
