'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

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
      // Only show if not standalone
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

  return (
    <>
      {showInstallBtn && (
        <div className="fixed inset-x-0 top-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold">Install IIIT AMS App</span>
            <span className="text-xs text-blue-100">For a faster, full-screen experience</span>
          </div>
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-1 bg-white text-blue-600 px-3 py-1.5 rounded-full text-sm font-bold shadow hover:bg-gray-100 transition"
          >
            <Download className="w-4 h-4" />
            Install
          </button>
        </div>
      )}
    </>
  );
}
