'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { PhotoZoom } from './PhotoZoom';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from '../notifications/NotificationBell';

const SIDEBAR_ITEMS: Record<string, {href: string, icon: string, label: string}[]> = {
  superadmin: [
    { href: '/admin/dashboard',  icon: '📊', label: 'Dashboard' },
    { href: '/admin/announcements', icon: '📢', label: 'Announcements' },
    { href: '/admin/verify',     icon: '⏳', label: 'Verify Users' },
    { href: '/admin/users',      icon: '👥', label: 'All Users' },
    { href: '/admin/appoint',    icon: '🎖️', label: 'Appoint Position' },
    { href: '/admin/subjects',   icon: '📚', label: 'Subjects' },
    { href: '/admin/logs',       icon: '🕵️', label: 'Audit Logs' },
    { href: '/directory/teachers',icon: '🎓', label: 'Teachers' },
    { href: '/directory/students',icon: '🧑‍🎓', label: 'Students' },
    { href: '/profile',          icon: '👤', label: 'My Profile' },
    { href: '/admin/inbox',      icon: '💬', label: 'Inbox' },
    { href: '/admin/issues',     icon: '⚠️', label: 'Reported Issues' },
    { href: '/admin/settings',   icon: '⚙️', label: 'Settings' },
  ],
  teacher: [
    { href: '/teacher/dashboard',     icon: '📊', label: 'Dashboard' },
    { href: '/teacher/attendance',    icon: '✅', label: 'Take Attendance' },
    { href: '/teacher/students',      icon: '👥', label: 'My Students' },
    { href: '/teacher/announcements', icon: '📢', label: 'Announcements' },
    { href: '/admin/appoint',         icon: '🎖️', label: 'Appoint Position' },
    { href: '/teacher/reports',       icon: '📑', label: 'Reports' },
    { href: '/admin/verify',          icon: '⏳', label: 'Verify Users' },
    { href: '/admin/logs',            icon: '🕵️', label: 'Audit Logs' },
    { href: '/directory/teachers',    icon: '🎓', label: 'Teachers' },
    { href: '/directory/students',    icon: '🧑‍🎓', label: 'Students' },
    { href: '/profile',               icon: '👤', label: 'My Profile' },
    { href: '/teacher/contact',       icon: '🎧', label: 'Contact Admin' },
  ],
  student: [
    { href: '/student/dashboard',       icon: '📱', label: 'Dashboard' },
    { href: '/student/take-attendance', icon: '📋', label: 'Take Attendance' },
    { href: '/student/history',         icon: '📅', label: 'My Attendance' },
    { href: '/student/announcements', icon: '📢', label: 'Announcements' },
    { href: '/admin/logs',            icon: '🕵️', label: 'Audit Logs' },
    { href: '/directory/teachers',    icon: '🎓', label: 'Teachers' },
    { href: '/directory/students',    icon: '🧑‍🎓', label: 'Students' },
    { href: '/profile',               icon: '👤', label: 'My Profile' },
    { href: '/student/contact',       icon: '🎧', label: 'Contact Admin' },
  ],
};

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const rawRole = session?.user?.role as string;
  const role = rawRole === 'admin' ? 'superadmin' : rawRole;
  
  const isPseudoadmin = !!(session?.user as any)?.isPseudoadmin;
  const pseudoadminBranch = (session?.user as any)?.pseudoadminBranch;

  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState<any>({});
  const [activeClass, setActiveClass] = useState(false);
  const [showClearAllData, setShowClearAllData] = useState(false);
  const [hasCRDelegation, setHasCRDelegation] = useState(false);
  const [isCR, setIsCR] = useState(!!(session?.user as any)?.isCr);

  // Sync isCR from session whenever session updates
  useEffect(() => {
    if ((session?.user as any)?.isCr !== undefined) {
      setIsCR(!!(session?.user as any)?.isCr);
    }
  }, [session]);

  const photo = session?.user?.profilePhotoUrl || session?.user?.image || '';
  const name  = session?.user?.name || '';
  const displayRole = role === 'superadmin' ? 'Admin' : (role ? role.charAt(0).toUpperCase() + role.slice(1) : '');

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Sync showClearAllData from localStorage or cross-tab events
  useEffect(() => {
    const saved = localStorage.getItem('show_clear_all_data');
    if (saved !== null) {
      setShowClearAllData(saved === 'true');
    }
    const handleStorageChange = () => {
      setShowClearAllData(localStorage.getItem('show_clear_all_data') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Check active CR delegation and is_cr status for student
  useEffect(() => {
    if (session?.user?.role === 'student') {
      const checkCR = async () => {
        try {
          const res = await fetch('/api/cr-delegation');
          const data = await res.json();
          setHasCRDelegation((data.delegations || []).length > 0);
          if (data.is_cr !== undefined) {
            setIsCR(!!data.is_cr);
          }
        } catch (e) {}
      };
      checkCR();
      const id = setInterval(checkCR, 60000);
      return () => clearInterval(id);
    }
  }, [session]);

  const isCROrDelegated = isCR || hasCRDelegation || !!(session?.user as any)?.isCr;

  // For pseudoadmin students, surface Admin tools prominently
  // And STRICTLY filter 'Take Attendance' so it only appears for CRs!
  let items = SIDEBAR_ITEMS[role] || [];
  if (isPseudoadmin && role === 'student') {
    items = [
      { href: '/admin/dashboard', icon: '📊', label: 'Admin Dashboard' },
      { href: '/admin/verify', icon: '⏳', label: 'Verify Users' },
      { href: '/admin/announcements', icon: '📢', label: 'Announcements' },
      { href: '/admin/users', icon: '👥', label: 'All Users' },
      { href: '/admin/subjects', icon: '📚', label: 'Subjects' },
      { href: '/student/dashboard', icon: '📱', label: 'Student Portal' },
      ...(isCROrDelegated ? [{ href: '/student/take-attendance', icon: '📋', label: 'Take Attendance' }] : []),
      { href: '/student/history', icon: '📅', label: 'My Attendance' },
      { href: '/admin/logs', icon: '🕵️', label: 'Audit Logs' },
      { href: '/directory/teachers', icon: '🎓', label: 'Teachers' },
      { href: '/directory/students', icon: '🧑‍🎓', label: 'Students' },
      { href: '/profile', icon: '👤', label: 'My Profile' },
      { href: '/student/contact', icon: '🎧', label: 'Contact Admin' },
    ];
  } else if (role === 'student') {
    items = items.filter(item => {
      if (item.href === '/student/take-attendance') {
        return isCROrDelegated;
      }
      return true;
    });
  }

  // Global Heartbeat — update online status every 60s across all pages
  useEffect(() => {
    if (!session?.user) return;
    const ping = async () => {
      try {
        const path = window.location.pathname;
        const now = new Date().toISOString();
        
        // Update local storage if on the relevant page
        if (path.includes('/announcements')) localStorage.setItem('last_seen_announcements', now);
        if (path.includes('/logs')) localStorage.setItem('last_seen_logs', now);
        if (path.includes('/verify')) localStorage.setItem('last_seen_verify', now);

        const payload = {
          lastSeenAnn: localStorage.getItem('last_seen_announcements'),
          lastSeenLogs: localStorage.getItem('last_seen_logs'),
          lastSeenVerify: localStorage.getItem('last_seen_verify'),
        };

        const res = await fetch('/api/heartbeat', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.deactivated) {
          signOut({ callbackUrl: '/auth/login' });
        }
        if (data.activeClass !== undefined) setActiveClass(data.activeClass);
        if (data.showClearAllData !== undefined) {
          setShowClearAllData(data.showClearAllData);
          localStorage.setItem('show_clear_all_data', data.showClearAllData ? 'true' : 'false');
        }
        if (data.counts) {
          // If user is currently on the page, force 0 locally immediately for smooth UI
          setCounts({
             pending: path.includes('/verify') ? 0 : (data.counts.pending || 0),
             logs: path.includes('/logs') ? 0 : (data.counts.logs || 0),
             announcements: path.includes('/announcements') ? 0 : (data.counts.announcements || 0),
             messages: data.counts.messages || 0
          });
        }
      } catch (e) {}
    };
    ping(); // immediate
    const id = setInterval(ping, 60000); // Check every 5 seconds for faster auto-kick
    return () => clearInterval(id);
  }, [session]);

  const sidebarW = collapsed ? 'w-16' : 'w-64';


  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-[#3d3026] ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-blue-200 relative">
              <Image unoptimized={true} src="/iiitbh-logo.jpg" alt="IIIT Bhagalpur" fill className="object-cover"/>
            </div>
            <span className="font-bold text-gray-800 dark:text-[#fcf7f2] text-sm leading-tight truncate">IIIT Bhagalpur AMS</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-200 relative">
            <Image unoptimized={true} src="/iiitbh-logo.jpg" alt="IIIT BH" fill className="object-cover"/>
          </div>
        )}
        {/* Collapse button — desktop only */}
        <button onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[#2d221a] dark:hover:bg-[#3d3026] dark:text-[#fcf7f2] items-center justify-center text-gray-700 flex-shrink-0 transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav items — scrollable */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          
          let badge = 0;
          if (item.label === 'Verify Users') badge = counts.pending || 0;
          if (item.label === 'Audit Logs') badge = counts.logs || 0;
          if (item.label === 'Announcements') badge = counts.announcements || 0;
          if (item.label === 'Contact Admin' || item.label === 'Inbox') badge = counts.messages || 0;

          let tourId: string | undefined = undefined;
          if (item.label === 'Take Attendance') tourId = 'tour-cr-nav';
          if (item.label === 'Reports') tourId = 'tour-teacher-reports';
          if (item.label === 'Appoint Position') tourId = 'tour-teacher-appoint';
          if (item.label === 'Verify Users') tourId = 'tour-admin-verify';
          if (item.label === 'Announcements') {
            tourId = role === 'student' ? 'tour-student-announcements' : (role === 'teacher' ? 'tour-teacher-announcements' : 'tour-admin-announcements');
          }
          if (item.label === 'My Attendance') tourId = 'tour-student-history';
          if (item.label === 'Notes Vault' || item.label === 'Study Material' || item.href === '/vault') tourId = 'tour-student-vault';
          if (item.label === 'My Profile') tourId = 'tour-student-profile';
          if (item.label === 'Contact Admin') tourId = 'tour-student-contact';
          if (item.label === 'Student Portal') tourId = 'tour-student-switcher';
          if (item.label === 'Audit Logs') tourId = 'tour-admin-logs';
          if (item.label === 'Reported Issues') tourId = 'tour-admin-issues';
          if (item.label === 'Settings') tourId = 'tour-admin-settings';
          if (item.label === 'All Users' || item.label === 'Manage Users') tourId = 'tour-admin-users';
          if (item.label === 'Subjects') tourId = role === 'teacher' ? 'tour-teacher-subjects-nav' : 'tour-admin-subjects';

          return (
            <Link key={item.href} href={item.href} id={tourId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition group relative
                ${active
                  ? 'bg-blue-50 text-blue-700 font-bold dark:bg-[#3d2e23] dark:text-amber-400 dark:border dark:border-amber-500/25'
                  : 'text-gray-800 hover:bg-gray-100 hover:text-gray-900 font-semibold dark:text-[#fcf7f2] dark:hover:bg-[#34271e] dark:hover:text-[#ffffff]'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? item.label : undefined}>
              <span className="text-lg flex-shrink-0 relative">
                {item.icon}
                {collapsed && badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"/>
                )}
              </span>
              {!collapsed && (
                <span className="text-sm flex-1 truncate flex items-center gap-2">
                  {item.label}
                  {item.label === 'Dashboard' && activeClass && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse shadow-sm tracking-wide">
                      LIVE CLASS
                    </span>
                  )}
                  {item.label === 'Take Attendance' && (
                    hasCRDelegation ? (
                      <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm tracking-wide">
                        UNLOCKED
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-60" title="Locked until teacher grants access">
                        🔒
                      </span>
                    )
                  )}
                </span>
              )}
              
              {!collapsed && badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse">
                  {badge}
                </span>
              )}

              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 dark:bg-amber-400 rounded-r-full"/>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white dark:bg-[#1a1410] dark:text-[#fcf7f2] dark:border dark:border-[#3d3026] text-xs rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50 flex items-center gap-2">
                  {item.label} {item.label === 'Dashboard' && activeClass && '(LIVE CLASS)'} {badge > 0 && `(${badge})`}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-[#3d3026] mx-3"/>

      {/* User info + logout */}
      <div className={`p-3 space-y-1 ${collapsed ? 'items-center flex flex-col' : ''}`}>
        <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          {photo ? (
            <PhotoZoom src={photo} alt={name} size={collapsed ? 36 : 32}
              className="border-2 border-blue-200 flex-shrink-0"/>
          ) : (
            <div className={`${collapsed ? 'w-9 h-9' : 'w-8 h-8'} rounded-full bg-blue-100 dark:bg-[#3d2e23] flex items-center justify-center text-blue-700 dark:text-amber-400 font-bold text-sm flex-shrink-0`}>
              {name.charAt(0)?.toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-[#fcf7f2] truncate">{name}</p>
              {isPseudoadmin ? (
                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 w-fit mt-0.5">
                  <span>🛡️</span> Admin {pseudoadminBranch ? `(${pseudoadminBranch})` : ''}
                </span>
              ) : (
                <p className="text-xs text-gray-800 dark:text-amber-200/90 font-semibold truncate">{displayRole}</p>
              )}
            </div>
          )}
        </div>

        {/* Notifications & Theme Switcher */}
        <div className={`pt-1 pb-1 flex items-center gap-1.5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {!collapsed && <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Alerts</span>}
          </div>
          <ThemeToggle className={collapsed ? '' : 'justify-center'} />
        </div>

        <button onClick={() => { 
          if(window.confirm('Are you sure you want to exit?')) {
            try { localStorage.removeItem('pwa_banner_dismissed_until'); } catch (_) {}
            signOut({ callbackUrl: '/auth/login' });
          }
        }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition text-sm
            ${collapsed ? 'justify-center' : ''}`}
          title="Logout">
          <span className="text-base">🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>

        {showClearAllData && (
          <button onClick={async () => { 
            if(window.confirm('This will log you out and clear all local cache. Your data on the server will remain safe. Proceed?')) {
              localStorage.clear();
              sessionStorage.clear();
              if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                  await caches.delete(key);
                }
              }
              signOut({ callbackUrl: '/auth/login' });
            }
          }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition text-sm font-medium
              ${collapsed ? 'justify-center' : ''}`}
            title="Clear All Data">
            <span className="text-base">🧹</span>
            {!collapsed && <span>Clear All Data</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-[#1a1410] border-b border-gray-100 dark:border-[#3d3026] flex items-center px-4 py-3 gap-3 shadow-sm">
        <button onClick={() => setOpen(o => !o)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-[#fcf7f2] transition">
          {open ? '✕' : '☰'}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden border border-blue-200 relative">
            <Image unoptimized={true} src="/iiitbh-logo.jpg" alt="IIIT BH" fill className="object-cover"/>
          </div>
          <span className="font-bold text-gray-800 dark:text-[#fcf7f2] text-sm">AMS</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setOpen(false)}/>
      )}

      {/* ── Mobile drawer ── */}
      <div className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#1a1410] border-r border-gray-100 dark:border-[#3d3026] z-50 shadow-2xl transform transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {navContent}
      </div>

      {/* ── Desktop sidebar (fixed) ── */}
      <div className={`hidden md:flex flex-col fixed top-0 left-0 h-full bg-white dark:bg-[#1a1410] border-r border-gray-100 dark:border-[#3d3026] z-30 transition-all duration-300 ${sidebarW}`}>
        {navContent}
      </div>
    </>
  );
}
