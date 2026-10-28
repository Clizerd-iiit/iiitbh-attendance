'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import Link from 'next/link';
import { OnboardingTour } from '@/components/shared/OnboardingTour';


interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalSubjects: number;
  classesToday: number;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalTeachers: 0, totalSubjects: 0, classesToday: 0 });

  const isSuperAdmin = session?.user?.role === 'superadmin';
  const branchName = (session?.user as any)?.pseudoadminBranch;

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => setStats(d));
  }, []);

  const superAdminLinks = [
    { href: '/admin/users', icon: '👥', label: 'Manage Users', desc: 'Add, edit, disable students & teachers' },
    { href: '/admin/subjects', icon: '📚', label: 'Subjects', desc: 'Create subjects & assign teachers' },
    { href: '/admin/logs', icon: '🔍', label: 'Audit Logs', desc: 'Full history of all changes' },
    { href: '/admin/issues', icon: '⚠️', label: 'Reported Issues', desc: 'View problems from login page' },
    { href: '/admin/settings', icon: '⚙️', label: 'Settings', desc: 'Configure thresholds, domain, expiry' },
  ];

  const pseudoAdminLinks = [
    { href: '/admin/users', icon: '👥', label: 'Manage Users', desc: 'View and manage student details' },
    { href: '/admin/subjects', icon: '📚', label: 'Subjects', desc: 'View subjects and course mappings' },
    { href: '/admin/announcements', icon: '📢', label: 'Announcements', desc: 'Broadcast branch announcements' },
  ];

  const quickLinks = isSuperAdmin ? superAdminLinks : pseudoAdminLinks;

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">{isSuperAdmin ? '🦸' : '🛡️'}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">
                {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
              </h1>
              {!isSuperAdmin && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                  🛡️ Admin {branchName ? `(${branchName})` : ''}
                </span>
              )}
            </div>
            <p className="text-gray-700">
              {isSuperAdmin ? 'Full system control' : `Branch Administration Portal ${branchName ? `• ${branchName}` : ''}`}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div id="tour-admin-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Students', value: stats.totalStudents, color: 'blue' },
            { label: 'Teachers', value: stats.totalTeachers, color: 'green' },
            { label: 'Subjects', value: stats.totalSubjects, color: 'purple' },
            { label: 'Classes Today', value: stats.classesToday, color: 'orange' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-[#231b16] border border-gray-100 dark:border-[#3d3026] rounded-xl p-5 shadow-sm">
              <p className="text-gray-600 dark:text-gray-300 text-sm font-semibold">{s.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className={`grid gap-4 mb-8 ${isSuperAdmin ? 'md:grid-cols-3' : 'md:grid-cols-3'}`}>
          {quickLinks.map(link => {
            let linkId: string | undefined = undefined;
            if (link.href === '/admin/users') linkId = 'tour-admin-users';
            if (link.href === '/admin/subjects') linkId = 'tour-admin-subjects';
            if (link.href === '/admin/appoint') linkId = 'tour-admin-appoint';
            if (link.href === '/admin/announcements') linkId = 'tour-admin-announcements';
            if (link.href === '/admin/logs') linkId = 'tour-admin-logs';
            if (link.href === '/admin/issues') linkId = 'tour-admin-issues';
            if (link.href === '/admin/settings') linkId = 'tour-admin-settings';

            return (
              <Link key={link.href} href={link.href} id={linkId}
                className="bg-white dark:bg-[#231b16] rounded-xl p-6 shadow-sm hover:shadow-md transition border border-gray-100 dark:border-[#3d3026] hover:border-blue-300 dark:hover:border-blue-500/50">
                <div className="text-3xl mb-2">{link.icon}</div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">{link.label}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{link.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Interactive Feature Tour */}
      <OnboardingTour role={isSuperAdmin ? 'superadmin' : 'pseudoadmin'} />
    </div>
  );
}
