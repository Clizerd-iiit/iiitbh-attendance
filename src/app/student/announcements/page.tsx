'use client';
import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { Announcement } from '@/types';
import { format } from 'date-fns';
import { PhotoZoom } from '@/components/shared/PhotoZoom';

const typeConfig = {
  extra_class: { icon: '➕', label: 'Extra Class', color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' },
  cancellation: { icon: '❌', label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  test: { icon: '📝', label: 'Test', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' },
  quiz: { icon: '❓', label: 'Quiz', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  update: { icon: '📌', label: 'Update', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  pdf: { icon: '📄', label: 'PDF', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  link: { icon: '🔗', label: 'Link', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' },
  text: { icon: '💬', label: 'Notice', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300' },
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCR, setIsCR] = useState(false);
  const [isPseudoadmin, setIsPseudoadmin] = useState(false);
  const [userId, setUserId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'text', target_branch: '', target_group: '' });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements');
      const d = await res.json();
      setAnnouncements(d.announcements || []);
      setIsCR(!!d.is_cr);
      setIsPseudoadmin(!!d.is_pseudoadmin);
      setUserId(d.userId || '');
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchData();
    }, 60000);
    const onVis = () => { if (!document.hidden) fetchData(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchData]);

  const postAnnouncement = async () => {
    if (!form.title.trim()) return alert('Title required');
    setPosting(true);
    try {
      let res;
      if (editingId) {
        res = await fetch('/api/announcements', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, id: editingId }),
        });
      } else {
        res = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to post announcement');
        return;
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ title: '', content: '', type: 'text', target_branch: '', target_group: '' });
      await fetchData();
    } catch (err) {
      console.error('Error posting announcement:', err);
      alert('Failed to post announcement. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error('Error deleting announcement:', err);
    }
  };

  const canPost = isCR || isPseudoadmin;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#120c08] text-gray-900 dark:text-[#fcf7f2] transition-colors">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-[#fcf7f2]">📢 Announcements</h1>
            <p className="text-xs text-gray-500 dark:text-amber-200/60 mt-0.5">Stay updated with classroom schedules and department notices</p>
          </div>
          {canPost && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ title: '', content: '', type: 'text', target_branch: '', target_group: '' });
                setShowModal(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-purple-500/20 active:scale-95 transition"
            >
              + Post {isPseudoadmin ? 'Notice (Admin)' : 'Update (CR)'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white dark:bg-[#1a120b] border border-gray-100 dark:border-amber-900/30 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center bg-white dark:bg-[#1a120b] border border-gray-100 dark:border-amber-900/30 rounded-2xl py-16 px-4 shadow-sm">
            <span className="text-4xl block mb-2">📭</span>
            <p className="font-bold text-gray-800 dark:text-[#fcf7f2]">No announcements right now</p>
            <p className="text-xs text-gray-500 dark:text-amber-200/60 mt-1">Check back later or subscribe to notifications to get alerted immediately.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => {
              const cfg = typeConfig[a.type as keyof typeof typeConfig] || typeConfig.text;
              const sub = a.subject as { name?: string; code?: string } | null;
              const teacher = a.teacher as { name?: string; role?: string; profile_photo_url?: string; branch?: string; signup_info?: any } | null;
              const isAuthor = a.teacher_id === userId;

              return (
                <div
                  key={a.id}
                  className="bg-white dark:bg-[#1a120b] rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-amber-900/30 border-l-4 border-l-blue-500 dark:border-l-blue-500 transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {sub?.code && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-amber-900/40 text-gray-700 dark:text-amber-200">
                          {sub.code}
                        </span>
                      )}
                      {a.target_branch && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40">
                          {a.target_branch}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-amber-200/50">
                      {format(new Date(a.created_at), 'dd MMM, HH:mm')}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-[#fcf7f2] text-base mb-1">{a.title}</h3>
                  {a.content && (
                    <p className="text-gray-600 dark:text-amber-100/80 text-sm whitespace-pre-wrap leading-relaxed">{a.content}</p>
                  )}

                  {a.link_url && (
                    <a
                      href={a.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-flex items-center gap-1 font-medium"
                    >
                      🔗 Open Attachment Link
                    </a>
                  )}

                  {a.file_url && (
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-flex items-center gap-1 font-medium"
                    >
                      📄 Download Attached File
                    </a>
                  )}

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100 dark:border-amber-900/20">
                    <div className="flex items-center gap-2.5">
                      <PhotoZoom
                        src={teacher?.profile_photo_url}
                        alt={teacher?.name || 'Poster'}
                        size={28}
                        className="border border-gray-200 dark:border-amber-900/40"
                      />
                      <p className="text-xs text-gray-600 dark:text-amber-100/70">
                        <span className="font-bold text-gray-900 dark:text-[#fcf7f2]">{teacher?.name || 'Instructor'}</span>
                        {' · '}
                        <span className="opacity-80">
                          {teacher?.role === 'superadmin'
                            ? 'SuperAdmin'
                            : teacher?.signup_info?.is_pseudoadmin
                            ? `Admin (${teacher?.signup_info?.pseudoadmin_branch || teacher?.branch || 'CSE'})`
                            : teacher?.role === 'teacher'
                            ? 'Faculty'
                            : 'CR'}
                        </span>
                        {isAuthor && <span className="ml-1 text-blue-600 dark:text-blue-400 font-bold">(You)</span>}
                      </p>
                    </div>

                    {isAuthor && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setForm({
                              title: a.title,
                              content: a.content || '',
                              type: a.type,
                              target_branch: a.target_branch || '',
                              target_group: a.target_group || '',
                            });
                            setEditingId(a.id);
                            setShowModal(true);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded transition font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(a.id)}
                          className="text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1 rounded transition font-medium"
                        >
                          Delete
                        </button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a120b] border border-gray-100 dark:border-amber-900/40 rounded-2xl p-6 w-full max-w-md mx-auto my-auto shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-[#fcf7f2]">
              {editingId ? 'Edit Announcement' : isPseudoadmin ? 'Post Announcement (Admin)' : 'Post Notice (CR)'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-amber-200/70 block mb-1">Notice Title *</label>
                <input
                  placeholder="e.g. Extra Class Tomorrow at 10 AM"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 dark:border-amber-900/40 bg-white dark:bg-[#231810] p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-amber-200/70 block mb-1">Details / Description</label>
                <textarea
                  placeholder="Write notice instructions or updates..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full border border-gray-200 dark:border-amber-900/40 bg-white dark:bg-[#231810] p-2.5 rounded-xl text-sm h-28 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-amber-200/70 block mb-1">Category</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-200 dark:border-amber-900/40 bg-white dark:bg-[#231810] p-2 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="text">💬 Notice</option>
                    <option value="extra_class">➕ Extra Class</option>
                    <option value="cancellation">❌ Cancelled</option>
                    <option value="test">📝 Test</option>
                    <option value="quiz">❓ Quiz</option>
                    <option value="update">📌 Update</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-amber-200/70 block mb-1">Branch</label>
                  <select
                    value={form.target_branch}
                    onChange={(e) => setForm({ ...form, target_branch: e.target.value })}
                    className="w-full border border-gray-200 dark:border-amber-900/40 bg-white dark:bg-[#231810] p-2 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="">All Branches</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="MNC">MNC</option>
                    <option value="MAE">MAE</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={posting}
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setForm({ title: '', content: '', type: 'text', target_branch: '', target_group: '' });
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-amber-900/30 text-gray-700 dark:text-amber-200 rounded-xl font-bold text-sm hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={posting}
                onClick={postAnnouncement}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md shadow-purple-500/20 active:scale-95 transition flex items-center justify-center gap-1"
              >
                {posting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <span>{editingId ? 'Save Changes' : 'Broadcast Now'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
