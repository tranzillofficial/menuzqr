# Business features and custom domains

`lib/business-modules.ts` is the feature registry. Each implemented feature declares a stable ID, Arabic/English name, dashboard paths, and optional navigation label/icon. The account editor and navigation derive from this registry. Presets select modules; administrators can adjust them individually.

To add a feature, implement its pages/actions, register it once, and enforce `moduleEnabled` in its server actions. Route access is also guarded by Proxy. Adding a registry entry does not implement its functionality. Inventory is not yet an implemented module.

Existing `NULL` configurations preserve legacy behavior. Existing custom arrays retain their historically always-available core tools. Accounts saved through the new editor include `features_v2`, enabling explicit branch/products/QR/settings toggles. Do not migrate existing account selections automatically.

Domain records are admin-only. New records remain pending until Vercel confirms project ownership and DNS/TLS configuration. Routing uses an exact hostname match; pending/disabled/unknown customer hosts fail closed. Custom-domain logins are restricted to active members of that business; membership, owned-business mutations and public order/menu lookups resolve against the host's business.

On the custom domain, `/` serves the chosen business landing page or redirects to `/login`; `/menu` serves that business's existing menu. Activation/expiry gates remain in force. The first active enabled domain is used for newly generated QR links. Existing MenuzQR links still work.

Vercel setup: set server-only `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` and optional `VERCEL_TEAM_ID`, or enter a one-time token in the admin domain form. Tokens are not stored or returned in responses. Adding a hostname does not purchase it or modify the registrar's DNS. Copy the recommended records, configure DNS, and run the check again. No domain was registered by this change because no customer hostname was supplied.

Email/password login uses local session cookies. Adding email magic links, recovery or OAuth later requires explicit Supabase redirect allowlist entries for each customer domain.
