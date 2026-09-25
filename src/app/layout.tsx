import type { Metadata } from 'next';
// import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/shared/AuthProvider';

const inter = { className: '' };

export const metadata: Metadata = {
  title: 'IIIT Bhagalpur — Attendance System',
  description: 'Smart Attendance Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
