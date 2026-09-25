import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'teacher' && session.user.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { student_id, descriptor } = await req.json();
  if (!student_id || !descriptor || !Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin.from('users').select('signup_info').eq('id', student_id).single();
  const signupInfo = user?.signup_info || {};
  
  signupInfo.face_descriptor = descriptor;
  signupInfo.last_face_update = new Date().toISOString();

  const { error } = await supabaseAdmin.from('users').update({ signup_info: signupInfo }).eq('id', student_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'teacher' && session.user.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const student_id = url.searchParams.get('student_id');
  if (!student_id) return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });

  const { data: user } = await supabaseAdmin.from('users').select('signup_info').eq('id', student_id).single();
  const signupInfo = user?.signup_info || {};
  
  delete signupInfo.last_face_update; // Remove the limit lock

  const { error } = await supabaseAdmin.from('users').update({ signup_info: signupInfo }).eq('id', student_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}
