begin;
alter table public.qr_templates add column allowed_restaurant_ids uuid[];
-- Branded poster artwork must never be part of the shared catalogue.
update public.qr_templates set allowed_restaurant_ids='{}' where layout='cafe';
update public.qr_templates set allowed_restaurant_ids=array(
 select r.id from public.restaurants r join public.profiles p on p.id=r.owner_id where lower(p.email)='hadota@gmail.com'
) where name='Hadota Café Poster';
alter table public.qr_templates add constraint cafe_qr_design_is_private check(layout<>'cafe' or allowed_restaurant_ids is not null);

-- Remove accidental historical selections from other accounts, retaining their content.
update public.restaurants r set qr_template_id=null from public.qr_templates t
 where r.qr_template_id=t.id and t.allowed_restaurant_ids is not null and not(r.id=any(t.allowed_restaurant_ids));
update public.business_qr_settings s set preferences=(
 select jsonb_object_agg(e.key,case when exists(select 1 from public.qr_templates t where t.id::text=e.value->>'template_id' and t.allowed_restaurant_ids is not null and not(s.restaurant_id=any(t.allowed_restaurant_ids))) then jsonb_set(e.value,'{template_id}','""') else e.value end)
 from jsonb_each(s.preferences) e
) where exists(select 1 from jsonb_each(s.preferences) e join public.qr_templates t on t.id::text=e.value->>'template_id' where t.allowed_restaurant_ids is not null and not(s.restaurant_id=any(t.allowed_restaurant_ids)));

drop policy if exists "qr_templates: read" on public.qr_templates;
create policy "qr_templates: read" on public.qr_templates for select to authenticated using(
 public.is_admin() or (is_active and (allowed_restaurant_ids is null or exists(
 select 1 from unnest(allowed_restaurant_ids) assigned(id) where public.can_manage_restaurant(assigned.id)
 )))
);

create or replace function public.validate_qr_preferences() returns trigger language plpgsql security invoker set search_path=public as $$
declare k text;v jsonb;
begin
 if tg_op='UPDATE' and new.restaurant_id is distinct from old.restaurant_id then raise exception 'Cannot change business ownership';end if;
 for k,v in select * from jsonb_each(new.preferences) loop
  if k not in ('menu','whatsapp','table') or jsonb_typeof(v)<>'object' or jsonb_typeof(v->'title') is distinct from 'string' or length(trim(v->>'title')) not between 2 and 80 or jsonb_typeof(v->'subtitle') is distinct from 'string' or length(v->>'subtitle')>100 or coalesce(v->>'theme','') not in ('simple','cream','dark') or length(coalesce(v->>'template_id',''))>64 then raise exception 'Invalid QR preferences';end if;
  if coalesce(v->>'template_id','')<>'' and not exists(select 1 from public.qr_templates t where t.id::text=v->>'template_id' and t.is_active and (t.allowed_restaurant_ids is null or new.restaurant_id=any(t.allowed_restaurant_ids)) and (case when k='table' then t.scope<>'general' else t.scope<>'table' end)) then raise exception 'QR design unavailable for this account';end if;
 end loop;
 new.updated_at:=now();return new;
end;$$;
revoke all on function public.validate_qr_preferences() from public,anon;

create function public.validate_restaurant_qr_template() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='UPDATE' and new.qr_template_id is not distinct from old.qr_template_id then return new;end if;
 if new.qr_template_id is not null and not exists(select 1 from public.qr_templates t where t.id=new.qr_template_id and t.is_active and (t.allowed_restaurant_ids is null or new.id=any(t.allowed_restaurant_ids))) then raise exception 'QR design unavailable for this account';end if;
 return new;
end;$$;
revoke all on function public.validate_restaurant_qr_template() from public,anon;
create trigger restaurant_qr_template_access before insert or update of qr_template_id on public.restaurants for each row execute function public.validate_restaurant_qr_template();
commit;
