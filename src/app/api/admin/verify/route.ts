import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { cleanupRejectedUsers } from '@/lib/cleanupRejectedUsers';


export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['superadmin', 'teacher'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await cleanupRejectedUsers();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';

  const { data, error } = await supabaseAdmin.from('users')
    .select('id, name, email, role, roll_no, created_at, profile_photo_url, signup_info, verification_status')
    .eq('verification_status', status)
    .neq('role', 'superadmin')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['superadmin', 'teacher'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, action, reason } = await req.json();

  const updates: Record<string, unknown> = {
    verification_status: action === 'approve' ? 'approved' : 'rejected',
    is_verified:         action === 'approve',
    verified_by:         session.user.userId,
    verified_at:         new Date().toISOString(),
  };
  if (reason) updates.rejection_reason = reason;

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: session.user.userId!,
    action: action === 'approve' ? 'APPROVE_USER' : 'REJECT_USER',
    tableName: 'users', recordId: userId,
    newValue: { status: updates.verification_status, reason },
  });

  return NextResponse.json({ success: true });
}
