"use client";
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { format } from 'date-fns';

type AnnType = 'extra_class'|'cancellation'|'test'|'quiz'|'update'|'pdf'|'link'|'text';

interface Subject { id: string; name: string; code: string; branch?: string; section?: string; }
interface Announcement {
  id: string; title: string; content?: string; type: AnnType;
  created_at: string; expires_at?: string; link_url?: string;
  teacher?: { name: string; profile_photo_url?: string; role?: string; };
  teacher_id?: string;
  subject_id?: string;
  subject?: { name: string; code: string };
}

const typeInfo: Record<AnnType, { icon: string; label: string; color: string }> = {
  extra_class:  { icon:'➕', label:'Extra Class', color:'bg-green-100 text-green-700' },
  cancellation: { icon:'❌', label:'Cancelled',   color:'bg-red-100 text-red-700' },
  test:         { icon:'📝', label:'Test',         color:'bg-orange-100 text-orange-700' },
  quiz:         { icon:'❓', label:'Quiz',         color:'bg-purple-100 text-purple-700' },
  update:       { icon:'📌', label:'Update',       color:'bg-blue-100 text-blue-700' },
  pdf:          { icon:'📄', label:'PDF',          color:'bg-gray-100 text-gray-800' },
  link:         { icon:'🔗', label:'Link',         color:'bg-cyan-100 text-cyan-700' },
  text:         { icon:'💬', label:'Notice',       color:'bg-yellow-100 text-yellow-700' },
};

export default function TeacherAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [targetStudentIds, setTargetStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');


  // Form state
  const [form, setForm] = useState({
    subject_id: '', type: 'text' as AnnType, title: '', content: '', link_url: '',
  });
  const [expiryDays, setExpiryDays]   = useState(2);
  const [expiryHours, setExpiryHours] = useState(0);

  const totalHours = () => expiryDays * 24 + expiryHours || 48;

  const fetchAll = () => {
    fetch('/api/announcements').then(r => r.json()).then(d => { setAnnouncements(d.announcements || []); setUserId(d.userId || ''); });
  };

  useEffect(() => {
    fetchAll();
    fetch('/api/teacher/subjects').then(r => r.json()).then(d => setSubjects(d.subjects || []));
  }, []);


  useEffect(() => {
    if (!form.subject_id) {
      setEnrolledStudents([]);
      setTargetStudentIds(new Set());
      return;
    }
    fetch(`/api/admin/users?role=student&subject_id=${form.subject_id}`)
      .then(r => r.json())
      .then(d => setEnrolledStudents(d.users || []));
  }, [form.subject_id]);

  const post = async () => {
    if (!form.title.trim()) return;
    setPosting(true);
    const bodyObj = { 
        ...form, 
        subject_id: form.subject_id || null, 
        expiry_hours: totalHours(),
        target_student_ids: targetStudentIds.size > 0 ? Array.from(targetStudentIds) : null
    };
    if (editingId) {
      await fetch('/api/announcements', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyObj, id: editingId })
      });
    } else {
      await fetch('/api/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
    }
    setPosting(false);
    setShowForm(false);
    setEditingId(null);
    setForm({ subject_id: '', type: 'text', title: '', content: '', link_url: '' });
    setExpiryDays(2); setExpiryHours(0); setTargetStudentIds(new Set());
    fetchAll();
  };

  const deleteAnn = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
    fetchAll();
  };

  // Time left until expiry
  const timeLeft = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h left`;
    return `${h}h ${m}m left`;
  };

  const filteredStudents = enrolledStudents.filter(s => 
    searchQuery.trim() !== '' && 
    (
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📢 Announcements</h1>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            {showForm ? '✕ Cancel' : '+ New'}
          </button>
        </div>

        {/* New/Edit announcement modal */}
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl my-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none">&times;</button>
              </div>
              <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1 pb-4">

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(typeInfo) as AnnType[]).map(t => (
                    <button key={t} onClick={() => setForm(f => ({...f, type: t}))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        form.type === t ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}>
                      {typeInfo[t].icon} {typeInfo[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Subject (optional)</label>
                <select value={form.subject_id} onChange={e => setForm(f => ({...f, subject_id: e.target.value}))}
                  className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 text-sm">
                  <option value="">All my subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code}) {s.branch ? `[${s.branch} ${s.section||""}]` : ""}</option>)}
                </select>
              </div>

              
              {/* Target Audience (only if subject is selected) */}
              {form.subject_id && enrolledStudents.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-2">
                  <p className="text-sm font-medium text-blue-800 mb-2">🎯 Target Specific Students (Optional)</p>
                  <p className="text-xs text-blue-600 mb-3">By default, all enrolled students will receive this. Search and select specific students to restrict visibility.</p>
                  
                  {/* Search Bar */}
                  <div className="mb-3">
                    <input 
                      type="text" 
                      placeholder="Search by Name, Roll No, or Email..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Search Results */}
                  {searchQuery.trim() !== '' && (
                    <div className="max-h-40 overflow-y-auto bg-white p-2 rounded-lg border border-blue-100 mb-3">
                      {filteredStudents.length > 0 ? filteredStudents.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-50 last:border-0">
                          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded"
                            checked={targetStudentIds.has(s.id)} 
                            onChange={(e) => {
                              const next = new Set(targetStudentIds);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              setTargetStudentIds(next);
                            }} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-gray-800 truncate">{s.name} <span className="text-gray-700 font-mono ml-1">{s.roll_no}</span></span>
                            <span className="text-xs text-gray-700 truncate">{s.email}</span>
                          </div>
                        </label>
                      )) : (
                        <p className="text-xs text-gray-700 text-center py-3">No students found matching "{searchQuery}"</p>
                      )}
                    </div>
                  )}

                  {/* Selected Students Chips/List */}
                  {targetStudentIds.size > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-100">
                      <p className="text-xs font-semibold text-blue-800 mb-2">Selected Students ({targetStudentIds.size}):</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(targetStudentIds).map(id => {
                          const s = enrolledStudents.find(x => x.id === id);
                          if (!s) return null;
                          return (
                            <span key={id} className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium">
                              {s.name} ({s.roll_no})
                              <button onClick={() => {
                                const next = new Set(targetStudentIds);
                                next.delete(id);
                                setTargetStudentIds(next);
                              }} className="hover:text-red-600 text-blue-400 font-bold ml-0.5">&times;</button>
                            </span>
                          );
                        })}
                      </div>
                      <button onClick={() => setTargetStudentIds(new Set())} className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline mt-3">
                        Clear All Selections
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Announcement title..."
                  className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 text-sm"/>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Details (optional)</label>
                <textarea value={form.content} onChange={e => setForm(f => ({...f, content: e.target.value}))}
                  placeholder="Additional details..." rows={3}
                  className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 text-sm resize-none"/>
              </div>

              {/* Link */}
              {(form.type === 'link' || form.type === 'pdf') && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">URL</label>
                  <input value={form.link_url} onChange={e => setForm(f => ({...f, link_url: e.target.value}))}
                    placeholder="https://..." type="url"
                    className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 text-sm"/>
                </div>
              )}

              {/* ⏰ Expiry picker */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800 mb-3">⏰ Auto-delete after</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={30} value={expiryDays}
                      onChange={e => setExpiryDays(Number(e.target.value))}
                      className="w-16 border rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-400"/>
                    <span className="text-sm text-amber-700 font-medium">days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={23} value={expiryHours}
                      onChange={e => setExpiryHours(Number(e.target.value))}
                      className="w-16 border rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-400"/>
                    <span className="text-sm text-amber-700 font-medium">hours</span>
                  </div>
                  <span className="text-xs text-amber-600">
                    = {totalHours()}h total
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-2">Default: 48 hours. Leave 0+0 for default.</p>
              </div>

              <button onClick={post} disabled={posting || !form.title.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-70 transition font-medium">
                {posting ? 'Posting…' : (editingId ? '💾 Save Changes' : '📢 Post Announcement')}
              </button>
            </div>
          </div>
          </div>
        )}

        {/* Announcements list */}
        {announcements.length === 0 ? (
          <div className="text-center text-gray-700 py-12 bg-white rounded-2xl">
            <p className="text-4xl mb-2">📭</p>
            <p>No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => {
              const t = typeInfo[ann.type] || typeInfo.text;
              const left = timeLeft(ann.expires_at);
              const isExpiringSoon = ann.expires_at &&
                new Date(ann.expires_at).getTime() - Date.now() < 3 * 3600 * 1000;

              const filteredStudents = enrolledStudents.filter(s => 
    searchQuery.trim() !== '' && 
    (
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
                <div key={ann.id} className="bg-white rounded-xl shadow-sm p-4 border hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 font-medium ${t.color}`}>
                        {t.icon} {t.label}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{ann.title}</p>
                        {ann.content && <p className="text-gray-700 text-xs mt-0.5">{ann.content}</p>}
                        {ann.link_url && (
                          <a href={ann.link_url} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-500 hover:underline mt-0.5 block truncate">
                            🔗 {ann.link_url}
                          </a>
                        )}
                        
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex items-center gap-3 text-xs text-gray-700">
                            <span>{format(new Date(ann.created_at), 'dd MMM, hh:mm a')}</span>
                            {ann.subject && <span>· {ann.subject.name}</span>}
                            {left && (
                              <span className={`font-medium ${isExpiringSoon ? 'text-red-500' : 'text-amber-500'}`}>
                                ⏰ {left}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-100">
                            {ann.teacher?.profile_photo_url ? (
                              <img src={ann.teacher.profile_photo_url} alt={ann.teacher.name} className="w-5 h-5 rounded-full object-cover border" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                                {ann.teacher?.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                            <p className={`text-[11px] ${ann.teacher?.role === 'superadmin' ? 'font-bold text-gray-900 text-[12px]' : 'font-medium text-gray-700'}`}>
                              By {ann.teacher?.name || 'Unknown'} <span className="text-gray-700 font-normal">({ann.teacher?.role === 'superadmin' ? 'Administrator' : ann.teacher?.role === 'teacher' ? 'Professor' : 'Class Representative'})</span>
                            </p>
                          </div>
                        </div>
    
                      </div>
                    </div>
                    {(ann.teacher_id === userId || ann.teacher?.role === 'student' || ann.teacher?.role === 'superadmin' && false /* we shouldn't edit superadmin as teacher */) && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setForm({ subject_id: ann.subject_id || '', type: ann.type, title: ann.title, content: ann.content || '', link_url: ann.link_url || '' });
                          setEditingId(ann.id);
                          setShowForm(true);
                        }} className="text-gray-400 hover:text-blue-500 transition text-xl flex-shrink-0 mt-0.5">✏️</button>
                        <button onClick={() => deleteAnn(ann.id)} className="text-gray-300 hover:text-red-500 transition text-xl flex-shrink-0 mt-0.5">×</button>
                      </div>
                    )}
                    {!(ann.teacher_id === userId || ann.teacher?.role === 'student') && (
                        <button onClick={() => deleteAnn(ann.id)} className="text-gray-300 hover:text-red-500 transition text-xl flex-shrink-0 mt-0.5">×</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
