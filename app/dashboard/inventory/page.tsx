import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {InventoryManager} from '@/components/dashboard/InventoryManager';
import {PageHeader} from '@/components/dashboard/Shell';
export default async function InventoryPage(){
 const member=await requireBusinessModule('inventory');const db=await createServerSupabase();const {data,error}=await db.from('product_variants').select('id,name,stock_quantity,stock_tracked,products!inner(name,barcode)').eq('restaurant_id',member.restaurant.id).order('created_at').limit(500);
 if(error)throw Error('Could not load inventory');
 const rows=(data??[]).map(r=>({...r,products:Array.isArray(r.products)?r.products[0]:r.products}));
 return <div className="mx-auto max-w-4xl"><PageHeader title="المخزون · Inventory" description=""/><InventoryManager rows={rows}/></div>;
}
