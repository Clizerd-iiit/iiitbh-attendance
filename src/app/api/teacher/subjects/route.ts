import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabaseAdmin.from('subjects')
    .select('*, teacher:users(name, email)')
    .eq('is_active', true);

  // Teachers only see their own subjects
  if (session.user.role === 'teacher') {
    query = query.contains('teacher_ids', `[${JSON.stringify(session.user.userId)}]`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subjects: data });
}
