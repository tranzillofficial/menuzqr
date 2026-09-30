begin;
alter table public.platform_settings add column if not exists original_price_egp numeric not null default 1000;
alter table public.platform_settings add column if not exists original_price_usd numeric not null default 20;
alter table public.platform_settings add column if not exists offer_enabled boolean not null default true;
alter table public.platform_settings add column if not exists pos_trial_days integer not null default 30 check (pos_trial_days between 0 and 365);
update public.platform_settings set price_egp=800,price_usd=16,menu_bundle_egp=800,menu_bundle_usd=16,pos_monthly_egp=100,pos_yearly_egp=1000,pos_monthly_usd=2,pos_yearly_usd=20,pos_enabled=true where id=1;
alter table public.orders add column if not exists pos_request_id uuid;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists amount_received numeric;
create unique index if not exists orders_pos_request_id_unique on public.orders(pos_request_id) where pos_request_id is not null;

-- Service-only function. The server authenticates the actor; this transaction
-- independently validates membership, entitlement, table, products and prices.
create or replace function public.create_pos_sale(p_actor uuid,p_restaurant uuid,p_request uuid,p_lines jsonb,p_table uuid default null,p_note text default '',p_payment text default 'cash',p_received numeric default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.restaurants; o public.orders; line jsonb; v record; total_value numeric:=0; qty integer; rows_json jsonb:='[]';
begin
 if not exists(select 1 from restaurant_members where restaurant_id=p_restaurant and user_id=p_actor and is_active and role in ('owner','manager')) then raise exception 'Not authorized'; end if;
 select * into r from restaurants where id=p_restaurant for update;
 if r.status <> 'active' or r.pos_status <> 'active' or r.pos_expires_at is null or r.pos_expires_at <= now() or not exists(select 1 from platform_settings where id=1 and pos_enabled) then raise exception 'POS subscription is not active'; end if;
 select * into o from orders where pos_request_id=p_request;
 if found then
   if o.restaurant_id<>p_restaurant or o.placed_by<>p_actor then raise exception 'Invalid request'; end if;
   return to_jsonb(o);
 end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Invalid items'; end if;
 if p_payment not in ('cash','card') then raise exception 'Invalid payment'; end if;
 if p_table is not null and not exists(select 1 from restaurant_tables where id=p_table and restaurant_id=r.id and is_active) then raise exception 'Invalid table'; end if;
 for line in select * from jsonb_array_elements(p_lines) loop
   if (line->>'quantity')::numeric <> trunc((line->>'quantity')::numeric) then raise exception 'Invalid quantity'; end if;
   qty:=(line->>'quantity')::integer;
   if qty is null or qty not between 1 and 99 then raise exception 'Invalid quantity'; end if;
   select pv.id,pv.product_id,pv.name,pv.price,p.name as product_name into v from product_variants pv join products p on p.id=pv.product_id where pv.id=(line->>'variantId')::uuid and pv.restaurant_id=r.id and p.restaurant_id=r.id and pv.is_active and p.is_active;
   if not found or v.price<0 then raise exception 'Product unavailable'; end if;
   total_value:=total_value+v.price*qty;
   rows_json:=rows_json || jsonb_build_array(jsonb_build_object('product_id',v.product_id,'variant_id',v.id,'product_name',v.product_name,'variant_name',v.name,'unit_price',v.price,'quantity',qty));
 end loop;
 if p_payment='cash' and (p_received is null or p_received<total_value) then raise exception 'Amount received is below total'; end if;
 insert into orders(restaurant_id,table_id,placed_by,status,note,total,currency,pos_request_id,payment_method,amount_received)
 values(r.id,p_table,p_actor,case when p_table is null then 'completed' else 'pending' end,left(p_note,400),total_value,r.currency,p_request,p_payment,case when p_payment='cash' then p_received else total_value end) returning * into o;
 insert into order_items(order_id,restaurant_id,product_id,variant_id,product_name,variant_name,unit_price,quantity,line_total)
 select o.id,r.id,x.product_id,x.variant_id,x.product_name,x.variant_name,x.unit_price,x.quantity,x.unit_price*x.quantity from jsonb_to_recordset(rows_json) as x(product_id uuid,variant_id uuid,product_name text,variant_name text,unit_price numeric,quantity integer);
 return to_jsonb(o);
end $$;
revoke all on function public.create_pos_sale(uuid,uuid,uuid,jsonb,uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.create_pos_sale(uuid,uuid,uuid,jsonb,uuid,text,text,numeric) to service_role;
commit;
