'use server';
import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {revalidatePath,revalidateTag} from 'next/cache';
import {SUPERMARKET_SECTIONS,SUPERMARKET_PAGE_SIZE,type SupermarketItem} from '@/lib/supermarket-catalog';
import {normalizeBarcode,validBarcode} from '@/lib/barcode';
import {featureEnabled} from '@/lib/business-features';

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

export async function lookupSupermarketDraft(raw:string,mode:'barcode'|'name'){
 const member=await requireBusinessModule('catalog');
 if(mode==='barcode'&&!featureEnabled(member.restaurant,'product_barcode'))return {items:[] as SupermarketItem[],error:'Barcode lookup is disabled.'};
 const db=await createServerSupabase();
 const columns='id,name_ar,brand,category,size,size_unit,barcode_candidate,supermarket_catalog_images(url)';
 if(mode==='barcode'){
  const code=normalizeBarcode(typeof raw==='string'?raw:'');
  if(!validBarcode(code))return {items:[] as SupermarketItem[],error:'باركود غير صالح. Invalid barcode.'};
  const {data,error}=await db.from('supermarket_catalog_products').select(columns).eq('review_status','approved').eq('barcode_candidate',code).order('id').limit(8);
  return {items:(data??[]) as SupermarketItem[],...(error?{error:'تعذر البحث. حاول مرة أخرى. Could not search. Try again.'}:{})};
 }
 if(typeof raw!=='string'||raw.trim().length<2)return {items:[] as SupermarketItem[]};
 const {data:ranked,error}=await db.rpc('suggest_supermarket_products',{p_query:raw.slice(0,100)});
 if(error)return {items:[] as SupermarketItem[],error:'تعذر البحث. حاول مرة أخرى. Could not search. Try again.'};
 const ids=(ranked??[]).map((row:{id:string})=>row.id) as string[];
 if(!ids.length)return {items:[] as SupermarketItem[]};
 const found=await db.from('supermarket_catalog_products').select(columns).in('id',ids).eq('review_status','approved');
 const rows=(found.data??[]) as SupermarketItem[];
 return {items:ids.flatMap(id=>rows.filter(row=>row.id===id)),...(found.error?{error:'تعذر تحميل الاقتراحات. Could not load suggestions.'}:{})};
}
