import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { PRICE_USD, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/constants";
import { getUser } from "@/lib/auth";

const FEATURES = [
  {
    title: "A menu that looks premium",
    body: "Three polished designs built for phones — Elegant, Modern and Minimal. Switch any time without touching your products.",
  },
  {
    title: "QR codes for every table",
    body: "One code for the whole venue plus a unique, unguessable code per table. Download print-ready PNG or SVG.",
  },
  {
    title: "Orders straight from the table",
    body: "Guests pick sizes, add notes and send the order. It lands on your dashboard instantly — no app to install.",
  },
  {
    title: "Call the waiter",
    body: "One tap at the table rings your dashboard with sound and a browser notification.",
  },
  {
    title: "AI that writes the boring parts",
    body: "Suggest names, descriptions, ingredients, sections and sizes. You always approve before anything is saved.",
  },
  {
    title: "Photos included",
    body: "Don't have pictures yet? Pick from the built-in illustration library, or upload your own.",
  },
];

const STEPS = [
  "Create your account and restaurant",
  "Add sections, products, sizes and prices",
  "Pick a menu design and create your tables",
  "Generate and print your QR codes",
  `Send us $${PRICE_USD} on WhatsApp — we switch your menu live`,
];

export default async function HomePage() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Icon.qr className="size-4.5" />
            </span>
            MenuzQR
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <LinkButton href="/dashboard" size="sm">
                Go to dashboard
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" size="sm">
                  Sign in
                </LinkButton>
                <LinkButton href="/signup" size="sm">
                  Get started
                </LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50 via-white to-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
                <Icon.sparkles className="size-3.5" />
                Digital menus for restaurants &amp; cafés
              </p>
              <h1 className="mt-5 font-serif text-4xl leading-tight text-ink-900 sm:text-5xl lg:text-6xl">
                Build a beautiful digital menu in minutes.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-600 text-balance-pretty">
                MenuzQR turns your menu into a fast, elegant page behind a QR code — with table
                ordering, waiter calls and a dashboard your staff can actually use.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/signup" size="lg">
                  Create your menu
                </LinkButton>
                <LinkButton href={SUPPORT_WHATSAPP_URL} variant="secondary" size="lg" target="_blank">
                  <Icon.whatsapp className="size-4" />
                  Talk to us
                </LinkButton>
              </div>
              <p className="mt-4 text-sm text-ink-500">
                ${PRICE_USD} one-time. No monthly fee, no card needed to start building.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-sm">
              <div className="rounded-[2rem] border-8 border-ink-900 bg-ink-900 shadow-2xl">
                <div className="overflow-hidden rounded-[1.5rem] bg-white">
                  <div className="relative h-32 bg-gradient-to-br from-brand-500 to-brand-700">
                    <div className="absolute -bottom-7 left-5 grid size-16 place-items-center rounded-2xl border-4 border-white bg-white text-xl font-semibold text-brand-700 shadow">
                      CC
                    </div>
                  </div>
                  <div className="px-5 pb-6 pt-10">
                    <p className="font-serif text-xl text-ink-900">Cairo Café</p>
                    <p className="text-xs text-ink-500">Downtown · Open until 1:00</p>
                    <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
                      {["Breakfast", "Burgers", "Coffee", "Desserts"].map((c, i) => (
                        <span
                          key={c}
                          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                            i === 0 ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600"
                          }`}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Shakshuka", "Eggs poached in spiced tomato", "$ 6"],
                        ["Halloumi Toast", "Grilled halloumi, avocado, chilli", "$ 7"],
                        ["Flat White", "Double ristretto, silky milk", "$ 3"],
                      ].map(([name, desc, price]) => (
                        <div key={name} className="flex gap-3">
                          <div className="size-14 shrink-0 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-900">{name}</p>
                            <p className="truncate text-xs text-ink-500">{desc}</p>
                          </div>
                          <p className="text-sm font-semibold text-ink-900">{price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="font-serif text-3xl text-ink-900">Everything a small venue needs</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-ink-200 bg-white p-5">
                <h3 className="text-base font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-ink-100 bg-ink-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl text-ink-900">How it works</h2>
              <ol className="mt-6 space-y-4">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-sm text-ink-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-ink-200 bg-white p-7">
              <p className="text-sm font-medium text-ink-500">Simple pricing</p>
              <p className="mt-2 font-serif text-5xl text-ink-900">
                ${PRICE_USD}
                <span className="ml-2 align-middle text-base font-sans text-ink-500">one-time</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-700">
                {[
                  "Unlimited products and sections",
                  "Unlimited tables and QR codes",
                  "Table ordering and waiter calls",
                  "All three menu designs",
                  "AI menu assistance",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Icon.check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7 space-y-3">
                <LinkButton href="/signup" className="w-full">
                  Start building free
                </LinkButton>
                <p className="text-center text-xs text-ink-500">
                  Build your whole menu first. Pay only when you want it live.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} MenuzQR</p>
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 hover:text-ink-800"
        >
          <Icon.whatsapp className="size-4" />
          {SUPPORT_WHATSAPP_DISPLAY}
        </a>
      </footer>
    </div>
  );
}
