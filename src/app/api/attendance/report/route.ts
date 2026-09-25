import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  if (!subjectId) return NextResponse.json({ error: 'subject_id required' }, { status: 400 });

  // Verify teacher owns subject
  if (session.user.role === 'teacher') {
    const { data: sub } = await supabaseAdmin.from('subjects')
      .select('teacher_ids').eq('id', subjectId).single();
    if (!sub?.teacher_ids?.includes(session.user.userId))
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
  }

  const { data: summary } = await supabaseAdmin
    .from('student_attendance_summary')
    .select('student_id, total_classes, attended, percentage')
    .eq('subject_id', subjectId);

  const { data: students } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, student:users(name, roll_no)')
    .eq('subject_id', subjectId);

  const threshold = 75;
  const report = (students || []).map(e => {
    const s = summary?.find(s => s.student_id === e.student_id);
    const student = e.student as { name?: string; roll_no?: string } | null;
    const pct = s?.percentage || 0;
    const attended = s?.attended || 0;
    const total = s?.total_classes || 0;
    const canMiss = Math.floor((attended * 100 - threshold * total) / threshold);
    return {
      id: e.student_id,
      roll_no: student?.roll_no || '—',
      name: student?.name || '—',
      total, attended, percentage: pct,
      safe_to_miss: Math.max(0, canMiss),
    };
  });

  return NextResponse.json({ report });
}
