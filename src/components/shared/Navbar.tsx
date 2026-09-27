'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { PhotoZoom } from './PhotoZoom';

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
    { href: '/student/dashboard',     icon: '📱', label: 'Dashboard' },
    { href: '/student/history',       icon: '📅', label: 'My Attendance' },
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
  const items = SIDEBAR_ITEMS[role] || [];
  
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState<any>({});

  const photo = session?.user?.profilePhotoUrl || '';
  const name  = session?.user?.name || '';
  const displayRole = role === 'superadmin' ? 'Admin' : (role ? role.charAt(0).toUpperCase() + role.slice(1) : '');

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);


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
    const id = setInterval(ping, 5000); // Check every 5 seconds for faster auto-kick
    return () => clearInterval(id);
  }, [session]);

  const sidebarW = collapsed ? 'w-16' : 'w-64';


  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-blue-200 relative">
              <Image src="/iiitbh-logo.jpg" alt="IIIT Bhagalpur" fill className="object-cover"/>
            </div>
            <span className="font-bold text-gray-800 text-sm leading-tight truncate">IIIT Bhagalpur AMS</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-200 relative">
            <Image src="/iiitbh-logo.jpg" alt="IIIT BH" fill className="object-cover"/>
          </div>
        )}
        {/* Collapse button — desktop only */}
        <button onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 items-center justify-center text-gray-700 flex-shrink-0 transition"
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

          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition group relative
                ${active
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-800'
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
              {!collapsed && <span className="text-sm flex-1 truncate">{item.label}</span>}
              
              {!collapsed && badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse">
                  {badge}
                </span>
              )}

              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full"/>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50 flex items-center gap-2">
                  {item.label} {badge > 0 && `(${badge})`}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-gray-100 mx-3"/>

      {/* User info + logout */}
      <div className={`p-3 space-y-1 ${collapsed ? 'items-center flex flex-col' : ''}`}>
        <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          {photo ? (
            <PhotoZoom src={photo} alt={name} size={collapsed ? 36 : 32}
              className="border-2 border-blue-200 flex-shrink-0"/>
          ) : (
            <div className={`${collapsed ? 'w-9 h-9' : 'w-8 h-8'} rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0`}>
              {name.charAt(0)?.toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
              <p className="text-xs text-gray-700 truncate">{displayRole}</p>
            </div>
          )}
        </div>

        <button onClick={() => { if(window.confirm('Are you sure you want to exit?')) signOut({ callbackUrl: '/auth/login' }) }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 transition text-sm
            ${collapsed ? 'justify-center' : ''}`}
          title="Logout">
          <span className="text-base">🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b flex items-center px-4 py-3 gap-3 shadow-sm">
        <button onClick={() => setOpen(o => !o)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition">
          {open ? '✕' : '☰'}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden border border-blue-200 relative">
            <Image src="/iiitbh-logo.jpg" alt="IIIT BH" fill className="object-cover"/>
          </div>
          <span className="font-bold text-gray-800 text-sm">AMS</span>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setOpen(false)}/>
      )}

      {/* ── Mobile drawer ── */}
      <div className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-2xl transform transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {navContent}
      </div>

      {/* ── Desktop sidebar (fixed) ── */}
      <div className={`hidden md:flex flex-col fixed top-0 left-0 h-full bg-white border-r border-gray-100 shadow-sm z-30 transition-all duration-300 ${sidebarW}`}>
        {navContent}
      </div>
    </>
  );
}
