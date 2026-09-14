-- =====================================================================
--  MenuzQR — complete database schema
--  Run this ONCE in a fresh Supabase project:
--    Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
--  It is idempotent: safe to re-run after edits.
--
--  ONE CAVEAT: this file recreates `guard_restaurant_admin_columns`, and
--  006-plans-and-coupons.sql replaces that same function with a version that
--  also pins the pos_* columns. If you ever re-run this file on a database
--  that already has 006, re-run 006 afterwards — otherwise owners regain the
--  ability to write their own POS subscription state.
--
--  Contents
--    1.  Extensions & helper functions
--    2.  Tables
--    3.  Triggers (profiles, slugs, tokens, order numbers, guards)
--    4.  Indexes
--    5.  Row Level Security policies
--    6.  Storage buckets & policies
--    7.  Realtime publication
--    8.  Image library (populated from the admin dashboard)
--    9.  How to make yourself an admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS & HELPERS
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.random_token(prefix text, bytes int default 9)
returns text
language sql
volatile
-- pgcrypto lives in `extensions` on Supabase but in `public` elsewhere.
set search_path = extensions, public
as $$
  select prefix || encode(gen_random_bytes(bytes), 'hex');
$$;

-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------

-- 2.1 profiles ---------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.2 restaurants ------------------------------------------------------
create table if not exists public.restaurants (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users (id) on delete cascade,
  name                   text not null check (char_length(trim(name)) between 2 and 80),
  slug                   text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'),
  description            text,
  logo_url               text,
  cover_url              text,
  phone                  text,
  address                text,
  currency               text not null default 'USD',
  language               text not null default 'en',
  restaurant_type        text,
  menu_theme             text not null default 'elegant'
                           check (menu_theme in ('elegant', 'modern', 'minimal')),
  ordering_enabled       boolean not null default true,
  waiter_calls_enabled   boolean not null default true,

  -- activation / subscription (admin controlled)
  status                 text not null default 'inactive'
                           check (status in ('inactive', 'active', 'suspended')),
  activated_at           timestamptz,
  activation_expires_at  timestamptz,          -- future-proofing, unused today
  payment_method         text,                 -- 'whatsapp_manual' today
  payment_status         text not null default 'unpaid'
                           check (payment_status in ('unpaid', 'paid', 'refunded')),
  subscription_type      text not null default 'one_time'
                           check (subscription_type in ('one_time', 'monthly', 'yearly')),
  price_cents            integer not null default 2000,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists restaurants_slug_key on public.restaurants (lower(slug));

-- 2.3 restaurant_members (multi-restaurant / multi-user ready) ----------
create table if not exists public.restaurant_members (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  created_at     timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

-- 2.4 restaurant_settings (1:1 extras) ---------------------------------
create table if not exists public.restaurant_settings (
  restaurant_id      uuid primary key references public.restaurants (id) on delete cascade,
  sound_enabled      boolean not null default true,
  show_prices        boolean not null default true,
  show_ingredients   boolean not null default true,
  accent_color       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 2.5 categories -------------------------------------------------------
create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 60),
  description    text,
  image_url      text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2.6 products ---------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  category_id    uuid references public.categories (id) on delete set null,
  name           text not null check (char_length(trim(name)) between 1 and 90),
  description    text,
  ingredients    text,
  image_url      text,
  image_source   text not null default 'none'
                   check (image_source in ('none', 'uploaded', 'library')),
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2.7 product_variants (sizes / options — this is where price lives) ----
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 40),
  price          numeric(10, 2) not null default 0 check (price >= 0),
  image_url      text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 2.8 restaurant_tables ------------------------------------------------
create table if not exists public.restaurant_tables (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  label          text not null check (char_length(trim(label)) between 1 and 40),
  qr_token       text not null unique,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 2.9 orders -----------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  table_id       uuid references public.restaurant_tables (id) on delete set null,
  order_number   integer not null default 0,
  public_token   text not null unique,
  session_id     text,
  status         text not null default 'pending'
                   check (status in ('pending', 'accepted', 'preparing',
                                     'ready', 'completed', 'cancelled')),
  note           text,
  total          numeric(10, 2) not null default 0,
  currency       text not null default 'USD',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2.10 order_items -----------------------------------------------------
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  variant_id     uuid references public.product_variants (id) on delete set null,
  product_name   text not null,
  variant_name   text,
  unit_price     numeric(10, 2) not null default 0,
  quantity       integer not null default 1 check (quantity between 1 and 99),
  note           text,
  line_total     numeric(10, 2) not null default 0,
  created_at     timestamptz not null default now()
);

-- 2.11 waiter_requests -------------------------------------------------
create table if not exists public.waiter_requests (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  table_id       uuid not null references public.restaurant_tables (id) on delete cascade,
  status         text not null default 'pending'
                   check (status in ('pending', 'handled', 'cancelled')),
  created_at     timestamptz not null default now(),
  handled_at     timestamptz,
  handled_by     uuid references auth.users (id) on delete set null
);

-- 2.12 admin_actions (audit trail) -------------------------------------
create table if not exists public.admin_actions (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid references public.restaurants (id) on delete set null,
  admin_id       uuid references auth.users (id) on delete set null,
  action         text not null,
  notes          text,
  created_at     timestamptz not null default now()
);

-- 2.13 menu_images (shared library, filled from /admin/library) ---------
create table if not exists public.menu_images (
  id           uuid primary key default gen_random_uuid(),
  group_name   text not null,
  category     text not null,
  title        text not null,
  keywords     text[] not null default '{}',
  url          text not null,
  attribution  text,
  license      text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create unique index if not exists menu_images_url_key on public.menu_images (url);

-- ---------------------------------------------------------------------
-- 2.14 ACCESS HELPERS
--
--     Defined here, after the tables, on purpose: a `language sql` function
--     body is parsed and validated when the function is created, so it cannot
--     reference a table that does not exist yet. They are SECURITY DEFINER so
--     they can read profiles/restaurant_members without tripping the very RLS
--     policies that call them.
-- ---------------------------------------------------------------------
-- Is the caller a platform admin?  SECURITY DEFINER so it can read
-- public.profiles without tripping that table's own RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Does the caller belong to this restaurant?
create or replace function public.owns_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = rid
      and m.user_id = auth.uid()
  );
$$;

-- Does the caller have write rights (owner or manager) on this restaurant?
create or replace function public.can_manage_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = rid
      and m.user_id = auth.uid()
      and m.role in ('owner', 'manager')
  );
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- 3.1 create a profile row for every new auth user ---------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3.2 a restaurant's creator automatically becomes its owner-member ----
create or replace function public.handle_new_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (restaurant_id, user_id) do nothing;

  insert into public.restaurant_settings (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_restaurant_created on public.restaurants;
create trigger on_restaurant_created
  after insert on public.restaurants
  for each row execute function public.handle_new_restaurant();

-- 3.3 only admins may set activation / billing columns -----------------
--     Runs on INSERT *and* UPDATE. Without the INSERT branch a user could
--     simply insert a row with status='active' and publish their menu
--     without paying.
create or replace function public.guard_restaurant_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted callers may set anything:
  --   * a platform admin acting through the app,
  --   * service_role (our server actions),
  --   * a direct database connection — the SQL editor, a migration, psql —
  --     which carries no end-user JWT, so auth.uid() is null. RLS already
  --     decides who can reach this table at all, and `anon`/`authenticated`
  --     always have a uid, so this cannot be reached from the browser.
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status                := 'inactive';
    new.activated_at          := null;
    new.activation_expires_at := null;
    new.payment_method        := null;
    new.payment_status        := 'unpaid';
    new.subscription_type     := 'one_time';
    new.price_cents           := 2000;
    new.owner_id              := coalesce(auth.uid(), new.owner_id);
    return new;
  end if;

  new.status                := old.status;
  new.activated_at          := old.activated_at;
  new.activation_expires_at := old.activation_expires_at;
  new.payment_method        := old.payment_method;
  new.payment_status        := old.payment_status;
  new.subscription_type     := old.subscription_type;
  new.price_cents           := old.price_cents;
  new.owner_id              := old.owner_id;
  return new;
end;
$$;

drop trigger if exists guard_restaurant_columns on public.restaurants;
create trigger guard_restaurant_columns
  before update on public.restaurants
  for each row execute function public.guard_restaurant_admin_columns();

drop trigger if exists guard_restaurant_columns_insert on public.restaurants;
create trigger guard_restaurant_columns_insert
  before insert on public.restaurants
  for each row execute function public.guard_restaurant_admin_columns();

-- 3.4 nobody may promote themselves to admin ---------------------------
create or replace function public.guard_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Same trust rule as the restaurant guard. The `auth.uid() is null` branch
  -- is what lets you bootstrap the very first admin from the SQL editor —
  -- without it, nobody could ever become an admin.
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  new.is_admin := old.is_admin;
  return new;
end;
$$;

drop trigger if exists guard_profile_admin on public.profiles;
create trigger guard_profile_admin
  before update on public.profiles
  for each row execute function public.guard_profile_admin_flag();

-- 3.5 unguessable QR token for every table -----------------------------
create or replace function public.set_table_token()
returns trigger
language plpgsql
as $$
begin
  if new.qr_token is null or new.qr_token = '' then
    new.qr_token := public.random_token('tbl_', 9);
  end if;
  return new;
end;
$$;

drop trigger if exists set_table_token_trigger on public.restaurant_tables;
create trigger set_table_token_trigger
  before insert on public.restaurant_tables
  for each row execute function public.set_table_token();

-- 3.6 per-restaurant sequential order numbers + public token -----------
create or replace function public.set_order_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.public_token is null or new.public_token = '' then
    new.public_token := public.random_token('ord_', 12);
  end if;

  if new.order_number is null or new.order_number = 0 then
    -- serialise per restaurant so two concurrent orders never collide
    perform pg_advisory_xact_lock(hashtext(new.restaurant_id::text));
    select coalesce(max(o.order_number), 0) + 1
      into new.order_number
      from public.orders o
     where o.restaurant_id = new.restaurant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_order_defaults_trigger on public.orders;
create trigger set_order_defaults_trigger
  before insert on public.orders
  for each row execute function public.set_order_defaults();

-- 3.7 updated_at everywhere -------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'restaurants', 'restaurant_settings',
    'categories', 'products', 'orders'
  ]
  loop
    execute format('drop trigger if exists touch_updated_at_trigger on public.%I', t);
    execute format(
      'create trigger touch_updated_at_trigger before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. INDEXES
-- ---------------------------------------------------------------------
create index if not exists restaurants_owner_idx        on public.restaurants (owner_id);
create index if not exists restaurants_status_idx       on public.restaurants (status);
create index if not exists members_user_idx             on public.restaurant_members (user_id);
create index if not exists members_restaurant_idx       on public.restaurant_members (restaurant_id);
create index if not exists categories_restaurant_idx    on public.categories (restaurant_id, sort_order);
create index if not exists products_restaurant_idx      on public.products (restaurant_id, sort_order);
create index if not exists products_category_idx        on public.products (category_id);
create index if not exists variants_product_idx         on public.product_variants (product_id, sort_order);
create index if not exists variants_restaurant_idx      on public.product_variants (restaurant_id);
create index if not exists tables_restaurant_idx        on public.restaurant_tables (restaurant_id, sort_order);
create index if not exists tables_token_idx             on public.restaurant_tables (qr_token);
create index if not exists orders_restaurant_idx        on public.orders (restaurant_id, created_at desc);
create index if not exists orders_status_idx            on public.orders (restaurant_id, status);
create index if not exists order_items_order_idx        on public.order_items (order_id);
create index if not exists order_items_restaurant_idx   on public.order_items (restaurant_id);
create index if not exists waiter_restaurant_idx        on public.waiter_requests (restaurant_id, created_at desc);
create index if not exists waiter_status_idx            on public.waiter_requests (restaurant_id, status);
create index if not exists admin_actions_restaurant_idx on public.admin_actions (restaurant_id, created_at desc);
create index if not exists menu_images_group_idx        on public.menu_images (group_name, category);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--
--  Model
--    * Every table has RLS enabled and NO permissive default.
--    * Restaurant owners/members reach only their own restaurant's rows.
--    * Platform admins reach everything.
--    * anon has no access at all. Public menu reads and guest orders go
--      through server-side code using the service role, which validates
--      activation, table tokens and prices before touching the database.
--      (The service role bypasses RLS by design.)
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.restaurants         enable row level security;
alter table public.restaurant_members  enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_variants    enable row level security;
alter table public.restaurant_tables   enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.waiter_requests     enable row level security;
alter table public.admin_actions       enable row level security;
alter table public.menu_images         enable row level security;

-- drop old policies so the script can be re-run safely
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 5.1 profiles ---------------------------------------------------------
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- 5.2 restaurants ------------------------------------------------------
create policy "restaurants: read own or admin" on public.restaurants
  for select to authenticated
  using (public.owns_restaurant(id) or owner_id = auth.uid() or public.is_admin());

create policy "restaurants: create own" on public.restaurants
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'inactive'
    and activated_at is null
    and payment_status = 'unpaid'
  );

create policy "restaurants: update own or admin" on public.restaurants
  for update to authenticated
  using (public.can_manage_restaurant(id) or owner_id = auth.uid() or public.is_admin())
  with check (public.can_manage_restaurant(id) or owner_id = auth.uid() or public.is_admin());

create policy "restaurants: delete own or admin" on public.restaurants
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- 5.3 restaurant_members ----------------------------------------------
create policy "members: read own restaurants" on public.restaurant_members
  for select to authenticated
  using (user_id = auth.uid() or public.owns_restaurant(restaurant_id) or public.is_admin());

create policy "members: manage by owner" on public.restaurant_members
  for all to authenticated
  using (public.can_manage_restaurant(restaurant_id) or public.is_admin())
  with check (public.can_manage_restaurant(restaurant_id) or public.is_admin());

-- 5.4 / 5.5 settings + menu content
--     Read: any member of the restaurant (including 'staff').
--     Write: only 'owner'/'manager'. USING governs UPDATE and DELETE, so it
--     must use can_manage_restaurant — otherwise a staff member could delete
--     the whole menu even though they cannot edit a row.
do $$
declare t text;
begin
  foreach t in array array[
    'restaurant_settings', 'categories', 'products',
    'product_variants', 'restaurant_tables'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.owns_restaurant(restaurant_id) or public.is_admin())',
      t || ': member read', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.can_manage_restaurant(restaurant_id) or public.is_admin())',
      t || ': manager insert', t);

    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.can_manage_restaurant(restaurant_id) or public.is_admin())
         with check (public.can_manage_restaurant(restaurant_id) or public.is_admin())',
      t || ': manager update', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.can_manage_restaurant(restaurant_id) or public.is_admin())',
      t || ': manager delete', t);
  end loop;
end $$;

-- 5.6 orders -----------------------------------------------------------
-- Guests never insert directly: a server action validates and writes with
-- the service role. Staff may read and advance their own orders.
create policy "orders: read own restaurant" on public.orders
  for select to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin());

create policy "orders: update own restaurant" on public.orders
  for update to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin())
  with check (public.owns_restaurant(restaurant_id) or public.is_admin());

create policy "orders: delete by admin" on public.orders
  for delete to authenticated
  using (public.is_admin());

create policy "order_items: read own restaurant" on public.order_items
  for select to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin());

-- 5.7 waiter requests --------------------------------------------------
create policy "waiter: read own restaurant" on public.waiter_requests
  for select to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin());

create policy "waiter: update own restaurant" on public.waiter_requests
  for update to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin())
  with check (public.owns_restaurant(restaurant_id) or public.is_admin());

-- 5.8 admin audit trail ------------------------------------------------
create policy "admin_actions: admin only" on public.admin_actions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5.9 platform image library ------------------------------------------
create policy "menu_images: read" on public.menu_images
  for select to authenticated, anon
  using (is_active);

create policy "menu_images: admin writes" on public.menu_images
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. STORAGE
--    restaurant-assets/<restaurant_id>/<kind>/<file>
--    menu-library/<category>/<file>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- SVG is deliberately excluded: these buckets are served from a public
  -- origin, and an uploaded SVG can carry script.
  ('restaurant-assets', 'restaurant-assets', true, 4194304,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('menu-library', 'menu-library', true, 4194304,
   array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "assets: public read"    on storage.objects;
drop policy if exists "assets: member insert"  on storage.objects;
drop policy if exists "assets: member update"  on storage.objects;
drop policy if exists "assets: member delete"  on storage.objects;
drop policy if exists "library: public read"   on storage.objects;
drop policy if exists "library: admin write"   on storage.objects;

create policy "assets: public read" on storage.objects
  for select to public
  using (bucket_id = 'restaurant-assets');

create policy "assets: member insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'restaurant-assets'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.can_manage_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy "assets: member update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'restaurant-assets'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.can_manage_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy "assets: member delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'restaurant-assets'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.can_manage_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy "library: public read" on storage.objects
  for select to public
  using (bucket_id = 'menu-library');

create policy "library: admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'menu-library' and public.is_admin())
  with check (bucket_id = 'menu-library' and public.is_admin());

-- ---------------------------------------------------------------------
-- 7. REALTIME
-- ---------------------------------------------------------------------
alter table public.orders          replica identity full;
alter table public.order_items     replica identity full;
alter table public.waiter_requests replica identity full;

do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'waiter_requests']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. IMAGE LIBRARY
--
--    `menu_images` ships empty on purpose. Populate it from the admin
--    dashboard (/admin/library): each upload is resized and compressed in
--    the browser, stored in the `menu-library` bucket, and then appears in
--    every restaurant's image picker.
--
--    The app reads the library through a cached endpoint (/api/library), so
--    adding an image hits the database once, not once per page view.
--
--    Only add photos you own or that are explicitly cleared for commercial
--    use. Never insert hotlinked images from image search results — the
--    `license` column is required for exactly this reason.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 9. MAKE YOURSELF AN ADMIN
--
--    1. Sign up in the app with your own email.
--    2. Run this in the SQL editor:
--
--      update public.profiles
--         set is_admin = true
--       where email = 'you@example.com';
--
--    3. Sign out and back in.
--
--    Admins can reach /admin, activate/suspend restaurants and manage the
--    shared image library. A regular user can never grant it to themselves:
--    guard_profile_admin resets `is_admin` for anyone who is not already an
--    admin. The SQL editor is exempt because it connects without an end-user
--    JWT (auth.uid() is null), which is how the first admin is created.
-- ---------------------------------------------------------------------

-- 10. AUTH SETTINGS (do this in the dashboard, not in SQL)
--
--    Authentication -> Sign In / Providers -> Email
--      * Enable Email provider.
--      * For a smooth first run you may turn OFF "Confirm email";
--        leave it ON in production and configure SMTP.
--    Authentication -> URL Configuration
--      * Site URL: https://menuzqr.com   (http://localhost:3000 while developing)
-- ---------------------------------------------------------------------
