'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { User } from '@/types';

export default function AppointPositionPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
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
    const interval = setInterval(fetchData, 60000);
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

  const filteredStudents = students.filter(s => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    const nameMatch = (s.name || '').toLowerCase().includes(q);
    const rollMatch = (s.roll_no || '').toLowerCase().includes(q);
    const emailMatch = (s.email || '').toLowerCase().includes(q);
    const branchMatch = ((s as any).branch || '').toLowerCase().includes(q);
    return nameMatch || rollMatch || emailMatch || branchMatch;
  });

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Keep selected student in options if user searches for another
  const displayStudents = [...filteredStudents];
  if (selectedStudent && !displayStudents.some(s => s.id === selectedStudent.id)) {
    displayStudents.unshift(selectedStudent);
  }

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">🎖️ Appoint Position</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Assign New Position</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-gray-900">Select Student</label>
                  {selectedStudent && (
                    <button
                      type="button"
                      onClick={() => { setSelectedStudentId(''); setBranch(''); setGroup(''); }}
                      className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline">
                      ✕ Clear Selection
                    </button>
                  )}
                </div>

                {/* Search Bar for Students */}
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Search by name, roll no, email..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full border border-gray-300 pl-9 pr-9 py-2 rounded-xl text-sm font-semibold text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => setStudentSearch('')}
                      className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-900 font-bold text-xs">
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick-Select Results List when searching */}
                {studentSearch.trim() !== '' && (
                  <div className="max-h-40 overflow-y-auto border border-blue-200 rounded-xl bg-blue-50/50 p-1.5 space-y-1 shadow-inner">
                    {filteredStudents.length === 0 ? (
                      <p className="text-xs font-bold text-gray-700 text-center py-2">No students match "{studentSearch}"</p>
                    ) : (
                      filteredStudents.slice(0, 15).map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            handleStudentSelect(s.id);
                            setStudentSearch('');
                          }}
                          className={`w-full text-left p-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                            selectedStudentId === s.id ? 'bg-blue-600 text-white font-bold' : 'bg-white text-gray-900 hover:bg-blue-100 border border-gray-200'
                          }`}>
                          <span className="truncate">{s.name}</span>
                          <span className="font-mono ml-2 shrink-0">{s.roll_no || s.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Dropdown Select */}
                <select value={selectedStudentId} onChange={e => handleStudentSelect(e.target.value)}
                  className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-blue-500 outline-none shadow-sm">
                  <option value="" className="text-gray-900 font-medium">
                    {displayStudents.length === 0 ? '-- No students found --' : `-- Choose Student (${displayStudents.length} available) --`}
                  </option>
                  {displayStudents.map(s => (
                    <option key={s.id} value={s.id} className="text-gray-900 font-medium">
                      {s.name} ({s.roll_no ? `${s.roll_no} • ` : ''}{s.email})
                    </option>
                  ))}
                </select>

                {/* Selected Student Confirmation Pill */}
                {selectedStudent && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="truncate">
                      <span className="font-bold text-blue-900">Selected: </span>
                      <span className="font-extrabold text-blue-950">{selectedStudent.name}</span>
                      <span className="text-blue-800 font-mono font-bold ml-1.5">({selectedStudent.roll_no || selectedStudent.email})</span>
                    </div>
                    <span className="text-green-700 font-bold ml-2 shrink-0">✓ Ready</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Position</label>
                <select value={position} onChange={e => setPosition(e.target.value)}
                  className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-blue-500 outline-none shadow-sm">
                  <option value="CR" className="text-gray-900 font-medium">Class Representative (CR)</option>
                </select>
              </div>

              {position === 'CR' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-1">Branch</label>
                    <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-blue-500 outline-none shadow-sm">
                      <option value="" className="text-gray-900 font-medium">Select Branch</option>
                      <option value="CSE" className="text-gray-900 font-medium">CSE</option><option value="ECE" className="text-gray-900 font-medium">ECE</option><option value="MNC" className="text-gray-900 font-medium">MNC</option><option value="MAE" className="text-gray-900 font-medium">MAE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-1">Group</label>
                    <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-blue-500 outline-none shadow-sm">
                      <option value="" className="text-gray-900 font-medium">Select Group</option>
                      <option value="G1" className="text-gray-900 font-medium">G1</option><option value="G2" className="text-gray-900 font-medium">G2</option><option value="G3" className="text-gray-900 font-medium">G3</option>
                      <option value="G1A" className="text-gray-900 font-medium">G1A</option><option value="G1B" className="text-gray-900 font-medium">G1B</option><option value="G2A" className="text-gray-900 font-medium">G2A</option><option value="G2B" className="text-gray-900 font-medium">G2B</option>
                    </select>
                  </div>
                </div>
              )}

              {message && <div className="text-sm font-bold p-3 bg-green-50 text-green-800 border border-green-200 rounded-lg">{message}</div>}

              <button onClick={handleAssign} disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-sm">
                {submitting ? 'Assigning...' : 'Assign Position'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Current Appointed CRs</h2>
            {loading ? (
              <div className="animate-pulse flex flex-col gap-3">
                <div className="h-12 bg-gray-100 rounded-xl"></div>
                <div className="h-12 bg-gray-100 rounded-xl"></div>
              </div>
            ) : currentCRs.length === 0 ? (
              <p className="text-gray-900 font-semibold text-sm text-center py-10">No students are currently holding a position.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {currentCRs.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-sm transition">
                    <div>
                      <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {s.name}
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-extrabold border border-purple-200">CR</span>
                      </div>
                      <div className="text-xs font-semibold text-gray-800 mt-1">
                        {s.roll_no} • {(s as any).branch || 'N/A'} • {s.section || 'N/A'}
                      </div>
                    </div>
                    <button onClick={() => handleRevoke(s.id)} className="text-xs font-bold text-red-600 hover:text-red-800 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition">
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
