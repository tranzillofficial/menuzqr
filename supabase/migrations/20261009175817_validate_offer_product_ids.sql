create or replace function public.validate_offer_products() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if exists(select 1 from unnest(new.product_ids) as requested(product_id) where not exists(select 1 from public.products p where p.id=requested.product_id and p.restaurant_id=new.restaurant_id)) then raise exception 'Offer products must belong to the same business'; end if;
 return new;
end $$;
revoke all on function public.validate_offer_products() from public,anon,authenticated;
