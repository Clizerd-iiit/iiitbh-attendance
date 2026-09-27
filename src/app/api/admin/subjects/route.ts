import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';


const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  section: z.string().optional(),
  branch: z.string().optional(),
  semester: z.number().int().positive().optional(),
  teacher_ids: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional()
}).strict();

const subjectUpdateSchema = subjectSchema.partial().extend({
  id: z.string().uuid()
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin.from('subjects')
    .select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subjects: data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = subjectSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid input data', details: e.errors }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from('subjects').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ userId: session.user.userId!, action: 'CREATE_SUBJECT',
    tableName: 'subjects', recordId: data.id, newValue: body,
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown' });
  return NextResponse.json({ subject: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = subjectUpdateSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid input data', details: e.errors }, { status: 400 });
  }
  const { id, ...updates } = body;
  const { data: old } = await supabaseAdmin.from('subjects').select('*').eq('id', id).single();
  const { data, error } = await supabaseAdmin.from('subjects').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ userId: session.user.userId!, action: 'UPDATE_SUBJECT',
    tableName: 'subjects', recordId: id, oldValue: old, newValue: updates,
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown' });
  return NextResponse.json({ subject: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const { error } = await supabaseAdmin.from('subjects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ userId: session.user.userId!, action: 'DELETE_SUBJECT',
    tableName: 'subjects', recordId: id, newValue: { deleted: true },
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown' });
  return NextResponse.json({ success: true });
}
