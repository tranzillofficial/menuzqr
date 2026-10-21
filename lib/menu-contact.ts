/** Keep dialable numbers separate from WhatsApp and reject URI/control injection. */
export function contactPhones(values: string[], fallback?: string | null): string[] {
  return [...new Set([...values, ...(fallback ? [fallback] : [])].map(value => value.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0)).replace(/[\s().-]/g, '')).filter(value => /^\+?\d{8,15}$/.test(value)))];
}
export function safeContactUrl(value?: string | null): string {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
