import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'student') 
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { poll_id, option_index } = await req.json();

  const { error } = await supabaseAdmin.from('poll_votes').insert({
    poll_id,
    student_id: session.user.userId,
    option_index
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
