begin;
alter table public.catalog_items add column name_en text, add column legacy_name text, add column merged_into_id uuid references public.catalog_items(id);
alter table public.catalog_categories add column name_en text, add column merged_into_id uuid references public.catalog_categories(id);
alter table public.products add column name_en text;
alter table public.categories add column name_en text;
alter table public.product_variants add column name_en text;
-- Preserve the old source IDs as aliases: existing merchant copies are independent.
drop index public.catalog_categories_name_key;
do $$ declare pair record; survivor uuid; obsolete uuid; begin
for pair in select * from (values ('Sandwiches','الساندوتشات'),('Fried Chicken','وجبات البروست')) as x(old_name,new_name) loop
select id into survivor from public.catalog_categories where name=pair.new_name and merged_into_id is null;
select id into obsolete from public.catalog_categories where name=pair.old_name and merged_into_id is null;
if survivor is not null and obsolete is not null then
update public.catalog_items set category_id=survivor where category_id=obsolete;
update public.catalog_categories set merged_into_id=survivor,is_active=false where id=obsolete;
end if;
end loop;
end $$;
update public.catalog_items i set legacy_name=i.name,name=t.ar,name_en=t.en,keywords=coalesce(i.keywords,'{}') || array[t.old,t.en,t.ar]
from (values ('Espresso','إسبريسو','Espresso'),
('Cappuccino','كابتشينو','Cappuccino'),
('Pepsi','بيبسي','Pepsi'),
('V Cola','في كولا','V Cola'),
('Pancakes','بان كيك','Pancakes'),
('English Breakfast','فطور إنجليزي','English Breakfast'),
('Seafood Pasta','مكرونة بالمأكولات البحرية','Seafood Pasta'),
('Burger Combo','وجبة برجر','Burger Combo'),
('Beef Wrap','راب لحم','Beef Wrap'),
('Scrambled Eggs','بيض مخفوق','Scrambled Eggs'),
('Bolognese Pasta','مكرونة بولونيز','Bolognese Pasta'),
('Spicy Chicken','دجاج حار','Spicy Chicken'),
('Cheese Fries','بطاطس بالجبنة','Cheese Fries'),
('Croissant Sandwich','ساندوتش كرواسون','Croissant Sandwich'),
('Mozzarella Sticks','أصابع موزاريلا','Mozzarella Sticks'),
('Molten Cake','مولتن كيك','Molten Cake'),
('Pesto Pasta','مكرونة بيستو','Pesto Pasta'),
('Friends Meal','وجبة الأصدقاء','Friends Meal'),
('French Fries','بطاطس مقلية','French Fries'),
('Chocolate Cake','كيك شوكولاتة','Chocolate Cake'),
('Onion Rings','حلقات بصل','Onion Rings'),
('Beef Sandwich','ساندوتش لحم','Beef Sandwich'),
('Omelette','أومليت','Omelette'),
('Lemon Mint Mojito','موهيتو ليمون بالنعناع','Lemon Mint Mojito'),
('Fried Chicken Pieces','قطع دجاج مقلي','Fried Chicken Pieces'),
('Chicken Tenders','تندرز دجاج','Chicken Tenders'),
('Lemon Mint','ليمون بالنعناع','Lemon Mint'),
('Guava Juice','عصير جوافة','Guava Juice'),
('Caramel Milkshake','ميلك شيك كراميل','Caramel Milkshake'),
('Passion Fruit Mojito','موهيتو باشن فروت','Passion Fruit Mojito'),
('Club Sandwich','كلوب ساندوتش','Club Sandwich'),
('Penne Arrabbiata','مكرونة أرابياتا','Penne Arrabbiata'),
('Nachos','ناتشوز','Nachos'),
('Family Meal','وجبة عائلية','Family Meal'),
('Chicken Wings','أجنحة دجاج','Chicken Wings'),
('French Toast','فرنش توست','French Toast'),
('Steak Sandwich','ساندوتش ستيك','Steak Sandwich'),
('Chicken Combo','وجبة دجاج','Chicken Combo'),
('Shawarma Wrap','راب شاورما','Shawarma Wrap'),
('Tiramisu','تيراميسو','Tiramisu'),
('Crispy Chicken Wrap','راب دجاج كرسبي','Crispy Chicken Wrap'),
('Fried Eggs','بيض مقلي','Fried Eggs'),
('Crispy Chicken Sandwich','ساندوتش دجاج كرسبي','Crispy Chicken Sandwich'),
('Curly Fries','بطاطس حلزونية','Curly Fries'),
('Chicken Bucket','باكت دجاج','Chicken Bucket'),
('Mexican Chicken Wrap','راب دجاج مكسيكي','Mexican Chicken Wrap'),
('Mango Mojito','موهيتو مانجو','Mango Mojito'),
('Chicken Wrap','راب دجاج','Chicken Wrap'),
('Alfredo Pasta','مكرونة ألفريدو','Alfredo Pasta'),
('Classic Mojito','موهيتو كلاسيك','Classic Mojito'),
('Potato Wedges','بطاطس ودجز','Potato Wedges'),
('Vegetables','خضروات','Vegetables'),
('Loaded Fries','بطاطس بالإضافات','Loaded Fries'),
('Chicken Sandwich','ساندوتش دجاج','Chicken Sandwich'),
('Four Cheese Pasta','مكرونة أربعة أجبان','Four Cheese Pasta'),
('Mango Juice','عصير مانجو','Mango Juice'),
('Banana Smoothie','سموذي موز','Banana Smoothie'),
('Mango Smoothie','سموذي مانجو','Mango Smoothie'),
('Chocolate Milkshake','ميلك شيك شوكولاتة','Chocolate Milkshake'),
('Blue Mojito','موهيتو بلو','Blue Mojito'),
('Mashed Potato','بطاطس مهروسة','Mashed Potato'),
('Cheesecake','تشيز كيك','Cheesecake'),
('Kunafa','كنافة','Kunafa'),
('Brownies','براونيز','Brownies'),
('Pizza Combo','وجبة بيتزا','Pizza Combo'),
('Turkey Sandwich','ساندوتش ديك رومي','Turkey Sandwich'),
('Ice Cream','آيس كريم','Ice Cream'),
('Rice','طبق أرز','Rice'),
('Chicken Strips','استربس دجاج','Chicken Strips'),
('Double Burger Combo','وجبة دبل برجر','Double Burger Combo'),
('Chicken Alfredo','مكرونة ألفريدو بالدجاج','Chicken Alfredo'),
('Tuna Sandwich','ساندوتش تونة','Tuna Sandwich'),
('Orange Juice','عصير برتقال','Orange Juice'),
('Strawberry Juice','عصير فراولة','Strawberry Juice'),
('Watermelon Juice','عصير بطيخ','Watermelon Juice'),
('Strawberry Smoothie','سموذي فراولة','Strawberry Smoothie'),
('Mixed Berries Smoothie','سموذي توت مشكل','Mixed Berries Smoothie'),
('Vanilla Milkshake','ميلك شيك فانيليا','Vanilla Milkshake'),
('Strawberry Milkshake','ميلك شيك فراولة','Strawberry Milkshake'),
('Oreo Milkshake','ميلك شيك أوريو','Oreo Milkshake'),
('Lotus Milkshake','ميلك شيك لوتس','Lotus Milkshake'),
('Strawberry Mojito','موهيتو فراولة','Strawberry Mojito'),
('Blueberry Mojito (موخيتو بلو بيري)','موهيتو توت أزرق','Blueberry Mojito'),
('Sunshine Mojito (موخيتو صن شاين)','موهيتو صن شاين','Sunshine Mojito'),
('Small Indomie (إندومي صغير)','إندومي صغير','Small Indomie'),
('Large Indomie (إندومي كبير)','إندومي كبير','Large Indomie'),
('Mango Milkshake (ميلك شيك مانجو)','ميلك شيك مانجو','Mango Milkshake'),
('Nutella Milkshake (ميلك شيك نوتيلا)','ميلك شيك نوتيلا','Nutella Milkshake'),
('Om Ali (أم علي)','أم علي','Om Ali'),
('Fruit Salad (فروت سلاط)','سلطة فواكه','Fruit Salad'),
('Fruit Platter (طبق فواكه)','طبق فواكه','Fruit Platter'),
('Vanilla Ice Cream (بولة فانيليا)','آيس كريم فانيليا','Vanilla Ice Cream'),
('Chocolate Ice Cream (بولة شوكليت)','آيس كريم شوكولاتة','Chocolate Ice Cream'),
('Pistachio Ice Cream (بولة بستاشيو)','آيس كريم فستق','Pistachio Ice Cream'),
('Strawberry Ice Cream (بولة فراولة)','آيس كريم فراولة','Strawberry Ice Cream'),
('Mango Ice Cream (بولة مانجو)','آيس كريم مانجو','Mango Ice Cream'),
('شيشة عادية','شيشة عادية','Classic Shisha'),
('شيشة فواكة','شيشة فواكة','Fruit Shisha'),
('بروست 2 قطعة','بروست 2 قطعة','Broasted Chicken — 2 Pieces'),
('بروست 3 قطع','بروست 3 قطع','Broasted Chicken — 3 Pieces'),
('بروست 4 قطع','بروست 4 قطع','Broasted Chicken — 4 Pieces'),
('بروست 6 قطع','بروست 6 قطع','Broasted Chicken — 6 Pieces'),
('بروست 9 قطع','بروست 9 قطع','Broasted Chicken — 9 Pieces'),
('فتة بروست','فتة بروست','Broasted Chicken Fatteh'),
('استربس 3 قطع','استربس 3 قطع','Chicken Strips — 3 Pieces'),
('وجبة وينجز','وجبة وينجز','Chicken Wings Meal'),
('تسوية البروست','تسوية البروست','Broasted Chicken Cooking Service'),
('كريب بانيه','كريب بانيه','Breaded Chicken Crepe'),
('كريب كرسبي','كريب كرسبي','Crispy Chicken Crepe'),
('كريب زنجر','كريب زنجر','Zinger Crepe'),
('كريب استربس','كريب استربس','Chicken Strips Crepe'),
('كريب شيش طاووق','كريب شيش طاووق','Shish Tawook Crepe'),
('كريب شاورما فراخ','كريب شاورما فراخ','Chicken Shawarma Crepe'),
('كريب فهيتا فراخ','كريب فهيتا فراخ','Chicken Fajita Crepe'),
('كريب برجر لحم','كريب برجر لحم','Beef Burger Crepe'),
('كريب سوسيس','كريب سوسيس','Hot Dog Crepe'),
('كريب سجق','كريب سجق','Sausage Crepe'),
('كريب بطاطس','كريب بطاطس','Potato Crepe'),
('برجر لحم بقري فرش','برجر لحم بقري فرش','Fresh Beef Burger'),
('تيستي بايت لحم بلدي','تيستي بايت لحم بلدي','Tasty Bite Local Beef'),
('برجر دجاج','برجر دجاج','Chicken Burger'),
('سندوتش زنجر','سندوتش زنجر','Zinger Sandwich'),
('أكبر ساندوتش مسحب في الفيوم','أكبر ساندوتش مسحب في الفيوم','Large Boneless Chicken Sandwich'),
('شاورما لحم بلدي سوري','شاورما لحم بلدي سوري','Syrian Local Beef Shawarma'),
('ماريا فراخ فريش','ماريا فراخ فريش','Fresh Chicken Maria'),
('ماريا لحم بلدي فريش','ماريا لحم بلدي فريش','Fresh Local Beef Maria'),
('ماريا فاهيتا','ماريا فاهيتا','Fajita Maria'),
('ماريا شاورما','ماريا شاورما','Shawarma Maria'),
('لحم بلدي','لحم بلدي','Local Beef'),
('ساندوتش سوري بطاطس','ساندوتش سوري بطاطس','Syrian Potato Sandwich'),
('البطاطس السوري بالجبنة','البطاطس السوري بالجبنة','Syrian Potato Sandwich with Cheese'),
('البطاطس السوري كرسبي','البطاطس السوري كرسبي','Syrian Crispy Potato Sandwich'),
('الكساديا لحمة','الكساديا لحمة','Beef Quesadilla'),
('الكساديا فراخ','الكساديا فراخ','Chicken Quesadilla'),
('أرز','أرز','Extra Rice'),
('شيدر','شيدر','Cheddar'),
('سبيدي','سبيدي','Speedy Sauce'),
('رانش','رانش','Ranch')) as t(old,ar,en) where i.name=t.old;
update public.catalog_categories c set name=t.ar,name_en=t.en
from (values ('Cold Drinks','مشروبات باردة','Cold Drinks'),
('Hot Drinks','مشروبات ساخنة','Hot Drinks'),
('Coffee','القهوة','Coffee'),
('Iced Coffee','قهوة مثلجة','Iced Coffee'),
('Soda Drinks','مشروبات غازية','Soda Drinks'),
('Mojitos','موهيتو','Mojitos'),
('Appetizers','مقبلات','Appetizers'),
('Sandwiches','الساندوتشات','Sandwiches'),
('Pasta','المكرونة','Pasta'),
('Fried Chicken','وجبات البروست','Fried Chicken'),
('Wraps','الراب','Wraps'),
('Desserts','الحلويات','Desserts'),
('Breakfast','الفطور','Breakfast'),
('Sides','أطباق جانبية','Sides'),
('Combos','الوجبات','Combos'),
('Fresh Juices','عصائر طازجة','Fresh Juices'),
('Milkshakes','ميلك شيك','Milkshakes'),
('Smoothies','سموذي','Smoothies'),
('Ice Cream','آيس كريم','Ice Cream'),
('Shesha','الشيشة','Shesha'),
('وجبات البروست','وجبات البروست','Fried & Broasted Chicken'),
('الكريبات','الكريبات','Crepes'),
('الساندوتشات','الساندوتشات','Sandwiches'),
('الإضافات','الإضافات','Extras')) as t(old,ar,en) where c.name=t.old;
update public.catalog_categories set name_en='Fried & Broasted Chicken' where name='وجبات البروست' and merged_into_id is null;
update public.catalog_items set category_id=(select id from public.catalog_categories where name='الشيشة' and merged_into_id is null) where name_en='Fruit Shisha';
insert into public.catalog_categories(name,name_en,sort_order) select 'النودلز','Noodles',250 where not exists(select 1 from public.catalog_categories where name='النودلز' and merged_into_id is null);
update public.catalog_items set category_id=(select id from public.catalog_categories where name='النودلز' and merged_into_id is null) where name_en in ('Small Indomie','Large Indomie');
-- Retire only exact duplicate dishes, retaining price guidance across their copies.
do $$ declare grp record; keeper uuid; begin
for grp in select name from public.catalog_items where merged_into_id is null group by name having count(*)>1 loop
select i.id into keeper from public.catalog_items i left join public.catalog_categories c on c.id=i.category_id where i.name=grp.name and i.merged_into_id is null
order by case when c.name in ('وجبات البروست','أطباق جانبية') then 0 else 1 end,i.created_at,i.id limit 1;
update public.catalog_items set price_min=(select min(coalesce(price_min,suggested_price)) from public.catalog_items where name=grp.name),price_max=(select max(coalesce(price_max,suggested_price)) from public.catalog_items where name=grp.name) where id=keeper;
update public.catalog_items set is_active=false,merged_into_id=keeper where name=grp.name and id<>keeper and merged_into_id is null;
end loop;
end $$;
update public.catalog_items i set variants=(select coalesce(jsonb_agg(v || jsonb_build_object('name',case v->>'name' when 'Single' then 'سنجل' when 'Double' then 'دبل' when 'Regular' then 'عادي' else v->>'name' end,'name_en',case v->>'name' when 'عادي' then 'Regular' when 'قص، معسل' then 'Classic tobacco' when 'فاخر، ميكس' then 'Premium mix' else v->>'name' end)),'[]') from jsonb_array_elements(i.variants) v) where jsonb_typeof(i.variants)='array';
create unique index catalog_categories_name_key on public.catalog_categories(lower(trim(name))) where merged_into_id is null;
create unique index catalog_items_active_name_key on public.catalog_items(lower(trim(name))) where is_active and merged_into_id is null;
drop policy "catalog_categories: read" on public.catalog_categories;
create policy "catalog_categories: read" on public.catalog_categories for select to authenticated using (is_active or merged_into_id is not null or public.is_admin());
drop policy "catalog: read" on public.catalog_items;
create policy "catalog: read" on public.catalog_items for select to authenticated using (public.is_admin() or merged_into_id is not null or (is_active and (category_id is null or exists(select 1 from public.catalog_categories c where c.id=category_id and c.is_active))));
create or replace function import_catalog_menu(p_restaurant uuid,p_picks jsonb,p_publish boolean default false,p_other_name text default 'Other') returns jsonb
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
   select ci.*,cc.name as section_name,cc.name_en as section_name_en,chosen.pick from catalog_items ci
   join (select distinct on (x->>'id') x as pick from jsonb_array_elements(p_picks) x order by x->>'id') chosen on (chosen.pick->>'id')::uuid=ci.id
   left join catalog_categories cc on cc.id=ci.category_id
   where ci.is_active and ci.merged_into_id is null and (ci.category_id is null or cc.is_active) order by ci.sort_order,ci.id
 loop
   available:=available+1;
   item_name:=left(trim(item.name),90);
   if item_name='' then raise exception 'Catalog dish name is missing'; end if;
   section_name:=left(coalesce(nullif(trim(item.section_name),''),nullif(trim(item.category_name),''),trim(p_other_name)),60);
   select * into existing from products where restaurant_id=p_restaurant and ((source_catalog_item_id=item.id or source_catalog_item_id in (select id from catalog_items where merged_into_id=item.id)) or lower(regexp_replace(trim(name),'\s+',' ','g'))in (lower(regexp_replace(item_name,'\s+',' ','g')),lower(regexp_replace(trim(item.name_en),'\s+',' ','g')))) order by (source_catalog_item_id=item.id) desc nulls last,created_at,id limit 1;
   -- Preserve an existing merchant assignment, name, prices and visibility.
   if found and existing.category_id is not null then
     if existing.source_catalog_item_id is null and exists(select 1 from categories where id=existing.category_id and restaurant_id=p_restaurant and ((source_catalog_category_id=item.category_id or source_catalog_category_id in (select id from catalog_categories where merged_into_id=item.category_id)) or lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(section_name,'\s+',' ','g')))) then update products set source_catalog_item_id=item.id where id=existing.id and restaurant_id=p_restaurant;end if;
     skipped:=skipped+1;continue;
   end if;
   section_name:=left(coalesce(nullif(trim(item.section_name),''),nullif(trim(item.category_name),''),trim(p_other_name)),60);
   section_key:=lower(regexp_replace(section_name,'\s+',' ','g'));
   select * into cat from categories where restaurant_id=p_restaurant and ((source_catalog_category_id=item.category_id or source_catalog_category_id in (select id from catalog_categories where merged_into_id=item.category_id)) or lower(regexp_replace(trim(name),'\s+',' ','g'))in (section_key,lower(regexp_replace(trim(item.section_name_en),'\s+',' ','g')))) order by (source_catalog_category_id=item.category_id) desc nulls last,is_active desc,created_at,id limit 1;
   if found then
     category_id_copy:=cat.id;
     if not cat.is_active and not cat.id=any(hidden) then hidden:=array_append(hidden,cat.id);end if;
     if cat.source_catalog_category_id is null and item.category_id is not null then update categories set source_catalog_category_id=item.category_id where id=cat.id and restaurant_id=p_restaurant;end if;
   else
     insert into categories(restaurant_id,name,name_en,sort_order,is_active,source_catalog_category_id) values(p_restaurant,section_name,left(item.section_name_en,60),category_order,true,item.category_id) returning id into category_id_copy;
     category_order:=category_order+1;sections:=sections+1;
   end if;
   if existing.id is not null then
     update products set category_id=category_id_copy,source_catalog_item_id=coalesce(source_catalog_item_id,item.id) where id=existing.id and restaurant_id=p_restaurant;
     repaired:=repaired+1;skipped:=skipped+1;continue;
   end if;
   price:=round(coalesce((item.pick->>'price')::numeric,item.suggested_price,0),2);
   image:=case when item.image_url ~ '^https://[^/]+/storage/v1/object/public/(menu-library|restaurant-assets)/' then item.image_url else null end;
   insert into products(restaurant_id,category_id,name,name_en,description,ingredients,image_url,image_source,sort_order,is_active,source_catalog_item_id)
   values(p_restaurant,category_id_copy,item_name,left(item.name_en,90),left(item.description,400),left(item.ingredients,300),image,case when image is null then 'none' else 'library' end,product_order,coalesce(p_publish,false) and price>0,item.id) returning id into product_id_copy;
   product_order:=product_order+1;added:=added+1;size_order:=0;
   base_hint:=case when jsonb_typeof(item.variants->0->'price')='number' then greatest(0,(item.variants->0->>'price')::numeric) else 0 end;
   for variant in select value from jsonb_array_elements(case when jsonb_typeof(item.variants)='array' then item.variants else '[]'::jsonb end) limit 8 loop
     variant_name:=left(coalesce(nullif(trim(variant->>'name'),''),'Regular'),40);
     variant_price:=price+greatest(0,(case when jsonb_typeof(variant->'price')='number' then greatest(0,(variant->>'price')::numeric) else 0 end)-base_hint);
     insert into product_variants(restaurant_id,product_id,name,name_en,price,sort_order,is_active) values(p_restaurant,product_id_copy,variant_name,left(variant->>'name_en',40),round(variant_price,2),size_order,true);
     size_order:=size_order+1;
   end loop;
   if size_order=0 then insert into product_variants(restaurant_id,product_id,name,name_en,price,sort_order,is_active) values(p_restaurant,product_id_copy,'عادي','Regular',price,0,true);end if;
 end loop;
 if available=0 then raise exception 'Those dishes are no longer available'; end if;
 return jsonb_build_object('added',added,'skipped',skipped,'sections',sections,'repaired',repaired,'hiddenSections',cardinality(hidden));
end $$;
revoke all on function import_catalog_menu(uuid,jsonb,boolean,text) from public,anon;
grant execute on function import_catalog_menu(uuid,jsonb,boolean,text) to authenticated;

commit;
