import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end   = searchParams.get('end');
  const studentId = searchParams.get('student_id') || session.user.userId;

  // Students can only view their own
  if (session.user.role === 'student' && studentId !== session.user.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('status, class:classes(date, subject:subjects(code))')
    .eq('student_id', studentId)
    .gte('classes.date', start || '')
    .lte('classes.date', end   || '');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by date
  const byDate: Record<string, { subject_code: string; status: string }[]> = {};
  (data || []).forEach((rec: { status: string; class: unknown }) => {
    const cls = rec.class as { date?: string; subject?: { code?: string } | null } | null;
    if (!cls?.date) return;
    if (!byDate[cls.date]) byDate[cls.date] = [];
    byDate[cls.date].push({ subject_code: cls?.subject?.code || '?', status: rec.status });
  });

  const records = Object.entries(byDate).map(([date, recs]) => ({ date, records: recs }));
  return NextResponse.json({ records });
}
