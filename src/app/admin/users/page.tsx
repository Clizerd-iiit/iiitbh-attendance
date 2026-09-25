'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { User, Role } from '@/types';
import { PhotoZoom } from '@/components/shared/PhotoZoom';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const defaultForm = { id: '', name: '', email: '', role: 'student', roll_no: '', section: '', branch: '', group: '', sub_group: '', semester: 1, bio: '', profile_photo_url: '', is_cr: false };
  const [form, setForm] = useState(defaultForm);
  
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/admin/users' : `/api/admin/users?role=${filter}`;
    fetch(url).then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false); });
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const saveUser = async () => {
    const method = isEditing ? 'PATCH' : 'POST';
    const payload = isEditing ? form : { ...form, id: undefined };
    await fetch('/api/admin/users', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowModal(false);
    fetchUsers();
  };

  const toggleActive = async (user: User) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    });
    fetchUsers();
  };

  const deleteUser = async () => {
    if (!deleting) return;
    await fetch(`/api/admin/users?id=${deleting}`, { method: 'DELETE' });
    setDeleting(null);
    fetchUsers();
  };
  
  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || 
           u.email.toLowerCase().includes(q) || 
           (u.roll_no && u.roll_no.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-800">👥 Users Management</h1>
          <button onClick={() => { setForm(defaultForm); setIsEditing(false); setShowModal(true); }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition">
            + Add User
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['all', 'student', 'teacher', 'superadmin'].map(r => (
              <button key={r} onClick={() => setFilter(r as any)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${filter === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="w-full md:w-72 relative">
            <input type="text" placeholder="Search by name, email, roll no..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
            <span className="absolute left-3 top-2.5 opacity-50">🔍</span>
          </div>
        </div>

        {loading ? <p className="text-gray-500">Loading users...</p> : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-sm text-gray-500">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Roll No / Details</th>
                  <th className="p-4 font-medium">Face ID</th>
                  <th className="p-4 font-medium">Account</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 flex items-center gap-3">
                      <PhotoZoom src={u.profile_photo_url || ''} alt={u.name} className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                          {(u as any).is_cr && <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-bold border border-purple-200">CR</span>}
                        </div>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        u.role==='superadmin' ? 'bg-purple-100 text-purple-700' :
                        u.role==='teacher' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-mono text-gray-600">{u.roll_no || '-'}</p>
                      <p className="text-xs font-medium text-blue-600 mt-0.5">
                        {u.role === 'student' ? (
                          <>
                            {(u as any).signup_info?.branch || (u as any).branch || ''}
                            {(u as any).signup_info?.group ? ` - ${(u as any).signup_info.group}` : ''}
                            {(u as any).signup_info?.sub_group ? ` (${(u as any).signup_info.sub_group})` : ''}
                          </>
                        ) : ''}
                      </p>
                    </td>
                    <td className="p-4 text-sm">
                      {u.role === 'student' ? (
                        (u as any).signup_info?.last_face_update || (u as any).signup_info?.face_descriptor ? (
                          <span className="text-green-600 font-medium flex items-center gap-1"><span className="text-xs">📸</span> Done</span>
                        ) : (
                          <span className="text-red-500 font-medium flex items-center gap-1"><span className="text-xs">❌</span> Missing</span>
                        )
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      <button onClick={() => toggleActive(u)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                          u.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
                                        'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        }`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => { 
                          setForm({ id: u.id, name: u.name, email: u.email, role: u.role, roll_no: u.roll_no||'', section: u.section||'', branch: (u as any).signup_info?.branch || (u as any).branch || '', group: (u as any).signup_info?.group || '', sub_group: (u as any).signup_info?.sub_group || '', is_cr: (u as any).is_cr||false, semester: u.semester||1, bio: u.bio||'', profile_photo_url: u.profile_photo_url||'' });
                          setIsEditing(true); 
                          setShowModal(true); 
                        }} 
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition">
                        Edit
                      </button>
                      <button onClick={() => setDeleting(u.id)} 
                        className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Edit / Add User */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit User Details' : 'Add New User'}</h2>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                
                <div className="flex gap-4">
                  <div className="w-24 shrink-0">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Avatar URL</label>
                    <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden border">
                      {form.profile_photo_url ? (
                        <img src={form.profile_photo_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : <div className="w-full h-full flex items-center justify-center text-gray-400">No Img</div>}
                    </div>
                    {form.profile_photo_url && (
                      <button onClick={() => setForm({...form, profile_photo_url: ''})} className="mt-2 text-xs text-red-500 font-medium hover:underline block text-center w-full">
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                      <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        value={form.email} onChange={e=>setForm({...form, email:e.target.value})}  />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.role} onChange={e=>setForm({...form, role:e.target.value})} disabled={isEditing && form.role==='superadmin'}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Roll No (Optional)</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.roll_no} onChange={e=>setForm({...form, roll_no:e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Photo URL (Direct Link)</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={form.profile_photo_url} onChange={e=>setForm({...form, profile_photo_url:e.target.value})} placeholder="https://..." />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Bio</label>
                  <textarea className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 h-20"
                    value={form.bio} onChange={e=>setForm({...form, bio:e.target.value})} />
                </div>

              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button onClick={saveUser} disabled={!form.name || !form.email}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isEditing ? 'Save Changes' : 'Add User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleting && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Delete User?</h2>
              <p className="text-gray-600 text-sm mb-6">This action will cascade delete everything associated with this user. It cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleting(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Cancel</button>
                <button onClick={deleteUser} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl font-medium">Delete Permanently</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
