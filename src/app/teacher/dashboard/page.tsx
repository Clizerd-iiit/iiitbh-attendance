"use client";
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { WelcomeCard } from '@/components/shared/WelcomeCard';
import Link from 'next/link';
import { Subject } from '@/types';
import { CRDelegationModal } from '@/components/teacher/CRDelegationModal';
import { ActiveCRDelegations } from '@/components/teacher/ActiveCRDelegations';
import type { CRDelegation } from '@/lib/delegation';
import { OnboardingTour } from '@/components/shared/OnboardingTour';

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // CR Delegation states
  const [showCRModal, setShowCRModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [delegations, setDelegations] = useState<CRDelegation[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);

  const fetchDelegations = useCallback(() => {
    setLoadingDelegations(true);
    fetch('/api/cr-delegation')
      .then(r => r.json())
      .then(d => {
        setDelegations(d.delegations || []);
        setLoadingDelegations(false);
      })
      .catch(() => setLoadingDelegations(false));
  }, []);

  const fetchData = useCallback(() => {
    fetch('/api/teacher/subjects')
      .then(r => r.json())
      .then(d => {
        setSubjects(d.subjects || []);
        setLoading(false);
      });
    fetchDelegations();
  }, [fetchDelegations]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0 pb-16">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Welcome Card */}
        <div id="tour-teacher-welcome" className="mb-6"><WelcomeCard subtitle="Teacher Dashboard" /></div>

        {/* Active CR Delegations (if any) */}
        <div id="tour-cr-delegation">
          <ActiveCRDelegations
            delegations={delegations}
            onRefresh={fetchDelegations}
            loading={loadingDelegations}
          />
        </div>

        <div id="tour-teacher-subjects">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Subjects</h2>
            {subjects.length > 0 && (
              <button
                onClick={() => {
                  setSelectedSubjectId(subjects[0]?.id || '');
                  setShowCRModal(true);
                }}
                className="bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-900 dark:text-purple-200 border-2 border-purple-300 dark:border-purple-700/60 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <span>🎖️</span>
                <span>Delegate to CR</span>
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"/>)
            ) : subjects.length === 0 ? (
              <div className="col-span-2 text-center text-gray-900 dark:text-gray-100 font-semibold py-12 bg-white dark:bg-[#231b16] rounded-xl border border-gray-200 dark:border-[#3d3026]">
                <p className="text-4xl mb-2">📚</p>
                <p>No subjects assigned yet. Contact administrator.</p>
              </div>
            ) : subjects.map(subject => (
              <div key={subject.id} className="bg-white dark:bg-[#231b16] rounded-xl shadow-sm border border-gray-200 dark:border-[#3d3026] p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{subject.name}</h3>
                    <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mt-0.5">{subject.code} · Section {subject.section} · Sem {subject.semester}</p>
                  </div>
                  <span className="bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 text-xs px-2.5 py-1 rounded-full font-bold">Active</span>
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <Link href={`/teacher/attendance?subject=${subject.id}`}
                    className="flex-1 min-w-[120px] text-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 rounded-lg transition shadow-sm">
                    ✅ Attendance
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(subject.id);
                      setShowCRModal(true);
                    }}
                    className="flex-1 min-w-[120px] text-center bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700/60 font-black text-sm py-2 rounded-lg transition shadow-sm"
                  >
                    🎖️ CR Access
                  </button>
                  <Link href={`/teacher/students?subject=${subject.id}`}
                    className="px-3 text-center bg-gray-100 dark:bg-[#34271e] text-gray-900 dark:text-white font-bold text-sm py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#433227] transition border border-gray-200 dark:border-[#3d3026]">
                    👥 Students
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CR Delegation Modal */}
      <CRDelegationModal
        isOpen={showCRModal}
        onClose={() => setShowCRModal(false)}
        subjects={subjects}
        defaultSubjectId={selectedSubjectId}
        onSuccess={fetchDelegations}
      />

      {/* Interactive Feature Tour */}
      <OnboardingTour role="teacher" />
    </div>
  );
}
