/** @type {import('next').NextConfig} */
const nextConfig = {
  // Czech-only locale (D-004). No i18n library needed — static Czech strings.
  // If multi-locale support ever arrives (Increment 5 per ADR-0001-A), add next-intl here.

  // Strict mode to catch React issues early.
  reactStrictMode: true,

  // Vercel hosting (ADR-0001-F / D-013). No custom server.
  // Output: 'standalone' would be needed for Docker; not used here (Vercel zero-config).
};

module.exports = nextConfig;
