import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/shared/AuthProvider';
import PWARegister from '@/components/shared/PWARegister';
import { OfflineNotifier } from '@/components/shared/OfflineNotifier';

const inter = { className: '' };

export const metadata: Metadata = {
  title: 'IIIT Bhagalpur — Attendance',
  description: 'Smart Attendance Management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Attendance',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <PWARegister />
          <OfflineNotifier />
        </AuthProvider>
      </body>
    </html>
  );
}
