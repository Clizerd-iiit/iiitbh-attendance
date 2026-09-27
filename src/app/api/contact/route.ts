import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';


export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // --- AUTO CLEANUP: Delete messages older than 14 days ---
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('support_messages').delete().lt('created_at', fourteenDaysAgo);
  // --------------------------------------------------------

  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('user_id');

  if (role === 'superadmin') {
    if (targetUserId) {
      // Fetch chat with specific user
      const { data, error } = await supabaseAdmin
        .from('support_messages')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      
      // Mark as read
      await supabaseAdmin.from('support_messages')
        .update({ is_read: true })
        .eq('user_id', targetUserId)
        .neq('sender_id', session.user.userId);
        
      return NextResponse.json({ messages: data });
    } else {
      // Fetch inbox list (all users who have messaged, with their latest message)
      // Since supabase JS doesn't do complex grouping easily, we'll fetch all and group in JS (or use a view).
      // Given it's a small app, fetching all ordered by date and picking the latest per user is fine.
      
      const { data, error } = await supabaseAdmin
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      
      const inboxMap = new Map();
      const userIds = [...new Set(data?.map(m => m.user_id) || [])];
      
      const { data: usersData } = await supabaseAdmin.from('users').select('id, name, role, profile_photo_url, last_seen_at').in('id', userIds);
      const userMap = Object.fromEntries(usersData?.map(u => [u.id, u]) || []);

      for (const msg of data || []) {
        if (!inboxMap.has(msg.user_id)) {
          inboxMap.set(msg.user_id, {
            user_id: msg.user_id,
            user: userMap[msg.user_id],
            latest_message: msg.content,
            created_at: msg.created_at,
            unread_count: 0
          });
        }
        if (!msg.is_read && msg.sender_id === msg.user_id) {
          inboxMap.get(msg.user_id).unread_count++;
        }
      }

      return NextResponse.json({ inbox: Array.from(inboxMap.values()) });
    }
  } else {
    // Student or Teacher
    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .select('*')
      .eq('user_id', session.user.userId)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Mark admin replies as read
    await supabaseAdmin.from('support_messages')
      .update({ is_read: true })
      .eq('user_id', session.user.userId)
      .neq('sender_id', session.user.userId);

    // Fetch Admin last_seen
    const { data: admins } = await supabaseAdmin.from('users')
      .select('last_seen_at')
      .eq('role', 'superadmin')
      .limit(1);
    const adminLastSeen = admins && admins.length > 0 ? admins[0].last_seen_at : null;

    return NextResponse.json({ messages: data, admin_last_seen: adminLastSeen });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const content = body.content;
  if (!content?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const role = session.user.role;
  const targetUserId = body.user_id;

  const user_id = role === 'superadmin' ? targetUserId : session.user.userId;
  const sender_id = session.user.userId;

  if (!user_id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });


  // Anti-Spam: Max 100 messages per user per day
  if (role !== 'superadmin') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', session.user.userId)
      .gte('created_at', today.toISOString());
    
    if (count && count >= 100) {
      return NextResponse.json({ error: 'Daily message limit reached (100). Please wait until tomorrow or contact admin via other means.' }, { status: 429 });
    }
  }

  const { data, error } = await supabaseAdmin.from('support_messages').insert({

    user_id,
    sender_id,
    content,
    is_read: false
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}


export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get('message_id');
  const userId = searchParams.get('user_id');

  if (messageId) {
    await supabaseAdmin.from('support_messages').delete().eq('id', messageId);
  } else if (userId) {
    await supabaseAdmin.from('support_messages').delete().eq('user_id', userId);
  } else {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
