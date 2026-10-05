begin;

alter table public.qr_templates
  drop constraint if exists qr_templates_layout_check;

alter table public.qr_templates
  add constraint qr_templates_layout_check
  check (layout in ('counter', 'square', 'tent', 'cafe'));

insert into public.qr_templates
  (name, layout, scope, bg_color, panel_color, accent_color, text_color, qr_color, headline, cta_text, is_active, sort_order)
values
  (
    'Hadota Café Poster',
    'cafe',
    'both',
    '#35180f',
    '#fff2d6',
    '#d99a42',
    '#f7dfba',
    '#3a190e',
    'تصفح القائمة',
    'امسح الكود',
    true,
    -20
  )
on conflict (name) do update set
  layout = excluded.layout,
  scope = excluded.scope,
  bg_color = excluded.bg_color,
  panel_color = excluded.panel_color,
  accent_color = excluded.accent_color,
  text_color = excluded.text_color,
  qr_color = excluded.qr_color,
  headline = excluded.headline,
  cta_text = excluded.cta_text,
  is_active = true,
  sort_order = excluded.sort_order;

commit;
