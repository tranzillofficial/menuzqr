-- Additive staging only. No existing restaurant, price, product or food catalog is changed.
begin;
create table public.supermarket_catalog_products (
 id uuid primary key,
 external_id text not null unique,
 name_ar text not null,
 brand text,
 category text not null check(category in ('bakery','beverages','dairy_and_cheese','detergents_and_household','food_products','frozen_and_meat','fruits_and_vegetables','personal_care','snacks_and_chocolate')),
 size numeric,
 size_unit text,
 barcode_candidate text,
 barcode text,
 barcode_verified boolean not null default false,
 source_data jsonb not null,
 review_reasons text[] not null default '{}',
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 updated_at timestamptz not null default now(),
 check (barcode is null or barcode_verified)
);
create index supermarket_catalog_barcode_idx on public.supermarket_catalog_products(barcode) where barcode_verified and review_status='approved';
create index supermarket_catalog_category_idx on public.supermarket_catalog_products(category,id) where review_status='approved';
create table public.supermarket_catalog_images (
 id uuid primary key,
 product_id uuid not null references public.supermarket_catalog_products(id),
 file_id text not null,
 url text not null check(url like 'https://%'),
 file_path text not null,
 rights_status text not null default 'pending' check(rights_status in ('pending','approved','rejected')),
 source_data jsonb not null,
 unique(product_id,file_id)
);
alter table public.supermarket_catalog_products enable row level security;
alter table public.supermarket_catalog_images enable row level security;
revoke all on public.supermarket_catalog_products,public.supermarket_catalog_images from anon,authenticated;
grant select on public.supermarket_catalog_products,public.supermarket_catalog_images to authenticated;
grant all on public.supermarket_catalog_products,public.supermarket_catalog_images to service_role;
create policy supermarket_products_read on public.supermarket_catalog_products for select to authenticated using(review_status='approved');
create policy supermarket_images_read on public.supermarket_catalog_images for select to authenticated using(rights_status='approved' and exists(select 1 from public.supermarket_catalog_products p where p.id=product_id and p.review_status='approved'));
comment on table public.supermarket_catalog_products is 'Shared source catalog, no merchant prices or inventory. Import starts pending; review before publication.';
commit;
