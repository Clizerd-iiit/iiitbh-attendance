import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { subject_id, student_ids } = body;

  if (!subject_id || !Array.isArray(student_ids)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // If teacher, verify ownership
  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin.from('subjects')
      .select('teacher_ids').eq('id', subject_id).single();
    if (!subject?.teacher_ids?.includes(session.user.userId)) {
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
    }
  }

  // Insert enrollments
  const inserts = student_ids.map(id => ({
    student_id: id,
    subject_id: subject_id
  }));

  const { error } = await supabaseAdmin.from('enrollments').upsert(inserts, { onConflict: 'student_id, subject_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: session.user.userId!,
    action: 'UPDATE_SUBJECT',
    tableName: 'enrollments',
    recordId: subject_id,
    newValue: { added_students: student_ids.length }
  });

  return NextResponse.json({ success: true });
}

// Unenroll student
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const subject_id = searchParams.get('subject_id');
  const student_id = searchParams.get('student_id');

  if (!subject_id || !student_id) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin.from('subjects')
      .select('teacher_ids').eq('id', subject_id).single();
    if (!subject?.teacher_ids?.includes(session.user.userId)) {
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin.from('enrollments')
    .delete()
    .eq('subject_id', subject_id)
    .eq('student_id', student_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: session.user.userId!,
    action: 'UPDATE_SUBJECT',
    tableName: 'enrollments',
    recordId: subject_id,
    newValue: { removed_student: student_id }
  });

  return NextResponse.json({ success: true });
}
