import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Create a new poll or close one
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'teacher') 
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  
  if (body.action === 'close') {
    const { error } = await supabaseAdmin.from('polls')
      .update({ is_active: false })
      .eq('id', body.poll_id)
      .eq('teacher_id', session.user.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { class_id, question, options } = body;
  
  // Close any existing active polls for this class
  await supabaseAdmin.from('polls').update({ is_active: false }).eq('class_id', class_id);

  const { data, error } = await supabaseAdmin.from('polls').insert({
    teacher_id: session.user.userId,
    class_id, question, options
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ poll: data });
}

// Get active poll (and results if teacher)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('class_id');

  if (classId) {
    // Fetch active poll for a specific class (used by teacher/students)
    const { data: poll, error } = await supabaseAdmin.from('polls')
      .select('*')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
    if (!poll) return NextResponse.json({ poll: null });

    // Fetch votes
    const { data: votes } = await supabaseAdmin.from('poll_votes').select('option_index').eq('poll_id', poll.id);
    
    // Check if current user voted
    const { data: myVote } = await supabaseAdmin.from('poll_votes')
      .select('option_index').eq('poll_id', poll.id).eq('student_id', session.user.userId).single();

    return NextResponse.json({ poll, votes: votes || [], myVote: myVote?.option_index ?? null });
  }

  return NextResponse.json({ poll: null });
}
