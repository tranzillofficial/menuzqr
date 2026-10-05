# Shared catalog activities and beverage completion

The platform catalog has one canonical product per name. Categories carry `business_types` and can serve several activities without duplicating products. Both the owner catalog, the product editor catalog modal, and the admin catalog offer the activity filter. Admins assign one or more activities when saving a category. Existing category RLS remains in force.

Activities: café, restaurant, supermarket, sweets shop, and retail shop. Soft drinks appear for cafés, restaurants, supermarkets, and retail shops; shisha is café only. The filter organizes available products; it does not invent supermarket inventory or hide items from existing customer menus.

`catalog-beverages.json` transcribes 48 canonical drinks from the supplied photo, excluding «صحتك بالدنيا». The two espresso rows become single and double variants of one product. The two juice price columns are represented as regular and «سفاري» (Safari), preserving the photo's heading; no volumes or fulfillment methods are inferred. Seven existing drinks are updated instead of duplicated, leaving 41 new items.

Prices in the photo are initial EGP suggestions. Missing prices on other shared products receive editable suggestions. Picking a catalog suggestion in the product editor now also transfers its suggested price when it has no named variants. Existing customer prices are independent and unchanged.

`catalog-completion.json` records the existing shared products needing images or prices. Images are illustrative; closely related flavors can share a representative image. Existing nonempty product photos are preserved. `catalog-photo-sources.json` lists the final stored image URLs, checksums, licensed stock source pages, and the final prompt set for nine assets created using the built-in image generation tool. Each new image was visually reviewed, converted to WebP, uploaded with an immutable filename, and verified by public download and SHA-256 comparison.

Apply the `catalog_business_activities` migration before using the activity UI. `supabase/seeds/catalog_beverages.sql` is an idempotent shared-catalog-only transaction. It asserts complete positive prices and images for canonical products and variants. It does not write customer products, customer categories, customer variants, or orders.

Validation: `npm run test:catalog`, TypeScript, production build, changed-file ESLint, complete catalog checks, and before/after fingerprints of customer products, categories, variants, and orders. The repository-wide lint command has pre-existing failures in unrelated files; the changed files are checked separately.
