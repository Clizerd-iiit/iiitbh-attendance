'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { format } from 'date-fns';

export default function AdminAttendancePage() {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  const [selStudent, setSelStudent] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [selSubject, setSelSubject] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fetch all students initially
  useEffect(() => {
    fetch('/api/admin/users?role=student&limit=5000')
      .then(r => r.json())
      .then(d => setStudents(d.users || []));
  }, []);

  const selectStudent = async (student: any) => {
    setSelStudent(student);
    setSelSubject(null);
    setHistory([]);
    setPendingChanges({});
    const res = await fetch(`/api/admin/ghost-attendance?action=get_subjects&student_id=${student.id}`);
    const data = await res.json();
    setSubjects(data.subjects || []);
  };

  const selectSubject = async (subject: any) => {
    setSelSubject(subject);
    setLoadingHist(true);
    setPendingChanges({});
    const res = await fetch(`/api/admin/ghost-attendance?action=get_history&student_id=${selStudent.id}&subject_id=${subject.id}`);
    const data = await res.json();
    setHistory(data.history || []);
    setLoadingHist(false);
  };

  const handleStatusChange = (classId: string, status: string) => {
    setPendingChanges(prev => ({ ...prev, [classId]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const [classId, status] of Object.entries(pendingChanges)) {
      await fetch('/api/admin/ghost-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selStudent.id, class_id: classId, status })
      });
    }
    setPendingChanges({});
    setSaving(false);
    
    // Refresh history
    selectSubject(selSubject);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.roll_no || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);

  const statusColor: Record<string,string> = {
    P:'bg-green-100 text-green-700', A:'bg-red-100 text-red-700',
    Late:'bg-yellow-100 text-yellow-700', L:'bg-blue-100 text-blue-700'
  };

  // Group history by Month (e.g. "September 2026")
  const groupedHistory = history.reduce((acc: any, h: any) => {
    const month = format(new Date(h.date), 'MMMM yyyy');
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-800">✅ Attendance Editor</h1>
          
          <a href="/admin/attendance/past" className="px-5 py-2.5 rounded-xl text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 transition shadow-sm flex items-center gap-2">
            📝 Bulk Add Past Attendance
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Column 1: Student Search */}
          <div className="bg-white rounded-2xl shadow-sm p-4 border flex flex-col max-h-[80vh]">
            <h2 className="font-bold text-gray-800 mb-4">1. Select Student</h2>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or roll no..."
              className="w-full bg-gray-50 border rounded-xl px-3 py-2 mb-4 focus:outline-none focus:border-blue-500 text-sm"/>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredStudents.map(s => (
                <div key={s.id} onClick={() => selectStudent(s)}
                  className={`p-3 rounded-xl cursor-pointer border transition ${selStudent?.id === s.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}>
                  <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{s.roll_no || 'No Roll No'}</p>
                </div>
              ))}
              {filteredStudents.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No students found</p>}
            </div>
          </div>

          {/* Column 2 & 3: Subjects and History */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Subjects List */}
            {selStudent ? (
              <div className="bg-white rounded-2xl shadow-sm p-4 border">
                <h2 className="font-bold text-gray-800 mb-4">2. Select Subject for {selStudent.name.split(' ')[0]}</h2>
                {subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map(sub => (
                      <button key={sub.id} onClick={() => selectSubject(sub)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${selSubject?.id === sub.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}>
                        {sub.code} - {sub.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">This student is not enrolled in any subjects.</p>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-8 border text-center text-gray-400">
                Please select a student first.
              </div>
            )}

            {/* Attendance History */}
            {selSubject && (
              <div className="bg-white rounded-2xl shadow-sm p-4 border flex flex-col max-h-[60vh] relative">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-gray-800">3. Attendance History</h2>
                  
                  {Object.keys(pendingChanges).length > 0 && (
                    <button 
                      onClick={handleSave} 
                      disabled={saving}
                      className="bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm">
                      {saving ? 'Saving...' : `💾 Save Changes (${Object.keys(pendingChanges).length})`}
                    </button>
                  )}
                </div>

                {loadingHist ? (
                  <p className="text-sm text-gray-400 p-4">Loading history...</p>
                ) : history.length > 0 ? (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    {Object.entries(groupedHistory).map(([month, records]: any) => (
                      <div key={month}>
                        <h3 className="font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-md mb-2">{month}</h3>
                        <table className="w-full text-sm">
                          <thead className="text-gray-500 border-b">
                            <tr>
                              <th className="text-left py-2 font-medium">Date</th>
                              <th className="text-left py-2 font-medium">Current Status</th>
                              <th className="text-left py-2 font-medium">Update</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {records.map((h: any) => {
                              const currentStatus = pendingChanges[h.class_id] || h.record?.status;
                              return (
                                <tr key={h.class_id} className="hover:bg-gray-50 transition">
                                  <td className="py-2 text-gray-800">
                                    {format(new Date(h.date), 'dd MMM (EEE)')} <span className="text-gray-400 text-xs ml-1">{h.start_time.slice(0,5)}</span>
                                  </td>
                                  <td className="py-2">
                                    {currentStatus ? (
                                      <span className={`text-xs px-2 py-1 rounded font-medium ${statusColor[currentStatus]||'bg-gray-100 text-gray-600'}`}>
                                        {currentStatus}
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">Unmarked</span>
                                    )}
                                  </td>
                                  <td className="py-2">
                                    <select 
                                      value={pendingChanges[h.class_id] || h.record?.status || ''}
                                      onChange={(e) => handleStatusChange(h.class_id, e.target.value)}
                                      className={`border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm ${pendingChanges[h.class_id] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}>
                                      <option value="" disabled>Select...</option>
                                      <option value="P">Present (P)</option>
                                      <option value="A">Absent (A)</option>
                                      <option value="Late">Late</option>
                                      <option value="L">Leave (L)</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No classes found for this subject.</p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
