'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').then(
          function (registration) {
            console.log('ServiceWorker registration successful');
          },
          function (err) {
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
    }

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if not standalone and not recently dismissed
      const dismissedUntil = localStorage.getItem('pwa_banner_dismissed_until');
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        return;
      }
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBtn(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBtn(false);
    try {
      // Dismiss for 24 hours so it doesn't repeatedly block the user
      localStorage.setItem('pwa_banner_dismissed_until', (Date.now() + 24 * 60 * 60 * 1000).toString());
    } catch (e) {}
  };

  return (
    <>
      {showInstallBtn && (
        <div className="fixed inset-x-0 top-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg flex items-center justify-between">
          <div className="flex flex-col pr-2">
            <span className="font-semibold text-sm sm:text-base">Install IIIT AMS App</span>
            <span className="text-xs text-blue-100">For a faster, full-screen experience</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 bg-white text-blue-600 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow hover:bg-gray-100 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss banner"
              className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-blue-700/60 transition active:scale-95"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
