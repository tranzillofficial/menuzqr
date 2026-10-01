import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { LocaleSwitch } from '@/components/i18n/LocaleSwitch';
import { getT, getLocale } from '@/lib/i18n/server';
import styles from './SiteChrome.module.css';

export async function SiteHeader({ brandName, signedIn }: { brandName: string; signedIn: boolean }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const ar = locale === 'ar';
  const actions = signedIn
    ? [{ href: '/dashboard', label: ar ? 'لوحة التحكم' : 'Dashboard', primary: true }]
    : [{ href: '/login', label: t('landing.signIn'), primary: false }, { href: '/signup', label: t('landing.getStarted'), primary: true }];
  return <header className={styles.header}>
    <div className={styles.headerRow}>
      <Link href="/" className={styles.brand}>
        <span className={styles.logo}><Icon.qr className="size-4.5" /></span>
        <span className={styles.brandName}>{brandName}</span>
      </Link>
      <LocaleSwitch compact />
      <nav aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'} className={styles.desktopActions}>
        {actions.map(action => <Link key={action.href} href={action.href} className={action.primary ? styles.primaryAction : styles.plainAction}>{action.label}</Link>)}
      </nav>
      <details className={styles.mobileMenu}>
        <summary aria-label={ar ? 'قائمة الموقع' : 'Site menu'} className={styles.menuToggle}>
          <Icon.menu className="size-5" />
        </summary>
        <nav aria-label={ar ? 'قائمة الموبايل' : 'Mobile navigation'} className={styles.menuPanel}>
          {actions.map(action => <Link key={action.href} href={action.href} className={action.primary ? styles.primaryAction : styles.plainAction}>{action.label}</Link>)}
        </nav>
      </details>
    </div>
  </header>;
}
