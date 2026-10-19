import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: Return live attendance map for a class the CR created
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'student')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  // Only the CR who created this class can poll it
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('created_by')
    .eq('id', classId)
    .single();

  if (cls?.created_by !== session.user.userId)
    return NextResponse.json({ error: 'Not your class' }, { status: 403 });

  const { data: attendance } = await supabaseAdmin
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', classId);

  // Build a {studentId -> status} map for the frontend
  const marked: Record<string, string> = {};
  attendance?.forEach((a: any) => { marked[a.student_id] = a.status; });

  return NextResponse.json({ marked });
}
