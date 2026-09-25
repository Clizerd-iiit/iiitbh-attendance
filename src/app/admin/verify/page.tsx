'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import Image from 'next/image';

interface PendingUser {
  id: string; name: string; email: string; role: string;
  created_at: string; signup_info?: Record<string, string>;
  profile_photo_url?: string; roll_no?: string;
  verification_status: string;
}

export default function VerifyUsersPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [filter, setFilter] = useState<'pending'|'approved'|'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    fetch(`/api/admin/verify?status=${filter}`)
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false); });
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const act = async (userId: string, action: 'approve'|'reject', reason?: string) => {
    await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, reason }),
    });
    setRejectId(null); setRejectReason('');
    fetchUsers();
  };

  const statusColors = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">🔔 User Verification</h1>
          <span className="text-sm text-gray-500">
            {users.length} {filter} request{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabs and Bulk Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            {(['pending','approved','rejected'] as const).map(s => (
              <button key={s} onClick={() => { setFilter(s); setSelectedUsers(new Set()); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  filter === s ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}>
                {s === 'pending' ? '⏳' : s === 'approved' ? '✅' : '❌'} {s}
              </button>
            ))}
          </div>
          
          {filter === 'pending' && users.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => {
                if (selectedUsers.size === users.length) setSelectedUsers(new Set());
                else setSelectedUsers(new Set(users.map(u => u.id)));
              }} className="px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition">
                {selectedUsers.size === users.length ? 'Deselect All' : 'Select All'}
              </button>
              
              {selectedUsers.size > 0 && (
                <>
                  <button onClick={async () => {
                    setBulkActing(true);
                    await Promise.all(Array.from(selectedUsers).map(id => 
                      fetch('/api/admin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, action: 'approve' }) })
                    ));
                    setBulkActing(false);
                    setSelectedUsers(new Set());
                    fetchUsers();
                  }} disabled={bulkActing} className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                    ✅ Approve Selected
                  </button>
                  <button onClick={async () => {
                    if(!confirm('Reject selected?')) return;
                    setBulkActing(true);
                    await Promise.all(Array.from(selectedUsers).map(id => 
                      fetch('/api/admin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, action: 'reject' }) })
                    ));
                    setBulkActing(false);
                    setSelectedUsers(new Set());
                    fetchUsers();
                  }} disabled={bulkActing} className="px-3 py-2 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition disabled:opacity-50">
                    ❌ Reject Selected
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1,2,3,4].map(i => <div key={i} className="h-40 bg-gray-200 rounded-2xl animate-pulse"/>)}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-400 py-20 text-lg">
            {filter === 'pending' ? '🎉 No pending requests!' : `No ${filter} users`}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {users.map(user => (
              <div key={user.id} className="bg-white rounded-2xl shadow-sm p-5 border hover:shadow-md transition">
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  {filter === 'pending' && (
                    <div className="pt-4">
                      <input type="checkbox" className="w-5 h-5 cursor-pointer accent-blue-600"
                        checked={selectedUsers.has(user.id)}
                        onChange={(e) => {
                          const next = new Set(selectedUsers);
                          if (e.target.checked) next.add(user.id);
                          else next.delete(user.id);
                          setSelectedUsers(next);
                        }}
                      />
                    </div>
                  )}
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                    {user.profile_photo_url ? (
                      <Image src={user.profile_photo_url} alt={user.name} width={56} height={56}
                        className="object-cover w-full h-full"/>
                    ) : (
                      <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                        {user.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{user.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${statusColors[user.verification_status as keyof typeof statusColors] || 'bg-gray-100 text-gray-600'}`}>
                        {user.verification_status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    <span className={`text-xs px-2 py-0.5 rounded capitalize inline-block mt-1 ${
                      user.role === 'teacher' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>{user.role}</span>
                  </div>
                </div>

                {/* Signup info */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1">
                  {user.role === 'student' && user.roll_no && (
                    <p><span className="text-gray-400">Roll No:</span> <span className="font-medium">{user.roll_no}</span></p>
                  )}
                  {user.signup_info?.subject_name && (
                    <p><span className="text-gray-400">Subject:</span> <span className="font-medium">{user.signup_info.subject_name} ({user.signup_info.subject_code})</span></p>
                  )}
                  <p><span className="text-gray-400">Applied:</span> <span className="font-medium">{new Date(user.created_at).toLocaleDateString('en-IN')}</span></p>
                </div>

                {/* Actions */}
                {filter === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => act(user.id, 'approve')}
                      className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition">
                      ✅ Approve
                    </button>
                    <button onClick={() => setRejectId(user.id)}
                      className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-sm font-medium hover:bg-red-200 transition">
                      ❌ Reject
                    </button>
                  </div>
                )}

                {/* Reject reason modal inline */}
                {rejectId === user.id && (
                  <div className="mt-3 space-y-2">
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)..." rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"/>
                    <div className="flex gap-2">
                      <button onClick={() => act(user.id, 'reject', rejectReason)}
                        className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-sm hover:bg-red-700 transition">
                        Confirm Reject
                      </button>
                      <button onClick={() => setRejectId(null)}
                        className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-200 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
