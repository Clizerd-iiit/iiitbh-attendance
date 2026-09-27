import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });

  const { data: enrollments, error: enrError } = await supabaseAdmin
    .from('enrollments')
    .select('id, subject_id, joined_at')
    .eq('student_id', studentId);
    
  if (enrError) console.error("Enrollments fetch error:", enrError);
  if (!enrollments || enrollments.length === 0) return NextResponse.json({ subjects: [] });

  const subjectIds = enrollments.map(e => e.subject_id);
  const { data: subjectsData, error: subError } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code, teacher_ids')
    .in('id', subjectIds);
    
  if (subError) console.error("Subjects fetch error:", subError);
  
  const subjectsMap = new Map();
  (subjectsData || []).forEach(s => subjectsMap.set(s.id, s));

  // Get teacher names
  const allTeacherIds = new Set<string>();
  (subjectsData || []).forEach(s => {
    const tids = s.teacher_ids || [];
    tids.forEach((id: string) => allTeacherIds.add(id));
  });

  let teachersMap: Record<string, string> = {};
  if (allTeacherIds.size > 0) {
    const { data: teachers } = await supabaseAdmin.from('users').select('id, name').in('id', Array.from(allTeacherIds));
    teachers?.forEach(t => { teachersMap[t.id] = t.name; });
  }

  const result = enrollments.map(e => {
    const subj = subjectsMap.get(e.subject_id);
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
