import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'teacher' && session.user.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const subjectId = searchParams.get('subjectId');

  if (!studentId || !subjectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  // Verify teacher teaches this subject (skip for admin)
  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin.from('subjects').select('teacher_ids').eq('id', subjectId).single();
    if (!subject?.teacher_ids?.includes(session.user.userId)) {
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
    }
  }

  // Get all classes for this subject
  const { data: classes } = await supabaseAdmin.from('classes').select('id, date, start_time, status').eq('subject_id', subjectId).order('date', { ascending: false });
  if (!classes) return NextResponse.json({ history: [] });

  const classIds = classes.map(c => c.id);
  
  // Get attendance for this student in these classes
  const { data: attendance } = await supabaseAdmin.from('attendance')
    .select('id, class_id, status, method, marked_at')
    .eq('student_id', studentId)
    .in('class_id', classIds);

  const attMap: Record<string, any> = {};
  attendance?.forEach(a => { attMap[a.class_id] = a; });

  const history = classes.map(cls => ({
    class_id: cls.id,
    date: cls.date,
    start_time: cls.start_time,
    class_status: cls.status,
    attendance_id: attMap[cls.id]?.id || null,
    status: attMap[cls.id]?.status || 'Absent (Unmarked)',
    method: attMap[cls.id]?.method || '-',
  }));

  return NextResponse.json({ history });
}
