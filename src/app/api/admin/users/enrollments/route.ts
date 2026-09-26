import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('id, subject_id, joined_at, subjects(name, code, teacher_ids)')
    .eq('student_id', studentId);

  if (!enrollments) return NextResponse.json({ subjects: [] });

  // Get teacher names
  const allTeacherIds = new Set<string>();
  enrollments.forEach(e => {
    const tids = (e.subjects as any)?.teacher_ids || [];
    tids.forEach((id: string) => allTeacherIds.add(id));
  });

  let teachersMap: Record<string, string> = {};
  if (allTeacherIds.size > 0) {
    const { data: teachers } = await supabaseAdmin.from('users').select('id, name').in('id', Array.from(allTeacherIds));
    teachers?.forEach(t => { teachersMap[t.id] = t.name; });
  }

  const result = enrollments.map(e => {
    const subj = e.subjects as any;
    const teacherNames = (subj?.teacher_ids || []).map((id: string) => teachersMap[id] || 'Unknown').join(', ');
    return {
      enrollment_id: e.id,
      subject_id: e.subject_id,
      subject_code: subj?.code,
      subject_name: subj?.name,
      teachers: teacherNames || 'None',
      joined_at: e.joined_at
    };
  });

  return NextResponse.json({ subjects: result });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enrollmentId = req.nextUrl.searchParams.get('enrollmentId');
  if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 });

  await supabaseAdmin.from('enrollments').delete().eq('id', enrollmentId);
  return NextResponse.json({ success: true });
}
