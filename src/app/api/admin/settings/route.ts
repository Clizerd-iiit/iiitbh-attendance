import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin.from('system_settings').select('*');
  const settings = Object.fromEntries((data || []).map(s => [s.key, s.value]));
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const updates = Object.entries(body).map(([key, value]) => ({
    key, value: String(value), updated_by: session.user.userId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from('system_settings')
    .upsert(updates, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
