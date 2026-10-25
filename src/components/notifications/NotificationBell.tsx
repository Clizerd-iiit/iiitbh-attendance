'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing, Check, Send, X, AlertCircle } from 'lucide-react';

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

export function NotificationBell() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  };

  const handleSubscribe = async () => {
    if (!supported) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    setLoading(true);
    setTestStatus(null);

    try {
      // 1. Request browser permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setLoading(false);
        if (perm === 'denied') {
          alert('Notification permission was blocked. Please enable notifications in your browser or site settings.');
        }
        return;
      }

      // 2. Fetch VAPID public key
      const keyRes = await fetch('/api/notifications/subscribe');
      const keyData = await keyRes.json();
      const vapidPublicKey = keyData.publicKey;

      if (!vapidPublicKey) {
        throw new Error('Could not retrieve VAPID public key');
      }

      // 3. Register push manager subscription
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      // 4. Send subscription to backend
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setTestStatus('✅ Notifications enabled successfully on this device!');
        // Automatically send a welcome test notification
        setTimeout(() => {
          handleSendTestNotification(sub);
        }, 600);
      } else {
        const err = await res.json();
        alert('Failed to save subscription: ' + (err.error || 'Server error'));
      }
    } catch (e: any) {
      console.error('Subscription error:', e);
      alert('Could not enable push notifications: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    setTestStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      setTestStatus('Notifications disabled for this device.');
    } catch (e) {
      console.error('Unsubscribe error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async (existingSub?: any) => {
    setTestStatus('Sending test alert...');
    try {
      let sub = existingSub;
      if (!sub) {
        const reg = await navigator.serviceWorker.ready;
        sub = await reg.pushManager.getSubscription();
      }

      if (!sub) {
        setTestStatus('❌ Device is not subscribed. Please enable notifications first.');
        return;
      }

      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub }),
      });

      if (res.ok) {
        setTestStatus('🎉 Test notification sent! Check your notification tray or screen corner.');
      } else {
        const d = await res.json();
        setTestStatus('❌ Failed: ' + (d.error || 'Check browser permissions.'));
      }
    } catch (e: any) {
      setTestStatus('❌ Error: ' + (e?.message || 'Failed'));
    }
  };

  if (!supported) return null;

  return (
    <>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="relative p-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition active:scale-95"
        title={isSubscribed ? 'Notifications Active' : 'Enable Push Notifications'}
      >
        {isSubscribed ? (
          <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}

        {/* Status Indicator Dot */}
        {isSubscribed ? (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1a1410]" />
        ) : (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
        )}
      </button>

      {/* Notifications Management Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-[#1f1712] border border-gray-200 dark:border-amber-800/40 p-6 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowModal(false);
                setTestStatus(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Icon */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isSubscribed
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                }`}
              >
                {isSubscribed ? <BellRing className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                  Push Notifications
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                    isSubscribed
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSubscribed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {isSubscribed ? 'Active on this Device' : 'Not Enabled Yet'}
                </span>
              </div>
            </div>

            {/* Explanatory text */}
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Receive instant real-time alerts on your phone or laptop screen whenever a teacher or
              admin publishes a new class announcement, even when this website is closed!
            </p>

            {/* Feedback message */}
            {testStatus && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-xs font-bold text-blue-900 dark:text-blue-200 leading-snug">
                {testStatus}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {!isSubscribed ? (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <Bell className="w-4 h-4" />
                  <span>{loading ? 'Enabling...' : '🔔 Turn ON Notifications'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendTestNotification()}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Notification Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Disable on this device</span>
                  </button>
                </>
              )}
            </div>

            {/* iOS Safari Tip */}
            {typeof window !== 'undefined' &&
              /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                  <span>
                    On iPhone / iPad, push notifications require the app to be added to Home Screen
                    via Safari (Share &rarr; Add to Home Screen).
                  </span>
                </div>
              )}
          </div>
        </div>
      )}
    </>
  );
}
