'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import Link from 'next/link';

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalSubjects: number;
  classesToday: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalTeachers: 0, totalSubjects: 0, classesToday: 0 });

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/admin/stats').then(r => r.json()).then(d => setStats(d));
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const quickLinks = [
    { href: '/admin/users', icon: '👥', label: 'Manage Users', desc: 'Add, edit, disable students & teachers' },
    { href: '/admin/subjects', icon: '📚', label: 'Subjects', desc: 'Create subjects & assign teachers' },
    { href: '/admin/logs', icon: '🔍', label: 'Audit Logs', desc: 'Full history of all changes' },
    { href: '/admin/settings', icon: '⚙️', label: 'Settings', desc: 'Configure thresholds, domain, expiry' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">🦸</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Super Admin Dashboard</h1>
            <p className="text-gray-500">Full system control</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Students', value: stats.totalStudents, color: 'blue' },
            { label: 'Teachers', value: stats.totalTeachers, color: 'green' },
            { label: 'Subjects', value: stats.totalSubjects, color: 'purple' },
            { label: 'Classes Today', value: stats.classesToday, color: 'orange' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-gray-500 text-sm">{s.label}</p>
              <p className="text-3xl font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <Link key={link.href} href={link.href}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition border hover:border-blue-300">
              <div className="text-3xl mb-2">{link.icon}</div>
              <h3 className="font-semibold text-gray-800">{link.label}</h3>
              <p className="text-gray-500 text-sm mt-1">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
