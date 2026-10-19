import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface CRDelegation {
  id: string;
  teacher_id: string;
  cr_user_id: string;
  subject_id: string;
  granted_at: string;
  expires_at: string;
  is_active: boolean;
  granted_hours: number;
  note?: string | null;
  created_at: string;
  updated_at: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
    branch?: string;
    section?: string;
  } | null;
  teacher?: {
    id: string;
    name: string;
    email: string;
  } | null;
  cr?: {
    id: string;
    name: string;
    email: string;
    roll_no?: string;
    branch?: string;
    section?: string;
    signup_info?: any;
  } | null;
}

/**
 * Fetch all delegations from system_settings fallback storage
 */
async function getFallbackDelegations(): Promise<CRDelegation[]> {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .like('key', 'cr_del_%');

  if (error || !data) return [];
  const list: CRDelegation[] = [];
  for (const row of data) {
    try {
      if (row.value) list.push(JSON.parse(row.value));
    } catch (e) {}
  }
  return list;
}

/**
 * Save a delegation into system_settings fallback storage
 */
async function saveFallbackDelegation(del: CRDelegation) {
  await supabaseAdmin.from('system_settings').upsert({
    key: `cr_del_${del.id}`,
    value: JSON.stringify(del),
    updated_at: new Date().toISOString(),
  });
}

/**
 * Enrich raw delegations with subject and user info
 */
async function enrichDelegations(rawList: any[]): Promise<CRDelegation[]> {
  if (rawList.length === 0) return [];

  const subjectIds = Array.from(new Set(rawList.map(d => d.subject_id).filter(Boolean)));
  const userIds = Array.from(
    new Set([...rawList.map(d => d.teacher_id), ...rawList.map(d => d.cr_user_id)].filter(Boolean))
  );

  const [subjectsRes, usersRes] = await Promise.all([
    subjectIds.length > 0
      ? supabaseAdmin.from('subjects').select('id, name, code, branch, section').in('id', subjectIds)
      : { data: [] },
    userIds.length > 0
      ? supabaseAdmin.from('users').select('id, name, email, roll_no, branch, section, signup_info').in('id', userIds)
      : { data: [] },
  ]);

  const subjectMap = new Map((subjectsRes.data || []).map((s: any) => [s.id, s]));
  const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));

  return rawList.map(d => ({
    ...d,
    subjects: subjectMap.get(d.subject_id) || null,
    teacher: userMap.get(d.teacher_id) || null,
    cr: userMap.get(d.cr_user_id) || null,
  }));
}

/**
 * Get active, non-expired delegations for a given CR student
 */
export async function getActiveDelegationsForCR(crUserId: string): Promise<CRDelegation[]> {
  const nowIso = new Date().toISOString();

  // Try DB table first
  const { data, error } = await supabaseAdmin
    .from('cr_delegations')
    .select('*')
    .eq('cr_user_id', crUserId)
    .eq('is_active', true)
    .gt('expires_at', nowIso)
    .order('granted_at', { ascending: false });

  if (!error && data) {
    return enrichDelegations(data);
  }

  // Fallback to system_settings
  const allFallback = await getFallbackDelegations();
  const filtered = allFallback.filter(
    d => d.cr_user_id === crUserId && d.is_active && new Date(d.expires_at) > new Date()
  );
  return enrichDelegations(filtered);
}

/**
 * Get all delegations granted by a teacher in the last 30 days
 */
export async function getDelegationsForTeacher(teacherId: string): Promise<CRDelegation[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Try DB table first
  const { data, error } = await supabaseAdmin
    .from('cr_delegations')
    .select('*')
    .eq('teacher_id', teacherId)
    .gt('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return enrichDelegations(data);
  }

  // Fallback to system_settings
  const allFallback = await getFallbackDelegations();
  const filtered = allFallback.filter(
    d => d.teacher_id === teacherId && new Date(d.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  return enrichDelegations(filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
}

/**
 * Grant a new delegation to a CR student
 */
export async function grantCRDelegation(params: {
  teacherId: string;
  crUserId: string;
  subjectId: string;
  totalHours: number;
  note?: string;
}): Promise<CRDelegation> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.totalHours * 60 * 60 * 1000).toISOString();
  const id = uuidv4();

  const record: CRDelegation = {
    id,
    teacher_id: params.teacherId,
    cr_user_id: params.crUserId,
    subject_id: params.subjectId,
    granted_at: now.toISOString(),
    expires_at: expiresAt,
    is_active: true,
    granted_hours: params.totalHours,
    note: params.note || null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Try DB table
  const { data, error } = await supabaseAdmin
    .from('cr_delegations')
    .insert(record)
    .select()
    .single();

  if (!error && data) {
    const [enriched] = await enrichDelegations([data]);
    return enriched;
  }

  // Deactivate existing fallback delegations for same combo
  const allFallback = await getFallbackDelegations();
  for (const del of allFallback) {
    if (del.teacher_id === params.teacherId && del.cr_user_id === params.crUserId && del.subject_id === params.subjectId && del.is_active) {
      del.is_active = false;
      del.updated_at = now.toISOString();
      await saveFallbackDelegation(del);
    }
  }

  await saveFallbackDelegation(record);
  const [enriched] = await enrichDelegations([record]);
  return enriched;
}

/**
 * Update/extend/revoke a delegation
 */
export async function updateCRDelegation(params: {
  delegationId: string;
  teacherId: string;
  totalHours?: number;
  isActive?: boolean;
  note?: string;
}): Promise<CRDelegation | null> {
  const now = new Date();
  const updates: Record<string, any> = { updated_at: now.toISOString() };

  if (params.isActive !== undefined) {
    updates.is_active = params.isActive;
  }

  if (params.totalHours !== undefined && params.totalHours > 0) {
    updates.expires_at = new Date(now.getTime() + params.totalHours * 60 * 60 * 1000).toISOString();
    updates.granted_hours = params.totalHours;
    updates.is_active = true;
  }

  if (params.note !== undefined) {
    updates.note = params.note;
  }

  // Try DB table
  const { data, error } = await supabaseAdmin
    .from('cr_delegations')
    .update(updates)
    .eq('id', params.delegationId)
    .eq('teacher_id', params.teacherId)
    .select()
    .single();

  if (!error && data) {
    const [enriched] = await enrichDelegations([data]);
    return enriched;
  }

  // Fallback to system_settings
  const allFallback = await getFallbackDelegations();
  const target = allFallback.find(d => d.id === params.delegationId && d.teacher_id === params.teacherId);
  if (!target) return null;

  Object.assign(target, updates);
  await saveFallbackDelegation(target);
  const [enriched] = await enrichDelegations([target]);
  return enriched;
}

/**
 * Check if a student has an active delegation for a subject
 */
export async function hasActiveDelegationForSubject(studentId: string, subjectId: string): Promise<boolean> {
  const activeList = await getActiveDelegationsForCR(studentId);
  return activeList.some(d => d.subject_id === subjectId && d.is_active && new Date(d.expires_at) > new Date());
}

/**
 * Check if a class was created by CR or belongs to a delegated subject
 */
export async function canCREditClass(studentId: string, classId: string): Promise<boolean> {
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('created_by, subject_id')
    .eq('id', classId)
    .single();

  if (!cls) return false;

  // CR can ONLY edit classes that THEY created
  if (cls.created_by !== studentId) return false;

  // And their delegation for that subject must still be active
  return hasActiveDelegationForSubject(studentId, cls.subject_id);
}
