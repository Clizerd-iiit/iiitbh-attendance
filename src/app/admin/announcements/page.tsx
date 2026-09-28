'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { Announcement } from '@/types';
import { format } from 'date-fns';

const typeConfig = {
  extra_class: { icon: '➕', label: 'Extra Class', color: 'bg-green-100 text-green-700' },
  cancellation: { icon: '❌', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  test: { icon: '📝', label: 'Test', color: 'bg-orange-100 text-orange-700' },
  quiz: { icon: '❓', label: 'Quiz', color: 'bg-purple-100 text-purple-700' },
  update: { icon: '📌', label: 'Update', color: 'bg-blue-100 text-blue-700' },
  pdf: { icon: '📄', label: 'PDF', color: 'bg-gray-100 text-gray-800' },
  link: { icon: '🔗', label: 'Link', color: 'bg-cyan-100 text-cyan-700' },
  text: { icon: '💬', label: 'Notice', color: 'bg-yellow-100 text-yellow-700' },
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCR, setIsCR] = useState(false);
  const [userId, setUserId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', type: 'text', target_branch: '', target_group: '' });
  
  const postAnnouncement = async () => {
    if (!form.title) return alert('Title required');
    if (editingId) {
      await fetch('/api/announcements', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingId })
      });
    } else {
      await fetch('/api/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
    }
    setShowModal(false); setEditingId(null); setForm({ title: '', content: '', type: 'text', target_branch: '', target_group: '' });
  };
  
  const deleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
  };


  useEffect(() => {
    const fetchData = () => {
      fetch('/api/announcements').then(r => r.json()).then(d => {
      setAnnouncements(d.announcements || []);
      setIsCR(d.is_cr || false);
      setUserId(d.userId || '');
      setLoading(false);
    });
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📢 Announcements</h1>
          {(true) && (
            <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
              + Global Announcement
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse"/>)}</div>
        ) : announcements.length === 0 ? (
          <div className="text-center text-gray-700 py-16">No announcements yet</div>
        ) : (
          <div className="space-y-4">
            {announcements.map(a => {
              const cfg = typeConfig[a.type] || typeConfig.text;
              const sub = a.subject as { name?: string; code?: string } | null;
              const teacher = a.teacher as { name?: string; role?: string; profile_photo_url?: string } | null;
              return (
                <div key={a.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {sub?.code && <span className="text-xs text-gray-700">{sub.code}</span>}
                    </div>
                    <span className="text-xs text-gray-700">
                      {format(new Date(a.created_at), 'dd MMM, HH:mm')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">{a.title}</h3>
                  {a.content && <p className="text-gray-700 text-sm">{a.content}</p>}
                  {a.link_url && (
                    <a href={a.link_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                      🔗 Open Link
                    </a>
                  )}
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                      📄 Download File
                    </a>
                  )}
                  
                  <div className="flex justify-between items-end mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {teacher?.profile_photo_url ? (
                        <img src={teacher.profile_photo_url} alt={teacher.name} className="w-6 h-6 rounded-full object-cover border" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                          {teacher?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <p className={`text-xs ${teacher?.role === 'superadmin' ? 'font-bold text-gray-900 text-[13px]' : 'font-medium text-gray-700'}`}>
                        By {teacher?.name || 'Unknown'} <span className="text-gray-700 font-normal">({teacher?.role === 'superadmin' ? 'Administrator' : teacher?.role === 'teacher' ? 'Professor' : 'Class Representative'})</span> {a.teacher_id === userId ? ' (You)' : ''}
                      </p>
                    </div>
                    {(true) && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setForm({ title: a.title, content: a.content || '', type: a.type, target_branch: a.target_branch || '', target_group: a.target_group || '' });
                          setEditingId(a.id);
                          setShowModal(true);
                        }} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition">Edit</button>
                        <button onClick={() => deleteAnnouncement(a.id)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition">Delete</button>
                      </div>
                    )}
                  </div>
    
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Announcement' : 'Post Global Announcement'}</h2>
            <div className="space-y-3">
              <input placeholder="Title" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="w-full border p-2 rounded"/>
              <textarea placeholder="Message..." value={form.content} onChange={e=>setForm({...form, content: e.target.value})} className="w-full border p-2 rounded h-24"/>
              
              <div className="grid grid-cols-2 gap-2">
                <select value={form.target_branch} onChange={e=>setForm({...form, target_branch: e.target.value})} className="border p-2 rounded text-sm">
                  <option value="">All Branches</option>
                  <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MNC">MNC</option><option value="MAE">MAE</option>
                </select>
                <select value={form.target_group} onChange={e=>setForm({...form, target_group: e.target.value})} className="border p-2 rounded text-sm">
                  <option value="">All Groups</option>
                  <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
                  <option value="G1A">G1A</option><option value="G1B">G1B</option><option value="G2A">G2A</option><option value="G2B">G2B</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setEditingId(null); setForm({ title: '', content: '', type: 'text', target_branch: '', target_group: '' }); }} className="flex-1 py-2 bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={postAnnouncement} className="flex-1 py-2 bg-purple-600 text-white rounded-lg">Post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
