'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { useSession } from 'next-auth/react';

interface FlaggedStudent {
  id: string;
  name: string;
  email: string;
  roll_no: string;
  branch: string;
  section: string;
  warnings: number;
  is_suspended: boolean;
  suspended_at?: string | null;
  last_proxy_at?: string | null;
  last_seen_at?: string | null;
}

interface IncidentLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  new_value?: any;
  ip_address?: string;
  created_at: string;
}

export default function ProxyShieldPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'superadmin';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'logs'>('students');
  const [stats, setStats] = useState({
    totalIncidents: 0,
    level1Count: 0,
    level2Count: 0,
    suspendedCount: 0,
    totalFlaggedStudents: 0,
  });
  const [students, setStudents] = useState<FlaggedStudent[]>([]);
  const [logs, setLogs] = useState<IncidentLog[]>([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [warningFilter, setWarningFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/proxyshield');
      const data = await res.json();
      if (data.stats) setStats(data.stats);
      if (data.flaggedStudents) setStudents(data.flaggedStudents);
      if (data.logs) setLogs(data.logs);
    } catch (e) {
      console.error('Failed to load ProxyShield data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (action: 'reset_warnings' | 'unsuspend' | 'suspend', studentId: string, studentName: string) => {
    let confirmMsg = '';
    if (action === 'reset_warnings') confirmMsg = `Are you sure you want to reset all proxy warnings to 0 for ${studentName}?`;
    if (action === 'unsuspend') confirmMsg = `Unsuspend ${studentName} and restore their account access?`;
    if (action === 'suspend') confirmMsg = `Permanently suspend ${studentName}'s account for proxy fraud?`;

    if (!confirm(confirmMsg)) return;

    setActionLoading(studentId);
    try {
      const res = await fetch('/api/admin/proxyshield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Action executed successfully');
        fetchData();
      } else {
        alert(data.error || 'Failed to execute action');
      }
    } catch (e) {
      alert('Network error executing action');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.roll_no.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q);

    const matchesBranch = branchFilter === 'ALL' || s.branch.toUpperCase() === branchFilter.toUpperCase();

    let matchesWarning = true;
    if (warningFilter === '1') matchesWarning = s.warnings === 1 && !s.is_suspended;
    if (warningFilter === '2') matchesWarning = s.warnings === 2 && !s.is_suspended;
    if (warningFilter === '3') matchesWarning = s.is_suspended || s.warnings >= 3;

    return matchesSearch && matchesBranch && matchesWarning;
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 border border-indigo-800/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Anti-Proxy Defense
                </span>
                <span className="text-xs text-slate-400">Policy: 3-Strike Rule</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                🛡️ ProxyShield Security Center
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Monitors shared-device fraud, tracks automated strikes (1 to 3 warnings), and enforces automatic suspension when a device marks attendance for multiple accounts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition border border-white/10 flex items-center gap-2"
              >
                <span>🔄</span> Refresh Logs
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-indigo-900/50">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Flagged Incidents</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">{stats.totalIncidents}</p>
              <p className="text-[11px] text-indigo-300 mt-1">Multi-account attempts</p>
            </div>

            <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20">
              <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Warning 1/3 (Active)</p>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{stats.level1Count}</p>
              <p className="text-[11px] text-amber-200/70 mt-1">First-time offenders</p>
            </div>

            <div className="bg-orange-500/10 rounded-2xl p-4 border border-orange-500/20">
              <p className="text-xs font-bold text-orange-300 uppercase tracking-wider">Warning 2/3 (Danger)</p>
              <p className="text-2xl sm:text-3xl font-black text-orange-400 mt-1">{stats.level2Count}</p>
              <p className="text-[11px] text-orange-200/70 mt-1">1 strike before suspension</p>
            </div>

            <div className="bg-rose-500/10 rounded-2xl p-4 border border-rose-500/20">
              <p className="text-xs font-bold text-rose-300 uppercase tracking-wider">Suspended Accounts (3/3)</p>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">{stats.suspendedCount}</p>
              <p className="text-[11px] text-rose-200/70 mt-1">Locked out of system</p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-3 font-bold text-sm transition relative ${activeTab === 'students' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            👥 Flagged Students ({filteredStudents.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 font-bold text-sm transition relative ${activeTab === 'logs' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            📜 Real-Time Security Logs ({logs.length})
          </button>
        </div>

        {activeTab === 'students' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Filters Bar */}
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 items-center justify-between bg-gray-50/50">
              <div className="relative w-full md:w-80">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search student, roll no, email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
                >
                  <option value="ALL">All Branches</option>
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="MEA">MEA</option>
                  <option value="DSA">DSA</option>
                </select>

                <select
                  value={warningFilter}
                  onChange={e => setWarningFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
                >
                  <option value="ALL">All Warning Levels</option>
                  <option value="1">Warning 1 of 3</option>
                  <option value="2">Warning 2 of 3</option>
                  <option value="3">Suspended (3 of 3)</option>
                </select>
              </div>
            </div>

            {/* Students Table */}
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading ProxyShield records...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <h3 className="font-bold text-gray-800 text-lg">No Flagged Students Found</h3>
                <p className="text-sm text-gray-500 mt-1">All students are in full compliance with no active proxy warnings.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[11px] tracking-wider border-b">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Roll & Branch</th>
                      <th className="px-5 py-3">Strike Status</th>
                      <th className="px-5 py-3">Last Violation</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map(student => {
                      const isSuspended = student.is_suspended || student.warnings >= 3;
                      return (
                        <tr key={student.id} className="hover:bg-gray-50/80 transition">
                          <td className="px-5 py-4">
                            <p className="font-bold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-mono font-bold text-gray-800">{student.roll_no}</p>
                            <p className="text-xs text-gray-500">{student.branch} {student.section !== '—' ? `• Sec ${student.section}` : ''}</p>
                          </td>

                          <td className="px-5 py-4">
                            {isSuspended ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                                🚨 SUSPENDED (3/3)
                              </span>
                            ) : student.warnings === 2 ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-200">
                                ⚠️ Warning 2 of 3 (Danger)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                                ⚠️ Warning 1 of 3
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs text-gray-600">
                            {student.last_proxy_at ? new Date(student.last_proxy_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}
                          </td>

                          <td className="px-5 py-4 text-right space-x-2">
                            {isSuspended ? (
                              <button
                                onClick={() => handleAction('unsuspend', student.id, student.name)}
                                disabled={actionLoading === student.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                              >
                                {actionLoading === student.id ? 'Processing...' : '🔓 Unsuspend'}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAction('reset_warnings', student.id, student.name)}
                                  disabled={actionLoading === student.id}
                                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition"
                                  title="Reset warning counter to 0"
                                >
                                  {actionLoading === student.id ? '...' : '🔄 Reset'}
                                </button>
                                <button
                                  onClick={() => handleAction('suspend', student.id, student.name)}
                                  disabled={actionLoading === student.id}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition"
                                  title="Manually suspend this student immediately"
                                >
                                  ⛔ Suspend
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm">Security Audit Trail (Last 100 Proxy Detections)</h3>
              <span className="text-xs text-gray-500 font-mono">Real-time Stream</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading audit trail...</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">No proxy detection logs recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {logs.map(log => {
                  const val = log.new_value || {};
                  const isSuspension = log.action === 'STUDENT_SUSPENDED_PROXY_FRAUD';
                  return (
                    <div key={log.id} className="p-4 hover:bg-gray-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isSuspension ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800'}`}>
                            {isSuspension ? '🚨 ACCOUNT SUSPENDED' : '⚠️ PROXY FLAGGED'}
                          </span>
                          <span className="font-bold text-gray-900">{val.studentName || 'Student'}</span>
                          {val.rollNo && <span className="font-mono text-xs text-gray-500">({val.rollNo})</span>}
                          {val.branch && <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.2 rounded font-semibold">{val.branch}</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Strike Level: <strong className="text-gray-900">{val.warningCount || 1} of 3</strong> • Device ID: <code className="bg-gray-100 px-1 rounded text-gray-700">{String(val.deviceToken || 'N/A').slice(0, 30)}...</code>
                        </p>
                      </div>

                      <div className="text-right text-xs text-gray-500">
                        <p className="font-mono">{log.ip_address || 'IP N/A'}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
