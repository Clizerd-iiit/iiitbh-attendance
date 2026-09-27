'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';

interface Settings {
  show_student_attendance_percentage?: string;
  attendance_threshold: string;
  allowed_email_domain: string;
  qr_expiry_seconds: string;
  otp_expiry_minutes: string;
  teacher_edit_window_days: string;
  attendance_mark_window_minutes: string;
  share_logs_with_teachers?: string;
  share_logs_with_students?: string;
  qr_refresh_interval?: string;
  otp_refresh_interval?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    attendance_threshold: '75',
    allowed_email_domain: 'iiitbh.ac.in',
    qr_expiry_seconds: '60',
    otp_expiry_minutes: '2',
    teacher_edit_window_days: '5',
    qr_refresh_interval: '60',
    otp_refresh_interval: '60',
    attendance_mark_window_minutes: '30',
    share_logs_with_teachers: 'true',
    share_logs_with_students: 'true',
  });
  const [saved, setSaved] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const [storage, setStorage] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/admin/settings');
      const d = await res.json();
      if (d.settings) setSettings(prev => ({ ...prev, ...d.settings }));

      // Fetch storage metrics
      const stRes = await fetch('/api/admin/storage-metrics');
      if (stRes.ok) {
        setStorage(await stRes.json());
      }
    };
    fetchData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const runCleanup = async () => {
    if (!confirm("Run Storage Garbage Collection? This will delete old logs, expired announcements, and closed polls to save Supabase space.")) return;
    setCleaning(true);
    const res = await fetch('/api/admin/cleanup', { method: 'POST' });
    const data = await res.json();
    setCleaning(false);
    if (res.ok) alert(data.message + "\nEstimated Free Space: " + data.freedSpace);
    else alert("Error: " + data.error);
  };

  const save = async () => {
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fields = [
    { key: 'attendance_threshold', label: 'Attendance Threshold (%)', type: 'number', desc: 'Minimum % required (default 75)' },
    { key: 'allowed_email_domain', label: 'Allowed Email Domain', type: 'text', desc: 'e.g. iiitbh.ac.in' },
    { key: 'qr_expiry_seconds', label: 'QR Code Expiry (seconds)', type: 'number', desc: 'How long QR is valid (default 60s)' },
    { key: 'otp_expiry_minutes', label: 'OTP Expiry (minutes)', type: 'number', desc: 'How long OTP is valid (default 2 min)' },
    { key: 'teacher_edit_window_days', label: 'Teacher Edit Window (days)', type: 'number', desc: 'Days teacher can edit past attendance (default 30)' },
    { key: 'qr_refresh_interval', label: 'Default QR Refresh (seconds)', type: 'number', desc: 'Global default for QR Code auto-refresh' },
    { key: 'otp_refresh_interval', label: 'Default OTP Refresh (seconds)', type: 'number', desc: 'Global default for OTP auto-refresh' },
    { key: 'attendance_mark_window_minutes', label: 'Mark Window After Class (minutes)', type: 'number', desc: 'Time students can mark after class starts (default 30)' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">⚙️ System Settings</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-800 mb-1">{field.label}</label>
              <input type={field.type}
                value={(settings as unknown as Record<string, string>)[field.key] || ''}
                onChange={e => setSettings(prev => ({...prev, [field.key]: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"/>
              <p className="text-xs text-gray-700 mt-1">{field.desc}</p>
            </div>
          ))}


          <div className="mt-8 mb-6 border-t pt-6 border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Audit Log Visibility</h2>
            <div className="grid gap-6 md:grid-cols-2">
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">Teachers Logs</h3>
                  <p className="text-xs text-gray-700 mt-0.5">Send updates to teachers</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, share_logs_with_teachers: settings.share_logs_with_teachers === 'true' ? 'false' : 'true'})}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.share_logs_with_teachers === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transition-all duration-300 ${settings.share_logs_with_teachers === 'true' ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">Students Logs</h3>
                  <p className="text-xs text-gray-700 mt-0.5">Send updates to students</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, share_logs_with_students: settings.share_logs_with_students === 'true' ? 'false' : 'true'})}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.share_logs_with_students === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transition-all duration-300 ${settings.share_logs_with_students === 'true' ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">Student Attendance %</h3>
                  <p className="text-xs text-gray-700 mt-0.5">Show attendance % on student dashboard</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, show_student_attendance_percentage: settings.show_student_attendance_percentage === 'false' ? 'true' : 'false'})}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.show_student_attendance_percentage !== 'false' ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transition-all duration-300 ${settings.show_student_attendance_percentage !== 'false' ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

            </div>
          </div>

          <div className="mt-8 mb-6 border-t pt-6 border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Storage & Maintenance</h2>
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900 text-lg">Garbage Collection</h3>
                <p className="text-sm text-blue-700 mt-1 max-w-md">
                  Clean up expired announcements, old audit logs (30+ days), closed polls, and wipe expired QR/OTP tokens from closed classes to free up Supabase database rows.
                </p>
              </div>
              <button 
                onClick={runCleanup} disabled={cleaning}
                className="bg-white text-blue-700 font-bold px-6 py-3 rounded-xl shadow-sm border border-blue-200 hover:bg-blue-100 transition disabled:opacity-70">
                {cleaning ? 'Cleaning...' : '🧹 Run Cleanup'}
              </button>
            </div>
          </div>

          <button onClick={save}
            className={`w-full py-3 rounded-xl font-semibold transition ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {saved ? '✅ Saved!' : 'Save Settings'}
          </button>
        </div>

        {/* Supabase Storage Dashboard */}
        {storage && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              🗄️ Supabase Database Storage
            </h2>
            
            <div className="mb-6">
              <div className="flex justify-between text-sm font-medium mb-2">
                <span className="text-gray-700">Estimated Usage</span>
                <span className="text-gray-800">{formatBytes(storage.totalBytes)} / {formatBytes(storage.maxBytes)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full ${parseFloat(storage.percentUsed) > 80 ? 'bg-red-500' : parseFloat(storage.percentUsed) > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.max(0.5, parseFloat(storage.percentUsed))}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-700 mt-2 text-right">{storage.percentUsed}% used (Free Tier Limit: 500 MB)</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(storage.metrics).sort((a: any, b: any) => b[1].bytes - a[1].bytes).map(([table, data]: any) => (
                <div key={table} className="bg-gray-50 p-4 rounded-xl border">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">{table.replace('_', ' ')}</div>
                  <div className="text-lg font-bold text-gray-800">{data.count} <span className="text-sm font-medium text-gray-700">rows</span></div>
                  <div className="text-xs text-blue-600 font-medium mt-1">~ {formatBytes(data.bytes)}</div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-700 mt-6 text-center italic">
              Note: This is an estimated usage based on typical data sizes per row + vector embeddings. Exact physical storage may vary slightly due to Postgres indexing.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
