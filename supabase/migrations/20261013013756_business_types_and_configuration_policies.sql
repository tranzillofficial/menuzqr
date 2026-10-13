create table public.configuration_features (
 key text primary key check(key ~ '^[a-z][a-z0-9_]{0,63}$'),
 kind text not null check(kind in ('module','capability')),
 parent_module text references public.configuration_features(key)
);
insert into public.configuration_features(key,kind,parent_module) values
('inventory','module',null),
('invoices','module',null),
('offers','module',null),
('customers','module',null),
('pos','module',null),
('reports','module',null),
('catalog','module',null),
('tables','module',null),
('orders','module',null),
('staff','module',null),
('design','module',null),
('service_calls','module',null),
('subcategories','module',null),
('branch','module',null),
('products','module',null),
('qr','module',null),
('settings','module',null),
('product_description','capability','products'),
('product_ingredients','capability','products'),
('product_english','capability','products'),
('product_barcode','capability','products'),
('product_weights','capability','products'),
('product_packaging','capability','products'),
('tax_settings','capability','settings'),
('delivery_settings','capability','settings'),
('payment_settings','capability','settings'),
('contact_settings','capability','settings'),
('online_ordering','capability','orders'),
('receipt_printing','capability','pos');
create table public.business_types (
 id uuid primary key default gen_random_uuid(), key text not null unique check(key ~ '^[a-z][a-z0-9_-]{1,63}$'),
 name_ar text not null check(length(name_ar) between 2 and 100), name_en text not null check(length(name_en) between 2 and 100),
 business_kind text not null check(length(business_kind) between 1 and 80),
 available_modules text[] not null,default_modules text[] not null,
 available_capabilities text[] not null,default_capabilities text[] not null,
 country_code text not null default 'EG' check(country_code ~ '^[A-Z]{2}$'),
 currency text not null default 'EGP' check(currency ~ '^[A-Z]{3}$'),
 is_active boolean not null default true, updated_at timestamptz not null default now(),
 check(default_modules <@ available_modules),check(default_capabilities <@ available_capabilities)
);
alter table public.restaurants add column business_type_id uuid references public.business_types(id) on delete restrict;
create index restaurants_business_type on public.restaurants(business_type_id) where business_type_id is not null;
create table public.business_configuration_overrides (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 feature_key text not null references public.configuration_features(key), enabled boolean not null,
 primary key(restaurant_id,feature_key)
);
create table public.business_configuration_events (
 id bigint generated always as identity primary key,restaurant_id uuid references public.restaurants(id) on delete restrict,
 business_type_id uuid references public.business_types(id) on delete restrict,actor_id uuid,
 action text not null,before_config jsonb,after_config jsonb,created_at timestamptz not null default now()
);
alter table public.configuration_features enable row level security;
alter table public.business_types enable row level security;
alter table public.business_configuration_overrides enable row level security;
alter table public.business_configuration_events enable row level security;
revoke all on public.configuration_features,public.business_types,public.business_configuration_overrides,public.business_configuration_events from anon,authenticated;
grant select on public.configuration_features,public.business_types to authenticated;
grant insert,update on public.business_types to authenticated;
grant select,insert,update,delete on public.business_configuration_overrides to authenticated;
grant select,insert on public.business_configuration_events to authenticated;
grant usage,select on sequence public.business_configuration_events_id_seq to authenticated;
grant all on public.configuration_features,public.business_types,public.business_configuration_overrides,public.business_configuration_events to service_role;
grant usage,select on sequence public.business_configuration_events_id_seq to service_role;
create policy configuration_features_read on public.configuration_features for select to authenticated using(true);
create policy business_types_read on public.business_types for select to authenticated using(is_active or public.is_admin());
create policy business_types_insert on public.business_types for insert to authenticated with check(public.is_admin());
create policy business_types_update on public.business_types for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy business_overrides_admin on public.business_configuration_overrides to authenticated using(public.is_admin()) with check(public.is_admin());
create policy business_configuration_events_admin_read on public.business_configuration_events for select to authenticated using(public.is_admin());
create policy business_configuration_events_admin_insert on public.business_configuration_events for insert to authenticated with check(public.is_admin());
create trigger keep_configuration_events before update or delete on public.business_configuration_events for each row execute function fiscal_private.no_mutation();
-- Existing tenants remain unattached: adding templates does not replace their settings.
insert into public.business_types(key,name_ar,name_en,business_kind,available_modules,default_modules,available_capabilities,default_capabilities)
select k,a,e,kind,
 (select array_agg(key order by key) from configuration_features where kind='module'),
 case when kind='restaurant' then array['pos','reports','catalog','tables','orders','staff','design','service_calls','branch','products','qr','settings','offers','invoices'] else array['pos','reports','orders','staff','design','branch','products','qr','settings','offers','customers','invoices','subcategories'] end,
 (select array_agg(key order by key) from configuration_features where kind='capability'),
 array['delivery_settings','payment_settings','contact_settings','online_ordering','receipt_printing'] || case when kind='supermarket' then array['product_barcode','product_weights'] when kind='sweets' then array['product_packaging','product_description','tax_settings'] else array['product_description','product_ingredients','product_english','tax_settings'] end
from (values('restaurant','مطعم','Restaurant','restaurant'),('cafe','كافيه','Cafe','restaurant'),('supermarket','سوبر ماركت','Supermarket','supermarket'),('wholesale','تجارة جملة','Wholesale','sweets'),('retail','محل تجاري','Retail','retail')) v(k,a,e,kind);

create function public.refresh_business_configuration(p_restaurant uuid) returns text[] language plpgsql security invoker set search_path=public as $$
declare r restaurants;t business_types;flags text[];enabled_cap text;parent text;
begin
 if not public.is_admin() then raise exception 'Administrator required';end if;
 select * into r from restaurants where id=p_restaurant for update;if not found then raise exception 'Business not found';end if;
 if r.business_type_id is null then return r.enabled_modules;end if;
 select * into t from business_types where id=r.business_type_id;
 if exists(select 1 from business_configuration_overrides o join configuration_features f on f.key=o.feature_key where o.restaurant_id=r.id and o.enabled and ((f.kind='module' and not(f.key=any(t.available_modules))) or (f.kind='capability' and not(f.key=any(t.available_capabilities))))) then raise exception 'Feature not available for this business type';end if;
 select coalesce(array_agg(f.key order by f.key),'{}') into flags from configuration_features f left join business_configuration_overrides o on o.restaurant_id=r.id and o.feature_key=f.key where f.kind='module' and f.key=any(t.available_modules) and coalesce(o.enabled,f.key=any(t.default_modules));
 if 'service_calls'=any(flags) and not('tables'=any(flags)) then raise exception 'service_calls requires tables';end if;
 for enabled_cap,parent in select f.key,f.parent_module from configuration_features f left join business_configuration_overrides o on o.restaurant_id=r.id and o.feature_key=f.key where f.kind='capability' and f.key=any(t.available_capabilities) and coalesce(o.enabled,f.key=any(t.default_capabilities)) loop
  if parent=any(flags) then flags:=array_append(flags,enabled_cap);
  elsif exists(select 1 from business_configuration_overrides where restaurant_id=r.id and feature_key=enabled_cap and enabled) then raise exception '% requires %',enabled_cap,parent;
  end if;
 end loop;
 flags:=flags||array['features_v2','features_v3'];
 update restaurants set enabled_modules=flags,business_kind=t.business_kind where id=r.id;
 return flags;
end;$$;

create function public.configure_business(p_restaurant uuid,p_type uuid,p_overrides jsonb,p_manual text[] default null,p_kind text default null) returns text[] language plpgsql security invoker set search_path=public as $$
declare r restaurants;t business_types;flags text[];old_overrides jsonb;
begin
 if not public.is_admin() then raise exception 'Administrator required';end if;
 select * into r from restaurants where id=p_restaurant for update;if not found then raise exception 'Business not found';end if;
 select coalesce(jsonb_object_agg(feature_key,enabled),'{}') into old_overrides from business_configuration_overrides where restaurant_id=r.id;
 if p_type is null then
  if p_manual is null or cardinality(p_manual)>64 then raise exception 'Invalid manual configuration';end if;
  if exists(select 1 from unnest(p_manual) k where k not in ('features_v2','features_v3') and not exists(select 1 from configuration_features where key=k) and not(k=any(coalesce(r.enabled_modules,'{}')))) then raise exception 'Unknown feature';end if;
  if 'service_calls'=any(p_manual) and not('tables'=any(p_manual)) then raise exception 'service_calls requires tables';end if;
  if exists(select 1 from configuration_features f where f.kind='capability' and f.key=any(p_manual) and not(f.parent_module=any(p_manual))) then raise exception 'Capability requires its parent module';end if;
  flags:=p_manual;update restaurants set business_type_id=null,enabled_modules=flags,business_kind=coalesce(nullif(left(p_kind,80),''),r.business_kind) where id=r.id;
 else
  select * into t from business_types where id=p_type;if not found or (not t.is_active and r.business_type_id is distinct from t.id) then raise exception 'Business type unavailable';end if;
  if jsonb_typeof(p_overrides) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_overrides))>64 then raise exception 'Invalid overrides';end if;
  if exists(select 1 from jsonb_each(p_overrides) x where jsonb_typeof(x.value)<>'boolean' or not exists(select 1 from configuration_features f where f.key=x.key)) then raise exception 'Invalid override value';end if;
  update restaurants set business_type_id=t.id where id=r.id;
 end if;
 delete from business_configuration_overrides where restaurant_id=r.id;
 if p_type is not null then
  insert into business_configuration_overrides(restaurant_id,feature_key,enabled) select r.id,key,(value::text)::boolean from jsonb_each(p_overrides);
  flags:=refresh_business_configuration(r.id);
 end if;
 insert into business_configuration_events(restaurant_id,business_type_id,actor_id,action,before_config,after_config) values(r.id,p_type,auth.uid(),'tenant.configuration',jsonb_build_object('type',r.business_type_id,'modules',r.enabled_modules,'overrides',old_overrides),jsonb_build_object('type',p_type,'modules',flags,'overrides',p_overrides));
 return flags;
end;$$;

create function public.save_business_type(p_id uuid,p_config jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare old_type business_types;t business_types;rid uuid;
begin
 if not public.is_admin() then raise exception 'Administrator required';end if;
 if jsonb_typeof(p_config) is distinct from 'object' or exists(select 1 from unnest(array['available_modules','default_modules','available_capabilities','default_capabilities']) k where jsonb_typeof(p_config->k) is distinct from 'array') then raise exception 'Invalid type configuration';end if;
 t.id:=coalesce(p_id,gen_random_uuid());t.key:=lower(trim(p_config->>'key'));t.name_ar:=trim(p_config->>'name_ar');t.name_en:=trim(p_config->>'name_en');t.business_kind:=trim(p_config->>'business_kind');t.country_code:=upper(trim(p_config->>'country_code'));t.currency:=upper(trim(p_config->>'currency'));t.is_active:=coalesce((p_config->>'is_active')::boolean,true);
 t.available_modules:=array(select jsonb_array_elements_text(p_config->'available_modules'));t.default_modules:=array(select jsonb_array_elements_text(p_config->'default_modules'));t.available_capabilities:=array(select jsonb_array_elements_text(p_config->'available_capabilities'));t.default_capabilities:=array(select jsonb_array_elements_text(p_config->'default_capabilities'));
 if exists(select 1 from unnest(t.available_modules||t.default_modules) k where not exists(select 1 from configuration_features where key=k and kind='module')) or exists(select 1 from unnest(t.available_capabilities||t.default_capabilities) k where not exists(select 1 from configuration_features where key=k and kind='capability')) then raise exception 'Unknown module or capability';end if;
 if not(t.default_modules <@ t.available_modules) or not(t.default_capabilities <@ t.available_capabilities) or exists(select 1 from configuration_features where key=any(t.available_capabilities) and not(parent_module=any(t.available_modules))) then raise exception 'Defaults must be available and capabilities require available parent modules';end if;
 if 'service_calls'=any(t.default_modules) and not('tables'=any(t.default_modules)) then raise exception 'service_calls requires tables';end if;
 select * into old_type from business_types where id=t.id for update;
 insert into business_types(id,key,name_ar,name_en,business_kind,available_modules,default_modules,available_capabilities,default_capabilities,country_code,currency,is_active) values(t.id,t.key,t.name_ar,t.name_en,t.business_kind,t.available_modules,t.default_modules,t.available_capabilities,t.default_capabilities,t.country_code,t.currency,t.is_active)
 on conflict(id) do update set key=excluded.key,name_ar=excluded.name_ar,name_en=excluded.name_en,business_kind=excluded.business_kind,available_modules=excluded.available_modules,default_modules=excluded.default_modules,available_capabilities=excluded.available_capabilities,default_capabilities=excluded.default_capabilities,country_code=excluded.country_code,currency=excluded.currency,is_active=excluded.is_active,updated_at=now();
 for rid in select id from restaurants where business_type_id=t.id order by id loop perform refresh_business_configuration(rid);end loop;
 insert into business_configuration_events(business_type_id,actor_id,action,before_config,after_config) values(t.id,auth.uid(),'type.configuration',to_jsonb(old_type),to_jsonb(t));
 return t.id;
end;$$;
revoke all on function public.refresh_business_configuration(uuid),public.configure_business(uuid,uuid,jsonb,text[],text),public.save_business_type(uuid,jsonb) from public,anon;
grant execute on function public.refresh_business_configuration(uuid),public.configure_business(uuid,uuid,jsonb,text[],text),public.save_business_type(uuid,jsonb) to authenticated;

create function public.business_module_enabled(p_restaurant uuid,p_module text) returns boolean language sql stable security invoker set search_path=public as $$
 select coalesce((select case
 when r.business_kind in ('market','supermarket') and p_module in ('tables','service_calls') and not(coalesce(r.enabled_modules,'{}') && array['features_v2','features_v3']) then false
 when r.enabled_modules is null then p_module not in ('inventory','subcategories')
 when p_module in ('branch','products','qr','settings') and not(r.enabled_modules && array['features_v2','features_v3']) then true
 when p_module='invoices' and not(r.enabled_modules @> array['features_v3']) then r.enabled_modules && array['orders','reports']
 when p_module='staff' then r.enabled_modules && array['staff','team']
 else r.enabled_modules @> array[p_module] end from restaurants r where r.id=p_restaurant),false)
$$;
revoke all on function public.business_module_enabled(uuid,text) from public,anon;
grant execute on function public.business_module_enabled(uuid,text) to authenticated,service_role;
-- Restrictive policies intersect the existing tenant/role policies; they never grant additional access.
create policy products_module_insert on public.products as restrictive for insert to authenticated with check(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy products_module_update on public.products as restrictive for update to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'products')) with check(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy products_module_delete on public.products as restrictive for delete to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy variants_module_insert on public.product_variants as restrictive for insert to authenticated with check(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy variants_module_update on public.product_variants as restrictive for update to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'products') or public.business_module_enabled(restaurant_id,'inventory')) with check(public.is_admin() or public.business_module_enabled(restaurant_id,'products') or public.business_module_enabled(restaurant_id,'inventory'));
create policy variants_module_delete on public.product_variants as restrictive for delete to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create function public.guard_variant_modules() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user in ('postgres','service_role') or public.is_admin() then return new;end if;
 if tg_op='INSERT' then
  if (new.stock_tracked or new.stock_quantity<>0) and not business_module_enabled(new.restaurant_id,'inventory') then raise exception 'Inventory module disabled';end if;return new;
 end if;
 if row(new.stock_quantity,new.stock_tracked) is distinct from row(old.stock_quantity,old.stock_tracked) and not business_module_enabled(new.restaurant_id,'inventory') then raise exception 'Inventory module disabled';end if;
 if (to_jsonb(new)-array['stock_quantity','stock_tracked']) is distinct from (to_jsonb(old)-array['stock_quantity','stock_tracked']) and not business_module_enabled(new.restaurant_id,'products') then raise exception 'Products module disabled';end if;
 return new;
end;$$;
revoke all on function public.guard_variant_modules() from public;
create trigger variant_module_guard before insert or update on public.product_variants for each row execute function public.guard_variant_modules();
create policy categories_module_insert on public.categories as restrictive for insert to authenticated with check(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy categories_module_update on public.categories as restrictive for update to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'products')) with check(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy categories_module_delete on public.categories as restrictive for delete to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'products'));
create policy offers_module_write on public.business_offers as restrictive for all to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'offers')) with check(public.is_admin() or public.business_module_enabled(restaurant_id,'offers'));
create policy settings_module_write on public.restaurant_settings as restrictive for all to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'settings')) with check(public.is_admin() or public.business_module_enabled(restaurant_id,'settings'));
create function public.guard_catalog_tenant_links() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='UPDATE' and new.restaurant_id is distinct from old.restaurant_id then raise exception 'Tenant ownership cannot be reassigned';end if;
 if tg_table_name='product_variants' then
  if not exists(select 1 from products where id=new.product_id and restaurant_id=new.restaurant_id) then raise exception 'Product belongs to another business';end if;
 elsif tg_table_name='products' and new.category_id is not null then
  if not exists(select 1 from categories where id=new.category_id and restaurant_id=new.restaurant_id) then raise exception 'Category belongs to another business';end if;
 end if;
 return new;
end;$$;
revoke all on function public.guard_catalog_tenant_links() from public;
create trigger product_tenant_links before insert or update on public.products for each row execute function public.guard_catalog_tenant_links();
create trigger variant_tenant_links before insert or update on public.product_variants for each row execute function public.guard_catalog_tenant_links();
create function public.guard_business_type_assignment() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user not in ('postgres','service_role') and not public.is_admin() then
  if tg_op='INSERT' then new.business_type_id:=null;
  elsif new.business_type_id is distinct from old.business_type_id then raise exception 'Only administrators can assign business types';end if;
 end if;
 return new;
end;$$;
revoke all on function public.guard_business_type_assignment() from public;
create trigger guard_business_type_assignment before insert or update on public.restaurants for each row execute function public.guard_business_type_assignment();
create policy stock_module_read on public.stock_movements as restrictive for select to authenticated using(public.is_admin() or public.business_module_enabled(restaurant_id,'inventory'));
alter table public.product_variants add constraint stock_quantity_finite check(stock_quantity between -1000000000 and 1000000000) not valid;
