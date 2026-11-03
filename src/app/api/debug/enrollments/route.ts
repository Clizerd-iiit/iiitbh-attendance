import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId') || '574e21ab-bd49-4226-b35c-90c2f2af1383';
  
  const { data: enrollments, error: enrError } = await supabaseAdmin
    .from('enrollments')
    .select('*')
    .eq('student_id', studentId);
    
  if (enrError) return NextResponse.json({ error: enrError });

  const subjectIds = (enrollments || []).map(e => e.subject_id);
  let subjectsData: any[] = [];
  let subError = null;
  if (subjectIds.length > 0) {
    const res = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, teacher_ids')
      .in('id', subjectIds);
    subjectsData = res.data || [];
    subError = res.error;
  }
    
  return NextResponse.json({ enrollments, subjectsData, subError });
}
