# Activity onboarding implementation — 2026-10-16

Branch: `feature/activity-onboarding-v1`. Production database is unchanged.

## Implemented
- Activity-first three-step signup, orange/cream compact responsive cards and original supplied grocery basket asset.
- Server-validated slug availability and unique-index conflict handling; name edits do not affect existing tenant slugs.
- Draft saved to the authenticated user's metadata with bounded normalization. Metadata contains preferences only, never authorization.
- New tenants start inactive/unpaid with setup-only modules, regardless of selected plan. Existing tenant records are not updated by onboarding.
- Single deterministic tenant primary key for concurrent creation retries, explicit existing-owner/membership checks.
- Phone, logo URL, description and social links; uploaded logo editing remains available after account creation.
- Activity-dependent public pricing. Restaurant/café existing prices retained; supermarket 800 one-time and 100/200/300 monthly, 1000/2000/3000 yearly.
- Clear separate menu activation fee; unavailable multi-branch/advanced reporting explicitly marked in preparation.
- Overview-first navigation with products/categories near the top and distinct orders/invoices/reports entries. Existing module rules unchanged.
- Separate additive supermarket staging schema with read-only authenticated access to approved records and rights-approved images.
- Deterministic catalog preparation and insert-only idempotent import. No name-based merging, no invented ImageKit URLs, no image uploads, no changes to merchant prices/inventory.

## Verified locally
- TypeScript and production build.
- Onboarding normalization, setup permissions, activity filtering and slug regression tests.
- Existing business configuration/RLS, business accounts, offer pricing/QR and fiscal/tax regression suites all passed.
- New catalog RLS test: pending rows hidden, approvals cannot be changed by clients, unreviewed images hidden, anonymous access denied.
- Source archive dry run: 21,342 products; 11,009 pass GTIN checksum; zero marked verified by source; 315 possible retailer/variable-weight codes; 2,190 source review flags. All rows remain pending.

## Release blockers / incomplete scope
- `image_manifest.csv` is not available. No image links have been imported.
- Production project `hoklwbuafvhpkbvjgfhd` was identified from Vercel, but it is absent from all five connected Supabase accounts. Live schema, backup and restore were not verified; no remote migration or import was attempted.
- Supabase runtime variables are scoped to production, not preview. A proper preview database/environment is required for end-to-end account creation and payment/access tests.
- The requested new plan entitlement engine, database-enforced 2/4/>4 staff limits, expiry/add-on handling and administrator plan activation are NOT implemented by this patch. Existing authorization stays in force. Public pricing is a request for manual activation, not evidence of completed tier enforcement.
- Supermarket staging is NOT connected to the existing food-service catalog browser or product barcode editor. This needs approved identities and the manifest, plus a tenant-safe atomic import procedure.
- Browser/phone screenshots and physical POS receipt tests were not run. Do not promote based solely on build success.
- Full cross-table tenant backup/restore and all 16 acceptance scenarios remain release gates.

## Migration and rollback
`supabase/migrations/20261016152938_supermarket_catalog_staging.sql` is unapplied. It only creates separate staging tables and does not touch existing restaurant/product/order/food catalog records.
Before applying: verify target project, export schema and all tenant data with a restore test, then apply and run RLS tests on a preview database first.
Rollback application changes by reverting this branch's implementation commit. Leave unused staging tables in place; do not drop customer data. Imported source rows default pending and cannot be read by anonymous clients.

## Catalog commands
```sh
python scripts/prepare-supermarket-catalog.py INPUT.zip --output PREPARED_DIRECTORY
node scripts/import-supermarket-staging.mjs PREPARED_DIRECTORY
```
The second command is dry-run by default. Apply only to the verified staging project with server-side credentials and `--apply`. Existing IDs are ignored, preserving review decisions. To attach images pass the actual manifest and explicit `--manifest-columns` mapping for category, filename, url, file_id, file_path. Review image rights separately before publication. GTIN checksum validity alone must never mark a barcode verified.
