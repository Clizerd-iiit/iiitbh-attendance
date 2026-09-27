'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Suspense } from 'react';

const errorMessages: Record<string, { title: string; msg: string; icon: string }> = {
  unauthorized_domain: { title: 'Wrong Email Domain', msg: 'Only @iiitbh.ac.in college email accounts are allowed.', icon: '🚫' },
  not_registered:      { title: 'Not Registered',    msg: 'Your email is not registered. Contact the administrator.', icon: '❓' },
  account_disabled:    { title: 'Account Disabled',  msg: 'Your account has been disabled. Contact admin.', icon: '🔒' },
  account_rejected:    { title: 'Verification Rejected', msg: 'Your account was not approved. Contact the administrator for more information.', icon: '❌' },
  forbidden:           { title: 'Access Denied',     msg: 'You do not have permission to access this page.', icon: '🚷' },
  server_error:        { title: 'Server Error',      msg: 'An error occurred. Please try again.', icon: '⚠️' },
  default:             { title: 'Error',             msg: 'An unexpected error occurred.', icon: '⚠️' },
};

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get('error') || 'default';
  const { title, msg, icon } = errorMessages[error] || errorMessages['default'];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">{icon}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{title}</h1>
        <p className="text-gray-700 mb-6">{msg}</p>
        <button onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition inline-block font-medium">
          Back to Login (Sign Out)
        </button>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return <Suspense><ErrorContent /></Suspense>;
}
