"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { PhotoZoom } from '@/components/shared/PhotoZoom';

interface StudentBasic {
  id: string; name: string; email: string;
  profile_photo_url?: string; roll_no?: string; is_online?: boolean;
  section?: string; branch?: string; is_cr?: boolean; is_active?: boolean; bio?: string; signup_info?: any; last_seen_at?: string;
}

export default function StudentDirectoryPage() {
  const { data: session } = useSession();
  const isTeacherOrAdmin = session?.user?.role === 'teacher' || session?.user?.role === 'superadmin';
  const [students, setStudents] = useState<StudentBasic[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [editingStudent, setEditingStudent] = useState<StudentBasic | null>(null);
  const [editForm, setEditForm] = useState<Partial<StudentBasic>>({});

  const saveStudent = async () => {
    if (!editingStudent) return;
    await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingStudent.id, ...editForm })
    });
    setEditingStudent(null);
    fetchData(); // Trigger reload
  };

  const fetchData = () => {
    fetch('/api/users/students').then(r => r.json()).then(d => {
      setStudents(d.students || []); setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = students.filter(s => {
    const sBranch = s.signup_info?.branch || s.branch || '';
    const sGroup = s.signup_info?.group || s.section || '';
    
    if (branchFilter && sBranch !== branchFilter) return false;
    if (groupFilter && !sGroup.includes(groupFilter)) return false;
    if (statusFilter === 'online' && !s.is_online) return false;
    if (statusFilter === 'offline' && s.is_online) return false;
    
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.roll_no || '').includes(search) && !s.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">👥 Student Directory</h1>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, roll no, or email…"
          className="w-full bg-white border rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-blue-500 shadow-sm text-sm"/>

        <div className="flex flex-wrap gap-3 mb-6 items-center bg-white p-3 rounded-xl border shadow-sm">
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
            <option value="">All Branches</option>
            <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MEA">MEA</option>
          </select>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
            <option value="">All Groups</option>
            <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
            <option value="">Any Status</option>
            <option value="online">🟢 Online</option>
            <option value="offline">⚪ Offline</option>
          </select>
          
          <div className="ml-auto text-sm font-semibold text-gray-700 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg">
            {filtered.length} Student{filtered.length !== 1 ? 's' : ''} Found
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-700 py-12">No students found</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition">
                <div className="relative inline-block mb-3">
                  {s.profile_photo_url ? (
                    <PhotoZoom src={s.profile_photo_url} alt={s.name} size={64}
                      className="border-2 border-blue-200 mx-auto"/>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl mx-auto">
                      {s.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  {/* Online dot */}
                  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${s.is_online ? 'bg-green-400' : 'bg-gray-300'}`}
                    title={s.is_online ? 'Online' : 'Offline'}/>
                </div>
                <div className="flex items-center gap-2 justify-center truncate">
                  <p className="font-medium text-gray-800 text-sm truncate">{s.name}</p>
                  {s.is_cr && <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded font-bold">CR</span>}
                </div>
                {s.roll_no && <p className="text-xs text-gray-700 font-mono">{s.roll_no}</p>}
                <p className="text-xs text-blue-600 font-medium truncate my-0.5">
                  {s.signup_info?.branch || s.branch || 'N/A'} {s.signup_info?.group ? `- ${s.signup_info.group}` : ''} {s.signup_info?.sub_group ? `(${s.signup_info.sub_group})` : ''}
                </p>
                <p className="text-xs text-gray-700 truncate mt-0.5">{s.email}</p>
                <div className="flex flex-col items-center justify-center gap-0.5 mt-1">
                  <span className={`text-xs font-medium ${s.is_online ? 'text-green-500' : 'text-gray-700'}`}>
                    {s.is_online ? '● Online' : '○ Offline'}
                  </span>
                  {!s.is_online && s.last_seen_at && (
                    <span className="text-xs text-gray-700">
                      Last seen: {new Date(s.last_seen_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Edit Student</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border p-2 rounded text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input type="text" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full border p-2 rounded text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Roll No</label>
                <input type="text" value={editForm.roll_no || ''} onChange={e => setEditForm({...editForm, roll_no: e.target.value})} className="w-full border p-2 rounded text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Group (Section)</label>
                <select value={editForm.section || ''} onChange={e => setEditForm({...editForm, section: e.target.value})} className="w-full border p-2 rounded text-sm">
                  <option value="">Select Group</option>
                  <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
                  <option value="G1A">G1A</option><option value="G1B">G1B</option><option value="G2A">G2A</option><option value="G2B">G2B</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Branch</label>
                <select value={editForm.branch || ''} onChange={e => setEditForm({...editForm, branch: e.target.value})} className="w-full border p-2 rounded text-sm">
                  <option value="">Select Branch</option>
                  <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MAE">MAE</option>
                </select>
              </div>
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                <label className="flex items-center gap-2 text-sm font-medium text-red-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.is_active === false} onChange={e => setEditForm({...editForm, is_active: !e.target.checked})} className="w-4 h-4 rounded text-red-600" />
                  Suspend Student Account
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingStudent(null)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={saveStudent} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}    </div>
  );
}
