alter table public.catalog_categories
  add column business_types text[] not null default array['restaurant','cafe'];
alter table public.catalog_categories add constraint catalog_categories_business_types_check
  check (cardinality(business_types)>0 and array_position(business_types,null) is null
    and business_types <@ array['restaurant','cafe','supermarket','sweets','retail']::text[]);

update public.catalog_categories set business_types=case
  when name='الشيشة' then array['cafe']
  when name='مشروبات غازية' then array['cafe','restaurant','supermarket','retail']
  when name in ('الحلويات','آيس كريم') then array['cafe','restaurant','sweets']
  when name in ('وجبات البروست','المكرونة','الراب','الوجبات','النودلز') then array['restaurant']
  else array['cafe','restaurant'] end
where merged_into_id is null;

insert into public.catalog_categories(name,name_en,business_types,sort_order)
select 'أعشاب','Herbal drinks',array['cafe','restaurant'],24
where not exists(select 1 from public.catalog_categories where name='أعشاب' and merged_into_id is null);
