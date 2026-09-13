-- =====================================================================
--  MenuzQR — upgrade 003
--
--  Run ONCE in the Supabase SQL Editor, after 002-upgrades.sql.
--  Idempotent. Adds:
--    1. platform_settings — the support WhatsApp number and friends,
--       editable from the admin dashboard instead of an env var
--    2. Two more public menu designs: `noir` and `market`
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLATFORM SETTINGS  (single row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  id                 smallint primary key default 1 check (id = 1),
  support_whatsapp   text not null default '201094963553',
  support_email      text,
  price_usd          numeric(10, 2) not null default 20,
  brand_name         text not null default 'MenuzQR',
  activation_note    text,
  updated_at         timestamptz not null default now()
);

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

drop trigger if exists touch_updated_at_trigger on public.platform_settings;
create trigger touch_updated_at_trigger
  before update on public.platform_settings
  for each row execute function public.touch_updated_at();

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings: read" on public.platform_settings;
drop policy if exists "platform_settings: admin writes" on public.platform_settings;

-- The support number is shown on public pages, so everyone may read it.
create policy "platform_settings: read" on public.platform_settings
  for select to authenticated, anon
  using (true);

create policy "platform_settings: admin writes" on public.platform_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. TWO MORE MENU DESIGNS
--    elegant · modern · minimal · noir · market
-- ---------------------------------------------------------------------
alter table public.restaurants
  drop constraint if exists restaurants_menu_theme_check;

alter table public.restaurants
  add constraint restaurants_menu_theme_check
  check (menu_theme in ('elegant', 'modern', 'minimal', 'noir', 'market'));

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
select * from public.platform_settings;

select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.restaurants'::regclass
   and conname = 'restaurants_menu_theme_check';
