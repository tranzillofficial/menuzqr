-- =====================================================================
-- MenuzQR — upgrade 007
-- Phase 1 of the shared menu: 13 sections, 84 dishes.
--
-- Names and price guidance only. Photos are deliberately left empty — the
-- admin adds those by hand from /admin/catalog.
--
-- The prices are a STARTING POINT, not a default. Every restaurant sets its
-- own price at import; these only save the owner from typing into an empty
-- box. They are rough Egyptian café/restaurant figures and will drift, so
-- treat them as editable data, not as truth.
--
-- Run AFTER 006. Safe to run more than once: nothing is inserted twice, and
-- editing or deleting a dish afterwards will not bring it back.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PRICE GUIDANCE ON A CATALOG ITEM
-- ---------------------------------------------------------------------
alter table public.catalog_items
  add column if not exists suggested_price    numeric(10, 2),
  add column if not exists price_min          numeric(10, 2),
  add column if not exists price_max          numeric(10, 2),
  add column if not exists suggested_currency text not null default 'EGP';

comment on column public.catalog_items.suggested_price is
  'A starting figure shown at import. Never applied on its own — the owner types their own price.';

-- ---------------------------------------------------------------------
-- 2. SECTIONS
--
--    Appended after whatever already exists, so the sections you built by
--    hand (Hot Drinks, Coffee, Pizza, Burgers…) keep their order and are
--    not touched.
-- ---------------------------------------------------------------------
with sections (name, ord) as (
  values
    ('Fresh Juices', 1),
    ('Smoothies', 2),
    ('Milkshakes', 3),
    ('Mojitos', 4),
    ('Appetizers', 5),
    ('Sandwiches', 6),
    ('Pasta', 7),
    ('Fried Chicken', 8),
    ('Wraps', 9),
    ('Desserts', 10),
    ('Breakfast', 11),
    ('Sides', 12),
    ('Combos', 13)
)
insert into public.catalog_categories (name, sort_order)
select s.name,
       (select coalesce(max(c.sort_order), 0) from public.catalog_categories c) + s.ord
from sections s
where not exists (
  select 1 from public.catalog_categories c
  where lower(trim(c.name)) = lower(trim(s.name))
);

-- ---------------------------------------------------------------------
-- 3. DISHES
--
--    Matched to their section by name, so this works whether the section
--    was just created above or already existed.
-- ---------------------------------------------------------------------
with items (section, name, suggested, price_min, price_max, keywords, ord) as (
  values
    ('Fresh Juices', 'Orange Juice', 60, 40, 90, 'juice,orange,fresh,عصير,برتقال', 1),
    ('Fresh Juices', 'Mango Juice', 70, 50, 110, 'juice,mango,fresh,عصير,مانجو', 2),
    ('Fresh Juices', 'Strawberry Juice', 70, 50, 110, 'juice,strawberry,عصير,فراولة', 3),
    ('Fresh Juices', 'Lemon Juice', 45, 30, 70, 'juice,lemon,عصير,ليمون', 4),
    ('Fresh Juices', 'Lemon Mint', 55, 35, 85, 'juice,lemon,mint,ليمون,نعناع', 5),
    ('Fresh Juices', 'Guava Juice', 65, 45, 100, 'juice,guava,عصير,جوافة', 6),
    ('Fresh Juices', 'Watermelon Juice', 55, 35, 85, 'juice,watermelon,عصير,بطيخ', 7),
    ('Fresh Juices', 'Cocktail Juice', 85, 60, 130, 'juice,cocktail,mixed,عصير,كوكتيل', 8),
    ('Smoothies', 'Strawberry Smoothie', 85, 60, 130, 'smoothie,strawberry,سموذي,فراولة', 1),
    ('Smoothies', 'Mango Smoothie', 90, 65, 140, 'smoothie,mango,سموذي,مانجو', 2),
    ('Smoothies', 'Banana Smoothie', 80, 55, 120, 'smoothie,banana,سموذي,موز', 3),
    ('Smoothies', 'Mixed Berries Smoothie', 95, 70, 150, 'smoothie,berries,سموذي,توت', 4),
    ('Smoothies', 'Mango Banana Smoothie', 90, 65, 140, 'smoothie,mango,banana,سموذي,مانجو,موز', 5),
    ('Milkshakes', 'Chocolate Milkshake', 90, 65, 140, 'milkshake,chocolate,ميلك شيك,شوكولاتة', 1),
    ('Milkshakes', 'Vanilla Milkshake', 85, 60, 130, 'milkshake,vanilla,ميلك شيك,فانيليا', 2),
    ('Milkshakes', 'Strawberry Milkshake', 90, 65, 140, 'milkshake,strawberry,ميلك شيك,فراولة', 3),
    ('Milkshakes', 'Oreo Milkshake', 105, 75, 160, 'milkshake,oreo,ميلك شيك,أوريو', 4),
    ('Milkshakes', 'Lotus Milkshake', 110, 80, 170, 'milkshake,lotus,ميلك شيك,لوتس', 5),
    ('Milkshakes', 'Caramel Milkshake', 95, 70, 150, 'milkshake,caramel,ميلك شيك,كراميل', 6),
    ('Mojitos', 'Classic Mojito', 70, 50, 110, 'mojito,classic,موهيتو,كلاسيك', 1),
    ('Mojitos', 'Blue Mojito', 75, 55, 115, 'mojito,blue,موهيتو,أزرق', 2),
    ('Mojitos', 'Strawberry Mojito', 80, 55, 120, 'mojito,strawberry,موهيتو,فراولة', 3),
    ('Mojitos', 'Passion Fruit Mojito', 85, 60, 130, 'mojito,passion,موهيتو,باشون', 4),
    ('Mojitos', 'Mango Mojito', 80, 55, 120, 'mojito,mango,موهيتو,مانجو', 5),
    ('Mojitos', 'Lemon Mint Mojito', 70, 50, 110, 'mojito,lemon,mint,موهيتو,ليمون,نعناع', 6),
    ('Appetizers', 'French Fries', 55, 35, 85, 'fries,potato,بطاطس,مقبلات', 1),
    ('Appetizers', 'Cheese Fries', 80, 55, 120, 'fries,cheese,بطاطس,جبنة', 2),
    ('Appetizers', 'Loaded Fries', 110, 75, 170, 'fries,loaded,بطاطس,لودد', 3),
    ('Appetizers', 'Chicken Wings', 120, 85, 190, 'wings,chicken,أجنحة,فراخ', 4),
    ('Appetizers', 'Mozzarella Sticks', 110, 75, 170, 'mozzarella,cheese,موتزاريلا,جبنة', 5),
    ('Appetizers', 'Onion Rings', 70, 50, 110, 'onion,rings,بصل', 6),
    ('Appetizers', 'Chicken Strips', 120, 85, 190, 'chicken,strips,فراخ,ستربس', 7),
    ('Appetizers', 'Nachos', 110, 75, 170, 'nachos,ناتشوز', 8),
    ('Sandwiches', 'Chicken Sandwich', 120, 85, 190, 'sandwich,chicken,ساندويتش,فراخ', 1),
    ('Sandwiches', 'Crispy Chicken Sandwich', 135, 95, 210, 'sandwich,crispy,chicken,ساندويتش,كريسبي', 2),
    ('Sandwiches', 'Beef Sandwich', 150, 105, 240, 'sandwich,beef,ساندويتش,لحمة', 3),
    ('Sandwiches', 'Steak Sandwich', 180, 130, 290, 'sandwich,steak,ساندويتش,ستيك', 4),
    ('Sandwiches', 'Club Sandwich', 150, 105, 240, 'sandwich,club,ساندويتش,كلوب', 5),
    ('Sandwiches', 'Tuna Sandwich', 120, 85, 190, 'sandwich,tuna,ساندويتش,تونة', 6),
    ('Sandwiches', 'Turkey Sandwich', 140, 100, 220, 'sandwich,turkey,ساندويتش,تركي', 7),
    ('Pasta', 'Alfredo Pasta', 160, 110, 250, 'pasta,alfredo,مكرونة,ألفريدو', 1),
    ('Pasta', 'Chicken Alfredo', 180, 130, 280, 'pasta,alfredo,chicken,مكرونة,فراخ', 2),
    ('Pasta', 'Penne Arrabbiata', 150, 105, 240, 'pasta,penne,arrabbiata,مكرونة,بيني', 3),
    ('Pasta', 'Bolognese Pasta', 175, 125, 270, 'pasta,bolognese,مكرونة,بولونيز', 4),
    ('Pasta', 'Seafood Pasta', 230, 160, 360, 'pasta,seafood,مكرونة,سيفود', 5),
    ('Pasta', 'Four Cheese Pasta', 185, 130, 290, 'pasta,cheese,مكرونة,جبن', 6),
    ('Pasta', 'Pesto Pasta', 175, 125, 270, 'pasta,pesto,مكرونة,بيستو', 7),
    ('Fried Chicken', 'Fried Chicken Pieces', 150, 105, 240, 'chicken,fried,فراخ,مقلي', 1),
    ('Fried Chicken', 'Chicken Bucket', 320, 220, 520, 'chicken,bucket,فراخ,باكت', 2),
    ('Fried Chicken', 'Chicken Tenders', 140, 100, 220, 'chicken,tenders,فراخ,تندرز', 3),
    ('Fried Chicken', 'Chicken Strips', 140, 100, 220, 'chicken,strips,فراخ,ستربس', 4),
    ('Fried Chicken', 'Spicy Chicken', 160, 110, 250, 'chicken,spicy,فراخ,حار', 5),
    ('Fried Chicken', 'Chicken Wings', 130, 90, 200, 'chicken,wings,فراخ,أجنحة', 6),
    ('Wraps', 'Chicken Wrap', 120, 85, 190, 'wrap,chicken,راب,فراخ', 1),
    ('Wraps', 'Crispy Chicken Wrap', 135, 95, 210, 'wrap,crispy,chicken,راب,كريسبي', 2),
    ('Wraps', 'Beef Wrap', 150, 105, 240, 'wrap,beef,راب,لحمة', 3),
    ('Wraps', 'Shawarma Wrap', 120, 85, 190, 'wrap,shawarma,راب,شاورما', 4),
    ('Wraps', 'Mexican Chicken Wrap', 140, 100, 220, 'wrap,mexican,chicken,راب,مكسيكي', 5),
    ('Desserts', 'Chocolate Cake', 95, 65, 150, 'dessert,cake,chocolate,حلو,شوكولاتة', 1),
    ('Desserts', 'Cheesecake', 110, 75, 170, 'dessert,cheesecake,حلو,تشيز كيك', 2),
    ('Desserts', 'Brownies', 90, 60, 140, 'dessert,brownies,حلو,براونيز', 3),
    ('Desserts', 'Tiramisu', 115, 80, 180, 'dessert,tiramisu,حلو,تيراميسو', 4),
    ('Desserts', 'Molten Cake', 105, 75, 165, 'dessert,molten,حلو,مولتن', 5),
    ('Desserts', 'Ice Cream', 70, 45, 110, 'dessert,ice cream,حلو,آيس كريم', 6),
    ('Desserts', 'Kunafa', 100, 70, 160, 'dessert,kunafa,حلو,كنافة', 7),
    ('Breakfast', 'Omelette', 90, 60, 140, 'breakfast,omelette,eggs,فطار,أومليت', 1),
    ('Breakfast', 'Scrambled Eggs', 85, 55, 130, 'breakfast,eggs,فطار,بيض', 2),
    ('Breakfast', 'Fried Eggs', 70, 45, 110, 'breakfast,eggs,فطار,بيض', 3),
    ('Breakfast', 'English Breakfast', 180, 130, 290, 'breakfast,english,فطار,إنجليزي', 4),
    ('Breakfast', 'Pancakes', 110, 75, 170, 'breakfast,pancakes,فطار,بان كيك', 5),
    ('Breakfast', 'French Toast', 110, 75, 170, 'breakfast,french toast,فطار,توست', 6),
    ('Breakfast', 'Croissant Sandwich', 105, 70, 165, 'breakfast,croissant,فطار,كرواسون', 7),
    ('Sides', 'French Fries', 55, 35, 85, 'side,fries,بطاطس,جانبي', 1),
    ('Sides', 'Curly Fries', 70, 45, 110, 'side,curly,fries,بطاطس', 2),
    ('Sides', 'Potato Wedges', 70, 45, 110, 'side,wedges,potato,بطاطس', 3),
    ('Sides', 'Mashed Potato', 60, 40, 95, 'side,mashed,potato,بطاطس,بيوريه', 4),
    ('Sides', 'Rice', 45, 30, 75, 'side,rice,أرز', 5),
    ('Sides', 'Vegetables', 55, 35, 90, 'side,vegetables,خضار', 6),
    ('Combos', 'Burger Combo', 220, 150, 350, 'combo,burger,وجبة,برجر', 1),
    ('Combos', 'Double Burger Combo', 280, 190, 440, 'combo,burger,double,وجبة,دوبل', 2),
    ('Combos', 'Chicken Combo', 230, 160, 360, 'combo,chicken,وجبة,فراخ', 3),
    ('Combos', 'Pizza Combo', 260, 180, 410, 'combo,pizza,وجبة,بيتزا', 4),
    ('Combos', 'Family Meal', 650, 450, 990, 'combo,family,وجبة,عائلية', 5),
    ('Combos', 'Friends Meal', 480, 330, 750, 'combo,friends,وجبة,أصحاب', 6)
)
insert into public.catalog_items
  (category_id, name, suggested_price, price_min, price_max,
   suggested_currency, keywords, sort_order, variants, is_active)
select c.id,
       i.name,
       i.suggested::numeric,
       i.price_min::numeric,
       i.price_max::numeric,
       'EGP',
       string_to_array(i.keywords, ','),
       i.ord,
       '[]'::jsonb,
       true
from items i
join public.catalog_categories c
  on lower(trim(c.name)) = lower(trim(i.section))
-- Scoped to the section, not to the name alone. The list repeats a few
-- dishes on purpose — fries belong in Appetizers *and* in Sides, wings in
-- Appetizers *and* in Fried Chicken — and a restaurant picks whichever
-- section suits its menu. Re-running still inserts nothing.
where not exists (
  select 1 from public.catalog_items x
  where lower(trim(x.name)) = lower(trim(i.name))
    and x.category_id = c.id
);

-- ---------------------------------------------------------------------
-- 4. VERIFICATION
-- ---------------------------------------------------------------------

-- 4.1 Every section and how many dishes it holds.
select c.sort_order, c.name, count(i.id) as dishes
from public.catalog_categories c
left join public.catalog_items i on i.category_id = c.id
group by c.id
order by c.sort_order, c.name;

-- 4.2 Dishes that appear in more than one section. A few are deliberate
--     (fries, wings, strips); anything else here is worth a look.
select i.name, count(*) as sections, string_agg(c.name, ', ' order by c.name) as in_sections
from public.catalog_items i
join public.catalog_categories c on c.id = i.category_id
group by i.name having count(*) > 1
order by i.name;

-- 4.3 Dishes still without a photo — your to-do list for /admin/catalog.
--     Expect all 84 of the new ones at first.
select c.name as section, i.name as dish, i.suggested_price
from public.catalog_items i
left join public.catalog_categories c on c.id = i.category_id
where i.image_url is null
order by c.sort_order, i.sort_order;
