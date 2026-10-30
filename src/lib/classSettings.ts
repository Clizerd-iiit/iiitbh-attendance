import { supabaseAdmin } from './supabase';

export interface ClassVerificationSettings {
  require_geofence: boolean;
  require_face: boolean;
  method?: 'qr' | 'otp' | 'kiosk' | 'manual';
}

export async function getClassSettings(classId: string): Promise<ClassVerificationSettings> {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', `class_cfg_${classId}`)
      .single();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return {
        require_geofence: parsed.require_geofence !== false,
        require_face: parsed.require_face !== false,
        method: parsed.method || 'otp',
      };
    }
  } catch (e) {
    console.warn(`Could not load settings for class ${classId}, using defaults`, e);
  }

  return { require_geofence: true, require_face: true, method: 'otp' };
}

export async function setClassSettings(classId: string, settings: ClassVerificationSettings): Promise<void> {
  try {
    await supabaseAdmin.from('system_settings').upsert({
      key: `class_cfg_${classId}`,
      value: JSON.stringify({
        require_geofence: !!settings.require_geofence,
        require_face: !!settings.require_face,
        method: settings.method || 'otp',
      }),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`Failed to save settings for class ${classId}:`, e);
  }
}
