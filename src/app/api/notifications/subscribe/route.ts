import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  savePushSubscription,
  deletePushSubscription,
  VAPID_PUBLIC_KEY,
} from '@/lib/pushNotifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    publicKey: VAPID_PUBLIC_KEY,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user.userId || (session.user as any).id) as string;
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
  }

  const body = await req.json();
  const { subscription } = body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 });
  }

  // Fetch user role and branch for smart targeting
  let role = session.user.role as string;
  let branch: string | undefined = undefined;

  try {
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('branch, role, signup_info')
      .eq('id', userId)
      .single();

    if (userProfile) {
      role = userProfile.role || role;
      branch = userProfile.branch || userProfile.signup_info?.branch;
    }
  } catch {}

  const result = await savePushSubscription(userId, subscription, role, branch);

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to save subscription' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Push subscription registered successfully',
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint is required to unsubscribe' }, { status: 400 });
  }

  await deletePushSubscription(endpoint);

  return NextResponse.json({
    success: true,
    message: 'Push subscription removed successfully',
  });
}
