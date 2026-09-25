import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isSuperAdmin = session.user.role === 'superadmin';
  const currentMonth = new Date().toISOString().substring(0, 7);
  let newChangeCount = 1;

  // 2/month limit — admin exempt
  if (!isSuperAdmin) {
    const { data: user } = await supabaseAdmin.from('users')
      .select('photo_change_count, photo_month_year, profile_photo_url')
      .eq('id', session.user.userId).single();

    const sameMonth   = user?.photo_month_year === currentMonth;
    const changeCount = sameMonth ? (user?.photo_change_count || 0) : 0;

    if (sameMonth && changeCount >= 2) {
      return NextResponse.json(
        { error: 'You can only change your profile photo 2 times per month' },
        { status: 429 }
      );
    }
    newChangeCount = changeCount + 1;

    // Delete old photo from storage if it exists
    if (user?.profile_photo_url) {
      await deleteOldPhoto(user.profile_photo_url);
    }
  } else {
    // Superadmin: still delete old photo to save storage
    const { data: user } = await supabaseAdmin.from('users')
      .select('profile_photo_url').eq('id', session.user.userId).single();
    if (user?.profile_photo_url) {
      await deleteOldPhoto(user.profile_photo_url);
    }
  }

  const formData = await req.formData();
  const file = formData.get('photo') as File;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const ext    = file.name.split('.').pop() || 'jpg';
  const path   = `${session.user.userId}/avatar-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from('profile-photos')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error('Storage error:', uploadError);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('profile-photos').getPublicUrl(path);

  const updatePayload: Record<string, unknown> = { profile_photo_url: publicUrl };
  if (!isSuperAdmin) {
    updatePayload.photo_change_count = newChangeCount;
    updatePayload.photo_month_year   = currentMonth;
  }

  await supabaseAdmin.from('users').update(updatePayload).eq('id', session.user.userId);
  return NextResponse.json({ url: publicUrl });
}

// Extract storage path from public URL and delete
async function deleteOldPhoto(publicUrl: string) {
  try {
    // URL format: .../storage/v1/object/public/profile-photos/USER_ID/avatar-xxx.jpg
    const marker = '/profile-photos/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const storagePath = publicUrl.substring(idx + marker.length);
    await supabaseAdmin.storage.from('profile-photos').remove([storagePath]);
  } catch (e) {
    console.error('Failed to delete old photo:', e);
    // Non-fatal — continue with upload
  }
}


export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: user } = await supabaseAdmin.from('users')
    .select('profile_photo_url').eq('id', session.user.userId).single();

  if (user?.profile_photo_url) {
    await deleteOldPhoto(user.profile_photo_url);
    await supabaseAdmin.from('users')
      .update({ profile_photo_url: null })
      .eq('id', session.user.userId);
  }

  return NextResponse.json({ success: true });
}
