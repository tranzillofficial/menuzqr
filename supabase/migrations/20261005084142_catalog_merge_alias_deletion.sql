begin;
alter table public.catalog_items drop constraint catalog_items_merged_into_id_fkey, add constraint catalog_items_merged_into_id_fkey foreign key(merged_into_id) references public.catalog_items(id) on delete cascade;
alter table public.catalog_categories drop constraint catalog_categories_merged_into_id_fkey, add constraint catalog_categories_merged_into_id_fkey foreign key(merged_into_id) references public.catalog_categories(id) on delete cascade;
commit;
