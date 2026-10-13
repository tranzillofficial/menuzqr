insert into public.configuration_features(key,kind,parent_module) values('customer_create','capability','customers'),('customer_edit','capability','customers');
update public.business_types t set available_capabilities=available_capabilities||array['customer_create','customer_edit'],default_capabilities=default_capabilities||case when 'customers'=any(t.default_modules) then array['customer_create','customer_edit'] else '{}'::text[] end where 'customers'=any(t.available_modules);
update public.restaurants set enabled_modules=enabled_modules||array['customer_create','customer_edit'] where enabled_modules @> array['features_v3','customers'];
-- Atomic save: disabled capabilities retain their stored settings.
create function public.save_dashboard_settings(p_restaurant uuid,p_settings jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare r restaurants;s restaurant_settings;ordering boolean;remote boolean;wallet text;instapay text;whatsapp text;details text;fee numeric;free numeric;k text;url text;
begin
 if not can_manage_restaurant(p_restaurant) or not business_module_enabled(p_restaurant,'settings') then raise exception 'Settings unavailable';end if;
 if jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>6000 then raise exception 'Invalid settings';end if;
 select * into r from restaurants where id=p_restaurant for update;
 select * into s from restaurant_settings where restaurant_id=p_restaurant;
 wallet:=coalesce(s.cash_wallet,'');instapay:=coalesce(s.instapay_address,'');whatsapp:=coalesce(s.payment_whatsapp,'');details:=coalesce(s.payment_details,'');
 if business_capability_enabled(r.id,'payment_settings') then
 wallet:=coalesce(p_settings->>'cash_wallet','');instapay:=coalesce(p_settings->>'instapay_address','');whatsapp:=coalesce(p_settings->>'payment_whatsapp','');details:=coalesce(p_settings->>'payment_details','');
 if length(wallet)>30 or length(instapay)>120 or length(details)>1200 or (wallet<>'' and wallet !~ '^\+?[0-9]{8,15}$') or (whatsapp<>'' and whatsapp !~ '^[1-9][0-9]{7,14}$') then raise exception 'Invalid payment details';end if;
 end if;
 ordering:=r.ordering_enabled;remote:=coalesce(s.remote_ordering_enabled,false);
 if business_capability_enabled(r.id,'online_ordering') then ordering:=coalesce((p_settings->>'ordering_enabled')::boolean,false);remote:=case when r.business_kind='supermarket' then false else coalesce((p_settings->>'remote_ordering_enabled')::boolean,false) end;end if;
 fee:=coalesce(s.delivery_fee,0);free:=s.free_delivery_above;
 if business_capability_enabled(r.id,'delivery_settings') and r.business_kind='supermarket' then
 fee:=(p_settings->>'delivery_fee')::numeric;free:=nullif(p_settings->>'free_delivery_above','')::numeric;
 if fee is null or fee::text in ('NaN','Infinity','-Infinity') or fee not between 0 and 100000 or (free is not null and (free::text in ('NaN','Infinity','-Infinity') or free not between 0 and 1000000)) then raise exception 'Invalid delivery fee';end if;
 end if;
 if business_capability_enabled(r.id,'contact_settings') then
 for k in select unnest(array['location_url','facebook_url','instagram_url','website_url']) loop
 url:=coalesce(p_settings->>k,'');if url<>'' and (length(url)>500 or url !~ '^https://[^\s]+$') then raise exception 'Invalid contact URL';end if;
 end loop;
 end if;
 insert into restaurant_settings(restaurant_id,sound_enabled,show_prices,show_ingredients,remote_ordering_enabled,cash_wallet,instapay_address,payment_whatsapp,payment_details,delivery_fee,free_delivery_above,location_url,facebook_url,instagram_url,website_url)
 values(r.id,coalesce((p_settings->>'sound_enabled')::boolean,true),coalesce((p_settings->>'show_prices')::boolean,true),case when business_capability_enabled(r.id,'product_ingredients') then coalesce((p_settings->>'show_ingredients')::boolean,true) else coalesce(s.show_ingredients,true) end,remote,wallet,instapay,whatsapp,details,round(fee,2),round(free,2),case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'location_url','') else coalesce(s.location_url,'') end,case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'facebook_url','') else coalesce(s.facebook_url,'') end,case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'instagram_url','') else coalesce(s.instagram_url,'') end,case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'website_url','') else coalesce(s.website_url,'') end)
 on conflict(restaurant_id) do update set sound_enabled=excluded.sound_enabled,show_prices=excluded.show_prices,show_ingredients=excluded.show_ingredients,remote_ordering_enabled=excluded.remote_ordering_enabled,cash_wallet=excluded.cash_wallet,instapay_address=excluded.instapay_address,payment_whatsapp=excluded.payment_whatsapp,payment_details=excluded.payment_details,delivery_fee=excluded.delivery_fee,free_delivery_above=excluded.free_delivery_above,location_url=excluded.location_url,facebook_url=excluded.facebook_url,instagram_url=excluded.instagram_url,website_url=excluded.website_url;
 update restaurants set ordering_enabled=ordering,waiter_calls_enabled=case when business_module_enabled(r.id,'service_calls') and business_module_enabled(r.id,'tables') then coalesce((p_settings->>'waiter_calls_enabled')::boolean,false) else r.waiter_calls_enabled end where id=r.id;
end $$;
revoke all on function public.save_dashboard_settings(uuid,jsonb) from public,anon;
grant execute on function public.save_dashboard_settings(uuid,jsonb) to authenticated;

-- Phone edits never rewrite customer snapshots stored on existing invoices.
create function public.customer_phone_key(phone text) returns text language sql immutable set search_path=public as $$
 select case when p ~ '^201[0125][0-9]{8}$' then substring(p from 2) when p ~ '^1[0125][0-9]{8}$' then '0'||p else p end from (select regexp_replace(phone,'[^0-9]','','g') p) x
$$;
revoke all on function public.customer_phone_key(text) from public,anon;
grant execute on function public.customer_phone_key(text) to authenticated,service_role;
create unique index customer_canonical_phone on public.business_customers(restaurant_id,public.customer_phone_key(phone));
grant insert on public.business_customers to authenticated;
create policy customer_manager_insert on public.business_customers for insert to authenticated with check(can_manage_restaurant(restaurant_id) and business_module_enabled(restaurant_id,'customers'));
create function public.guard_customer_write() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='UPDATE' and new.restaurant_id is distinct from old.restaurant_id then raise exception 'Cannot change customer ownership';end if;
 if current_user not in ('postgres','service_role') and (not can_manage_restaurant(new.restaurant_id) or not business_module_enabled(new.restaurant_id,'customers')) then raise exception 'Customers unavailable';end if;
 if current_user not in ('postgres','service_role') and not business_capability_enabled(new.restaurant_id,case when tg_op='INSERT' then 'customer_create' else 'customer_edit' end) then raise exception 'Customer editing disabled';end if;
 new.phone:=public.customer_phone_key(new.phone);return new;
end $$;
revoke all on function public.guard_customer_write() from public;
create trigger customer_write_guard before insert or update on public.business_customers for each row execute function public.guard_customer_write();
create index customer_order_lookup on public.orders(restaurant_id,(customer_details->>'customer_id'));
create function public.customer_directory(p_restaurant uuid,p_query text default '',p_filter text default 'all',p_sort text default 'newest',p_page integer default 1) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare output jsonb;month_start timestamptz;
begin
 if not can_manage_restaurant(p_restaurant) or not business_module_enabled(p_restaurant,'customers') then raise exception 'Customers unavailable';end if;
 if length(p_query)>160 or p_page not between 1 and 10000 or p_filter not in ('all','active','new','repeat') or p_sort not in ('newest','name','recent') then raise exception 'Invalid directory filter';end if;
 select date_trunc('month',now() at time zone business_timezone) at time zone business_timezone into month_start from restaurants where id=p_restaurant;
 with order_stats as (
 select customer_details->>'customer_id' customer_id,case when customer_details->>'customer_id' is null then customer_phone_key(customer_details->>'phone') end phone,count(*)::integer order_count,max(created_at) last_order_at from orders where restaurant_id=p_restaurant and status<>'cancelled' group by 1,2
 ),stats as (
 select c.*,coalesce(o.order_count,0)::integer order_count,o.last_order_at from business_customers c left join lateral (
 select sum(order_count)::integer order_count,max(last_order_at) last_order_at from order_stats where customer_id=c.id::text or (customer_id is null and phone=customer_phone_key(c.phone))
 ) o on true where c.restaurant_id=p_restaurant
 ),filtered as (
 select * from stats where (p_query='' or name ilike '%'||p_query||'%' or phone ilike '%'||p_query||'%' or code ilike '%'||p_query||'%') and (p_filter='all' or (p_filter='active' and last_order_at>=now()-interval '30 days') or (p_filter='new' and created_at>=month_start) or (p_filter='repeat' and order_count>1))
 ),paged as (
 select * from filtered order by case when p_sort='name' then name end asc,case when p_sort='recent' then last_order_at end desc nulls last,created_at desc,id offset (p_page-1)*30 limit 30
 )
 select jsonb_build_object('customers',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),'count',(select count(*) from filtered),'total',(select count(*) from stats),'active',(select count(*) from stats where last_order_at>=now()-interval '30 days'),'new',(select count(*) from stats where created_at>=month_start),'repeat',(select count(*) from stats where order_count>1)) into output;
 return output;
end $$;
revoke all on function public.customer_directory(uuid,text,text,text,integer) from public,anon;
grant execute on function public.customer_directory(uuid,text,text,text,integer) to authenticated;
create or replace function public.link_order_customer() returns trigger language plpgsql security invoker set search_path=public as $$
declare c business_customers;
begin
 if new.order_source='online' then
  if exists(select 1 from restaurants where id=new.restaurant_id and business_kind='supermarket') and length(trim(coalesce(new.customer_details->>'address','')))<5 then raise exception 'Delivery address required';end if;
  if business_module_enabled(new.restaurant_id,'customers') then
   insert into business_customers(restaurant_id,name,phone,address) values(new.restaurant_id,new.customer_details->>'name',new.customer_details->>'phone',coalesce(new.customer_details->>'address','')) on conflict(restaurant_id,public.customer_phone_key(phone)) do nothing;
   select * into c from business_customers where restaurant_id=new.restaurant_id and customer_phone_key(phone)=customer_phone_key(new.customer_details->>'phone');
   new.customer_details:=new.customer_details||jsonb_build_object('customer_id',c.id,'code',c.code);
   new.fiscal_snapshot:=jsonb_set(new.fiscal_snapshot,'{customer}',coalesce(new.fiscal_snapshot->'customer','{}')||jsonb_build_object('phone',c.phone,'code',c.code));
  end if;
 end if;return new;
end $$;
create function public.invoice_overview(p_restaurant uuid,p_day date) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare zone text;start_at timestamptz;end_at timestamptz;output jsonb;
begin
 if not can_manage_restaurant(p_restaurant) or not business_module_enabled(p_restaurant,'invoices') then raise exception 'Invoices unavailable';end if;
 select business_timezone into zone from restaurants where id=p_restaurant;
 start_at:=p_day::timestamp at time zone zone;end_at:=(p_day+1)::timestamp at time zone zone;
 select jsonb_build_object('total',count(*),'paid',count(*) filter(where fiscal_state='paid'),'unpaid',count(*) filter(where fiscal_state='unpaid'),'today',count(*) filter(where created_at>=start_at and created_at<end_at),'totals',coalesce((select jsonb_agg(to_jsonb(t)) from (select currency,sum(case when kind='sale' then gross when kind='refund' then -gross else 0 end) sales from financial_events where restaurant_id=p_restaurant and created_at>=start_at and created_at<end_at group by currency)t),'[]')) into output from orders where restaurant_id=p_restaurant;
 return output;
end $$;
revoke all on function public.invoice_overview(uuid,date) from public,anon;
grant execute on function public.invoice_overview(uuid,date) to authenticated;

alter policy customer_manager_select on public.business_customers using(can_manage_restaurant(restaurant_id) and business_module_enabled(restaurant_id,'customers'));
alter policy customer_manager_update on public.business_customers using(can_manage_restaurant(restaurant_id) and business_module_enabled(restaurant_id,'customers')) with check(can_manage_restaurant(restaurant_id) and business_module_enabled(restaurant_id,'customers'));

revoke all on public.business_customers from anon;
