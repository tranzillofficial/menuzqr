import type {BusinessOffer} from './types';
export function activeOffers(offers:BusinessOffer[],now=Date.now()){
 return offers.filter(o=>o.is_active&&(!o.starts_at||new Date(o.starts_at).getTime()<=now)&&(!o.ends_at||new Date(o.ends_at).getTime()>now));
}
