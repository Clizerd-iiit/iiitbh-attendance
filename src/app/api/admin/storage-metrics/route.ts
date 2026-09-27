import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Sizes in bytes (Estimates based on typical row size + Supabase JSONB overhead)
  const sizes = {
    users: 1536,             // Face descriptor (512B) + basic details
    attendance: 128,
    audit_logs: 256,
    enrollments: 64,
    subjects: 256,
    announcements: 512,
    polls: 1024,
    poll_votes: 64,
    notes_vault: 1024
  };

  const metrics: any = {};
  let totalEstimatedBytes = 0;

  for (const [table, bytesPerRow] of Object.entries(sizes)) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (!error && count !== null) {
      const tableBytes = count * bytesPerRow;
      metrics[table] = { count, bytes: tableBytes };
      totalEstimatedBytes += tableBytes;
    }
  }

  // Supabase free tier database limit is 500 MB (500 * 1024 * 1024 bytes)
  const MAX_BYTES = 500 * 1024 * 1024;
  
  return NextResponse.json({
    metrics,
    totalBytes: totalEstimatedBytes,
    maxBytes: MAX_BYTES,
    percentUsed: ((totalEstimatedBytes / MAX_BYTES) * 100).toFixed(4)
  });
}
