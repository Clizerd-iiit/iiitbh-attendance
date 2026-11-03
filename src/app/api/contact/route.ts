import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // --- AUTO CLEANUP: Keep messages for 14 days, delete older ---
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('support_messages').delete().lt('created_at', fourteenDaysAgo);
  // --------------------------------------------------------

  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  const isSuperadmin = role === 'superadmin';
  const isPseudoadmin = !!(session.user as any)?.isPseudoadmin;
  const pseudoadminBranch = ((session.user as any)?.pseudoadminBranch || '').toUpperCase().trim();
  const isAdmin = isSuperadmin || isPseudoadmin;

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('user_id');

  if (isAdmin) {
    if (targetUserId) {
      // If Pseudoadmin, verify target user's branch
      if (isPseudoadmin) {
        const { data: targetUser } = await supabaseAdmin
          .from('users')
          .select('id, name, branch, section, signup_info')
          .eq('id', targetUserId)
          .single();

        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const userBranch = ((targetUser.signup_info?.branch || targetUser.branch || '')).toUpperCase().trim();
        if (pseudoadminBranch && userBranch !== pseudoadminBranch) {
          return NextResponse.json({ error: `Unauthorized: User is not in your branch (${pseudoadminBranch})` }, { status: 403 });
        }
      }

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
        
      return NextResponse.json({ messages: data, isSuperadmin });
    } else {
      // Fetch inbox list (all conversations)
      const { data, error } = await supabaseAdmin
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      
      const userIds = [...new Set(data?.map(m => m.user_id) || [])];
      
      let usersData: any[] = [];
      if (userIds.length > 0) {
        const { data: uData } = await supabaseAdmin
          .from('users')
          .select('id, name, role, profile_photo_url, branch, section, signup_info, last_seen_at')
          .in('id', userIds);
        usersData = uData || [];
      }

      // Filter users by branch if pseudoadmin
      const branchUsers = (usersData || []).filter((u: any) => {
        if (isSuperadmin) return true;
        const uBranch = ((u.signup_info?.branch || u.branch || '')).toUpperCase().trim();
        return !pseudoadminBranch || uBranch === pseudoadminBranch;
      });

      const userMap = Object.fromEntries(branchUsers.map((u: any) => [u.id, u]));

      const inboxMap = new Map();
      for (const msg of data || []) {
        // Only include if user is accessible to this admin
        if (!userMap[msg.user_id]) continue;

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

      return NextResponse.json({ inbox: Array.from(inboxMap.values()), isSuperadmin });
    }
  } else {
    // Normal Student or Teacher view
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
  const content = sanitizeInput(body.content);
  if (!content?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const role = session.user.role;
  const isSuperadmin = role === 'superadmin';
  const isPseudoadmin = !!(session.user as any)?.isPseudoadmin;
  const pseudoadminBranch = ((session.user as any)?.pseudoadminBranch || '').toUpperCase().trim();
  const isAdmin = isSuperadmin || isPseudoadmin;

  const targetUserId = body.user_id;

  let user_id = session.user.userId;
  if (isAdmin && targetUserId) {
    if (isPseudoadmin) {
      const { data: targetUser } = await supabaseAdmin
        .from('users')
        .select('id, branch, signup_info')
        .eq('id', targetUserId)
        .single();

      if (!targetUser) return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
      const targetBranch = ((targetUser.signup_info?.branch || targetUser.branch || '')).toUpperCase().trim();
      if (pseudoadminBranch && targetBranch !== pseudoadminBranch) {
        return NextResponse.json({ error: `Unauthorized: You can only reply to students in your branch (${pseudoadminBranch})` }, { status: 403 });
      }
    }
    user_id = targetUserId;
  }

  // Monthly Anti-Spam: Max 100 messages per calendar month for normal students & teachers
  // Pseudoadmins and Superadmins have unlimited messages
  if (!isAdmin) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', session.user.userId)
      .gte('created_at', startOfMonth.toISOString());
    
    if (count !== null && count >= 100) {
      return NextResponse.json({ 
        error: 'Monthly message limit reached (100 messages per month). You can send more messages next month or reach out in person.' 
      }, { status: 429 });
    }
  }

  const { data, error } = await supabaseAdmin.from('support_messages').insert({
    user_id,
    sender_id: session.user.userId,
    content,
    is_read: false
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // STRICT PERMISSION: Only SuperAdmin can delete messages or clear conversation history
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized: Only SuperAdmin can delete messages or clear chats.' }, { status: 403 });
  }

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
