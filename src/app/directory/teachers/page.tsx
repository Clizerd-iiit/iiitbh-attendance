'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { PhotoZoom } from '@/components/shared/PhotoZoom';

interface Teacher {
  id: string; name: string; email: string; bio?: string;
  profile_photo_url?: string; signup_info?: Record<string, string>;
  is_online?: boolean;
  subjects?: { name: string; code: string; student_count: number }[];
  teaches_me?: boolean;
}

export default function TeachersPage() {
  const { data: session } = useSession();
  const isStudent = session?.user?.role === 'student';
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'my'|'all'>('all');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Set default filter to 'my' only if the user is a student
  useEffect(() => {
    if (isStudent) {
      setFilter('my');
    } else {
      setFilter('all');
    }
  }, [isStudent]);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/users/teachers').then(r => r.json()).then(d => {
        setTeachers(d.teachers || []); setLoading(false);
      });
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = teachers.filter(t => {
    // 1. Check "my" filter (only applies if student and selected 'my')
    if (isStudent && filter === 'my' && !t.teaches_me) {
      return false;
    }
    
    // Check Branch & Status Filters
    const tBranch = t.signup_info?.branch || '';
    if (branchFilter && tBranch !== branchFilter) return false;
    if (statusFilter === 'online' && !t.is_online) return false;
    if (statusFilter === 'offline' && t.is_online) return false;
    
    // 2. Check search
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-800">👨‍🏫 Teachers</h1>
          {isStudent && (
            <div className="flex bg-gray-200 p-1 rounded-xl">
              <button onClick={() => setFilter('my')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-800'}`}>My Teachers</button>
              <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-800'}`}>All Teachers</button>
            </div>
          )}
        </div>

        {/* Search Bar & Filters */}
        <div className="mb-4 relative">
          <input 
            type="text" 
            placeholder="Search faculties by name or email..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-black font-bold bg-white border-2 border-gray-300 rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 shadow-sm transition"
          />
          <span className="absolute left-3 top-3.5 opacity-70">🔍</span>
        </div>
        
        <div className="flex flex-wrap gap-3 mb-6 items-center bg-white p-3 rounded-xl border shadow-sm">
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="bg-gray-50 text-gray-900 font-bold border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 shadow-sm">
            <option value="">All Branches</option>
            <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MEA">MEA</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-50 text-gray-900 font-bold border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 shadow-sm">
            <option value="">Any Status</option>
            <option value="online">🟢 Online</option>
            <option value="offline">⚪ Offline</option>
          </select>
          
          <div className="ml-auto text-sm font-semibold text-gray-700 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg">
            {filtered.length} Teacher{filtered.length !== 1 ? 's' : ''} Found
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-700 py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            {search ? 'No faculties match your search.' : (isStudent && filter === 'my' ? 'No faculties assigned to you yet.' : 'No teachers found')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(t => (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition">
                <div className="relative flex-shrink-0">
                  {t.profile_photo_url ? (
                    <PhotoZoom src={t.profile_photo_url} alt={t.name} size={56}
                      className="border-2 border-green-200"/>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xl">
                      {t.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${t.is_online ? 'bg-green-400' : 'bg-gray-300'}`}
                    title={t.is_online ? 'Online' : 'Offline'}/>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      {t.name}
                      {t.teaches_me && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-200">Teaches You</span>}
                    </h3>
                    <span className={`text-xs uppercase font-bold px-1.5 py-0.5 rounded ${t.is_online ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-700'}`}>
                      {t.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate mt-0.5">{t.email}</p>
                  
                  {t.bio && <p className="text-xs text-gray-700 mt-2 line-clamp-2">{t.bio}</p>}
                  
                  {/* Subjects and Student Count */}
                  {t.subjects && t.subjects.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs uppercase tracking-wider font-semibold text-gray-700">Allotted Subjects</p>
                      {t.subjects.map(s => (
                        <div key={s.code} className="text-xs text-gray-700 flex justify-between bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                          <span className="truncate mr-2 font-medium">{s.name} <span className="text-gray-700 font-normal">({s.code})</span></span>
                          <span className="font-medium text-blue-600 shrink-0 bg-blue-50 px-1.5 rounded">{s.student_count} <span className="text-xs font-normal">sts</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
