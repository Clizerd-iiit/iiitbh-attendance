import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendPushNotification } from '@/lib/pushNotifications';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { subscription } = body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return NextResponse.json({ error: 'Subscription data required for test' }, { status: 400 });
  }

  const name = session.user.name || 'User';
  const success = await sendPushNotification(subscription, {
    title: '🔔 Test Notification Successful!',
    body: `Hello ${name}, your phone/browser is now linked with IIIT Bhagalpur AMS. You will receive all class announcements here.`,
    url: '/student/announcements',
    tag: 'ams-test-alert',
  });

  if (!success) {
    return NextResponse.json(
      { error: 'Could not send test push notification. Check browser permissions.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Test notification dispatched successfully!',
  });
}
