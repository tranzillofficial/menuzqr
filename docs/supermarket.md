# Supermarket accounts

Accounts with business_kind=supermarket use the white/red storefront, category tiles and category product grids. Enable pos, reports, orders, customers, subcategories, branch, products, qr and settings with features_v2; omit tables, staff and service_calls.

Apply 20261009165845_supermarket_customers.sql before deploying. Online supermarket orders accept pay on delivery without requiring transfer details. Name, phone and delivery address are required; variants and prices are still read by create_fiscal_order. The product editor offers four weight variants with individually entered prices: 250 g, 500 g, 750 g and 1 kg.

Customers are deduplicated per business by phone during the same order transaction. Anonymous orders cannot change saved customer details. Owners/managers can search and edit customer names, addresses and unique optional codes at /dashboard/customers. Customer details, including any code already assigned, are snapshotted on new invoices and thermal receipts; historical invoices remain immutable. No customer data is publicly queryable.

Master Mart was provisioned with ten empty grocery categories. Merchant products, photos and prices must be entered before accepting sales. POS access was initialized for one month; renew via the existing subscription controls.

Validation: TypeScript and production build; business module tests; rollback-only database integration test covering pay-on-delivery checkout, weight variant pricing, mandatory address, customer deduplication and code snapshots. No verification orders remain in production.
