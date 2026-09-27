import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const ONLINE_MS = 5 * 60 * 1000;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch teachers
  const { data: teachers, error } = await supabaseAdmin.from('users')
    .select('id, name, email, bio, profile_photo_url, signup_info, last_seen_at')
    .eq('role', 'teacher')
    .eq('is_verified', true)
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch all subjects with enrollments to calculate student counts and teaches_me
  const { data: subjectsData } = await supabaseAdmin.from('subjects')
    .select('name, code, teacher_ids, enrollments(student_id)')
    .eq('is_active', true);

  const now = Date.now();
  const currentUserId = session.user.userId;

  const withStatus = (teachers || []).map((t: any) => {
    let teaches_me = false;

    // Filter subjects that belong to this teacher
    const tSubjects = (subjectsData || []).filter((s: any) => 
      s.teacher_ids && Array.isArray(s.teacher_ids) && s.teacher_ids.includes(t.id)
    );

    const formattedSubjects = tSubjects.map((s: any) => {
      const enrs = s.enrollments || [];
      if (enrs.some((e: any) => e.student_id === currentUserId)) {
        teaches_me = true;
      }
      return {
        name: s.name,
        code: s.code,
        student_count: enrs.length
      };
    });

    return {
      ...t,
      subjects: formattedSubjects,
      teaches_me,
      is_online: t.last_seen_at
        ? now - new Date(t.last_seen_at).getTime() < ONLINE_MS
        : false,
    }
  }).sort((a: any, b: any) => {
    if (a.is_online && !b.is_online) return -1;
    if (!a.is_online && b.is_online) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ teachers: withStatus });
}
