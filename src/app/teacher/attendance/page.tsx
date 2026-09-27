'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { KioskMode } from '@/components/teacher/KioskMode';
import { Suspense } from 'react';
import type { User, AttendanceStatus } from '@/types';
import Link from 'next/link';

type Method = 'qr' | 'otp' | 'kiosk' | 'past';

interface ClassSession {
  subject_id: string;
  id: string;
  qr_code: string;
  otp: string;
  status: string;
}

function AttendancePage() {
  const params = useSearchParams();
  const urlSubject = params.get('subject') || '';

  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState(urlSubject);
  const [method, setMethod] = useState<Method>('kiosk');
  const [radius, setRadius] = useState<number>(150);
  
  const [activeClass, setActiveClass] = useState<ClassSession | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [marked, setMarked] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  
  // Local filters for students list
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  
  const [pastSearchMonth, setPastSearchMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pastSearchDate, setPastSearchDate] = useState('');
  const [pastSearchClassNo, setPastSearchClassNo] = useState('');
  
  const [qrRefreshInterval, setQrRefreshInterval] = useState<number>(60);
  const [qrExpiry, setQrExpiry] = useState<number>(60);
  const [otpRefreshInterval, setOtpRefreshInterval] = useState<number>(60);
  const [otpExpiry, setOtpExpiry] = useState<number>(60);
  
  const [toastMsg, setToastMsg] = useState('');
  const [closedClasses, setClosedClasses] = useState<any[]>([]);
  const [showKiosk, setShowKiosk] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState<Method | null>(null);

  // Handle ESC key for full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreenMode(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // Fetch subjects for dropdown
  useEffect(() => {
    fetch('/api/teacher/subjects').then(r=>r.json()).then(d => {
      setSubjects(d.subjects||[]);
      if (d.subjects?.[0] && !subjectId) setSubjectId(d.subjects[0].id);
    });
  }, []);

  // Fetch enrolled students when subject changes (only for active class UI, but good to have ready)
  useEffect(() => {
    if (!subjectId) return;
    fetch(`/api/admin/users?role=student&subject_id=${subjectId}&limit=1000`)
      .then(r => r.json())
      .then(d => setStudents(d.users || []));
  }, [subjectId]);


  // Fetch closed and active classes
  useEffect(() => {
    if (!activeClass) {
      fetch('/api/teacher/classes?limit=1000')
        .then(r => r.json())
        .then(d => {
          if (d.classes) {
            // Check if there is an abandoned active class
            const active = d.classes.find((c: any) => c.status === 'active');
            if (active) {
              setActiveClass(active);
            }

            // Group by subject to calculate classNo (only for closed classes)
            const closedOnly = d.classes.filter((c: any) => c.status === 'closed');
            const bySubject: Record<string, any[]> = {};
            closedOnly.forEach((c: any) => {
              if (!bySubject[c.subject_id]) bySubject[c.subject_id] = [];
              bySubject[c.subject_id].push(c);
            });
            
            Object.values(bySubject).forEach(subjectClasses => {
              subjectClasses.sort((a, b) => {
                const timeA = new Date(`${a.date}T${a.start_time || '00:00:00'}`).getTime();
                const timeB = new Date(`${b.date}T${b.start_time || '00:00:00'}`).getTime();
                return timeA - timeB;
              });
              subjectClasses.forEach((c, index) => c.classNo = index + 1);
            });
            
            const allAssigned = closedOnly.sort((a: any, b: any) => {
              const timeA = new Date(`${a.date}T${a.start_time || '00:00:00'}`).getTime();
              const timeB = new Date(`${b.date}T${b.start_time || '00:00:00'}`).getTime();
              return timeB - timeA;
            });
            
            setClosedClasses(allAssigned);
          }
        });
    }
  }, [activeClass]);

  // Live Attendance Polling
  useEffect(() => {
    if (!activeClass) return;
    const pollAttendance = async () => {
      const res = await fetch(`/api/teacher/classes/live-attendance?classId=${activeClass.id}`);
      if (res.ok) {
        const data = await res.json();
        setMarked(prev => {
          // Check for new markings
          const newlyMarked = Object.keys(data.marked).filter(id => !prev[id] && data.marked[id] === 'P');
          if (newlyMarked.length > 0) {
            const student = students.find(s => s.id === newlyMarked[0]);
            if (student) {
              setToastMsg(`✅ ${student.name} marked Present!`);
              setTimeout(() => setToastMsg(''), 3000);
            }
          }
          return { ...prev, ...data.marked };
        });
      }
    };
    pollAttendance();
    const interval = setInterval(pollAttendance, 3000);
    return () => clearInterval(interval);
  }, [activeClass, students]);

  const regenerateQr = async () => {
    if (!activeClass) return;
    const res = await fetch('/api/teacher/classes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: activeClass.id, action: 'regenerate_tokens', qrInterval: qrRefreshInterval, otpInterval: otpRefreshInterval })
    });
    const data = await res.json();
    setActiveClass(prev => prev ? { ...prev, qr_code: data.qrCode, otp: data.otp } : null);
    setQrExpiry(qrRefreshInterval);
    setOtpExpiry(otpRefreshInterval);
  };

  // QR countdown
  useEffect(() => {
    if (!activeClass || method !== 'qr') return;
    const timer = setInterval(() => {
      setQrExpiry(prev => {
        if (prev <= 1) { regenerateQr(); return qrRefreshInterval; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeClass, method, qrRefreshInterval]);

  // OTP countdown
  useEffect(() => {
    if (!activeClass || method !== 'otp') return;
    const timer = setInterval(() => {
      setOtpExpiry(prev => {
        if (prev <= 1) { regenerateQr(); return otpRefreshInterval; } 
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeClass, method, otpRefreshInterval]);

  const startClass = useCallback(async (selectedMethod: Method) => {
    if (!subjectId) return alert('Please select a subject first.');
    setLoading(true);
    setMethod(selectedMethod);
    
    let latitude = null, longitude = null;
    if (selectedMethod !== 'kiosk') {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (e) {
        console.warn("Could not get GPS for anti-proxy", e);
      }
    }

    const res = await fetch('/api/teacher/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId, method: selectedMethod, latitude, longitude, geofenceRadius: radius, qrInterval: qrRefreshInterval, otpInterval: otpRefreshInterval }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      setLoading(false);
      return;
    }
    setActiveClass(data.class);
    setQrExpiry(qrRefreshInterval);
    setOtpExpiry(otpRefreshInterval);
    setLoading(false);
    
    if (selectedMethod === 'kiosk') {
      setShowKiosk(true);
    }
  }, [subjectId, radius, qrRefreshInterval, otpRefreshInterval]);


  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to permanently delete this class and all its attendance data?')) return;
    setLoading(true);
    await fetch(`/api/teacher/classes?classId=${classId}`, { method: 'DELETE' });
    setClosedClasses(prev => prev.filter(c => c.id !== classId));
    setLoading(false);
    alert('Class deleted successfully.');
  };

  const closeClass = async () => {
    if (!activeClass) return;
    if (!confirm('Close this class? Unmarked students will be marked Absent automatically.')) return;
    
    setLoading(true);
    await fetch('/api/teacher/classes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: activeClass.id, action: 'close' })
    });
    setActiveClass(null);
    setMarked({});
    setLoading(false);
    setShowKiosk(false);
  };

  const markBulk = async (studentIds: string[], status: AttendanceStatus) => {
    if (!activeClass || studentIds.length === 0) return;
    const newMarks: Record<string, AttendanceStatus> = {};
    studentIds.forEach(id => newMarks[id] = status);
    setMarked(prev => ({ ...prev, ...newMarks }));
    await fetch('/api/attendance/mark/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: activeClass.id, studentIds, status, method: 'manual' })
    });
  };

  const markManual = async (studentId: string, status: AttendanceStatus) => {
    if (!activeClass) return;
    // Optimistic update
    setMarked(prev => ({ ...prev, [studentId]: status }));
    await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: activeClass.id, studentId, status, method: 'manual' })
    });
  };

  const markKiosk = async (studentId: string, status: AttendanceStatus) => {
    if (!activeClass) return;
    // Optimistic update
    setMarked(prev => ({ ...prev, [studentId]: status }));
    await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: activeClass.id, studentId, status, method: 'kiosk' })
    });
  };

  const statusColors: Record<string, string> = {
    P: 'bg-green-500 text-white',
    A: 'bg-red-500 text-white',
    Late: 'bg-yellow-500 text-white'
  };


  // Filter enrolled students based on selected target branch/group
  const filteredStudents = students.filter(s => {
    const sBranch = s.signup_info?.branch || s.branch || '';
    const sGroup = s.signup_info?.group || s.section || '';
    if (branchFilter && sBranch !== branchFilter) return false;
    if (groupFilter && !sGroup.includes(groupFilter)) return false;
    return true;
  });


  const filteredClosedClasses = closedClasses.filter(cls => {
    if (pastSearchMonth && !cls.date.startsWith(pastSearchMonth)) return false;
    if (pastSearchDate && cls.date !== pastSearchDate) return false;
    if (pastSearchClassNo && cls.classNo !== parseInt(pastSearchClassNo)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 pb-24">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-800">✅ Take Attendance</h1>
        </div>

        {!activeClass ? (
          <div className="space-y-6">
            {/* Subject and Target Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">1. Select Subject</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:border-blue-500 font-medium text-lg">
                  <option value="" disabled>-- Select a Subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name} {s.branch ? `(${s.branch} ${s.section||""})` : ""}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Branch (Optional)</label>
                  <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2.5 bg-gray-50 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="">All Branches</option>
                    <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MEA">MEA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Group (Optional)</label>
                  <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2.5 bg-gray-50 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="">All Groups</option>
                    <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
                  </select>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-800 px-1 mt-8 mb-4">Choose Attendance Method</h2>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Method 1: Kiosk */}
              <button onClick={() => startClass('kiosk')} disabled={!subjectId || loading}
                className="text-left bg-white p-6 rounded-2xl border-2 border-transparent hover:border-blue-400 hover:shadow-md transition group disabled:opacity-70">
                <div className="text-4xl mb-4">📸</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Start Live AI Detection Attendance</h3>
                <p className="text-sm text-gray-700">Teacher scans faces using this device. Students cannot mark via their portal. Unmarked are marked absent.</p>
              </button>

              {/* Method 2: OTP */}
              <div className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-green-400 transition group flex flex-col justify-between">
                <div>
                  <div className="text-4xl mb-4">🔢</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">OTP + Geofence + Face ID</h3>
                  <p className="text-sm text-gray-700 mb-4">Students mark via portal. Big OTP is displayed here. High volume concurrent scanning.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-gray-700 shrink-0">Radius:</span>
                    <input type="range" min="3" max="500" value={radius} onChange={e=>setRadius(Number(e.target.value))} className="flex-1 accent-green-500" />
                    <div className="flex items-center gap-1 bg-gray-50 border rounded-lg px-2 py-1">
                      <input type="number" min="3" max="500" value={radius} onChange={e=>{const v=Number(e.target.value); if(v>=3 && v<=5000) setRadius(v); else if (e.target.value==='') setRadius(0);}} className="w-12 text-sm font-bold text-gray-800 bg-transparent focus:outline-none text-right" />
                      <span className="text-xs text-gray-700 font-medium">m</span>
                    </div>
                  </div>
                  <button onClick={() => startClass('otp')} disabled={!subjectId || loading}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-70">
                    Start with OTP
                  </button>
                </div>
              </div>

              {/* Method 3: Scanner (QR) */}
              <div className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-purple-400 transition group flex flex-col justify-between">
                <div>
                  <div className="text-4xl mb-4">📱</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Scanner + Geofence + Face ID</h3>
                  <p className="text-sm text-gray-700 mb-4">Students scan a big QR code via portal. High volume concurrent scanning.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-gray-700 shrink-0">Radius:</span>
                    <input type="range" min="3" max="500" value={radius} onChange={e=>setRadius(Number(e.target.value))} className="flex-1 accent-purple-500" />
                    <div className="flex items-center gap-1 bg-gray-50 border rounded-lg px-2 py-1">
                      <input type="number" min="3" max="500" value={radius} onChange={e=>{const v=Number(e.target.value); if(v>=3 && v<=5000) setRadius(v); else if (e.target.value==='') setRadius(0);}} className="w-12 text-sm font-bold text-gray-800 bg-transparent focus:outline-none text-right" />
                      <span className="text-xs text-gray-700 font-medium">m</span>
                    </div>
                  </div>
                  <button onClick={() => startClass('qr')} disabled={!subjectId || loading}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-70">
                    Start with QR
                  </button>
                </div>
              </div>

              {/* Method 4: Manual / Past */}
              <Link href="/teacher/attendance/past"
                className="text-left bg-white p-6 rounded-2xl border-2 border-transparent hover:border-orange-400 hover:shadow-md transition group">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Bulk Manual Entry</h3>
                <p className="text-sm text-gray-700">Add past attendance or feed offline records manually. (Mark Absentees / Mark Presentees Mode).</p>
              </Link>
            </div>
            {/* Today's Closed Classes */}
            {closedClasses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>✅</span> Past Completed Classes
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-3 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-gray-700 mb-1">Filter by Month</label>
                     <input type="month" value={pastSearchMonth} onChange={e=>setPastSearchMonth(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-gray-700 mb-1">Filter by Date</label>
                     <input type="date" value={pastSearchDate} onChange={e=>setPastSearchDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-gray-700 mb-1">Filter by Class No.</label>
                     <input type="number" placeholder="e.g. 5" value={pastSearchClassNo} onChange={e=>setPastSearchClassNo(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex items-end pb-1 shrink-0">
                     <button onClick={()=>{setPastSearchMonth(''); setPastSearchDate(''); setPastSearchClassNo('');}} className="px-3 py-2 text-sm text-red-500 hover:underline font-medium">Clear All</button>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {filteredClosedClasses.length === 0 && (
                    <p className="text-center text-gray-700 text-sm py-4">No classes found for this filter.</p>
                  )}
                  {filteredClosedClasses.map(cls => (
                    <div key={cls.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-3">
                      <div>
                        <p className="font-bold text-gray-800 flex items-center gap-2">
                          {cls.subjects?.name} ({cls.subjects?.code})
                          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">Class No. {cls.classNo}</span>
                        </p>
                        <p className="text-sm text-gray-700 mt-1 font-medium">
                          📅 {cls.date} • ⏰ {cls.start_time} • <span className="text-red-500">Closed</span>
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <a href={`/teacher/attendance/past?subject_id=${cls.subject_id}&date=${cls.date}&class_id=${cls.id}`}
                          className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg text-sm hover:bg-blue-200 transition text-center flex-1">
                          ✏️ Edit
                        </a>
                        <button onClick={() => handleDeleteClass(cls.id)} disabled={loading}
                          className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg text-sm hover:bg-red-200 transition text-center flex-1">
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Header for Active Class */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Class is Live! 🟢</h2>
                <p className="text-sm text-gray-700 capitalize">{method === 'kiosk' ? 'Live Kiosk Mode' : method === 'otp' ? 'OTP Mode' : 'QR Scanner Mode'}</p>
              </div>
              <button onClick={closeClass} disabled={loading}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-sm">
                🔒 Close Class
              </button>
            </div>

            {/* QR Display */}
            {method === 'qr' && (
              <div className="bg-white p-8 rounded-2xl border shadow-xl text-center mb-6 max-w-2xl mx-auto relative">
                <button onClick={() => setFullScreenMode('qr')} className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg> Full Screen
                </button>
                <h2 className="font-bold text-2xl md:text-3xl mb-6 text-gray-800">Scan to Mark Attendance</h2>
                
                <div className="flex flex-col items-center justify-center mb-6">
                  <div className="p-4 bg-white border-8 border-purple-100 rounded-3xl shadow-lg mb-4 transition-transform hover:scale-105">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.origin + '/student/dashboard?token=' + activeClass.qr_code)}`} alt="QR Code" className="w-56 h-56 md:w-80 md:h-80" />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${qrExpiry > 10 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}/>
                    <span className={`font-mono text-xl font-bold ${qrExpiry <= 10 ? 'text-red-500' : 'text-gray-800'}`}>
                      Refreshes in {qrExpiry}s
                    </span>
                  </div>
                  
                  <div className="w-full flex flex-col md:flex-row items-center gap-4 justify-between border-t border-gray-200 pt-4 mt-2">
                    <div className="flex-1 w-full text-left">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-gray-700">Refresh Interval</label>
                        <div className="flex items-center gap-1 bg-white border rounded px-2 py-0.5">
                          <input type="number" min="2" max="180" value={qrRefreshInterval} onChange={(e) => { const v=Number(e.target.value); if(v>=2 && v<=180) { setQrRefreshInterval(v); setQrExpiry(v); } else if (e.target.value==='') setQrRefreshInterval(0); }} className="w-10 text-xs font-bold text-gray-800 text-right focus:outline-none" />
                          <span className="text-xs text-gray-700">sec</span>
                        </div>
                      </div>
                      <input type="range" min="2" max="180" step="1" value={qrRefreshInterval} onChange={(e) => { setQrRefreshInterval(Number(e.target.value)); setQrExpiry(Number(e.target.value)); }} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <button onClick={regenerateQr} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-lg font-medium text-sm shrink-0 transition">
                      🔄 Force Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* OTP Display */}
            {method === 'otp' && (
              <div className="bg-white p-8 rounded-2xl border shadow-xl text-center mb-6 max-w-2xl mx-auto relative">
                <button onClick={() => setFullScreenMode('otp')} className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg> Full Screen
                </button>
                <h2 className="font-bold text-2xl md:text-3xl mb-8 text-gray-800">Enter OTP to Mark Attendance</h2>
                
                <div className="inline-block px-12 md:px-16 py-6 md:py-8 bg-gray-50 border-4 border-dashed border-green-200 rounded-3xl mb-8">
                  <p className="text-6xl md:text-8xl font-black tracking-[0.25em] md:tracking-[0.3em] text-green-700">{activeClass.otp}</p>
                </div>

                <div className="flex flex-col items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${otpExpiry > 10 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}/>
                    <span className={`font-mono text-xl font-bold ${otpExpiry <= 10 ? 'text-red-500' : 'text-gray-800'}`}>
                      Refreshes in {otpExpiry}s
                    </span>
                  </div>
                  
                  <div className="w-full flex flex-col md:flex-row items-center gap-4 justify-between border-t border-gray-200 pt-4 mt-2">
                    <div className="flex-1 w-full text-left">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-gray-700">Refresh Interval</label>
                        <div className="flex items-center gap-1 bg-white border rounded px-2 py-0.5">
                          <input type="number" min="2" max="180" value={otpRefreshInterval} onChange={(e) => { const v=Number(e.target.value); if(v>=2 && v<=180) { setOtpRefreshInterval(v); setOtpExpiry(v); } else if (e.target.value==='') setOtpRefreshInterval(0); }} className="w-10 text-xs font-bold text-gray-800 text-right focus:outline-none" />
                          <span className="text-xs text-gray-700">sec</span>
                        </div>
                      </div>
                      <input type="range" min="2" max="180" step="1" value={otpRefreshInterval} onChange={(e) => { setOtpRefreshInterval(Number(e.target.value)); setOtpExpiry(Number(e.target.value)); }} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <button onClick={regenerateQr} className="bg-green-100 text-green-800 hover:bg-green-200 px-4 py-2 rounded-lg font-medium text-sm shrink-0 transition">
                      🔄 Force Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Kiosk Mode Button */}
            {method === 'kiosk' && (
              <div className="mb-6">
                <button onClick={() => setShowKiosk(true)} className="w-full py-6 bg-gray-900 text-white rounded-2xl font-bold text-xl hover:bg-black shadow-2xl flex items-center justify-center gap-3 transition">
                  <span className="text-3xl">📸</span>
                  Open Camera Scanner
                </button>
              </div>
            )}

            {/* Live Student List */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-xl text-gray-800">Live Feed ({students.length})</h2>
                <span className="px-4 py-1.5 bg-blue-100 text-blue-800 rounded-full font-bold text-sm">
                  {Object.keys(marked).length} marked
                </span>
              </div>
              
              <div className="grid md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                {[...students].sort((a,b) => (marked[a.id] ? 1 : 0) - (marked[b.id] ? 1 : 0)).map(student => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 transition hover:shadow-sm">
                    <div>
                      <p className="font-bold text-gray-800">{student.name}</p>
                      <p className="text-xs text-gray-700 font-mono mt-0.5">{student.roll_no}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {(['P','A','Late'] as AttendanceStatus[]).map(s => (
                        <button key={s} onClick={() => markManual(student.id, s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                            marked[student.id] === s ? statusColors[s] : 'bg-white text-gray-700 border hover:bg-gray-100'
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl font-bold z-[999999] animate-bounce flex items-center gap-2 text-lg border-2 border-green-400">
          {toastMsg}
        </div>
      )}

      {showKiosk && activeClass && (
        <KioskMode 
          subjectId={activeClass.subject_id}
          onClose={() => setShowKiosk(false)}
          onMark={async (id) => { await markKiosk(id, 'P'); }}
          markedMap={marked}
          students={filteredStudents}
        />
      )}

      {/* FULL SCREEN OVERLAY */}
      {fullScreenMode && activeClass && (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-between p-4 md:p-8 h-screen w-screen overflow-hidden">
          <div className="w-full flex justify-between items-start shrink-0">
            <button onClick={() => setFullScreenMode(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-xl font-bold text-lg shadow-sm transition flex items-center gap-2">
              ← Back
            </button>
            <div className="text-gray-700 font-medium hidden sm:block">Press ESC to exit</div>
          </div>
          
          <div className="flex-1 flex items-center justify-center w-full min-h-0 my-4 md:my-8">
            {fullScreenMode === 'qr' ? (
              <div className="p-4 md:p-8 bg-white border-[12px] md:border-[20px] border-purple-100 rounded-[2rem] md:rounded-[4rem] shadow-2xl h-full aspect-square max-h-[75vh] max-w-[90vw] flex items-center justify-center overflow-hidden">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(window.location.origin + '/student/dashboard?token=' + activeClass.qr_code)}`} alt="QR Code" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-full h-full max-h-[75vh] flex items-center justify-center bg-gray-50 border-[12px] md:border-[20px] border-dashed border-green-200 rounded-[3rem] md:rounded-[5rem] shadow-inner overflow-hidden">
                <p className="text-[18vw] sm:text-[20vw] md:text-[22vw] lg:text-[25vw] font-black tracking-widest text-green-700 leading-none whitespace-nowrap">{activeClass.otp}</p>
              </div>
            )}
          </div>

          <div className="w-full flex flex-col items-center justify-center shrink-0 mb-4 gap-3">
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-800 text-center">
              {fullScreenMode === 'qr' ? 'Scan this QR to Mark Present' : 'Enter OTP to Mark Present'}
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full ${fullScreenMode === 'qr' ? (qrExpiry > 10 ? 'bg-green-500' : 'bg-red-500 animate-pulse') : (otpExpiry > 10 ? 'bg-green-500' : 'bg-red-500 animate-pulse')}`}/>
              <span className={`font-mono text-3xl md:text-5xl font-bold ${fullScreenMode === 'qr' ? (qrExpiry <= 10 ? 'text-red-500' : 'text-gray-800') : (otpExpiry <= 10 ? 'text-red-500' : 'text-gray-800')}`}>
                Refreshes in {fullScreenMode === 'qr' ? qrExpiry : otpExpiry}s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePageWrapper() {
  return <Suspense><AttendancePage /></Suspense>;
}
