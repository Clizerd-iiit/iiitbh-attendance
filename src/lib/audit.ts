import { supabaseAdmin } from './supabase';

export async function logAudit(params: {
  userId: string;
  action: string;
  tableName?: string;
  recordId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
}) {
  // Auto cleanup logs older than 10 days in the background
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  supabaseAdmin.from('audit_logs').delete().lt('created_at', tenDaysAgo.toISOString()).then();

  await supabaseAdmin.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_value: params.oldValue,
    new_value: params.newValue,
    ip_address: params.ipAddress,
  });
}

export async function canTeacherEditAttendance(classDate: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'teacher_edit_window_days')
    .single();

  const windowDays = parseInt(data?.value || '5');
  const classDateObj = new Date(classDate);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - classDateObj.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays <= windowDays;
}
