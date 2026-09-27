import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const today = new Date().toISOString().split('T')[0];

  const [students, teachers, subjects, classesToday] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
    supabaseAdmin.from('subjects').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('classes').select('id', { count: 'exact', head: true }).eq('date', today),
  ]);

  return NextResponse.json({
    totalStudents: students.count || 0,
    totalTeachers: teachers.count || 0,
    totalSubjects: subjects.count || 0,
    classesToday: classesToday.count || 0,
  });
}
