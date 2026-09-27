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
  if (session.user.role === 'student') {
    // Fetch student profile for branch/group/cr
        let { data: profile, error: profileErr } = await supabaseAdmin.from('users').select('branch, section, is_cr').eq('id', session.user.userId).single();
    if (profileErr && profileErr.message.includes('column users.branch does not exist')) {
      const fallbackRes = await supabaseAdmin.from('users').select('section').eq('id', session.user.userId).single();
      profile = fallbackRes.data as any;
    }
    if (profile) is_cr = profile.is_cr || false;
    
    const b = profile?.branch || 'none';
    const s = profile?.section || 'none';
    
    // They see announcements if:
    // 1. target_student_ids contains them
    // 2. OR no target_student_ids AND (target_branch is null OR target_branch == their branch) AND (target_group is null OR target_group == their group)
    // Supabase OR syntax is tricky. Let's just fetch all and filter in JS for safety, or use a complex OR.
    // Let's use a simpler OR:
        // Correct PostgREST syntax for (target_branch is null OR target_branch == b)
    query = query.or(`target_student_ids.cs.[${JSON.stringify(session.user.userId)}],and(target_student_ids.is.null,or(target_branch.is.null,target_branch.eq.${b}),or(target_group.is.null,target_group.eq.${s}))`);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data, is_cr, userId: session.user.userId });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const role = session.user.role as string;
  let isCR = false;
  
  if (role === 'student') {
        const { data: profile, error: profileErr } = await supabaseAdmin.from('users').select('is_cr').eq('id', session.user.userId).single();
    if (profileErr && profileErr.message.includes('column users.is_cr does not exist')) {
       return NextResponse.json({ error: 'Database migration required' }, { status: 500 });
    }
    if (profile?.is_cr) isCR = true;
    else return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  if (role === 'superadmin') {
    canDelete = true;
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

