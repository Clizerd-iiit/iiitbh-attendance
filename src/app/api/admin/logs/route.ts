import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // Teachers can VIEW logs; admin can do everything
  if (!session?.user || !['student', 'teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit  = parseInt(searchParams.get('limit')  || '30');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Auto-delete logs older than 10 days
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  await supabaseAdmin.from('audit_logs').delete().lt('created_at', tenDaysAgo.toISOString());

  // Check role-based settings
  const role = session.user.role;
  if (role === 'teacher' || role === 'student') {
    const { data: settings } = await supabaseAdmin.from('system_settings')
      .select('value').eq('key', role === 'teacher' ? 'share_logs_with_teachers' : 'share_logs_with_students').single();
    if (settings && settings.value === 'false') {
      return NextResponse.json({ logs: [], total: 0, disabled: true });
    }
  }

  // Join with users to get rich info: name, email, role, roll_no, profile_photo_url
  const { data, count, error } = await supabaseAdmin
    .from('audit_logs')
    .select(`
      id, action, table_name, record_id, old_value, new_value, ip_address, created_at,
      user:users(id, name, email, role, roll_no, profile_photo_url)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data, total: count });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // Only admin can delete logs
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id  = searchParams.get('id');
  const all = searchParams.get('all');

  if (all === 'true') {
    const { error } = await supabaseAdmin.from('audit_logs')
      .delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: 'all' });
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('audit_logs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
