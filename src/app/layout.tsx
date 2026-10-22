import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/shared/AuthProvider';
import PWARegister from '@/components/shared/PWARegister';
import { OfflineNotifier } from '@/components/shared/OfflineNotifier';
import { GlobalBackground } from '@/components/shared/GlobalBackground';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <GlobalBackground />
        <AuthProvider>
          <div className="relative z-10 min-h-screen">
            {children}
          </div>
          <PWARegister />
          <OfflineNotifier />
        </AuthProvider>
      </body>
    </html>
  );
}
