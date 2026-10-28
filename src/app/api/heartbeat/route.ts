import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// In-memory rate limiting and response caching per user to prevent credit draining
interface HeartbeatCacheItem {
  timestamp: number;
  response: any;
}
const heartbeatCache = new Map<string, HeartbeatCacheItem>();

// Clean up stale cache entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, item] of heartbeatCache.entries()) {
      if (now - item.timestamp > 300_000) {
        heartbeatCache.delete(key);
      }
    }
  }, 600_000);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.userId || (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ ok: false });

  const now = Date.now();
  const cached = heartbeatCache.get(userId);

  // If a heartbeat was processed within the last 120 seconds from this user,
  // return the cached response immediately to save Vercel CPU and Supabase DB reads/writes.
  if (cached && (now - cached.timestamp < 120_000)) {
    return NextResponse.json(cached.response);
  }

  // Update last_seen_at AND fetch is_active / verification_status simultaneously
  const { data: user } = await supabaseAdmin.from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .select('is_active, verification_status')
    .single();

  if (user) {
    if (user.is_active === false || user.verification_status === 'rejected') {
      return NextResponse.json({ ok: true, deactivated: true });
    }
  }

  // --- Fetch Notification Counts ---
  let body: any = {};
  try { body = await req.json(); } catch(e) {}
  const { lastSeenAnn, lastSeenLogs, lastSeenVerify } = body;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const minAnnDate = lastSeenAnn && lastSeenAnn > today.toISOString() ? lastSeenAnn : today.toISOString();
  const minLogDate = lastSeenLogs && lastSeenLogs > today.toISOString() ? lastSeenLogs : today.toISOString();

  let activeClass = false;
  const userRole = session?.user?.role;
  if (userRole === 'student') {
    const { data: enrollments } = await supabaseAdmin.from('enrollments').select('subject_id').eq('student_id', userId);
    if (enrollments && enrollments.length > 0) {
      const subjectIds = enrollments.map(e => e.subject_id);
      const { data: activeClasses } = await supabaseAdmin.from('classes').select('id').in('subject_id', subjectIds).eq('status', 'active').limit(1);
      if (activeClasses && activeClasses.length > 0) activeClass = true;
    }
  }

  let pendingQuery = supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending');
  if (lastSeenVerify) pendingQuery = pendingQuery.gt('created_at', lastSeenVerify);

  const [
    { count: pendingUsers },
    { count: todayLogs },
    { count: todayAnnouncements },
    { count: unreadMsgs },
    { data: clearDataSetting }
  ] = await Promise.all([
    pendingQuery,
    supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }).gt('created_at', minLogDate),
    supabaseAdmin.from('announcements').select('*', { count: 'exact', head: true }).gt('created_at', minAnnDate),
    userRole === 'superadmin'
      ? supabaseAdmin.from('support_messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', userId)
      : supabaseAdmin.from('support_messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', userId).eq('user_id', userId),
    supabaseAdmin.from('system_settings').select('value').eq('key', 'show_clear_all_data').maybeSingle()
  ]);

  const showClearAllData = clearDataSetting ? clearDataSetting.value === 'true' : false;

  const responsePayload = { 
    ok: true, 
    deactivated: false,
    activeClass,
    showClearAllData,
    counts: {
      pending: pendingUsers || 0,
      logs: todayLogs || 0,
      announcements: todayAnnouncements || 0,
      messages: unreadMsgs || 0
    }
  };

  // Cache response for this user
  heartbeatCache.set(userId, {
    timestamp: now,
    response: responsePayload
  });

  return NextResponse.json(responsePayload);
}
