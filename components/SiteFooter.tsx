import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { getPlatformSettings } from "@/lib/platform";
import { infoPages } from "@/lib/info-pages";
import { Icon } from "@/components/ui/Icons";
import styles from './SiteChrome.module.css';

export async function SiteFooter() {
  const [locale, platform] = await Promise.all([getLocale(), getPlatformSettings()]);
  const ar = locale === "ar";

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div>
            <Link href="/" className={`${styles.brand} ${styles.footerBrand}`}>
              <span className={styles.logo}>
                <Icon.qr className="size-4.5" />
              </span>
              <span>{platform.brandName}</span>
            </Link>
            <p className={styles.footerDescription}>
              {ar
                ? "منيو إلكتروني، أكواد QR، طلبات الطاولات ونقطة بيع بسيطة في مكان واحد."
                : "Digital menus, QR codes, table ordering and a simple point of sale in one place."}
            </p>
          </div>

          <div>
            <h2 className={styles.sectionTitle}>
              {ar ? "معلومات مهمة" : "Important information"}
            </h2>
            <nav
              aria-label={ar ? "معلومات الموقع" : "Site information"}
              className={styles.footerLinks}
            >
              {Object.entries(infoPages).map(([slug, page]) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className={styles.footerLink}
                >
                  {page[locale]}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h2 className={styles.sectionTitle}>
              {ar ? "الدعم والتواصل" : "Support"}
            </h2>
            <div className={styles.supportLinks}>
              <a
                href={platform.supportWhatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.whatsapp}
              >
                <Icon.whatsapp className="size-4 shrink-0" />
                {ar ? "واتساب الدعم" : "WhatsApp support"}
              </a>
              {platform.supportEmail && (
                <a
                  href={`mailto:${platform.supportEmail}`}
                  className={styles.email}
                >
                  {platform.supportEmail}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className={styles.copyright}>
          <p>
            © {new Date().getFullYear()} {platform.brandName}.{" "}
            {ar ? "كل الحقوق محفوظة." : "All rights reserved."}
          </p>
        </div>
      </div>
    </footer>
  );
}
