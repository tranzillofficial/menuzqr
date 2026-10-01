begin;
create schema if not exists fiscal_private;
revoke all on schema fiscal_private from public,anon,authenticated;
alter table restaurants add column tax_mode text not null default 'none' check(tax_mode in ('none','uk','uae','saudi'));
alter table restaurants add column vat_registered boolean not null default false;
alter table restaurants add column vat_number text;
alter table restaurants add column prices_include_vat boolean not null default true;
alter table restaurants add column legal_name text;
alter table restaurants add column tax_address text;
alter table restaurants add column business_timezone text not null default 'Africa/Cairo';
alter table products add column vat_code text not null default 'standard' check(vat_code in ('standard','reduced','zero','exempt'));
alter table orders add column fiscal_snapshot jsonb;
alter table orders add column fiscal_state text not null default 'legacy' check(fiscal_state in ('legacy','unpaid','paid','refunded','void'));
alter table orders add column paid_at timestamptz;
alter table orders add column fiscal_actor uuid;
alter table orders add column fiscal_reason text;
alter table order_items add column vat_code text;
alter table order_items add column vat_rate numeric(5,2);
alter table order_items add column net_total numeric(12,2);
alter table order_items add column vat_total numeric(12,2);

create table order_audit (
 id bigint generated always as identity primary key, restaurant_id uuid not null references restaurants(id) on delete restrict,
 order_id uuid, entity text not null, entity_id uuid not null, action text not null,
 actor_id uuid, actor_name text, reason text, before_data jsonb, after_data jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index order_audit_restaurant_time on order_audit(restaurant_id,created_at,id);
create index order_audit_order on order_audit(order_id,id);
create table financial_events (
 id bigint generated always as identity primary key, restaurant_id uuid not null references restaurants(id) on delete restrict,
 order_id uuid not null references orders(id) on delete restrict, kind text not null check(kind in ('sale','refund','void')),
 currency text not null, gross numeric(12,2) not null, net numeric(12,2) not null, vat numeric(12,2) not null,
 payment_method text check(payment_method in ('cash','card')), breakdown jsonb not null,
 actor_id uuid, actor_name text, reason text, document_number text,
 created_at timestamptz not null default clock_timestamp(), unique(order_id,kind)
);
create index financial_events_restaurant_time on financial_events(restaurant_id,created_at,id);
create table z_reports (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants(id) on delete restrict,
 report_number bigint not null, business_date date not null, timezone text not null,
 from_event_id bigint not null, through_event_id bigint not null, summary jsonb not null,
 closed_at timestamptz not null default clock_timestamp(), closed_by uuid not null, closed_by_name text,
 unique(restaurant_id,business_date), unique(restaurant_id,report_number)
);
create index z_reports_restaurant_time on z_reports(restaurant_id,closed_at);
alter table order_audit enable row level security;
alter table financial_events enable row level security;
alter table z_reports enable row level security;
create policy fiscal_audit_read on order_audit for select to authenticated using(can_manage_restaurant(restaurant_id) or is_admin());
create policy fiscal_events_read on financial_events for select to authenticated using(can_manage_restaurant(restaurant_id) or is_admin());
create policy fiscal_z_read on z_reports for select to authenticated using(can_manage_restaurant(restaurant_id) or is_admin());
revoke all on order_audit,financial_events,z_reports from anon,authenticated;
grant select on order_audit,financial_events,z_reports to authenticated;
grant all on order_audit,financial_events,z_reports to service_role;
grant usage,select on sequence order_audit_id_seq,financial_events_id_seq to service_role;
revoke insert,update,delete on orders,order_items from authenticated,anon;
drop policy if exists "orders: delete by admin" on orders;

-- Preserve existing sales without inventing historical VAT rates.
update orders set fiscal_state='paid',paid_at=created_at where fiscal_state='legacy' and payment_method in ('cash','card') and status<>'cancelled';
insert into financial_events(restaurant_id,order_id,kind,currency,gross,net,vat,payment_method,breakdown,actor_id,document_number,created_at)
select restaurant_id,id,'sale',currency,total,total,0,payment_method,jsonb_build_array(jsonb_build_object('code','legacy_unknown','rate',0,'net',total,'vat',0,'gross',total)),placed_by,order_number::text,created_at from orders where fiscal_state='paid' and fiscal_snapshot is null;
insert into order_audit(restaurant_id,order_id,entity,entity_id,action,actor_id,after_data)
select restaurant_id,id,'orders',id,'migration_baseline',placed_by,to_jsonb(o)-'public_token'-'session_id' from orders o;

create table vat_documents (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants(id) on delete restrict,
 order_id uuid not null unique references orders(id) on delete restrict, document_number text not null, snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp(), issued_by uuid not null
);
create index vat_documents_restaurant on vat_documents(restaurant_id);
alter table vat_documents enable row level security;
create policy vat_documents_read on vat_documents for select to authenticated using(can_manage_restaurant(restaurant_id) or is_admin());
revoke all on vat_documents from public,anon,authenticated;
grant select on vat_documents to authenticated;grant all on vat_documents to service_role;

create function fiscal_private.no_mutation() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'Fiscal records cannot be deleted or rewritten. Use a refund or void.'; end $$;
create trigger keep_audit before update or delete on order_audit for each row execute function fiscal_private.no_mutation();
create trigger keep_events before update or delete on financial_events for each row execute function fiscal_private.no_mutation();
create trigger keep_vat_documents before update or delete on vat_documents for each row execute function fiscal_private.no_mutation();
create trigger keep_z before update or delete on z_reports for each row execute function fiscal_private.no_mutation();
create trigger keep_orders before delete on orders for each row execute function fiscal_private.no_mutation();
create trigger keep_items before delete on order_items for each row execute function fiscal_private.no_mutation();

create function fiscal_private.audit_change() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; eid uuid; oid uuid; actor uuid; label text; b jsonb; a jsonb;
begin
 b:=case when tg_op='INSERT' then null else to_jsonb(old) end;
 a:=case when tg_op='DELETE' then null else to_jsonb(new) end;
 if tg_op='UPDATE' and (b-'updated_at')=(a-'updated_at') then return new; end if;
 rid:=case when tg_table_name='restaurants' then (coalesce(a,b)->>'id')::uuid else (coalesce(a,b)->>'restaurant_id')::uuid end;
 eid:=(coalesce(a,b)->>'id')::uuid;
 oid:=case when tg_table_name='orders' then eid when tg_table_name in ('order_items','vat_documents') then (coalesce(a,b)->>'order_id')::uuid else null end;
 actor:=coalesce(nullif(current_setting('fiscal.actor',true),'')::uuid,auth.uid());
 select coalesce(m.display_name,p.full_name,p.email,actor::text) into label from profiles p left join restaurant_members m on m.user_id=p.id and m.restaurant_id=rid where p.id=actor limit 1;
 insert into order_audit(restaurant_id,order_id,entity,entity_id,action,actor_id,actor_name,reason,before_data,after_data)
 values(rid,oid,tg_table_name,eid,lower(tg_op),actor,label,nullif(current_setting('fiscal.reason',true),''),b-'public_token'-'session_id',a-'public_token'-'session_id');
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function fiscal_private.audit_change() from public,anon,authenticated;
create trigger audit_orders after insert or update on orders for each row execute function fiscal_private.audit_change();
create trigger audit_items after insert or update on order_items for each row execute function fiscal_private.audit_change();
create trigger audit_vat_documents after insert on vat_documents for each row execute function fiscal_private.audit_change();
create trigger audit_products after insert or update or delete on products for each row execute function fiscal_private.audit_change();
create trigger audit_variants after insert or update or delete on product_variants for each row execute function fiscal_private.audit_change();
create trigger audit_restaurant after update on restaurants for each row execute function fiscal_private.audit_change();

create function fiscal_private.guard_order() returns trigger language plpgsql set search_path=public as $$
begin
 if (to_jsonb(new)-array['status','updated_at','print_count','last_printed_at','last_printed_by','payment_method','amount_received','paid_at','fiscal_state','fiscal_actor','fiscal_reason']) is distinct from
    (to_jsonb(old)-array['status','updated_at','print_count','last_printed_at','last_printed_by','payment_method','amount_received','paid_at','fiscal_state','fiscal_actor','fiscal_reason']) then raise exception 'Order totals, items and VAT snapshot are immutable'; end if;
 if old.fiscal_state in ('paid','refunded','void') and (new.payment_method is distinct from old.payment_method or new.amount_received is distinct from old.amount_received or new.paid_at is distinct from old.paid_at) then raise exception 'Payment is immutable'; end if;
 if old.fiscal_state in ('refunded','void') and (new.status<>old.status or new.fiscal_state<>old.fiscal_state) then raise exception 'Closed financial record'; end if;
 if new.fiscal_state is distinct from old.fiscal_state then
   if not ((old.fiscal_state='unpaid' and new.fiscal_state in ('paid','void')) or (old.fiscal_state='paid' and new.fiscal_state='refunded') or (old.fiscal_state='legacy' and new.fiscal_state='void' and old.status<>'completed')) then raise exception 'Invalid financial transition'; end if;
 end if;
 if new.status='cancelled' and old.fiscal_state in ('paid','unpaid') and new.fiscal_state not in ('refunded','void') then raise exception 'Use a refund or void'; end if;
 if old.status in ('completed','cancelled') and new.status is distinct from old.status and not(new.fiscal_state='refunded') then raise exception 'Closed order cannot be reopened'; end if;
 return new;
end $$;
create trigger guard_fiscal_order before update on orders for each row execute function fiscal_private.guard_order();
create function fiscal_private.guard_new_order() returns trigger language plpgsql set search_path=public as $$
begin
 if new.fiscal_snapshot is null or new.fiscal_state not in ('paid','unpaid') or new.total is distinct from (new.fiscal_snapshot->>'gross')::numeric then raise exception 'Use the atomic fiscal order transaction'; end if;
 return new;
end $$;
create trigger require_fiscal_snapshot before insert on orders for each row execute function fiscal_private.guard_new_order();
create function fiscal_private.guard_new_item() returns trigger language plpgsql set search_path=public as $$
begin
 if new.order_id::text is distinct from current_setting('fiscal.build_order',true) then raise exception 'Items must be part of the atomic order transaction'; end if;
 return new;
end $$;
create trigger require_atomic_items before insert on order_items for each row execute function fiscal_private.guard_new_item();

create function fiscal_private.guard_item() returns trigger language plpgsql set search_path=public as $$
begin
 -- FK cleanup after deleting a product may clear its ids; sale descriptions remain.
 if (to_jsonb(new)-array['product_id','variant_id']) is distinct from (to_jsonb(old)-array['product_id','variant_id']) or (new.product_id is distinct from old.product_id and new.product_id is not null) or (new.variant_id is distinct from old.variant_id and new.variant_id is not null) then raise exception 'Sale line is immutable'; end if;
 return new;
end $$;
create trigger guard_fiscal_item before update on order_items for each row execute function fiscal_private.guard_item();

create function fiscal_private.validate_market() returns trigger language plpgsql set search_path=public as $$
begin
 if new.tax_mode<>'none' and new.currency<>(case new.tax_mode when 'uk' then 'GBP' when 'uae' then 'AED' else 'SAR' end) then raise exception 'Tax mode requires its local currency'; end if;
 if not exists(select 1 from pg_timezone_names where name=new.business_timezone) then raise exception 'Invalid timezone'; end if;
 if new.vat_registered and (new.tax_mode='none' or length(trim(coalesce(new.vat_number,'')))<5 or length(trim(coalesce(new.legal_name,'')))<2 or length(trim(coalesce(new.tax_address,'')))<5) then raise exception 'VAT number, legal name and business address are required'; end if;
 if new.tax_mode='uk' and new.vat_registered and new.vat_number !~ '^(GB)?[0-9]{9}([0-9]{3})?$' then raise exception 'Invalid UK VAT number'; end if;
 if new.tax_mode in ('uae','saudi') and new.vat_registered and new.vat_number !~ '^[0-9]{15}$' then raise exception 'VAT number must have 15 digits'; end if;
 return new;
end $$;
create trigger validate_tax_market before insert or update on restaurants for each row execute function fiscal_private.validate_market();

create function fiscal_vat_rate(p_mode text,p_registered boolean,p_code text) returns numeric language sql immutable security invoker set search_path=public as $$ select case when not p_registered or p_mode='none' or p_code in ('zero','exempt') then 0 when p_code='reduced' and p_mode='uk' then 5 when p_code='reduced' then 0 when p_mode='uk' then 20 when p_mode='uae' then 5 when p_mode='saudi' then 15 else 0 end::numeric $$;
revoke all on function fiscal_vat_rate(text,boolean,text) from public,anon,authenticated;
grant execute on function fiscal_vat_rate(text,boolean,text) to service_role;

create function create_fiscal_order(p_actor uuid,p_restaurant uuid,p_request uuid,p_lines jsonb,p_table uuid,p_note text,p_payment text,p_received numeric,p_customer jsonb default '{}',p_guest boolean default false,p_session text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r restaurants; o orders; line jsonb; v record; qty integer; rate numeric; code text; amount numeric; net numeric; vat numeric; gross numeric; net_sum numeric:=0; vat_sum numeric:=0; gross_sum numeric:=0; rows_json jsonb:='[]'; breakdown jsonb; snapshot jsonb; invoice_kind text;
begin
 select * into r from restaurants where id=p_restaurant for update;
 if not found or r.status<>'active' or (r.activation_expires_at is not null and r.activation_expires_at<=now()) then raise exception 'Restaurant is unavailable'; end if;
 if not p_guest then
   if not exists(select 1 from restaurant_members where restaurant_id=r.id and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
   if r.pos_status<>'active' or r.pos_expires_at is null or r.pos_expires_at<=now() or not exists(select 1 from platform_settings where id=1 and pos_enabled) then raise exception 'POS unavailable'; end if;
 else
   if p_table is null or (not r.ordering_enabled and not exists(select 1 from restaurant_members where restaurant_id=r.id and user_id=p_actor and is_active and (role in ('owner','manager') or (service_permissions @> array['orders.create'] or (service_permissions is null and role<>'chef'))))) then raise exception 'Table ordering unavailable'; end if;
   if p_payment is not null then raise exception 'Guest order cannot record payment'; end if;
 end if;
 if p_request is not null then
   select * into o from orders where pos_request_id=p_request;
   if found then if o.restaurant_id<>r.id or o.placed_by is distinct from p_actor then raise exception 'Invalid request'; end if; return to_jsonb(o); end if;
 elsif not p_guest then raise exception 'Request ID required'; end if;
 if p_table is not null and not exists(select 1 from restaurant_tables where id=p_table and restaurant_id=r.id and is_active) then raise exception 'Invalid table'; end if;
 if p_guest and (select count(*) from orders where table_id=p_table and status in ('pending','accepted','preparing','ready'))>=5 then raise exception 'Too many open table orders'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Invalid items'; end if;
 if not p_guest and (p_payment is null or p_payment not in ('cash','card')) then raise exception 'Invalid payment'; end if;
 for line in select * from jsonb_array_elements(p_lines) loop
   if (line->>'quantity')::numeric <> trunc((line->>'quantity')::numeric) then raise exception 'Invalid quantity'; end if;
   qty:=(line->>'quantity')::integer;
   if qty is null or qty not between 1 and 99 then raise exception 'Invalid quantity'; end if;
   select pv.id,pv.product_id,pv.name,pv.price,p.name as product_name,p.vat_code into v from product_variants pv join products p on p.id=pv.product_id where pv.id=(line->>'variantId')::uuid and pv.restaurant_id=r.id and p.restaurant_id=r.id and pv.is_active and p.is_active for share of pv,p;
   if not found or v.price<0 then raise exception 'Product unavailable'; end if;
   if r.tax_mode in ('uae','saudi') and v.vat_code='reduced' then raise exception 'Reduced VAT is only configured for UK products'; end if;
   code:=case when r.tax_mode='none' or not r.vat_registered then 'not_registered' else v.vat_code end;
   rate:=fiscal_vat_rate(r.tax_mode,r.vat_registered,v.vat_code);
   amount:=round(v.price*qty,2);
   vat:=case when r.prices_include_vat then round(amount*rate/(100+rate),2) else round(amount*rate/100,2) end;
   gross:=case when r.prices_include_vat then amount else amount+vat end; net:=gross-vat;
   net_sum:=net_sum+net; vat_sum:=vat_sum+vat; gross_sum:=gross_sum+gross;
   rows_json:=rows_json||jsonb_build_array(jsonb_build_object('product_id',v.product_id,'variant_id',v.id,'product_name',v.product_name,'variant_name',v.name,'unit_price',v.price,'quantity',qty,'note',left(line->>'note',200),'line_total',gross,'net_total',net,'vat_total',vat,'vat_code',code,'vat_rate',rate));
 end loop;
 select jsonb_agg(to_jsonb(b)) into breakdown from (select vat_code as code,vat_rate as rate,sum(net_total) as net,sum(vat_total) as vat,sum(line_total) as gross from jsonb_to_recordset(rows_json) as x(vat_code text,vat_rate numeric,net_total numeric,vat_total numeric,line_total numeric) group by vat_code,vat_rate order by vat_rate,vat_code) b;
 if not p_guest and p_payment='cash' and (p_received is null or p_received<gross_sum or p_received::text in ('NaN','Infinity','-Infinity')) then raise exception 'Amount received is below total'; end if;
 if coalesce((p_customer->>'full_invoice')::boolean,false) and (length(trim(coalesce(p_customer->>'name','')))<2 or length(trim(coalesce(p_customer->>'address','')))<5) then raise exception 'Full invoice requires customer name and address'; end if;
 invoice_kind:=case when not r.vat_registered or r.tax_mode in ('none','saudi') then 'receipt' when coalesce((p_customer->>'full_invoice')::boolean,false) then 'full' when r.tax_mode='uk' and gross_sum<=250 and not exists(select 1 from jsonb_array_elements(breakdown) b where b->>'code'='exempt') then 'simplified' when r.tax_mode='uae' and coalesce(p_customer->>'vat_number','')='' then 'simplified' else 'receipt' end;
 snapshot:=jsonb_build_object('version',1,'mode',r.tax_mode,'registered',r.vat_registered,'vat_number',r.vat_number,'legal_name',coalesce(r.legal_name,r.name),'address',coalesce(r.tax_address,r.address),'timezone',r.business_timezone,'inclusive',r.prices_include_vat,'customer',jsonb_build_object('name',left(p_customer->>'name',160),'address',left(p_customer->>'address',400),'vat_number',left(p_customer->>'vat_number',32)),'invoice_kind',invoice_kind,'net',net_sum,'vat',vat_sum,'gross',gross_sum,'breakdown',breakdown);
 perform set_config('fiscal.actor',coalesce(p_actor::text,''),true); perform set_config('fiscal.reason','',true);
 insert into orders(restaurant_id,table_id,placed_by,status,note,total,currency,pos_request_id,payment_method,amount_received,fiscal_snapshot,fiscal_state,paid_at,fiscal_actor,session_id)
 values(r.id,p_table,p_actor,case when not p_guest and p_table is null then 'completed' else 'pending' end,left(p_note,400),gross_sum,r.currency,p_request,p_payment,case when p_guest then null when p_payment='cash' then round(p_received,2) else gross_sum end,snapshot,case when p_guest then 'unpaid' else 'paid' end,case when p_guest then null else clock_timestamp() end,p_actor,left(p_session,64)) returning * into o;
 perform set_config('fiscal.build_order',o.id::text,true);
 insert into order_items(order_id,restaurant_id,product_id,variant_id,product_name,variant_name,unit_price,quantity,note,line_total,net_total,vat_total,vat_code,vat_rate)
 select o.id,r.id,x.product_id,x.variant_id,x.product_name,x.variant_name,x.unit_price,x.quantity,x.note,x.line_total,x.net_total,x.vat_total,x.vat_code,x.vat_rate from jsonb_to_recordset(rows_json) as x(product_id uuid,variant_id uuid,product_name text,variant_name text,unit_price numeric,quantity integer,note text,line_total numeric,net_total numeric,vat_total numeric,vat_code text,vat_rate numeric);
 perform set_config('fiscal.build_order','',true);
 if not p_guest then perform record_financial_event(o.id,'sale',p_actor,null); end if;
 return to_jsonb(o);
end $$;
create function record_financial_event(p_order uuid,p_kind text,p_actor uuid,p_reason text) returns void language plpgsql security invoker set search_path=public as $$
declare o orders; label text;
begin
 select * into strict o from orders where id=p_order;
 perform 1 from restaurants where id=o.restaurant_id for update;
 select coalesce(m.display_name,p.full_name,p.email,p_actor::text) into label from profiles p left join restaurant_members m on m.user_id=p.id and m.restaurant_id=o.restaurant_id where p.id=p_actor limit 1;
 insert into financial_events(restaurant_id,order_id,kind,currency,gross,net,vat,payment_method,breakdown,actor_id,actor_name,reason,document_number)
 values(o.restaurant_id,o.id,p_kind,o.currency,o.total,coalesce((o.fiscal_snapshot->>'net')::numeric,o.total),coalesce((o.fiscal_snapshot->>'vat')::numeric,0),case when p_kind='void' then null else o.payment_method end,coalesce(o.fiscal_snapshot->'breakdown',jsonb_build_array(jsonb_build_object('code','legacy_unknown','rate',0,'net',o.total,'vat',0,'gross',o.total))),p_actor,label,p_reason,case when p_kind='refund' then 'CN-'||o.order_number else o.order_number::text end);
end $$;

-- Preserve the earlier POS RPC signature for existing clients during deployment.
create or replace function create_pos_sale(p_actor uuid,p_restaurant uuid,p_request uuid,p_lines jsonb,p_table uuid default null,p_note text default '',p_payment text default 'cash',p_received numeric default null)
returns jsonb language sql security invoker set search_path=public as $$ select create_fiscal_order(p_actor,p_restaurant,p_request,p_lines,p_table,p_note,p_payment,p_received) $$;

create function change_fiscal_order(p_actor uuid,p_restaurant uuid,p_order uuid,p_action text,p_reason text default '',p_payment text default null,p_received numeric default null)
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
     if p_payment is null or p_payment not in ('cash','card') then raise exception 'Choose payment method'; end if;
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

-- Aggregate in PostgreSQL, without REST row limits, grouping currencies separately.
create function fiscal_summary(p_restaurant uuid,p_from bigint,p_through bigint) returns jsonb language sql stable security invoker set search_path=public as $$
 with e as (select *,case kind when 'sale' then 1 when 'refund' then -1 else 0 end as sign from financial_events where restaurant_id=p_restaurant and id>p_from and id<=p_through),
 rates as (select currency,b->>'code' as code,(b->>'rate')::numeric as rate,sum(sign*(b->>'net')::numeric) as net,sum(sign*(b->>'vat')::numeric) as vat,sum(sign*(b->>'gross')::numeric) as gross from e cross join lateral jsonb_array_elements(breakdown) b where sign<>0 group by currency,b->>'code',(b->>'rate')::numeric),
 grouped as (select currency,coalesce(sum(gross) filter(where kind='sale'),0) as sales,coalesce(sum(gross) filter(where kind='refund'),0) as refunds,coalesce(sum(gross) filter(where kind='void'),0) as voids,sum(sign*gross) as "netSales",sum(sign*vat) as vat,coalesce(sum(sign*gross) filter(where payment_method='cash'),0) as cash,coalesce(sum(sign*gross) filter(where payment_method='card'),0) as card from e group by currency)
 select jsonb_build_object('saleCount',(select count(*) from e where kind='sale'),'refundCount',(select count(*) from e where kind='refund'),'voidCount',(select count(*) from e where kind='void'),'currencies',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('breakdown',coalesce((select jsonb_agg(to_jsonb(r)-'currency' order by r.rate,r.code) from rates r where r.currency=g.currency),'[]'))) from grouped g),'[]'));
$$;

create function daily_fiscal_report(p_actor uuid,p_restaurant uuid,p_day date) returns jsonb language plpgsql security invoker set search_path=public as $$
declare tz text; result jsonb; eids bigint[];
begin
 if not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
 select business_timezone into tz from restaurants where id=p_restaurant;
 -- Time boundaries preserve DST. Events never use the current product VAT rate.
 with e as (select *,case kind when 'sale' then 1 when 'refund' then -1 else 0 end as sign from financial_events where restaurant_id=p_restaurant and created_at>=p_day::timestamp at time zone tz and created_at<(p_day+1)::timestamp at time zone tz),
 rates as (select currency,b->>'code' as code,(b->>'rate')::numeric as rate,sum(sign*(b->>'net')::numeric) as net,sum(sign*(b->>'vat')::numeric) as vat,sum(sign*(b->>'gross')::numeric) as gross from e cross join lateral jsonb_array_elements(breakdown) b where sign<>0 group by currency,b->>'code',(b->>'rate')::numeric),
 grouped as (select currency,coalesce(sum(gross) filter(where kind='sale'),0) as sales,coalesce(sum(gross) filter(where kind='refund'),0) as refunds,coalesce(sum(gross) filter(where kind='void'),0) as voids,sum(sign*gross) as "netSales",sum(sign*vat) as vat,coalesce(sum(sign*gross) filter(where payment_method='cash'),0) as cash,coalesce(sum(sign*gross) filter(where payment_method='card'),0) as card from e group by currency)
 select jsonb_build_object('saleCount',(select count(*) from e where kind='sale'),'refundCount',(select count(*) from e where kind='refund'),'voidCount',(select count(*) from e where kind='void'),'currencies',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('breakdown',coalesce((select jsonb_agg(to_jsonb(r)-'currency' order by r.rate,r.code) from rates r where r.currency=g.currency),'[]'))) from grouped g),'[]')) into result;
 return result;
end $$;

create function close_fiscal_day(p_actor uuid,p_restaurant uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r restaurants; z z_reports; last_id bigint; cutoff bigint; n bigint; today date; label text;
begin
 if not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
 select * into r from restaurants where id=p_restaurant for update;
 today:=(clock_timestamp() at time zone r.business_timezone)::date;
 select * into z from z_reports where restaurant_id=r.id and business_date=today;
 if found then return to_jsonb(z); end if;
 select coalesce(max(through_event_id),0),coalesce(max(report_number),0)+1 into last_id,n from z_reports where restaurant_id=r.id;
 select coalesce(max(id),last_id) into cutoff from financial_events where restaurant_id=r.id;
 select coalesce(m.display_name,p.full_name,p.email,p_actor::text) into label from profiles p left join restaurant_members m on m.user_id=p.id and m.restaurant_id=r.id where p.id=p_actor limit 1;
 insert into z_reports(restaurant_id,report_number,business_date,timezone,from_event_id,through_event_id,summary,closed_by,closed_by_name)
 values(r.id,n,today,r.business_timezone,last_id,cutoff,fiscal_summary(r.id,last_id,cutoff),p_actor,label) returning * into z;
 perform set_config('fiscal.actor',p_actor::text,true);
 insert into order_audit(restaurant_id,entity,entity_id,action,actor_id,actor_name,after_data) values(r.id,'z_reports',z.id,'close_day',p_actor,label,to_jsonb(z));
 return to_jsonb(z);
end $$;

-- Service-only entry points: the web server authenticates the actor first.
revoke all on function create_fiscal_order(uuid,uuid,uuid,jsonb,uuid,text,text,numeric,jsonb,boolean,text),record_financial_event(uuid,text,uuid,text),change_fiscal_order(uuid,uuid,uuid,text,text,text,numeric),fiscal_summary(uuid,bigint,bigint),daily_fiscal_report(uuid,uuid,date),close_fiscal_day(uuid,uuid) from public,anon,authenticated;
grant execute on function create_fiscal_order(uuid,uuid,uuid,jsonb,uuid,text,text,numeric,jsonb,boolean,text),record_financial_event(uuid,text,uuid,text),change_fiscal_order(uuid,uuid,uuid,text,text,text,numeric),fiscal_summary(uuid,bigint,bigint),daily_fiscal_report(uuid,uuid,date),close_fiscal_day(uuid,uuid) to service_role;

create function record_fiscal_print(p_actor uuid,p_restaurant uuid,p_order uuid,p_document text,p_method text) returns void language plpgsql security invoker set search_path=public as $$
declare o orders;
begin
 if not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
 if p_document not in ('invoice','credit') or p_method not in ('thermal','browser') then raise exception 'Invalid print'; end if;
 select * into strict o from orders where id=p_order and restaurant_id=p_restaurant for update;
 if p_document='credit' and o.fiscal_state<>'refunded' then raise exception 'Credit note not available'; end if;
 perform set_config('fiscal.actor',p_actor::text,true);
 perform set_config('fiscal.reason',p_document||' / '||p_method||case when p_method='thermal' then ' / sent to printer' else ' / print requested' end,true);
 update orders set print_count=print_count+1,last_printed_at=clock_timestamp(),last_printed_by=p_actor where id=o.id;
end $$;
revoke all on function record_fiscal_print(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function record_fiscal_print(uuid,uuid,uuid,text,text) to service_role;


create function issue_full_vat_document(p_actor uuid,p_restaurant uuid,p_order uuid,p_customer jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare o orders; doc vat_documents;
begin
 if not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
 select * into strict o from orders where id=p_order and restaurant_id=p_restaurant for update;
 select * into doc from vat_documents where order_id=o.id;
 if found then return to_jsonb(doc); end if;
 if o.fiscal_state<>'paid' or o.fiscal_snapshot is null or not (o.fiscal_snapshot->>'registered')::boolean or o.fiscal_snapshot->>'mode' in ('none','saudi') then raise exception 'Full VAT invoice is unavailable for this sale'; end if;
 if length(trim(coalesce(p_customer->>'name','')))<2 or length(trim(coalesce(p_customer->>'address','')))<5 then raise exception 'Customer name and address are required'; end if;
 perform set_config('fiscal.actor',p_actor::text,true);
 perform set_config('fiscal.reason','Full VAT invoice requested',true);
 insert into vat_documents(restaurant_id,order_id,document_number,snapshot,issued_by)
 values(o.restaurant_id,o.id,'VAT-'||o.order_number,o.fiscal_snapshot||jsonb_build_object('invoice_kind','full','customer',jsonb_build_object('name',left(trim(p_customer->>'name'),160),'address',left(trim(p_customer->>'address'),400),'vat_number',left(trim(p_customer->>'vat_number'),32))),p_actor) returning * into doc;
 return to_jsonb(doc);
end $$;
revoke all on function issue_full_vat_document(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function issue_full_vat_document(uuid,uuid,uuid,jsonb) to service_role;

commit;
