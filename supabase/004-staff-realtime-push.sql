-- =====================================================================
-- MenuzQR — upgrade 004
-- Staff accounts · realtime hardening · web push · PWA support
--
-- Run AFTER schema.sql, 002-upgrades.sql and 003-upgrades.sql.
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. STAFF ACCOUNTS (sub-users owned by a restaurant)
-- ---------------------------------------------------------------------
alter table public.restaurant_members
  add column if not exists display_name text,
  add column if not exists is_active    boolean not null default true,
  add column if not exists created_by   uuid references auth.users (id) on delete set null;

-- Roles: owner / manager run the dashboard. waiter / chef are floor + kitchen
-- accounts created by the owner. 'staff' is kept so older rows stay valid.
alter table public.restaurant_members
  drop constraint if exists restaurant_members_role_check;

alter table public.restaurant_members
  add constraint restaurant_members_role_check
  check (role in ('owner', 'manager', 'staff', 'waiter', 'chef'));

create index if not exists members_role_idx
  on public.restaurant_members (restaurant_id, role);

-- Role of the caller inside a restaurant (null when not a member).
create or replace function public.member_role(rid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.restaurant_members m
  where m.restaurant_id = rid
    and m.user_id = auth.uid()
    and m.is_active
  limit 1;
$$;

-- `owns_restaurant` is what every read policy hangs off. Deactivated staff
-- must lose access immediately, so it now respects `is_active`.
create or replace function public.owns_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = rid
      and m.user_id = auth.uid()
      and m.is_active
  );
$$;

create or replace function public.can_manage_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = rid
      and m.user_id = auth.uid()
      and m.is_active
      and m.role in ('owner', 'manager')
  );
$$;

-- A staff member must never be able to promote themselves to owner/manager,
-- reactivate their own disabled account, or move themselves to another
-- restaurant. Only an owner/manager of that restaurant, or a platform admin,
-- may write these columns.
create or replace function public.guard_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (our server actions) and platform admins are trusted.
  if auth.uid() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' and not public.can_manage_restaurant(old.restaurant_id) then
    new.role          := old.role;
    new.is_active     := old.is_active;
    new.restaurant_id := old.restaurant_id;
    new.user_id       := old.user_id;
  end if;

  return new;
end;
$$;

-- Least privilege on the team list: `owns_restaurant` means *any* member, so
-- the original read policy let a waiter enumerate every colleague's row. They
-- only ever need their own; the owner's team screen reads it server-side.
drop policy if exists "members: read own restaurants" on public.restaurant_members;
create policy "members: read own restaurants" on public.restaurant_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_restaurant(restaurant_id)
    or public.is_admin()
  );

drop trigger if exists guard_member_role_trg on public.restaurant_members;
create trigger guard_member_role_trg
  before update on public.restaurant_members
  for each row execute function public.guard_member_role();

-- ---------------------------------------------------------------------
-- 2. ORDERS / WAITER REQUESTS — staff-placed work
-- ---------------------------------------------------------------------

-- An order can now be placed by a signed-in staff member from a table QR,
-- even when guest ordering is switched off in settings.
alter table public.orders
  add column if not exists placed_by uuid references auth.users (id) on delete set null;

-- A waiter request can now come from the kitchen ("order 12 is ready"),
-- not only from a guest sitting at a table.
alter table public.waiter_requests
  add column if not exists order_id   uuid references public.orders (id) on delete cascade,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists note       text,
  add column if not exists origin     text not null default 'guest';

alter table public.waiter_requests drop constraint if exists waiter_requests_origin_check;
alter table public.waiter_requests
  add constraint waiter_requests_origin_check check (origin in ('guest', 'staff'));

-- Kitchen calls are attached to an order, not necessarily to a table.
alter table public.waiter_requests alter column table_id drop not null;

create index if not exists waiter_requests_order_idx on public.waiter_requests (order_id);
create index if not exists orders_status_created_idx
  on public.orders (restaurant_id, status, created_at desc);

-- A waiter or a cook holds a real access token in their browser, so the
-- row-level policy on `orders` is not enough on its own: without this, a
-- staff member could PATCH /rest/v1/orders directly and rewrite the total,
-- the table, or the order number. They may move the status and nothing else.
create or replace function public.guard_order_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or auth.role() = 'service_role'
     or public.is_admin()
     or public.can_manage_restaurant(old.restaurant_id) then
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status not in ('accepted', 'preparing', 'ready', 'completed', 'cancelled') then
    raise exception 'staff may not set order status to %', new.status;
  end if;

  new.restaurant_id := old.restaurant_id;
  new.table_id      := old.table_id;
  new.order_number  := old.order_number;
  new.public_token  := old.public_token;
  new.session_id    := old.session_id;
  new.note          := old.note;
  new.total         := old.total;
  new.currency      := old.currency;
  new.placed_by     := old.placed_by;
  new.created_at    := old.created_at;

  return new;
end;
$$;

drop trigger if exists guard_order_columns_trg on public.orders;
create trigger guard_order_columns_trg
  before update on public.orders
  for each row execute function public.guard_order_columns();

-- Same idea for waiter requests: staff resolve them, they do not rewrite them.
create or replace function public.guard_waiter_request_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or auth.role() = 'service_role'
     or public.is_admin()
     or public.can_manage_restaurant(old.restaurant_id) then
    return new;
  end if;

  new.restaurant_id := old.restaurant_id;
  new.table_id      := old.table_id;
  new.order_id      := old.order_id;
  new.origin        := old.origin;
  new.created_by    := old.created_by;
  new.note          := old.note;
  new.created_at    := old.created_at;

  return new;
end;
$$;

drop trigger if exists guard_waiter_request_columns_trg on public.waiter_requests;
create trigger guard_waiter_request_columns_trg
  before update on public.waiter_requests
  for each row execute function public.guard_waiter_request_columns();

-- Staff never delete orders; only a platform admin does (schema.sql 5.6).

-- ---------------------------------------------------------------------
-- 3. WEB PUSH SUBSCRIPTIONS
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  restaurant_id  uuid references public.restaurants (id) on delete cascade,
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  user_agent     text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists push_subs_user_idx       on public.push_subscriptions (user_id);
create index if not exists push_subs_restaurant_idx on public.push_subscriptions (restaurant_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: read own"   on public.push_subscriptions;
drop policy if exists "push: write own"  on public.push_subscriptions;
drop policy if exists "push: delete own" on public.push_subscriptions;

create policy "push: read own" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "push: write own" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "push: delete own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 4. REALTIME — re-assert everything the dashboard depends on
--
--    This is the block that fixes "orders and waiter calls do not appear
--    live". Postgres only streams a table to Realtime when the table is in
--    the `supabase_realtime` publication, and Realtime only forwards a row
--    to a client that is allowed to SELECT it.
-- ---------------------------------------------------------------------
alter table public.orders          replica identity full;
alter table public.order_items     replica identity full;
alter table public.waiter_requests replica identity full;

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  foreach t in array array['orders', 'order_items', 'waiter_requests']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Realtime Broadcast (the second, RLS-independent delivery path).
-- Our server sends every event to the private topic `restaurant:<uuid>` with
-- the service role, which bypasses RLS — so members need READ access only.
-- Deliberately no INSERT policy: a waiter must not be able to broadcast a
-- fake "new order" to every screen in the restaurant.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise warning 'realtime.messages not present - broadcast auth policies were NOT created';
    return;
  end if;

  execute 'drop policy if exists "menuzqr: members read broadcast" on realtime.messages';
  execute 'drop policy if exists "menuzqr: members write broadcast" on realtime.messages';

  -- The topic is matched with a regex before the cast: Postgres does not
  -- promise left-to-right AND evaluation, so a client joining
  -- `restaurant:banana` must not be able to raise a uuid syntax error.
  execute $p$
    create policy "menuzqr: members read broadcast" on realtime.messages
      for select to authenticated
      using (
        public.owns_restaurant(
          (case
             when realtime.topic() ~ '^restaurant:[0-9a-fA-F-]{36}$'
             then substring(realtime.topic() from 12)
           end)::uuid
        )
      )
  $p$;
exception
  when others then
    raise warning 'broadcast auth policy was NOT created: % - postgres_changes still applies', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 5. VERIFICATION — run these and read the answers
-- ---------------------------------------------------------------------

-- 5.1 Are the three tables actually streaming?  Expect 3 rows.
select tablename as realtime_enabled_table
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;

-- 5.2 Does every restaurant owner have a membership row?  Expect 0 rows.
--     A missing row means Realtime will silently drop that owner's events,
--     because the SELECT policy on `orders` is membership-based.
select r.id, r.name, r.owner_id
from public.restaurants r
where not exists (
  select 1 from public.restaurant_members m
  where m.restaurant_id = r.id and m.user_id = r.owner_id
);

-- 5.3 Repair any owner found above (safe to run regardless).
insert into public.restaurant_members (restaurant_id, user_id, role, display_name)
select r.id, r.owner_id, 'owner', coalesce(p.full_name, r.name)
from public.restaurants r
left join public.profiles p on p.id = r.owner_id
on conflict (restaurant_id, user_id) do update
  set role = 'owner', is_active = true;

-- 5.4 Did the broadcast policy land? Expect 1 row. Zero is not fatal —
--     postgres_changes still delivers — but it means the second path is off.
select policyname
from pg_policies
where schemaname = 'realtime' and tablename = 'messages'
  and policyname like 'menuzqr%';

-- 5.5 Storage buckets. Expect restaurant-assets and menu-library.
select id, public from storage.buckets order by id;

-- 5.6 Staff overview per restaurant.
select r.name as restaurant,
       m.role,
       m.display_name,
       p.email,
       m.is_active
from public.restaurant_members m
join public.restaurants r on r.id = m.restaurant_id
left join public.profiles p on p.id = m.user_id
order by r.name, m.role, m.display_name;
