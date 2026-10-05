begin;
create or replace function create_fiscal_order(p_actor uuid,p_restaurant uuid,p_request uuid,p_lines jsonb,p_table uuid,p_note text,p_payment text,p_received numeric,p_customer jsonb default '{}',p_guest boolean default false,p_session text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r restaurants; o orders; line jsonb; v record; qty integer; rate numeric; code text; amount numeric; net numeric; vat numeric; gross numeric; net_sum numeric:=0; vat_sum numeric:=0; gross_sum numeric:=0; rows_json jsonb:='[]'; breakdown jsonb; snapshot jsonb; invoice_kind text; cumulative_amount numeric:=0; cumulative_vat numeric:=0; allocated_vat numeric:=0; adjusted_rows jsonb:='[]';
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
   code:=case when r.tax_mode='egypt' and r.vat_registered then 'standard' when r.tax_mode='none' or not r.vat_registered then 'not_registered' else v.vat_code end;
   rate:=case when r.tax_mode='egypt' and r.vat_registered then coalesce((r.tax_rates->'egypt'->>'standard')::numeric,14) when not r.vat_registered or r.tax_mode='none' or v.vat_code in ('zero','exempt') then 0 else coalesce((r.tax_rates->r.tax_mode->>v.vat_code)::numeric,case when r.tax_mode='egypt' and v.vat_code='standard' then 14 else fiscal_vat_rate(r.tax_mode,r.vat_registered,v.vat_code) end) end;
   amount:=round(v.price*qty,2);
   vat:=case when r.prices_include_vat then round(amount*rate/(100+rate),2) else round(amount*rate/100,2) end;
   gross:=case when r.prices_include_vat then amount else amount+vat end; net:=gross-vat;
   net_sum:=net_sum+net; vat_sum:=vat_sum+vat; gross_sum:=gross_sum+gross;
   rows_json:=rows_json||jsonb_build_array(jsonb_build_object('product_id',v.product_id,'variant_id',v.id,'product_name',v.product_name,'variant_name',v.name,'unit_price',v.price,'quantity',qty,'note',left(line->>'note',200),'line_total',gross,'net_total',net,'vat_total',vat,'vat_code',code,'vat_rate',rate));
 end loop;
 -- Round Egyptian VAT once on the entire invoice. Allocate that fixed
 -- amount cumulatively for immutable line records and refund reconciliation.
 if r.tax_mode='egypt' then
   net_sum:=0; vat_sum:=0; gross_sum:=0;
   for line in select * from jsonb_array_elements(rows_json) loop
     amount:=(line->>'unit_price')::numeric*(line->>'quantity')::integer;
     cumulative_amount:=cumulative_amount+amount;
     rate:=(line->>'vat_rate')::numeric;
     cumulative_vat:=case when r.prices_include_vat then round(cumulative_amount*rate/(100+rate),2) else round(cumulative_amount*rate/100,2) end;
     vat:=cumulative_vat-allocated_vat; allocated_vat:=cumulative_vat;
     gross:=case when r.prices_include_vat then amount else amount+vat end; net:=gross-vat;
     adjusted_rows:=adjusted_rows||jsonb_build_array(line||jsonb_build_object('line_total',gross,'net_total',net,'vat_total',vat));
     net_sum:=net_sum+net; vat_sum:=vat_sum+vat; gross_sum:=gross_sum+gross;
   end loop;
   rows_json:=adjusted_rows;
 end if;
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
commit;
