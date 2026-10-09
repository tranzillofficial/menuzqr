import {requireBusinessModule} from '@/lib/business-access';
import {createServerSupabase} from '@/lib/supabase/server';
import {OfferEditor} from '@/components/dashboard/OfferEditor';
import {getLocale} from '@/lib/i18n/server';
import type {BusinessOffer} from '@/lib/types';
export default async function OffersPage(){
 const {restaurant}=await requireBusinessModule('offers');const ar=await getLocale()==='ar';const db=await createServerSupabase();
 const [{data:offers,error},{data:products,error:productError}]=await Promise.all([db.from('business_offers').select('*').eq('restaurant_id',restaurant.id).order('created_at',{ascending:false}),db.from('products').select('id,name').eq('restaurant_id',restaurant.id).order('name')]);if(error||productError)throw new Error('Could not load offers');
 const day=(instant:string|null,end=false)=>{if(!instant)return '';const date=new Date(new Date(instant).getTime()-(end?1:0));return new Intl.DateTimeFormat('en-CA',{timeZone:restaurant.business_timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);};
 return <div className="mx-auto max-w-4xl space-y-5"><h1 className="text-2xl font-bold">{ar?'العروض':'Offers'}</h1><p className="text-sm text-ink-500">{ar?'العروض المفعّلة والسارية تظهر في البانر الأحمر وتفتح صفحة العروض. العرض المنتهي يختفي تلقائيًا.':'Published, current offers appear in the red banner and open the Offers page. Expired offers disappear automatically.'}</p><OfferEditor key={`new-${offers?.length}`} restaurantId={restaurant.id} products={products??[]}/>{(offers??[]).map(o=><OfferEditor key={o.id} restaurantId={restaurant.id} products={products??[]} offer={o as BusinessOffer} startDate={day(o.starts_at)} endDate={day(o.ends_at,true)}/>)}</div>;
}
