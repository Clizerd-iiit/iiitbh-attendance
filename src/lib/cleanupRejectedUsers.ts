import { supabaseAdmin } from './supabase';

export async function cleanupRejectedUsers() {
  try {
    // 48 hours ago
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: rejectedUsers, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('verification_status', 'rejected')
      .lt('verified_at', fortyEightHoursAgo);

    if (error || !rejectedUsers || rejectedUsers.length === 0) return;

    console.log(`Found ${rejectedUsers.length} rejected users older than 48 hours. Deleting...`);

    for (const user of rejectedUsers) {
      // Delete from auth.users (this triggers cascading deletes to public.users and other tables if configured)
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (authError) {
        console.error(`Error deleting auth user ${user.id}:`, authError);
      }
      // Explicitly delete from public.users as fallback
      await supabaseAdmin.from('users').delete().eq('id', user.id);
    }
  } catch (err) {
    console.error('Error in cleanupRejectedUsers:', err);
  }
}
