"use server";
import { requireBusinessModule } from "@/lib/business-access";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMenuRestaurant } from "./helpers";
import { getLocale } from "@/lib/i18n/server";

export type ImportResult = { ok: boolean; message?: string; added?: number; skipped?: number; sections?: number; repaired?: number; hiddenSections?: number };
export type ImportPick = { id: string; price?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Atomic copy. Source ids retain the section link when the owner renames it. */
export async function importCatalogItemsAction(picks: ImportPick[], publishNow = false): Promise<ImportResult> {
  await requireBusinessModule("catalog");
  const owned = await getMenuRestaurant();
  if (!owned.ok) return {ok:false,message:owned.error?.message};
  if (!Array.isArray(picks) || picks.length > 150) return {ok:false,message:"Pick up to 150 dishes."};
  const chosen = new Map<string,{id:string;price?:number}>();
  for (const pick of picks) {
    if (!pick || typeof pick.id !== "string" || !UUID.test(pick.id)) continue;
    const price = pick.price;
    chosen.set(pick.id,{id:pick.id,...(typeof price === 'number' && Number.isFinite(price) && price >= 0 ? {price:Math.min(999999,Math.round(price*100)/100)} : {})});
  }
  if (!chosen.size) return {ok:false,message:"Pick at least one dish."};
  const [supabase,locale] = await Promise.all([createServerSupabase(),getLocale()]);
  const {data,error} = await supabase.rpc('import_catalog_menu',{p_restaurant:owned.restaurant.id,p_picks:[...chosen.values()],p_publish:publishNow === true,p_other_name:locale==='ar'?'أصناف تانية':'Other'});
  if (error) return {ok:false,message:error.message};
  for (const path of ['/dashboard/catalog','/dashboard/categories','/dashboard/products','/dashboard/pos','/dashboard',`/${owned.restaurant.slug}/menu`]) revalidatePath(path);
  return {ok:true,...data};
}
