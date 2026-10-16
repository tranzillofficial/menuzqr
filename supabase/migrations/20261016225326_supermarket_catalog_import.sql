begin;
-- Invoker privileges retain existing tenant RLS. No existing customer row is changed.
create or replace function public.import_supermarket_product(p_restaurant uuid,p_source uuid,p_price numeric,p_publish boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item supermarket_catalog_products; target_product uuid; target_category uuid; section_name text; image text; position integer;
begin
 if auth.uid() is null or not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=auth.uid() and is_active and role in ('owner','manager')) then raise exception 'Manager access required'; end if;
 if not business_module_enabled(p_restaurant,'catalog') or not business_module_enabled(p_restaurant,'products') then raise exception 'Catalog or products module is disabled'; end if;
 perform 1 from restaurants where id=p_restaurant for update;
 if not found then raise exception 'Restaurant unavailable'; end if;
 if p_price is null or p_price<0 or p_price>999999 or p_price::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid selling price'; end if;
 if p_publish and p_price<=0 then raise exception 'Enter a positive price before publishing'; end if;
 select * into item from supermarket_catalog_products where id=p_source and review_status='approved';
 if not found then raise exception 'Product is unavailable or awaiting review'; end if;
 target_product:=md5('menuzqr:supermarket:product:'||p_restaurant::text||':'||p_source::text)::uuid;
 if exists(select 1 from products where id=target_product and restaurant_id=p_restaurant) then return jsonb_build_object('skipped',true,'id',target_product); end if;
 target_category:=md5('menuzqr:supermarket:category:'||p_restaurant::text||':'||item.category)::uuid;
 section_name:=case item.category when 'bakery' then 'مخبوزات' when 'beverages' then 'مشروبات' when 'dairy_and_cheese' then 'ألبان وجبن' when 'detergents_and_household' then 'منظفات ومستلزمات منزلية' when 'food_products' then 'مواد غذائية' when 'frozen_and_meat' then 'مجمدات ولحوم' when 'fruits_and_vegetables' then 'خضار وفاكهة' when 'personal_care' then 'عناية شخصية' else 'مقرمشات وشوكولاتة' end;
 select coalesce(max(sort_order),0)+10 into position from categories where restaurant_id=p_restaurant;
 insert into categories(id,restaurant_id,name,sort_order,is_active) values(target_category,p_restaurant,section_name,position,true) on conflict(id) do nothing;
 if not exists(select 1 from categories where id=target_category and restaurant_id=p_restaurant) then raise exception 'Invalid target category'; end if;
 select url into image from supermarket_catalog_images where product_id=p_source and rights_status='approved' and url like 'https://ik.imagekit.io/redom/menuzqr/catalog/supermarket/%' order by id limit 1;
 -- Follow the same image feature switch used by the product editor.
 if exists(select 1 from restaurants where id=p_restaurant and enabled_modules @> array['features_v3'] and not enabled_modules @> array['product_images']) then image:=null; end if;
 select coalesce(max(sort_order),0)+10 into position from products where restaurant_id=p_restaurant;
 insert into products(id,restaurant_id,category_id,name,image_url,image_source,sort_order,is_active,vat_code)
 values(target_product,p_restaurant,target_category,left(item.name_ar,90),image,case when image is null then 'none' else 'library' end,position,coalesce(p_publish,false),'zero');
 -- Candidate/SKU codes never become merchant barcodes without physical evidence.
 insert into product_variants(restaurant_id,product_id,name,price,is_active,sort_order) values(p_restaurant,target_product,left(coalesce(nullif(trim(concat(item.size,' ',item.size_unit)),''),'عادي'),40),round(p_price,2),true,0);
 return jsonb_build_object('skipped',false,'id',target_product);
end $$;
revoke all on function public.import_supermarket_product(uuid,uuid,numeric,boolean) from public,anon;
grant execute on function public.import_supermarket_product(uuid,uuid,numeric,boolean) to authenticated;
create index supermarket_catalog_candidate_idx on public.supermarket_catalog_products(barcode_candidate) where review_status='approved';
commit;
