import {featureEnabled} from "./business-features";
import {unstable_cache} from "next/cache";
import { activeOffers } from "./offers";
import {getTenantDomain} from "./tenant-domain";
import { withCatalogName } from './menu-localization';
import { moduleEnabled } from "./business-modules";
import { visibleCategories,categoryDescendants } from "./category-tree";
import { displayPrice, vatRate } from "./tax";
import { getUser } from "./auth";
import { cache } from "react";
import { createAdminSupabase } from "./supabase/admin";
import type { MenuData, ProductWithVariants, Restaurant, RestaurantTable } from "./types";

export type PublicMenuResult =
  | { state: "not_found" }
  | {
      state: "inactive";
      restaurantName: string;
      status: Restaurant["status"];
      language: string;
    }
  | { state: "ok"; data: MenuData; table: Pick<RestaurantTable, "id" | "label"> | null };

/**
 * Loads a public menu by slug.
 *
 * Uses the service-role client on purpose: the activation gate is enforced
 * here, in one place, rather than being spread across RLS + UI. Only menu
 * data for an *active* restaurant is ever returned.
 */
export const getPublicMenu = cache(async function getPublicMenu(
  slug: string,
  tableToken?: string, categoryFilter = "", pageInput = "1", searchInput = ""
): Promise<PublicMenuResult> {
  const domain=await getTenantDomain();
  if(domain&&domain.restaurants.slug!==slug)return {state:"not_found"} as const;
  const supabase = createAdminSupabase();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select(
      "id,business_kind,enabled_modules,name,slug,description,logo_url,cover_url,phone,address,currency,language,menu_theme,ordering_enabled,waiter_calls_enabled,status,owner_id,activation_expires_at,business_timezone,tax_mode,vat_registered,prices_include_vat,tax_rates,menu_prices_include_vat"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) return { state: "not_found" };

  const expired = restaurant.activation_expires_at && new Date(restaurant.activation_expires_at) <= new Date();
  const preview = restaurant.status !== "active" || Boolean(expired);
  const user = preview ? await getUser() : null;
  if (preview && user?.id !== restaurant.owner_id) {
    return {
      state: "inactive",
      restaurantName: restaurant.name,
      status: restaurant.status,
      language: restaurant.language,
    };
  }

  restaurant.ordering_enabled = restaurant.ordering_enabled && featureEnabled(restaurant,"online_ordering");
  restaurant.waiter_calls_enabled = restaurant.waiter_calls_enabled && moduleEnabled(restaurant,"service_calls");
  if (preview) {
    restaurant.ordering_enabled = false;
    restaurant.waiter_calls_enabled = false;
  }
  const market=restaurant.business_kind==='supermarket';
  const page=market?Math.min(10000,Math.max(1,Math.trunc(Number(pageInput))||1)):1;
  const pageSize=24;
  const {data:categories,error:categoryError}=await supabase.from('categories').select('*').eq('restaurant_id',restaurant.id).order('sort_order').order('created_at');
  if(categoryError)throw Error('Could not load categories');
  const visibleIds=visibleCategories(categories??[]).map(c=>c.id);
  const offerPage=categoryFilter==='__offers';
  const offerResult=moduleEnabled(restaurant,'offers')?await supabase.from('business_offers').select('*').eq('restaurant_id',restaurant.id).eq('is_active',true).order('sort_order').order('created_at',{ascending:false}):{data:[],error:null};
  if(offerResult.error)throw Error('Could not load offers');
  const currentOffers=activeOffers(offerResult.data??[]);
  const offeredIds=[...new Set(currentOffers.flatMap(o=>o.product_ids))];
  let productQuery=supabase.from('products').select('*, product_variants(id,restaurant_id,product_id,name,name_en,price,image_url,sort_order,is_active,created_at)',{count:market?'exact':undefined}).eq('restaurant_id',restaurant.id).eq('is_active',true).order('sort_order').order('created_at').order('id');
  if(market){
    if(categoryFilter && visibleIds.includes(categoryFilter))productQuery=productQuery.in('category_id',[...categoryDescendants(categories??[],categoryFilter)].filter(id=>visibleIds.includes(id)));
    else if(categoryFilter==='uncategorised')productQuery=productQuery.is('category_id',null);
    else productQuery=productQuery.or(`category_id.is.null${visibleIds.length?',category_id.in.('+visibleIds.join(',')+')':''}`);
    const needle=searchInput.slice(0,80).replace(/[%,_().\\]/g,' ').trim();
    if(needle)productQuery=productQuery.or(`name.ilike.%${needle}%,barcode.ilike.%${needle}%`);
    productQuery=offerPage?productQuery.in("id",offeredIds.length?offeredIds:["00000000-0000-0000-0000-000000000000"]).limit(1000):productQuery.range((page-1)*pageSize,page*pageSize-1);
  }
  const [{ data: products,error:productError,count:productCount }, {data: payments}, {data: offers,error:offerError}] = await Promise.all([
    market ? unstable_cache(async()=>await productQuery,["market-products-v2",restaurant.id,slug,String(page),categoryFilter,searchInput,visibleIds.join(",")],{revalidate:30,tags:[`menu-products:${slug}`]})() : productQuery,
    supabase.from("restaurant_settings").select("remote_ordering_enabled,cash_wallet,instapay_address,payment_whatsapp,delivery_fee,free_delivery_above,payment_details,location_url,facebook_url,instagram_url,website_url").eq("restaurant_id",restaurant.id).maybeSingle(),
    Promise.resolve(offerResult),
  ]);
  if(productError)throw Error("Could not load products");
  if(offerError) throw new Error("Could not load business offers");

  if(payments){
    if(!featureEnabled(restaurant,'delivery_settings')){payments.delivery_fee=0;payments.free_delivery_above=null;}
    if(!featureEnabled(restaurant,'payment_settings')){payments.payment_details='';payments.cash_wallet='';payments.instapay_address='';}
    if(!featureEnabled(restaurant,'contact_settings')){payments.location_url='';payments.facebook_url='';payments.instagram_url='';payments.website_url='';payments.payment_whatsapp='';}
  }
  let table: Pick<RestaurantTable, "id" | "label"> | null = null;
  if (tableToken && !preview && moduleEnabled(restaurant,"tables")) {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("id,label")
      .eq("restaurant_id", restaurant.id)
      .eq("qr_token", tableToken)
      .eq("is_active", true)
      .maybeSingle();
    table = data ?? null;
  }

  const itemIds = [...new Set((products ?? []).map(p => p.source_catalog_item_id).filter(Boolean))];
  const categoryIds = [...new Set((categories ?? []).map(c => c.source_catalog_category_id).filter(Boolean))];
  const [catalogItems, catalogCategories] = await Promise.all([
    itemIds.length ? supabase.from('catalog_items').select('id,name,name_en,legacy_name,variants').in('id', itemIds) : Promise.resolve({data: []}),
    categoryIds.length ? supabase.from('catalog_categories').select('id,name,name_en').in('id', categoryIds) : Promise.resolve({data: []}),
  ]);
  const allProducts = ((products ?? []) as ProductWithVariants[]).map((p) => ({
    ...withCatalogName(p, catalogItems.data?.find(item => item.id === p.source_catalog_item_id)),
    product_variants: (p.product_variants ?? [])
      .filter((v) => v.is_active)
      .map(v => {
        const source = catalogItems.data?.find(item => item.id === p.source_catalog_item_id);
        const variants = Array.isArray(source?.variants) ? source.variants as {name:string;name_en?:string}[] : [];
        const matched = variants.find(variant => variant.name === v.name || variant.name_en === v.name);
        const regular = ['Regular','عادي'].includes(v.name) ? {name:'عادي',name_en:'Regular'} : null;
        const publicVariant={id:v.id,restaurant_id:v.restaurant_id,product_id:v.product_id,name:v.name,name_en:v.name_en,price:v.price,image_url:v.image_url,sort_order:v.sort_order,is_active:v.is_active,created_at:v.created_at};
        return { ...withCatalogName(publicVariant, matched ?? regular), price: displayPrice(Number(v.price), p.vat_code, restaurant), tax: { basePrice: Number(v.price), rate: vatRate(restaurant.tax_mode,restaurant.vat_registered,p.vat_code,restaurant.tax_rates), inclusive: restaurant.prices_include_vat, showGross: restaurant.menu_prices_include_vat !== false } };
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.price - b.price),
  }));

  const visible = visibleCategories(categories ?? []);
  const grouped = visible.map((category) => ({
    ...withCatalogName(category, catalogCategories.data?.find(source => source.id === category.source_catalog_category_id)),
    products: allProducts.filter((p) => p.category_id === category.id),
  }));

  const uncategorised = allProducts.filter((p) => !p.category_id);
  if (uncategorised.length > 0) {
    grouped.push({
      id: "uncategorised",
      restaurant_id: restaurant.id,
      name: "أصناف أخرى",
      name_en: "More",
      description: null,
      image_url: null,
      sort_order: 9999,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      products: uncategorised,
    });
  }

  return {
    state: "ok",
    table,
    data: {
      ...(market&&!offerPage?{pagination:{page,pageSize,total:productCount??0,query:searchInput.slice(0,80),category:visibleIds.includes(categoryFilter)||categoryFilter==="uncategorised"?categoryFilter:""}}:{}),
      menu_path:domain?"/menu":`/${slug}/menu`,
      payments: payments ?? undefined,
      offers: preview ? [] : activeOffers(offers ?? []),
      restaurant: { enabled_modules: restaurant.enabled_modules, business_kind: restaurant.business_kind, business_timezone:restaurant.business_timezone, id: restaurant.id, name: restaurant.name, slug: restaurant.slug, description: restaurant.description, logo_url: restaurant.logo_url, cover_url: restaurant.cover_url, phone: restaurant.phone, address: restaurant.address, currency: restaurant.currency, language: restaurant.language, menu_theme: restaurant.menu_theme, ordering_enabled: restaurant.ordering_enabled, waiter_calls_enabled: restaurant.waiter_calls_enabled, prices_include_vat: restaurant.prices_include_vat, menu_prices_include_vat: restaurant.menu_prices_include_vat, vat_registered: restaurant.vat_registered, tax_mode: restaurant.tax_mode, tax_rates: restaurant.tax_rates },
      categories: market || moduleEnabled(restaurant,"subcategories") ? grouped : grouped.filter((c) => c.products.length > 0),
    },
  };
});
