import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  let webhookUrl = body.webhookUrl;
  if (!webhookUrl) {
    const { data: setting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'secondary_backup_webhook_url')
      .single();
    webhookUrl = setting?.value;
  }

  if (!webhookUrl) {
    return NextResponse.json({ error: 'No webhook URL provided or configured in settings' }, { status: 400 });
  }

  const testPayload = {
    event: 'TEST_BACKUP_CONNECTION',
    classId: 'TEST-CHECK-' + Math.floor(1000 + Math.random() * 9000),
    subjectCode: 'SYSTEM-TEST',
    subjectName: 'Google Sheet Connection Test',
    teacherName: session.user.name || 'SuperAdmin',
    date: new Date().toISOString().split('T')[0],
    closedAt: new Date().toISOString(),
    totalEnrolled: 1,
    presentCount: 1,
    absentCount: 0,
    records: [
      {
        rollNo: 'TEST001',
        studentName: 'Test Student Connection',
        status: 'P',
        method: 'test',
        branch: 'CSE',
        group: 'G1',
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      redirect: 'follow',
    });

    const text = await res.text();

    // Check if Google returned an error page
    if (text.includes('Error:')) {
      const match = text.match(/Error:\s*([^<]+)/i);
      const errorMsg = match ? match[1].trim() : 'Google Apps Script threw an execution error.';
      return NextResponse.json({
        success: false,
        statusCode: res.status,
        error: errorMsg,
        raw: text.slice(0, 300),
      });
    }

    if (text.includes('"status":"success"') || res.status === 200) {
      return NextResponse.json({
        success: true,
        message: 'Successfully connected and verified! 1 test row added to Google Sheet.',
      });
    }

    return NextResponse.json({
      success: false,
      statusCode: res.status,
      error: 'Unexpected response from webhook: ' + text.slice(0, 200),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Network error calling webhook: ' + (err.message || String(err)),
    });
  }
}
