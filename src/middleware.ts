import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role     = token?.role as string;

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
    // Teachers can view /admin/logs and /admin/verify
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
