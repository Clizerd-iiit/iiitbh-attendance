import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { broadcastPushNotification } from '@/lib/pushNotifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email.toLowerCase();
  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id, role, branch, section, is_cr, signup_info')
    .eq('email', email)
    .single();

  const now = new Date().toISOString();

  // Auto-delete expired announcements from DB
  await supabaseAdmin.from('announcements')
    .delete()
    .lt('expires_at', now);

  // Fetch non-expired announcements
  let query = supabaseAdmin
    .from('announcements')
    .select('*, teacher:users(name, role, is_cr, profile_photo_url, branch, signup_info), subject:subjects(name, code)')
    .order('created_at', { ascending: false });

  let { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const isCR = !!dbUser?.is_cr;
  const isPseudoadmin = !!dbUser?.signup_info?.is_pseudoadmin;
  const currentUserId = dbUser?.id || session.user.userId;

  if (dbUser?.role === 'student') {
    const sBranch = (dbUser?.signup_info?.branch || dbUser?.branch || '').toUpperCase().trim();
    const sGroup = (dbUser?.signup_info?.group || dbUser?.section || '').toUpperCase().trim();
    const sSubGroup = (dbUser?.signup_info?.sub_group || '').toUpperCase().trim();

    data = (data || []).filter(a => {
      // If student is author, always show their own announcement
      if (a.teacher_id === currentUserId) return true;

      // 1. Explicitly targeted student ID
      if (Array.isArray(a.target_student_ids) && a.target_student_ids.length > 0) {
        return a.target_student_ids.includes(currentUserId);
      }
      // 2. Branch match (skip filter if 'ALL' or empty)
      if (a.target_branch && a.target_branch.toUpperCase().trim() !== 'ALL' && a.target_branch.toUpperCase().trim() !== sBranch) {
        return false;
      }
      // 3. Group / Subgroup match
      if (a.target_group) {
        const tg = a.target_group.toUpperCase().trim();
        if (tg === 'G1') {
          if (!sGroup.startsWith('G1') && !sSubGroup.startsWith('G1')) return false;
        } else if (tg === 'G2') {
          if (!sGroup.startsWith('G2') && !sSubGroup.startsWith('G2')) return false;
        } else if (tg === 'G1A' || tg === 'G1B' || tg === 'G2A' || tg === 'G2B') {
          if (sSubGroup !== tg && sGroup !== tg) return false;
        } else {
          if (!sGroup.includes(tg) && !sSubGroup.includes(tg)) return false;
        }
      }
      return true;
    });
  }

  return NextResponse.json({
    announcements: data || [],
    is_cr: isCR,
    is_pseudoadmin: isPseudoadmin,
    userId: currentUserId,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });

  const email = session.user.email.toLowerCase();

  // Always resolve user record from DB by email
  const { data: dbUser, error: userFetchErr } = await supabaseAdmin
    .from('users')
    .select('id, name, role, is_cr, signup_info, branch')
    .eq('email', email)
    .single();

  if (userFetchErr || !dbUser) {
    console.error('[Announcements POST] User lookup failed for:', email, userFetchErr);
    return NextResponse.json({ error: 'User account not found' }, { status: 403 });
  }

  const role = dbUser.role;
  const userId = dbUser.id;
  const isCR = !!dbUser.is_cr;
  const isPseudoadmin = !!dbUser.signup_info?.is_pseudoadmin;

  if (role === 'student' && !isCR && !isPseudoadmin) {
    return NextResponse.json({ error: 'Forbidden: Only Class Representatives, Admins, or Faculty can broadcast notices' }, { status: 403 });
  }
  if (!['student', 'teacher', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { title, content, type, subject_id, link_url, file_url, expiry_hours, target_student_ids, target_branch, target_group } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Announcement title is required' }, { status: 400 });
  }

  // Default 48 hours; max 15 days (360 hours)
  let hours = Number(expiry_hours) || 48;
  if (hours > 360) hours = 360;
  const expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const insertPayload = {
    teacher_id: userId,
    title: title.trim(),
    content: content?.trim() || null,
    type: type || 'text',
    subject_id: subject_id || null,
    link_url: link_url || null,
    file_url: file_url || null,
    expires_at: expires_at,
    target_student_ids: target_student_ids || null,
    target_branch: target_branch || null,
    target_group: target_group || null,
  };

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('[Announcements POST] Insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Broadcast Web Push Notification to all subscribed devices
  let pushResult = { sent: 0, total: 0 };
  try {
    const posterName = dbUser.name || (role === 'superadmin' ? 'SuperAdmin' : 'Faculty');
    const previewContent = (content || data?.content || '').slice(0, 110);
    const notifTitle = `📢 Announcement: ${title.trim()}`;
    const notifBody = `${posterName}: ${previewContent}${previewContent.length >= 110 ? '...' : ''}`;

    pushResult = await broadcastPushNotification({
      title: notifTitle,
      body: notifBody,
      url: '/student/announcements',
      tag: `announcement-${data.id}`,
      targetBranch: target_branch || undefined,
      targetGroup: target_group || undefined,
      targetUserIds: Array.isArray(target_student_ids) && target_student_ids.length > 0 ? target_student_ids : undefined,
    });
    console.log('[Announcements POST] Push broadcast complete:', pushResult);
  } catch (pushErr) {
    console.error('[Announcements POST] Push broadcast error:', pushErr);
  }

  return NextResponse.json({ announcement: data, pushResult, success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const email = session.user.email.toLowerCase();
  const { data: dbUser } = await supabaseAdmin.from('users').select('id, role, is_cr, signup_info').eq('email', email).single();
  if (!dbUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const role = dbUser.role;
  const userId = dbUser.id;
  const isPseudoadmin = !!dbUser.signup_info?.is_pseudoadmin;

  let canDelete = false;

  if (role === 'superadmin') {
    canDelete = true;
  } else {
    // Pseudoadmins, Teachers and CRs can delete their own announcements
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (ann && ann.teacher_id === userId) {
      canDelete = true;
    } else if (role === 'teacher') {
      const { data: author } = await supabaseAdmin.from('users').select('is_cr, role').eq('id', ann?.teacher_id).single();
      if (author?.is_cr || author?.role === 'student') canDelete = true;
    }
  }

  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, title, content, type, subject_id, link_url, file_url, target_student_ids, target_branch, target_group } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const email = session.user.email.toLowerCase();
  const { data: dbUser } = await supabaseAdmin.from('users').select('id, name, role, is_cr, signup_info').eq('email', email).single();
  if (!dbUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const role = dbUser.role;
  const userId = dbUser.id;

  let canEdit = false;

  if (role === 'superadmin') {
    canEdit = true;
  } else {
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (ann && ann.teacher_id === userId) canEdit = true;
  }

  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updateData: any = { title, content, type };
  if (subject_id !== undefined) updateData.subject_id = subject_id || null;
  if (link_url !== undefined) updateData.link_url = link_url || null;
  if (file_url !== undefined) updateData.file_url = file_url || null;
  if (target_student_ids !== undefined) updateData.target_student_ids = target_student_ids || null;
  if (target_branch !== undefined) updateData.target_branch = target_branch || null;
  if (target_group !== undefined) updateData.target_group = target_group || null;

  const { data, error } = await supabaseAdmin.from('announcements').update(updateData).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger Instant Web Push Notification to all subscribed devices
  try {
    const posterName = dbUser.name || (role === 'superadmin' ? 'SuperAdmin' : 'Faculty');
    const previewContent = (content || data?.content || '').slice(0, 110);
    const notifTitle = `📢 [Updated] ${title || data?.title || 'Announcement'}`;
    const notifBody = `${posterName}: ${previewContent}${previewContent.length >= 110 ? '...' : ''}`;

    await broadcastPushNotification({
      title: notifTitle,
      body: notifBody,
      url: '/student/announcements',
      tag: `announcement-${data.id}`,
      targetBranch: target_branch || undefined,
      targetGroup: target_group || undefined,
      targetUserIds: Array.isArray(target_student_ids) && target_student_ids.length > 0 ? target_student_ids : undefined,
    });
  } catch (pushErr) {
    console.warn('[PushNotification] Trigger failed:', pushErr);
  }

  return NextResponse.json({ announcement: data, success: true });
}
