import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@iiitbh.ac.in';

let isVapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isVapidConfigured = true;
  } catch (e) {
    console.warn('[WebPush] Error configuring VAPID:', e);
  }
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionItem {
  id?: string;
  userId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  userRole?: string;
  branch?: string;
  group?: string;
  createdAt?: string;
}

export interface BroadcastNotificationOptions {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  targetUserIds?: string[];
  targetBranch?: string;
  targetGroup?: string;
  targetRoles?: ('student' | 'teacher' | 'superadmin')[];
}

// Helper to hash endpoint for system_settings key
function hashEndpoint(endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    hash = (hash << 5) - hash + endpoint.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Saves a browser push subscription for a user.
 * Tries the dedicated 'push_subscriptions' table first; falls back to 'system_settings'.
 */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userRole?: string,
  branch?: string
): Promise<{ success: boolean; error?: string }> {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { success: false, error: 'Malformed push subscription object.' };
  }

  // 1. Try dedicated table 'push_subscriptions'
  try {
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_role: userRole || null,
        branch: branch || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (!error) {
      return { success: true };
    }
  } catch {
    // Fall through to system_settings fallback
  }

  // 2. Fallback to 'system_settings'
  try {
    const endpointHash = hashEndpoint(subscription.endpoint);
    const key = `push_sub_${endpointHash}`;
    const value = JSON.stringify({
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userRole: userRole || null,
      branch: branch || null,
      updatedAt: new Date().toISOString(),
    });

    const { error: setErr } = await supabaseAdmin.from('system_settings').upsert({
      key,
      value,
    });

    if (setErr) {
      return { success: false, error: setErr.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save push subscription' };
  }
}

/**
 * Removes a push subscription when a user unsubscribes or when an endpoint expires.
 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;

  // 1. Try table
  try {
    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch {}

  // 2. Try system_settings fallback
  try {
    const endpointHash = hashEndpoint(endpoint);
    await supabaseAdmin.from('system_settings').delete().eq('key', `push_sub_${endpointHash}`);
  } catch {}
}

/**
 * Retrieves all registered push subscriptions, handling filters and table fallback.
 */
export async function getAllPushSubscriptions(): Promise<PushSubscriptionItem[]> {
  const items: PushSubscriptionItem[] = [];

  // 1. Try table 'push_subscriptions'
  try {
    const { data, error } = await supabaseAdmin.from('push_subscriptions').select('*');
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        endpoint: d.endpoint,
        keys: { p256dh: d.p256dh, auth: d.auth },
        userRole: d.user_role,
        branch: d.branch,
        createdAt: d.created_at,
      }));
    }
  } catch {}

  // 2. Fallback to 'system_settings'
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .like('key', 'push_sub_%');

    if (Array.isArray(data)) {
      for (const row of data) {
        try {
          const parsed = JSON.parse(row.value);
          if (parsed && parsed.endpoint && parsed.keys) {
            items.push(parsed);
          }
        } catch {}
      }
    }
  } catch {}

  return items;
}

/**
 * Sends a single push notification payload to one subscriber.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string; tag?: string; icon?: string }
): Promise<boolean> {
  if (!isVapidConfigured) {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      try {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || 'mailto:admin@iiitbh.ac.in',
          pub,
          priv
        );
        isVapidConfigured = true;
      } catch {}
    }
  }

  if (!isVapidConfigured) {
    console.warn('[WebPush] VAPID keys not configured in environment variables.');
    return false;
  }

  try {
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/student/announcements',
      tag: payload.tag || 'ams-alert',
      icon: payload.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
    });

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      pushPayload,
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'high',
      }
    );
    return true;
  } catch (err: any) {
    // HTTP 410 Gone or 404 Not Found indicates device unregistered or permission revoked
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await deletePushSubscription(subscription.endpoint);
    } else {
      console.warn('[WebPush] Error sending push to endpoint:', err?.message || err);
    }
    return false;
  }
}

/**
 * Broadcasts a push notification to relevant users with automatic role/branch filtering.
 */
export async function broadcastPushNotification(options: BroadcastNotificationOptions): Promise<{ sent: number; total: number }> {
  try {
    const allSubs = await getAllPushSubscriptions();
    if (!allSubs || allSubs.length === 0) {
      return { sent: 0, total: 0 };
    }

    // Apply target filters
    const matchingSubs = allSubs.filter((sub) => {
      // 1. Filter by specific user IDs if specified
      if (options.targetUserIds && options.targetUserIds.length > 0) {
        return options.targetUserIds.includes(sub.userId);
      }

      // 2. Filter by role if specified
      if (options.targetRoles && options.targetRoles.length > 0 && sub.userRole) {
        if (!options.targetRoles.includes(sub.userRole as any)) {
          return false;
        }
      }

      // 3. Filter by branch if specified
      if (options.targetBranch && sub.branch) {
        if (options.targetBranch.toUpperCase().trim() !== sub.branch.toUpperCase().trim()) {
          return false;
        }
      }

      return true;
    });

    if (matchingSubs.length === 0) {
      return { sent: 0, total: 0 };
    }

    let successCount = 0;
    const sendPromises = matchingSubs.map(async (sub) => {
      const ok = await sendPushNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        {
          title: options.title,
          body: options.body,
          url: options.url,
          tag: options.tag,
          icon: options.icon,
        }
      );
      if (ok) successCount++;
    });

    await Promise.allSettled(sendPromises);
    return { sent: successCount, total: matchingSubs.length };
  } catch (error) {
    console.error('[WebPush] Broadcast failed:', error);
    return { sent: 0, total: 0 };
  }
}
