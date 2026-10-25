'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Smartphone, Share } from 'lucide-react';

export default function PWARegister() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  const isLoginPage = pathname === '/auth/login' || pathname === '/';

  useEffect(() => {
    // Check if standalone (already installed)
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

    if (isStandalone) {
      setShowInstallBtn(false);
      return;
    }

    // Check iOS Safari
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    const ios = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.log('ServiceWorker registration error:', err);
        });
      });
    }

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPwaPrompt = e;
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If prompt was already captured earlier
    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt);
      setShowInstallBtn(true);
    } else if (isLoginPage) {
      // On login page, ALWAYS show the banner
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [pathname, isLoginPage]);

  // Handle route change: On login screen, ALWAYS make it available
  useEffect(() => {
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

    if (isStandalone) {
      setShowInstallBtn(false);
      return;
    }

    if (isLoginPage) {
      setShowInstallBtn(true);
    } else {
      const dismissedUntil = localStorage.getItem('pwa_banner_dismissed_until');
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        setShowInstallBtn(false);
      }
    }
  }, [pathname, isLoginPage]);

  const handleInstallClick = async () => {
    const prompt = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
    if (prompt) {
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          setShowInstallBtn(false);
        }
        (window as any).deferredPwaPrompt = null;
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Install prompt error:', err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      alert('To install IIIT AMS App:\n1. Tap your browser menu (⋮ three dots)\n2. Tap "Install app" or "Add to Home screen"');
    }
  };

  const handleDismiss = () => {
    setShowInstallBtn(false);
    // If NOT on login page, remember dismissal for 24h.
    // If ON login page, do NOT save permanently so next login/logout visit brings it back!
    if (!isLoginPage) {
      try {
        localStorage.setItem('pwa_banner_dismissed_until', (Date.now() + 24 * 60 * 60 * 1000).toString());
      } catch (e) {}
    }
  };

  return (
    <>
      {showInstallBtn && (
        <div className="fixed inset-x-0 top-0 z-[9990] bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-4 py-3 shadow-xl flex items-center justify-between border-b border-white/20 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 pr-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xs sm:text-sm tracking-wide flex items-center gap-1.5">
                Install IIIT AMS App
                <span className="bg-amber-400 text-gray-950 text-[10px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter">Fast</span>
              </span>
              <span className="text-[11px] text-blue-100 hidden sm:inline">Add to Home Screen for 1-tap fast attendance & full-screen view</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 bg-white text-blue-800 hover:bg-blue-50 px-3.5 py-1.5 rounded-full text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss banner"
              className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/20 transition active:scale-95 cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-800 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 mx-auto flex items-center justify-center mb-3">
              <Share className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Install on iOS (iPhone / iPad)</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4 text-left">
              1. Tap the <strong className="text-blue-600 dark:text-blue-400">Share</strong> button at the bottom of Safari.<br/>
              2. Scroll down and tap <strong className="text-blue-600 dark:text-blue-400">"Add to Home Screen"</strong>.<br/>
              3. Tap <strong className="text-blue-600 dark:text-blue-400">Add</strong> in the top-right corner.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow transition active:scale-95 cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
}