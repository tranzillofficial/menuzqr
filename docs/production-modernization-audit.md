# MenuzQR production modernization — 2026-10-13

## Scope and preservation

Incremental changes on the existing Next.js/React/Supabase platform. Existing customer accounts are intentionally **not assigned** a new template automatically. Their country, currency, tax status, prices, orders, domains and business configuration remain independent until the master admin chooses a template.

Production snapshot before the migration:

| Account | Products | Selling variants | Orders |
|---|---:|---:|---:|
| 7adota-cafe | 110 | 111 | 1 |
| alhamd | 4 | 5 | 13 |
| am-abdallah-market | 12 | 12 | 5 |
| master-mart | 0 | 0 | 0 |

Configuration fingerprints were captured for the four accounts for post-migration comparison. Financial events and catalog content are not rewritten by this migration.

## Implemented in this change

- Business-type management at `/admin/business-types`: restaurant, cafe, supermarket, wholesale and retail seeds; create additional types; configure available and default modules/capabilities.
- Per-account configuration: independent mode or template inheritance, explicit on/off overrides, effective configuration preview, dependency errors and save feedback.
- New account templates; country/currency are defaults for **new accounts only**. Selecting a template does not register an account for VAT.
- Materialized effective flags preserve the existing module/capability registry, routes and subscription rules. Template edits update only inheriting accounts in one transaction; invalid dependencies roll back the complete change.
- Append-only configuration audit events. Signed-in admin checks use the existing database-backed `profiles.is_admin`; no authorization is derived from editable Auth user metadata.
- Central policy helpers wired into protected page/action helpers. Legacy `market`, `team` and `barcode` conventions remain compatible.
- Additional restrictive database policies for product/category writes, variants, settings and offers. Inventory-only edits cannot change selling prices. Product editing does not grant stock editing. Cross-tenant product/category links and tenant reassignment are rejected.
- POS: bounded 40-product server search/pagination; category descendants; name/barcode search; stable ordering; stale-response suppression; cart retained across searches. Tables are queried only when enabled.
- Inventory: 50 selling variants per page with server-side product name/barcode search and total counts, replacing the first-500 limit.
- POS mobile cards: two columns before the small-screen breakpoint, larger product names and image sizes appropriate to the two-column layout.

Available business types can customize implemented functionality. Creating a type does not generate new code for an unimplemented feature.

## Existing functionality preserved

| Area | Current implementation / limitation |
|---|---|
| Supermarket offers | Existing offers module; independently enabled by master admin |
| Optional ordering | Existing module + capability + account setting, server validated |
| WhatsApp | Egyptian number normalization and QR design options |
| Delivery/payment/contact | Existing flat fee/free threshold, manual payment instructions, social/location/phone settings |
| Catalog performance | Public supermarket pages 24, owner products 40, short-lived tenant-tagged cache and optimized images |
| Printing | Existing QZ WebSocket thermal flow and React fallback; no bridge or printing redesign in this change |
| Notifications | Existing Web Push/service worker and VAPID setup; each phone must grant permission and register a subscription |
| Stock | Per-selling-variant balance; paid sale deduction and refund restoration are transactional |
| Financial history | Frozen fiscal snapshots, idempotent checkout, immutable event/report history |

## Verification

- Production Next.js build and TypeScript passed.
- Targeted ESLint passed.
- Eight pure business/configuration tests passed.
- PostgreSQL/PGlite configuration test passed: preservation, admin-only assignment, inheritance, explicit overrides, atomic validation, immutable audit, disabled-module API protection, inventory-only edits and tenant isolation.
- Existing business database regressions passed.
- Existing fiscal regressions passed: taxes, frozen history, idempotency, refunds, delivery pricing and paid stock/refund movements.
- Local Chromium POS regression passed: pagination/search keeps cart, query resets page, stale results discarded and search failure clears old results. Server responses were mocked; this is not a signed-in production checkout test.
- Local Chromium QZ regression passed: one print job, concurrent/duplicate prevention, portrait 80mm receipt, compact test and no automatic retry after connection failure. QZ/device responses were mocked; physical printer behavior still needs device verification.

The browser environment could not reach the production site directly during the earlier audit. Do not interpret local mocked regressions as a full visual or hardware acceptance test.

## Remaining work and dependencies

1. **R2:** application uploads still use Supabase Storage; no live R2 integration exists in the repository. Cloudflare read-only bucket inspection returned error `10042: Please enable R2 through the Cloudflare Dashboard`. The connected account needs R2 activation before implementing/testing its authenticated upload and delivery pipeline. No buckets, billing options or storage URLs were changed.
2. **Base units and conversions:** the live schema already has `inventory_items`, `inventory_transactions` and `product_inventory_links` (empty at audit), alongside variant balances. Reconcile and reuse this model before carton/pack/base-unit conversions; do not create a competing inventory ledger or assume variant balances convert automatically.
3. **Large catalog imports:** Excel/CSV preview, transactional idempotent imports, SKU mapping and image matching are not implemented in this change.
4. **Country compliance:** existing country-aware fiscal calculation is regression-tested, but this does not establish legal compliance. Product-level tax classifications, invoice requirements and any mixed-rate Egypt changes require authoritative country-specific review. Existing historical calculations were preserved.
5. **End-to-end hardware/push acceptance:** camera barcode scanning, cashier reader, physical thermal printers/cutting and background notifications require the corresponding real device, QZ connection and phone permission/subscription.
6. **Policy rollout:** new database restrictions cover catalog, variants, settings and offers. They do not constitute a completed migration of every existing legacy table/RPC to one policy system. Subscription and member checks remain in their existing paths.
7. **UX scope:** the new master configuration forms and POS/inventory changes are incremental; this is not a completed redesign of every administration/public screen.
8. **Monitoring/security baseline:** existing advisory notices and production monitoring need a separate measured remediation pass. Do not infer that all prior notices or operational gaps were resolved.

## Rollout status

Published to main with backwards-compatible admin pages; Supabase Storage remains the image provider and R2 is postponed.

After reconnecting Supabase, migration `business_types_and_configuration_policies` was applied successfully on 2026-10-13. All five business types, the three configuration RPCs, four RLS-protected configuration tables and twelve restrictive module policies are installed. The deployed application automatically uses template management when this schema is available.

Post-migration verification confirmed that all four account configuration fingerprints and their product, variant and order counts exactly match the pre-migration snapshot above. No existing tenant was automatically assigned a template (assigned-account count: zero). Configuration functions are security invoker, authenticated-only, and retain their database-backed admin checks. Supabase security advisors reported no findings on the newly added objects; pre-existing advisory notices remain outside this change. Configuration/PostgreSQL regressions passed again after installation.
