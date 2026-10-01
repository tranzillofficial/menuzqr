begin;
alter table categories add column source_catalog_category_id uuid;
alter table products add column source_catalog_item_id uuid;
create unique index categories_catalog_source on categories(restaurant_id,source_catalog_category_id) where source_catalog_category_id is not null;
create unique index products_catalog_source on products(restaurant_id,source_catalog_item_id) where source_catalog_item_id is not null;
comment on column categories.source_catalog_category_id is 'Original catalog section, retained when the restaurant renames its own copy.';
comment on column products.source_catalog_item_id is 'Original catalog item. Copies remain independently editable.';

create function fiscal_private.check_product_category() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.category_id is not null and not exists(select 1 from categories where id=new.category_id and restaurant_id=new.restaurant_id) then raise exception 'Category must belong to the same restaurant'; end if;
 return new;
end $$;
revoke all on function fiscal_private.check_product_category() from public,anon,authenticated;
create trigger check_product_category before insert or update of category_id,restaurant_id on products for each row execute function fiscal_private.check_product_category();

create function import_catalog_menu(p_restaurant uuid,p_picks jsonb,p_publish boolean default false,p_other_name text default 'Other') returns jsonb
language plpgsql security invoker set search_path=public as $$
declare item record; existing products; cat categories; category_id_copy uuid; product_id_copy uuid; section_name text; section_key text; item_name text; price numeric; base_hint numeric; variant jsonb; variant_name text; variant_price numeric; image text; category_order integer; product_order integer; size_order integer; added integer:=0; skipped integer:=0; sections integer:=0; repaired integer:=0; available integer:=0; hidden uuid[]:='{}';
begin
 if auth.uid() is null or not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=auth.uid() and is_active and role in ('owner','manager')) then raise exception 'Manager access required'; end if;
 -- Serialize imports for this restaurant, including repeated requests.
 perform 1 from restaurants where id=p_restaurant for update;
 if not found then raise exception 'Restaurant unavailable'; end if;
 if jsonb_typeof(p_picks) is distinct from 'array' or jsonb_array_length(p_picks) not between 1 and 150 then raise exception 'Pick up to 150 dishes'; end if;
 if length(trim(coalesce(p_other_name,''))) not between 1 and 60 then raise exception 'Invalid fallback section'; end if;
 if exists(select 1 from jsonb_array_elements(p_picks) x where jsonb_typeof(x) is distinct from 'object' or coalesce(x->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (x ? 'price' and (jsonb_typeof(x->'price') is distinct from 'number' or (x->>'price')::numeric not between 0 and 999999))) then raise exception 'Invalid picked item or price'; end if;
 select coalesce(max(sort_order),-1)+1 into category_order from categories where restaurant_id=p_restaurant;
 select coalesce(max(sort_order),-1)+1 into product_order from products where restaurant_id=p_restaurant;
 for item in
   select ci.*,cc.name as section_name,chosen.pick from catalog_items ci
   join (select distinct on (x->>'id') x as pick from jsonb_array_elements(p_picks) x order by x->>'id') chosen on (chosen.pick->>'id')::uuid=ci.id
   left join catalog_categories cc on cc.id=ci.category_id
   where ci.is_active and (ci.category_id is null or cc.is_active) order by ci.sort_order,ci.id
 loop
   available:=available+1;
   item_name:=left(trim(item.name),90);
   if item_name='' then raise exception 'Catalog dish name is missing'; end if;
   section_name:=left(coalesce(nullif(trim(item.section_name),''),nullif(trim(item.category_name),''),trim(p_other_name)),60);
   select * into existing from products where restaurant_id=p_restaurant and (source_catalog_item_id=item.id or lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(item_name,'\s+',' ','g'))) order by (source_catalog_item_id=item.id) desc nulls last,created_at,id limit 1;
   -- Preserve an existing merchant assignment, name, prices and visibility.
   if found and existing.category_id is not null then
     if existing.source_catalog_item_id is null and exists(select 1 from categories where id=existing.category_id and restaurant_id=p_restaurant and (source_catalog_category_id=item.category_id or lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(section_name,'\s+',' ','g')))) then update products set source_catalog_item_id=item.id where id=existing.id and restaurant_id=p_restaurant;end if;
     skipped:=skipped+1;continue;
   end if;
   section_name:=left(coalesce(nullif(trim(item.section_name),''),nullif(trim(item.category_name),''),trim(p_other_name)),60);
   section_key:=lower(regexp_replace(section_name,'\s+',' ','g'));
   select * into cat from categories where restaurant_id=p_restaurant and (source_catalog_category_id=item.category_id or lower(regexp_replace(trim(name),'\s+',' ','g'))=section_key) order by (source_catalog_category_id=item.category_id) desc nulls last,is_active desc,created_at,id limit 1;
   if found then
     category_id_copy:=cat.id;
     if not cat.is_active and not cat.id=any(hidden) then hidden:=array_append(hidden,cat.id);end if;
     if cat.source_catalog_category_id is null and item.category_id is not null then update categories set source_catalog_category_id=item.category_id where id=cat.id and restaurant_id=p_restaurant;end if;
   else
     insert into categories(restaurant_id,name,sort_order,is_active,source_catalog_category_id) values(p_restaurant,section_name,category_order,true,item.category_id) returning id into category_id_copy;
     category_order:=category_order+1;sections:=sections+1;
   end if;
   if existing.id is not null then
     update products set category_id=category_id_copy,source_catalog_item_id=coalesce(source_catalog_item_id,item.id) where id=existing.id and restaurant_id=p_restaurant;
     repaired:=repaired+1;skipped:=skipped+1;continue;
   end if;
   price:=round(coalesce((item.pick->>'price')::numeric,item.suggested_price,0),2);
   image:=case when item.image_url ~ '^https://[^/]+/storage/v1/object/public/(menu-library|restaurant-assets)/' then item.image_url else null end;
   insert into products(restaurant_id,category_id,name,description,ingredients,image_url,image_source,sort_order,is_active,source_catalog_item_id)
   values(p_restaurant,category_id_copy,item_name,left(item.description,400),left(item.ingredients,300),image,case when image is null then 'none' else 'library' end,product_order,coalesce(p_publish,false) and price>0,item.id) returning id into product_id_copy;
   product_order:=product_order+1;added:=added+1;size_order:=0;
   base_hint:=case when jsonb_typeof(item.variants->0->'price')='number' then greatest(0,(item.variants->0->>'price')::numeric) else 0 end;
   for variant in select value from jsonb_array_elements(case when jsonb_typeof(item.variants)='array' then item.variants else '[]'::jsonb end) limit 8 loop
     variant_name:=left(coalesce(nullif(trim(variant->>'name'),''),'Regular'),40);
     variant_price:=price+greatest(0,(case when jsonb_typeof(variant->'price')='number' then greatest(0,(variant->>'price')::numeric) else 0 end)-base_hint);
     insert into product_variants(restaurant_id,product_id,name,price,sort_order,is_active) values(p_restaurant,product_id_copy,variant_name,round(variant_price,2),size_order,true);
     size_order:=size_order+1;
   end loop;
   if size_order=0 then insert into product_variants(restaurant_id,product_id,name,price,sort_order,is_active) values(p_restaurant,product_id_copy,'Regular',price,0,true);end if;
 end loop;
 if available=0 then raise exception 'Those dishes are no longer available'; end if;
 return jsonb_build_object('added',added,'skipped',skipped,'sections',sections,'repaired',repaired,'hiddenSections',cardinality(hidden));
end $$;
revoke all on function import_catalog_menu(uuid,jsonb,boolean,text) from public,anon;
grant execute on function import_catalog_menu(uuid,jsonb,boolean,text) to authenticated;
commit;
