import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const { name, details } = await req.json();
    
    if (!name || !details) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const payload = {
      id: uuidv4(),
      name,
      details,
      date: new Date().toISOString(),
      status: 'pending'
    };

    // Store in system_settings using a unique key prefix
    await supabaseAdmin
      .from('system_settings')
      .insert({
        key: `issue_${payload.id}`,
        value: JSON.stringify(payload)
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error reporting issue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .like('key', 'issue_%');
      
    if (error) throw error;
    
    const issues = data.map(d => JSON.parse(d.value)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json(issues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('system_settings')
      .delete()
      .eq('key', `issue_${id}`);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
