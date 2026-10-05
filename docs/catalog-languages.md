# Shared catalog and menu languages

Catalog names use Arabic `name` and optional English `name_en`. The public menu has a visitor language switch across all themes. Product/category editors expose English names, including product sizes. Missing translations fall back to the merchant's saved name; no automatic translation service is called.

Catalog imports copy both names. Existing merchant copies remain independent: source names are translated for display only while their names still match the source Arabic, English, or recorded legacy name. Merchant custom names and translations take precedence. Language changes preserve product/variant IDs, prices, basket contents, and ordering context.

The October 2026 cleanup merges three duplicate dishes and two duplicate sections, retains price guidance, moves fruit shisha and noodles into their appropriate sections, and leaves distinct dishes/sizes intact. Retired source rows remain as `merged_into_id` aliases, excluded from browsing and suggestions. Imports recognize old source IDs to avoid duplicate products or renamed merchant sections. Existing merchant categories, products, variants, and orders were fingerprinted before and after the cleanup and remained identical.

`npm run test:catalog` covers merge aliases, bilingual imports, permission checks, unchanged merchant data, and language fallback.
