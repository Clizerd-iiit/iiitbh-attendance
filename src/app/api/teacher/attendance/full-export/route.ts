import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const studentId = searchParams.get('student_id'); // Optional, if they want specific student
  const branch = searchParams.get('branch');
  const group = searchParams.get('group');

  if (!subjectId) return NextResponse.json({ error: 'subject_id required' }, { status: 400 });

  // 1. Get all classes for this subject
  const { data: classes } = await supabaseAdmin.from('classes')
    .select('id, date').eq('subject_id', subjectId).order('date', { ascending: true });
  
  const classList = classes || [];

  // 2. Get enrollments with student profile info
  let enrQuery = supabaseAdmin.from('enrollments')
    .select('student_id, student:users(name, roll_no, branch, section, signup_info)')
    .eq('subject_id', subjectId);
  if (studentId) enrQuery = enrQuery.eq('student_id', studentId);
  
  const { data: rawStudents } = await enrQuery;

  // Filter by branch / group if specified
  const students = (rawStudents || []).filter(enr => {
    const st = enr.student as any;
    const sBranch = (st?.signup_info?.branch || st?.branch || '').trim();
    const sGroup = (st?.signup_info?.group || st?.section || '').trim();
    if (branch && sBranch.toUpperCase() !== branch.toUpperCase()) return false;
    if (group && !sGroup.toUpperCase().includes(group.toUpperCase())) return false;
    return true;
  });

  // 3. Get attendance records
  let recQuery = supabaseAdmin.from('attendance').select('student_id, class_id, status')
    .in('class_id', classList.map(c => c.id));
  if (studentId) recQuery = recQuery.eq('student_id', studentId);
  
  const { data: records } = await recQuery;

  // 4. Assemble CSV
  const header = ['Roll No', 'Name', 'Branch', 'Group', 'Total Classes', 'Attended', 'Percentage'];
  classList.forEach(c => header.push(format(new Date(c.date), 'dd-MMM')));
  
  const rows = students.map(enr => {
    const st = enr.student as any;
    const myRecords = (records || []).filter(r => r.student_id === enr.student_id);
    const attended = myRecords.filter(r => r.status === 'P' || r.status === 'Late').length;
    const total = classList.length;
    const pct = total === 0 ? 0 : Math.round((attended / total) * 100);

    const sBranch = st?.signup_info?.branch || st?.branch || '—';
    const sGroup = st?.signup_info?.group || st?.section || '—';

    const row = [st?.roll_no || '—', `"${st?.name || '—'}"`, sBranch, sGroup, total.toString(), attended.toString(), pct + '%'];
    
    classList.forEach(c => {
      const rec = myRecords.find(r => r.class_id === c.id);
      row.push(rec ? rec.status : 'A');
    });
    return row;
  });

  const csv = [header, ...rows].map(r => r.join(',')).join('\n');

  const fileParts = [subjectId];
  if (branch) fileParts.push(branch);
  if (group) fileParts.push(group);
  const fileName = `Attendance_Export_${fileParts.join('_')}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${fileName}"`
    }
  });
}
