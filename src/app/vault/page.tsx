'use client';
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { format } from 'date-fns';

export default function VaultPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [form, setForm] = useState({ title: '', description: '', subject_id: '', target_branch: '', target_group: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/vault').then(r=>r.json()).then(d => {
      setNotes(d.notes || []);
      setLoading(false);
    });
    // Fetch subjects for upload
    if (session) {
      fetch(session.user.role === 'teacher' ? '/api/teacher/subjects' : '/api/vault/subjects').then(r=>r.json()).then(d => {
        setSubjects(d.subjects || []);
        if (d.subjects?.[0]) setForm(prev => ({ ...prev, subject_id: d.subjects[0].id }));
      });
    }
  }, [session]);

  const handleUpload = async () => {
    if (!form.title || !form.subject_id || !file) return alert('Title, Subject, and File are required');
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('subject_id', form.subject_id);
    formData.append('target_branch', form.target_branch);
    formData.append('target_group', form.target_group);

    const res = await fetch('/api/vault', { method: 'POST', body: formData });
    if (res.ok) {
      setShowModal(false);
      setFile(null);
      setForm({ ...form, title: '', description: '' });
      // reload notes
      const d = await fetch('/api/vault').then(r=>r.json());
      setNotes(d.notes || []);
    } else {
      alert("Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📚 Community Vault</h1>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
            + Upload Notes
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse"/>)}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center text-gray-500 py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-5xl mb-4">🗂️</p>
            <p className="text-lg">Vault is empty</p>
            <p className="text-sm">Be the first to upload notes!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map(n => (
              <div key={n.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">{n.subject?.code}</span>
                  <span className="text-xs text-gray-500">{format(new Date(n.created_at), 'dd MMM yyyy')}</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{n.title}</h3>
                <p className="text-sm text-gray-500 flex-1">{n.description}</p>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <img src={n.uploader?.profile_photo_url || '/default-avatar.png'} className="w-5 h-5 rounded-full" />
                    {n.uploader?.name}
                  </div>
                  <a href={n.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium">
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Upload to Vault</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Subject</label>
                <select value={form.subject_id} onChange={e=>setForm({...form, subject_id: e.target.value})} className="w-full border p-2.5 rounded-xl bg-white mt-1">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Title</label>
                <input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} placeholder="e.g. Midsem Notes - Unit 1" className="w-full border p-2.5 rounded-xl mt-1"/>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Short description..." className="w-full border p-2.5 rounded-xl mt-1 h-20"/>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">File (PDF/Image)</label>
                <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} className="w-full border p-2.5 rounded-xl mt-1"/>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-70">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
