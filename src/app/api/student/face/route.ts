import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { descriptor } = await req.json();
  if (!descriptor || !Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Invalid descriptor' }, { status: 400 });
  }

  // Fetch existing signup_info to merge
  const { data: user } = await supabaseAdmin.from('users').select('signup_info').eq('id', session.user.userId).single();
  const signupInfo = user?.signup_info || {};
  
  // Check 30 day limit, BUT allow bypass if upgrading from old 1D model to new 3D Multi-Angle model
  const isLegacy = signupInfo.face_descriptor && !Array.isArray(signupInfo.face_descriptor[0]);
  
  if (signupInfo.last_face_update && !isLegacy) {
    const lastUpdate = new Date(signupInfo.last_face_update).getTime();
    const now = Date.now();
    const daysSince = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) {
      return NextResponse.json({ error: `You can only update your Face ID once every 30 days. Please try again after ${Math.ceil(30 - daysSince)} days.` }, { status: 400 });
    }
  }

  signupInfo.face_descriptor = descriptor;
  signupInfo.last_face_update = new Date().toISOString();

  const { error } = await supabaseAdmin.from('users').update({ signup_info: signupInfo }).eq('id', session.user.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: user } = await supabaseAdmin.from('users').select('signup_info, is_cr').eq('id', session.user.userId).single();
  const descriptor = user?.signup_info?.face_descriptor || null;
  
  return NextResponse.json({ hasFaceId: !!descriptor, descriptor, info: user?.signup_info, is_cr: user?.is_cr });
}
