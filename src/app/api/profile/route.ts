import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanupRejectedUsers } from '@/lib/cleanupRejectedUsers';


export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin.from('users')
    .select('name, email, role, roll_no, bio, profile_photo_url, photo_change_count, photo_month_year, signup_info, verification_status')
    .eq('id', session.user.userId).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.bio !== undefined)  allowed.bio  = body.bio;

  // Handle nested signup_info updates for students
  let updatedSignupInfo = undefined;
  if (body.branch !== undefined || body.group !== undefined || body.sub_group !== undefined) {
    const { data: user } = await supabaseAdmin.from('users').select('signup_info').eq('id', session.user.userId).single();
    updatedSignupInfo = { ...(user?.signup_info || {}) };
    if (body.branch !== undefined) updatedSignupInfo.branch = body.branch;
    if (body.group !== undefined) updatedSignupInfo.group = body.group;
    if (body.sub_group !== undefined) updatedSignupInfo.sub_group = body.sub_group;
    allowed.signup_info = updatedSignupInfo;
  }

  // Teachers can also update student details
  if (['teacher','superadmin'].includes(session.user.role || '') && body.student_id) {
    const teacherAllowed: Record<string, unknown> = {};
    if (body.name)    teacherAllowed.name    = body.name;
    if (body.roll_no) teacherAllowed.roll_no = body.roll_no;
    if (body.branch !== undefined || body.group !== undefined || body.sub_group !== undefined) {
      const { data: stu } = await supabaseAdmin.from('users').select('signup_info').eq('id', body.student_id).single();
      const sInfo = { ...(stu?.signup_info || {}) };
      if (body.branch !== undefined) sInfo.branch = body.branch;
      if (body.group !== undefined) sInfo.group = body.group;
      if (body.sub_group !== undefined) sInfo.sub_group = body.sub_group;
      teacherAllowed.signup_info = sInfo;
    }
    const { error } = await supabaseAdmin.from('users')
      .update(teacherAllowed).eq('id', body.student_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseAdmin.from('users')
    .update(allowed).eq('id', session.user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
