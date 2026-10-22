alter table public.restaurants
 add column if not exists cover_fit text not null default 'contain' check (cover_fit in ('contain','cover')),
 add column if not exists cover_position_x numeric not null default 50 check (cover_position_x between 0 and 100),
 add column if not exists cover_position_y numeric not null default 50 check (cover_position_y between 0 and 100);
