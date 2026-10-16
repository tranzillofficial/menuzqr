begin;
create extension if not exists pg_trgm with schema extensions;
create function public.normalize_supermarket_name(value text) returns text language sql immutable strict set search_path=public as $$
 select trim(regexp_replace(translate(regexp_replace(lower(value),'[ًٌٍَُِّْـ]','','g'),'أإآىةؤئ٠١٢٣٤٥٦٧٨٩','ااايهوي0123456789'),'[^[:alnum:]]+',' ','g'));
$$;
alter table public.supermarket_catalog_products add column search_name text generated always as (public.normalize_supermarket_name(name_ar||' '||coalesce(brand,''))) stored;
create index supermarket_catalog_names_trgm on public.supermarket_catalog_products using gin(search_name extensions.gin_trgm_ops) where review_status='approved';
create function public.suggest_supermarket_products(p_query text) returns table(id uuid,score real)
language sql stable security invoker set search_path=public,extensions as $$
 with q as (select public.normalize_supermarket_name(left(p_query,100)) as term),
 candidates as (
  select p.id,p.name_ar,p.search_name,q.term,
   extensions.word_similarity(q.term,p.search_name) as similar,
   (select count(*) from unnest(string_to_array(q.term,' ')) w where length(w)>1 and p.search_name like '%'||w||'%') as matching
  from public.supermarket_catalog_products p cross join q
  where auth.uid() is not null and length(q.term)>=2 and p.review_status='approved'
 )
 select c.id,(c.matching+ c.similar + case when c.search_name like '%'||c.term||'%' then 2 else 0 end)::real
 from candidates c where c.matching>0 or c.similar>=0.45
 order by 2 desc,length(c.name_ar),c.id limit 8;
$$;
revoke all on function public.suggest_supermarket_products(text) from public,anon;
grant execute on function public.suggest_supermarket_products(text) to authenticated;
commit;
