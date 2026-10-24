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

    // Try to parse JSON response from Apps Script
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}

    if (json) {
      if (json.status === 'success') {
        return NextResponse.json({
          success: true,
          message: json.message || 'Successfully connected and verified! 1 test row added to Google Sheet.',
        });
      } else {
        return NextResponse.json({
          success: false,
          statusCode: res.status,
          error: json.error || 'Google Apps Script returned an error: ' + JSON.stringify(json),
        });
      }
    }

    // Check if Google returned an HTML error page or execution error
    if (text.includes('Error:') || text.includes('Exception:')) {
      const match = text.match(/(?:Error|Exception):\s*([^<\n]+)/i);
      const errorMsg = match ? match[1].trim() : text.replace(/<[^>]+>/g, ' ').trim().slice(0, 300);
      return NextResponse.json({
        success: false,
        statusCode: res.status,
        error: errorMsg,
        raw: text.slice(0, 300),
      });
    }

    if (res.status === 200 && text.toLowerCase().includes('success')) {
      return NextResponse.json({
        success: true,
        message: 'Successfully connected and verified! 1 test row added to Google Sheet.',
      });
    }

    return NextResponse.json({
      success: false,
      statusCode: res.status,
      error: 'Unexpected response from webhook: ' + text.slice(0, 300),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Network error calling webhook: ' + (err.message || String(err)),
    });
  }
}
