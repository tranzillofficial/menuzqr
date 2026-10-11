-- Existing products remain unchanged; null means no barcode assigned.
alter table public.products add column barcode text;
alter table public.products add constraint products_barcode_format
  check (barcode is null or barcode ~ '^[!-~]{1,128}$');
create unique index products_restaurant_barcode_unique
  on public.products (restaurant_id, barcode) where barcode is not null;
comment on column public.products.barcode is 'Optional case-sensitive retail barcode. Preserve leading zeroes. Unique per business, not globally.';
-- Existing product RLS policies continue to control reads and writes.
