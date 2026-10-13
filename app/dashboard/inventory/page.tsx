import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {InventoryManager} from '@/components/dashboard/InventoryManager';
import {PageHeader} from '@/components/dashboard/Shell';
export default async function InventoryPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const member=await requireBusinessModule('inventory');const db=await createServerSupabase();const params=await searchParams;
 const q=(params.q??'').slice(0,100);const parsed=Number(params.page??1);const page=Number.isFinite(parsed)?Math.min(10000,Math.max(1,Math.floor(parsed))):1;
 let request=db.from('product_variants').select('id,name,stock_quantity,stock_tracked,products!inner(name,barcode)',{count:'exact'}).eq('restaurant_id',member.restaurant.id);
 const safe=q.replace(/[,%()_*\\]/g,' ').trim();
 if(safe)request=request.or(`name.ilike.%${safe}%,barcode.ilike.%${safe}%`,{referencedTable:'products'});
 const {data,error,count}=await request.order('created_at').order('id').range((page-1)*50,page*50-1);
 if(error)throw Error('Could not load inventory');
 const rows=(data??[]).map(r=>({...r,products:Array.isArray(r.products)?r.products[0]:r.products}));
 return <div className="mx-auto max-w-4xl"><PageHeader title="المخزون · Inventory" description=""/><InventoryManager rows={rows} query={q} page={page} total={count??0}/></div>;
}
