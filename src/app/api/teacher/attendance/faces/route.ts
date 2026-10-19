import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subjectId = new URL(req.url).searchParams.get('subject_id');
  if (!subjectId) return NextResponse.json({ error: 'Missing subject_id' }, { status: 400 });

  let isAuthorized = ['teacher', 'superadmin'].includes(session.user.role as string);
  if (!isAuthorized && session.user.role === 'student') {
    const { hasActiveDelegationForSubject } = await import('@/lib/delegation');
    const studentId = (session.user.userId || (session.user as any).id) as string;
    if (studentId) {
      isAuthorized = await hasActiveDelegationForSubject(studentId, subjectId);
    }
  }

  if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { data: enrollments } = await supabaseAdmin.from('enrollments')
    .select('student_id').eq('subject_id', subjectId);
  const ids = (enrollments || []).map((e: { student_id: string }) => e.student_id);
  
  if (ids.length === 0) return NextResponse.json({ students: [] });

  const { data: users, error } = await supabaseAdmin.from('users')
    .select('id, name, roll_no, signup_info')
    .in('id', ids);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const studentFaces = (users || []).map(u => ({
    id: u.id,
    name: u.name || 'Student',
    roll_no: u.roll_no || '',
    descriptor: u.signup_info?.face_descriptor || null
  })).filter(u => u.descriptor !== null);

  return NextResponse.json({ students: studentFaces });
}
