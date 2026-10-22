-- Extend existing basic QR menus without enabling paid operational modules.
-- The module registry is shared with business_module_enabled and the UI.
update public.restaurants
set enabled_modules = enabled_modules
    || case when not ('settings' = any(enabled_modules)) then array['settings'] else '{}'::text[] end
    || case when not ('contact_settings' = any(enabled_modules)) then array['contact_settings'] else '{}'::text[] end
where enabled_modules @> array['features_v3','products','design','qr']
  and not exists (
    select 1 from public.configuration_features f
    where f.kind = 'module' and f.key = any(restaurants.enabled_modules)
      and f.key not in ('products','design','qr','settings')
  )
  and not (enabled_modules @> array['settings','contact_settings']);
