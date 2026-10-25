import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role     = token?.role as string;

    // 1. Malicious Bot & Vulnerability Scanner Protection
    const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
    const isMaliciousBot = [
      'sqlmap', 'nikto', 'dirbuster', 'masscan', 'nmap', 'wprecon', 'havij', 'acunetix',
      'nessus', 'zgrab', 'censys', 'gobuster', 'dirb', 'wfuzz', 'hydra'
    ].some(bot => userAgent.includes(bot));

    if (isMaliciousBot) {
      return new NextResponse('Access Denied: Automated Scan Detected', { status: 403 });
    }

    // 2. Path Traversal & Exploit Probe Blocker
    try {
      const decodedUrl = decodeURIComponent(req.url).toLowerCase();
      const isPathTraversalOrProbe = [
        '..',
        '%2e%2e',
        '.env',
        'wp-config',
        'wp-admin',
        'wp-login',
        '/etc/passwd',
        '/proc/',
        '/.git/',
        'phpinfo',
        '<script',
        '%3cscript'
      ].some(pattern => decodedUrl.includes(pattern));

      if (isPathTraversalOrProbe) {
        return new NextResponse('Access Denied: Malicious Request Pattern Detected', { status: 400 });
      }
    } catch {
      // If decoding fails, reject malformed URI
      return new NextResponse('Access Denied: Malformed URL', { status: 400 });
    }

    // 3. Cross-Origin Request Forgery (CSRF) Guard on Mutating API Requests
    if (
      pathname.startsWith('/api/') &&
      !pathname.startsWith('/api/auth') &&
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)
    ) {
      const origin = req.headers.get('origin');
      if (origin) {
        try {
          const originHost = new URL(origin).host;
          const requestHost = req.headers.get('host') || req.nextUrl.host;
          if (originHost !== requestHost) {
            return new NextResponse(
              JSON.stringify({ error: 'CSRF Protection: Cross-origin request rejected' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
          }
        } catch {
          return new NextResponse('Invalid Origin Header', { status: 400 });
        }
      }
    }

    // 4. Allow public pages, API routes, auth flows, and unmatched routes (404) through to Next.js
    const isPortalRoute = [
      '/student', '/teacher', '/admin', '/profile', '/pending-verification', '/directory'
    ].some(prefix => pathname.startsWith(prefix));

    if (!isPortalRoute || pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
      return NextResponse.next();
    }

    if (pathname === '/profile/setup' || pathname === '/pending-verification') {
      return NextResponse.next();
    }

    // 5. Account active & verification status checks for portal users
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

    // 6. Role-based portal route protection
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
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;
        // Only private portal routes require session authentication at gateway
        const isProtectedRoute = [
          '/student',
          '/teacher',
          '/admin',
          '/profile',
          '/pending-verification',
          '/directory'
        ].some(prefix => pathname.startsWith(prefix));

        if (isProtectedRoute) {
          return !!token;
        }

        // Public pages, auth flows, API handlers and unmatched paths (404) pass through
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images, sounds, models, service workers:
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|models/|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff|woff2)$).*)',
  ],
};
