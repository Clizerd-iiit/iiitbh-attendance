import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ ok: false });

  // Update last_seen_at AND fetch is_active / verification_status simultaneously
  const { data: user, error } = await supabaseAdmin.from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.user.userId)
    .select('is_active, verification_status')
    .single();

  // If there's an error (e.g. timeout, PGRST116), don't aggressively log out unless we are sure they are deactivated.
  // We only log out if the user record exists and explicitly says deactivated/rejected.
  if (user) {
    if (user.is_active === false || user.verification_status === 'rejected') {
      return NextResponse.json({ ok: true, deactivated: true });
    }
  } else if (error && error.code === 'PGRST116') {
     // User actually deleted from DB
     return NextResponse.json({ ok: true, deactivated: true });
  }

  // --- Fetch Notification Counts ---

  let body: any = {};
  try { body = await req.json(); } catch(e) {}
  const { lastSeenAnn, lastSeenLogs, lastSeenVerify } = body;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const minAnnDate = lastSeenAnn && lastSeenAnn > today.toISOString() ? lastSeenAnn : today.toISOString();
  const minLogDate = lastSeenLogs && lastSeenLogs > today.toISOString() ? lastSeenLogs : today.toISOString();

  let pendingQuery = supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending');
  if (lastSeenVerify) pendingQuery = pendingQuery.gt('created_at', lastSeenVerify);

  const [
    { count: pendingUsers },
    { count: todayLogs },
    { count: todayAnnouncements },
    { count: unreadMsgs }
  ] = await Promise.all([
    pendingQuery,
    supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }).gt('created_at', minLogDate),
    supabaseAdmin.from('announcements').select('*', { count: 'exact', head: true }).gt('created_at', minAnnDate),
    session.user.role === 'superadmin'
      ? supabaseAdmin.from('support_messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', session.user.userId)
      : supabaseAdmin.from('support_messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', session.user.userId).eq('user_id', session.user.userId)
  ]);

  return NextResponse.json({ 
    ok: true, 
    deactivated: false,
    counts: {
      pending: pendingUsers || 0,
      logs: todayLogs || 0,
      announcements: todayAnnouncements || 0,
      messages: unreadMsgs || 0
    }
  });
}

