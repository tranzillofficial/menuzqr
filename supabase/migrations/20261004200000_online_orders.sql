begin;
alter table restaurant_settings add column remote_ordering_enabled boolean not null default false;
alter table restaurant_settings add column cash_wallet text not null default '' check(length(cash_wallet)<=30);
alter table restaurant_settings add column instapay_address text not null default '' check(length(instapay_address)<=120);
alter table restaurant_settings add column payment_whatsapp text not null default '' check(payment_whatsapp='' or payment_whatsapp ~ '^[0-9]{8,15}$');
alter table restaurant_settings add constraint remote_payment_details check(not remote_ordering_enabled or ((cash_wallet<>'' or instapay_address<>'') and payment_whatsapp<>''));
alter table orders add column order_source text check(order_source in ('online','table','pos'));
alter table orders add column customer_details jsonb not null default '{}';
create index orders_incoming on orders(restaurant_id,created_at desc) where status in ('pending','accepted','preparing','ready');
create or replace function category_visible(p_restaurant uuid,p_category uuid) returns boolean language sql stable security invoker set search_path=public as $$
 with recursive ancestors as (select id,parent_id,is_active,array[id] path from categories where id=p_category and restaurant_id=p_restaurant union all select c.id,c.parent_id,c.is_active,a.path||c.id from categories c join ancestors a on c.id=a.parent_id where c.restaurant_id=p_restaurant and not c.id=any(a.path)) select coalesce(bool_and(is_active) and bool_or(parent_id is null),false) from ancestors;
$$;
revoke all on function category_visible(uuid,uuid) from public,anon,authenticated;
grant execute on function category_visible(uuid,uuid) to service_role;
create or replace function create_fiscal_order(p_actor uuid,p_restaurant uuid,p_request uuid,p_lines jsonb,p_table uuid,p_note text,p_payment text,p_received numeric,p_customer jsonb default '{}',p_guest boolean default false,p_session text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r restaurants; o orders; line jsonb; v record; qty integer; rate numeric; code text; amount numeric; net numeric; vat numeric; gross numeric; net_sum numeric:=0; vat_sum numeric:=0; gross_sum numeric:=0; rows_json jsonb:='[]'; breakdown jsonb; snapshot jsonb; invoice_kind text;
begin
 select * into r from restaurants where id=p_restaurant for update;
 if not found or r.status<>'active' or (r.activation_expires_at is not null and r.activation_expires_at<=now()) then raise exception 'Restaurant is unavailable'; end if;
 if not p_guest then
   if not exists(select 1 from restaurant_members where restaurant_id=r.id and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
   if r.pos_status<>'active' or r.pos_expires_at is null or r.pos_expires_at<=now() or not exists(select 1 from platform_settings where id=1 and pos_enabled) then raise exception 'POS unavailable'; end if;
 else
   if r.enabled_modules is not null and (not ('orders'=any(r.enabled_modules)) or (p_table is not null and not ('tables'=any(r.enabled_modules)))) then raise exception 'Online ordering unavailable'; end if;
   if p_table is null then
     if not r.ordering_enabled or (r.enabled_modules is not null and not ('orders'=any(r.enabled_modules))) or not exists(select 1 from restaurant_settings s where s.restaurant_id=r.id and s.remote_ordering_enabled and (s.cash_wallet<>'' or s.instapay_address<>'') and s.payment_whatsapp<>'') then raise exception 'Online ordering unavailable'; end if;
     if p_request is null or length(coalesce(p_session,''))<16 or length(trim(coalesce(p_customer->>'name','')))<2 or coalesce(p_customer->>'phone','') !~ '^\+?[0-9]{8,15}$' then raise exception 'Customer details required'; end if;
   elsif not r.ordering_enabled and not exists(select 1 from restaurant_members where restaurant_id=r.id and user_id=p_actor and is_active and (role in ('owner','manager') or (service_permissions @> array['orders.create'] or (service_permissions is null and role<>'chef')))) then raise exception 'Table ordering unavailable'; end if;
   if p_payment is not null then raise exception 'Guest order cannot record payment'; end if;
 end if;
 if p_request is not null then
   select * into o from orders where pos_request_id=p_request;
   if found then if o.restaurant_id<>r.id or o.placed_by is distinct from p_actor or (p_guest and o.session_id is distinct from p_session) then raise exception 'Invalid request'; end if; return to_jsonb(o); end if;
 elsif not p_guest then raise exception 'Request ID required'; end if;
 if p_table is not null and not exists(select 1 from restaurant_tables where id=p_table and restaurant_id=r.id and is_active) then raise exception 'Invalid table'; end if;
 if p_guest and (select count(*) from orders where table_id=p_table and status in ('pending','accepted','preparing','ready'))>=5 then raise exception 'Too many open table orders'; end if;
 if p_guest and p_table is null and (select count(*) from orders where restaurant_id=r.id and session_id=p_session and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many online orders'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Invalid items'; end if;
 if not p_guest and (p_payment is null or p_payment not in ('cash','card')) then raise exception 'Invalid payment'; end if;
 for line in select * from jsonb_array_elements(p_lines) loop
   if (line->>'quantity')::numeric <> trunc((line->>'quantity')::numeric) then raise exception 'Invalid quantity'; end if;
   qty:=(line->>'quantity')::integer;
   if qty is null or qty not between 1 and 99 then raise exception 'Invalid quantity'; end if;
   select pv.id,pv.product_id,pv.name,pv.price,p.name as product_name,p.vat_code into v from product_variants pv join products p on p.id=pv.product_id where pv.id=(line->>'variantId')::uuid and pv.restaurant_id=r.id and p.restaurant_id=r.id and pv.is_active and p.is_active and (not p_guest or p.category_id is null or public.category_visible(r.id,p.category_id)) for share of pv,p;
   if not found or v.price<0 then raise exception 'Product unavailable'; end if;
   code:=case when r.tax_mode='none' or not r.vat_registered then 'not_registered' else v.vat_code end;
   rate:=case when not r.vat_registered or r.tax_mode='none' or v.vat_code in ('zero','exempt') then 0 else coalesce((r.tax_rates->r.tax_mode->>v.vat_code)::numeric,case when r.tax_mode='egypt' and v.vat_code='standard' then 14 else fiscal_vat_rate(r.tax_mode,r.vat_registered,v.vat_code) end) end;
   amount:=round(v.price*qty,2);
   vat:=case when r.prices_include_vat then round(amount*rate/(100+rate),2) else round(amount*rate/100,2) end;
   gross:=case when r.prices_include_vat then amount else amount+vat end; net:=gross-vat;
   net_sum:=net_sum+net; vat_sum:=vat_sum+vat; gross_sum:=gross_sum+gross;
   rows_json:=rows_json||jsonb_build_array(jsonb_build_object('product_id',v.product_id,'variant_id',v.id,'product_name',v.product_name,'variant_name',v.name,'unit_price',v.price,'quantity',qty,'note',left(line->>'note',200),'line_total',gross,'net_total',net,'vat_total',vat,'vat_code',code,'vat_rate',rate));
 end loop;
 select jsonb_agg(to_jsonb(b)) into breakdown from (select vat_code as code,vat_rate as rate,sum(net_total) as net,sum(vat_total) as vat,sum(line_total) as gross from jsonb_to_recordset(rows_json) as x(vat_code text,vat_rate numeric,net_total numeric,vat_total numeric,line_total numeric) group by vat_code,vat_rate order by vat_rate,vat_code) b;
 if not p_guest and p_payment='cash' and (p_received is null or p_received<gross_sum or p_received::text in ('NaN','Infinity','-Infinity')) then raise exception 'Amount received is below total'; end if;
 if coalesce((p_customer->>'full_invoice')::boolean,false) and (length(trim(coalesce(p_customer->>'name','')))<2 or length(trim(coalesce(p_customer->>'address','')))<5) then raise exception 'Full invoice requires customer name and address'; end if;
 invoice_kind:=case when not r.vat_registered or r.tax_mode in ('none','saudi','egypt') then 'receipt' when coalesce((p_customer->>'full_invoice')::boolean,false) then 'full' when r.tax_mode='uk' and gross_sum<=250 and not exists(select 1 from jsonb_array_elements(breakdown) b where b->>'code'='exempt') then 'simplified' when r.tax_mode='uae' and coalesce(p_customer->>'vat_number','')='' then 'simplified' else 'receipt' end;
 snapshot:=jsonb_build_object('version',2,'menu_prices_include_vat',r.menu_prices_include_vat,'tax_rates',r.tax_rates,'mode',r.tax_mode,'registered',r.vat_registered,'vat_number',r.vat_number,'legal_name',coalesce(r.legal_name,r.name),'address',coalesce(r.tax_address,r.address),'timezone',r.business_timezone,'inclusive',r.prices_include_vat,'customer',jsonb_build_object('name',left(p_customer->>'name',160),'address',left(p_customer->>'address',400),'vat_number',left(p_customer->>'vat_number',32)),'invoice_kind',invoice_kind,'net',net_sum,'vat',vat_sum,'gross',gross_sum,'breakdown',breakdown);
 perform set_config('fiscal.actor',coalesce(p_actor::text,''),true); perform set_config('fiscal.reason','',true);
 insert into orders(restaurant_id,table_id,placed_by,status,note,total,currency,pos_request_id,payment_method,amount_received,fiscal_snapshot,fiscal_state,paid_at,fiscal_actor,session_id,order_source,customer_details)
 values(r.id,p_table,p_actor,case when not p_guest and p_table is null then 'completed' else 'pending' end,left(p_note,400),gross_sum,r.currency,p_request,p_payment,case when p_guest then null when p_payment='cash' then round(p_received,2) else gross_sum end,snapshot,case when p_guest then 'unpaid' else 'paid' end,case when p_guest then null else clock_timestamp() end,p_actor,left(p_session,64),case when p_guest and p_table is null then 'online' when p_guest then 'table' else 'pos' end,case when p_guest and p_table is null then jsonb_build_object('name',left(trim(p_customer->>'name'),160),'phone',left(p_customer->>'phone',16)) else '{}'::jsonb end) returning * into o;
 perform set_config('fiscal.build_order',o.id::text,true);
 insert into order_items(order_id,restaurant_id,product_id,variant_id,product_name,variant_name,unit_price,quantity,note,line_total,net_total,vat_total,vat_code,vat_rate)
 select o.id,r.id,x.product_id,x.variant_id,x.product_name,x.variant_name,x.unit_price,x.quantity,x.note,x.line_total,x.net_total,x.vat_total,x.vat_code,x.vat_rate from jsonb_to_recordset(rows_json) as x(product_id uuid,variant_id uuid,product_name text,variant_name text,unit_price numeric,quantity integer,note text,line_total numeric,net_total numeric,vat_total numeric,vat_code text,vat_rate numeric);
 perform set_config('fiscal.build_order','',true);
 if not p_guest then perform record_financial_event(o.id,'sale',p_actor,null); end if;
 return to_jsonb(o);
end $$;


create function save_storefront_settings(p_restaurant uuid,p_ordering boolean,p_waiter boolean,p_sound boolean,p_prices boolean,p_ingredients boolean,p_remote boolean,p_wallet text,p_instapay text,p_whatsapp text) returns void language plpgsql security invoker set search_path=public as $$
begin
 if not can_manage_restaurant(p_restaurant) then raise exception 'Not authorized'; end if;
 if length(p_wallet)>30 or length(p_instapay)>120 or (p_wallet<>'' and p_wallet !~ '^\+?[0-9]{8,15}$') or (p_whatsapp<>'' and p_whatsapp !~ '^[0-9]{8,15}$') then raise exception 'Invalid payment details'; end if;
 insert into restaurant_settings(restaurant_id,sound_enabled,show_prices,show_ingredients,remote_ordering_enabled,cash_wallet,instapay_address,payment_whatsapp) values(p_restaurant,p_sound,p_prices,p_ingredients,p_remote,p_wallet,p_instapay,p_whatsapp) on conflict(restaurant_id) do update set sound_enabled=excluded.sound_enabled,show_prices=excluded.show_prices,show_ingredients=excluded.show_ingredients,remote_ordering_enabled=excluded.remote_ordering_enabled,cash_wallet=excluded.cash_wallet,instapay_address=excluded.instapay_address,payment_whatsapp=excluded.payment_whatsapp;
 update restaurants set ordering_enabled=p_ordering,waiter_calls_enabled=p_waiter where id=p_restaurant;
end $$;
revoke all on function save_storefront_settings(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text) from public,anon;
grant execute on function save_storefront_settings(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text) to authenticated;
alter table financial_events drop constraint financial_events_payment_method_check;
alter table financial_events add constraint financial_events_payment_method_check check(payment_method in ('cash','card','transfer'));
create or replace function change_fiscal_order(p_actor uuid,p_restaurant uuid,p_order uuid,p_action text,p_reason text default '',p_payment text default null,p_received numeric default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare o orders; role_name text; perms text[]; required_perm text;
begin
 select role,service_permissions into role_name,perms from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active;
 if not found then raise exception 'Not authorized'; end if;
 perform 1 from restaurants where id=p_restaurant for update;
 select * into o from orders where id=p_order and restaurant_id=p_restaurant for update;
 if not found then raise exception 'Order not found'; end if;
 perform set_config('fiscal.actor',p_actor::text,true); perform set_config('fiscal.reason',left(trim(p_reason),400),true);
 if p_action in ('refund','void','pay') then
   if role_name not in ('owner','manager') and not(p_action='void' and coalesce('orders.cancel'=any(perms),false)) then raise exception 'Only a manager can change financial records'; end if;
   if p_action in ('refund','void') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Enter a reason'; end if;
   if p_action='refund' then
     if o.fiscal_state='refunded' then return to_jsonb(o); end if;
     if o.fiscal_state<>'paid' then raise exception 'Only paid sales can be refunded'; end if;
     update orders set fiscal_state='refunded',status='cancelled',fiscal_actor=p_actor,fiscal_reason=left(p_reason,400) where id=o.id returning * into o;
     perform record_financial_event(o.id,'refund',p_actor,p_reason);
   elsif p_action='void' then
     if o.fiscal_state='void' then return to_jsonb(o); end if;
     if o.fiscal_state not in ('unpaid','legacy') or o.status in ('completed','cancelled') then raise exception 'Paid sales require a refund'; end if;
     update orders set fiscal_state='void',status='cancelled',fiscal_actor=p_actor,fiscal_reason=left(p_reason,400) where id=o.id returning * into o;
     perform record_financial_event(o.id,'void',p_actor,p_reason);
   else
     if o.fiscal_state='paid' then return to_jsonb(o); end if;
     if o.fiscal_state<>'unpaid' or o.status='cancelled' then raise exception 'Order cannot be paid'; end if;
     if p_payment is null or p_payment not in ('cash','card','transfer') then raise exception 'Choose payment method'; end if;
     if p_payment='cash' and (p_received is null or p_received<o.total or p_received::text in ('NaN','Infinity','-Infinity')) then raise exception 'Amount received below total'; end if;
     update orders set fiscal_state='paid',paid_at=clock_timestamp(),payment_method=p_payment,amount_received=case when p_payment='cash' then round(p_received,2) else total end,fiscal_actor=p_actor where id=o.id returning * into o;
     perform record_financial_event(o.id,'sale',p_actor,null);
   end if;
 else
   required_perm:=case p_action when 'accepted' then 'orders.accept' when 'preparing' then 'orders.prepare' when 'ready' then 'orders.prepare' when 'completed' then 'orders.complete' end;
   if required_perm is null then raise exception 'Use a void or refund to cancel'; end if;
   if role_name not in ('owner','manager') and not(case when perms is not null then required_perm=any(perms) when role_name='chef' then required_perm in ('orders.accept','orders.prepare') else required_perm='orders.complete' end) then raise exception 'Permission denied'; end if;
   if o.status in ('completed','cancelled') or o.fiscal_state in ('refunded','void') then raise exception 'Order already closed'; end if;
   update orders set status=p_action,fiscal_actor=p_actor where id=o.id returning * into o;
 end if;
 return to_jsonb(o);
end $$;

create or replace function fiscal_summary(p_restaurant uuid,p_from bigint,p_through bigint) returns jsonb language sql stable security invoker set search_path=public as $$
 with e as (select *,case kind when 'sale' then 1 when 'refund' then -1 else 0 end as sign from financial_events where restaurant_id=p_restaurant and id>p_from and id<=p_through),
 rates as (select currency,b->>'code' as code,(b->>'rate')::numeric as rate,sum(sign*(b->>'net')::numeric) as net,sum(sign*(b->>'vat')::numeric) as vat,sum(sign*(b->>'gross')::numeric) as gross from e cross join lateral jsonb_array_elements(breakdown) b where sign<>0 group by currency,b->>'code',(b->>'rate')::numeric),
 grouped as (select currency,coalesce(sum(gross) filter(where kind='sale'),0) as sales,coalesce(sum(gross) filter(where kind='refund'),0) as refunds,coalesce(sum(gross) filter(where kind='void'),0) as voids,sum(sign*gross) as "netSales",sum(sign*vat) as vat,coalesce(sum(sign*gross) filter(where payment_method='cash'),0) as cash,coalesce(sum(sign*gross) filter(where payment_method='card'),0) as card,coalesce(sum(sign*gross) filter(where payment_method='transfer'),0) as transfer from e group by currency)
 select jsonb_build_object('saleCount',(select count(*) from e where kind='sale'),'refundCount',(select count(*) from e where kind='refund'),'voidCount',(select count(*) from e where kind='void'),'currencies',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('breakdown',coalesce((select jsonb_agg(to_jsonb(r)-'currency' order by r.rate,r.code) from rates r where r.currency=g.currency),'[]'))) from grouped g),'[]'));
$$;

create or replace function daily_fiscal_report(p_actor uuid,p_restaurant uuid,p_day date) returns jsonb language plpgsql security invoker set search_path=public as $$
declare tz text; result jsonb; eids bigint[];
begin
 if not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
 select business_timezone into tz from restaurants where id=p_restaurant;
 -- Time boundaries preserve DST. Events never use the current product VAT rate.
 with e as (select *,case kind when 'sale' then 1 when 'refund' then -1 else 0 end as sign from financial_events where restaurant_id=p_restaurant and created_at>=p_day::timestamp at time zone tz and created_at<(p_day+1)::timestamp at time zone tz),
 rates as (select currency,b->>'code' as code,(b->>'rate')::numeric as rate,sum(sign*(b->>'net')::numeric) as net,sum(sign*(b->>'vat')::numeric) as vat,sum(sign*(b->>'gross')::numeric) as gross from e cross join lateral jsonb_array_elements(breakdown) b where sign<>0 group by currency,b->>'code',(b->>'rate')::numeric),
 grouped as (select currency,coalesce(sum(gross) filter(where kind='sale'),0) as sales,coalesce(sum(gross) filter(where kind='refund'),0) as refunds,coalesce(sum(gross) filter(where kind='void'),0) as voids,sum(sign*gross) as "netSales",sum(sign*vat) as vat,coalesce(sum(sign*gross) filter(where payment_method='cash'),0) as cash,coalesce(sum(sign*gross) filter(where payment_method='card'),0) as card,coalesce(sum(sign*gross) filter(where payment_method='transfer'),0) as transfer from e group by currency)
 select jsonb_build_object('saleCount',(select count(*) from e where kind='sale'),'refundCount',(select count(*) from e where kind='refund'),'voidCount',(select count(*) from e where kind='void'),'currencies',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('breakdown',coalesce((select jsonb_agg(to_jsonb(r)-'currency' order by r.rate,r.code) from rates r where r.currency=g.currency),'[]'))) from grouped g),'[]')) into result;
 return result;
end $$;


commit;
