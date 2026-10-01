# Sales tax and electronic journal

Restaurant settings offer UK (GBP, Europe/London), UAE (AED, Asia/Dubai) and Saudi (SAR, Asia/Riyadh) modes. Nothing is enabled automatically on an existing restaurant. VAT registration, legal name, invoice address and VAT number are supplied by the merchant. Switching market sets its currency and timezone; it does not convert existing product prices. Review prices and product classifications before switching markets.

UK Standard 20%, Reduced 5%, Zero and Exempt are separate classifications. UAE Standard 5%, Saudi Standard 15%; Zero and Exempt remain distinct. Reduced is available only in UK mode. The merchant chooses the classification; the system does not infer the treatment of restaurant meals, takeaway food or drinks. A nonregistered merchant charges no VAT; this is distinct from an exempt product.

For VAT-inclusive prices the line VAT is rounded to the nearest minor unit from `gross * rate / (100 + rate)`, and line net is the exact remaining amount. For exclusive prices VAT is rounded from `net * rate / 100`. Public menu prices include VAT. Totals sum persisted line amounts, rather than rounding the aggregate or repeatedly rounding each unit.

The service-only checkout transaction re-reads prices, checks membership/restaurant/table/product validity, locks the restaurant and products, and saves items, the immutable tax/seller/customer snapshot, and the sale event atomically. Request IDs make POS retries idempotent. Table QR orders use the same transaction and start unpaid. A manager records cash/card payment separately from kitchen completion. Product or seller changes cannot recalculate old receipts. Existing paid POS sales are retained as historical events with `legacy_unknown` VAT; no historical tax treatment is invented.

UK full invoices include buyer details. UK simplified invoices are used only at GBP 250 or below without exempt lines; other sales retain a receipt until a full invoice is requested. UAE nonregistered-buyer simplified invoices and full invoices are available. A supplemental full VAT invoice can be issued for a paid table order, using its original tax and seller snapshot plus immutable customer details. Legacy orders lacking VAT data cannot be retrospectively issued a tax invoice. Full refunds create a separate credit note and reversal event linked to the original invoice. Refunds cannot be repeated, and voids are restricted to unpaid orders. Partial refunds, discounts, tips, split payments, inventory adjustments and VAT returns are outside this release.

The electronic journal records order creation, line snapshots, status changes, print requests, product/price changes, seller setting changes, invoice issuance and Z closes, including actor, time, reason, before and after values. Browser printing is logged as requested; bridge printing is logged as sent to printer, not proof of physical paper output. Database permissions and triggers prevent hard deletes and changes to issued order amounts, line snapshots, audit entries, financial events, VAT documents or Z reports, including cascade deletes.

Daily reporting uses the restaurant's local day (including UK daylight saving), payment event time, and original VAT breakdowns. Refunds reverse the original rates on the refund day. Cash/card figures are net of recorded refunds, not card processor settlements. Currencies are kept separate. A Z close freezes every committed event since the previous close, under the same restaurant lock used by checkout/refund. One close per calendar day; later events enter the next close. Daily reports remain live. First close covers unclosed historical events. JSON Z exports and CSV daily sales/journal exports are authenticated and scoped to the manager's restaurant. CSV contains the VAT breakdown JSON and original journal data; no REST row limit truncates it.

Records have no scheduled deletion. Retain exports and independent backups for required statutory periods (UK normally at least six years); a live database is not an independent backup. This release supports record keeping and accountant exports. It is not an HMRC MTD submission integration, a certified tax service, UAE structured e-invoicing, or a ZATCA compliant generation/integration solution. Saudi output is explicitly labelled a sales receipt and is not presented as a compliant electronic tax invoice. ZATCA XML/signing, onboarding/CSIDs, clearance/reporting and UAE ASP integration require a separate implementation and merchant onboarding.

## Validation

`npm run test:tax`: monetary rounding, mixed rates, inclusive/exclusive prices, UK DST, currencies, actual PostgreSQL transactions via PGlite, refunds, frozen snapshots, full invoice issuance, country modes, service-role execution, cross-restaurant access, RLS, immutable records and idempotent closes. `npm run typecheck`, scoped ESLint and `npm run build` verify the app.

## Official references checked 2026-10-01

- https://www.gov.uk/vat-rates
- https://www.gov.uk/guidance/vat-guide-notice-700
- https://www.gov.uk/guidance/record-keeping-for-vat-notice-70021
- https://www.gov.uk/charge-reclaim-record-vat/keeping-vat-records
- https://tax.gov.ae/en/faq.aspx?keyword=What+is+the+standard+rate+of+VAT+in+the+UAE%3F
- https://www.tax.gov.ae/en/taxes/Vat/uae.einvoicing.aspx
- https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx
- https://www.zatca.gov.sa/en/HelpCenter/guidelines/Documents/Economic%20Activity.pdf

## Configurable country rates and Egypt

Egypt defaults to 14% standard VAT, EGP and Africa/Cairo. Managers may configure standard and reduced rates independently for UK, UAE, Saudi and Egypt (0–100, two decimal places). Zero and exempt stay 0, and unregistered businesses collect no VAT. Use appropriate rates for the business and supply. Egypt is a sales receipt mode; ETA electronic invoicing/receipt integration is not implemented.

Three pricing choices apply to existing entered product values without rewriting them: inclusive, exclusive with gross menu prices, or exclusive with base menu prices. For 100 and 14%, inclusive yields net 87.72 + VAT 12.28 = total 100; either exclusive choice yields net 100 + VAT 14 = total 114. Base price menus disclose excluded VAT, and cart/POS show the VAT and final total before confirmation. Quantity calculations retain per-line rounding. Changing modes repeatedly never compounds VAT. Existing immutable snapshots, invoices and refunds retain their original rate. Changing country does not convert numeric product values across currencies.

Egypt rate source: https://www.eta.gov.eg/ar/news/twdh-khdw-almtam-walkafyhat-almhddt-bqrarat-wzyr-almalyt-ldrybt-alqymt-almdaft
