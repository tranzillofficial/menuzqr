-- =====================================================================
-- MenuzQR — upgrade 006
-- Two products, one subscription, and discount coupons.
--
--   * QR menu + designs  — $20, paid once. Activation only publishes the
--                          public menu; the dashboard is free to use from
--                          the moment an account is created.
--   * POS                — $2 / month or $20 / year.
--   * Bundle             — take POS and the menu is $8 instead of $20.
--
-- No payment gateway: an owner requests, pays over WhatsApp, an admin
-- activates. Coupons are validated server-side so a code cannot be guessed
-- or enumerated from the browser.
--
-- Run AFTER schema.sql, 002, 003, 004 and 005. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PRICES
-- ---------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists pos_monthly_usd  numeric(10, 2) not null default 2,
  add column if not exists pos_yearly_usd   numeric(10, 2) not null default 20,
  add column if not exists menu_bundle_usd  numeric(10, 2) not null default 8,
  add column if not exists pos_enabled      boolean not null default false;

comment on column public.platform_settings.menu_bundle_usd is
  'What the one-time menu fee costs for a restaurant that also takes POS.';
comment on column public.platform_settings.pos_enabled is
  'Flip to true when POS actually ships. Until then the dashboard shows it as coming soon.';

-- ---------------------------------------------------------------------
-- 2. POS SUBSCRIPTION STATE, PER RESTAURANT
-- ---------------------------------------------------------------------
alter table public.restaurants
  add column if not exists pos_status     text not null default 'none',
  add column if not exists pos_plan       text,
  add column if not exists pos_started_at timestamptz,
  add column if not exists pos_expires_at timestamptz,
  add column if not exists coupon_code    text;

alter table public.restaurants drop constraint if exists restaurants_pos_status_check;
alter table public.restaurants add constraint restaurants_pos_status_check
  check (pos_status in ('none', 'requested', 'active', 'expired', 'cancelled'));

alter table public.restaurants drop constraint if exists restaurants_pos_plan_check;
alter table public.restaurants add constraint restaurants_pos_plan_check
  check (pos_plan is null or pos_plan in ('monthly', 'yearly'));

create index if not exists restaurants_pos_status_idx on public.restaurants (pos_status);

-- An owner asking for POS must never be able to grant it to themselves, so
-- the column guard has to cover the new columns too. `pos_status` is the one
-- exception: moving from 'none'/'expired'/'cancelled' to 'requested' is just
-- raising a hand, and the app lets owners do that.
create or replace function public.guard_restaurant_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    new.pos_status            := 'none';
    new.pos_plan              := null;
    new.pos_started_at        := null;
    new.pos_expires_at        := null;
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

  new.pos_started_at := old.pos_started_at;
  new.pos_expires_at := old.pos_expires_at;

  -- The only self-service transitions: asking for POS, or withdrawing the ask.
  -- Note there is deliberately NO `new.pos_status = old.pos_status` escape
  -- hatch: with one, an owner whose POS is already active could keep the
  -- status untouched and rewrite `pos_plan` from monthly to yearly, and the
  -- next admin "Renew" would hand them a year for a month's money. A genuine
  -- no-op update simply falls through to the else and re-pins to old values.
  if not (
    (old.pos_status in ('none', 'expired', 'cancelled') and new.pos_status = 'requested')
    or (old.pos_status = 'requested' and new.pos_status in ('none', 'requested'))
  ) then
    new.pos_status := old.pos_status;
    new.pos_plan   := old.pos_plan;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. COUPONS
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null check (char_length(trim(code)) between 3 and 24),
  kind             text not null default 'percent' check (kind in ('percent', 'fixed')),
  value            numeric(10, 2) not null check (value > 0),
  applies_to       text not null default 'both' check (applies_to in ('menu', 'pos', 'both')),
  max_redemptions  integer,
  redeemed_count   integer not null default 0,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists coupons_code_key on public.coupons (upper(trim(code)));

drop trigger if exists touch_updated_at_trigger on public.coupons;
create trigger touch_updated_at_trigger
  before update on public.coupons
  for each row execute function public.touch_updated_at();

create table if not exists public.coupon_redemptions (
  id             uuid primary key default gen_random_uuid(),
  coupon_id      uuid not null references public.coupons (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  applied_to     text not null check (applied_to in ('menu', 'pos')),
  created_at     timestamptz not null default now(),
  unique (coupon_id, restaurant_id, applied_to)
);

create index if not exists coupon_redemptions_restaurant_idx
  on public.coupon_redemptions (restaurant_id);

-- Coupons are admin-only to read. An owner who could SELECT this table could
-- simply list every code, so they never touch it directly — they call
-- `preview_coupon` below with a code they were given.
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "coupons: admin only" on public.coupons;
create policy "coupons: admin only" on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "redemptions: own or admin" on public.coupon_redemptions;
create policy "redemptions: own or admin" on public.coupon_redemptions
  for select to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin());

drop policy if exists "redemptions: admin writes" on public.coupon_redemptions;
create policy "redemptions: admin writes" on public.coupon_redemptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A coupon code can be guessed even when the table cannot be listed: signup
-- is public and there is no rate limit anywhere else in the stack. This is
-- the throttle.
create table if not exists public.coupon_attempts (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists coupon_attempts_user_idx
  on public.coupon_attempts (user_id, created_at desc);

alter table public.coupon_attempts enable row level security;
-- No policy at all: only the SECURITY DEFINER function below touches it.

-- ---------------------------------------------------------------------
-- 4. COUPON LOOKUP
--
--    SECURITY DEFINER so an owner can check one code without being able to
--    read the table. Returns only what the quote needs — never the note,
--    the usage counts, or anything about other coupons.
-- ---------------------------------------------------------------------
create or replace function public.preview_coupon(coupon_code text, target text)
returns table (valid boolean, kind text, value numeric, applies_to text, reason text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  found   public.coupons%rowtype;
  tries   integer;
  caller  uuid := auth.uid();
begin
  if caller is null then
    return query select false, null::text, null::numeric, null::text, 'unauthenticated';
    return;
  end if;

  -- Throttle first, so a guessing loop is capped whatever it asks for.
  select count(*) into tries
  from public.coupon_attempts a
  where a.user_id = caller and a.created_at > now() - interval '1 hour';

  if tries >= 20 then
    return query select false, null::text, null::numeric, null::text, 'throttled';
    return;
  end if;

  insert into public.coupon_attempts (user_id) values (caller);

  select * into found
  from public.coupons c
  where upper(trim(c.code)) = upper(trim(coupon_code))
  limit 1;

  -- One opaque answer for every "no". Distinct reasons (inactive / expired /
  -- used_up) would confirm that a guessed code exists, which is most of what
  -- an attacker wants.
  if found.id is null
     or not found.is_active
     or (found.expires_at is not null and found.expires_at < now())
     or (found.max_redemptions is not null and found.redeemed_count >= found.max_redemptions)
  then
    return query select false, null::text, null::numeric, null::text, 'unavailable';
    return;
  end if;

  if found.applies_to <> 'both' and found.applies_to <> target then
    return query select false, null::text, null::numeric, null::text, 'wrong_product';
    return;
  end if;

  return query select true, found.kind, found.value, found.applies_to, null::text;
end;
$$;

revoke all on function public.preview_coupon(text, text) from public;
grant execute on function public.preview_coupon(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. VERIFICATION
-- ---------------------------------------------------------------------

-- 5.1 Prices in force. Expect one row.
select price_usd      as menu_once,
       menu_bundle_usd as menu_with_pos,
       pos_monthly_usd,
       pos_yearly_usd,
       pos_enabled
from public.platform_settings where id = 1;

-- 5.2 POS state across restaurants.
select pos_status, count(*) from public.restaurants group by pos_status order by pos_status;

-- 5.3 Coupons and how much of each is left.
select code, kind, value, applies_to, is_active,
       redeemed_count,
       coalesce(max_redemptions::text, 'unlimited') as cap,
       expires_at
from public.coupons order by created_at desc;
