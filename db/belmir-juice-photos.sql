with photos as (select '{"Orange": {"image": "/belmir-site/assets/belmir-orange.webp", "description": "Bright citrus notes with a refreshing finish.", "price": "85", "priceApproximate": true}, "Strawberry": {"image": "/belmir-site/assets/belmir-strawberry.webp", "description": "Sweet berry flavour with a smooth, fruity finish.", "price": "95", "priceApproximate": true}, "Guava": {"image": "/belmir-site/assets/belmir-guava.webp", "description": "Mellow tropical flavour with a soft, velvety texture.", "price": "85", "priceApproximate": true}, "Mango": {"image": "/belmir-site/assets/belmir-mango.webp", "description": "Rich mango flavour with a golden tropical sweetness.", "price": "100", "priceApproximate": true}, "Lemon Mint": {"image": "/belmir-site/assets/belmir-lemon-mint.webp", "description": "Zesty lemon and cool mint for a refreshing sip.", "price": "85", "priceApproximate": true}}'::jsonb as updates)
update public.belmir_site_content b
set payload = jsonb_set(jsonb_set(b.payload, '{address}', '"EastWalk Mall - Fifth Settlement - Cairo"'::jsonb), '{categories}',
 (select jsonb_agg(case when c->>'name'='Fresh Juices' then
  jsonb_set(c,'{items}',(select jsonb_agg(case when photos.updates ? (p->>'name') then p || (photos.updates->(p->>'name')) else p end order by pi) from jsonb_array_elements(c->'items') with ordinality as items(p,pi)))
  else c end order by ci) from jsonb_array_elements(b.payload->'categories') with ordinality as cats(c,ci))),
 revision = b.revision + 1, updated_at=now()
from photos where b.id='belmir'
returning revision, payload->>'address' as address;
