import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const branch = searchParams.get('branch');
  const group = searchParams.get('group');
  if (!subjectId) return NextResponse.json({ error: 'subject_id required' }, { status: 400 });

  // Verify teacher owns subject
  if (session.user.role === 'teacher') {
    const { data: sub } = await supabaseAdmin.from('subjects')
      .select('teacher_ids').eq('id', subjectId).single();
    if (!sub?.teacher_ids?.includes(session.user.userId))
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
  }

  const { data: summary } = await supabaseAdmin
    .from('student_attendance_summary')
    .select('student_id, total_classes, attended, percentage')
    .eq('subject_id', subjectId);

  const { data: students } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, student:users(name, roll_no, branch, section, signup_info)')
    .eq('subject_id', subjectId);

  const threshold = 75;
  const report = (students || [])
    .filter(e => {
      const student = e.student as any;
      const sBranch = (student?.signup_info?.branch || student?.branch || '').toUpperCase().trim();
      const sGroup = (student?.signup_info?.group || student?.section || '').toUpperCase().trim();
      const sSubGroup = (student?.signup_info?.sub_group || '').toUpperCase().trim();
      
      if (branch && sBranch !== branch.toUpperCase().trim()) return false;
      
      if (group) {
        const target = group.toUpperCase().trim();
        if (target === 'G1') {
          if (!sGroup.startsWith('G1') && !sSubGroup.startsWith('G1')) return false;
        } else if (target === 'G2') {
          if (!sGroup.startsWith('G2') && !sSubGroup.startsWith('G2')) return false;
        } else if (target === 'G1A' || target === 'G1B' || target === 'G2A' || target === 'G2B') {
          if (sSubGroup !== target && sGroup !== target) return false;
        } else {
          if (!sGroup.includes(target) && !sSubGroup.includes(target)) return false;
        }
      }
      return true;
    })
    .map(e => {
      const s = summary?.find(s => s.student_id === e.student_id);
      const student = e.student as any;
      const pct = s?.percentage || 0;
      const attended = s?.attended || 0;
      const total = s?.total_classes || 0;
      const canMiss = Math.floor((attended * 100 - threshold * total) / threshold);
      const sBranch = (student?.signup_info?.branch || student?.branch || '').trim();
      const sGroup = (student?.signup_info?.group || student?.section || '').trim();
      return {
        id: e.student_id,
        roll_no: student?.roll_no || '—',
        name: student?.name || '—',
        branch: sBranch,
        group: sGroup,
        total, attended, percentage: pct,
        safe_to_miss: Math.max(0, canMiss),
      };
    });

  return NextResponse.json({ report });
}
