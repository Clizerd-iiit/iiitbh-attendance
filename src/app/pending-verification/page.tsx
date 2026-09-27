'use client';
import { signOut, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function PendingVerificationPage() {
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data?.profile?.verification_status === 'approved') {
          await update();
          const role = data.profile.role;
          if (role === 'teacher') router.push('/teacher/dashboard');
          else if (role === 'student') router.push('/student/dashboard');
          else router.push('/auth/login');
        } else if (data?.profile?.verification_status === 'rejected') {
          await update();
          router.push('/auth/error?error=account_rejected');
        }
      } catch (e) {}
    };
    
    const interval = setInterval(checkStatus, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [update, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-blue-200 mx-auto mb-4">
          <Image src="/iiitbh-logo.jpg" alt="IIIT Bhagalpur" width={80} height={80} className="object-cover"/>
        </div>
        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⏳</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Verification Pending</h1>
        <p className="text-gray-700 text-sm mb-6">
          Your account is awaiting administrator approval. Please check back later or contact the administrator.
        </p>
        <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 mb-6 text-left space-y-1">
          <p>• Verification takes up to 24 hours on working days</p>
          <p>• You will be able to login once approved</p>
          <p>• Contact your class coordinator if urgent</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="w-full bg-gray-100 text-gray-800 py-2.5 rounded-xl hover:bg-gray-200 transition font-medium">
          Sign Out
        </button>
      </div>
    </div>
  );
}
