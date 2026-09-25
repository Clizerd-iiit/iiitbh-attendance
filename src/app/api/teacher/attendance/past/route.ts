import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';


export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const date = searchParams.get('date');
  const classId = searchParams.get('class_id');
  if (!subjectId || !date) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  let clsQuery = supabaseAdmin.from('classes').select('id').eq('subject_id', subjectId).eq('date', date);
  if (classId) clsQuery = clsQuery.eq('id', classId);
  
  // Use .limit(1).single() to avoid PGRST116 multiple rows error if they forgot class_id
  const { data: cls } = await clsQuery.limit(1).single();

  if (!cls) return NextResponse.json({ attendance: [] });

  const { data: records } = await supabaseAdmin.from('attendance')
    .select('student_id, status').eq('class_id', cls.id);

  return NextResponse.json({ attendance: records || [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { subject_id, date, class_id, attendance_map } = body;

  if (!subject_id || !date || !attendance_map) 
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  // 1. Check if class exists for this date, if not create it.
  let clsQuery = supabaseAdmin.from('classes').select('id').eq('subject_id', subject_id).eq('date', date);
  if (class_id) clsQuery = clsQuery.eq('id', class_id);
  
  let { data: cls } = await clsQuery.limit(1).single();

  if (!cls) {
    const { data: newCls, error: err } = await supabaseAdmin.from('classes')
      .insert({ subject_id, date, start_time: '10:00:00', end_time: '11:00:00' })
      .select('id').single();
    if (err || !newCls) return NextResponse.json({ error: 'Failed to create class record' }, { status: 500 });
    cls = newCls;
  }

  // 2. Fetch existing records to update vs insert
  const { data: existingRecords } = await supabaseAdmin.from('attendance')
    .select('id, student_id')
    .eq('class_id', cls.id);

  const existingMap = new Map(existingRecords?.map(r => [r.student_id, r.id]) || []);

  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  for (const [userId, status] of Object.entries(attendance_map)) {
    const existingId = existingMap.get(userId);
    if (existingId) {
      toUpdate.push({ id: existingId, status, method: 'manual', marked_at: new Date().toISOString() });
    } else {
      toInsert.push({ class_id: cls.id, student_id: userId, status, method: 'manual', marked_at: new Date().toISOString() });
    }
  }

  // Execute Upserts
  if (toInsert.length > 0) {
    await supabaseAdmin.from('attendance').insert(toInsert);
  }
  if (toUpdate.length > 0) {
    for (const record of toUpdate) {
      await supabaseAdmin.from('attendance').update({ status: record.status, method: 'manual' }).eq('id', record.id);
    }
  }


  if (session.user.role !== 'superadmin') {
    await logAudit({
      userId: session.user.userId!,
      action: 'BULK_PAST_ATTENDANCE',
      tableName: 'attendance',
      recordId: cls.id,
      newValue: { date, count: Object.keys(attendance_map).length },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown'
    });
  }

  return NextResponse.json({ success: true });
}
