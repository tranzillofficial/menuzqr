-- Additive opt-in configuration: NULL retains every legacy dashboard module.
alter table public.restaurants add column if not exists business_kind text;
alter table public.restaurants add column if not exists enabled_modules text[];
alter table public.restaurants add constraint valid_business_modules check (
 enabled_modules is null or enabled_modules <@ array['pos','reports','catalog','tables','orders','staff','design','service_calls','subcategories']::text[]
);
create or replace function public.guard_business_configuration() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
 if current_user not in ('postgres','service_role') and not public.is_admin() then
  if tg_op = 'INSERT' then new.business_kind := null; new.enabled_modules := null;
  else
   if new.business_kind is distinct from old.business_kind or new.enabled_modules is distinct from old.enabled_modules then
    raise exception 'Only administrators can configure business modules';
   end if;
   if new.menu_theme is distinct from old.menu_theme and old.enabled_modules is not null and not ('design'=any(old.enabled_modules)) then
    raise exception 'Menu design is disabled for this account';
   end if;
  end if;
 end if;
 if new.enabled_modules is not null then
  if not ('orders'=any(new.enabled_modules)) then new.ordering_enabled := false; end if;
  if not ('service_calls'=any(new.enabled_modules)) then new.waiter_calls_enabled := false; end if;
 end if;
 return new;
end; $$;
create trigger guard_business_configuration before insert or update on public.restaurants for each row execute function public.guard_business_configuration();
revoke all on function public.guard_business_configuration() from public;

alter table public.categories add column if not exists parent_id uuid;
alter table public.categories add constraint categories_id_restaurant_unique unique (id,restaurant_id);
alter table public.categories add constraint categories_parent_same_business foreign key (parent_id,restaurant_id)
 references public.categories(id,restaurant_id) on delete set null (parent_id);
create index categories_parent_idx on public.categories(restaurant_id,parent_id);
create or replace function public.guard_category_hierarchy() returns trigger
language plpgsql security invoker set search_path = public as $$
declare modules text[];
begin
 if new.parent_id is null then return new; end if;
 -- Serialize hierarchy changes in one business before checking ancestors.
 perform pg_advisory_xact_lock(hashtextextended(new.restaurant_id::text, 903));
 select enabled_modules into modules from public.restaurants where id=new.restaurant_id;
 if modules is null or not ('subcategories'=any(modules)) then raise exception 'Subcategories are disabled for this account'; end if;
 if new.parent_id=new.id then raise exception 'A category cannot be its own parent'; end if;
 if exists (
  with recursive ancestors as (
   select id,parent_id from public.categories where id=new.parent_id and restaurant_id=new.restaurant_id
   union
   select c.id,c.parent_id from public.categories c join ancestors a on c.id=a.parent_id where c.restaurant_id=new.restaurant_id
  ) select 1 from ancestors where id=new.id
 ) then raise exception 'Category hierarchy cannot contain a cycle'; end if;
 return new;
end; $$;
create trigger guard_category_hierarchy before insert or update of parent_id,restaurant_id on public.categories for each row execute function public.guard_category_hierarchy();
revoke all on function public.guard_category_hierarchy() from public;
