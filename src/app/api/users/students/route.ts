import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const ONLINE_MS = 5 * 60 * 1000;

interface UserRow {
  id: string; name: string; email: string; roll_no?: string;
  profile_photo_url?: string; section?: string; semester?: number; is_active?: boolean; branch?: string; is_cr?: boolean;
  bio?: string; last_seen_at?: string;
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isStudentViewer = session.user.role === 'student';
  const selectFields = isStudentViewer
    ? 'id, name, email, profile_photo_url, roll_no, section, branch, is_cr, last_seen_at, signup_info'
    : 'id, name, email, profile_photo_url, roll_no, section, branch, is_cr, semester, bio, last_seen_at, is_active, signup_info';

  let query = supabaseAdmin.from('users')
    .select(selectFields)
    .eq('role', 'student')
    .eq('is_verified', true);
    
  if (isStudentViewer) {
    query = query.eq('is_active', true);
  }
  
  let { data, error } = await query.order('name');
  
  // Fallback if branch/is_cr columns do not exist yet (migration pending)
  if (error && error.message.includes('column users.branch does not exist')) {
    const fallbackSelect = isStudentViewer
      ? 'id, name, email, profile_photo_url, roll_no, section, branch, is_cr, last_seen_at, signup_info'
      : 'id, name, email, profile_photo_url, roll_no, section, semester, bio, last_seen_at, is_active';
      
    let fallbackQuery = supabaseAdmin.from('users').select(fallbackSelect).eq('role', 'student').eq('is_verified', true);
    if (isStudentViewer) fallbackQuery = fallbackQuery.eq('is_active', true);
    
    const fallbackRes = await fallbackQuery.order('name');
    data = fallbackRes.data as any;
    error = fallbackRes.error as any;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const withStatus = (data as unknown as UserRow[]).map(u => ({
    ...u,
    is_online: u.last_seen_at
      ? now - new Date(u.last_seen_at).getTime() < ONLINE_MS
      : false,
  })).sort((a, b) => {
    if (a.is_online && !b.is_online) return -1;
    if (!a.is_online && b.is_online) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ students: withStatus });
}
