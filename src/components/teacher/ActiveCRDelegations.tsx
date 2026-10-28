'use client';

import { useState, useMemo } from 'react';
import { ShieldCheck, Clock, Calendar, AlertTriangle, RefreshCw, Trash2, Edit3, X } from 'lucide-react';
import type { CRDelegation } from '@/lib/delegation';

interface ActiveCRDelegationsProps {
  delegations: CRDelegation[];
  onRefresh: () => void;
  loading?: boolean;
}

export function ActiveCRDelegations({ delegations, onRefresh, loading = false }: ActiveCRDelegationsProps) {
  const [editingDelegation, setEditingDelegation] = useState<CRDelegation | null>(null);
  const [editDuration, setEditDuration] = useState<number>(12);
  const [editUnit, setEditUnit] = useState<'hours' | 'days'>('hours');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Filter out expired delegations so only non-expired entries show; active first, then revoked
  const sortedDelegations = useMemo(() => {
    return delegations
      .filter(d => !deletedIds.has(d.id) && new Date(d.expires_at) > new Date())
      .sort((a, b) => {
        const aActive = a.is_active;
        const bActive = b.is_active;
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [delegations, deletedIds]);

  const activeCount = useMemo(() => {
    return delegations.filter(d => !deletedIds.has(d.id) && d.is_active && new Date(d.expires_at) > new Date()).length;
  }, [delegations, deletedIds]);

  const handleRevoke = async (del: CRDelegation) => {
    const studentName = del.cr?.name || 'CR';
    const subjectName = del.subjects?.name || 'Subject';
    if (!confirm(`Are you sure you want to REVOKE take attendance permission for ${studentName} on ${subjectName}?`)) {
      return;
    }

    setActionId(del.id);
    try {
      const res = await fetch('/api/cr-delegation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegationId: del.id, permanent: false }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to revoke delegation');
      }
    } catch (e) {
      alert('Error revoking delegation');
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDelete = async (del: CRDelegation) => {
    const studentName = del.cr?.name || 'CR';
    const subjectName = del.subjects?.name || 'Subject';
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE this record for ${studentName} (${subjectName}) from your dashboard?`)) {
      return;
    }

    setActionId(del.id);
    try {
      const res = await fetch('/api/cr-delegation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegationId: del.id, permanent: true }),
      });
      if (res.ok) {
        setDeletedIds(prev => new Set(prev).add(del.id));
        onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete delegation');
      }
    } catch (e) {
      alert('Error deleting delegation');
    } finally {
      setActionId(null);
    }
  };

  const handleUpdateDuration = async () => {
    if (!editingDelegation) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cr-delegation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegationId: editingDelegation.id,
          hours: editUnit === 'hours' ? editDuration : 0,
          days: editUnit === 'days' ? editDuration : 0,
        }),
      });

      if (res.ok) {
        setEditingDelegation(null);
        onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update duration');
      }
    } catch (e) {
      alert('Error updating duration');
    } finally {
      setSubmitting(false);
    }
  };

  if (delegations.length === 0 && !loading) {
    return null; // Don't clutter UI if teacher has never granted delegation
  }

  return (
    <div className="bg-white dark:bg-[#231b16] rounded-2xl shadow-sm border border-gray-200 dark:border-[#3d3026] p-5 sm:p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#3d3026] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-lg shadow-sm">
            🎖️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">Active CR Delegations</h3>
              {activeCount > 0 && (
                <span className="bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700 text-xs px-2 py-0.5 rounded-full font-black animate-pulse">
                  {activeCount} Active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-semibold">Aapke dwara CR ko diye gaye active & recent permissions</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50"
          title="Refresh Delegations"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      {sortedDelegations.length === 0 ? (
        <div className="py-6 text-center text-xs font-bold text-gray-500 dark:text-gray-400">No active delegations. Expired entries are automatically cleaned up.</div>
      ) : (
        <div className="space-y-3">
          {sortedDelegations.map(del => {
            const isExpired = new Date(del.expires_at) <= new Date();
            const isActive = del.is_active && !isExpired;

            // Calculate remaining time
            const diffMs = new Date(del.expires_at).getTime() - Date.now();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            const sBranch = del.cr?.signup_info?.branch || del.cr?.branch || '';
            const sGroup = del.cr?.signup_info?.group || del.cr?.section || '';

            return (
              <div
                key={del.id}
                className={`p-4 rounded-xl border-2 transition ${
                  isActive
                    ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60 hover:border-purple-300'
                    : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 dark:text-white text-sm sm:text-base">
                        {del.cr?.name || 'CR Student'}
                      </span>
                      {sBranch && (
                        <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 text-[11px] font-black px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          {sBranch} {sGroup ? `· ${sGroup}` : ''}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Roll: {del.cr?.roll_no || 'N/A'}</span>
                    </div>

                    <p className="text-xs font-black text-purple-900 dark:text-purple-300">
                      Subject: {del.subjects?.code} - {del.subjects?.name}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] font-bold text-gray-600 dark:text-gray-300 flex-wrap">
                      <span>
                        Granted:{' '}
                        {new Date(del.granted_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        Expires:{' '}
                        {new Date(del.expires_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    </div>

                    {del.note && (
                      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 italic">
                        Note: "{del.note}"
                      </p>
                    )}
                  </div>

                  {/* Right Status & Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
                    {isActive ? (
                      <span className="bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700 text-xs font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                        ✓ Active · {diffHours}h {diffMins}m left
                      </span>
                    ) : !del.is_active ? (
                      <span className="bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700 text-xs font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                        Revoked
                      </span>
                    ) : (
                      <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                        Expired
                      </span>
                    )}

                    {/* If Active: Edit Access + Revoke */}
                    {isActive ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingDelegation(del);
                            setEditDuration(12);
                            setEditUnit('hours');
                          }}
                          className="p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:text-purple-700 dark:hover:text-purple-300 hover:border-purple-300 transition text-xs font-bold flex items-center gap-1 shadow-sm"
                          title="Edit Validity / Extend Access"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit Access</span>
                        </button>

                        <button
                          onClick={() => handleRevoke(del)}
                          disabled={actionId === del.id}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 transition text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                          title="Revoke Access Now"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{actionId === del.id ? 'Revoking...' : 'Revoke'}</span>
                        </button>
                      </>
                    ) : (
                      /* When Revoked: Delete Icon Button to purge record completely */
                      <button
                        onClick={() => handlePermanentDelete(del)}
                        disabled={actionId === del.id}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 transition text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Delete this record permanently from dashboard"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>{actionId === del.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Validity Modal */}
      {editingDelegation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-700" />
                <h3 className="text-base font-black text-gray-900">Edit / Extend CR Access</h3>
              </div>
              <button
                onClick={() => setEditingDelegation(null)}
                className="p-1 rounded-full text-gray-500 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-900">
              <p className="text-xs font-bold text-gray-800">
                Extending access for <strong className="text-purple-900">{editingDelegation.cr?.name}</strong> on{' '}
                <strong className="text-purple-900">{editingDelegation.subjects?.name}</strong>:
              </p>

              <div>
                <label className="block text-xs font-black uppercase text-gray-900 mb-1">
                  New Validity from Now
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={editUnit === 'hours' ? 168 : 30}
                    value={editDuration}
                    onChange={e => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 border-2 border-gray-300 rounded-xl px-3 py-2 bg-white text-gray-900 font-black text-sm focus:outline-none focus:border-purple-600"
                  />
                  <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setEditUnit('hours')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        editUnit === 'hours' ? 'bg-purple-600 text-white' : 'text-gray-800'
                      }`}
                    >
                      Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUnit('days')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        editUnit === 'days' ? 'bg-purple-600 text-white' : 'text-gray-800'
                      }`}
                    >
                      Days
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDelegation(null)}
                  disabled={submitting}
                  className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDuration}
                  disabled={submitting}
                  className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl shadow"
                >
                  {submitting ? 'Saving...' : 'Save New Validity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
