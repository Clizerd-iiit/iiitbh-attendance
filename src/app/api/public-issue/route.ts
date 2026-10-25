import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// In-memory IP rate limiter for spam protection
const ipRequests = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequests.get(ip);
  if (!record || now > record.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + 60 * 1000 }); // 1 minute window
    return true;
  }
  if (record.count >= 5) {
    return false; // Exceeded 5 requests per minute
  }
  record.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // 1. Rate limiting check
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before submitting again.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, details, hp_field, website } = body;

    // 2. Honeypot check (spam bots will fill hidden fields)
    if (hp_field || website) {
      // Fake success to fool the bot without saving spam to database
      return NextResponse.json({ success: true, message: 'Received' });
    }

    if (!name || !details) {
      return NextResponse.json({ error: 'Missing name or details' }, { status: 400 });
    }

    // Clean inputs
    const cleanName = String(name).trim().slice(0, 100);
    const cleanDetails = String(details).trim().slice(0, 1000);

    const payload = {
      id: uuidv4(),
      name: cleanName,
      details: cleanDetails,
      date: new Date().toISOString(),
      status: 'pending',
    };

    // Store in system_settings using a unique key prefix
    await supabaseAdmin
      .from('system_settings')
      .insert({
        key: `issue_${payload.id}`,
        value: JSON.stringify(payload),
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error reporting issue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .like('key', 'issue_%');

    if (error) throw error;

    const issues = (data || [])
      .map(d => {
        try {
          return JSON.parse(d.value);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(issues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('system_settings')
      .delete()
      .eq('key', `issue_${id}`);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}