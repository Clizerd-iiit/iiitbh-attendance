'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { User } from '@/types';
import { Shield, Award, Users, CheckCircle, Search, Trash2 } from 'lucide-react';

export default function AppointPositionPage() {
  const { data: session } = useSession();
  const rawRole = session?.user?.role as string;
  const isSuperAdmin = rawRole === 'superadmin' || rawRole === 'admin';
  const isTeacher = rawRole === 'teacher';

  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompartment, setActiveCompartment] = useState<'admin' | 'cr'>(isTeacher ? 'cr' : 'admin');

  useEffect(() => {
    if (isTeacher) {
      setActiveCompartment('cr');
    }
  }, [isTeacher]);

  // Admin Appoint State
  const [adminStudentId, setAdminStudentId] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminBranch, setAdminBranch] = useState('CSE');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  // CR Appoint State
  const [crStudentId, setCrStudentId] = useState('');
  const [crSearch, setCrSearch] = useState('');
  const [crBranch, setCrBranch] = useState('CSE');
  const [crMainGroup, setCrMainGroup] = useState('');
  const [crGroup, setCrGroup] = useState('');
  const [crSubmitting, setCrSubmitting] = useState(false);
  const [crMessage, setCrMessage] = useState('');

  const fetchData = () => {
    fetch('/api/users/students')
      .then(r => r.json())
      .then(d => {
        setStudents(d.students || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter students for Admin select
  const filteredForAdmin = students.filter(s => {
    if (!adminSearch.trim()) return true;
    const q = adminSearch.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.roll_no || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const rA = (a.roll_no || '').trim();
    const rB = (b.roll_no || '').trim();
    if (!rA && !rB) return 0;
    if (!rA) return 1;
    if (!rB) return -1;
    return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Filter students for CR select
  const filteredForCR = students.filter(s => {
    if (!crSearch.trim()) return true;
    const q = crSearch.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.roll_no || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const rA = (a.roll_no || '').trim();
    const rB = (b.roll_no || '').trim();
    if (!rA && !rB) return 0;
    if (!rA) return 1;
    if (!rB) return -1;
    return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const selectedAdminStudent = students.find(s => s.id === adminStudentId);
  const selectedCRStudent = students.find(s => s.id === crStudentId);

  // Appointed Lists
  const currentBranchAdmins = students.filter(s => s.signup_info?.is_pseudoadmin).sort((a, b) => {
    const rA = (a.roll_no || '').trim();
    const rB = (b.roll_no || '').trim();
    return rA.localeCompare(rB, undefined, { numeric: true });
  });
  const currentCRs = students.filter(s => (s as any).is_cr).sort((a, b) => {
    const rA = (a.roll_no || '').trim();
    const rB = (b.roll_no || '').trim();
    return rA.localeCompare(rB, undefined, { numeric: true });
  });

  // Handle Assign Branch Admin
  const handleAssignAdmin = async () => {
    if (!adminStudentId) return setAdminMessage('Please select a student first.');
    setAdminSubmitting(true);
    setAdminMessage('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: adminStudentId,
          is_pseudoadmin: true,
          pseudoadmin_branch: adminBranch,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setAdminMessage(err.error || 'Failed to appoint Branch Admin.');
      } else {
        setAdminMessage(`✅ Successfully appointed as Branch Admin for ${adminBranch}!`);
        setAdminStudentId('');
        setAdminSearch('');
        fetchData();
      }
    } catch {
      setAdminMessage('Network error appointing Branch Admin.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Handle Revoke Branch Admin
  const handleRevokeAdmin = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke Admin position from ${name}?`)) return;
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_pseudoadmin: false }),
    });
    fetchData();
  };

  // Handle Assign CR
  const handleAssignCR = async () => {
    if (!crStudentId) return setCrMessage('Please select a student first.');
    setCrSubmitting(true);
    setCrMessage('');

    const finalGroup = crBranch === 'CSE' ? crGroup : '';

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crStudentId,
          is_cr: true,
          branch: crBranch,
          section: finalGroup,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setCrMessage(err.error || 'Failed to assign CR.');
      } else {
        setCrMessage('✅ Successfully appointed as Class Representative (CR)!');
        setCrStudentId('');
        setCrSearch('');
        fetchData();
      }
    } catch {
      setCrMessage('Network error appointing CR.');
    } finally {
      setCrSubmitting(false);
    }
  };

  // Handle Revoke CR
  const handleRevokeCR = async (id: string, name: string) => {
    if (!window.confirm(`Revoke CR position from ${name}?`)) return;
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_cr: false }),
    });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 pb-16">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-2.5">
              <span>🎖️</span> {isTeacher ? 'Appoint Class Representative (CR)' : 'Appoint & Manage Positions'}
            </h1>
            <p className="text-sm font-semibold text-gray-600 mt-1">
              {isTeacher
                ? 'Assign Class Representatives (CR) across departments for your classes.'
                : 'Assign authoritative Branch Admins or Class Representatives (CR) across departments.'}
            </p>
          </div>

          {/* Compartment Tabs - Hidden for teachers since they only manage CRs */}
          {!isTeacher && (
            <div className="flex p-1 bg-gray-200/80 rounded-2xl border border-gray-300 w-fit shrink-0">
              <button
                type="button"
                onClick={() => setActiveCompartment('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition ${
                  activeCompartment === 'admin'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Compartment</span>
                <span className="ml-1 text-[11px] bg-black/20 px-1.5 py-0.2 rounded-full">
                  {currentBranchAdmins.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCompartment('cr')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition ${
                  activeCompartment === 'cr'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>CR Compartment</span>
                <span className="ml-1 text-[11px] bg-black/20 px-1.5 py-0.2 rounded-full">
                  {currentCRs.length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* COMPARTMENT 1: BRANCH ADMIN (Only SuperAdmin can view)             */}
        {/* ------------------------------------------------------------------ */}
        {!isTeacher && activeCompartment === 'admin' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
            {/* Form */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-amber-200 h-fit">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center font-black shadow-sm">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900">Appoint Branch Admin</h2>
                    <p className="text-xs font-semibold text-gray-600">Frontend Admin badge & delegation</p>
                  </div>
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Max 1-2 / Branch
                </span>
              </div>

              <div className="space-y-4">
                {/* Search & Select Student */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Select Student
                    </label>
                    {selectedAdminStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminStudentId('');
                          setAdminSearch('');
                        }}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search candidate by name, roll no, email..."
                      value={adminSearch}
                      onChange={e => setAdminSearch(e.target.value)}
                      className="w-full border border-gray-300 pl-9 pr-8 py-2.5 rounded-xl text-sm font-semibold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-amber-500 shadow-sm"
                    />
                    {adminSearch && (
                      <button
                        type="button"
                        onClick={() => setAdminSearch('')}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-900 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Dropdown Options */}
                  <select
                    value={adminStudentId}
                    onChange={e => setAdminStudentId(e.target.value)}
                    className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-amber-500 outline-none text-sm shadow-sm"
                  >
                    <option value="">-- Choose Candidate ({filteredForAdmin.length} available) --</option>
                    {filteredForAdmin.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.roll_no ? `${s.roll_no} • ` : ''}{s.email})
                      </option>
                    ))}
                  </select>

                  {/* Selected Pill */}
                  {selectedAdminStudent && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-amber-900">Selected Candidate: </span>
                        <strong className="text-amber-950 font-black">{selectedAdminStudent.name}</strong>
                        <span className="text-amber-800 font-mono ml-1">({selectedAdminStudent.roll_no || selectedAdminStudent.email})</span>
                      </div>
                      <span className="text-green-700 font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Ready
                      </span>
                    </div>
                  )}
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block text-xs font-black text-gray-900 uppercase tracking-wider mb-1">
                    Assign to Branch
                  </label>
                  <select
                    value={adminBranch}
                    onChange={e => setAdminBranch(e.target.value)}
                    className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-amber-500 outline-none text-sm shadow-sm"
                  >
                    <option value="CSE">CSE (Computer Science & Engineering)</option>
                    <option value="ECE">ECE (Electronics & Comm. Engineering)</option>
                    <option value="MNC">MNC (Mathematics & Computing)</option>
                    <option value="MAE">MAE (Mechanical & Automation)</option>
                  </select>
                </div>

                {/* Privilege Info Box */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 space-y-1">
                  <p className="font-black flex items-center gap-1.5 text-amber-900">
                    <span>👑</span> Prestigious Admin Privileges:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-900 font-medium pl-1">
                    <li>Displays shining gold <strong>🛡️ Admin</strong> badge everywhere.</li>
                    <li>Full User Verification & Announcements access.</li>
                    <li>Manage Users & Subjects for their branch.</li>
                    <li>Audit logging active for all their operations.</li>
                  </ul>
                </div>

                {adminMessage && (
                  <div className={`text-xs font-bold p-3 rounded-xl border ${
                    adminMessage.startsWith('✅') ? 'bg-green-50 text-green-900 border-green-200' : 'bg-red-50 text-red-900 border-red-200'
                  }`}>
                    {adminMessage}
                  </div>
                )}

                <button
                  onClick={handleAssignAdmin}
                  disabled={adminSubmitting || !adminStudentId}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {adminSubmitting ? 'Appointing...' : `Appoint as ${adminBranch} Admin`}
                </button>
              </div>
            </div>

            {/* List of Active Branch Admins */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    Current Branch Admins ({currentBranchAdmins.length})
                  </h2>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                    <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                  </div>
                ) : currentBranchAdmins.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <Shield className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="font-bold text-sm text-gray-800">No Branch Admins Appointed Yet</p>
                    <p className="text-xs text-gray-500 mt-1">Select a student on the left to assign Admin privileges.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {currentBranchAdmins.map(s => {
                      const assignedBranch = s.signup_info?.pseudoadmin_branch || (s as any).branch || 'General';
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-50/70 to-orange-50/50 border-2 border-amber-200/90 rounded-2xl hover:shadow-md transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow">
                              {s.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-gray-900 text-sm">{s.name}</span>
                                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                  <span>🛡️</span> Admin
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-gray-700 mt-0.5">
                                <span className="font-bold text-amber-900">{assignedBranch} Branch</span> • {s.roll_no || s.email}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRevokeAdmin(s.id, s.name)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            title="Revoke Admin Position"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* COMPARTMENT 2: CLASS REPRESENTATIVE (CR)                           */}
        {/* ------------------------------------------------------------------ */}
        {activeCompartment === 'cr' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
            {/* Form */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-purple-200 h-fit">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-sm">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900">Appoint Class Representative</h2>
                    <p className="text-xs font-semibold text-gray-600">CR attendance and section management</p>
                  </div>
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                  CR Position
                </span>
              </div>

              <div className="space-y-4">
                {/* Search & Select Student */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Select Student
                    </label>
                    {selectedCRStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          setCrStudentId('');
                          setCrSearch('');
                        }}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search student by name, roll no, email..."
                      value={crSearch}
                      onChange={e => setCrSearch(e.target.value)}
                      className="w-full border border-gray-300 pl-9 pr-8 py-2.5 rounded-xl text-sm font-semibold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-purple-500 shadow-sm"
                    />
                    {crSearch && (
                      <button
                        type="button"
                        onClick={() => setCrSearch('')}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-900 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={crStudentId}
                    onChange={e => setCrStudentId(e.target.value)}
                    className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-purple-500 outline-none text-sm shadow-sm"
                  >
                    <option value="">-- Choose Student ({filteredForCR.length} available) --</option>
                    {filteredForCR.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.roll_no ? `${s.roll_no} • ` : ''}{s.email})
                      </option>
                    ))}
                  </select>

                  {selectedCRStudent && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-purple-900">Selected: </span>
                        <strong className="text-purple-950 font-black">{selectedCRStudent.name}</strong>
                        <span className="text-purple-800 font-mono ml-1">({selectedCRStudent.roll_no || selectedCRStudent.email})</span>
                      </div>
                      <span className="text-green-700 font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Ready
                      </span>
                    </div>
                  )}
                </div>

                {/* Branch & Group Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-gray-900 uppercase tracking-wider mb-1">
                      Branch
                    </label>
                    <select
                      value={crBranch}
                      onChange={e => {
                        const b = e.target.value;
                        setCrBranch(b);
                        if (b !== 'CSE') {
                          setCrMainGroup('');
                          setCrGroup('');
                        }
                      }}
                      className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-purple-500 outline-none text-sm shadow-sm"
                    >
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="MNC">MNC</option>
                      <option value="MAE">MAE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-900 uppercase tracking-wider mb-1">
                      Group {crBranch === 'CSE' ? '(CSE Groups & Sub-Groups)' : '(All Groups)'}
                    </label>
                    {crBranch !== 'CSE' ? (
                      <div className="w-full border border-dashed border-gray-300 p-2.5 rounded-xl bg-gray-50 text-gray-600 font-semibold text-xs flex items-center justify-between">
                        <span>All Groups</span>
                        <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-bold">No groups</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={crMainGroup}
                          onChange={e => {
                            const mg = e.target.value;
                            setCrMainGroup(mg);
                            setCrGroup(mg);
                          }}
                          className="w-full border border-gray-300 p-2.5 rounded-xl bg-white text-gray-900 font-semibold focus:border-purple-500 outline-none text-sm shadow-sm"
                        >
                          <option value="">All Groups</option>
                          <option value="G1">Group 1 (G1)</option>
                          <option value="G2">Group 2 (G2)</option>
                        </select>

                        {crMainGroup === 'G1' && (
                          <select
                            value={crGroup}
                            onChange={e => setCrGroup(e.target.value)}
                            className="w-full border border-purple-300 bg-purple-50/50 p-2 rounded-xl text-xs font-bold text-purple-900 focus:border-purple-500 outline-none shadow-sm animate-fadeIn"
                          >
                            <option value="G1">All G1 (Both G1A & G1B)</option>
                            <option value="G1A">↳ Sub-Group G1A</option>
                            <option value="G1B">↳ Sub-Group G1B</option>
                          </select>
                        )}

                        {crMainGroup === 'G2' && (
                          <select
                            value={crGroup}
                            onChange={e => setCrGroup(e.target.value)}
                            className="w-full border border-purple-300 bg-purple-50/50 p-2 rounded-xl text-xs font-bold text-purple-900 focus:border-purple-500 outline-none shadow-sm animate-fadeIn"
                          >
                            <option value="G2">All G2 (Both G2A & G2B)</option>
                            <option value="G2A">↳ Sub-Group G2A</option>
                            <option value="G2B">↳ Sub-Group G2B</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {crMessage && (
                  <div className={`text-xs font-bold p-3 rounded-xl border ${
                    crMessage.startsWith('✅') ? 'bg-green-50 text-green-900 border-green-200' : 'bg-red-50 text-red-900 border-red-200'
                  }`}>
                    {crMessage}
                  </div>
                )}

                <button
                  onClick={handleAssignCR}
                  disabled={crSubmitting || !crStudentId}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {crSubmitting ? 'Assigning...' : `Appoint as CR (${crBranch}${crGroup ? ` - ${crGroup}` : ''})`}
                </button>
              </div>
            </div>

            {/* List of Active CRs */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-600" />
                    Current Appointed CRs ({currentCRs.length})
                  </h2>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                    <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                  </div>
                ) : currentCRs.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <Award className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="font-bold text-sm text-gray-800">No CRs Appointed Yet</p>
                    <p className="text-xs text-gray-500 mt-1">Select a student on the left to appoint as CR.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {currentCRs.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-2xl hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-black text-sm border border-purple-200">
                            {s.name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-gray-900 text-sm">{s.name}</span>
                              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-200">
                                CR
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-gray-700 mt-0.5">
                              {s.roll_no} • {(s as any).branch || 'N/A'} • {s.section || 'All Groups'}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRevokeCR(s.id, s.name)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Revoke CR Position"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
