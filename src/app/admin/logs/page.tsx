"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { PhotoZoom } from '@/components/shared/PhotoZoom';
import { format } from 'date-fns';

interface LogUser {
  id: string; name: string; email: string;
  role: string; roll_no?: string; profile_photo_url?: string;
}
interface Log {
  id: string; action: string; table_name?: string;
  old_value?: Record<string, unknown>; new_value?: Record<string, unknown>;
  ip_address?: string; created_at: string; user?: LogUser;
}

// Admin-identity-hiding actions — show verified person's info, not admin's
const ADMIN_ACTIONS = new Set(['APPROVE_USER','REJECT_USER','DELETE_USER','CREATE_USER','UPDATE_USER']);

const actionLabel: Record<string, { label: string; color: string; icon: string; stealth?: boolean }> = {
  MARK_ATTENDANCE:   { label: 'Attendance Marked',  color: 'bg-green-100 text-green-700',   icon: '✅' },
  UPDATE_ATTENDANCE: { label: 'Attendance Updated', color: 'bg-yellow-100 text-yellow-700', icon: '✏️' },
  CREATE_USER:       { label: 'User Added',         color: 'bg-blue-100 text-blue-700',     icon: '➕', stealth: true },
  UPDATE_USER:       { label: 'User Updated',       color: 'bg-purple-100 text-purple-700', icon: '🔄', stealth: true },
  DELETE_USER:       { label: 'User Deleted',       color: 'bg-red-100 text-red-700',       icon: '🗑️', stealth: true },
  APPROVE_USER:      { label: 'Account Approved ✔️', color: 'bg-teal-100 text-teal-700',    icon: '✅', stealth: true },
  REJECT_USER:       { label: 'Account Rejected',  color: 'bg-red-100 text-red-600',       icon: '❌', stealth: true },
  PROFILE_SETUP:     { label: 'Profile Setup',      color: 'bg-indigo-100 text-indigo-700', icon: '👤' },
  CREATE_SUBJECT:    { label: 'Subject Created',    color: 'bg-indigo-100 text-indigo-700', icon: '📚' },
  UPDATE_SUBJECT:    { label: 'Subject Updated',    color: 'bg-orange-100 text-orange-700', icon: '📝' },
};

const roleLabel: Record<string, string> = {
  student: '🎓 Student', teacher: '👨‍🏫 Teacher', admin: '🔑 Admin',
};

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'superadmin';

  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [disabledByAdmin, setDisabledByAdmin] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 30;

  const fetchLogs = () => {
    fetch(`/api/admin/logs?limit=${limit}&offset=${offset}`)
      .then(r => r.json())
      .then(d => {
        if (d.disabled) { setDisabledByAdmin(true); setLogs([]); setTotal(0); }
        else { setDisabledByAdmin(false); setLogs(d.logs || []); setTotal(d.total || 0); }
      });
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [offset]);

  const deleteLog = async (id: string) => {
    if (!window.confirm('Delete this log entry?')) return;
    await fetch(`/api/admin/logs?id=${id}`, { method: 'DELETE' });
    fetchLogs();
  };

  const clearAllLogs = async () => {
    if (!window.confirm('Saare audit logs delete karo? Undo nahi hogi.')) return;
    await fetch('/api/admin/logs?all=true', { method: 'DELETE' });
    setOffset(0); fetchLogs();
  };

  // Get the "subject" person from new_value/old_value for stealth actions
  const getSubjectInfo = (log: Log) => {
    const nv = log.new_value || log.old_value || {};
    return {
      name:  (nv.name  as string) || null,
      email: (nv.email as string) || null,
      role:  (nv.role  as string) || null,
    };
  };

  const filtered = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.user?.name?.toLowerCase().includes(q) ||
      log.user?.email?.toLowerCase().includes(q) ||
      log.user?.roll_no?.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      JSON.stringify(log.new_value || {}).toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        {disabledByAdmin ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-8 rounded-2xl text-center shadow-sm max-w-lg mx-auto mt-10">
            <div className="text-4xl mb-3">⏸️</div>
            <h2 className="text-xl font-bold mb-2">Audit Logs Paused</h2>
            <p className="text-sm">The Admin has temporarily paused new audit log updates for your role.</p>
          </div>
        ) : (
          <>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">🔍 Activity Logs</h1>
            <p className="text-gray-400 text-xs mt-0.5">{total} total entries</p>
          </div>
          {isSuperAdmin && (
            <button onClick={clearAllLogs}
              className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-medium transition">
              🗑️ Clear All
            </button>
          )}
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, roll no, action…"
          className="w-full bg-white border rounded-xl px-4 py-2.5 mb-4 text-sm focus:outline-none focus:border-blue-400 shadow-sm"/>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-12 bg-white rounded-xl">No logs found</div>
          )}
          {filtered.map(log => {
            const act = actionLabel[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-600', icon: '📋', stealth: false };
            // STEALTH = actor is admin — hide their name/email/role for ALL actions
            const stealth   = log.user?.role === 'superadmin';
            const subj      = stealth ? getSubjectInfo(log) : null;
            const adminUser = stealth ? log.user : null;
            const actorUser = !stealth ? log.user : null;

            return (
              <div key={log.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-start gap-4 group hover:shadow-md transition">

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {stealth ? (
                    /* Admin photo with shield badge — photo shown, identity hidden */
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-200">
                        {adminUser?.profile_photo_url ? (
                          <PhotoZoom src={adminUser.profile_photo_url} alt="Admin" size={40}/>
                        ) : (
                          <div className="w-full h-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                            🛡️
                          </div>
                        )}
                      </div>
                      {/* Shield badge */}
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-white text-[8px] border border-white">
                        🛡
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100">
                        {actorUser?.profile_photo_url ? (
                          <PhotoZoom src={actorUser.profile_photo_url} alt={actorUser.name || ''} size={40}/>
                        ) : (
                          <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                            {actorUser?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      {actorUser?.role === 'teacher' && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px] border border-white">
                          🛡
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${act.color}`}>
                      {act.icon} {act.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>

                  {/* Stealth: "✅ Approved by Admin" label + verified person's info */}
                  {stealth && (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                        🛡️ <span>Action by Admin</span>
                      </p>
                      {subj?.name && (
                        <div className="flex flex-wrap gap-x-3 text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                          <span className="font-semibold text-gray-700">{subj.name}</span>
                          {subj.email && <span className="text-gray-400">{subj.email}</span>}
                          {subj.role && (
                            <span className={`font-medium ${
                              subj.role === 'teacher' ? 'text-green-600' :
                              subj.role === 'student' ? 'text-blue-600' : 'text-purple-600'
                            }`}>{roleLabel[subj.role] || subj.role}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Normal: show actor info */}
                  {!stealth && actorUser && (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs">
                      <span className="font-semibold text-gray-700">{actorUser.name}</span>
                      <span className="text-gray-400">{actorUser.email}</span>
                      {actorUser.role && <span className="text-gray-500">{roleLabel[actorUser.role] || actorUser.role}</span>}
                      {actorUser.roll_no && <span className="text-gray-500 font-mono">#{actorUser.roll_no}</span>}
                    </div>
                  )}

                  {/* Changes — non-stealth only */}
                  {!stealth && (log.new_value || log.old_value) && (
                    <div className="mt-1 text-xs text-gray-400 truncate max-w-xl">
                      {log.old_value && (
                        <span className="text-red-400 mr-2">
                          Before: {Object.entries(log.old_value)
                            .filter(([k]) => !['id','updated_at','created_at'].includes(k))
                            .map(([k,v]) => `${k}: ${v}`).join(' · ')}
                        </span>
                      )}
                      {log.new_value && (
                        <span className="text-green-600">
                          {log.old_value ? 'After: ' : ''}
                          {Object.entries(log.new_value)
                            .filter(([k]) => !['id','updated_at','created_at'].includes(k))
                            .map(([k,v]) => `${k}: ${v}`).join(' · ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isSuperAdmin && (
                  <button onClick={() => deleteLog(log.id)}
                    className="flex-shrink-0 text-gray-200 hover:text-red-400 transition opacity-0 group-hover:opacity-100 text-xl leading-none mt-0.5">
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {total > limit && (
          <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
            <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}
              className="px-4 py-1.5 bg-white border rounded-lg disabled:opacity-40 hover:bg-gray-50 transition">
              ← Previous
            </button>
            <span>{offset + 1}–{Math.min(offset + limit, total)} / {total}</span>
            <button disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}
              className="px-4 py-1.5 bg-white border rounded-lg disabled:opacity-40 hover:bg-gray-50 transition">
              Next →
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
