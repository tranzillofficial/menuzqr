import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : undefined;
  } catch {
    return undefined;
  }
})();

// Testing on a phone over the LAN? Next 16 blocks cross-origin dev requests
// for /_next/* unless the origin is allowed here. Set DEV_ALLOWED_ORIGINS in
// .env.local, e.g. DEV_ALLOWED_ORIGINS=192.168.1.10
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  images: {
    // Every stored file has an immutable uuid name, so optimised variants can
    // be cached for a year. Uploads are already downscaled in the browser.
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 420, 640, 828, 1080, 1440, 1920],
    imageSizes: [48, 64, 96, 128, 200, 256, 384],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [
          {
            protocol: "https",
            hostname: "*.supabase.co",
            pathname: "/storage/v1/object/public/**",
          },
        ],
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, and it needs to
        // control the whole origin — not just /.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/notification-sound.:ext(mp3|ogg)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
