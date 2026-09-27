import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = supabaseAdmin.from('classes')
    .select('id, date, start_time, status')
    .eq('status', 'closed')
    .order('date', { ascending: false })
    .limit(limit);

  if (subjectId) query = query.eq('subject_id', subjectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}
