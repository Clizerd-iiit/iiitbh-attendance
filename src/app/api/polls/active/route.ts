import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Find all active classes for this student's subjects
  const { data: enrollments } = await supabaseAdmin.from('enrollments').select('subject_id').eq('student_id', session.user.userId);
  if (!enrollments || enrollments.length === 0) return NextResponse.json({ poll: null });
  
  const subjectIds = enrollments.map(e => e.subject_id);
  const { data: activeClasses } = await supabaseAdmin.from('classes').select('id').in('subject_id', subjectIds).eq('status', 'active');
  if (!activeClasses || activeClasses.length === 0) return NextResponse.json({ poll: null });
  
  const classIds = activeClasses.map(c => c.id);

  // 2. See if there's an active poll for any of those classes
  const { data: poll, error } = await supabaseAdmin.from('polls')
    .select('*, teacher:users(name)')
    .in('class_id', classIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  if (!poll) return NextResponse.json({ poll: null });

  // 3. Check if user voted
  const { data: myVote } = await supabaseAdmin.from('poll_votes')
    .select('option_index').eq('poll_id', poll.id).eq('student_id', session.user.userId).single();

  return NextResponse.json({ poll, myVote: myVote?.option_index ?? null });
}
