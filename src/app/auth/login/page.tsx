'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Lock, Sparkles, Building2, HelpCircle } from 'lucide-react';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueName, setIssueName] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [issueStatus, setIssueStatus] = useState('');

  useEffect(() => {
    if (session?.user?.role) {
      const r = session.user.role;
      if (!session.user.profileCompleted && r !== 'superadmin') {
        router.push('/profile/setup');
        return;
      }
      if (r === 'superadmin') router.push('/admin/dashboard');
      else if (r === 'teacher') router.push('/teacher/dashboard');
      else router.push('/student/dashboard');
    }
  }, [session, router]);

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueStatus('submitting');
    try {
      await fetch('/api/public-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: issueName, details: issueDetails }),
      });
      setIssueStatus('success');
      setTimeout(() => {
        setShowIssueModal(false);
        setIssueStatus('');
        setIssueName('');
        setIssueDetails('');
      }, 3000);
    } catch {
      setIssueStatus('error');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* ── Top Bar with Theme Toggle ── */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle className="glass-panel" />
      </div>

      {/* ── Main Glassmorphism Login Card ── */}
      <div className="relative z-20 w-full max-w-md ultra-glass-card rounded-3xl p-8 sm:p-9 shadow-2xl text-center">
        {/* College Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/90 dark:border-amber-400/80 shadow-2xl mb-4 relative bg-white">
            <Image
              unoptimized={true}
              src="/iiitbh-logo.jpg"
              alt="IIIT Bhagalpur Logo"
              width={96}
              height={96}
              className="object-cover w-full h-full"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white dark:text-[#fcf7f2] tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            IIIT Bhagalpur
          </h1>
          <p className="text-blue-100 dark:text-amber-300 font-extrabold text-sm mt-0.5 flex items-center gap-1.5 justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            <Sparkles className="w-4 h-4 text-amber-300" /> Attendance Management System
          </p>
        </div>

        {/* Email Domain Info Pill */}
        <div className="bg-white/20 dark:bg-black/35 backdrop-blur-md border border-white/30 dark:border-amber-700/40 rounded-2xl p-3.5 mb-6 text-left shadow-sm">
          <p className="text-xs sm:text-sm text-white dark:text-amber-100 font-bold flex items-center gap-2 drop-shadow-sm">
            <Lock className="w-4 h-4 shrink-0 text-amber-300 dark:text-amber-400" />
            <span>
              Use your official <strong className="underline decoration-amber-300">@iiitbh.ac.in</strong> email account to sign in.
            </span>
          </p>
        </div>

        {/* Sign in with Google Button */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-black py-3.5 px-6 rounded-2xl transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-[0.98] cursor-pointer border border-white/40"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-sm sm:text-base tracking-wide">Sign in with Google</span>
        </button>

        {/* Help Link */}
        <p className="text-xs sm:text-sm text-white/90 dark:text-amber-200/90 font-bold mt-6 drop-shadow-sm">
          Having trouble signing in?{' '}
          <button
            onClick={() => setShowIssueModal(true)}
            className="text-amber-300 dark:text-amber-400 hover:text-white dark:hover:text-amber-200 underline font-black cursor-pointer inline-flex items-center gap-1"
          >
            <span>Contact Administrator</span>
          </button>
        </p>
      </div>

      {/* ── Report Issue Modal ── */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel rounded-3xl p-6 sm:p-7 w-full max-w-sm relative mx-auto my-auto shadow-2xl border border-white/50 dark:border-amber-900/50">
            <button
              onClick={() => setShowIssueModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-amber-900/40 transition"
            >
              ✕
            </button>
            <h2 className="text-xl font-black text-gray-900 dark:text-amber-100 mb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-500" />
              Report an Issue
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-4">
              Describe your sign-in problem. The administration will assist you shortly.
            </p>

            {issueStatus === 'success' ? (
              <div className="bg-green-50 dark:bg-green-950/60 text-green-900 dark:text-green-200 p-4 rounded-2xl text-xs sm:text-sm mb-2 text-center font-bold border border-green-200 dark:border-green-800">
                ✅ Issue sent to Administrator successfully!
              </div>
            ) : (
              <form onSubmit={submitIssue} className="flex flex-col gap-3.5 text-left">
                <div>
                  <label className="block text-xs font-black text-gray-900 dark:text-gray-200 uppercase tracking-wider mb-1">
                    Your Name / Roll No
                  </label>
                  <input
                    required
                    value={issueName}
                    onChange={e => setIssueName(e.target.value)}
                    type="text"
                    className="w-full border border-gray-300 dark:border-amber-900/50 rounded-xl p-2.5 text-sm font-semibold text-gray-900 dark:text-white bg-white/80 dark:bg-[#2b211a] focus:ring focus:ring-amber-200 outline-none placeholder:text-gray-500"
                    placeholder="E.g. Rahul (2101001)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-900 dark:text-gray-200 uppercase tracking-wider mb-1">
                    Problem Details
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={issueDetails}
                    onChange={e => setIssueDetails(e.target.value)}
                    className="w-full border border-gray-300 dark:border-amber-900/50 rounded-xl p-2.5 text-sm font-semibold text-gray-900 dark:text-white bg-white/80 dark:bg-[#2b211a] focus:ring focus:ring-amber-200 outline-none placeholder:text-gray-500"
                    placeholder="Explain what is going wrong..."
                  />
                </div>
                <button
                  disabled={issueStatus === 'submitting'}
                  type="submit"
                  className="w-full bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-700 text-white font-black py-2.5 rounded-xl transition shadow active:scale-95 disabled:opacity-50 text-sm mt-1 cursor-pointer"
                >
                  {issueStatus === 'submitting' ? 'Submitting...' : 'Send to Admin'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
