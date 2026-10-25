'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle className="glass-panel" />
      </div>

      <div className="relative z-20 w-full max-w-lg ultra-glass-card rounded-3xl p-8 sm:p-10 shadow-2xl text-center border border-white/40 dark:border-amber-700/30">
        {/* College Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/90 dark:border-amber-400/80 shadow-xl mb-3 relative bg-white">
            <Image
              unoptimized={true}
              src="/iiitbh-logo.jpg"
              alt="IIIT Bhagalpur Logo"
              width={80}
              height={80}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="text-xs font-black tracking-widest text-blue-900 dark:text-amber-200 uppercase">
            IIIT Bhagalpur AMS
          </span>
        </div>

        {/* 404 Glitch / Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-black text-sm mb-4">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>Error 404 · Page Not Found</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
          Lost in Campus?
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-8 max-w-md mx-auto">
          Aap jis page ko dhoondh rahe hain woh exist nahi karta ya move ho chuka hai. Kripya URL check karein ya neeche diye buttons se home par lautein.
        </p>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-white hover:bg-white dark:hover:bg-gray-700 font-bold text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>

        {/* Footer help link */}
        <div className="mt-8 pt-6 border-t border-gray-200/60 dark:border-gray-700/60">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-amber-300 transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need Help? Return to Login Portal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}