import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getActiveDelegationsForCR,
  getDelegationsForTeacher,
  grantCRDelegation,
  updateCRDelegation,
} from '@/lib/delegation';

export const dynamic = 'force-dynamic';

// GET: CR gets their active delegations; teacher gets all their granted delegations (last 30 days)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user.userId || (session.user as any).id) as string;
  const role = session.user.role;

  // Auto-delete expired delegations from database so they are never retained
  try {
    await supabaseAdmin
      .from('cr_delegations')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch (err) {
    console.error('Error auto-cleaning expired CR delegations:', err);
  }

  if (role === 'student' && userId) {
    const { data: user } = await supabaseAdmin.from('users').select('is_cr').eq('id', userId).single();
    const is_cr = !!user?.is_cr;
    const delegations = await getActiveDelegationsForCR(userId);
    return NextResponse.json({ delegations, is_cr });
  }

  if ((role === 'teacher' || role === 'superadmin') && userId) {
    const delegations = await getDelegationsForTeacher(userId);
    return NextResponse.json({ delegations });
  }

  return NextResponse.json({ delegations: [] });
}

// POST: Teacher grants a time-limited delegation to a CR student for a subject
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Only teachers can grant CR delegation' }, { status: 403 });

  const userId = (session.user.userId || (session.user as any).id) as string;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { crUserId, subjectId, hours = 12, days = 0, note = '' } = body;

  if (!crUserId || !subjectId)
    return NextResponse.json({ error: 'crUserId and subjectId required' }, { status: 400 });

  // Verify this teacher owns the subject (teacher_ids array or teacher_id)
  const { data: subject } = await supabaseAdmin
    .from('subjects')
    .select('teacher_ids, teacher_id, name, code')
    .eq('id', subjectId)
    .single();

  const isTeacherAssigned =
    session.user.role === 'superadmin' ||
    subject?.teacher_ids?.includes(userId) ||
    subject?.teacher_id === userId;

  if (!isTeacherAssigned)
    return NextResponse.json({ error: 'This subject does not belong to you' }, { status: 403 });

  // Verify the target is a valid student
  const { data: crUser } = await supabaseAdmin
    .from('users')
    .select('id, name, is_cr, role')
    .eq('id', crUserId)
    .single();

  if (!crUser || crUser.role !== 'student')
    return NextResponse.json({ error: 'Selected user is not a student' }, { status: 400 });

  // Validate duration (1h minimum, 30 days maximum)
  const totalHours = Number(hours) + Number(days) * 24;
  if (totalHours <= 0 || totalHours > 720)
    return NextResponse.json({ error: 'Duration must be between 1 hour and 30 days' }, { status: 400 });

  try {
    const delegation = await grantCRDelegation({
      teacherId: userId,
      crUserId,
      subjectId,
      totalHours,
      note,
    });
    return NextResponse.json({ delegation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to grant delegation' }, { status: 500 });
  }
}

// PATCH: Teacher extends or revokes an existing delegation
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const userId = (session.user.userId || (session.user as any).id) as string;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { delegationId, hours, days, is_active, note } = body;

  if (!delegationId) return NextResponse.json({ error: 'delegationId required' }, { status: 400 });

  let totalHours: number | undefined = undefined;
  if (hours !== undefined || days !== undefined) {
    totalHours = Number(hours || 0) + Number(days || 0) * 24;
    if (totalHours <= 0) totalHours = undefined;
  }

  try {
    const delegation = await updateCRDelegation({
      delegationId,
      teacherId: userId,
      totalHours,
      isActive: is_active,
      note,
    });

    if (!delegation) return NextResponse.json({ error: 'Delegation not found or not owned by you' }, { status: 404 });
    return NextResponse.json({ delegation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update delegation' }, { status: 500 });
  }
}

// DELETE: Teacher revokes a delegation by setting is_active=false, or permanently purges it
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const userId = (session.user.userId || (session.user as any).id) as string;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { delegationId, permanent = false } = body;

  if (!delegationId) return NextResponse.json({ error: 'delegationId required' }, { status: 400 });

  try {
    if (permanent) {
      // Permanently remove the delegation entry from database
      await supabaseAdmin
        .from('cr_delegations')
        .delete()
        .eq('id', delegationId);

      return NextResponse.json({ success: true, deleted: true });
    }

    // Revoke delegation
    await updateCRDelegation({
      delegationId,
      teacherId: userId,
      isActive: false,
    });
    return NextResponse.json({ success: true, revoked: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to revoke/delete delegation' }, { status: 500 });
  }
}
