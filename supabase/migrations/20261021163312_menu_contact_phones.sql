alter table public.restaurants add column contact_phones text[] not null default '{}'::text[];
alter table public.restaurants add constraint restaurants_contact_phones_limit check (cardinality(contact_phones) <= 10 and array_position(contact_phones,null) is null);
