import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLowAttendanceAlert(params: {
  studentEmail: string;
  studentName: string;
  subjects: { name: string; percentage: number }[];
  threshold: number;
}) {
  const list = params.subjects.map(s => `<li><strong>${s.name}</strong>: ${s.percentage}%</li>`).join('');
  return resend.emails.send({
    from: process.env.FROM_EMAIL || 'attendance@iiitbh.ac.in',
    to: params.studentEmail,
    subject: `⚠️ Low Attendance Warning`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
        <h2 style="color:#dc2626">⚠️ Low Attendance Alert</h2>
        <p>Dear <strong>${params.studentName}</strong>,</p>
        <p>Your attendance is below <strong>${params.threshold}%</strong> in:</p>
        <ul>${list}</ul>
        <p style="color:#6b7280;font-size:14px">
          Please attend more classes to maintain the required attendance.
        </p>
        <p style="color:#6b7280;font-size:12px">
          — IIIT Bhagalpur Attendance System
        </p>
      </div>
    `,
  });
}
