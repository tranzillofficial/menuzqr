-- MenuzQR — fix the admin guard, then grant admin.
-- Paste the whole thing into the Supabase SQL Editor and run it once.

-- 1. Patch the guard so a direct database connection (the SQL editor, a
--    migration, psql) can grant admin. Those carry no end-user JWT, so
--    auth.uid() is null. The browser always has one, so a normal user still
--    cannot promote themselves.
create or replace function public.guard_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  new.is_admin := old.is_admin;
  return new;
end;
$$;

create or replace function public.guard_restaurant_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status                := 'inactive';
    new.activated_at          := null;
    new.activation_expires_at := null;
    new.payment_method        := null;
    new.payment_status        := 'unpaid';
    new.subscription_type     := 'one_time';
    new.price_cents           := 2000;
    new.owner_id              := coalesce(auth.uid(), new.owner_id);
    return new;
  end if;

  new.status                := old.status;
  new.activated_at          := old.activated_at;
  new.activation_expires_at := old.activation_expires_at;
  new.payment_method        := old.payment_method;
  new.payment_status        := old.payment_status;
  new.subscription_type     := old.subscription_type;
  new.price_cents           := old.price_cents;
  new.owner_id              := old.owner_id;
  return new;
end;
$$;

-- 2. Grant admin.
update public.profiles
   set is_admin = true
 where id = '726322f0-c8ab-4ef2-bad0-34dc21cb1fa8';

-- 3. Verify — is_admin must now be true.
select id, email, is_admin
  from public.profiles
 where id = '726322f0-c8ab-4ef2-bad0-34dc21cb1fa8';
