# MenuzQR

Digital QR menus for restaurants and cafés. Owners build a menu in a dashboard,
print a QR code for every table, and take orders and waiter calls straight from
the table. Public menus stay locked until an admin activates the account.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Auth, Postgres, Storage, Realtime, RLS)
- **Pricing model:** $20 one-time, paid over WhatsApp, activated manually by an admin. No payment gateway.

---

## 1. Set up Supabase

1. Create a new Supabase project.
2. Open **SQL Editor → New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql) and run it. Then do the same
   with [`supabase/002-upgrades.sql`](supabase/002-upgrades.sql) — short table
   codes, QR label designs, the shared product catalog, and a storage-bucket
   check you can re-run any time.
   Both are idempotent, so re-running them after an edit is safe. They create
   every table, RLS policy, trigger and storage bucket. The image library and
   the product catalog both start empty; you fill them from `/admin`.
3. **Authentication → Sign In / Providers → Email:** enable the email provider.
   For a quick first run you can turn *Confirm email* off; leave it on in production.
4. **Authentication → URL Configuration:** set the Site URL
   (`http://localhost:3000` while developing, `https://menuzqr.com` in production).

## 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where to find it | Exposed to the browser |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys (publishable / anon) | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys (service_role / secret) | **no — server only** |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | **no — server only** |
| `NEXT_PUBLIC_SITE_URL` | your public origin, no trailing slash — used to build QR links | yes |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | support number, digits only | yes |

`.env*` is gitignored. Never prefix a secret with `NEXT_PUBLIC_`.

## 3. Run it

```bash
npm install
npm run dev
```

**Testing the phone view over Wi-Fi.** Next prints a Network URL, but two
things usually block it:

1. Windows Firewall. Allow the port once, from an elevated PowerShell:
   `New-NetFirewallRule -DisplayName "Next dev 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private`
2. Next 16 rejects cross-origin dev requests. Put your LAN IP in
   `DEV_ALLOWED_ORIGINS` in `.env.local`, and set `NEXT_PUBLIC_SITE_URL` to the
   same host so QR codes point at something your phone can reach.

## 4. Make yourself an admin

Sign up in the app, then run in the SQL editor:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

Sign out and back in, and `/admin` is reachable.

`is_admin` cannot be granted from the app: the `guard_profile_admin` trigger
resets it for anyone who is not already an admin. The SQL editor is exempt
because it connects without an end-user JWT (`auth.uid()` is null) — that is
how the first admin gets created.

---

## How it fits together

```
Guest scans a table QR
        │  /<slug>/menu?table=tbl_xxxxxxxx
        ▼
Public menu (3 themes)  ──► server action (service role, validates everything)
        │                          │
        │                          ▼
        │                   orders / waiter_requests
        │                          │
        │                   Supabase Realtime
        │                          ▼
        └──────────────►  Owner dashboard: sound + browser notification
```

### Routes

| Route | Who |
|---|---|
| `/` | marketing page |
| `/login`, `/signup` | Supabase email + password auth |
| `/dashboard` | owner: overview, restaurant, categories, products, tables, QR codes, orders, menu design, settings |
| `/admin` | platform admin: restaurants, users, image library, product catalog, QR designs |
| `/<slug>/menu` | the public menu — **only renders when the restaurant is `active`** |
| `/<slug>/menu?t=<code>` | same menu plus table context: cart, ordering, call waiter |
| `/api/ai` | authenticated, rate-limited Gemini proxy (`GET` reports whether it is configured) |
| `/api/library` | cached shared image library |
| `/api/catalog` | cached shared product catalog |

### Data model

`profiles · restaurants · restaurant_members · restaurant_settings · categories ·
products · product_variants · restaurant_tables · orders · order_items ·
waiter_requests · admin_actions · menu_images · qr_templates · catalog_items`

Prices live on **`product_variants`**, never on `products` — every product has one
or more sizes (Small / Medium / Large, Regular / Double…), each with its own price.

`restaurant_members` exists so a user can own several restaurants later without a
migration. Today the UI creates exactly one per user.

### Security model

- Every table has RLS on, with no permissive default.
- Owners and members reach only their own restaurant's rows, enforced by the
  `owns_restaurant()` / `can_manage_restaurant()` SECURITY DEFINER helpers. Read
  access is granted to any member; insert, update and delete require the
  `owner` or `manager` role.
- `anon` has no table access at all. Public menu reads and guest orders go
  through server-side code using the service role, which re-checks activation,
  the table token and — critically — **re-reads every price from the database**.
  Prices sent by the client are ignored.
- Activation and billing columns are frozen by a trigger on INSERT *and* UPDATE,
  so a user cannot publish their own menu by inserting a row with
  `status = 'active'`.
- Table codes are 8 random characters from an unambiguous alphabet (~40 bits),
  never the table number and never a database id. A plain number would let
  anyone order or call a waiter for any table by editing the URL. A leaked code
  can be rotated from the Tables page without deleting the table.
- Storage writes are restricted to `restaurant-assets/<your restaurant id>/…`.
  SVG uploads are rejected — those buckets are served from a public origin.
- Image URLs saved to the database must point at one of our own buckets; an
  external link pasted into a form is dropped (`sanitiseImageUrl`).
- `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are only ever read in modules
  that `import "server-only"`.

### Menu themes

`restaurants.menu_theme` is `elegant` | `modern` | `minimal`. One data layer,
three renderers in `components/menu/themes/`. Switching a theme never touches
categories, products, sizes or prices. To add a fourth: add the id to
`MENU_THEMES` in `lib/constants.ts`, the `menu_theme` check constraint in
`schema.sql`, and a component to the `THEMES` map in `MenuExperience.tsx`.

### AI assistance

Optional everywhere. Gemini is called only from `/api/ai`, only for a signed-in
user, at most 15 requests per minute per user, only on an explicit button press —
never on keystrokes. Responses are requested as structured JSON and validated
before display. Nothing is saved until the owner accepts a suggestion. If
`GEMINI_API_KEY` is unset the buttons simply report that AI is unavailable and
the rest of the app is unaffected.

### Images

Two sources, one pipeline:

- **The shared library** — photos an admin uploads at `/admin/library`. They land
  in the `menu-library` bucket, a row goes into `menu_images`, and every
  restaurant sees them in the picker. `menu_images` ships **empty**; nothing is
  bundled with the repo.
- **The restaurant's own photos** — uploaded from the product, category or
  branding forms into `restaurant-assets/<restaurant id>/…`.

Every upload, from either side, goes through the same steps:

1. **Compressed in the browser** before it leaves the device
   (`lib/image.ts`): downscaled to the longest edge for its role
   (logo 512px, product/category 1200px, cover 1600px), re-encoded as WebP
   (JPEG fallback), EXIF rotation applied, transparency flattened for JPEG.
   A 12 MB phone photo typically becomes ~130 KB. If the re-encode would not
   actually be smaller, the original is kept.
2. **Stored under an immutable uuid filename** with `cache-control: 31536000`.
3. **Served through `next/image`** as AVIF/WebP at the size actually needed,
   cached for a year (`minimumCacheTTL` in `next.config.ts`).
4. **Loaded lazily**, with a skeleton and a fade-in
   (`components/ui/SmartImage.tsx`, `components/menu/MenuMedia.tsx`). Only the
   menu header image is marked `priority`.

The library list is read through **`/api/library`**, a cached route handler —
the database is hit when an admin changes the library, not on every page view.
Admin writes call `revalidatePath("/api/library")`, and the picker also keeps an
in-memory copy for the session.

Only upload photos you own or that are explicitly cleared for commercial use.
`license` is a required field on every library image, and SVG uploads are
rejected outright (public origin + script).

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
#   m e n u z q r  
 