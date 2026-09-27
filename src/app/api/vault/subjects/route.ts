import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabaseAdmin.from('enrollments')
    .select('subject_id, subjects(id, name, code)')
    .eq('student_id', session.user.userId);
    
  const subjects = data?.map(d => d.subjects).filter(Boolean) || [];
  return NextResponse.json({ subjects });
}
