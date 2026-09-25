import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, profession, rollNo, branch, section, subjectName, subjectCode, photoUrl } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  if (profession === 'student' && !rollNo?.trim())
    return NextResponse.json({ error: 'Roll No required' }, { status: 400 });
  if (profession === 'teacher' && (!subjectName?.trim() || !subjectCode?.trim()))
    return NextResponse.json({ error: 'Subject name and code required' }, { status: 400 });

  const role = profession === 'teacher' ? 'teacher' : 'student';
  const signupInfo = profession === 'teacher'
    ? { subject_name: subjectName, subject_code: subjectCode }
    : { roll_no: rollNo, branch, section };

  const updates: Record<string, unknown> = {
    name, role,
    profile_completed: true,
    verification_status: 'pending',
    is_verified: false,
    signup_info: signupInfo,
    updated_at: new Date().toISOString(),
  };

  if (rollNo) updates.roll_no = rollNo;
  if (branch) updates.branch = branch;
  if (section) updates.section = section;
  if (photoUrl) {
    updates.profile_photo_url  = photoUrl;
    updates.photo_change_count = 1;
    updates.photo_month_year   = new Date().toISOString().substring(0, 7);
  }

  const { error } = await supabaseAdmin
    .from('users').update(updates).eq('email', session.user.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: session.user.userId!,
    action: 'PROFILE_SETUP',
    tableName: 'users',
    newValue: { role, name, signup_info: signupInfo },
  });

  return NextResponse.json({ success: true });
}
