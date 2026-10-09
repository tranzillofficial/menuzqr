begin;
create table public.business_offers (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 100),
 description text not null default '' check(length(description)<=1200),
 image_url text,
 product_ids uuid[] not null default '{}' check(cardinality(product_ids)<=100),
 starts_at timestamptz,
 ends_at timestamptz,
 is_active boolean not null default false,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 check(starts_at is null or ends_at is null or ends_at>starts_at)
);
create index business_offers_restaurant on public.business_offers(restaurant_id,is_active,sort_order);
alter table public.business_offers enable row level security;
grant select,insert,update on public.business_offers to authenticated;
grant all on public.business_offers to service_role;
create policy manage_business_offers on public.business_offers for all to authenticated
 using(exists(select 1 from public.restaurant_members m join public.restaurants r on r.id=m.restaurant_id where m.restaurant_id=business_offers.restaurant_id and m.user_id=(select auth.uid()) and m.is_active and m.role in ('owner','manager') and (r.enabled_modules is null or 'offers'=any(r.enabled_modules))))
 with check(exists(select 1 from public.restaurant_members m join public.restaurants r on r.id=m.restaurant_id where m.restaurant_id=business_offers.restaurant_id and m.user_id=(select auth.uid()) and m.is_active and m.role in ('owner','manager') and (r.enabled_modules is null or 'offers'=any(r.enabled_modules))));
create function public.validate_offer_products() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if exists(select 1 from unnest(new.product_ids) id where not exists(select 1 from products p where p.id=id and p.restaurant_id=new.restaurant_id)) then raise exception 'Offer products must belong to the same business'; end if;
 return new;
end $$;
revoke all on function public.validate_offer_products() from public,anon,authenticated;
create trigger validate_offer_products before insert or update on public.business_offers for each row execute function public.validate_offer_products();
commit;
