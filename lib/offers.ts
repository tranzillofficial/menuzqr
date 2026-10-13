import {featureEnabled} from './business-features';
import type {BusinessConfig} from './business-modules';
import type {BusinessOffer} from './types';
export function activeOffers(offers:BusinessOffer[],now=Date.now(),config?:BusinessConfig){
 return offers.filter(o=>(!config||o.offer_type!=='bundle'||featureEnabled(config,'offer_bundle'))&&(!config||o.offer_type!=='discount'||featureEnabled(config,'offer_discount'))&&o.is_active&&(!o.starts_at||new Date(o.starts_at).getTime()<=now)&&(!o.ends_at||new Date(o.ends_at).getTime()>now));
}
