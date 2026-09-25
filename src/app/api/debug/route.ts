import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data: students, error: err1 } = await supabaseAdmin.from('users')
    .select('*')
    .eq('role', 'student')
    .eq('is_verified', true)
    .eq('is_active', true);
  
  const { data: teachers, error: err2 } = await supabaseAdmin.from('users')
    .select('id, name, email, bio, profile_photo_url, signup_info, last_seen_at, subjects(name, code, enrollments(id, student_id))')
    .eq('role', 'teacher')
    .eq('is_verified', true)
    .eq('is_active', true);

  return NextResponse.json({ students, err1, teachers, err2 });
}
