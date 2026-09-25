import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string)) 
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { classId, studentIds, status, method } = await req.json();
  if (!classId || !studentIds || !Array.isArray(studentIds)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const markStatus = status || 'P';
  let dbMethod = method;
  if (method === 'kiosk' || method === 'ai_vision') dbMethod = 'manual'; // Fallback for constraint

  const { data: existing } = await supabaseAdmin.from('attendance').select('id, student_id').eq('class_id', classId).in('student_id', studentIds);
  const existingSet = new Set(existing?.map(e => e.student_id) || []);

  const toInsert = studentIds.filter(id => !existingSet.has(id)).map(id => ({
    class_id: classId,
    student_id: id,
    status: markStatus,
    method: dbMethod
  }));

  const toUpdate = existing?.map(e => e.id) || [];

  if (toInsert.length > 0) {
    await supabaseAdmin.from('attendance').insert(toInsert);
  }
  
  if (toUpdate.length > 0) {
    await supabaseAdmin.from('attendance')
      .update({ status: markStatus, method: dbMethod, edited_by: session.user.userId, edited_at: new Date().toISOString() })
      .in('id', toUpdate);
  }

  return NextResponse.json({ success: true, inserted: toInsert.length, updated: toUpdate.length });
}
