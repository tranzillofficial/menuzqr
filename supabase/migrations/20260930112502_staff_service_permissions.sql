-- Separate operational permissions from legacy dashboard navigation permissions.
-- NULL retains legacy defaults until the owner customizes an existing account.
alter table public.restaurant_members
  add column if not exists service_permissions text[] default null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.restaurant_members'::regclass and conname = 'restaurant_members_service_permissions_valid') then
    alter table public.restaurant_members add constraint restaurant_members_service_permissions_valid
    check (service_permissions is null or service_permissions <@ array[
      'orders.accept','orders.prepare','orders.complete','orders.cancel','orders.create','calls.resolve'
    ]::text[]);
  end if;
end $$;

-- Operational writes go through authenticated server actions which re-read
-- active membership and permissions on each request. Do not allow direct
-- REST writes to bypass those checks. Existing manager/admin policies remain.
drop policy if exists "orders: staff writes require server authorization" on public.orders;
create policy "orders: staff writes require server authorization"
  on public.orders as restrictive for update to authenticated
  using (public.can_manage_restaurant(restaurant_id) or public.is_admin())
  with check (public.can_manage_restaurant(restaurant_id) or public.is_admin());
drop policy if exists "waiter: staff writes require server authorization" on public.waiter_requests;
create policy "waiter: staff writes require server authorization"
  on public.waiter_requests as restrictive for update to authenticated
  using (public.can_manage_restaurant(restaurant_id) or public.is_admin())
  with check (public.can_manage_restaurant(restaurant_id) or public.is_admin());
