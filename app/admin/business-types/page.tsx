import {requireAdmin} from '@/lib/auth';
import {createServerSupabase} from '@/lib/supabase/server';
import {BusinessTypesManager} from '@/components/admin/BusinessTypesManager';
import type {BusinessType} from '@/lib/business-configuration';
export default async function BusinessTypesPage(){await requireAdmin();const db=await createServerSupabase();const [{data,error},{data:tenants,error:tenantError}]=await Promise.all([db.from('business_types').select('*').order('name_ar'),db.from('restaurants').select('business_type_id').not('business_type_id','is',null)]);if(error||tenantError)throw Error('Could not load business types');const counts:Record<string,number>={};for(const r of tenants??[])counts[r.business_type_id]=(counts[r.business_type_id]??0)+1;return <BusinessTypesManager types={(data??[]) as BusinessType[]} counts={counts}/>;}
