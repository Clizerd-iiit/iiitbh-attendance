import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role     = token?.role as string;

    // 1. Bot & Malicious Scraper Protection
    const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
    const isMaliciousBot = [
      'sqlmap', 'nikto', 'dirbuster', 'masscan', 'nmap', 'wprecon', 'havij', 'acunetix',
      'nessus', 'zgrab', 'censys'
    ].some(bot => userAgent.includes(bot));

    if (isMaliciousBot) {
      return new NextResponse('Access Denied: Automated Scan Detected', { status: 403 });
    }

    const skip = [
      '/api/', '/auth/', '/profile/', '/pending-verification', '/_next/', '/directory/'
    ];
    if (skip.some(p => pathname.startsWith(p))) return NextResponse.next();

    
    if (token?.isActive === false && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/auth/error?error=account_deactivated', req.url));
    }
    if (!token?.profileCompleted && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/profile/setup', req.url));
    }
    if (token?.verificationStatus === 'pending' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/pending-verification', req.url));
    }
    if (token?.verificationStatus === 'rejected' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/auth/error?error=account_rejected', req.url));
    }

    // Role-based route protection
    const isPseudoadmin = !!token?.isPseudoadmin;

    // Pseudoadmin allowed routes
    if (isPseudoadmin && (
      pathname === '/admin/dashboard' ||
      pathname.startsWith('/admin/verify') ||
      pathname.startsWith('/admin/announcements') ||
      pathname.startsWith('/admin/users') ||
      pathname.startsWith('/admin/subjects') ||
      pathname.startsWith('/admin/logs')
    )) {
      return NextResponse.next();
    }

    // Teachers can view /admin/logs, /admin/verify, /admin/appoint
    if (pathname.startsWith('/admin/logs') && ['student', 'teacher', 'superadmin'].includes(role)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/admin/verify') && ['teacher', 'superadmin'].includes(role)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/admin/appoint') && ['teacher', 'superadmin'].includes(role)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/admin') && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/auth/error?error=forbidden', req.url));
    }
    if (pathname.startsWith('/teacher') && role !== 'teacher' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/auth/error?error=forbidden', req.url));
    }
    if (pathname.startsWith('/student') && role !== 'student' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/auth/error?error=forbidden', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
  }
);

export const config = {
  matcher: [
    '/student/:path*', '/teacher/:path*', '/admin/:path*',
    '/profile/:path*', '/pending-verification', '/directory/:path*'
  ],
};
