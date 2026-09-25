"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { WelcomeCard } from '@/components/shared/WelcomeCard';
import Link from 'next/link';
import { Subject } from '@/types';

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/teacher/subjects').then(r => r.json()).then(d => {
      setSubjects(d.subjects || []);
      setLoading(false);
    });
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Welcome Card */}
        <WelcomeCard subtitle="Teacher Dashboard" />

        <h2 className="text-lg font-semibold text-gray-700 mb-4">Your Subjects</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse"/>)
          ) : subjects.length === 0 ? (
            <div className="col-span-2 text-center text-gray-400 py-12 bg-white rounded-xl">
              <p className="text-4xl mb-2">📚</p>
              <p>No subjects assigned yet. Contact administrator.</p>
            </div>
          ) : subjects.map(subject => (
            <div key={subject.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">{subject.name}</h3>
                  <p className="text-gray-500 text-sm">{subject.code} · Section {subject.section} · Sem {subject.semester}</p>
                </div>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">Active</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Link href={`/teacher/attendance?subject=${subject.id}`}
                  className="flex-1 text-center bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition">
                  ✅ Take Attendance
                </Link>
                <Link href={`/teacher/students?subject=${subject.id}`}
                  className="flex-1 text-center bg-gray-100 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-200 transition">
                  👥 Students
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
