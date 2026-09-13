-- =====================================================================
--  MenuzQR — upgrade 002
--
--  Run this ONCE in the Supabase SQL Editor, after schema.sql.
--  It is idempotent. Adds:
--    1. Short, human-friendly table codes (replaces tbl_<hex>)
--    2. qr_templates  — QR label designs an admin can manage
--    3. catalog_items — the shared "smart menu" an admin fills in
--    4. A storage-bucket check you can run any time
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SHORT TABLE CODES
--
--    The old token (tbl_8ff074d4d000c562e7) is not a database id — it was
--    always a random value — but it is long and looks technical on a URL.
--    This replaces it with an 8-character code from an unambiguous
--    alphabet (no 0/O/1/I), e.g. /cairo/menu?t=K7F2QX9M
--
--    It stays random on purpose. A plain table number would let anyone
--    order food or call a waiter for any table just by editing the URL.
-- ---------------------------------------------------------------------
create or replace function public.short_code(len int default 8)
returns text
language plpgsql
volatile
set search_path = extensions, public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes    bytea;
  result   text := '';
  i        int;
begin
  bytes := gen_random_bytes(len);
  for i in 1..len loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, i - 1) % length(alphabet)), 1);
  end loop;
  return result;
end;
$$;

create or replace function public.set_table_token()
returns trigger
language plpgsql
-- SECURITY DEFINER so the collision check can see every restaurant's tokens.
-- Under RLS an invoker only sees its own rows, which would make the check —
-- and the retry loop below it — silently useless.
security definer
set search_path = public
as $$
declare
  candidate text;
  tries     int := 0;
begin
  if new.qr_token is null or new.qr_token = '' then
    loop
      candidate := public.short_code(8);
      exit when not exists (
        select 1 from public.restaurant_tables t where t.qr_token = candidate
      );
      tries := tries + 1;
      if tries > 20 then
        candidate := public.short_code(12);
        exit;
      end if;
    end loop;
    new.qr_token := candidate;
  end if;
  return new;
end;
$$;

-- Re-issue the long tokens created before this upgrade.
-- Any QR code already printed with an old token stops working, so only run
-- this while you are still testing. Comment it out once you are live.
update public.restaurant_tables
   set qr_token = public.short_code(8)
 where qr_token like 'tbl\_%';

-- ---------------------------------------------------------------------
-- 2. QR LABEL TEMPLATES
--    Three built-in layouts; an admin can add more colour/wording presets.
-- ---------------------------------------------------------------------
create table if not exists public.qr_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  layout       text not null default 'counter'
                 check (layout in ('counter', 'square', 'tent')),
  scope        text not null default 'both'
                 check (scope in ('general', 'table', 'both')),
  bg_color     text not null default '#1c1917',
  panel_color  text not null default '#ffffff',
  accent_color text not null default '#ea580c',
  text_color   text not null default '#ffffff',
  qr_color     text not null default '#1c1917',
  headline     text,
  cta_text     text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.qr_templates enable row level security;

drop policy if exists "qr_templates: read" on public.qr_templates;
drop policy if exists "qr_templates: admin writes" on public.qr_templates;

create policy "qr_templates: read" on public.qr_templates
  for select to authenticated
  using (is_active or public.is_admin());

create policy "qr_templates: admin writes" on public.qr_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A name is the natural key here, and without it the seed below would insert a
-- fresh copy of all three designs on every run.
create unique index if not exists qr_templates_name_key on public.qr_templates (name);

insert into public.qr_templates
  (name, layout, scope, bg_color, panel_color, accent_color, text_color, qr_color, headline, cta_text, sort_order)
values
  ('Counter Card',  'counter', 'general', '#1c1917', '#ffffff', '#ea580c', '#ffffff', '#1c1917', 'Scan for our menu', 'Point your camera at the code',  0),
  ('Clean Square',  'square',  'general', '#faf7f2', '#ffffff', '#9a3412', '#2b2520', '#2b2520', 'Our menu',          'Scan to view',                  10),
  ('Table Tent',    'tent',    'table',   '#0f172a', '#ffffff', '#f97316', '#ffffff', '#0f172a', 'Scan to order',     'Order from your table',         20)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 3. SHARED PRODUCT CATALOG ("smart menu")
--
--    An admin fills this once. When a restaurant owner starts typing a
--    product name, matching entries are offered and one tap fills in the
--    description, ingredients, image, suggested section and sizes — which
--    the owner can still edit before saving.
-- ---------------------------------------------------------------------
create table if not exists public.catalog_items (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  ingredients    text,
  category_name  text,
  image_url      text,
  -- [{ "name": "Medium", "price": 0 }, ...] — prices are only a hint.
  variants       jsonb not null default '[]'::jsonb,
  keywords       text[] not null default '{}',
  cuisine        text,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists catalog_items_name_idx on public.catalog_items (lower(name));
create index if not exists catalog_items_keywords_idx on public.catalog_items using gin (keywords);

drop trigger if exists touch_updated_at_trigger on public.catalog_items;
create trigger touch_updated_at_trigger
  before update on public.catalog_items
  for each row execute function public.touch_updated_at();

alter table public.catalog_items enable row level security;

drop policy if exists "catalog: read" on public.catalog_items;
drop policy if exists "catalog: admin writes" on public.catalog_items;

create policy "catalog: read" on public.catalog_items
  for select to authenticated
  using (is_active or public.is_admin());

create policy "catalog: admin writes" on public.catalog_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. STORAGE BUCKETS — make sure both exist and are configured
--    (safe to run any time; it repairs the settings if they drifted)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('restaurant-assets', 'restaurant-assets', true, 4194304,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('menu-library', 'menu-library', true, 4194304,
   array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Verify: both rows must come back, `public` must be true.
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id in ('restaurant-assets', 'menu-library');

-- And the object policies that go with them:
select policyname, cmd
  from pg_policies
 where schemaname = 'storage'
   and tablename = 'objects'
 order by policyname;
