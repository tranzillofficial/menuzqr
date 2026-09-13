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
   check you can re-run any time — and finally
   [`supabase/003-upgrades.sql`](supabase/003-upgrades.sql) — platform settings
   (the support WhatsApp number) and the two extra menu designs — and
   [`supabase/004-staff-realtime-push.sql`](supabase/004-staff-realtime-push.sql)
   — staff accounts, the order/waiter-call column guards, push subscriptions,
   and a realtime repair block that re-asserts the publication and prints what
   it found. **Run them in order.** All four are idempotent, so re-running them
   after an edit is safe. They create
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
| `NEXT_PUBLIC_SITE_URL` | your public origin, no trailing slash — **QR codes embed this** | yes |
| `GEMINI_MODEL` | optional, defaults to `gemini-2.0-flash` | no |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` | yes |
| `VAPID_PRIVATE_KEY` | same command, the private half | **no — server only** |
| `VAPID_SUBJECT` | a `mailto:` or `https:` URL, e.g. `mailto:support@menuzqr.com` | no |

The VAPID pair is what lets the app wake a phone whose screen is off. Leave it
empty and everything still works — live updates, sound and browser
notifications — you just lose alerts while the app is closed.

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

## 4. Deploy to Vercel

1. Import the repository in Vercel.
2. Add the environment variables above under **Settings → Environment Variables**.
   `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` must **not** be prefixed with
   `NEXT_PUBLIC_`.
3. Set `NEXT_PUBLIC_SITE_URL` to your real domain (`https://menuzqr.com`), not the
   `*.vercel.app` preview URL. Printed QR codes embed this value — if it points at a
   preview deployment, every printed code breaks when that deployment is replaced.
   Without it the app falls back to `NEXT_PUBLIC_VERCEL_URL`, which is fine for
   previews and wrong for print.
4. In Supabase → **Authentication → URL Configuration**, set the Site URL to the
   same domain and add it to the redirect allow-list.
5. Redeploy after changing environment variables — Next inlines the
   `NEXT_PUBLIC_*` ones at build time.

Two things worth knowing on serverless:

- The AI rate limiter in `app/api/ai/route.ts` is per-instance, in memory. It is a
  courtesy throttle, not a hard quota. Move it to a shared store if that matters.
- `DEV_ALLOWED_ORIGINS` is only read in development; it does nothing in production.

## 5. Make yourself an admin

Sign up in the app, then run in the SQL editor:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

Sign out and back in, and `/admin` is reachable — restaurants, users, the image
library, the product catalog, QR designs, and platform settings (the support
WhatsApp number, the one-time price and the brand name, all editable without a
redeploy).

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
| `/dashboard` | owner: overview, restaurant, categories, products, tables, QR codes, orders, team, menu design, settings |
| `/station` | waiter and kitchen accounts: a phone-first board of live tickets and calls |
| `/disabled` | dead end for a staff account the owner has switched off |
| `/admin` | platform admin: restaurants, users, image library, product catalog, QR designs, platform settings |
| `/<slug>/menu` | the public menu — **only renders when the restaurant is `active`** |
| `/<slug>/menu?t=<code>` | same menu plus table context: cart, ordering, call waiter |
| `/api/ai` | authenticated, rate-limited Gemini proxy (`GET` reports whether it is configured) |
| `/api/library` | cached shared image library |
| `/api/catalog` | cached shared product catalog |

### Staff accounts

The owner creates sub-accounts at `/dashboard/staff`: a display name they
choose, an email and a password. Those are real Supabase users tied to the
restaurant by a `restaurant_members` row.

| Role | Lands on | Sees | Cannot |
|---|---|---|---|
| `owner` | `/dashboard` | everything | — |
| `chef` | `/station` | new orders, marks them preparing → ready, calls a waiter for pickup | menu, settings, billing, team |
| `waiter` | `/station` | waiter calls, kitchen pickups, orders ready to serve | menu, settings, billing, team |

Two things back this up rather than hidden routes: the RLS policies key off
membership (`owns_restaurant`), and a `before update` trigger on `orders` pins
every column except `status` for non-managers — so a waiter cannot rewrite a
total by calling PostgREST directly, only move a ticket along.

Switching an account off revokes access on the next request: `owns_restaurant`
checks `is_active`, so RLS stops returning rows immediately.

If the owner turns guest ordering off in settings, the table QR still works for
signed-in staff — a waiter scans the table and takes the order themselves. The
menu shows a "staff mode" bar so it is obvious which mode you are in.

### Live updates

Every open screen receives events over two independent paths, de-duplicated by
a deterministic event id so nothing is ever shown twice:

1. **Broadcast** — our server actions post the event to the private Realtime
   topic `restaurant:<uuid>` with the service role. Members may read that topic;
   deliberately nobody but the server may write to it.
2. **`postgres_changes`** — the classic change feed on `orders` and
   `waiter_requests`.

Two paths because either one can be silently misconfigured: the publication may
not contain the table, or Realtime may fail to evaluate the row's RLS policy for
a listener. Both were likely causes of the earlier "nothing appears until I
refresh". The connection state is now visible in the UI — a dot on the
notification bell, and a Live / Connecting / Offline chip on the station header
— so a broken connection is never invisible again.

Who gets alerted:

| Event | Owner | Kitchen | Waiter |
|---|---|---|---|
| new order | ✓ | ✓ | |
| order marked ready | ✓ | | ✓ |
| guest calls a waiter | ✓ | | ✓ |
| kitchen calls a waiter for pickup | ✓ | | ✓ |

Each alert plays `public/notification-sound.mp3`, vibrates the phone where the
browser supports it, and raises a system notification. The sound element is
unlocked on the first tap anywhere in the app, because browsers refuse to play
audio before a user gesture.

### Installing it as an app

`app/manifest.ts` plus `public/sw.js` make the dashboard and the station screen
installable. **Settings → Alerts and notifications** has one card for all of it:
connection state, sound (with a test button), notification permission,
background push, and the install button.

Worth knowing:

- On iPhone, web push only works once the site has been added to the Home
  Screen. The card says so when it detects iOS.
- A push notification cannot carry a custom sound — the phone plays its own
  system sound. When a tab *is* open, the service worker messages the page and
  our own chime plays.
- The service worker deliberately does not cache pages. A stale order board
  would be worse than no order board; only the alert assets are cached.

### Data model

`profiles · restaurants · restaurant_members · restaurant_settings · categories ·
products · product_variants · restaurant_tables · orders · order_items ·
waiter_requests · admin_actions · menu_images · qr_templates · catalog_items ·
platform_settings`

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

### Menu designs

`restaurants.menu_theme` is one of `elegant` · `modern` · `minimal` · `noir` ·
`market`. One data layer, five renderers in `components/menu/themes/`. Switching
a design never touches categories, products, sizes or prices.

To add another: add the id to `MENU_THEMES` in `lib/constants.ts`, to the
`menu_theme` check constraint in SQL, `theme.<id>.*` to **both** dictionaries,
and a component to the `THEMES` map in `MenuExperience.tsx`.

### Languages

The interface ships in English and Arabic, with full RTL. `lib/i18n/en.ts` is the
source dictionary and `lib/i18n/ar.ts` is typed as a complete mirror of it — a key
missing from Arabic is a **compile error**, not an English word leaking into an
Arabic page.

- The visitor's choice lives in the `mz_locale` cookie; the switcher is in the
  dashboard sidebar, the account menu, and the landing header and footer.
- The **public menu** is different: its chrome follows the restaurant's own
  `language` setting, not the visitor's, because the guest is reading that
  restaurant's menu.
- Menu content itself is never translated. The owner writes each product once, in
  whichever language they prefer.
- Layout mirrors through CSS logical properties (`ms-`, `pe-`, `start-`, `end-`),
  so there is no second stylesheet to maintain.

### Smart product suggestions

There is **no AI writing** in the product editor. Instead an admin fills the
shared catalog at `/admin/catalog` with real, reviewed items — name, description,
ingredients, photo, suggested section and sizes. When an owner starts typing a
product name, close matches appear under the field; one tap fills the form and
they edit anything before saving. Deterministic, instant, and free.

`lib/ai.ts` and `/api/ai` are still in the tree (server-side only, key never
exposed) but nothing in the UI calls them. Delete both if you do not plan to
bring AI back.

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