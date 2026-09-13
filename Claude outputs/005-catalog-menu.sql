-- =====================================================================
-- MenuzQR — upgrade 005
-- The shared menu: real categories, and a copy-into-my-menu flow.
--
-- Run AFTER schema.sql, 002, 003 and 004. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CATALOG CATEGORIES
--
--    Until now the shared catalog was a flat list with a free-text
--    `category_name`. An owner could only meet it as a type-ahead hint.
--    With real categories the admin builds a browsable menu, and an owner
--    copies whole sections of it into their own.
-- ---------------------------------------------------------------------
create table if not exists public.catalog_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 1 and 60),
  description  text,
  image_url    text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists catalog_categories_name_key
  on public.catalog_categories (lower(trim(name)));

drop trigger if exists touch_updated_at_trigger on public.catalog_categories;
create trigger touch_updated_at_trigger
  before update on public.catalog_categories
  for each row execute function public.touch_updated_at();

alter table public.catalog_items
  add column if not exists category_id uuid references public.catalog_categories (id) on delete set null;

create index if not exists catalog_items_category_idx on public.catalog_items (category_id, sort_order);

-- ---------------------------------------------------------------------
-- 2. MIGRATE the existing flat `category_name` values into real rows
-- ---------------------------------------------------------------------
insert into public.catalog_categories (name, sort_order)
select distinct on (lower(trim(i.category_name)))
       trim(i.category_name),
       0
from public.catalog_items i
where coalesce(trim(i.category_name), '') <> ''
  and not exists (
    select 1 from public.catalog_categories c
    where lower(trim(c.name)) = lower(trim(i.category_name))
  )
-- DISTINCT ON needs a matching ORDER BY, or which spelling of a
-- case-variant name survives ("Burgers" vs "burgers") is arbitrary.
order by lower(trim(i.category_name)), i.created_at;

update public.catalog_items i
   set category_id = c.id
  from public.catalog_categories c
 where i.category_id is null
   and coalesce(trim(i.category_name), '') <> ''
   and lower(trim(c.name)) = lower(trim(i.category_name));

-- `category_name` stays as a denormalised label so the older type-ahead
-- suggestion path keeps working without a join. It is now PURELY derived
-- from the section: filed dishes carry their section's name, unfiled dishes
-- carry nothing. Two things depend on that: the admin form no longer has a
-- free-text section field to send, and a re-run of the back-fill above must
-- not re-file a dish the admin deliberately moved back to "Not filed yet".
create or replace function public.sync_catalog_item_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is null then
    new.category_name := null;
  else
    select c.name into new.category_name
    from public.catalog_categories c
    where c.id = new.category_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_catalog_item_category_trg on public.catalog_items;
create trigger sync_catalog_item_category_trg
  before insert or update on public.catalog_items
  for each row execute function public.sync_catalog_item_category();

-- Renaming a category relabels its items.
create or replace function public.sync_catalog_category_rename()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.catalog_items
       set category_name = new.name
     where category_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_catalog_category_rename_trg on public.catalog_categories;
create trigger sync_catalog_category_rename_trg
  after update on public.catalog_categories
  for each row execute function public.sync_catalog_category_rename();

-- ---------------------------------------------------------------------
-- 3. RLS — every signed-in owner reads it, only an admin writes it
-- ---------------------------------------------------------------------
alter table public.catalog_categories enable row level security;

drop policy if exists "catalog_categories: read" on public.catalog_categories;
drop policy if exists "catalog_categories: admin writes" on public.catalog_categories;

create policy "catalog_categories: read" on public.catalog_categories
  for select to authenticated
  using (is_active or public.is_admin());

create policy "catalog_categories: admin writes" on public.catalog_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A dish in a switched-off section must be as invisible as the section is.
-- Without this the item row stays readable, and its id is enough to copy it.
drop policy if exists "catalog: read" on public.catalog_items;
create policy "catalog: read" on public.catalog_items
  for select to authenticated
  using (
    public.is_admin()
    or (
      is_active
      and (
        category_id is null
        or exists (
          select 1 from public.catalog_categories c
          where c.id = category_id and c.is_active
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. VERIFICATION
-- ---------------------------------------------------------------------

-- 4.1 Categories and how many items each holds.
select c.sort_order,
       c.name,
       c.is_active,
       count(i.id) as items
from public.catalog_categories c
left join public.catalog_items i on i.category_id = c.id
group by c.id
order by c.sort_order, c.name;

-- 4.2 Items still not filed under a category. Fix these from /admin/catalog.
select id, name, category_name
from public.catalog_items
where category_id is null
order by name;
