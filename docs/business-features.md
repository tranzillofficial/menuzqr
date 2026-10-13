# Business features and custom domains

`lib/business-modules.ts` is the feature registry. Each implemented feature declares a stable ID, Arabic/English name, dashboard paths, and optional navigation label/icon. The account editor and navigation derive from this registry. Presets select modules; administrators can adjust them individually.

To add a feature, implement its pages/actions, register it once, and enforce `moduleEnabled` in its server actions. Route access is also guarded by Proxy. Adding a registry entry does not implement its functionality. Inventory is not yet an implemented module.

Existing `NULL` configurations preserve legacy behavior. Existing custom arrays retain their historically always-available core tools. Accounts saved through the new editor include `features_v2`, enabling explicit branch/products/QR/settings toggles. Do not migrate existing account selections automatically.

Domain records are admin-only. New records remain pending until Vercel confirms project ownership and DNS/TLS configuration. Routing uses an exact hostname match; pending/disabled/unknown customer hosts fail closed. Custom-domain logins are restricted to active members of that business; membership, owned-business mutations and public order/menu lookups resolve against the host's business.

On the custom domain, `/` serves the chosen business landing page or redirects to `/login`; `/menu` serves that business's existing menu. Activation/expiry gates remain in force. The first active enabled domain is used for newly generated QR links. Existing MenuzQR links still work.

Vercel setup: set server-only `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` and optional `VERCEL_TEAM_ID`, or enter a one-time token in the admin domain form. Tokens are not stored or returned in responses. Adding a hostname does not purchase it or modify the registrar's DNS. Copy the recommended records, configure DNS, and run the check again. No domain was registered by this change because no customer hostname was supplied.

Email/password login uses local session cookies. Adding email magic links, recovery or OAuth later requires explicit Supabase redirect allowlist entries for each customer domain.

`features_v3` adds per-section capabilities from `lib/business-features.ts`, saved in the existing admin-controlled `enabled_modules` array. A feature requires its parent module. Legacy configurations retain inferred defaults until saved. Supermarkets always hide tables and service calls; descriptions, ingredients, English names and tax controls are off by default. Presets now include offers, customers, menu designs and invoices. Inventory is opt-in.

Inventory tracks each selling variant separately. A trusted financial-event trigger deducts paid sales and reverses the recorded sale movements on refunds; unpaid/cancelled orders do not consume inventory. Box-to-carton conversion is not automatic. Balances may be negative, and stock changes are audited.

Storefront delivery/payment/contact fields are additive. Supermarket delivery charges and free-delivery thresholds are calculated on the server and frozen in fiscal snapshots. Existing receipts remain unchanged. Public supermarket catalogs fetch 24 products per page and dashboard product management fetches 40. Search runs against the account in Postgres, not just the current page. Product pages are cached for 30 seconds with per-business invalidation on product/category changes; immutable image caching remains enabled. R2 migration is deferred.

The existing web-push service worker handles notifications with closed tabs. Production requires stable VAPID public/private keys and each phone's notification permission and subscription. Device power management and browser policies still affect delivery.

## QR, products, offers and invoices (2026-10-13)

Per-account capabilities now include product images/options; QR menu/WhatsApp/tables/design/exports; offer bundle/discount/image/schedule/barcode and automatic POS pricing (`offer_pos`). Master admin can allow these in activity templates and override them for each account. Table QR additionally requires the tables module; supermarket defaults do not enable tables. Existing v3 accounts retain their previous flags, with new capabilities seeded only under their already-enabled parent modules.

QR preferences are saved independently per type in `business_qr_settings`, with tenant RLS and atomic per-kind updates. Built-in simple/cream/dark themes and active assigned QR templates are supported. Export PNG includes the label; SVG exports the code. WhatsApp uses normalized international numbers.

Bundle/discount offers store variant IDs and integer quantities; the database validates current active tenant products and derives prices. Promotion cards do not discount invoices. In POS, complete bundles/discount recipes apply automatically when `offer_pos` is enabled. The highest saving per complete recipe takes priority, ties use offer ID, and the maximum complete repetitions are consumed before considering the next recipe. A unit participates in only one offer. This deterministic priority is not a global optimization across every possible combination of overlapping offers.

Checkout recalculates offers inside the fiscal transaction using locked product prices and active/current offer records. Fixed bundle prices remain fixed; percent/fixed discounts use current prices. No client price or discount is trusted. Discounts are allocated in cents before existing VAT calculations. Original unit prices, discounted base totals, allocations, offer names and repetitions are frozen in invoice lines/snapshots. Retry, refund and stock accounting use the recorded transaction. Historical invoices remain unchanged. Automatic pricing currently applies to POS checkout, not customer online ordering.

Invoices use 30-row tenant-scoped pagination with number/customer, date, state and payment filters. Dates use the business timezone. List, detail, export and thermal receipt show saved offer discounts.

Verification: `npm run test:offers`, `npm run test:tax`, `npm run test:configuration`, production build; responsive real-component browser fixtures at 320/390/1440 pixels for QR, offers, POS and invoices. Browser fixtures mock server writes and printer hardware.

## Settings, customer directory and finance workspace (2026-10-13)

The dashboard groups invoices, orders and sales reports under one navigation entry named Invoices. Each tab keeps its own module authorization; disabled tabs and routes remain unavailable. Invoices and orders use 30-row server pagination. Invoice previews and details use recorded item totals, payment state, VAT and offer discounts. Refunds, payments and day closing keep the existing immutable fiscal journal and stock accounting.

Settings use orange horizontal tabs, compact mobile fields and one atomic save for display, ordering, payment, delivery and contact preferences. Disabled capabilities retain their previous stored values. Restaurant/cafe table ordering and waiter calls remain gated by the account's enabled modules and active tables. Flat delivery fees apply only to supermarket orders. WhatsApp uses a selected country prefix (Egypt +20 by default) without duplicating prefixes. QR design remains in the capability-controlled QR studio.

Customer management has tenant-scoped search/filter/sort, real activity statistics, 30-row pagination, a desktop editor and mobile modal. Manual creation and editing have separate admin capabilities (`customer_create`, `customer_edit`). A canonical phone index prevents local/international Egyptian duplicates. Editing a phone preserves the stable customer ID and existing invoice snapshots. Online orders link customers only when their customer module is enabled. Statistics are aggregated in the database; customer lists are not downloaded in full.

Sales charts show seven actual daily reports, ending on the selected day, in the business currency. Financial totals keep currencies separate. Day-close reports are real stored Z reports; event and audit lists show at most 50 records with full-day CSV export.

Validation: `npm run test:dashboard`, fiscal and configuration regressions, production build, responsive browser tests at 320/390/1024/1440 pixels. Browser tests mock server writes while PostgreSQL fixtures verify authorization, atomic saves, disabled controls and snapshot preservation.
