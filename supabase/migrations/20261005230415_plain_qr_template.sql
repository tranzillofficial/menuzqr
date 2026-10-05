begin;
alter table public.qr_templates drop constraint if exists qr_templates_layout_check;
alter table public.qr_templates add constraint qr_templates_layout_check check (layout in ('counter','square','tent','cafe','plain'));
insert into public.qr_templates(name,layout,scope,bg_color,panel_color,accent_color,text_color,qr_color,headline,cta_text,is_active,sort_order)
values ('Plain Cream QR','plain','both','#fff8e7','#fff8e7','#171717','#171717','#171717','','',true,30)
on conflict(name) do update set layout=excluded.layout,scope=excluded.scope,bg_color=excluded.bg_color,panel_color=excluded.panel_color,qr_color=excluded.qr_color,headline='',cta_text='',is_active=true;
update public.restaurants set qr_template_id=(select id from public.qr_templates where name='Plain Cream QR')
where owner_id in (select id from auth.users where lower(email)='elhamd@gmail.com') and slug='alhamd';
commit;
