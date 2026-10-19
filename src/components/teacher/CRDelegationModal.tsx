'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Search, Clock, Calendar, Check, X, AlertCircle } from 'lucide-react';

interface CRDelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: any[];
  defaultSubjectId?: string;
  onSuccess?: () => void;
}

export function CRDelegationModal({
  isOpen,
  onClose,
  subjects,
  defaultSubjectId = '',
  onSuccess,
}: CRDelegationModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId || '');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [durationValue, setDurationValue] = useState<number>(12);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>('hours');
  const [note, setNote] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync defaultSubjectId
  useEffect(() => {
    if (defaultSubjectId) {
      setSelectedSubjectId(defaultSubjectId);
    } else if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [defaultSubjectId, subjects]);

  // Load students enrolled in the selected subject
  useEffect(() => {
    if (!isOpen || !selectedSubjectId) return;

    setLoadingStudents(true);
    setErrorMsg('');
    fetch(`/api/admin/users?role=student&subject_id=${selectedSubjectId}&limit=1000`)
      .then(r => r.json())
      .then(d => {
        setStudents(d.users || []);
        setLoadingStudents(false);
      })
      .catch(() => {
        setLoadingStudents(false);
      });
  }, [isOpen, selectedSubjectId]);

  // Filter students based on search term (name, roll_no, branch, group)
  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const sorted = [...students].sort((a, b) => {
      // Prioritize appointed CRs
      if (a.is_cr && !b.is_cr) return -1;
      if (!a.is_cr && b.is_cr) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (!q) return sorted;

    return sorted.filter(s => {
      const name = (s.name || '').toLowerCase();
      const roll = (s.roll_no || '').toLowerCase();
      const branch = (s.signup_info?.branch || s.branch || '').toLowerCase();
      const group = (s.signup_info?.group || s.section || '').toLowerCase();
      return name.includes(q) || roll.includes(q) || branch.includes(q) || group.includes(q);
    });
  }, [students, searchTerm]);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Expiry preview calculation
  const expiryPreview = useMemo(() => {
    const totalHours = durationUnit === 'days' ? durationValue * 24 : durationValue;
    const targetDate = new Date(Date.now() + totalHours * 60 * 60 * 1000);
    return targetDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [durationValue, durationUnit]);

  const handleGrant = async () => {
    if (!selectedSubjectId) {
      setErrorMsg('Please select a subject.');
      return;
    }
    if (!selectedStudentId) {
      setErrorMsg('Please select a student / CR to delegate.');
      return;
    }
    if (!durationValue || durationValue <= 0) {
      setErrorMsg('Please enter a valid duration.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const totalHours = durationUnit === 'days' ? durationValue * 24 : durationValue;
      const res = await fetch('/api/cr-delegation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crUserId: selectedStudentId,
          subjectId: selectedSubjectId,
          hours: durationUnit === 'hours' ? durationValue : 0,
          days: durationUnit === 'days' ? durationValue : 0,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant delegation');
      }

      alert(
        `✅ Attendance permission granted to ${selectedStudent?.name || 'CR'} for ${selectedSubject?.name || 'subject'} (${durationValue} ${durationUnit})!`
      );
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while granting permission.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 my-8 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xl shadow-sm">
              🎖️
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Delegate Attendance to CR</h2>
              <p className="text-xs text-gray-800 font-bold">Class Representative ko attendance lene ki temporary permission dein</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-bold text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* 1. Subject Select */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
              1. Select Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={e => {
                setSelectedSubjectId(e.target.value);
                setSelectedStudentId('');
              }}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-white text-gray-900 font-bold text-sm focus:outline-none focus:border-purple-600 shadow-sm"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id} className="text-gray-900 font-bold">
                  {s.code} - {s.name} {s.branch ? `(${s.branch} ${s.section || ''})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Select CR / Student with Search Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-gray-900">
                2. Select CR / Student
              </label>
              <span className="text-xs font-bold text-gray-700">
                {filteredStudents.length} Students enrolled
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-2.5">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
              <input
                type="text"
                placeholder="Search by name, roll no, branch, group..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl pl-9 pr-4 py-2 bg-white text-gray-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-purple-600 shadow-sm"
              />
            </div>

            {/* Student Picker List */}
            <div className="max-h-52 overflow-y-auto border-2 border-gray-200 rounded-xl p-1.5 space-y-1.5 bg-gray-50">
              {loadingStudents ? (
                <div className="py-8 text-center text-xs font-bold text-gray-700">Loading enrolled students...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-gray-700">
                  No students found matching "{searchTerm}"
                </div>
              ) : (
                filteredStudents.map(student => {
                  const isSelected = selectedStudentId === student.id;
                  const sBranch = student.signup_info?.branch || student.branch || '';
                  const sGroup = student.signup_info?.group || student.section || '';

                  return (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected ? 'bg-white text-purple-700' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {student.name?.charAt(0) || 'S'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs sm:text-sm truncate">{student.name}</span>
                            {student.is_cr && (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800 border border-purple-300'
                                }`}
                              >
                                🎖️ CR
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-purple-100' : 'text-gray-700'}`}>
                            Roll: {student.roll_no || 'N/A'} {sBranch ? `· ${sBranch}` : ''} {sGroup ? `(${sGroup})` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-white bg-white text-purple-600' : 'border-gray-400 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Duration Configuration */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
              3. Permission Validity Time
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  max={durationUnit === 'hours' ? 168 : 30}
                  value={durationValue}
                  onChange={e => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-white text-gray-900 font-black text-base focus:outline-none focus:border-purple-600 shadow-sm"
                />
              </div>

              {/* Hours / Days Toggle */}
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-300 shrink-0">
                <button
                  type="button"
                  onClick={() => setDurationUnit('hours')}
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-black transition ${
                    durationUnit === 'hours' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-800 hover:text-gray-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Hours
                </button>
                <button
                  type="button"
                  onClick={() => setDurationUnit('days')}
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-black transition ${
                    durationUnit === 'days' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-800 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Days
                </button>
              </div>
            </div>

            <p className="text-[11px] font-bold text-gray-700 mt-1.5 flex items-center gap-1">
              <span>🕒 Access will expire on:</span>
              <span className="text-purple-700 font-black">{expiryPreview} IST</span>
            </p>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
              Note for CR (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Please take today's 2 PM lecture attendance"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-2 bg-white text-gray-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-purple-600 shadow-sm"
            />
          </div>

          {/* 4. Confirmation Box */}
          {selectedStudent && selectedSubject && (
            <div className="p-4 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-gray-900">
                  <p className="font-bold leading-relaxed">
                    Do you want to give Take Attendance Permission for{' '}
                    <strong className="text-purple-900 underline font-black">
                      {selectedSubject.name} ({selectedSubject.code})
                    </strong>{' '}
                    to{' '}
                    <strong className="text-purple-900 underline font-black">
                      {selectedStudent.name}
                    </strong>{' '}
                    ({selectedStudent.signup_info?.branch || selectedStudent.branch || 'Branch'}
                    {selectedStudent.signup_info?.group ? ` - ${selectedStudent.signup_info.group}` : ''}) for{' '}
                    <strong className="text-purple-900 font-black">
                      {durationValue} {durationUnit}
                    </strong>
                    ?
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-bold rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGrant}
            disabled={submitting || !selectedStudentId}
            className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Granting...' : 'Confirm & Grant Permission'}
          </button>
        </div>
      </div>
    </div>
  );
}
