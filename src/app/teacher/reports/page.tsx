'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { format } from 'date-fns';

interface Subject { id: string; name: string; code: string; }
interface ReportRow {
  id: string; roll_no: string; name: string; total: number; attended: number;
  percentage: number; safe_to_miss: number;
}

export default function TeacherReports() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
    const [defaultersOnly, setDefaultersOnly] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloadMode, setDownloadMode] = useState<'all'|'specific'>('all');
  const [downloadSearch, setDownloadSearch] = useState('');


  const openStudentHistory = async (student: any) => {
    setSelectedStudent(student);
    setLoadingHistory(true);
    const res = await fetch(`/api/teacher/attendance/history?studentId=${student.id}&subjectId=${selected}`);
    const data = await res.json();
    setStudentHistory(data.history || []);
    setLoadingHistory(false);
  };

  const updateStatus = async (classId: string, newStatus: string) => {
    if (!window.confirm('Change attendance status?')) return;
    const res = await fetch('/api/attendance/mark', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, studentId: selectedStudent.id, status: newStatus, method: 'manual' })
    });
    if (res.ok) {
      setStudentHistory(prev => prev.map(h => h.class_id === classId ? { ...h, status: newStatus, method: 'manual' } : h));
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to update');
    }
  };

  const handleExport = () => {
    const list = defaultersOnly ? report.filter(r => r.percentage < 75) : report;
    if (list.length === 0) return alert('No data to export');
    
    let csv = 'Roll No,Name,Total Classes,Attended,Percentage\n';
    list.forEach(r => {
      csv += `${r.roll_no},${r.name},${r.total},${r.attended},${r.percentage}%\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report_${selected}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const displayedReport = defaultersOnly ? report.filter(r => r.percentage < 75) : report;
  useEffect(() => {
    const fetchData = () => {
      fetch('/api/teacher/subjects').then(r=>r.json()).then(d => {
      setSubjects(d.subjects||[]);
      if (d.subjects?.[0]) setSelected(d.subjects[0].id);
    });
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      if (!selected) return;
      fetch(`/api/attendance/report?subject_id=${selected}`)
        .then(r=>r.json()).then(d => { setReport(d.report||[]); setLoading(false); });
    };
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [selected]);

  const exportCSV = async (studentId?: string) => {
    const url = `/api/teacher/attendance/full-export?subject_id=${selected}` + (studentId ? `&student_id=${studentId}` : '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `report.csv`;
    a.click();
  };

  const exportJSON = () => {
    const sub = subjects.find(s => s.id === selected);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${sub?.code || 'attendance'}-${format(new Date(),'yyyy-MM-dd')}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const low = report.filter(r => r.percentage < 75);

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📈 Attendance Reports</h1>
          <div className="flex gap-2 items-center">
            {downloadMode === 'all' ? (
              <button onClick={() => exportCSV()}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
                ⬇️ Download All Students
              </button>
            ) : (
              <div className="relative flex items-center">
                <input type="text" placeholder="Search Roll No..." value={downloadSearch} onChange={e => setDownloadSearch(e.target.value)}
                  className="border rounded-l-lg px-3 py-2 text-sm outline-none focus:border-green-500 w-40" />
                <button onClick={() => {
                  const s = report.find(r => r.roll_no.toLowerCase() === downloadSearch.toLowerCase() || r.name.toLowerCase().includes(downloadSearch.toLowerCase()));
                  if (s) exportCSV(s.id);
                  else alert('Student not found');
                }} className="bg-green-600 text-white px-3 py-2 rounded-r-lg text-sm font-medium hover:bg-green-700">
                  Download
                </button>
              </div>
            )}
            <select value={downloadMode} onChange={e => setDownloadMode(e.target.value as 'all'|'specific')}
              className="border rounded-lg px-2 py-2 text-sm outline-none bg-gray-50 text-gray-800">
              <option value="all">All Students</option>
              <option value="specific">Specific Student</option>
            </select>
          </div>
        </div>

        {/* Subject Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {subjects.map(s => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selected===s.id ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
              {s.code}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {!loading && report.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label:'Total Students', value: report.length, color:'text-gray-800' },
              { label:'Avg Attendance', value: Math.round(report.reduce((a,r)=>a+r.percentage,0)/report.length)+'%', color:'text-blue-600' },
              { label:'Below 75%', value: low.length, color:'text-red-600' },
              { label:'Safe', value: report.length-low.length, color:'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-700 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-700">Roll No</th>
                <th className="text-left p-4 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left p-4 text-sm font-medium text-gray-700">Attended / Total</th>
                <th className="text-left p-4 text-sm font-medium text-gray-700">Percentage</th>
                <th className="text-left p-4 text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-700">Loading report...</td></tr>
              ) : report.sort((a,b) => a.percentage - b.percentage).map(r => {
                const pct = r.percentage;
                const barColor = pct >= 85 ? 'bg-green-500' : pct >= 75 ? 'bg-yellow-400' : 'bg-red-500';
                return (
                  <tr key={r.roll_no} onClick={() => openStudentHistory(r)} className={`${pct < 75 ? 'bg-red-50' : 'hover:bg-gray-50'} cursor-pointer transition-colors duration-150`}>
                    <td className="p-4 text-sm font-mono text-gray-700">{r.roll_no}</td>
                    <td className="p-4 font-medium text-gray-800">{r.name}</td>
                    <td className="p-4 text-sm text-gray-700">{r.attended} / {r.total}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                          <div className={`${barColor} h-1.5 rounded-full`} style={{width:`${Math.min(pct,100)}%`}}/>
                        </div>
                        <span className={`font-bold text-sm ${pct<75?'text-red-600':pct<85?'text-yellow-600':'text-green-600'}`}>{pct}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {pct < 75
                        ? <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">⚠️ Need {r.safe_to_miss < 0 ? Math.abs(r.safe_to_miss)+' more' : 'attention'}</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✅ Safe</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student History Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                <p className="text-sm text-gray-700 font-mono">{selectedStudent.roll_no}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-700 hover:text-gray-700">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {loadingHistory ? (
                <div className="flex justify-center p-8 text-blue-600 animate-pulse">Loading history...</div>
              ) : studentHistory.length === 0 ? (
                <div className="text-center p-8 text-gray-700">No classes found</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 text-xs uppercase">
                      <th className="p-3">Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentHistory.map(h => (
                      <tr key={h.class_id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {format(new Date(h.date), 'dd MMM yyyy')}
                          <br/><span className="text-xs text-gray-700">{h.start_time}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            h.status === 'P' ? 'bg-green-100 text-green-700' :
                            h.status === 'Late' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {h.status === 'P' ? 'Present' : h.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {['P', 'A', 'Late'].map(st => (
                              <button key={st} onClick={() => updateStatus(h.class_id, st)}
                                disabled={h.status === st}
                                className={`px-2 py-1 text-xs font-medium rounded border ${h.status === st ? 'bg-gray-100 text-gray-700 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}>
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t text-xs text-gray-700 text-center">
              Note: Attendance editing is limited by the {defaultersOnly ? '' : ''} global 30-day window policy.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
