import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('student_id') || session.user.userId;

  // Students can only view their own data
  if (session.user.role === 'student' && studentId !== session.user.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('student_attendance_summary')
    .select('*')
    .eq('student_id', studentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add safe-to-miss calculation
  const threshold = 75;
  const enriched = data?.map(row => {
    const total = row.total_classes || 0;
    const attended = row.attended || 0;
    const needed75 = total > 0 ? Math.ceil((threshold * total - 100 * attended) / (100 - threshold)) : 0;
    const canMiss = total > 0 ? Math.floor((attended * 100 - threshold * total) / threshold) : 0;
    return { 
      ...row, 
      percentage: row.percentage === null ? 100 : row.percentage,
      classes_to_attend: Math.max(0, needed75), 
      safe_to_miss: Math.max(0, canMiss) 
    };
  });

  // Calculate Streak
  let streak = 0;
  const { data: history } = await supabaseAdmin
    .from('attendance')
    .select('status, class:classes(date, start_time)')
    .eq('student_id', studentId)
    .order('class(date)', { ascending: false })
    .order('class(start_time)', { ascending: false });

  if (history) {
    // History might be ordered weirdly because of nested ordering, let's sort in JS to be safe
    const sorted = history.sort((a: any, b: any) => {
      const dateA = new Date(`${a.class.date}T${a.class.start_time}`);
      const dateB = new Date(`${b.class.date}T${b.class.start_time}`);
      return dateB.getTime() - dateA.getTime();
    });
    
    for (const record of sorted) {
      if (record.status === 'P' || record.status === 'Late') {
        streak++;
      } else if (record.status === 'A') {
        break; // Streak broken
      }
    }
  }

  return NextResponse.json({ summary: enriched, streak });
}
