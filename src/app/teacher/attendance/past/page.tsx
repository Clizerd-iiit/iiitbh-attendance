'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function PastAttendancePage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  
  const [mode, setMode] = useState<'absentees' | 'presentees'>('absentees');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sub = params.get('subject_id');
    const dt = params.get('date');
    const cid = params.get('class_id');
    if (dt) setDate(dt);
    if (cid) setClassId(cid);
    
    fetch('/api/teacher/subjects').then(r=>r.json()).then(d => {
      setSubjects(d.subjects||[]);
      if (sub) setSelectedSubject(sub);
      else if (d.subjects?.[0]) setSelectedSubject(d.subjects[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    setLoading(true);
    
    Promise.all([
      fetch(`/api/admin/users?role=student&subject_id=${selectedSubject}&limit=1000`).then(r=>r.json()),
      fetch(`/api/teacher/attendance/past?subject_id=${selectedSubject}&date=${date}${classId ? `&class_id=${classId}` : ''}`).then(r=>r.json())
    ]).then(([usersData, attData]) => {
      setStudents(usersData.users || []);
      
      // Auto-select based on mode and existing data
      if (attData.attendance && attData.attendance.length > 0) {
        const absentees = new Set<string>();
        const presentees = new Set<string>();
        attData.attendance.forEach((r: any) => {
          if (r.status === 'A') absentees.add(r.student_id);
          else if (r.status === 'P') presentees.add(r.student_id);
        });
        
        if (mode === 'absentees') setSelectedIds(absentees);
        else setSelectedIds(presentees);
      } else {
        setSelectedIds(new Set());
      }
      
      setLoading(false);
    });
  }, [selectedSubject, date, mode]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (visibleOnly: boolean) => {
    const visibleIds = filteredStudents.map(s => s.id);
    if (visibleOnly) {
      const allSelected = visibleIds.every(id => selectedIds.has(id));
      const next = new Set(selectedIds);
      if (allSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      setSelectedIds(next);
    } else {
      if (selectedIds.size === students.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  const submitAttendance = async () => {
    if (!date) return alert('Please select a date');
    
    // Determine who is Present and who is Absent
    const attendanceData: Record<string, string> = {};
    
    students.forEach(s => {
      if (mode === 'absentees') {
        // Teacher selected the ABSENT ones
        attendanceData[s.id] = selectedIds.has(s.id) ? 'A' : 'P';
      } else {
        // Teacher selected the PRESENT ones
        attendanceData[s.id] = selectedIds.has(s.id) ? 'P' : 'A';
      }
    });

    if (!confirm(`You are marking ${Object.values(attendanceData).filter(v=>v==='P').length} students Present and ${Object.values(attendanceData).filter(v=>v==='A').length} students Absent for ${date}. Continue?`)) return;

    setSaving(true);
    const res = await fetch('/api/teacher/attendance/past', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: selectedSubject, date, class_id: classId || undefined, attendance_map: attendanceData })
    });
    setSaving(false);
    
    if (res.ok) {
      alert('Attendance saved successfully!');
      setSelectedIds(new Set()); // Reset
      window.history.back();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to save');
    }
  };

  const filteredStudents = students.filter(s => {
    const sBranch = s.signup_info?.branch || s.branch || '';
    const sGroup = s.signup_info?.group || s.section || '';
    
    if (branchFilter && sBranch !== branchFilter) return false;
    if (groupFilter && !sGroup.includes(groupFilter)) return false;
    
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.roll_no || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 pb-20">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-800">📝 Retroactive Attendance</h1>
          <button onClick={() => window.history.back()} className="text-sm font-medium text-blue-600 hover:underline">
            &larr; Back to Live Attendance
          </button>
        </div>

        {/* Top Controls */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">1. Select Subject</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:border-blue-500 font-medium">
                {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name} {s.branch ? `(${s.branch} ${s.section||""})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">2. Select Past Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')}
                className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:border-blue-500 font-medium"/>
            </div>
          </div>
        </div>

        {/* Marking Mode */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">3. Choose Marking Method</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            
            <div onClick={() => { setMode('absentees'); setSelectedIds(new Set()); }}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition ${mode === 'absentees' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-red-700">Mark Absentees Mode</h3>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mode==='absentees'?'border-red-500':'border-gray-300'}`}>
                  {mode === 'absentees' && <div className="w-2.5 h-2.5 bg-red-500 rounded-full"/>}
                </div>
              </div>
              <p className="text-sm text-gray-600">Select only the students who were <b>ABSENT</b>. Everyone else will be marked Present automatically.</p>
            </div>

            <div onClick={() => { setMode('presentees'); setSelectedIds(new Set()); }}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition ${mode === 'presentees' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-green-700">Mark Presentees Mode</h3>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mode==='presentees'?'border-green-500':'border-gray-300'}`}>
                  {mode === 'presentees' && <div className="w-2.5 h-2.5 bg-green-500 rounded-full"/>}
                </div>
              </div>
              <p className="text-sm text-gray-600">Select only the students who were <b>PRESENT</b>. Everyone else will be marked Absent automatically.</p>
            </div>

          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <input type="text" placeholder="Search Roll No or Name..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full sm:w-48 px-4 py-2 border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white">
                <option value="">All Branches</option>
                <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MEA">MEA</option>
              </select>
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white">
                <option value="">All Groups</option>
                <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
              </select>
            </div>
            
            <div className="flex gap-3 shrink-0">
              <button onClick={() => handleSelectAll(true)} className="text-sm font-medium text-blue-600 hover:underline">
                Select Visible ({filteredStudents.length})
              </button>
              <button onClick={() => handleSelectAll(false)} className="text-sm font-medium text-blue-600 hover:underline">
                Select All ({students.length})
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading students...</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No students found.</p>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredStudents.map(s => (
                  <label key={s.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition ${selectedIds.has(s.id) ? (mode==='absentees' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200') : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelection(s.id)}
                      className={`w-5 h-5 rounded ${mode === 'absentees' ? 'accent-red-500' : 'accent-green-500'}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs font-mono text-gray-500">{s.roll_no || '—'}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <p className="text-sm font-medium text-gray-600">
              Selected: <span className="font-bold text-gray-900">{selectedIds.size}</span> students
            </p>
            <button onClick={submitAttendance} disabled={saving || students.length === 0}
              className={`px-6 py-3 rounded-xl font-bold text-white transition disabled:opacity-70 shadow-sm ${mode === 'absentees' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {saving ? 'Saving...' : (mode === 'absentees' ? 'Mark All Others Present' : 'Mark All Others Absent')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
