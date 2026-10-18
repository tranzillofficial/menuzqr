import {getLocale} from "@/lib/i18n/server";
import {getTenantDomain} from "@/lib/tenant-domain";
import {I18nProvider} from "@/components/i18n/I18nProvider";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import Image from "next/image";
import Link from "next/link";
import styles from "@/components/belmir/BelmirLogin.module.css";

/** Guards against protocol-relative ("//evil.com") open-redirect payloads. */
function isSafeNext(next: string | undefined): next is string {
  return Boolean(next) && next!.startsWith("/") && !next!.startsWith("//") && !next!.includes("\\");
}

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const domain=await getTenantDomain();
  const { next } = await searchParams;
  if(domain?.restaurants.owner_id === 'a218bdc9-c6ea-4e81-9f85-bb2570831e23')return (
    <main className={styles.page} dir="ltr">
      <aside className={styles.photo} aria-hidden="true">
        <Image src="/belmir-site/assets/coffee.jpg" alt="" fill priority sizes="50vw" className={styles.image}/>
        <div className={styles.shade}/>
        <div className={styles.story}><p className={styles.eyebrow}>BELMIR · CAFÉ &amp; BAKERY</p><h2>A moment<br/>to <em>share.</em></h2></div>
      </aside>
      <section className={styles.panel} dir="rtl" aria-label="تسجيل الدخول إلى بيلمر">
        <Link href="/" className={styles.back}><span aria-hidden="true">←</span> العودة للموقع</Link>
        <I18nProvider brandName={domain.restaurants.name} locale="ar"><AuthForm mode="login" appearance="belmir" businessName={domain.restaurants.name} next={isSafeNext(next)?next:undefined}/></I18nProvider>
        <p className={styles.footer} dir="ltr">BELMIR COFFEE · YOUR DAILY LITTLE MOMENT</p>
      </section>
    </main>
  );
  return (
    <main className="flex min-h-screen items-center bg-ink-50 px-4 py-12">
      <I18nProvider brandName={domain?.restaurants.name} locale={domain?(domain.restaurants.language==="ar"?"ar":"en"):await getLocale()}><AuthForm mode="login" businessName={domain?.restaurants.name} next={isSafeNext(next) ? next : undefined} /></I18nProvider>
    </main>
  );
}
