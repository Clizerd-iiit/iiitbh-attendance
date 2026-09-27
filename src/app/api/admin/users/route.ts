import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';


const userUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  roll_no: z.string().optional(),
  section: z.string().optional(),
  branch: z.string().optional(),
  group: z.string().optional(),
  sub_group: z.string().optional(),
  is_cr: z.boolean().optional(),
  is_active: z.boolean().optional(),
  bio: z.string().nullable().optional(),
  profile_photo_url: z.string().nullable().optional(),
  email: z.string().email().optional(),
  role: z.enum(['student', 'teacher', 'superadmin']).optional(),
}).catchall(z.any());

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const role      = searchParams.get('role');
  const subjectId = searchParams.get('subject_id');

  let query = supabaseAdmin.from('users').select('*').order('name');
  if (role) query = query.eq('role', role);

  if (subjectId) {
    const { data: enrollments } = await supabaseAdmin.from('enrollments')
      .select('student_id').eq('subject_id', subjectId);
    const ids = (enrollments || []).map((e: { student_id: string }) => e.student_id);
    if (ids.length === 0) return NextResponse.json({ users: [] });
    query = query.in('id', ids);
  }

  if (session.user.role === 'teacher') {
    // Re-apply the same query logic but with restricted select fields
    let safeQuery = supabaseAdmin.from('users')
      .select('id, name, email, roll_no, section, semester, profile_photo_url, is_active, signup_info, branch')
      .order('name')
      .eq('role', 'student'); // Ensure teachers only see students

    if (subjectId) {
      const { data: enrollments } = await supabaseAdmin.from('enrollments')
        .select('student_id').eq('subject_id', subjectId);
      const ids = (enrollments || []).map((e: { student_id: string }) => e.student_id);
      if (ids.length === 0) return NextResponse.json({ users: [] });
      safeQuery = safeQuery.in('id', ids);
    }

    const { data, error } = await safeQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const signupInfo = { branch: body.branch, group: body.group, sub_group: body.sub_group };
  const { data, error } = await supabaseAdmin.from('users').insert({
    name: body.name, email: body.email, role: body.role,
    roll_no: body.roll_no, section: body.section,
    semester: body.semester, is_active: true,
    profile_completed: true, is_verified: true, verification_status: 'approved',
    signup_info: signupInfo,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: session.user.userId!, action: 'CREATE_USER',
    tableName: 'users', recordId: data.id,
    newValue: { email: body.email, role: body.role },
  });

  return NextResponse.json({ user: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = userUpdateSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid input data', details: e.errors }, { status: 400 });
  }
  const { id, ...updates } = body;

  if (session.user.role === 'teacher') {
    const safeKeys = ['name', 'roll_no', 'section', 'branch', 'group', 'sub_group', 'is_cr', 'is_active', 'bio', 'profile_photo_url', 'email'];
    Object.keys(updates).forEach(k => { if (!safeKeys.includes(k)) delete updates[k]; });
  }

  // Extract branch/group and move to signup_info
  if (updates.branch !== undefined || updates.group !== undefined || updates.sub_group !== undefined) {
    const { data: user } = await supabaseAdmin.from('users').select('signup_info').eq('id', id).single();
    const info = { ...(user?.signup_info || {}) };
    if (updates.branch !== undefined) { info.branch = updates.branch; delete updates.branch; }
    if (updates.group !== undefined) { info.group = updates.group; delete updates.group; }
    if (updates.sub_group !== undefined) { info.sub_group = updates.sub_group; delete updates.sub_group; }
    updates.signup_info = info;
  }

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: session.user.userId!, action: 'UPDATE_USER',
    tableName: 'users', recordId: id, newValue: updates,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Block self-delete only
  if (id === session.user.userId)
    return NextResponse.json({ error: 'Apna khud ka account delete nahi kar sakte' }, { status: 400 });

  // Fetch user details before deleting (for audit + storage cleanup)
  const { data: user } = await supabaseAdmin.from('users')
    .select('name, email, role, profile_photo_url')
    .eq('id', id).single();

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const errors: string[] = [];

  // 1. Delete profile photo from Supabase Storage
  if (user.profile_photo_url) {
    try {
      const marker = '/profile-photos/';
      const idx = (user.profile_photo_url as string).indexOf(marker);
      if (idx !== -1) {
        const storagePath = (user.profile_photo_url as string).substring(idx + marker.length);
        const { error: storageErr } = await supabaseAdmin.storage
          .from('profile-photos').remove([storagePath]);
        if (storageErr) errors.push('storage: ' + storageErr.message);
      }
    } catch (e) {
      errors.push('storage cleanup failed');
    }
  }

  // 2. Delete user_sessions
  await supabaseAdmin.from('user_sessions').delete().eq('user_id', id);

  // 3. Delete attendance records (as student)
  await supabaseAdmin.from('attendance').delete().eq('student_id', id);

  // Delete leave_requests (even though feature is removed, table may have old records)
  await supabaseAdmin.from('leave_requests').delete().eq('student_id', id);

  // Delete poll_votes (as student)
  await supabaseAdmin.from('poll_votes').delete().eq('student_id', id);

  // 4. Delete enrollments (as student)
  await supabaseAdmin.from('enrollments').delete().eq('student_id', id);

  // 6. If teacher: nullify their subjects & announcements, delete their classes
  if (user.role === 'teacher') {
    // Get teacher subjects
    const { data: teacherSubjects } = await supabaseAdmin.from('subjects')
      .select('id').eq('teacher_id', id);
    const subjectIds = (teacherSubjects || []).map((s: { id: string }) => s.id);

    if (subjectIds.length > 0) {
      // Delete attendance for those subjects' classes
      const { data: classesList } = await supabaseAdmin.from('classes')
        .select('id').in('subject_id', subjectIds);
      const classIds = (classesList || []).map((c: { id: string }) => c.id);
      if (classIds.length > 0) {
        await supabaseAdmin.from('attendance').delete().in('class_id', classIds);
        
        // Delete polls and poll_votes for these classes
        const { data: pollsList } = await supabaseAdmin.from('polls').select('id').in('class_id', classIds);
        const pollIds = (pollsList || []).map(p => p.id);
        if (pollIds.length > 0) {
          await supabaseAdmin.from('poll_votes').delete().in('poll_id', pollIds);
          await supabaseAdmin.from('polls').delete().in('id', pollIds);
        }
      }

      // Delete the classes themselves
      await supabaseAdmin.from('classes').delete().in('subject_id', subjectIds);

      // Delete enrollments in those subjects
      await supabaseAdmin.from('enrollments').delete().in('subject_id', subjectIds);

      // Nullify teacher_id on subjects (keep subjects as record or delete)
      await supabaseAdmin.from('subjects').update({ teacher_id: null }).eq('teacher_id', id);
    }

    // Delete announcements by this teacher
    await supabaseAdmin.from('announcements').delete().eq('teacher_id', id);
  }

  // Nullify notes_vault uploads (keep notes but remove user ref)
  await supabaseAdmin.from('notes_vault').update({ uploaded_by: null }).eq('uploaded_by', id);

  // 7. Nullify references in audit_logs (keep logs but remove user ref)
  await supabaseAdmin.from('audit_logs').update({ user_id: null }).eq('user_id', id);

  // 8. Nullify system_settings updated_by references
  await supabaseAdmin.from('system_settings').update({ updated_by: null }).eq('updated_by', id);

  // 9. Nullify verified_by in users table
  await supabaseAdmin.from('users').update({ verified_by: null }).eq('verified_by', id);

  // 10. Finally delete the user
  const { error: deleteError } = await supabaseAdmin.from('users').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  // 11. Audit log this deletion (under current admin's ID)
  await logAudit({
    userId: session.user.userId!, action: 'DELETE_USER',
    tableName: 'users', recordId: id,
    oldValue: { name: user.name, email: user.email, role: user.role },
  });

  return NextResponse.json({
    success: true,
    warnings: errors.length > 0 ? errors : undefined,
  });
}
