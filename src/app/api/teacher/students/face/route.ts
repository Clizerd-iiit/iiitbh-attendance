import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user?.role === 'superadmin';
  const isTeacher = session?.user?.role === 'teacher';
  const isPseudoadmin = !!(session?.user as any)?.isPseudoadmin;

  if (!session?.user || (!isTeacher && !isSuperAdmin && !isPseudoadmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { student_id, descriptor } = await req.json();
  if (!student_id || !descriptor || !Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin.from('users').select('signup_info, branch, role').eq('id', student_id).single();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role === 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (isPseudoadmin) {
    const myBranch = ((session?.user as any)?.pseudoadminBranch || '').toUpperCase().trim();
    const targetBranch = (user.signup_info?.branch || user.branch || '').toUpperCase().trim();
    if (myBranch && targetBranch && myBranch !== targetBranch) {
      return NextResponse.json({ error: `Forbidden: You can only modify Face ID for students in your branch (${myBranch})` }, { status: 403 });
    }
  }

  const signupInfo = user?.signup_info || {};
  
  signupInfo.face_descriptor = descriptor;
  signupInfo.last_face_update = new Date().toISOString();

  const { error } = await supabaseAdmin.from('users').update({ signup_info: signupInfo }).eq('id', student_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user?.role === 'superadmin';
  const isTeacher = session?.user?.role === 'teacher';
  const isPseudoadmin = !!(session?.user as any)?.isPseudoadmin;

  if (!session?.user || (!isTeacher && !isSuperAdmin && !isPseudoadmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  let student_id = url.searchParams.get('student_id');
  if (!student_id) {
    try {
      const body = await req.json();
      student_id = body?.student_id;
    } catch {}
  }
  if (!student_id) return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });

  const { data: user } = await supabaseAdmin.from('users').select('signup_info, branch, role').eq('id', student_id).single();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role === 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (isPseudoadmin) {
    const myBranch = ((session?.user as any)?.pseudoadminBranch || '').toUpperCase().trim();
    const targetBranch = (user.signup_info?.branch || user.branch || '').toUpperCase().trim();
    if (myBranch && targetBranch && myBranch !== targetBranch) {
      return NextResponse.json({ error: `Forbidden: You can only modify Face ID for students in your branch (${myBranch})` }, { status: 403 });
    }
  }

  const signupInfo = user?.signup_info || {};
  
  delete signupInfo.last_face_update; // Remove the limit lock
  delete signupInfo.face_descriptor;  // ACTUALLY delete the face data to trigger Setup banner

  const { error } = await supabaseAdmin.from('users').update({ signup_info: signupInfo }).eq('id', student_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}
