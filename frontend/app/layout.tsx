import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/**
 * Az Inter self-hosted (a next/font a build során beágyazza) — nincs futásidejű
 * külső betűtípus-kérés, ami jobb LCP-t és adatvédelmet ad. A `display: swap`
 * elkerüli a láthatatlan szöveg villanását (FOIT).
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Cross-Docking | Admin Dashboard',
  description:
    'Cross-Docking API PoC admin felület — csomag-szkennelés, állapotkövetés és mozgástörténet.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="hu" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
