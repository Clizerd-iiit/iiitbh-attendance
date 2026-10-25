import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';

const authMiddleware = withAuth(
  function middleware(req) {
    const token    = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role     = token?.role as string;

    if (pathname === '/profile/setup' || pathname === '/pending-verification') {
      return NextResponse.next();
    }

    // Account active & verification status checks for portal users
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

    // Role-based portal route protection
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
      authorized: ({ token }) => !!token,
    },
  }
);

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

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

  // 4. Portal routes require NextAuth session authentication
  const isProtectedPortal = [
    '/student', '/teacher', '/admin', '/profile', '/pending-verification', '/directory'
  ].some(prefix => pathname.startsWith(prefix));

  if (isProtectedPortal) {
    return (authMiddleware as any)(req);
  }

  // Public routes, homepage, API handlers, and unmatched routes (404) pass through directly
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images, sounds, models, service workers:
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|models/|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff|woff2)$).*)',
  ],
};
