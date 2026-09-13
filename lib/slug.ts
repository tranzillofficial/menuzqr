const RESERVED = new Set([
  "admin",
  "dashboard",
  "login",
  "signup",
  "signout",
  "api",
  "auth",
  "menu",
  "next",
  "_next",
  "static",
  "public",
  "assets",
  "library",
  "support",
  "pricing",
  "about",
  "terms",
  "privacy",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

/**
 * Produces a lowercase, ASCII, URL-safe slug.
 * Non-latin scripts (Arabic, etc.) are stripped, so callers must handle an
 * empty result by falling back to `randomSlug()`.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function randomSlug(prefix = "menu"): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(prefix) || "menu"}-${suffix}`;
}

export function validateSlug(raw: string): { value: string; error?: string } {
  const value = slugify(raw);
  if (value.length < 3) {
    return {
      value,
      error:
        "Slug must be at least 3 characters and use latin letters, numbers or dashes.",
    };
  }
  if (RESERVED.has(value)) {
    return { value, error: "This slug is reserved. Please choose another one." };
  }
  return { value };
}

export function isReservedSlug(value: string): boolean {
  return RESERVED.has(value);
}
