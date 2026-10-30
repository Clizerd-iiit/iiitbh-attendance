import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { closeClassAndMarkAbsent } from '@/lib/autoCloseClasses';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'Missing classId' }, { status: 400 });

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, status, created_at, subject_id')
    .eq('id', classId)
    .single();

  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  // If already closed
  if (cls.status === 'closed') {
    const { data } = await supabaseAdmin.from('attendance').select('student_id, status').eq('class_id', classId);
    const marked: Record<string, string> = {};
    (data || []).forEach(d => { marked[d.student_id] = d.status; });
    return NextResponse.json({ marked, isClosed: true, remainingSeconds: 0 });
  }

  // Calculate remaining seconds out of 600 (10 mins)
  const createdAt = cls.created_at ? new Date(cls.created_at).getTime() : Date.now();
  const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
  const remainingSeconds = Math.max(0, 600 - elapsedSeconds);

  // If 10 minutes exceeded, auto-close immediately!
  if (remainingSeconds <= 0) {
    await closeClassAndMarkAbsent(cls.id, cls.subject_id);
    const { data } = await supabaseAdmin.from('attendance').select('student_id, status').eq('class_id', classId);
    const marked: Record<string, string> = {};
    (data || []).forEach(d => { marked[d.student_id] = d.status; });
    return NextResponse.json({ marked, isClosed: true, remainingSeconds: 0 });
  }

  const { data, error } = await supabaseAdmin.from('attendance').select('student_id, status').eq('class_id', classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const marked: Record<string, string> = {};
  (data || []).forEach(d => { marked[d.student_id] = d.status; });
  
  return NextResponse.json({ marked, isClosed: false, remainingSeconds });
}
