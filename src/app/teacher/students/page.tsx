'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { EditStudentModal } from '@/components/teacher/EditStudentModal';
import { User } from '@/types';

function StudentsContent() {
  const params = useSearchParams();
  const subjectId = params.get('subject') || '';
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<{id:string;name:string;code:string;branch?:string;section?:string}[]>([]);
  const [selected, setSelected] = useState(subjectId);
  const [summary, setSummary] = useState<Record<string,number>>({});
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalSearch, setModalSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [modalBranchFilter, setModalBranchFilter] = useState('');
  const [modalGroupFilter, setModalGroupFilter] = useState('');


  
useEffect(() => {
    const fetchData = () => {
      fetch('/api/teacher/subjects').then(r=>r.json()).then(d => {
        setSubjects(d.subjects || []);
        setSelected(prev => {
          if (!prev && d.subjects?.[0]) return d.subjects[0].id;
          return prev;
        });
      });
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  
  const loadAllStudents = async () => {
    const res = await fetch('/api/users/students');
    const data = await res.json();
    setAllStudents(data.students || []);
  };

  useEffect(() => {
    loadAllStudents();
    const interval = setInterval(loadAllStudents, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      if (!selected) return;
      fetch(`/api/admin/users?role=student&subject_id=${selected}`)
        .then(r=>r.json()).then(d => { setStudents(d.users||[]); setLoading(false); });
      fetch(`/api/attendance/class-summary?subject_id=${selected}`)
        .then(r=>r.json()).then(d => {
          const map: Record<string,number> = {};
          (d.summary||[]).forEach((s: {student_id:string; percentage:number}) => { map[s.student_id] = s.percentage; });
          setSummary(map);
        });
    };
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [selected]);

  
  const unenroll = async (studentId: string) => {
    if (!window.confirm('Remove this student from the subject?')) return;
    const delRes = await fetch(`/api/teacher/enrollments?subject_id=${selected}&student_id=${studentId}`, { method: 'DELETE' });
    if (!delRes.ok) {
      const err = await delRes.json();
      alert('Failed to remove: ' + (err.error || 'Unknown error'));
      return;
    }
    // Optimistic UI update
    setStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const handleAddStudents = async () => {
    if (selectedStudents.size === 0) return;
    setAdding(true);
    await fetch('/api/teacher/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: selected, student_ids: Array.from(selectedStudents) })
    });
    setAdding(false);
    setShowAddModal(false);
    setSelectedStudents(new Set());
    
    // Reload enrolled students
    const res = await fetch(`/api/admin/users?role=student&subject_id=${selected}&_t=${Date.now()}`);
    const data = await res.json();
    setStudents(data.users||[]);
  };

  const toggleStudentSelection = (id: string) => {
    const next = new Set(selectedStudents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudents(next);
  };

  const handleSelectAll = () => {
    const available = allStudents.filter(s => !students.find(e => e.id === s.id) && (s.name.toLowerCase().includes(modalSearch.toLowerCase()) || (s.roll_no || '').toLowerCase().includes(modalSearch.toLowerCase())));
    
    // Are all currently visible items selected?
    const allVisibleSelected = available.length > 0 && available.every(s => selectedStudents.has(s.id));
    
    const next = new Set(selectedStudents);
    if (allVisibleSelected) {
      // Deselect all visible
      available.forEach(s => next.delete(s.id));
    } else {
      // Select all visible
      available.forEach(s => next.add(s.id));
    }
    setSelectedStudents(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">👥 Students</h1>
          <button onClick={() => setShowAddModal(true)} disabled={!selected}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-70">
            + Add Students
          </button>
        </div>

        {/* Subject selector */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {subjects.map(s => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selected===s.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              {s.code}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <span className="font-medium text-gray-700 whitespace-nowrap">{students.length} enrolled</span>
              <select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)} className="w-full sm:w-auto border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white">
                <option value="">All Branches</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="MEA">MEA</option>
                <option value="MNC">MNC</option>
              </select>
              <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} className="w-full sm:w-auto border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white">
                <option value="">All Groups</option>
                <option value="G1">G1</option>
                <option value="G2">G2</option>
                <option value="G3">G3</option>
              </select>
              <input type="text" placeholder="Search by name or roll no..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <span className="text-sm text-red-500">
              ⚠️ Low (&lt;75%): {students.filter(s => (summary[s.id]||0) < 75).length}
            </span>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Roll No</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Face ID</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Section</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Attendance</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                <th className="text-right p-4 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : students.filter(s => {
                  const br = s.signup_info?.branch || s.branch || '';
                  const gr = s.signup_info?.group || s.section || '';
                  if (branchFilter && br !== branchFilter) return false;
                  if (groupFilter && !gr.includes(groupFilter)) return false;
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return s.name.toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q);
                  }
                  return true;
                }).map(s => {
                const pct = summary[s.id] ?? null;
                const color = pct === null ? 'text-gray-500' : pct >= 85 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
                
  const unenroll = async (studentId: string) => {
    if (!window.confirm('Remove this student from the subject?')) return;
    const delRes = await fetch(`/api/teacher/enrollments?subject_id=${selected}&student_id=${studentId}`, { method: 'DELETE' });
    if (!delRes.ok) {
      const err = await delRes.json();
      alert('Failed to remove: ' + (err.error || 'Unknown error'));
      return;
    }
    // Optimistic UI update
    setStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const handleAddStudents = async () => {
    if (selectedStudents.size === 0) return;
    setAdding(true);
    await fetch('/api/teacher/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: selected, student_ids: Array.from(selectedStudents) })
    });
    setAdding(false);
    setShowAddModal(false);
    setSelectedStudents(new Set());
    
    // Reload enrolled students
    const res = await fetch(`/api/admin/users?role=student&subject_id=${selected}&_t=${Date.now()}`);
    const data = await res.json();
    setStudents(data.users||[]);
  };

  const toggleStudentSelection = (id: string) => {
    const next = new Set(selectedStudents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudents(next);
  };

  const handleSelectAll = () => {
    const available = allStudents.filter(s => !students.find(e => e.id === s.id) && (s.name.toLowerCase().includes(modalSearch.toLowerCase()) || (s.roll_no || '').toLowerCase().includes(modalSearch.toLowerCase())));
    
    // Are all currently visible items selected?
    const allVisibleSelected = available.length > 0 && available.every(s => selectedStudents.has(s.id));
    
    const next = new Set(selectedStudents);
    if (allVisibleSelected) {
      // Deselect all visible
      available.forEach(s => next.delete(s.id));
    } else {
      // Select all visible
      available.forEach(s => next.add(s.id));
    }
    setSelectedStudents(next);
  };

  return (
                  <tr key={s.id} className={`hover:bg-gray-50 ${pct !== null && pct < 75 ? 'bg-red-50' : ''}`}>
                    <td className="p-4 text-sm font-mono text-gray-600">{s.roll_no || '—'}</td>
                    <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                      {s.name}
                      {s.is_cr && <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded font-bold border border-purple-200">CR</span>}
                    </td>
                    <td className="p-4 text-sm">
                      {s.signup_info?.last_face_update || s.signup_info?.face_descriptor ? (
                        <span className="text-green-600 font-medium flex items-center gap-1"><span className="text-xs">📸</span> Done</span>
                      ) : (
                        <span className="text-red-500 font-medium flex items-center gap-1"><span className="text-xs">❌</span> Missing</span>
                      )}
                    </td>
                    <td className="p-4 text-sm font-medium text-blue-600">
                      {s.signup_info?.branch || s.branch || '—'}
                      {s.signup_info?.group ? ` - ${s.signup_info.group}` : ''}
                      {s.signup_info?.sub_group ? ` (${s.signup_info.sub_group})` : ''}
                    </td>
                    <td className={`p-4 font-bold ${color}`}>{pct !== null ? `${pct}%` : '—'}</td>
                    <td className="p-4">
                      {pct !== null && pct < 75 && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">⚠️ Low</span>
                      )}
                      {pct !== null && pct >= 75 && (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">✅ Safe</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => setEditingStudent(s)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Edit</button>
                      <button onClick={() => unenroll(s.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editingStudent && (
          <EditStudentModal 
            student={editingStudent} 
            onClose={() => setEditingStudent(null)} 
            onSaved={async () => {
              const res = await fetch(`/api/admin/users?role=student&subject_id=${selected}&_t=${Date.now()}`);
              const data = await res.json();
              setStudents(data.users||[]);
            }} 
          />
        )}
        
        {/* Add Students Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-800">Add Students to Subject</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
                  <div className="flex gap-2 flex-1 w-full sm:w-auto">
                    <select value={modalBranchFilter} onChange={e=>setModalBranchFilter(e.target.value)} className="w-1/3 sm:w-auto border rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white">
                      <option value="">Branch</option>
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="MEA">MEA</option>
                      <option value="MNC">MNC</option>
                    </select>
                    <select value={modalGroupFilter} onChange={e=>setModalGroupFilter(e.target.value)} className="w-1/3 sm:w-auto border rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white">
                      <option value="">Group</option>
                      <option value="G1">G1</option>
                      <option value="G2">G2</option>
                      <option value="G3">G3</option>
                    </select>
                    <input type="text" placeholder="Search..." value={modalSearch} onChange={e => setModalSearch(e.target.value)}
                      className="flex-1 border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:underline font-medium whitespace-nowrap px-2">
                    {(() => {
                      const available = allStudents.filter(s => {
                        if (students.find(e => e.id === s.id)) return false;
                        const br = s.signup_info?.branch || s.branch || '';
                        const gr = s.signup_info?.group || s.section || '';
                        if (modalBranchFilter && br !== modalBranchFilter) return false;
                        if (modalGroupFilter && !gr.includes(modalGroupFilter)) return false;
                        if (modalSearch) {
                          const q = modalSearch.toLowerCase();
                          return s.name.toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q);
                        }
                        return true;
                      });
                      const allVisibleSelected = available.length > 0 && available.every(s => selectedStudents.has(s.id));
                      return allVisibleSelected ? 'Deselect All (Visible)' : 'Select All (Visible)';
                    })()}
                  </button>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-2">
                  {allStudents.filter(s => {
                        const br = s.signup_info?.branch || s.branch || '';
                        const gr = s.signup_info?.group || s.section || '';
                        if (modalBranchFilter && br !== modalBranchFilter) return false;
                        if (modalGroupFilter && !gr.includes(modalGroupFilter)) return false;
                        if (modalSearch) {
                          const q = modalSearch.toLowerCase();
                          return s.name.toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q);
                        }
                        return true;
                  }).map(s => {
                    const isEnrolled = students.some(e => e.id === s.id);
                    if (isEnrolled) return null;
                    return (
                      <label key={s.id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" 
                          checked={selectedStudents.has(s.id)} onChange={() => toggleStudentSelection(s.id)} />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{s.roll_no}</p>
                        </div>
                      </label>
                    );
                  })}
                  {allStudents.filter(s => !students.some(e => e.id === s.id)).length === 0 && (
                    <div className="col-span-2 text-center text-gray-500 py-8">All students are already enrolled!</div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowAddModal(false)} className="px-5 py-2 rounded-xl text-gray-600 hover:bg-gray-200 transition">Cancel</button>
                <button onClick={handleAddStudents} disabled={adding || selectedStudents.size === 0} 
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-70">
                  {adding ? 'Adding...' : `Add ${selectedStudents.size} Students`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

  );
}

export default function StudentsPage() {
  return <Suspense><StudentsContent /></Suspense>;
}
