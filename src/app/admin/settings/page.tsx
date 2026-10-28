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
  show_clear_all_data?: string;
  secondary_backup_webhook_url?: string;
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
    show_clear_all_data: 'false',
  });
  const [saved, setSaved] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const [storage, setStorage] = useState<any>(null);

  // Face ID Bulk Reset State
  const [showFaceResetModal, setShowFaceResetModal] = useState(false);
  const [resetBranch, setResetBranch] = useState('ALL');
  const [resetGroup, setResetGroup] = useState('ALL');
  const [facePreview, setFacePreview] = useState<{ totalMatched: number; studentsWithFace: number; sample?: any[] } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [resettingFaces, setResettingFaces] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState('');

  const fetchFacePreview = async (branch = resetBranch, group = resetGroup) => {
    setLoadingPreview(true);
    setResetErrorMsg('');
    try {
      const res = await fetch(`/api/admin/reset-face-ids?branch=${encodeURIComponent(branch)}&group=${encodeURIComponent(group)}`);
      const data = await res.json();
      if (res.ok) {
        setFacePreview(data);
      } else {
        setResetErrorMsg(data.error || 'Failed to fetch face preview');
      }
    } catch (e: any) {
      setResetErrorMsg(e.message || 'Error loading preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (showFaceResetModal) {
      fetchFacePreview(resetBranch, resetGroup);
    }
  }, [showFaceResetModal, resetBranch, resetGroup]);

  const handleExecuteFaceReset = async () => {
    if (confirmInput.trim() !== 'RESET') {
      alert('Please type RESET in capital letters to confirm.');
      return;
    }
    setResettingFaces(true);
    setResetErrorMsg('');
    setResetSuccessMsg('');
    try {
      const res = await fetch('/api/admin/reset-face-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: resetBranch,
          group: resetGroup,
          confirmText: 'RESET',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccessMsg(data.message || `Successfully reset Face IDs for ${data.count} students!`);
        setConfirmInput('');
        fetchFacePreview(resetBranch, resetGroup);
      } else {
        setResetErrorMsg(data.error || 'Failed to reset Face IDs');
      }
    } catch (e: any) {
      setResetErrorMsg(e.message || 'Error executing Face ID reset');
    } finally {
      setResettingFaces(false);
    }
  };

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
    if (typeof window !== 'undefined') {
      localStorage.setItem('show_clear_all_data', settings.show_clear_all_data || 'false');
      window.dispatchEvent(new Event('storage'));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const runTestWebhook = async () => {
    if (!settings.secondary_backup_webhook_url) {
      alert('Please enter a Webhook URL first.');
      return;
    }
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/backup/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: settings.secondary_backup_webhook_url }),
      });
      const d = await res.json();
      setTestResult(d);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Network error' });
    } finally {
      setTestingWebhook(false);
    }
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

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">Clear All Data Button</h3>
                  <p className="text-xs text-gray-700 mt-0.5">Show 'Clear All Data' in navigation sidebar</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, show_clear_all_data: settings.show_clear_all_data === 'true' ? 'false' : 'true'})}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.show_clear_all_data === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transition-all duration-300 ${settings.show_clear_all_data === 'true' ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

            </div>
          </div>

          {/* Secondary Backup Section */}
          <div className="mt-8 mb-6 border-t pt-6 border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span>🛡️</span> Immutable Secondary Attendance Backup
            </h2>
            <p className="text-xs text-gray-600 mb-4">
              Enter a free Google Apps Script Webhook URL (linked to your private Google Sheet) or custom backup endpoint. Every time a class is closed, the complete attendance ledger is automatically appended outside of Supabase. Even if a rogue teacher or admin deletes data from Supabase, your Google Sheet backup remains 100% safe, tamper-proof, and append-only.
            </p>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Backup Webhook URL (Google Apps Script / Webhook)</label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={settings.secondary_backup_webhook_url || ''}
                onChange={e => setSettings(s => ({ ...s, secondary_backup_webhook_url: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 font-mono text-gray-800 bg-gray-50 focus:bg-white transition"
              />
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={runTestWebhook}
                  disabled={testingWebhook || !settings.secondary_backup_webhook_url}
                  className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {testingWebhook ? '⏳ Testing Connection...' : '🧪 Test Connection with Google Sheet'}
                </button>
              </div>

              {testResult && (
                <div className={`mt-3 p-3.5 rounded-xl border text-xs font-medium animate-fadeIn ${testResult.success ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <span className="text-base">✅</span>
                      <span>{testResult.message || 'Connected successfully! 1 test row added to Google Sheet.'}</span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold flex items-center gap-1 text-red-900"><span className="text-base">❌</span> Connection Error:</p>
                      <p className="mt-1 font-mono text-[11px] bg-red-100/70 p-2 rounded-lg text-red-950 border border-red-200 break-all">{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 👤 Face ID Management (SuperAdmin Only) */}
          <div className="mt-8 mb-6 border-t pt-6 border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span>👤</span> Bulk Face ID Management
            </h2>
            <p className="text-xs text-gray-600 mb-4">
              Selectively purge and reset 3D facial descriptors for students across specific branches or classroom groups. Once reset, affected students can immediately re-register their Face ID.
            </p>
            <div className="bg-red-50 p-5 rounded-xl border border-red-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-red-900 text-base">Reset ALL Face IDs</h3>
                <p className="text-xs text-red-700 mt-1 max-w-md">
                  Choose specific Branch and Group to delete Face ID data with double confirmation safety lock.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowFaceResetModal(true);
                  setConfirmInput('');
                  setResetSuccessMsg('');
                  setResetErrorMsg('');
                }}
                className="bg-white hover:bg-red-50 text-red-700 font-bold px-5 py-2.5 rounded-xl shadow-sm border border-red-200 transition active:scale-95 text-xs flex items-center gap-2 whitespace-nowrap cursor-pointer">
                <span>🗑️</span> Reset ALL Face IDs
              </button>
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

        {/* Bulk Reset Face ID Modal */}
        {showFaceResetModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2 text-red-600">
                  <span className="text-xl">👤</span>
                  <h3 className="text-base font-black text-gray-900">Reset Student Face IDs</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFaceResetModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                >
                  ✕
                </button>
              </div>

              {resetSuccessMsg ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                    <p className="font-bold flex items-center gap-2"><span>✅</span> Operation Successful!</p>
                    <p className="text-xs mt-1">{resetSuccessMsg}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFaceResetModal(false);
                      setResetSuccessMsg('');
                    }}
                    className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl text-xs hover:bg-black transition cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Select Branch</label>
                      <select
                        value={resetBranch}
                        onChange={e => setResetBranch(e.target.value)}
                        className="w-full bg-gray-50 text-gray-900 font-bold border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-500"
                      >
                        <option value="ALL">All Branches</option>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="MNC">MNC</option>
                        <option value="MAE">MAE</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Select Group</label>
                      <select
                        value={resetGroup}
                        onChange={e => setResetGroup(e.target.value)}
                        className="w-full bg-gray-50 text-gray-900 font-bold border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-500"
                      >
                        <option value="ALL">All Groups</option>
                        <option value="G1">Group 1 (G1)</option>
                        <option value="G2">Group 2 (G2)</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Target Counter Preview */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                    {loadingPreview ? (
                      <p className="flex items-center gap-2 font-medium"><span>⏳</span> Counting target students...</p>
                    ) : facePreview ? (
                      <div>
                        <p className="font-bold flex items-center gap-1.5 text-amber-950">
                          <span>⚡</span>
                          <span>
                            {facePreview.studentsWithFace} student(s) with active Face ID found
                          </span>
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Total students matching filter: {facePreview.totalMatched}
                        </p>
                        {facePreview.sample && facePreview.sample.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-amber-200/60 text-[10px] text-amber-900">
                            <span className="font-bold">Sample preview: </span>
                            {facePreview.sample.map((s: any) => `${s.name} (${s.roll_no || s.branch})`).join(', ')}
                            {facePreview.studentsWithFace > 5 ? ` and ${facePreview.studentsWithFace - 5} more...` : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>Select a branch and group to view targets</p>
                    )}
                  </div>

                  {/* Warning Box */}
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs">
                    <p className="font-bold flex items-center gap-1.5"><span>⚠️</span> Warning: Irreversible Action</p>
                    <p className="mt-1 text-[11px] text-red-800 leading-relaxed">
                      This will permanently wipe facial descriptors and reset 30-day registration limits for all selected students. They will be required to re-register their face before marking face-protected attendance.
                    </p>
                  </div>

                  {/* Double Confirmation Input */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Type <span className="font-black text-red-600 bg-red-100 px-1 py-0.5 rounded">RESET</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={confirmInput}
                      onChange={e => setConfirmInput(e.target.value)}
                      placeholder="Type RESET"
                      className="w-full border-2 border-gray-200 focus:border-red-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 outline-none uppercase placeholder:normal-case transition"
                    />
                  </div>

                  {resetErrorMsg && (
                    <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-200">
                      ❌ {resetErrorMsg}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFaceResetModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteFaceReset}
                      disabled={confirmInput.trim() !== 'RESET' || resettingFaces || (facePreview?.studentsWithFace === 0)}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 active:scale-95 cursor-pointer"
                    >
                      {resettingFaces ? '⏳ Resetting...' : 'Confirm & Reset'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
