alter table public.restaurants drop constraint valid_business_modules;
-- Catalog is extensible; configured module IDs are administered by the platform.
alter table public.restaurants add constraint valid_business_modules check (
 enabled_modules is null or cardinality(enabled_modules)=0 or (cardinality(enabled_modules)<=64 and array_to_string(enabled_modules,',') ~ '^[a-z0-9_,]+$')
);
create table public.business_domains (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 hostname text not null unique check (hostname=lower(hostname) and hostname ~ '^[a-z0-9.-]+$'),
 home_mode text not null default 'landing' check(home_mode in ('landing','login')),
 status text not null default 'pending' check(status in ('pending','active')),
 enabled boolean not null default true,
 verification jsonb not null default '{}'::jsonb,
 checked_at timestamptz,
 created_at timestamptz not null default now()
);
create index business_domains_restaurant on public.business_domains(restaurant_id);
alter table public.business_domains enable row level security;
revoke all on public.business_domains from anon,authenticated;
grant select,insert,update,delete on public.business_domains to authenticated;
grant all on public.business_domains to service_role;
create policy business_domains_admin on public.business_domains to authenticated using(public.is_admin()) with check(public.is_admin());
