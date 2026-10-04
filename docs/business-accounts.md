# Business accounts and category hierarchy

Admins create empty business accounts at `/admin/accounts/new` and configure any existing account on `/admin/restaurants/[id]`. Business profile, categories, products, QR, settings and billing remain available. Optional modules are POS, reports, orders, staff, tables, menu design, general catalog, service calls and subcategories.

Legacy accounts have `enabled_modules = NULL` and keep all previous tools with subcategories off. Selecting a preset or saving modules changes only that business. The retail preset enables POS, reports, orders, staff and subcategories. It disables tables, service calls, design and the shared catalog. No products, prices or categories are seeded. Menu activation and POS subscription access remain separate from tool configuration.

`categories.parent_id` supports multiple levels, with tenant-aware foreign keys and a trigger preventing self-parenting and cycles. Deleting a parent promotes its immediate children to top level; descendants and products are retained. Hiding a category hides its descendants from the public catalog. Product category selectors show full paths and category filters include descendants. Hierarchy-enabled public catalogs support drilling into categories and searching products/brands.

Apply `supabase/migrations/20261004153511_business_accounts_and_category_hierarchy.sql` before deploying the application. Admin-only configuration is enforced in the database; hidden dashboard routes are checked on the server. Existing RLS continues to isolate each business.

Validation: `npm run typecheck`, `npm run test:business`, `npm run test:catalog`, `npm run build`. The repository-wide lint command has pre-existing React rule failures; changed application files pass ESLint.
