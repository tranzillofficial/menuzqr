'use server';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {revalidatePath,revalidateTag} from 'next/cache';
import {SUPERMARKET_SECTIONS,SUPERMARKET_PAGE_SIZE,type SupermarketItem} from '@/lib/supermarket-catalog';

export async function searchSupermarketCatalog(query='',category='',page=0){
 await requireBusinessModule('catalog');
 const db=await createServerSupabase();
 const offset=Math.max(0,Math.min(10000,Math.floor(Number(page)||0)))*SUPERMARKET_PAGE_SIZE;
 let request=db.from('supermarket_catalog_products').select('id,name_ar,brand,category,size,size_unit,barcode_candidate,supermarket_catalog_images(url)',{count:'exact'}).eq('review_status','approved');
 const q=String(query).slice(0,100).replace(/[^\p{L}\p{N}\s-]/gu,'').trim();
 if(q)request=request.or(`name_ar.ilike.%${q}%,barcode_candidate.eq.${q}`);
 if(category in SUPERMARKET_SECTIONS)request=request.eq('category',category);
 const {data,error,count}=await request.order('name_ar').order('id').range(offset,offset+SUPERMARKET_PAGE_SIZE-1);
 if(error)return {items:[] as SupermarketItem[],total:0,error:'تعذر تحميل المنتجات. Could not load products.'};
 return {items:(data??[]) as SupermarketItem[],total:count??0};
}

export async function addSupermarketCatalogItem(id:string,price:number,publish:boolean){
 const member=await requireBusinessModule('catalog');
 const db=await createServerSupabase();
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isFinite(price)||price<0||price>999999)return {ok:false,message:'راجع سعر البيع. Check the selling price.'};
 const {data,error}=await db.rpc('import_supermarket_product',{p_restaurant:member.restaurant.id,p_source:id,p_price:Math.round(price*100)/100,p_publish:publish===true});
 if(error)return {ok:false,message:error.message};
 revalidateTag(`menu-products:${member.restaurant.slug}`,{expire:0});
 for(const path of ['/dashboard/products','/dashboard/categories',`/${member.restaurant.slug}/menu`])revalidatePath(path);
 return {ok:true,skipped:Boolean(data?.skipped)};
}
