import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { threshold = 75 } = await req.json();

  // Get students below threshold
  const { data } = await supabaseAdmin
    .from('student_attendance_summary')
    .select('student_id, subject_name, percentage')
    .lt('percentage', threshold);

  if (!data?.length) return NextResponse.json({ sent: 0 });

  // Group by student
  const byStudent: Record<string, {subject_name:string;percentage:number}[]> = {};
  data.forEach(r => {
    if (!byStudent[r.student_id]) byStudent[r.student_id] = [];
    byStudent[r.student_id].push({ subject_name: r.subject_name, percentage: r.percentage });
  });

  let sent = 0;
  for (const [studentId, subjects] of Object.entries(byStudent)) {
    const { data: user } = await supabaseAdmin.from('users')
      .select('email, name').eq('id', studentId).single();
    if (!user?.email) continue;

    const subjectList = subjects.map(s => `• ${s.subject_name}: ${s.percentage}%`).join('\n');
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'attendance@iiitbh.ac.in',
      to: user.email,
      subject: '⚠️ Low Attendance Warning — IIIT Bhagalpur',
      html: `
        <h2>⚠️ Low Attendance Alert</h2>
        <p>Dear <strong>${user.name}</strong>,</p>
        <p>Your attendance in the following subjects has dropped below <strong>${threshold}%</strong>:</p>
        <pre style="background:#fee2e2;padding:12px;border-radius:8px;">${subjectList}</pre>
        <p>Please attend more classes to avoid being detained.</p>
        <p>— IIIT Bhagalpur Attendance System</p>
      `,
    });
    sent++;
  }

  return NextResponse.json({ sent });
}
