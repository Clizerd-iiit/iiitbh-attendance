import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'teacher') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'Missing classId' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('attendance').select('student_id, status').eq('class_id', classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const marked: Record<string, string> = {};
  data.forEach(d => { marked[d.student_id] = d.status; });
  
  return NextResponse.json({ marked });
}
