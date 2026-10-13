import {businessSchemaMissing} from '@/lib/business-schema';
import { requireAdmin } from '@/lib/auth';
import {createServerSupabase} from '@/lib/supabase/server';
import type {BusinessType} from '@/lib/business-configuration';
import { BusinessAccountForm } from '@/components/admin/BusinessAccountForm';
export default async function NewAccount(){await requireAdmin();const db=await createServerSupabase();const {data,error}=await db.from("business_types").select("*").eq("is_active",true).order("name_ar");if(error&&!businessSchemaMissing(error))throw Error("Could not load account templates");return <div className="mx-auto max-w-3xl"><BusinessAccountForm types={(data??[]) as BusinessType[]}/></div>;}
