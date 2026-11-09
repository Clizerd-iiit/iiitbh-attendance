import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';


export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const date = searchParams.get('date');
  const classId = searchParams.get('class_id');
  if (!subjectId || !date) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  let targetClassId = classId;
  if (!targetClassId) {
    const { data: cls } = await supabaseAdmin.from('classes')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('date', date)
      .limit(1)
      .single();
    if (!cls) return NextResponse.json({ attendance: [] });
    targetClassId = cls.id;
  }

  const { data: records } = await supabaseAdmin.from('attendance')
    .select('student_id, status').eq('class_id', targetClassId);

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
      .insert({ subject_id, date, start_time: '10:00:00', end_time: '11:00:00', status: 'closed', created_by: session.user.userId })
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

  // Execute Inserts and Batched Parallel Updates (instant ~200ms instead of 75 sequential round-trips!)
  if (toInsert.length > 0) {
    await supabaseAdmin.from('attendance').insert(toInsert);
  }
  if (toUpdate.length > 0) {
    const presentIds = toUpdate.filter(r => r.status === 'P').map(r => r.id);
    const absentIds = toUpdate.filter(r => r.status === 'A').map(r => r.id);
    const lateIds = toUpdate.filter(r => r.status === 'Late').map(r => r.id);

    const updateOps: any[] = [];
    const nowIso = new Date().toISOString();

    if (presentIds.length > 0) {
      updateOps.push(
        supabaseAdmin.from('attendance')
          .update({ status: 'P', method: 'manual', edited_by: session.user.userId, edited_at: nowIso })
          .in('id', presentIds)
      );
    }
    if (absentIds.length > 0) {
      updateOps.push(
        supabaseAdmin.from('attendance')
          .update({ status: 'A', method: 'manual', edited_by: session.user.userId, edited_at: nowIso })
          .in('id', absentIds)
      );
    }
    if (lateIds.length > 0) {
      updateOps.push(
        supabaseAdmin.from('attendance')
          .update({ status: 'Late', method: 'manual', edited_by: session.user.userId, edited_at: nowIso })
          .in('id', lateIds)
      );
    }
    await Promise.all(updateOps);
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
