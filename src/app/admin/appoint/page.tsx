'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { User } from '@/types';

export default function AppointPositionPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [position, setPosition] = useState('CR');
  const [branch, setBranch] = useState('');
  const [group, setGroup] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = () => {
    fetch('/api/users/students').then(r => r.json()).then(d => {
      setStudents(d.students || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    const student = students.find(s => s.id === id);
    if (student) {
      setBranch((student as any).branch || '');
      setGroup(student.section || '');
    }
  };

  const handleAssign = async () => {
    if (!selectedStudentId) return setMessage('Please select a student.');
    setSubmitting(true); setMessage('');
    
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedStudentId,
        is_cr: position === 'CR',
        branch: branch,
        section: group
      }),
    });
    
    setMessage('Position successfully assigned!');
    setSubmitting(false);
    fetchData();
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke CR position from this student?')) return;
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_cr: false }),
    });
    fetchData();
  };

  const currentCRs = students.filter(s => (s as any).is_cr);

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">🎖️ Appoint Position</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
            <h2 className="text-lg font-bold mb-4">Assign New Position</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Student</label>
                <select value={selectedStudentId} onChange={e => handleStudentSelect(e.target.value)}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none">
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.roll_no || s.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Position</label>
                <select value={position} onChange={e => setPosition(e.target.value)}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none">
                  <option value="CR">Class Representative (CR)</option>
                </select>
              </div>

              {position === 'CR' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Branch</label>
                    <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full border p-2.5 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none">
                      <option value="">Select Branch</option>
                      <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MAE">MAE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group</label>
                    <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border p-2.5 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none">
                      <option value="">Select Group</option>
                      <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
                      <option value="G1A">G1A</option><option value="G1B">G1B</option><option value="G2A">G2A</option><option value="G2B">G2B</option>
                    </select>
                  </div>
                </div>
              )}

              {message && <div className="text-sm p-3 bg-green-50 text-green-700 rounded-lg">{message}</div>}

              <button onClick={handleAssign} disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition">
                {submitting ? 'Assigning...' : 'Assign Position'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4">Current Appointed CRs</h2>
            {loading ? (
              <div className="animate-pulse flex flex-col gap-3">
                <div className="h-12 bg-gray-100 rounded-xl"></div>
                <div className="h-12 bg-gray-100 rounded-xl"></div>
              </div>
            ) : currentCRs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No students are currently holding a position.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {currentCRs.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-sm transition">
                    <div>
                      <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                        {s.name}
                        <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded font-bold">CR</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.roll_no} • {(s as any).branch || 'N/A'} • {s.section || 'N/A'}
                      </div>
                    </div>
                    <button onClick={() => handleRevoke(s.id)} className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 hover:bg-red-100 rounded transition">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
