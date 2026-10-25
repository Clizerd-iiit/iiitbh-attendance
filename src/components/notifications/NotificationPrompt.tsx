'use client';

import { useState, useEffect } from 'react';
import { BellRing, X, Sparkles } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    // If permission already granted or denied, don't nag
    if (Notification.permission !== 'default') {
      return;
    }

    // Check if dismissed recently (within 7 days)
    const dismissedUntil = localStorage.getItem('push_prompt_dismissed_until');
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      return;
    }

    // Check service worker subscription
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (!sub) {
          // Delay by 2 seconds so page loads smoothly first
          const timer = setTimeout(() => setShow(true), 2000);
          return () => clearTimeout(timer);
        }
      });
    }).catch(() => {});
  }, []);

  const handleDismiss = () => {
    setShow(false);
    // Dismiss for 7 days
    try {
      localStorage.setItem('push_prompt_dismissed_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {}
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setShow(false);
        return;
      }

      // Fetch VAPID key
      const keyRes = await fetch('/api/notifications/subscribe');
      const keyData = await keyRes.json();
      const vapidKey = keyData.publicKey;

      if (!vapidKey) throw new Error('VAPID key unavailable');

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (res.ok) {
        setEnabled(true);
        // Welcome notification
        try {
          fetch('/api/notifications/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          }).catch(() => {});
        } catch {}

        setTimeout(() => setShow(false), 2500);
      } else {
        setShow(false);
      }
    } catch (e) {
      console.error('Prompt enable error:', e);
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-slide-up">
      <div className="relative rounded-2xl bg-white dark:bg-[#231a14] border border-blue-200 dark:border-amber-700/50 p-4 shadow-2xl backdrop-blur-md">
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Instant Alerts
              </h4>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full">
                <Sparkles className="w-2.5 h-2.5" /> New
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
              {enabled
                ? '🎉 Notifications enabled! You will now receive class updates directly on your device.'
                : 'Turn on notifications to get instant alerts on your phone or laptop whenever new announcements are posted!'}
            </p>

            {!enabled && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-70 cursor-pointer"
                >
                  {loading ? 'Enabling...' : '🔔 Turn ON'}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
                >
                  Later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
