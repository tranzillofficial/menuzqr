insert into public.configuration_features(key,kind,parent_module) values
('product_images','capability','products'),
('product_options','capability','products'),
('qr_menu','capability','qr'),
('qr_whatsapp','capability','qr'),
('qr_tables','capability','qr'),
('qr_design','capability','qr'),
('qr_exports','capability','qr'),
('offer_pos','capability','offers'),
('offer_bundle','capability','offers'),
('offer_discount','capability','offers'),
('offer_images','capability','offers'),
('offer_schedule','capability','offers'),
('offer_barcode_scan','capability','offers');
-- Add defaults without removing any existing tenant customization.
update public.business_types t set available_capabilities=available_capabilities||array['product_images','product_options','qr_menu','qr_whatsapp','qr_tables','qr_design','qr_exports','offer_pos','offer_bundle','offer_discount','offer_images','offer_schedule','offer_barcode_scan'],default_capabilities=default_capabilities||array(select f.key from configuration_features f where f.key=any(array['product_images','product_options','qr_menu','qr_whatsapp','qr_tables','qr_design','qr_exports','offer_pos','offer_bundle','offer_discount','offer_images','offer_schedule','offer_barcode_scan']) and f.parent_module=any(t.default_modules) and (f.key<>'qr_tables' or 'tables'=any(t.default_modules)));
update public.restaurants r set enabled_modules=enabled_modules||array(select f.key from configuration_features f where f.key=any(array['product_images','product_options','qr_menu','qr_whatsapp','qr_tables','qr_design','qr_exports','offer_pos','offer_bundle','offer_discount','offer_images','offer_schedule','offer_barcode_scan']) and f.parent_module=any(r.enabled_modules) and (f.key<>'qr_tables' or 'tables'=any(r.enabled_modules))) where enabled_modules @> array['features_v3'];
create function public.business_capability_enabled(p_restaurant uuid,p_feature text) returns boolean language sql stable security invoker set search_path=public as $$
 select coalesce((select public.business_module_enabled(r.id,f.parent_module) and (p_feature<>'qr_tables' or public.business_module_enabled(r.id,'tables')) and (not(coalesce(r.enabled_modules,'{}') @> array['features_v3']) or p_feature=any(r.enabled_modules)) from restaurants r join configuration_features f on f.key=p_feature and f.kind='capability' where r.id=p_restaurant),false)
$$;
revoke all on function public.business_capability_enabled(uuid,text) from public,anon;
grant execute on function public.business_capability_enabled(uuid,text) to authenticated,service_role;
create table public.business_qr_settings(restaurant_id uuid primary key references public.restaurants(id) on delete cascade,preferences jsonb not null default '{}' check(jsonb_typeof(preferences)='object' and octet_length(preferences::text)<=4096),updated_at timestamptz not null default now());
alter table public.business_qr_settings enable row level security;
revoke all on public.business_qr_settings from anon,authenticated;
grant select,insert,update on public.business_qr_settings to authenticated;
grant all on public.business_qr_settings to service_role;
create policy qr_settings_read on public.business_qr_settings for select to authenticated using(public.is_admin() or public.can_manage_restaurant(restaurant_id));
create policy qr_settings_insert on public.business_qr_settings for insert to authenticated with check(public.is_admin() or (public.can_manage_restaurant(restaurant_id) and public.business_capability_enabled(restaurant_id,'qr_design')));
create policy qr_settings_update on public.business_qr_settings for update to authenticated using(public.is_admin() or (public.can_manage_restaurant(restaurant_id) and public.business_capability_enabled(restaurant_id,'qr_design'))) with check(public.is_admin() or (public.can_manage_restaurant(restaurant_id) and public.business_capability_enabled(restaurant_id,'qr_design')));
create function public.validate_qr_preferences() returns trigger language plpgsql security invoker set search_path=public as $$
declare k text;v jsonb;
begin
 if tg_op='UPDATE' and new.restaurant_id is distinct from old.restaurant_id then raise exception 'Cannot change business ownership';end if;
 for k,v in select * from jsonb_each(new.preferences) loop
 if k not in ('menu','whatsapp','table') or jsonb_typeof(v)<>'object' or jsonb_typeof(v->'title') is distinct from 'string' or length(trim(v->>'title')) not between 2 and 80 or jsonb_typeof(v->'subtitle') is distinct from 'string' or length(v->>'subtitle')>100 or coalesce(v->>'theme','') not in ('simple','cream','dark') or length(coalesce(v->>'template_id',''))>64 then raise exception 'Invalid QR preferences';end if;
 end loop;
 new.updated_at:=now();return new;
end;$$;
revoke all on function public.validate_qr_preferences() from public;
create trigger qr_preferences_valid before insert or update on public.business_qr_settings for each row execute function public.validate_qr_preferences();

alter table public.business_offers add column all_day boolean not null default true,
add column offer_type text not null default 'promotion' check(offer_type in ('promotion','bundle','discount')),
add column bundle_items jsonb not null default '[]' check(jsonb_typeof(bundle_items)='array' and jsonb_array_length(bundle_items)<=30),
add column sale_price numeric(12,2) check(sale_price between 0 and 1000000000),
add column discount_kind text check(discount_kind in ('percent','fixed')),
add column discount_value numeric(12,2) check(discount_value between 0 and 1000000000),
add column original_total numeric(12,2) not null default 0 check(original_total between 0 and 1000000000);
create function public.validate_commercial_offer() returns trigger language plpgsql security invoker set search_path=public as $$
declare item jsonb;v record;qty integer;canonical jsonb:='[]';total numeric:=0;seen uuid[]:='{}';feature text;
begin
 if tg_op='UPDATE' and new.restaurant_id is distinct from old.restaurant_id then raise exception 'Cannot change business ownership';end if;
 if tg_op='UPDATE' and new.is_active=false and (to_jsonb(new)-'is_active')=(to_jsonb(old)-'is_active') then return new;end if;
 if current_user not in ('postgres','service_role') and not public.is_admin() then
  if new.offer_type='bundle' and not business_capability_enabled(new.restaurant_id,'offer_bundle') then raise exception 'Bundle offers disabled';end if;
  if new.offer_type='discount' and not business_capability_enabled(new.restaurant_id,'offer_discount') then raise exception 'Discount offers disabled';end if;
  if tg_op='INSERT' then
   if new.image_url is not null and not business_capability_enabled(new.restaurant_id,'offer_images') then raise exception 'Offer images disabled';end if;
   if (new.starts_at is not null or new.ends_at is not null) and not business_capability_enabled(new.restaurant_id,'offer_schedule') then raise exception 'Offer scheduling disabled';end if;
  else
   if new.image_url is distinct from old.image_url and not business_capability_enabled(new.restaurant_id,'offer_images') then raise exception 'Offer images disabled';end if;
   if row(new.starts_at,new.ends_at) is distinct from row(old.starts_at,old.ends_at) and not business_capability_enabled(new.restaurant_id,'offer_schedule') then raise exception 'Offer scheduling disabled';end if;
  end if;
 end if;
 if new.offer_type='promotion' then new.bundle_items:='[]';new.sale_price:=null;new.discount_kind:=null;new.discount_value:=null;new.original_total:=0;return new;end if;
 if jsonb_typeof(new.bundle_items) is distinct from 'array' or jsonb_array_length(new.bundle_items) not between 1 and 30 then raise exception 'Select offer products';end if;
 for item in select * from jsonb_array_elements(new.bundle_items) loop
  if jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::numeric not between 1 and 99 then raise exception 'Invalid offer quantity';end if;qty:=(item->>'quantity')::int;
  if (item->>'variant_id')::uuid=any(seen) then raise exception 'Duplicate offer variant';end if;
  select pv.id,pv.name variant_name,pv.price,p.id product_id,p.name,p.image_url into v from product_variants pv join products p on p.id=pv.product_id where pv.id=(item->>'variant_id')::uuid and pv.restaurant_id=new.restaurant_id and p.restaurant_id=new.restaurant_id and pv.is_active and p.is_active for share of pv,p;
  if not found or v.price<0 then raise exception 'Offer variant unavailable or belongs to another business';end if;
  seen:=array_append(seen,v.id);total:=total+round(v.price*qty,2);
  canonical:=canonical||jsonb_build_array(jsonb_build_object('variant_id',v.id,'product_id',v.product_id,'name',v.name,'variant_name',v.variant_name,'unit_price',v.price,'image_url',v.image_url,'quantity',qty));
 end loop;
 new.original_total:=total;new.bundle_items:=canonical;new.product_ids:=array(select distinct (x->>'product_id')::uuid from jsonb_array_elements(canonical)x);
 if new.offer_type='bundle' then
  if new.sale_price is null or new.sale_price::text in ('NaN','Infinity','-Infinity') or new.sale_price<0 or new.sale_price>total then raise exception 'Bundle price must not exceed original total';end if;
  new.discount_kind:=null;new.discount_value:=null;
 else
  if new.discount_value is null or new.discount_value::text in ('NaN','Infinity','-Infinity') or new.discount_value<0 or (new.discount_kind='percent' and new.discount_value>100) or (new.discount_kind='fixed' and new.discount_value>total) or new.discount_kind is null then raise exception 'Invalid discount';end if;
  new.sale_price:=case when new.discount_kind='percent' then round(total*(100-new.discount_value)/100,2) else total-new.discount_value end;
 end if;
 return new;
end;$$;
revoke all on function public.validate_commercial_offer() from public;
create trigger aaa_commercial_offer before insert or update on public.business_offers for each row execute function public.validate_commercial_offer();

create function public.guard_product_images() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user in ('postgres','service_role') or public.is_admin() then return new;end if;
 if not business_capability_enabled(new.restaurant_id,'product_images') and ((tg_op='INSERT' and new.image_url is not null) or (tg_op='UPDATE' and new.image_url is distinct from old.image_url)) then raise exception 'Product images disabled';end if;return new;
end;$$;
revoke all on function public.guard_product_images() from public;
create trigger product_images_guard before insert or update on public.products for each row execute function public.guard_product_images();
create function public.guard_product_options() returns trigger language plpgsql security invoker set search_path=public as $$
declare rid uuid;pid uuid;
begin
 rid:=case when tg_op='DELETE' then old.restaurant_id else new.restaurant_id end;pid:=case when tg_op='DELETE' then old.product_id else new.product_id end;
 if current_user in ('postgres','service_role') or public.is_admin() or business_capability_enabled(rid,'product_options') then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='INSERT' then perform 1 from products where id=pid and restaurant_id=rid for update;if exists(select 1 from product_variants where product_id=pid and restaurant_id=rid) then raise exception 'Additional selling options disabled';end if;
 elsif tg_op='DELETE' then if exists(select 1 from products where id=pid and restaurant_id=rid) then raise exception 'Selling option removal disabled';end if;return old;
 elsif row(new.name,new.is_active) is distinct from row(old.name,old.is_active) then raise exception 'Selling option editing disabled';end if;
 return new;
end;$$;
revoke all on function public.guard_product_options() from public;
create trigger zzz_selling_options_guard before insert or update or delete on public.product_variants for each row execute function public.guard_product_options();
create or replace function public.refresh_business_configuration(p_restaurant uuid) returns text[] language plpgsql security invoker set search_path=public as $$
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
  if enabled_cap='qr_tables' and not('tables'=any(flags)) then
   if exists(select 1 from business_configuration_overrides where restaurant_id=r.id and feature_key=enabled_cap and enabled) then raise exception 'qr_tables requires tables';end if;continue;end if;
  if parent=any(flags) then flags:=array_append(flags,enabled_cap);
  elsif exists(select 1 from business_configuration_overrides where restaurant_id=r.id and feature_key=enabled_cap and enabled) then raise exception '% requires %',enabled_cap,parent;
  end if;
 end loop;
 flags:=flags||array['features_v2','features_v3'];
 update restaurants set enabled_modules=flags,business_kind=t.business_kind where id=r.id;
 return flags;
end;$$;
create or replace function public.configure_business(p_restaurant uuid,p_type uuid,p_overrides jsonb,p_manual text[] default null,p_kind text default null) returns text[] language plpgsql security invoker set search_path=public as $$
declare r restaurants;t business_types;flags text[];old_overrides jsonb;
begin
 if not public.is_admin() then raise exception 'Administrator required';end if;
 select * into r from restaurants where id=p_restaurant for update;if not found then raise exception 'Business not found';end if;
 select coalesce(jsonb_object_agg(feature_key,enabled),'{}') into old_overrides from business_configuration_overrides where restaurant_id=r.id;
 if p_type is null then
  if p_manual is null or cardinality(p_manual)>64 then raise exception 'Invalid manual configuration';end if;
  if exists(select 1 from unnest(p_manual) k where k not in ('features_v2','features_v3') and not exists(select 1 from configuration_features where key=k) and not(k=any(coalesce(r.enabled_modules,'{}')))) then raise exception 'Unknown feature';end if;
  if 'qr_tables'=any(p_manual) and not('tables'=any(p_manual)) then raise exception 'qr_tables requires tables';end if;
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
create or replace function public.save_business_type(p_id uuid,p_config jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare old_type business_types;t business_types;rid uuid;
begin
 if not public.is_admin() then raise exception 'Administrator required';end if;
 if jsonb_typeof(p_config) is distinct from 'object' or exists(select 1 from unnest(array['available_modules','default_modules','available_capabilities','default_capabilities']) k where jsonb_typeof(p_config->k) is distinct from 'array') then raise exception 'Invalid type configuration';end if;
 t.id:=coalesce(p_id,gen_random_uuid());t.key:=lower(trim(p_config->>'key'));t.name_ar:=trim(p_config->>'name_ar');t.name_en:=trim(p_config->>'name_en');t.business_kind:=trim(p_config->>'business_kind');t.country_code:=upper(trim(p_config->>'country_code'));t.currency:=upper(trim(p_config->>'currency'));t.is_active:=coalesce((p_config->>'is_active')::boolean,true);
 t.available_modules:=array(select jsonb_array_elements_text(p_config->'available_modules'));t.default_modules:=array(select jsonb_array_elements_text(p_config->'default_modules'));t.available_capabilities:=array(select jsonb_array_elements_text(p_config->'available_capabilities'));t.default_capabilities:=array(select jsonb_array_elements_text(p_config->'default_capabilities'));
 if exists(select 1 from unnest(t.available_modules||t.default_modules) k where not exists(select 1 from configuration_features where key=k and kind='module')) or exists(select 1 from unnest(t.available_capabilities||t.default_capabilities) k where not exists(select 1 from configuration_features where key=k and kind='capability')) then raise exception 'Unknown module or capability';end if;
 if not(t.default_modules <@ t.available_modules) or not(t.default_capabilities <@ t.available_capabilities) or exists(select 1 from configuration_features where key=any(t.available_capabilities) and not(parent_module=any(t.available_modules))) then raise exception 'Defaults must be available and capabilities require available parent modules';end if;
 if 'qr_tables'=any(t.default_capabilities) and not('tables'=any(t.default_modules)) then raise exception 'qr_tables requires tables';end if;
 if 'service_calls'=any(t.default_modules) and not('tables'=any(t.default_modules)) then raise exception 'service_calls requires tables';end if;
 select * into old_type from business_types where id=t.id for update;
 insert into business_types(id,key,name_ar,name_en,business_kind,available_modules,default_modules,available_capabilities,default_capabilities,country_code,currency,is_active) values(t.id,t.key,t.name_ar,t.name_en,t.business_kind,t.available_modules,t.default_modules,t.available_capabilities,t.default_capabilities,t.country_code,t.currency,t.is_active)
 on conflict(id) do update set key=excluded.key,name_ar=excluded.name_ar,name_en=excluded.name_en,business_kind=excluded.business_kind,available_modules=excluded.available_modules,default_modules=excluded.default_modules,available_capabilities=excluded.available_capabilities,default_capabilities=excluded.default_capabilities,country_code=excluded.country_code,currency=excluded.currency,is_active=excluded.is_active,updated_at=now();
 for rid in select id from restaurants where business_type_id=t.id order by id loop perform refresh_business_configuration(rid);end loop;
 insert into business_configuration_events(business_type_id,actor_id,action,before_config,after_config) values(t.id,auth.uid(),'type.configuration',to_jsonb(old_type),to_jsonb(t));
 return t.id;
end;$$;
create function public.save_qr_preference(p_restaurant uuid,p_kind text,p_preference jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 if p_kind not in ('menu','whatsapp','table') or (not public.is_admin() and (not public.can_manage_restaurant(p_restaurant) or not public.business_capability_enabled(p_restaurant,'qr_design') or not public.business_capability_enabled(p_restaurant,case p_kind when 'menu' then 'qr_menu' when 'whatsapp' then 'qr_whatsapp' else 'qr_tables' end))) then raise exception 'QR customization unavailable';end if;
 insert into business_qr_settings(restaurant_id,preferences) values(p_restaurant,jsonb_build_object(p_kind,p_preference)) on conflict(restaurant_id) do update set preferences=business_qr_settings.preferences||excluded.preferences;
end;$$;
revoke all on function public.save_qr_preference(uuid,text,jsonb) from public,anon;
grant execute on function public.save_qr_preference(uuid,text,jsonb) to authenticated;
