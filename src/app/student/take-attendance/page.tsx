'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { KioskMode } from '@/components/teacher/KioskMode';
import {
  Lock,
  ShieldCheck,
  Clock,
  QrCode,
  KeyRound,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Users,
  Search,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import type { CRDelegation } from '@/lib/delegation';
import type { AttendanceStatus, User } from '@/types';

type Method = 'qr' | 'otp' | 'kiosk' | 'bulk';

interface ClassSession {
  id: string;
  subject_id: string;
  qr_code: string;
  otp: string;
  status: string;
}

export default function CRTakeAttendancePage() {
  const { data: session } = useSession();

  // Delegation state
  const [delegations, setDelegations] = useState<CRDelegation[]>([]);
  const [activeDelegation, setActiveDelegation] = useState<CRDelegation | null>(null);
  const [loadingDelegations, setLoadingDelegations] = useState(true);

  // Class session state
  const [activeClass, setActiveClass] = useState<ClassSession | null>(null);
  const [method, setMethod] = useState<Method>('qr');
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState<number>(150);

  // Token intervals & countdowns
  const [qrExpiry, setQrExpiry] = useState<number>(60);
  const [otpExpiry, setOtpExpiry] = useState<number>(60);
  const [fullScreenMode, setFullScreenMode] = useState<Method | null>(null);

  // Live attendance
  const [marked, setMarked] = useState<Record<string, AttendanceStatus>>({});
  const [students, setStudents] = useState<User[]>([]);
  const [showKiosk, setShowKiosk] = useState(false);

  // Filters for students
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [searchStudent, setSearchStudent] = useState('');

  // Configurable security verification checkmarks
  const [otpRequireGeofence, setOtpRequireGeofence] = useState(true);
  const [otpRequireFace, setOtpRequireFace] = useState(true);

  const [qrRequireGeofence, setQrRequireGeofence] = useState(true);
  const [qrRequireFace, setQrRequireFace] = useState(true);

  // Bulk Attendance Caution Modal state
  const [showBulkCaution, setShowBulkCaution] = useState(false);
  const [bulkCautionAccepted, setBulkCautionAccepted] = useState(false);
  const [showBulkSheet, setShowBulkSheet] = useState(false);
  const [bulkMarking, setBulkMarking] = useState(false);

  // Fetch active delegations for this student
  const fetchDelegations = useCallback(async () => {
    setLoadingDelegations(true);
    try {
      const res = await fetch('/api/cr-delegation');
      const data = await res.json();
      const list: CRDelegation[] = data.delegations || [];
      // Keep only active and non-expired
      const valid = list.filter(d => d.is_active && new Date(d.expires_at) > new Date());
      setDelegations(valid);
      if (valid.length > 0 && !activeDelegation) {
        setActiveDelegation(valid[0]);
      } else if (valid.length === 0) {
        setActiveDelegation(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDelegations(false);
    }
  }, [activeDelegation]);

  useEffect(() => {
    fetchDelegations();
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchDelegations();
    }, 120_000);
    return () => clearInterval(id);
  }, [fetchDelegations]);

  // Load students for active delegated subject
  useEffect(() => {
    if (!activeDelegation?.subject_id) return;
    fetch(`/api/admin/users?role=student&subject_id=${activeDelegation.subject_id}&limit=1000`)
      .then(r => r.json())
      .then(d => setStudents(d.users || []))
      .catch(() => {});
  }, [activeDelegation]);

  // Handle ESC for full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreenMode(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll live attendance while a class session is active
  useEffect(() => {
    if (!activeClass) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/cr/classes/live-attendance?classId=${activeClass.id}`);
        const data = await res.json();
        if (data.marked) setMarked(data.marked);
      } catch (e) {}
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [activeClass]);

  // QR / OTP Countdown and auto-refresh
  useEffect(() => {
    if (!activeClass) return;

    const timer = setInterval(async () => {
      if (method === 'qr') {
        setQrExpiry(prev => {
          if (prev <= 1) {
            // Auto regenerate
            fetch('/api/cr/classes', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                classId: activeClass.id,
                action: 'regenerate_tokens',
                delegationId: activeDelegation?.id,
              }),
            })
              .then(r => r.json())
              .then(d => {
                if (d.qrCode) setActiveClass(c => (c ? { ...c, qr_code: d.qrCode, otp: d.otp } : null));
              });
            return 60;
          }
          return prev - 1;
        });
      }

      if (method === 'otp') {
        setOtpExpiry(prev => {
          if (prev <= 1) {
            // Auto regenerate
            fetch('/api/cr/classes', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                classId: activeClass.id,
                action: 'regenerate_tokens',
                delegationId: activeDelegation?.id,
              }),
            })
              .then(r => r.json())
              .then(d => {
                if (d.otp) setActiveClass(c => (c ? { ...c, qr_code: d.qrCode, otp: d.otp } : null));
              });
            return 60;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeClass, method, activeDelegation]);

  // Start Class Session
  const startClass = async (selectedMethod: Method) => {
    if (!activeDelegation) return alert('No active delegation found');

    setLoading(true);
    setMethod(selectedMethod);

    const requireGeofence = selectedMethod === 'otp' ? otpRequireGeofence : (selectedMethod === 'qr' ? qrRequireGeofence : false);
    const requireFace = selectedMethod === 'otp' ? otpRequireFace : (selectedMethod === 'qr' ? qrRequireFace : false);

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (selectedMethod !== 'kiosk' && requireGeofence) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (e) {
        console.warn('GPS failed for anti-proxy', e);
      }
    }

    try {
      const res = await fetch('/api/cr/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: activeDelegation.subject_id,
          method: selectedMethod,
          latitude,
          longitude,
          geofenceRadius: requireGeofence ? radius : 0,
          requireGeofence,
          requireFace,
          qrInterval: 60,
          otpInterval: 60,
          delegationId: activeDelegation.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to start class');
        setLoading(false);
        return;
      }

      setActiveClass(data.class);
      setQrExpiry(60);
      setOtpExpiry(60);
      setLoading(false);

      if (selectedMethod === 'kiosk') {
        setShowKiosk(true);
      }
    } catch (err: any) {
      alert(err.message || 'Error starting class');
      setLoading(false);
    }
  };

  // Close Class Session
  const closeClass = async () => {
    if (!activeClass) return;
    if (!confirm('Close this attendance session? Unmarked students will be marked Absent automatically.')) return;

    setLoading(true);
    try {
      await fetch('/api/cr/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: activeClass.id,
          action: 'close',
          delegationId: activeDelegation?.id,
        }),
      });
      setActiveClass(null);
      setMarked({});
      setShowKiosk(false);
      setShowBulkSheet(false);
      alert('Class attendance session closed and finalized successfully.');
    } catch (e) {
      alert('Failed to close class');
    } finally {
      setLoading(false);
    }
  };

  const discardSession = async () => {
    if (!activeClass) return;
    if (!confirm('Are you sure you want to discard and cancel this session? Any attendance recorded in this test will be permanently deleted and no absentees will be marked.')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/cr/classes?classId=${activeClass.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to discard session');
        setLoading(false);
        return;
      }
      setActiveClass(null);
      setMarked({});
      setShowKiosk(false);
      setShowBulkSheet(false);
      alert('Session discarded and deleted successfully.');
    } catch {
      alert('Network error while discarding session');
    } finally {
      setLoading(false);
    }
  };

  // Single Manual Mark (Kiosk or list toggle)
  const markManual = async (studentId: string, status: AttendanceStatus) => {
    if (!activeClass) return;
    setMarked(prev => ({ ...prev, [studentId]: status }));
    await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: activeClass.id,
        studentId,
        status,
        method: 'manual',
      }),
    });
  };

  // Mark all enrolled Present or Absent
  const markBulkStatus = async (status: AttendanceStatus) => {
    if (!activeClass || filteredStudents.length === 0) return;
    setBulkMarking(true);

    const ids = filteredStudents.map(s => s.id);
    const newMarks: Record<string, AttendanceStatus> = {};
    ids.forEach(id => (newMarks[id] = status));
    setMarked(prev => ({ ...prev, ...newMarks }));

    try {
      const res = await fetch('/api/attendance/mark/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: activeClass.id,
          studentIds: ids,
          status,
          method: 'manual',
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to bulk mark');
      }
    } catch (e) {
      alert('Error marking bulk attendance');
    } finally {
      setBulkMarking(false);
    }
  };

  // Filter students list
  const filteredStudents = students.filter(s => {
    const sBranch = (s.signup_info?.branch || s.branch || '').toUpperCase().trim();
    const sGroup = (s.signup_info?.group || s.section || '').toUpperCase().trim();
    const sSubGroup = (s.signup_info?.sub_group || '').toUpperCase().trim();
    const name = (s.name || '').toLowerCase();
    const roll = (s.roll_no || '').toLowerCase();
    const q = searchStudent.toLowerCase().trim();

    if (branchFilter && sBranch !== branchFilter.toUpperCase().trim()) return false;
    if (groupFilter) {
      const target = groupFilter.toUpperCase().trim();
      if (target === 'G1') {
        if (!sGroup.startsWith('G1') && !sSubGroup.startsWith('G1')) return false;
      } else if (target === 'G2') {
        if (!sGroup.startsWith('G2') && !sSubGroup.startsWith('G2')) return false;
      } else if (target === 'G1A' || target === 'G1B' || target === 'G2A' || target === 'G2B') {
        if (sSubGroup !== target && sGroup !== target) return false;
      } else {
        if (!sGroup.includes(target) && !sSubGroup.includes(target)) return false;
      }
    }
    if (q && !name.includes(q) && !roll.includes(q)) return false;
    return true;
  }).sort((a, b) => {
    const rA = (a.roll_no || '').trim();
    const rB = (b.roll_no || '').trim();
    if (!rA && !rB) return 0;
    if (!rA) return 1;
    if (!rB) return -1;
    return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const presentCount = Object.values(marked).filter(st => st === 'P' || st === 'Late').length;

  // ----------------------------------------------------
  // VIEW 0: LOADING STATE
  // ----------------------------------------------------
  if (loadingDelegations) {
    return (
      <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 flex items-center justify-center">
        <Navbar />
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-800">Checking CR Permissions...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 1: LOCKED / UNACCESSIBLE STATE (NO ACTIVE DELEGATION)
  // ----------------------------------------------------
  if (delegations.length === 0 || !activeDelegation) {
    return (
      <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 pb-16">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-gray-200 text-center">
            {/* Lock Icon */}
            <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Lock className="w-10 h-10" />
            </div>

            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full mb-3 uppercase tracking-wider border border-amber-300">
              Access Restricted · Delegation Required
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
              Take Attendance Portal Locked
            </h1>

            <p className="text-sm sm:text-base text-gray-800 font-bold max-w-lg mx-auto mb-6 leading-relaxed">
              You do not currently have active attendance delegation from any course instructor or professor.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-left max-w-lg mx-auto space-y-3 mb-8">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>💡</span> How Does This Portal Unlock?
              </h4>
              <p className="text-xs text-gray-800 font-medium leading-relaxed">
                1. When a professor requires class attendance to be taken by the CR, they select <strong>"Delegate to CR"</strong> on their teacher dashboard.
              </p>
              <p className="text-xs text-gray-800 font-medium leading-relaxed">
                2. The teacher assigns access permissions to you (CR) for a specific duration in hours or days.
              </p>
              <p className="text-xs text-gray-800 font-medium leading-relaxed">
                3. Once granted, this portal <strong>unlocks automatically</strong>, allowing you to run live Dynamic QR, OTP, Face Scanner, or Bulk Attendance sessions.
              </p>
            </div>

            <button
              onClick={fetchDelegations}
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition active:scale-95 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Check Permission Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: UNLOCKED STATE (ACTIVE DELEGATION PRESENT)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 pb-20">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Top Active Delegation Banner */}
        {activeDelegation && (
          <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white rounded-2xl p-5 sm:p-6 shadow-md mb-6 border border-purple-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-white/30 flex items-center gap-1">
                    <span>🎖️</span> Delegated CR Mode Active
                  </span>
                  <span className="bg-green-400 text-green-950 text-xs font-black px-2.5 py-0.5 rounded-full">
                    Authorized
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black">
                  {activeDelegation.subjects?.name} ({activeDelegation.subjects?.code})
                </h1>
                <p className="text-xs sm:text-sm text-purple-100 font-semibold">
                  Assigned by: <strong>{activeDelegation.teacher?.name || 'Professor'}</strong> ({activeDelegation.teacher?.email})
                </p>
                {activeDelegation.note && (
                  <p className="text-xs text-purple-200 italic mt-1">
                    Teacher's Note: "{activeDelegation.note}"
                  </p>
                )}
              </div>

              {/* Countdown / Expiry */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 shrink-0 text-right sm:text-right">
                <p className="text-[11px] font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1 justify-end">
                  <Clock className="w-3.5 h-3.5" />
                  Access Expires In
                </p>
                <p className="text-lg font-black text-white mt-0.5">
                  {(() => {
                    const diffMs = new Date(activeDelegation.expires_at).getTime() - Date.now();
                    if (diffMs <= 0) return 'Expired';
                    const h = Math.floor(diffMs / (1000 * 60 * 60));
                    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    return `${h}h ${m}m remaining`;
                  })()}
                </p>
                <p className="text-[10px] text-purple-200 font-bold">
                  Until:{' '}
                  {new Date(activeDelegation.expires_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
            </div>

            {/* If multiple delegations exist, allow switching */}
            {delegations.length > 1 && (
              <div className="mt-4 pt-4 border-t border-white/15 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-purple-200 shrink-0">Switch Subject:</span>
                {delegations.map(del => (
                  <button
                    key={del.id}
                    onClick={() => {
                      if (activeClass) {
                        if (!confirm('Switching subject will close your active attendance session. Proceed?')) return;
                        setActiveClass(null);
                      }
                      setActiveDelegation(del);
                    }}
                    className={`text-xs font-bold px-3 py-1 rounded-lg transition whitespace-nowrap ${
                      activeDelegation.id === del.id
                        ? 'bg-white text-purple-900 shadow'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {del.subjects?.code}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- ACTIVE CLASS SESSION IN PROGRESS ---------------- */}
        {activeClass ? (
          <div className="space-y-6">
            {/* Session Status Banner */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-ping"></span>
                  <span className="text-xs font-black text-green-700 uppercase tracking-wider">
                    Live Session Active
                  </span>
                </div>
                <h3 className="text-lg font-black text-gray-900">
                  {method === 'qr' && 'Live Rotating QR Code'}
                  {method === 'otp' && 'Live 4-Digit OTP'}
                  {method === 'kiosk' && 'Live Face Camera'}
                  {method === 'bulk' && 'Bulk Attendance Sheet'}
                </h3>
                <p className="text-xs text-gray-700 font-bold">
                  {presentCount} of {students.length} Students Marked Present
                </p>
              </div>

              <div className="flex items-center gap-2">
                {method !== 'bulk' && method !== 'kiosk' && (
                  <button
                    onClick={() => setFullScreenMode(method)}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                    title="Fullscreen Mode"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Projector Fullscreen</span>
                  </button>
                )}
                <button
                  onClick={discardSession}
                  disabled={loading}
                  className="py-2.5 px-3.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Discard this test session without saving attendance"
                >
                  🗑️ Discard Session
                </button>
                <button
                  onClick={closeClass}
                  disabled={loading}
                  className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  End & Close Session
                </button>
              </div>
            </div>

            {/* Display QR / OTP Card */}
            {method === 'qr' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center flex flex-col items-center">
                <div className="p-4 bg-white border-8 border-purple-100 rounded-3xl shadow-lg mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
                      window.location.origin + '/student/dashboard?token=' + activeClass.qr_code
                    )}`}
                    alt="Attendance QR"
                    className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span>QR code refreshes automatically in:</span>
                  <span className="font-mono font-black text-purple-700 text-sm">{qrExpiry}s</span>
                </div>
                <p className="text-xs text-gray-500">Ask classmates to scan this code with their Student Portal</p>
              </div>
            )}

            {method === 'otp' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center flex flex-col items-center">
                <div className="px-8 py-5 bg-green-50 border-4 border-dashed border-green-300 rounded-3xl mb-4">
                  <p className="text-6xl sm:text-7xl font-black tracking-widest text-green-700 font-mono">
                    {activeClass.otp}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span>OTP expires and refreshes in:</span>
                  <span className="font-mono font-black text-green-700 text-sm">{otpExpiry}s</span>
                </div>
                <p className="text-xs text-gray-500">Ask classmates to enter this 4-digit code in their Student Portal</p>
              </div>
            )}

            {/* Kiosk Mode Mount */}
            {showKiosk && (
              <KioskMode
                subjectId={activeDelegation?.subject_id || ''}
                onClose={() => setShowKiosk(false)}
                onMark={async studentId => markManual(studentId, 'P')}
                markedMap={marked}
                students={students}
              />
            )}

            {/* Live Students Marked List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-700" />
                  Enrolled Students Live Status ({presentCount}/{students.length} Present)
                </h4>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={searchStudent}
                    onChange={e => setSearchStudent(e.target.value)}
                    className="border border-gray-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Student status cards */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 p-1">
                {filteredStudents.map(st => {
                  const status = marked[st.id];
                  const isP = status === 'P' || status === 'Late';

                  return (
                    <div
                      key={st.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                        isP
                          ? 'bg-green-50 border-green-200 text-green-950 font-bold'
                          : 'bg-gray-50 border-gray-200 text-gray-800 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] ${
                            isP ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {st.name?.charAt(0) || 'S'}
                        </span>
                        <div>
                          <p className="font-bold">{st.name}</p>
                          <p className="text-[10px] opacity-75">Roll: {st.roll_no || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => markManual(st.id, 'P')}
                          className={`px-2.5 py-1 rounded-lg font-black text-xs transition ${
                            isP
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => markManual(st.id, 'A')}
                          className={`px-2.5 py-1 rounded-lg font-black text-xs transition ${
                            status === 'A'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ---------------- NO ACTIVE CLASS SESSION — METHOD SELECTION ---------------- */
          <div className="space-y-6">
            <h2 className="text-lg font-black text-gray-900 px-1">Choose Attendance Method</h2>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Method 1: QR Code */}
              <div className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-purple-400 transition group flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-2xl">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {qrRequireGeofence && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          📍 Geofence
                        </span>
                      )}
                      {qrRequireFace && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                          👤 Face ID
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-1">
                    Dynamic QR {qrRequireGeofence ? '+ Geofence ' : ''}{qrRequireFace ? '+ Face ID' : ''}{!qrRequireGeofence && !qrRequireFace ? 'Only' : ''}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-4">
                    Displays rotating QR code. Toggle required security checks:
                  </p>

                  {/* Security Checkmarks */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qrRequireGeofence}
                        onChange={e => setQrRequireGeofence(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 accent-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-900 select-none">
                        📍 Enable Geofence (Anti-Proxy)
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qrRequireFace}
                        onChange={e => setQrRequireFace(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 accent-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-900 select-none">
                        👤 Enable Face ID (AI Face Recognition)
                      </span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => startClass('qr')}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-black text-sm shadow transition disabled:opacity-50"
                >
                  Start QR Attendance
                </button>
              </div>

              {/* Method 2: OTP */}
              <div className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-green-400 transition group flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold text-2xl">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {otpRequireGeofence && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          📍 Geofence
                        </span>
                      )}
                      {otpRequireFace && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                          👤 Face ID
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-1">
                    OTP {otpRequireGeofence ? '+ Geofence ' : ''}{otpRequireFace ? '+ Face ID' : ''}{!otpRequireGeofence && !otpRequireFace ? 'Only' : ''}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-4">
                    Generates 4-digit code. Toggle required security checks:
                  </p>

                  {/* Security Checkmarks */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={otpRequireGeofence}
                        onChange={e => setOtpRequireGeofence(e.target.checked)}
                        className="w-4 h-4 rounded text-green-600 accent-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-900 select-none">
                        📍 Enable Geofence (Anti-Proxy)
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={otpRequireFace}
                        onChange={e => setOtpRequireFace(e.target.checked)}
                        className="w-4 h-4 rounded text-green-600 accent-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-900 select-none">
                        👤 Enable Face ID (AI Face Recognition)
                      </span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => startClass('otp')}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black text-sm shadow transition disabled:opacity-50"
                >
                  Start OTP Attendance
                </button>
              </div>

              {/* Method 3: Kiosk / Live Camera */}
              <div className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-blue-400 transition group flex flex-col justify-between shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl mb-4">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">Live AI Face Scanner</h3>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-4">
                    Scans faces using this device camera with instant 3D face verification and name badges.
                  </p>
                </div>
                <button
                  onClick={() => startClass('kiosk')}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-sm shadow transition disabled:opacity-50"
                >
                  Start Face Scanner
                </button>
              </div>

              {/* Method 4: Bulk Attendance (with Required Caution Modal) */}
              <div className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-amber-400 transition group flex flex-col justify-between shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-2xl mb-4">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">Bulk Attendance Sheet</h3>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-4">
                    Manually mark class roster (Present / Absent / Late). Strict audit trail logging enforced.
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkCaution(true)}
                  disabled={loading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-black text-sm shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>⚠️</span>
                  <span>Open Bulk Attendance</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- FULLSCREEN PROJECTOR OVERLAY ---------------- */}
      {fullScreenMode && activeClass && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between items-center p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-purple-100 text-purple-900 px-3 py-1 rounded-full">
                {activeDelegation?.subjects?.code} - {activeDelegation?.subjects?.name}
              </span>
              <span className="text-xs font-bold text-gray-600">CR Delegated Session</span>
            </div>
            <button
              onClick={() => setFullScreenMode(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs"
            >
              Exit Fullscreen (ESC)
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center my-4">
            {fullScreenMode === 'qr' ? (
              <div className="p-6 sm:p-10 bg-white border-[16px] border-purple-100 rounded-[3rem] shadow-2xl aspect-square max-h-[75vh] flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(
                    window.location.origin + '/student/dashboard?token=' + activeClass.qr_code
                  )}`}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="p-8 sm:p-14 bg-green-50 border-[16px] border-dashed border-green-200 rounded-[3rem] shadow-inner text-center">
                <p className="text-[18vw] font-black text-green-700 font-mono tracking-widest leading-none">
                  {activeClass.otp}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full ${
                (fullScreenMode === 'qr' ? qrExpiry : otpExpiry) > 10 ? 'bg-green-500' : 'bg-red-500 animate-ping'
              }`}
            />
            <span className="font-mono text-xl sm:text-2xl font-black text-gray-800">
              Refreshes in {fullScreenMode === 'qr' ? qrExpiry : otpExpiry}s
            </span>
          </div>
        </div>
      )}

      {/* ---------------- CR BULK ATTENDANCE CAUTION MODAL ---------------- */}
      {showBulkCaution && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-300 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-2xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 leading-snug">
                  CR Attendance Caution & Responsibility Notice
                </h3>
                <p className="text-xs text-gray-600 font-bold">Please review carefully before proceeding</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-gray-800 leading-relaxed bg-amber-50/70 p-4 rounded-xl border border-amber-200">
              <p className="font-bold text-amber-950">
                You are conducting attendance for <strong>{activeDelegation?.subjects?.name}</strong> on behalf of Professor{' '}
                <strong>{activeDelegation?.teacher?.name || 'Subject Instructor'}</strong>.
              </p>
              <ul className="space-y-1.5 list-disc pl-4 text-xs font-medium text-gray-800">
                <li>
                  Every student status you mark, along with exact timestamps and your network IP, is <strong>cryptographically recorded in the Audit Logs</strong>.
                </li>
                <li>
                  Any form of <strong>proxy, fraudulent attendance, or unauthorized marking</strong> is strictly prohibited and constitutes a serious academic violation.
                </li>
                <li>
                  Only mark attendance for students who are physically present in the classroom.
                </li>
                <li>
                  You can only modify or finalize attendance sessions initiated by you during this active delegation.
                </li>
              </ul>
            </div>

            <div className="mt-4 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="acceptCaution"
                checked={bulkCautionAccepted}
                onChange={e => setBulkCautionAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="acceptCaution" className="text-xs font-bold text-gray-900 cursor-pointer select-none">
                I have read and understood the instructions above, and I accept full responsibility for the accuracy and integrity of this attendance session.
              </label>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowBulkCaution(false);
                  setBulkCautionAccepted(false);
                }}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkCautionAccepted}
                onClick={async () => {
                  setShowBulkCaution(false);
                  await startClass('bulk');
                }}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow transition disabled:opacity-50"
              >
                Acknowledge & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
