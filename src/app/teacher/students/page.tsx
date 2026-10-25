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
  const [mainGroup, setMainGroup] = useState('');
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
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchData();
    }, 120_000);
    return () => clearInterval(interval);
  }, []);

  
  const loadAllStudents = async () => {
    if (document.hidden) return;
    const res = await fetch('/api/users/students');
    const data = await res.json();
    setAllStudents(data.students || []);
  };

  useEffect(() => {
    loadAllStudents();
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadAllStudents();
    }, 120_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      if (!selected || document.hidden) return;
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
    const interval = setInterval(fetchData, 120_000);
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selected===s.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'}`}>
              {s.code}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#231b16] rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-[#3d3026]">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3d3026] flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <span className="font-bold text-gray-900 dark:text-white whitespace-nowrap">{students.length} enrolled</span>
              <select value={branchFilter} onChange={e=>{
                const b = e.target.value;
                setBranchFilter(b);
                if (b !== 'CSE') {
                  setMainGroup('');
                  setGroupFilter('');
                }
              }} className="w-full sm:w-auto border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 shadow-sm">
                <option value="" className="text-gray-900 font-bold">All Branches</option>
                <option value="CSE" className="text-gray-900 font-bold">CSE</option>
                <option value="ECE" className="text-gray-900 font-bold">ECE</option>
                <option value="MAE" className="text-gray-900 font-bold">MAE</option>
                <option value="MNC" className="text-gray-900 font-bold">MNC</option>
              </select>
              {branchFilter && branchFilter !== 'CSE' ? (
                <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 flex items-center gap-1">
                  <span>All Groups</span>
                  <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1 py-0.2 rounded font-bold">Auto</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select value={mainGroup} onChange={e=>{
                    const mg = e.target.value;
                    setMainGroup(mg);
                    setGroupFilter(mg);
                  }} className="w-full sm:w-auto border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 shadow-sm">
                    <option value="" className="text-gray-900 font-bold">All Groups</option>
                    <option value="G1" className="text-gray-900 font-bold">Group 1 (G1)</option>
                    <option value="G2" className="text-gray-900 font-bold">Group 2 (G2)</option>
                  </select>

                  {mainGroup === 'G1' && (
                    <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} className="w-full sm:w-auto border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 shadow-sm animate-fadeIn">
                      <option value="G1">All G1 (Both G1A & G1B)</option>
                      <option value="G1A">↳ Sub-Group G1A</option>
                      <option value="G1B">↳ Sub-Group G1B</option>
                    </select>
                  )}

                  {mainGroup === 'G2' && (
                    <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} className="w-full sm:w-auto border border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 shadow-sm animate-fadeIn">
                      <option value="G2">All G2 (Both G2A & G2B)</option>
                      <option value="G2A">↳ Sub-Group G2A</option>
                      <option value="G2B">↳ Sub-Group G2B</option>
                    </select>
                  )}
                </div>
              )}
              <input type="text" placeholder="Search by name or roll no..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 shadow-sm placeholder:text-gray-400" />
            </div>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">
              ⚠️ Low (&lt;75%): {students.filter(s => (summary[s.id]||0) < 75).length}
            </span>
          </div>
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-[#1a1410] border-b border-gray-200 dark:border-[#3d3026]">
              <tr>
                <th className="text-left p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Roll No</th>
                <th className="text-left p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Name</th>
                <th className="text-left p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Face ID</th>
                <th className="text-left p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Section</th>
                <th className="text-left p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Attendance</th>
                <th className="text-left p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Status</th>
                <th className="text-right p-4 text-sm font-bold text-gray-900 dark:text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#3d3026]">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-900 font-medium">Loading...</td></tr>
              ) : students.filter(s => {
                  const br = (s.signup_info?.branch || s.branch || '').toUpperCase().trim();
                  const gr = (s.signup_info?.group || s.section || '').toUpperCase().trim();
                  const subgr = (s.signup_info?.sub_group || '').toUpperCase().trim();
                  if (branchFilter && br !== branchFilter.toUpperCase().trim()) return false;
                  if (groupFilter) {
                    const target = groupFilter.toUpperCase().trim();
                    if (target === 'G1') {
                      if (!gr.startsWith('G1') && !subgr.startsWith('G1')) return false;
                    } else if (target === 'G2') {
                      if (!gr.startsWith('G2') && !subgr.startsWith('G2')) return false;
                    } else if (target === 'G1A' || target === 'G1B' || target === 'G2A' || target === 'G2B') {
                      if (subgr !== target && gr !== target) return false;
                    } else {
                      if (!gr.includes(target) && !subgr.includes(target)) return false;
                    }
                  }
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return s.name.toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q);
                  }
                  return true;
                }).sort((a, b) => {
                  const rA = (a.roll_no || '').trim();
                  const rB = (b.roll_no || '').trim();
                  if (!rA && !rB) return 0;
                  if (!rA) return 1;
                  if (!rB) return -1;
                  return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
                }).map(s => {
                const pct = summary[s.id] ?? null;
                const color = pct === null ? 'text-gray-700' : pct >= 85 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
                
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
                  <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 transition ${pct !== null && pct < 75 ? 'bg-red-50/80 dark:bg-red-950/30 border-l-4 border-l-red-500' : ''}`}>
                    <td className="p-4 text-sm font-mono font-bold text-gray-900 dark:text-gray-100">{s.roll_no || '—'}</td>
                    <td className="p-4 font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {s.name}
                      {s.signup_info?.is_pseudoadmin && (
                        <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <span>🛡️</span> Admin {s.signup_info?.pseudoadmin_branch ? `(${s.signup_info.pseudoadmin_branch})` : ''}
                        </span>
                      )}
                      {s.is_cr && <span className="bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded font-extrabold border border-purple-200">CR</span>}
                    </td>
                    <td className="p-4 text-sm">
                      {s.signup_info?.last_face_update || s.signup_info?.face_descriptor ? (
                        <span className="text-green-700 dark:text-green-400 font-bold flex items-center gap-1"><span className="text-xs">📸</span> Done</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1"><span className="text-xs">❌</span> Missing</span>
                      )}
                    </td>
                    <td className="p-4 text-sm font-bold text-blue-700 dark:text-blue-300">
                      {s.signup_info?.branch || s.branch || '—'}
                      {s.signup_info?.group ? ` - ${s.signup_info.group}` : ''}
                      {s.signup_info?.sub_group ? ` (${s.signup_info.sub_group})` : ''}
                    </td>
                    <td className={`p-4 font-bold ${color}`}>{pct !== null ? `${pct}%` : '—'}</td>
                    <td className="p-4">
                      {pct !== null && pct < 75 && (
                        <span className="text-xs bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 font-bold px-2 py-1 rounded">⚠️ Low</span>
                      )}
                      {pct !== null && pct >= 75 && (
                        <span className="text-xs bg-green-100 dark:bg-green-950/70 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800 font-bold px-2 py-1 rounded">✅ Safe</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => setEditingStudent(s)} className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 text-sm font-bold mr-3">Edit</button>
                      <button onClick={() => unenroll(s.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-bold">Remove</button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl mx-auto my-auto">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Add Students to Subject</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-700 hover:text-gray-900 text-2xl font-bold leading-none">&times;</button>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
                  <div className="flex gap-2 flex-1 w-full sm:w-auto">
                    <select value={modalBranchFilter} onChange={e=>setModalBranchFilter(e.target.value)} className="w-1/3 sm:w-auto border border-gray-300 rounded-xl px-2.5 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-500 bg-white shadow-sm">
                      <option value="" className="text-gray-900 font-bold">Branch</option>
                      <option value="CSE" className="text-gray-900 font-bold">CSE</option>
                      <option value="ECE" className="text-gray-900 font-bold">ECE</option>
                      <option value="MEA" className="text-gray-900 font-bold">MEA</option>
                      <option value="MNC" className="text-gray-900 font-bold">MNC</option>
                    </select>
                    <select value={modalGroupFilter} onChange={e=>setModalGroupFilter(e.target.value)} className="w-1/3 sm:w-auto border border-gray-300 rounded-xl px-2.5 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-500 bg-white shadow-sm">
                      <option value="" className="text-gray-900 font-bold">Group</option>
                      <option value="G1" className="text-gray-900 font-bold">G1</option>
                      <option value="G2" className="text-gray-900 font-bold">G2</option>
                      <option value="G3" className="text-gray-900 font-bold">G3</option>
                    </select>
                    <input type="text" placeholder="Search..." value={modalSearch} onChange={e => setModalSearch(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-500 bg-white shadow-sm placeholder:text-gray-500" />
                  </div>
                  <button onClick={handleSelectAll} className="text-sm text-blue-700 hover:text-blue-900 font-bold whitespace-nowrap px-2">
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
                      <label key={s.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer bg-white shadow-sm">
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" 
                          checked={selectedStudents.has(s.id)} onChange={() => toggleStudentSelection(s.id)} />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{s.name}</p>
                          <p className="text-xs text-gray-900 font-mono font-bold">{s.roll_no}</p>
                        </div>
                      </label>
                    );
                  })}
                  {allStudents.filter(s => !students.some(e => e.id === s.id)).length === 0 && (
                    <div className="col-span-2 text-center text-gray-900 font-semibold py-8">All students are already enrolled!</div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowAddModal(false)} className="px-5 py-2 rounded-xl text-gray-700 hover:bg-gray-200 transition">Cancel</button>
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
