import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date().toISOString();

  // Auto-delete expired announcements from DB
  await supabaseAdmin.from('announcements')
    .delete()
    .lt('expires_at', now);

  // Fetch non-expired (Fallback if expires_at is missing)
  let query = supabaseAdmin
    .from('announcements')
    .select('*, teacher:users(name, role, is_cr, profile_photo_url), subject:subjects(name, code)')
    .order('created_at', { ascending: false });

  let is_cr = false;
  let studentProfile: any = null;
  if (session.user.role === 'student') {
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('branch, section, is_cr, signup_info')
      .eq('id', session.user.userId)
      .single();
    studentProfile = profile;
    if (profile) is_cr = profile.is_cr || false;
  }

  let { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (session.user.role === 'student' && studentProfile) {
    const sBranch = (studentProfile?.signup_info?.branch || studentProfile?.branch || '').toUpperCase().trim();
    const sGroup = (studentProfile?.signup_info?.group || studentProfile?.section || '').toUpperCase().trim();
    const sSubGroup = (studentProfile?.signup_info?.sub_group || '').toUpperCase().trim();

    data = (data || []).filter(a => {
      // 1. Explicitly targeted student ID
      if (Array.isArray(a.target_student_ids) && a.target_student_ids.length > 0) {
        return a.target_student_ids.includes(session.user.userId);
      }
      // 2. Branch match
      if (a.target_branch && a.target_branch.toUpperCase().trim() !== sBranch) return false;
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

  return NextResponse.json({ announcements: data, is_cr, userId: session.user.userId });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const role = session.user.role as string;
  let isCR = false;
  
  if (role === 'student') {
    const { data: profile, error: profileErr } = await supabaseAdmin.from('users').select('is_cr, signup_info').eq('id', session.user.userId).single();
    if (profile?.signup_info?.is_pseudoadmin) {
      // Allowed! Pseudoadmin can create global announcements like admin
    } else if (profile?.is_cr) {
      isCR = true;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (!['teacher','superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { title, content, type, subject_id, link_url, file_url, expiry_hours, target_student_ids, target_branch, target_group } = body;

  // Default 48 hours; max 15 days (360 hours)
  let hours = Number(expiry_hours) || 48;
  if (hours > 360) hours = 360;
  const expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin.from('announcements').insert({
    teacher_id: session.user.userId,
    title, content, type,
    subject_id: subject_id || null,
    link_url:   link_url || null,
    file_url:   file_url || null,
    expires_at: expires_at,
    target_student_ids: target_student_ids || null,
    target_branch: target_branch || null,
    target_group: target_group || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const role = session.user.role as string;
  let canDelete = false;

  const isPseudoadmin = !!(session.user as any).isPseudoadmin;

  if (role === 'superadmin') {
    canDelete = true;
  } else if (isPseudoadmin) {
    // Pseudoadmin can only delete their own announcements
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (ann && ann.teacher_id === session.user.userId) {
      canDelete = true;
    } else {
      return NextResponse.json({ error: 'Pseudoadmins cannot delete announcements posted by others' }, { status: 403 });
    }
  } else if (role === 'teacher') {
    // Check if creator is me, or a CR
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (!ann) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (ann.teacher_id === session.user.userId) {
      canDelete = true;
    } else {
      const { data: author } = await supabaseAdmin.from('users').select('is_cr, role').eq('id', ann.teacher_id).single();
      if (author?.is_cr || author?.role === 'student') canDelete = true;
    }
  } else {
    // CRs only delete their own
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (ann && ann.teacher_id === session.user.userId) canDelete = true;
  }

  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}



export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, title, content, type, subject_id, link_url, file_url, target_student_ids, target_branch, target_group } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const role = session.user.role as string;
  let canEdit = false;

  if (role === 'superadmin') {
    canEdit = true;
  } else if (role === 'teacher') {
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (!ann) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (ann.teacher_id === session.user.userId) {
      canEdit = true;
    } else {
      const { data: author } = await supabaseAdmin.from('users').select('is_cr, role').eq('id', ann.teacher_id).single();
      if (author?.is_cr || author?.role === 'student') canEdit = true;
    }
  } else {
    // CRs only edit their own
    const { data: ann } = await supabaseAdmin.from('announcements').select('teacher_id').eq('id', id).single();
    if (ann && ann.teacher_id === session.user.userId) canEdit = true;
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
  return NextResponse.json({ announcement: data });
}
