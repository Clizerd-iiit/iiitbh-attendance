import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/shared/AuthProvider';
import PWARegister from '@/components/shared/PWARegister';
import { OfflineNotifier } from '@/components/shared/OfflineNotifier';
import { GlobalBackground } from '@/components/shared/GlobalBackground';

const inter = { className: '' };

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://attendance-system-gamma-five.vercel.app'),
  title: {
    default: 'IIIT Bhagalpur AMS — Attendance Management System | IIIT BGP',
    template: '%s | IIIT Bhagalpur AMS',
  },
  description:
    'Official Smart Attendance Management System (AMS) of Indian Institute of Information Technology Bhagalpur (IIIT Bhagalpur / IIIT BGP / IIIT BH). AI face verification, real-time GPS verification, QR codes, CR access, and academic attendance analytics.',
  keywords: [
    'IIIT Bhagalpur',
    'IIIT BGP',
    'IIIT BH',
    'IIITBh',
    'IIIT',
    'Indian Institute of Information Technology Bhagalpur',
    'AMS',
    'IIIT AMS',
    'IIIT Bhagalpur AMS',
    'Attendance Management System',
    'IIIT Bhagalpur Attendance',
    'Smart Attendance System',
    'IIIT Attendance Portal',
    'Student Attendance Portal IIIT',
    'Teacher Attendance Portal IIIT',
    'IIIT Bhagalpur ERP',
    'IIITBGP Attendance',
    'Face Recognition Attendance',
    'QR Code Attendance IIIT',
    'Bhagalpur Engineering College',
    'IIIT B.Tech Attendance',
    'IIIT CSE ECE MAE MNC',
    'Sabour Bhagalpur Bihar',
  ],
  authors: [{ name: 'IIIT Bhagalpur', url: 'https://www.iiitbh.ac.in' }],
  creator: 'IIIT Bhagalpur',
  publisher: 'Indian Institute of Information Technology Bhagalpur',
  applicationName: 'IIIT Bhagalpur AMS',
  openGraph: {
    title: 'IIIT Bhagalpur AMS — Smart Attendance Management System',
    description:
      'Official Attendance Management System for IIIT Bhagalpur students, faculty, and administrators. Instant attendance, Face verification, and live subject analytics.',
    siteName: 'IIIT Bhagalpur AMS',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IIIT Bhagalpur AMS — Attendance Management System',
    description:
      'Official Smart Attendance Management System for students & faculty at Indian Institute of Information Technology Bhagalpur.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'IIIT AMS',
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollegeOrUniversity',
        '@id': 'https://www.iiitbh.ac.in/#college',
        name: 'Indian Institute of Information Technology Bhagalpur',
        alternateName: ['IIIT Bhagalpur', 'IIIT BH', 'IIIT BGP', 'IIITBh', 'IIIT'],
        url: 'https://www.iiitbh.ac.in',
        logo: '/iiitbh-logo.jpg',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Bhagalpur',
          addressRegion: 'Bihar',
          postalCode: '813210',
          addressCountry: 'IN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 25.2425,
          longitude: 87.0189,
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'IIIT Bhagalpur Attendance Management System',
        alternateName: ['IIIT AMS', 'IIIT Bhagalpur AMS', 'IIIT BGP AMS', 'IIIT Attendance Portal'],
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'All (Web, Android, iOS)',
        description:
          'Smart Attendance Management System for IIIT Bhagalpur. Real-time GPS geofencing, QR code, face verification, CR delegation, and attendance analytics for students and faculty.',
        author: {
          '@type': 'EducationalOrganization',
          name: 'IIIT Bhagalpur',
        },
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* GEO Tags for Regional Bhagalpur, Bihar ranking */}
        <meta name="geo.region" content="IN-BR" />
        <meta name="geo.placename" content="Bhagalpur, Bihar, India" />
        <meta name="geo.position" content="25.2425;87.0189" />
        <meta name="ICBM" content="25.2425, 87.0189" />

        {/* Structured JSON-LD Data for Google & AI Answer Engines (ARO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'dark') {
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