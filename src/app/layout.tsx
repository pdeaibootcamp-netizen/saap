import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout — Strategy Radar
 *
 * Czech-only product (D-004): lang="cs", no i18n library.
 * George Business WebView primary surface (ADR-0001-E / information-architecture.md §2b):
 * viewport meta is set for mobile-first rendering at 375px minimum.
 *
 * Feature route groups will nest inside this layout:
 *   /app/brief/     — owner brief view (Phase 2 Track C)
 *   /app/admin/     — analyst authoring back-end (Phase 2 Track A)
 *   /app/onboarding/ — sector profile configuration (Phase 2 Track C)
 */
export const metadata: Metadata = {
  title: "Strategy Radar",
  description: "Měsíční sektorový přehled pro české podnikatele.",
  // No robots indexing for MVP trial; this is a closed pilot.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
