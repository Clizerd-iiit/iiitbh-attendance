import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let deletedRows = 0;
    const now = new Date().toISOString();

    // 1. Delete Expired Announcements
    const { count: annCount, error: annErr } = await supabaseAdmin
      .from('announcements')
      .delete({ count: 'exact' })
      .lt('expires_at', now);
    if (!annErr && annCount) deletedRows += annCount;

    // 2. Delete Audit Logs older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: auditCount, error: auditErr } = await supabaseAdmin
      .from('audit_logs')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo);
    if (!auditErr && auditCount) deletedRows += auditCount;

    // 3. Clear QR/OTP from closed classes to save string storage
    const { data: closedClasses } = await supabaseAdmin
      .from('classes')
      .update({ qr_code: 'CLEARED', otp: 'CLEARED' })
      .eq('status', 'closed')
      .neq('qr_code', 'CLEARED')
      .select('id');
    if (closedClasses) deletedRows += closedClasses.length;

    // 4. Delete old closed polls (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldPolls } = await supabaseAdmin
      .from('polls')
      .select('id')
      .eq('status', 'closed')
      .lt('created_at', sevenDaysAgo);
      
    if (oldPolls && oldPolls.length > 0) {
      const pollIds = oldPolls.map(p => p.id);
      // Delete votes first (though cascade might handle it)
      await supabaseAdmin.from('poll_votes').delete().in('poll_id', pollIds);
      const { count: pollCount } = await supabaseAdmin.from('polls').delete({ count: 'exact' }).in('id', pollIds);
      if (pollCount) deletedRows += pollCount;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleaned up ${deletedRows} old records! Storage Optimized.`,
      freedSpace: `${(deletedRows * 1.5).toFixed(2)} KB` // Approx estimate
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
