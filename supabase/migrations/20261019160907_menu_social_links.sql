-- Independent public contact links; payment WhatsApp remains dedicated to payments.
alter table public.restaurant_settings add column whatsapp_url text not null default '', add column tiktok_url text not null default '';
alter table public.restaurant_settings add constraint menu_social_urls_valid check ((whatsapp_url='' or (length(whatsapp_url)<=500 and whatsapp_url ~ '^https://[^[:space:]]+$')) and (tiktok_url='' or (length(tiktok_url)<=500 and tiktok_url ~ '^https://[^[:space:]]+$')));
-- Keep previously displayed WhatsApp contact links visible after upgrading.
update public.restaurant_settings set whatsapp_url='https://wa.me/'||payment_whatsapp where payment_whatsapp ~ '^[1-9][0-9]{7,14}$';

create or replace function public.save_dashboard_settings(p_restaurant uuid,p_settings jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare r restaurants;s restaurant_settings;ordering boolean;remote boolean;wallet text;instapay text;whatsapp text;details text;fee numeric;free numeric;k text;url text;
begin
 if not can_manage_restaurant(p_restaurant) or not business_module_enabled(p_restaurant,'settings') then raise exception 'Settings unavailable';end if;
 if jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>10000 then raise exception 'Invalid settings';end if;
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
 for k in select unnest(array['location_url','facebook_url','instagram_url','website_url','whatsapp_url','tiktok_url']) loop
 url:=coalesce(p_settings->>k,'');if url<>'' and (length(url)>500 or url !~ '^https://[^\s]+$') then raise exception 'Invalid contact URL';end if;
 end loop;
 end if;
 insert into restaurant_settings(restaurant_id,sound_enabled,show_prices,show_ingredients,remote_ordering_enabled,cash_wallet,instapay_address,payment_whatsapp,payment_details,delivery_fee,free_delivery_above,location_url,facebook_url,instagram_url,website_url)
 values(r.id,coalesce((p_settings->>'sound_enabled')::boolean,true),coalesce((p_settings->>'show_prices')::boolean,true),case when business_capability_enabled(r.id,'product_ingredients') then coalesce((p_settings->>'show_ingredients')::boolean,true) else coalesce(s.show_ingredients,true) end,remote,wallet,instapay,whatsapp,details,round(fee,2),round(free,2),case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'location_url','') else coalesce(s.location_url,'') end,case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'facebook_url','') else coalesce(s.facebook_url,'') end,case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'instagram_url','') else coalesce(s.instagram_url,'') end,case when business_capability_enabled(r.id,'contact_settings') then coalesce(p_settings->>'website_url','') else coalesce(s.website_url,'') end)
 on conflict(restaurant_id) do update set sound_enabled=excluded.sound_enabled,show_prices=excluded.show_prices,show_ingredients=excluded.show_ingredients,remote_ordering_enabled=excluded.remote_ordering_enabled,cash_wallet=excluded.cash_wallet,instapay_address=excluded.instapay_address,payment_whatsapp=excluded.payment_whatsapp,payment_details=excluded.payment_details,delivery_fee=excluded.delivery_fee,free_delivery_above=excluded.free_delivery_above,location_url=excluded.location_url,facebook_url=excluded.facebook_url,instagram_url=excluded.instagram_url,website_url=excluded.website_url;
 if business_capability_enabled(r.id,'contact_settings') then
 update restaurant_settings set whatsapp_url=case when p_settings ? 'whatsapp_url' then coalesce(p_settings->>'whatsapp_url','') else whatsapp_url end,tiktok_url=case when p_settings ? 'tiktok_url' then coalesce(p_settings->>'tiktok_url','') else tiktok_url end where restaurant_id=r.id;
 end if;
 update restaurants set ordering_enabled=ordering,waiter_calls_enabled=case when business_module_enabled(r.id,'service_calls') and business_module_enabled(r.id,'tables') then coalesce((p_settings->>'waiter_calls_enabled')::boolean,false) else r.waiter_calls_enabled end where id=r.id;
end $$;
revoke all on function public.save_dashboard_settings(uuid,jsonb) from public,anon;
grant execute on function public.save_dashboard_settings(uuid,jsonb) to authenticated;

